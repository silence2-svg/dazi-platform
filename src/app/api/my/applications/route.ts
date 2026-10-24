import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/my/applications —— 我的报名
 * status=all | pending | confirmed | waitlisted | history
 */
export async function GET(req: NextRequest) {
  const u = await getSessionUser();
  if (!u) return unauthorized();

  const filter = req.nextUrl.searchParams.get("status") || "all";

  const where: Record<string, unknown> = { applicantId: u.id };
  if (filter === "pending") where.status = "pending";
  else if (filter === "confirmed") where.status = "confirmed";
  else if (filter === "waitlisted") where.status = "waitlisted";
  else if (filter === "history") where.status = { in: ["rejected", "cancelled"] };
  else if (filter === "upcoming")
    where.status = { in: ["pending", "confirmed", "waitlisted"] };

  const list = await prisma.application.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      post: {
        select: {
          id: true,
          title: true,
          type: true,
          location: true,
          eventStart: true,
          eventEnd: true,
          status: true,
          author: { select: { id: true, nickname: true, avatarUrl: true, contactInfo: true } },
        },
      },
    },
  });

  const now = new Date();
  const counts = await prisma.application.groupBy({
    by: ["status"],
    where: { applicantId: u.id },
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  return ok({
    list: list.map((a) => ({
      id: a.id,
      status: a.status,
      message: a.message,
      createdAt: a.createdAt,
      decidedAt: a.decidedAt,
      post: {
        ...a.post,
        isPast: new Date(a.post.eventEnd) <= now,
        // 已确认才展示联系方式
        authorContact:
          a.status === "confirmed" ? a.post.author.contactInfo : null,
      },
    })),
    counts: {
      pending: countMap.pending || 0,
      confirmed: countMap.confirmed || 0,
      waitlisted: countMap.waitlisted || 0,
      history: (countMap.rejected || 0) + (countMap.cancelled || 0),
    },
  });
}
