import { prisma } from "./prisma";

/** A 拉黑 B 后，B 不能报名/留言，A 也不能看到 B 的联系方式 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const rows = await prisma.block.findMany({
    where: { OR: [{ userId }, { blockedUserId: userId }] },
    select: { userId: true, blockedUserId: true },
  });
  return rows.map((r) => (r.userId === userId ? r.blockedUserId : r.userId));
}

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const row = await prisma.block.findFirst({
    where: {
      OR: [
        { userId: a, blockedUserId: b },
        { userId: b, blockedUserId: a },
      ],
    },
    select: { id: true },
  });
  return !!row;
}
