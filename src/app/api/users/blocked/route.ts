import { prisma } from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/users/blocked —— 我的黑名单 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const list = await prisma.block.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      blockedUser: {
        select: { id: true, nickname: true, avatarUrl: true, college: true, grade: true },
      },
    },
  });

  return ok({
    list: list.map((b) => ({
      id: b.blockedUser.id,
      nickname: b.blockedUser.nickname,
      avatarUrl: b.blockedUser.avatarUrl,
      college: b.blockedUser.college,
      grade: b.blockedUser.grade,
      createdAt: b.createdAt,
    })),
  });
}
