import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, notFound, forbidden, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { refreshPostStatus } from "@/lib/postStatus";
import { APP_STATUS, POST_STATUS, NOTIFY_TYPES } from "@/lib/constants";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/applications/:id
 * body: { action }
 *   confirm  —— 发布者确认报名
 *   reject   —— 发布者拒绝
 *   remove   —— 发布者移除（等同于拒绝但语义不同）
 *   cancel   —— 报名者自行取消（已确认的会自动触发候补递补）
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }

  const action = String(body.action || "");
  const now = new Date();

  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      post: {
        select: {
          id: true,
          title: true,
          authorId: true,
          status: true,
          maxParticipants: true,
          currentConfirmed: true,
          eventStart: true,
          currentWaitlisted: true,
        },
      },
      applicant: { select: { id: true, nickname: true } },
    },
  });

  if (!app) return notFound("报名记录不存在");

  const isAuthor = app.post.authorId === user.id;
  const isApplicant = app.applicantId === user.id;
  const isAdmin = user.role === "admin";

  if (!isAuthor && !isApplicant && !isAdmin) return forbidden("无权操作该报名");

  // ---------- 发布者操作 ----------
  if (action === "confirm" || action === "reject" || action === "remove") {
    if (!isAuthor && !isAdmin) return forbidden("只有发布者可以确认或拒绝报名");

    if (app.post.status === POST_STATUS.ARCHIVED)
      return fail("活动已结束，无法再变更报名");

    if (app.status === APP_STATUS.CONFIRMED && action === "confirm") {
      // 幂等
      return refreshAndReturn(app.post.id);
    }
    if (app.status === APP_STATUS.REJECTED || app.status === APP_STATUS.CANCELLED) {
      return fail("该报名已结束");
    }

    if (action === "confirm") {
      // 活动开始后不再接受确认
      if (app.post.eventStart <= now) return fail("活动已开始，无法再确认新成员");

      if (app.post.currentConfirmed >= app.post.maxParticipants)
        return fail("名额已满，请先调整人数上限或改为候补", 409, "FULL");

      await prisma.application.update({
        where: { id },
        data: {
          status: APP_STATUS.CONFIRMED,
          decidedAt: now,
          waitlistSeq: null,
          contactRevealed: true,
        },
      });

      // 计数：从 pending/waitlisted 迁移到 confirmed
      const from = app.status;
      await adjustCounters(app.post.id, from, APP_STATUS.CONFIRMED);

      // 通知报名者
      await notify({
        userId: app.applicantId,
        type: NOTIFY_TYPES.APPLICATION_CONFIRMED,
        title: "报名已确认，搭子已找到！",
        body: `你已被确认参加「${app.post.title}」，时间：${new Date(app.post.eventStart).toLocaleString("zh-CN")}。联系方式已对双方可见。`,
        link: `/post/${app.post.id}`,
      });

      // 若确认后满员 → 关闭报名并通知
      await onMaybeFull(app.post.id, app.post.title);

      return refreshAndReturn(app.post.id);
    }

    // reject（婉拒，通知对方）与 remove（直接移除，不通知）都落到 rejected 状态
    await prisma.application.update({
      where: { id },
      data: { status: APP_STATUS.REJECTED, decidedAt: now, waitlistSeq: null },
    });
    await adjustCounters(app.post.id, app.status, APP_STATUS.REJECTED);

    if (action === "reject") {
      await notify({
        userId: app.applicantId,
        type: NOTIFY_TYPES.APPLICATION_REJECTED,
        title: "报名未通过",
        body: `很遗憾，「${app.post.title}」的报名未被通过，可以看看其他活动`,
        link: "/hall",
      });
    }

    return refreshAndReturn(app.post.id);
  }

  // ---------- 报名者取消 ----------
  if (action === "cancel") {
    if (!isApplicant && !isAdmin) return forbidden("只能取消自己的报名");
    if (app.status === APP_STATUS.CANCELLED) return ok({ message: "已取消" });

    const wasConfirmed = app.status === APP_STATUS.CONFIRMED;

    await prisma.application.update({
      where: { id },
      data: { status: APP_STATUS.CANCELLED, decidedAt: now, contactRevealed: false },
    });
    await adjustCounters(app.post.id, app.status, APP_STATUS.CANCELLED);

    // 已确认者取消 → 自动递补第一位候补
    let promoted = false;
    if (wasConfirmed) {
      promoted = await promoteWaitlist(app.post.id, app.post.title);
    }

    // 通知发布者
    await notify({
      userId: app.post.authorId,
      type: "system",
      title: "有报名者取消",
      body: `${app.applicant.nickname} 取消了「${app.post.title}」的报名${promoted ? "，已自动递补候补者" : ""}`,
      link: `/post/${app.post.id}/manage`,
    });

    // 人数下调后帖子可能不再满员
    await refreshPostStatus(app.post.id, now);

    return ok({ message: promoted ? "已取消，候补者已自动递补" : "已取消报名", promoted });
  }

  return fail("未知操作");
}

