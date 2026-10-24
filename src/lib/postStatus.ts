import { prisma } from "./prisma";
import { POST_STATUS, ARCHIVE_RETENTION_MS } from "./constants";

/**
 * 根据时间与人数，把帖子推进到正确的状态。幂等，可重复调用。
 *
 * 规则（PRD 第二节第4、5、6条）：
 *  1. 到点可见         → scheduled → open
 *  2. 报名截止         → open     → closed
 *  3. 人数达到上限     → open     → full（停止报名）
 *  4. 活动结束         → 任意状态 → archived（下架，大厅不显示，保留 30 天）
 *
 * 注意：第4条对 open / full / closed / scheduled 均生效，
 * 只有已归档和待删除的帖子不再变化。
 */
export async function refreshPostStatus(postId: string, now = new Date()) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      status: true,
      visibleAt: true,
      signupDeadline: true,
      eventStart: true,
      eventEnd: true,
      maxParticipants: true,
      currentConfirmed: true,
      archivedAt: true,
      closedAt: true,
    },
  });
  if (!post) return null;

  // 终态：不再变化
  if (post.status === POST_STATUS.DELETED || post.status === POST_STATUS.ARCHIVED) {
    return post.status;
  }

  let status = post.status;
  const patch: Record<string, unknown> = {};

  // 1. 定时发布到点
  if (status === POST_STATUS.SCHEDULED && post.visibleAt <= now) {
    status = POST_STATUS.OPEN;
  }

  // 2. 报名截止
  if (status === POST_STATUS.OPEN && post.signupDeadline <= now) {
    status = POST_STATUS.CLOSED;
    patch.closedAt = post.closedAt ?? now;
  }

  // 3. 满员
  if (status === POST_STATUS.OPEN && post.currentConfirmed >= post.maxParticipants) {
    status = POST_STATUS.FULL;
    patch.closedAt = post.closedAt ?? now;
  }

  // 4. 活动结束 → 下架归档（不论当前是 open / full / closed）
  if (post.eventEnd <= now) {
    status = POST_STATUS.ARCHIVED;
    patch.archivedAt = now;
    patch.purgeAt = new Date(now.getTime() + ARCHIVE_RETENTION_MS);
  }

  if (status !== post.status) patch.status = status;

  if (Object.keys(patch).length > 0) {
    await prisma.post.update({ where: { id: postId }, data: patch });
  }

  return status;
}

/** 批量刷新（定时任务用） */
export async function refreshMany(ids: string[], now = new Date()) {
  await Promise.all(ids.map((id) => refreshPostStatus(id, now).catch(() => undefined)));
}

/**
 * 帖子是否仍可报名。
 * 满员（full）时停止「确认」流程，但仍接受报名并进入候补队列，
 * 这样有人取消后候补者才能自动递补（PRD 第二节第5条）。
 */
export function canApply(status: string, signupDeadline: Date, now = new Date()) {
  return (
    (status === POST_STATUS.OPEN || status === POST_STATUS.FULL) && signupDeadline > now
  );
}

/** 报名是否还能被确认（截止或活动开始后不再确认） */
export function canConfirm(status: string, eventStart: Date, now = new Date()) {
  if (status === POST_STATUS.ARCHIVED || status === POST_STATUS.DELETED) return false;
  return eventStart > now;
}
