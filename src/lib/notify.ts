import { prisma } from "./prisma";
import { sendPush } from "./push";
import { NOTIFY_TYPES } from "./constants";

type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  dedupeKey?: string;
};

/**
 * 创建站内通知（必做）+ 尽力推送 Web Push（可选）
 * dedupeKey 用于避免定时任务重复生成同一条提醒
 */
export async function notify(input: NotifyInput) {
  if (input.dedupeKey) {
    const exists = await prisma.notification.findFirst({
      where: { dedupeKey: input.dedupeKey },
      select: { id: true },
    });
    if (exists) return null;
  }

  const n = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      dedupeKey: input.dedupeKey,
    },
  });

  // Web Push 尽力而为，失败不影响站内通知
  sendPush(input.userId, {
    title: input.title,
    body: input.body,
    url: input.link || "/messages",
    tag: input.dedupeKey || n.id,
  }).catch(() => undefined);

  return n;
}

export async function notifyMany(users: string[], input: Omit<NotifyInput, "userId">) {
  await Promise.all(users.map((userId) => notify({ ...input, userId })));
}

export function fmtWhen(d: Date) {
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return "已过";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分钟后`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时后`;
  const days = Math.floor(hours / 24);
  return `${days} 天后`;
}

export { NOTIFY_TYPES };
