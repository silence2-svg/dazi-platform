import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/notifications —— 站内通知（必做项，登录后一定能看到） */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const sp = req.nextUrl.searchParams;
  const onlyUnread = sp.get("unread") === "1";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(sp.get("pageSize") || "30", 10)));

  const where = { userId: user.id, ...(onlyUnread ? { isRead: false } : {}) };

  const [list, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        link: true,
        isRead: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  return ok({ list, total, unreadCount, page, hasMore: page * pageSize < total });
}

/** POST /api/notifications/read —— 标记已读 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body: { ids?: string[]; all?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* 允许空 body */
  }

  if (body.all) {
    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    return ok({ message: "已全部标记为已读" });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
  if (!ids.length) return ok({ message: "无需更新" });

  await prisma.notification.updateMany({
    where: { userId: user.id, id: { in: ids } },
    data: { isRead: true },
  });

  return ok({ message: "已标记为已读" });
}
