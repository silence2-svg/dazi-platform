import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, notFound, forbidden } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { refreshPostStatus } from "@/lib/postStatus";
import { isBlockedEitherWay } from "@/lib/block";
import { validatePostInput, toDate, hasErrors } from "@/lib/validate";
import { checkSensitive } from "@/lib/sensitive";
import { APP_STATUS, POST_STATUS } from "@/lib/constants";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/posts/:id —— 帖子详情 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const viewer = await getSessionUser();

  await refreshPostStatus(id);

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          college: true,
          grade: true,
          contactInfo: true,
          contactVisibility: true,
        },
      },
      _count: { select: { applications: { where: { status: APP_STATUS.CONFIRMED } } } },
    },
  });

  if (!post || post.status === POST_STATUS.DELETED) return notFound("帖子不存在或已被删除");

  // 定时未发布的帖子：只有作者和管理员可见
  if (post.status === POST_STATUS.SCHEDULED && post.authorId !== viewer?.id && viewer?.role !== "admin") {
    return notFound("帖子尚未发布");
  }

  // 拉黑关系：互相不可见
  if (viewer && post.authorId !== viewer.id) {
    const blocked = await isBlockedEitherWay(viewer.id, post.authorId);
    if (blocked) return forbidden("你无法查看该用户的帖子");
  }

  // 查看者自己的报名状态
  let myApplication: Record<string, unknown> | null = null;
  if (viewer) {
    const app = await prisma.application.findUnique({
      where: { postId_applicantId: { postId: id, applicantId: viewer.id } },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        contactRevealed: true,
      },
    });
    myApplication = app as Record<string, unknown> | null;
  }

  // ---- 联系方式可见性（PRD 第二节第2条）----
  // 默认不公开。仅当：
  //   1) 发布者设置为 public；或
  //   2) 查看者与发布者存在「已确认」的报名关系
  const isAuthor = !!viewer && viewer.id === post.authorId;
  let canSeeContact = false;

  if (post.contactVisibility === "public") canSeeContact = true;
  if (post.contactVisibility === "confirmed" && viewer) {
    const confirmedLink = await prisma.application.findFirst({
      where: {
        postId: id,
        status: APP_STATUS.CONFIRMED,
        OR: [{ applicantId: viewer.id }, { applicantId: post.authorId, post: { authorId: viewer.id } }],
      },
      select: { id: true },
    });
    if (confirmedLink) canSeeContact = true;
  }

  // 发布者查看自己的联系方式始终允许
  if (isAuthor) canSeeContact = true;

  const confirmedCount = post._count.applications;

  return ok({
    post: {
      id: post.id,
      type: post.type,
      title: post.title,
      description: post.description,
      location: post.location,
      eventStart: post.eventStart,
      eventEnd: post.eventEnd,
      signupDeadline: post.signupDeadline,
      visibleAt: post.visibleAt,
      maxParticipants: post.maxParticipants,
      confirmedCount,
      remaining: Math.max(0, post.maxParticipants - confirmedCount),
      status: post.status,
      tags: post.tags ? post.tags.split(",").filter(Boolean) : [],
      costNote: post.costNote,
      cancelReason: post.cancelReason,
      createdAt: post.createdAt,
      archivedAt: post.archivedAt,
      author: {
        id: post.author.id,
        nickname: post.author.nickname,
        avatarUrl: post.author.avatarUrl,
        college: post.author.college,
        grade: post.author.grade,
        // 仅在允许时返回联系方式，否则为 null
        contactInfo: canSeeContact ? post.author.contactInfo : null,
      },
      isAuthor,
      contactVisibility: post.contactVisibility,
    },
    myApplication,
    canSeeContact,
  });
}

