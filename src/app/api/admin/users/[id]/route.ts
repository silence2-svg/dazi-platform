import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, notFound, forbidden, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { POST_STATUS, ARCHIVE_RETENTION_MS } from "@/lib/constants";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/users/:id —— 封禁 / 解封
 * body: { action?: "ban" | "unban", reason?, days? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized("需要管理员权限");

  const { id } = await params;
  if (id === admin.id) return forbidden("不能封禁自己");

  let body: { action?: string; reason?: string; days?: number };
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nickname: true, status: true },
  });
  if (!target) return notFound("用户不存在");

  const now = new Date();

  if (body.action === "unban") {
    await prisma.user.update({
      where: { id },
      data: { status: "active", banReason: null, bannedUntil: null },
    });
    await notify({
      userId: id,
      type: "system",
      title: "账号已恢复",
      body: "你的封禁已被解除，可以继续正常使用",
      link: "/",
    });
    return ok({ message: "已解除封禁" });
  }

  const days = Math.min(365, Math.max(1, Number(body.days) || 7));
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const reason = String(body.reason || "违反社区规范").slice(0, 200);

  await prisma.user.update({
    where: { id },
    data: { status: "banned", banReason: reason, bannedUntil: until },
  });

  // 下架其进行中的帖子
  await prisma.post.updateMany({
    where: {
      authorId: id,
      status: { in: [POST_STATUS.OPEN, POST_STATUS.SCHEDULED, POST_STATUS.FULL] },
    },
    data: {
      status: POST_STATUS.ARCHIVED,
      archivedAt: now,
      closedAt: now,
      cancelReason: `发布者被封禁：${reason}`,
      purgeAt: new Date(now.getTime() + ARCHIVE_RETENTION_MS),
    },
  });

  await notify({
    userId: id,
    type: "system",
    title: "账号已被封禁",
    body: `原因：${reason}。期限：${days} 天（至 ${until.toLocaleDateString("zh-CN")}）`,
    link: "/",
  });

  return ok({ message: `已封禁 ${target.nickname} ${days} 天` });
}

/** DELETE /api/admin/users/:id —— 快速解封 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  const { id } = await params;
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return notFound();

  await prisma.user.update({
    where: { id },
    data: { status: "active", banReason: null, bannedUntil: null },
  });

  return ok({ message: "已解除封禁" });
}
