import { prisma } from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { APP_STATUS, POST_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/dashboard —— 数据统计
 * 发帖数、报名数、完成率、举报数
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return unauthorized("需要管理员权限");

  const now = new Date();

  const [
    totalUsers,
    activeUsers,
    bannedUsers,
    totalPosts,
    openPosts,
    scheduledPosts,
    archivedPosts,
    totalApplications,
    pendingReports,
    resolvedReports,
    statusGroups,
    appStatusGroups,
    confirmedTotal,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "active" } }),
    prisma.user.count({ where: { status: "banned" } }),
    prisma.post.count({ where: { status: { not: POST_STATUS.DELETED } } }),
    prisma.post.count({ where: { status: POST_STATUS.OPEN } }),
    prisma.post.count({ where: { status: POST_STATUS.SCHEDULED } }),
    prisma.post.count({ where: { status: POST_STATUS.ARCHIVED } }),
    prisma.application.count(),
    prisma.report.count({ where: { status: "pending" } }),
    prisma.report.count({ where: { status: { not: "pending" } } }),
    prisma.post.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.application.count({ where: { status: APP_STATUS.CONFIRMED } }),
  ]);

  // 完成率 = 已确认且活动已结束的帖子数 / 已结束的帖子数
  const endedPosts = await prisma.post.count({
    where: { status: { in: [POST_STATUS.ARCHIVED, POST_STATUS.EXPIRED] }, eventEnd: { lte: now } },
  });
  const endedWithConfirm = endedPosts
    ? await prisma.post.count({
        where: {
          status: { in: [POST_STATUS.ARCHIVED, POST_STATUS.EXPIRED] },
          eventEnd: { lte: now },
          currentConfirmed: { gte: 1 },
        },
      })
    : 0;

  const completionRate = endedPosts ? Math.round((endedWithConfirm / endedPosts) * 100) : 0;

  // 近 7 天发帖趋势
  const trend: { date: string; posts: number; applications: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);
    const key = dayStart.toISOString().slice(0, 10);
    const [posts, applications] = await Promise.all([
      prisma.post.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } }),
      prisma.application.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } }),
    ]);
    trend.push({ date: key, posts, applications });
  }

  const recentReports = await prisma.report.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { id: true, reason: true, status: true, targetType: true, createdAt: true },
  });

  return ok({
    users: { total: totalUsers, active: activeUsers, banned: bannedUsers },
    posts: {
      total: totalPosts,
      open: openPosts,
      scheduled: scheduledPosts,
      archived: archivedPosts,
      byStatus: Object.fromEntries(statusGroups.map((s) => [s.status, s._count._all])),
    },
    applications: {
      total: totalApplications,
      confirmed: confirmedTotal,
      byStatus: Object.fromEntries(appStatusGroups.map((s) => [s.status, s._count._all])),
    },
    reports: { pending: pendingReports, handled: resolvedReports },
    completionRate,
    trend,
    recentReports,
  });
}
