import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, notFound, forbidden, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { refreshPostStatus, canApply } from "@/lib/postStatus";
import { checkSensitive } from "@/lib/sensitive";
import { checkRateLimit, bumpRateLimit } from "@/lib/ratelimit";
import { isBlockedEitherWay } from "@/lib/block";
import { APP_STATUS, POST_STATUS, NOTIFY_TYPES, postTypeLabel } from "@/lib/constants";
import { notify } from "@/lib/notify";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/posts/:id/applications —— 报名 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return unauthorized("登录后才能报名");
  if (!user.verified) return fail("报名前需要完成身份认证", 403, "NOT_VERIFIED");

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      title: true,
      type: true,
      status: true,
      signupDeadline: true,
      eventStart: true,
      maxParticipants: true,
      currentConfirmed: true,
      contactVisibility: true,
    },
  });
  if (!post) return notFound();
  if (post.authorId === user.id) return fail("不能报名自己的帖子");

  // 拉黑关系拦截
  if (await isBlockedEitherWay(user.id, post.authorId))
    return forbidden("无法报名该用户的活动");

  const now = new Date();
  await refreshPostStatus(id, now);

  const fresh = await prisma.post.findUnique({
    where: { id },
    select: { status: true, signupDeadline: true, maxParticipants: true, currentConfirmed: true, currentWaitlisted: true },
  });
  if (!fresh) return notFound();

  if (!canApply(fresh.status, fresh.signupDeadline, now)) {
    if (fresh.status === POST_STATUS.FULL) return fail("名额已满，可加入候补", 409, "FULL");
    if (fresh.status === POST_STATUS.CLOSED) return fail("报名已截止", 409, "CLOSED");
    if (fresh.status === POST_STATUS.ARCHIVED) return fail("活动已结束", 409, "ARCHIVED");
    return fail("当前不可报名", 409, "NOT_OPEN");
  }

  // 已有报名记录
  const existing = await prisma.application.findUnique({
    where: { postId_applicantId: { postId: id, applicantId: user.id } },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === APP_STATUS.CANCELLED || existing.status === APP_STATUS.REJECTED) {
      // 允许重新报名：若已满则进候补
      const msg = (await checkRateLimit(user.id, "apply")) || undefined;
      if (msg) return fail(msg, 429, "RATE_LIMITED");

      const message = (await readMessage(req)) || "";
      const isFull = fresh.currentConfirmed >= fresh.maxParticipants;

      const updated = await prisma.application.update({
        where: { id: existing.id },
        data: {
          status: isFull ? APP_STATUS.WAITLISTED : APP_STATUS.PENDING,
          message,
          waitlistSeq: isFull ? (fresh.currentWaitlisted || 0) + 1 : null,
          decidedAt: null,
          updatedAt: now,
        },
        select: { id: true, status: true },
      });

      await prisma.post.update({
        where: { id },
        data: isFull
          ? { currentWaitlisted: { increment: 1 } }
          : { currentPending: { increment: 1 } },
      });

      await notify({
        userId: post.authorId,
        type: NOTIFY_TYPES.NEW_APPLICATION,
        title: isFull ? "有候补报名" : "有新的报名",
        body: `${user.nickname} 报名了「${post.title}」`,
        link: `/post/${id}/manage`,
      });

      await bumpRateLimit(user.id, "apply");
      return ok(
        { application: updated, message: isFull ? "名额已满，已加入候补" : "报名成功，等待发布者确认" },
        201
      );
    }
    return fail("你已经报名过这个帖子了", 409, "ALREADY_APPLIED");
  }

  const rateMsg = await checkRateLimit(user.id, "apply");
  if (rateMsg) return fail(rateMsg, 429, "RATE_LIMITED");

  const message = (await readMessage(req)) || "";

  // 满员判断：已确认人数 >= 上限 → 进入候补
  const isFull = fresh.currentConfirmed >= fresh.maxParticipants;
  const waitlistSeq = isFull ? (fresh.currentWaitlisted || 0) + 1 : null;

  const application = await prisma.application.create({
    data: {
      postId: id,
      applicantId: user.id,
      message,
      status: isFull ? APP_STATUS.WAITLISTED : APP_STATUS.PENDING,
      waitlistSeq,
      decidedAt: null,
    },
    select: { id: true, status: true, createdAt: true },
  });

  await prisma.post.update({
    where: { id },
    data: isFull
      ? { currentWaitlisted: { increment: 1 } }
      : { currentPending: { increment: 1 } },
  });

  // 通知发布者
  await notify({
    userId: post.authorId,
    type: NOTIFY_TYPES.NEW_APPLICATION,
    title: isFull ? "有候补报名" : "有新的报名",
    body: `${user.nickname} 报名了「${post.title}」（${fmtDateTime(post.eventStart)} · ${postTypeLabel(post.type)}）`,
    link: `/post/${id}/manage`,
  });

  await bumpRateLimit(user.id, "apply");

  return ok(
    {
      application,
      message: isFull
        ? "名额已满，已加入候补，有人取消会自动递补"
        : "报名成功，等待发布者确认",
    },
    201
  );
}

async function readMessage(req: NextRequest) {
  try {
    const body = (await req.json()) as { message?: string };
    const raw = String(body.message ?? "").slice(0, 200);
    if (!raw) return "";
    const s = await checkSensitive(raw);
    if (s.blocked) return "";
    return s.masked;
  } catch {
    return "";
  }
}

/** GET /api/posts/:id/applications —— 报名列表（仅作者和管理员） */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, title: true, maxParticipants: true, currentConfirmed: true, status: true },
  });
  if (!post) return notFound();
  if (post.authorId !== user.id && user.role !== "admin") return forbidden("只有发布者可以查看报名列表");

  await refreshPostStatus(id);

  const apps = await prisma.application.findMany({
    where: { postId: id },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      applicant: {
        select: { id: true, nickname: true, avatarUrl: true, grade: true, college: true, contactInfo: true },
      },
    },
  });

  // 已确认的报名才展示联系方式
  const list = apps.map((a) => ({
    id: a.id,
    status: a.status,
    message: a.message,
    createdAt: a.createdAt,
    decidedAt: a.decidedAt,
    applicant: {
      id: a.applicant.id,
      nickname: a.applicant.nickname,
      avatarUrl: a.applicant.avatarUrl,
      grade: a.applicant.grade,
      college: a.applicant.college,
      // 作者看到已确认者的联系方式
      contactInfo:
        a.status === APP_STATUS.CONFIRMED || user.role === "admin"
          ? a.applicant.contactInfo
          : null,
    },
  }));

  return ok({
    list,
    summary: {
      confirmed: list.filter((a) => a.status === APP_STATUS.CONFIRMED).length,
      pending: list.filter((a) => a.status === APP_STATUS.PENDING).length,
      waitlisted: list.filter((a) => a.status === APP_STATUS.WAITLISTED).length,
      rejected: list.filter((a) => a.status === APP_STATUS.REJECTED).length,
      cancelled: list.filter((a) => a.status === APP_STATUS.CANCELLED).length,
      max: post.maxParticipants,
    },
  });
}