/** PATCH /api/posts/:id —— 作者编辑帖子 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, status: true, eventEnd: true },
  });
  if (!post) return notFound();
  if (post.authorId !== user.id && user.role !== "admin") return forbidden("只能编辑自己的帖子");
  if (post.status === POST_STATUS.ARCHIVED) return fail("已归档的帖子不能修改");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }

  const data: Record<string, unknown> = {};
  const now = new Date();

  if (typeof body.title === "string" || typeof body.description === "string") {
    const s = await checkSensitive(`${body.title ?? ""} ${body.description ?? ""}`);
    if (s.blocked) return fail("内容包含违规内容，请修改", 400, "SENSITIVE");
  }

  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.description === "string") data.description = body.description;
  if (typeof body.location === "string" && body.location.trim()) data.location = body.location.trim();
  if (typeof body.tags === "string") data.tags = body.tags;
  if (typeof body.contactVisibility === "string") data.contactVisibility = body.contactVisibility;
  if (typeof body.costNote === "string") data.costNote = body.costNote;

  if (typeof body.maxParticipants === "number") {
    const n = body.maxParticipants;
    if (n < 2) return fail("人数上限至少 2 人");
    if (n > 50) return fail("人数上限不超过 50 人");
    // 不允许把上限调到低于已确认人数
    const confirmed = await prisma.application.count({
      where: { postId: id, status: APP_STATUS.CONFIRMED },
    });
    if (n < confirmed) return fail(`已有 ${confirmed} 人确认，人数上限不能小于该数`);
    data.maxParticipants = n;
  }

  // 时间字段改动需要按整体规则重新校验
  const timeKeys = ["visibleAt", "signupDeadline", "eventStart", "eventEnd"] as const;
  const timeTouched = timeKeys.some((k) => k in body);

  if (timeTouched) {
    const orig = await prisma.post.findUnique({
      where: { id },
      select: {
        type: true,
        title: true,
        location: true,
        visibleAt: true,
        signupDeadline: true,
        eventStart: true,
        eventEnd: true,
        maxParticipants: true,
      },
    });

    if (orig) {
      const pick = (key: (typeof timeKeys)[number], fallback: Date) =>
        key in body ? toDate(body[key] as string) : fallback;

      const merged = {
        type: orig.type,
        title: orig.title,
        location: orig.location,
        visibleAt: pick("visibleAt", orig.visibleAt),
        signupDeadline: pick("signupDeadline", orig.signupDeadline),
        eventStart: pick("eventStart", orig.eventStart),
        eventEnd: pick("eventEnd", orig.eventEnd),
        maxParticipants: Number(body.maxParticipants ?? orig.maxParticipants),
      };

      const errors = validatePostInput(merged, now);
      if (hasErrors(errors)) return fail("时间设置不符合规则", 422, "VALIDATION_ERROR");

      for (const k of timeKeys) {
        if (!(k in body)) continue;
        data[k] = toDate(body[k] as string);
        if (k === "visibleAt") {
          const d = toDate(body[k] as string)!;
          data.status = d <= now ? POST_STATUS.OPEN : POST_STATUS.SCHEDULED;
        }
      }
    }
  }

  if (Object.keys(data).length === 0) return fail("没有需要修改的内容");

  const updated = await prisma.post.update({
    where: { id },
    data,
    select: { id: true, status: true, maxParticipants: true, eventStart: true },
  });

  await refreshPostStatus(id, now);

  return ok({ post: updated, message: "已保存" });
}

/** DELETE /api/posts/:id —— 作者删除（下架归档，不立即物理删除） */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!post) return notFound();
  if (post.authorId !== user.id && user.role !== "admin") return forbidden("只能删除自己的帖子");

  const now = new Date();
  await prisma.post.update({
    where: { id },
    data: {
      status: POST_STATUS.ARCHIVED,
      archivedAt: now,
      // 保留 30 天后物理删除
      purgeAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      closedAt: now,
    },
  });

  await notify({
    userId: post.authorId,
    type: "post_closed",
    title: "帖子已下架",
    body: "你发布的帖子已被下架归档，可在「我的 - 已归档」中查看",
    link: "/me/archived",
  });

  return ok({ message: "帖子已下架归档" });
}
