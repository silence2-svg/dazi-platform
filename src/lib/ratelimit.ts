import { prisma } from "./prisma";
import { RATE_LIMITS } from "./constants";

/** UTC+8 日期键 */
export function todayKey(d: Date = new Date()) {
  const sh = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return sh.toISOString().slice(0, 10);
}

/**
 * 频率限制（PRD 第八节）：发帖每日 5 条，报名每日 20 条，留言每日 50 条
 * 返回 null 表示通过，否则返回提示文案
 */
export async function checkRateLimit(
  userId: string,
  action: "post" | "apply" | "comment"
): Promise<string | null> {
  const date = todayKey();
  const quota = await prisma.dailyQuota.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: {},
  });

  if (action === "post" && quota.postCount >= RATE_LIMITS.postPerDay)
    return `发帖已达每日上限（${RATE_LIMITS.postPerDay} 条），明天再来吧`;
  if (action === "apply" && quota.applyCount >= RATE_LIMITS.applyPerDay)
    return `报名已达每日上限（${RATE_LIMITS.applyPerDay} 次），明天再来吧`;
  if (action === "comment" && quota.commentCount >= RATE_LIMITS.commentPerDay)
    return `留言已达每日上限（${RATE_LIMITS.commentPerDay} 条），明天再来吧`;

  return null;
}

export async function bumpRateLimit(
  userId: string,
  action: "post" | "apply" | "comment"
) {
  const date = todayKey();
  const field =
    action === "post" ? "postCount" : action === "apply" ? "applyCount" : "commentCount";
  await prisma.dailyQuota.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
}
