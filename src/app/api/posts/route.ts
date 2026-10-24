import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { refreshMany } from "@/lib/postStatus";
import { checkSensitive } from "@/lib/sensitive";
import { checkRateLimit, bumpRateLimit } from "@/lib/ratelimit";
import { validatePostInput, toDate, hasErrors } from "@/lib/validate";
import { POST_STATUS, HALL_VISIBLE_STATUS, POST_TYPES } from "@/lib/constants";
import { getBlockedUserIds } from "@/lib/block";

export const dynamic = "force-dynamic";

type PostRow = {
  id: string;
  type: string;
  title: string;
  description: string;
  location: string;
  eventStart: Date;
  eventEnd: Date;
  signupDeadline: Date;
  maxParticipants: number;
  status: string;
  tags: string;
  authorId: string;
  createdAt: Date;
  author: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
    college: string | null;
    grade: string | null;
  };
  _count: { applications: number };
};

function shapePost(p: PostRow, viewerId?: string) {
  const confirmed = p._count.applications;
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    description: p.description,
    location: p.location,
    eventStart: p.eventStart,
    eventEnd: p.eventEnd,
    signupDeadline: p.signupDeadline,
    maxParticipants: p.maxParticipants,
    confirmedCount: confirmed,
    remaining: Math.max(0, p.maxParticipants - confirmed),
    status: p.status,
    tags: p.tags ? p.tags.split(",").filter(Boolean) : [],
    author: p.author,
    isMine: viewerId ? viewerId === p.authorId : false,
    createdAt: p.createdAt,
  };
}

/** GET /api/posts —— 大厅列表（游客可浏览） */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const type = sp.get("type") || "";
  const location = sp.get("location") || "";
  const when = sp.get("when") || ""; // today | week | upcoming
  const onlyMissing = sp.get("onlyMissing") === "1"; // 仅看缺人
  const onlyNotFull = sp.get("onlyNotFull") === "1"; // 仅看未满
  const keyword = (sp.get("q") || "").trim();
  const scope = sp.get("scope") || "hall"; // hall | mine | archived
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(sp.get("pageSize") || "20", 10)));

  const viewer = await getSessionUser();
  const now = new Date();

  // 先把到点/到期的帖子状态刷正，保证列表状态一致
  const dirty = await prisma.post.findMany({
    where: {
      status: { in: [POST_STATUS.SCHEDULED, POST_STATUS.OPEN, POST_STATUS.FULL] },
      OR: [{ visibleAt: { lte: now } }, { eventEnd: { lte: now } }],
    },
    select: { id: true },
    take: 300,
  });
  if (dirty.length) await refreshMany(dirty.map((p) => p.id), now);

  const where: Record<string, unknown> = {};

  if (scope === "hall") {
    where.status = { in: HALL_VISIBLE_STATUS };
    where.visibleAt = { lte: now };
  } else if (scope === "archived") {
    where.status = { in: [POST_STATUS.ARCHIVED, POST_STATUS.EXPIRED] };
  } else if (scope === "mine") {
    if (!viewer) return unauthorized();
    where.authorId = viewer.id;
    where.status = { not: POST_STATUS.DELETED };
  }

  if (type && POST_TYPES.some((t) => t.key === type)) where.type = type;
  if (location) where.location = location;
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { description: { contains: keyword } },
      { tags: { contains: keyword } },
    ];
  }

  if (when === "today") {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);
    where.eventStart = { gte: dayStart, lte: dayEnd };
  } else if (when === "week") {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    where.eventStart = { gte: now, lte: end };
  } else if (when === "upcoming") {
    where.eventStart = { gte: now };
  }

  // 拉黑过滤
  if (viewer) {
    const blocked = await getBlockedUserIds(viewer.id);
    if (blocked.length) where.authorId = { notIn: blocked };
  }

  if (onlyNotFull) where.status = { in: [POST_STATUS.OPEN] };

  const [all, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: [{ eventStart: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: {
          select: { id: true, nickname: true, avatarUrl: true, college: true, grade: true },
        },
        _count: { select: { applications: { where: { status: "confirmed" } } } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  let list = all.map((p) => shapePost(p as PostRow, viewer?.id));
  if (onlyMissing) list = list.filter((p) => p.remaining > 0);

  return ok({ list, total, page, pageSize, hasMore: page * pageSize < total });
}

/** POST /api/posts —— 发帖 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized("请先登录后再发帖");
  if (!user.verified)
    return fail("发帖前需要完成身份认证（学校邮箱或学号）", 403, "NOT_VERIFIED");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }

  const rateMsg = await checkRateLimit(user.id, "post");
  if (rateMsg) return fail(rateMsg, 429, "RATE_LIMITED");

  // 敏感词过滤
  const title = String(body.title ?? "");
  const description = String(body.description ?? "");
  const tags = Array.isArray(body.tags)
    ? (body.tags as string[]).join(",")
    : String(body.tags ?? "");

  const s1 = await checkSensitive(title);
  if (s1.blocked) return fail("标题包含违规内容，请修改", 400, "SENSITIVE");
  const s2 = await checkSensitive(description);
  if (s2.blocked) return fail("说明包含违规内容，请修改", 400, "SENSITIVE");
  const s3 = await checkSensitive(tags);
  if (s3.blocked) return fail("标签包含违规内容，请修改", 400, "SENSITIVE");

  const now = new Date();
  const immediate = body.publishMode === "now" || !body.visibleAt;

  const errors = validatePostInput(
    {
      type: String(body.type ?? ""),
      title,
      description,
      location: String(body.location ?? ""),
      visibleAt: immediate ? now : toDate(body.visibleAt as string),
      signupDeadline: toDate(body.signupDeadline as string),
      eventStart: toDate(body.eventStart as string),
      eventEnd: toDate(body.eventEnd as string),
      maxParticipants: Number(body.maxParticipants),
    },
    now
  );

  if (hasErrors(errors)) return fail("请检查填写内容", 422, "VALIDATION_ERROR");

  const visibleAt = immediate ? now : toDate(body.visibleAt as string)!;
  const status = visibleAt <= now ? POST_STATUS.OPEN : POST_STATUS.SCHEDULED;

  const post = await prisma.post.create({
    data: {
      authorId: user.id,
      type: String(body.type),
      title: s1.masked,
      description: s2.masked,
      location: String(body.location),
      tags: s3.masked,
      visibleAt,
      signupDeadline: toDate(body.signupDeadline as string)!,
      eventStart: toDate(body.eventStart as string)!,
      eventEnd: toDate(body.eventEnd as string)!,
      maxParticipants: Number(body.maxParticipants),
      status,
      contactVisibility: (body.contactVisibility as string) || "confirmed",
      costNote: body.type === "carpool" ? String(body.costNote ?? "") : null,
    },
    select: { id: true, status: true, title: true, visibleAt: true },
  });

  await bumpRateLimit(user.id, "post");

  return ok(
    {
      post,
      message:
        status === POST_STATUS.SCHEDULED
          ? `已定时发布，将于 ${visibleAt.toLocaleString("zh-CN")} 出现在大厅`
          : "发布成功，已进入大厅",
    },
    201
  );
}
