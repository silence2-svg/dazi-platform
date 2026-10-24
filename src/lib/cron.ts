import { prisma } from "./prisma";
import { refreshPostStatus } from "./postStatus";
import { ARCHIVE_RETENTION_MS, POST_STATUS, NOTIFY_TYPES, TIME_RULES } from "./constants";
import { notify } from "./notify";

/**
 * 定时任务主入口。每分钟执行一次。
 * 负责 PRD 第二节第4/5/6条 与 第七节要求的所有自动化：
 *  1. 定时发布到点 → 进入大厅
 *  2. 报名截止 → 自动关闭报名
 *  3. 满员 → 自动关闭报名
 *  4. 活动结束 → 自动下架归档（大厅不显示）
 *  5. 归档满 30 天 → 物理删除（有举报的顺延）
 *  6. 活动前 1 天 / 1 小时提醒
 */
export async function runCron() {
  const now = new Date();
  const summary = {
    published: 0,
    closed: 0,
    archived: 0,
    purged: 0,
    reminders: 0,
    at: now.toISOString(),
  };

  try {
    // ---------- 1 & 2 & 3 & 4：状态推进 ----------
    const active = await prisma.post.findMany({
      where: {
        status: {
          in: [
            POST_STATUS.SCHEDULED,
            POST_STATUS.OPEN,
            POST_STATUS.FULL,
            POST_STATUS.CLOSED,
          ],
        },
      },
      select: {
        id: true,
        status: true,
        visibleAt: true,
        signupDeadline: true,
        eventEnd: true,
        currentConfirmed: true,
        maxParticipants: true,
      },
      take: 500,
    });

    for (const p of active) {
      const before = p.status;
      const after = await refreshPostStatus(p.id, now);
      if (before === after) continue;

      if (after === POST_STATUS.OPEN && before === POST_STATUS.SCHEDULED) summary.published++;
      else if (after === POST_STATUS.CLOSED) summary.closed++;
      else if (after === POST_STATUS.ARCHIVED) summary.archived++;
    }

    // ---------- 5：归档 30 天后物理删除 ----------
    const toPurge = await prisma.post.findMany({
      where: {
        status: POST_STATUS.ARCHIVED,
        purgeAt: { lte: now },
      },
      select: { id: true },
      take: 100,
    });

    for (const p of toPurge) {
      // 有未处理举报的帖子保留到处理完毕
      const openReports = await prisma.report.count({
        where: { targetPostId: p.id, status: "pending" },
      });
      if (openReports > 0) {
        await prisma.post.update({
          where: { id: p.id },
          data: { purgeAt: null },
        });
        continue;
      }
      await purgePost(p.id);
      summary.purged++;
    }

    // purgeAt 为空但已归档超过 30 天的兜底扫描
    const orphan = await prisma.post.findMany({
      where: {
        status: POST_STATUS.ARCHIVED,
        purgeAt: null,
        archivedAt: { lte: new Date(now.getTime() - ARCHIVE_RETENTION_MS) },
      },
      select: { id: true },
      take: 50,
    });
    for (const p of orphan) {
      const openReports = await prisma.report.count({
        where: { targetPostId: p.id, status: "pending" },
      });
      if (openReports > 0) continue;
      await purgePost(p.id);
      summary.purged++;
    }

    // ---------- 6：活动前提醒 ----------
    summary.reminders = await sendEventReminders(now);

    return summary;
  } catch (err) {
    console.error("[cron] 执行失败", err);
    return { ...summary, error: String(err) };
  }
}

/** 物理删除：连带删除报名记录 */
async function purgePost(postId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.application.deleteMany({ where: { postId } });
    await tx.eventReminder.deleteMany({ where: { postId } });
    await tx.report.deleteMany({ where: { targetPostId: postId } });
    await tx.post.update({
      where: { id: postId },
      data: { status: POST_STATUS.DELETED },
    });
    // SQLite 无强制外键级联语义时兜底真删
    await tx.post.deleteMany({ where: { id: postId } });
  });
}

/** 活动前 1 天 / 1 小时提醒（已确认的参与者 + 发布者） */
async function sendEventReminders(now: Date): Promise<number> {
  let sent = 0;

  const dayAhead = new Date(now.getTime() + TIME_RULES.remindBeforeDays * 24 * 60 * 60 * 1000);
  const hourAhead = new Date(now.getTime() + TIME_RULES.remindBeforeHours * 60 * 60 * 1000);

  const posts = await prisma.post.findMany({
    where: {
      status: { in: [POST_STATUS.OPEN, POST_STATUS.FULL, POST_STATUS.CLOSED] },
      eventStart: { gt: now, lte: dayAhead },
    },
    select: {
      id: true,
      title: true,
      location: true,
      eventStart: true,
      authorId: true,
    },
    take: 200,
  });

  for (const post of posts) {
    const startMs = new Date(post.eventStart).getTime();
    const isDayWindow = startMs <= dayAhead.getTime();
    const isHourWindow = startMs <= hourAhead.getTime();

    const kinds: string[] = [];
    if (isDayWindow) kinds.push("day_1");
    if (isHourWindow) kinds.push("hour_1");

    const confirmed = await prisma.application.findMany({
      where: { postId: post.id, status: "confirmed" },
      select: { applicantId: true },
    });

    const recipients = [...new Set([post.authorId, ...confirmed.map((a) => a.applicantId)])];

    for (const kind of kinds) {
      const exists = await prisma.eventReminder.findUnique({
        where: { postId_kind: { postId: post.id, kind } },
        select: { sentAt: true },
      });
      if (exists?.sentAt) continue;

      const label = kind === "day_1" ? "明天" : "1 小时后";
      const timeText = new Date(post.eventStart).toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      await Promise.all(
        recipients.map((userId) =>
          notify({
            userId,
            type: NOTIFY_TYPES.EVENT_REMIND,
            title: kind === "day_1" ? "活动提醒：明天见" : "活动提醒：1 小时后开始",
            body: `「${post.title}」${label}开始（${timeText} · ${post.location}）`,
            link: `/post/${post.id}`,
            dedupeKey: `remind:${post.id}:${kind}:${userId}`,
          })
        )
      );

      await prisma.eventReminder.upsert({
        where: { postId_kind: { postId: post.id, kind } },
        create: { postId: post.id, kind, sentAt: now },
        update: { sentAt: now },
      });
      sent++;
    }
  }

  return sent;
}

let timer: NodeJS.Timeout | null = null;

/** 在 Node 运行时启动定时器（instrumentation.ts 调用） */
export function startCron() {
  if (timer) return;
  const tick = async () => {
    try {
      await runCron();
    } catch (err) {
      console.error("[cron] tick 失败", err);
    }
  };
  // 启动后延迟 5 秒跑一次，之后每分钟
  setTimeout(tick, 5_000);
  timer = setInterval(tick, 60_000);
  console.log("[cron] 定时任务已启动：每 60 秒执行一次");
}
