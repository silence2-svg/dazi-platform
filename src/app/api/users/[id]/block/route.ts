import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, unauthorized, notFound } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/users/:id/block —— 拉黑 / 取消拉黑 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.id === id) return fail("不能拉黑自己");

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nickname: true },
  });
  if (!target) return notFound("用户不存在");

  const existing = await prisma.block.findUnique({
    where: { userId_blockedUserId: { userId: user.id, blockedUserId: id } },
    select: { id: true },
  });

  if (existing) {
    await prisma.block.delete({ where: { id: existing.id } });
    return ok({ blocked: false, message: `已解除对 ${target.nickname} 的拉黑` });
  }

  await prisma.block.create({
    data: { userId: user.id, blockedUserId: id },
  });

  return ok({ blocked: true, message: `已拉黑 ${target.nickname}，对方无法报名、留言和查看你的联系方式` });
}
