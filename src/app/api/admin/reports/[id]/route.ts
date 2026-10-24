import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, notFound, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { POST_STATUS, ARCHIVE_RETENTION_MS } from "@/lib/constants";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/reports/:id —— 处理举报
 * body: { status: "resolved" | "rejected", handlerNote, action?: "remove_post" | "ban_user", banDays }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized("需要管理员权限");

  const { id } = await params;

  let body: {
    status?: string;
    handlerNote?: string;
    action?: string;
    banDays?: number;
  };
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }

  const report = await prisma.report.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      targetPostId: true,
      targetUserId: true,
      reporterId: true,
    },
  });
  if (!report) return notFound("举报不存在");

  const status = body.status === "rejected" ? "rejected" : "resolved";
  const now = new Date();
  const note = String(body.handlerNote || "").slice(0, 300);

  await prisma.report.update({
    where: { id },
    data: { status, handlerNote: note, handledAt: now },
  });

  // 附加动作：下架被举报帖子
  if (body.action === "remove_post" && report.targetPostId) {
    await prisma.post.update({
      where: { id: report.targetPostId },
      data: {
        status: POST_STATUS.ARCHIVED,
        archivedAt: now,
        closedAt: now,
        cancelReason: note || "管理员下架：违反社区规范",
        purgeAt: new Date(now.getTime() + ARCHIVE_RETENTION_MS),
      },
    });
  }

  // 附加动作：封禁被举报用户
  if (body.action === "ban_user" && report.targetUserId) {
    const banDays = Math.min(365, Math.max(1, Number(body.banDays) || 7));
    const until = new Date(now.getTime() + banDays * 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: report.targetUserId },
      data: {
        status: "banned",
        banReason: note || "违反社区规范",
        bannedUntil: until,
      },
    });
  }

  await notify({
    userId: report.reporterId,
    type: "report_resolved",
    title: "举报处理结果",
    body:
      status === "resolved"
        ? "你举报的内容已核实并处理，感谢你的反馈"
        : "经核查，你举报的内容未违反社区规范",
    link: "/me/reports",
  });

  // 处理完毕：若帖子已超期，安排尽快清理
  if (report.targetPostId) {
    const post = await prisma.post.findUnique({
      where: { id: report.targetPostId },
      select: { status: true, archivedAt: true },
    });
    if (post?.status === POST_STATUS.ARCHIVED && post.archivedAt) {
      const due = post.archivedAt.getTime() + ARCHIVE_RETENTION_MS;
      if (due <= now.getTime()) {
        await prisma.post.update({
          where: { id: report.targetPostId },
          data: { purgeAt: new Date(now.getTime() + 60_000) },
        });
      }
    }
  }

  return ok({ message: "已处理" });
}
