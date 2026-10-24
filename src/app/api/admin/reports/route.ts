import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, notFound, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { POST_STATUS, ARCHIVE_RETENTION_MS } from "@/lib/constants";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/reports —— 举报列表 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized("需要管理员权限");

  const status = req.nextUrl.searchParams.get("status") || "pending";
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
  const pageSize = 30;

  const where = status === "all" ? {} : { status };

  const [list, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        reporter: { select: { id: true, nickname: true } },
        targetPost: { select: { id: true, title: true, authorId: true, status: true } },
        targetUser: { select: { id: true, nickname: true } },
      },
    }),
    prisma.report.count({ where }),
  ]);

  return ok({
    list: list.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      handlerNote: r.handlerNote,
      createdAt: r.createdAt,
      handledAt: r.handledAt,
      reporter: r.reporter,
      targetPost: r.targetPost,
      targetUser: r.targetUser,
      targetApplicationId: r.targetApplicationId,
    })),
    total,
    page,
    hasMore: page * pageSize < total,
  });
}
