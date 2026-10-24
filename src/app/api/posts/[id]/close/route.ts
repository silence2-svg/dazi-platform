import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, notFound, forbidden } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { POST_STATUS } from "@/lib/constants";
import { notify, notifyMany } from "@/lib/notify";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/posts/:id/close
 * body: { action: "close_signup" | "close_post", reason?: string }
 *  - close_signup：提前手动关闭报名（帖子仍在大厅，显示"已关闭"）
 *  - close_post：关闭整个帖子（下架，大厅不显示）
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      status: true,
      title: true,
      currentConfirmed: true,
    },
  });
  if (!post) return notFound();
  if (post.authorId !== user.id && user.role !== "admin") return forbidden("只能操作自己的帖子");

  if (post.status === POST_STATUS.ARCHIVED) return fail("帖子已归档");

  let body: { action?: string; reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* 允许空 body */
  }

  const action = body.action === "close_post" ? "close_post" : "close_signup";
  const now = new Date();

  if (action === "close_signup") {
    if (post.status === POST_STATUS.CLOSED) return fail("报名已关闭");
    await prisma.post.update({
      where: { id },
      data: { status: POST_STATUS.CLOSED, closedAt: now },
    });

    // 通知已报名的用户
    const apps = await prisma.application.findMany({
      where: { postId: id, status: { in: ["pending", "confirmed", "waitlisted"] } },
      select: { applicantId: true },
    });
    await notifyMany(
      [...new Set(apps.map((a) => a.applicantId))],
      {
        type: "post_closed",
        title: "报名已关闭",
        body: `「${post.title}」的报名已由发布者关闭`,
        link: `/post/${id}`,
      }
    );

    return ok({ message: "已关闭报名" });
  }

  // close_post：下架并归档
  await prisma.post.update({
    where: { id },
    data: {
      status: POST_STATUS.ARCHIVED,
      archivedAt: now,
      closedAt: now,
      cancelReason: body.reason || null,
      purgeAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const apps = await prisma.application.findMany({
    where: { postId: id, status: { in: ["pending", "confirmed", "waitlisted"] } },
    select: { applicantId: true },
  });
  await notifyMany([...new Set(apps.map((a) => a.applicantId))], {
    type: "post_cancelled",
    title: "活动已取消",
    body: `「${post.title}」已被发布者取消${body.reason ? `：${body.reason}` : ""}`,
    link: `/post/${id}`,
  });

  return ok({ message: "帖子已关闭并下架" });
}
