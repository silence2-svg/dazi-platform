import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/notifications/read —— 标记通知为已读 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body: { ids?: string[]; all?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* 允许空 body，等价于标记全部 */
    body = { all: true };
  }

  if (body.all || !Array.isArray(body.ids) || body.ids.length === 0) {
    const res = await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    return ok({ updated: res.count, message: "已全部标记为已读" });
  }

  const ids = body.ids.filter(Boolean);
  const res = await prisma.notification.updateMany({
    where: { userId: user.id, id: { in: ids } },
    data: { isRead: true },
  });

  return ok({ updated: res.count, message: "已标记为已读" });
}