/** 计数增减：把报名从 from 状态迁移到 to 状态时，同步三个计数器 */
async function adjustCounters(
  postId: string,
  from: string | null,
  to: string
) {
  const field = (s: string) =>
    s === APP_STATUS.CONFIRMED
      ? "currentConfirmed"
      : s === APP_STATUS.PENDING
        ? "currentPending"
        : s === APP_STATUS.WAITLISTED
          ? "currentWaitlisted"
          : null;

  // 计算每个字段的净变化量
  const delta: Record<string, number> = {};
  const fromField = from ? field(from) : null;
  const toField = field(to);

  if (fromField) delta[fromField] = (delta[fromField] ?? 0) - 1;
  if (toField) delta[toField] = (delta[toField] ?? 0) + 1;
  if (Object.keys(delta).length === 0) return;

  // 读取当前值后做带下限保护的写回，避免计数变负或超过人数上限
  await prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id: postId },
      select: {
        currentConfirmed: true,
        currentPending: true,
        currentWaitlisted: true,
        maxParticipants: true,
      },
    });
    if (!post) return;

    const next = {
      currentConfirmed: post.currentConfirmed + (delta.currentConfirmed ?? 0),
      currentPending: post.currentPending + (delta.currentPending ?? 0),
      currentWaitlisted: post.currentWaitlisted + (delta.currentWaitlisted ?? 0),
    };

    const data: Record<string, number> = {};
    // 已确认人数上限为帖子人数上限，其余下限为 0
    data.currentConfirmed = Math.max(0, Math.min(next.currentConfirmed, post.maxParticipants));
    data.currentPending = Math.max(0, next.currentPending);
    data.currentWaitlisted = Math.max(0, next.currentWaitlisted);

    // 只写有变化的字段
    const patch: Record<string, number> = {};
    if (data.currentConfirmed !== post.currentConfirmed) patch.currentConfirmed = data.currentConfirmed;
    if (data.currentPending !== post.currentPending) patch.currentPending = data.currentPending;
    if (data.currentWaitlisted !== post.currentWaitlisted) patch.currentWaitlisted = data.currentWaitlisted;

    if (Object.keys(patch).length) {
      await tx.post.update({ where: { id: postId }, data: patch });
    }
  });
}

/** 满员后自动关闭报名并通知 */
async function onMaybeFull(postId: string, title: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true, maxParticipants: true, currentConfirmed: true, authorId: true },
  });
  if (!post) return;
  if (post.currentConfirmed < post.maxParticipants) return;
  if (post.status === POST_STATUS.FULL || post.status === POST_STATUS.CLOSED) return;

  await prisma.post.update({
    where: { id: postId },
    data: { status: POST_STATUS.FULL, closedAt: new Date() },
  });

  const confirmed = await prisma.application.findMany({
    where: { postId, status: APP_STATUS.CONFIRMED },
    select: { applicantId: true },
  });

  await notify({
    userId: post.authorId,
    type: NOTIFY_TYPES.POST_FULL,
    title: "帖子已满员",
    body: `「${title}」已满员，报名通道已自动关闭`,
    link: `/post/${postId}/manage`,
  });

  await Promise.all(
    [...new Set(confirmed.map((a) => a.applicantId))].map((userId) =>
      notify({
        userId,
        type: NOTIFY_TYPES.POST_FULL,
        title: "活动已满员",
        body: `「${title}」已满员，请准时参加`,
        link: `/post/${postId}`,
      })
    )
  );
}

/** 候补自动递补（PRD：已确认用户取消后，候补可自动递补） */
async function promoteWaitlist(postId: string, title: string): Promise<boolean> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, maxParticipants: true, currentConfirmed: true, eventStart: true },
  });
  if (!post) return false;
  if (post.currentConfirmed >= post.maxParticipants) return false;
  if (new Date(post.eventStart) <= new Date()) return false;

  const next = await prisma.application.findFirst({
    where: { postId, status: APP_STATUS.WAITLISTED },
    orderBy: [{ waitlistSeq: "asc" }, { createdAt: "asc" }],
    select: { id: true, applicantId: true },
  });
  if (!next) return false;

  await prisma.application.update({
    where: { id: next.id },
    data: {
      status: APP_STATUS.CONFIRMED,
      decidedAt: new Date(),
      waitlistSeq: null,
      contactRevealed: true,
    },
  });
  await adjustCounters(postId, APP_STATUS.WAITLISTED, APP_STATUS.CONFIRMED);

  await notify({
    userId: next.applicantId,
    type: NOTIFY_TYPES.WAITLIST_PROMOTED,
    title: "候补转正啦！",
    body: `有人取消，「${title}」有空位，你已从候补转为确认参加`,
    link: `/post/${postId}`,
  });

  await onMaybeFull(postId, title);
  return true;
}

async function refreshAndReturn(postId: string) {
  await refreshPostStatus(postId);
  const appCount = await prisma.application.groupBy({
    by: ["status"],
    where: { postId },
    _count: { _all: true },
  });
  return ok({
    message: "操作成功",
    counts: Object.fromEntries(appCount.map((r) => [r.status, r._count._all])),
  });
}
