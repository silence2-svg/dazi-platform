import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { checkSensitive } from "@/lib/sensitive";
import { notify } from "@/lib/notify";
import { NOTIFY_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const REPORT_REASONS = [
  { key: "spam", label: "垃圾广告" },
  { key: "fraud", label: "疑似诈骗/虚假信息" },
  { key: "harassment", label: "骚扰辱骂" },
  { key: "inappropriate", label: "色情低俗" },
  { key: "illegal", label: "违法违规" },
  { key: "other", label: "其他" },
];

const REASON_LABEL: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.key, r.label])
);

/** POST /api/reports —— 举报帖子/用户/留言 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized("登录后才能举报");

  let body: { targetType?: string; targetId?: string; reason?: string; detail?: string };
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }

  const targetType = String(body.targetType || "");
  const targetId = String(body.targetId || "");
  const reason = String(body.reason || "");

  if (!["post", "application", "user"].includes(targetType))
    return fail("举报对象类型不正确");
  if (!targetId) return fail("缺少举报对象");
  if (!REASON_LABEL[reason]) return fail("请选择举报原因");

  const detail = String(body.detail || "").slice(0, 500);
  const sens = await checkSensitive(detail);
  if (sens.blocked) return fail("补充说明包含违规内容", 400, "SENSITIVE");

  // 目标存在性校验
  if (targetType === "post") {
    const exists = await prisma.post.findUnique({
      where: { id: targetId },
      select: { id: true, authorId: true, status: true },
    });
    if (!exists || exists.status === "deleted") return fail("帖子不存在", 404);
    if (exists.authorId === user.id) return fail("不能举报自己的帖子");

    const dup = await prisma.report.findFirst({
      where: { reporterId: user.id, targetPostId: targetId, status: "pending" },
      select: { id: true },
    });
    if (dup) return fail("你已举报过该内容，正在处理中", 409, "DUPLICATE");
  }

  if (targetType === "application") {
    const exists = await prisma.application.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!exists) return fail("内容不存在", 404);
  }

  const report = await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType,
      targetPostId: targetType === "post" ? targetId : null,
      targetApplicationId: targetType === "application" ? targetId : null,
      targetUserId: targetType === "user" ? targetId : null,
      reason,
      detail: sens.masked,
    },
    select: { id: true, createdAt: true },
  });

  // 有举报的帖子延迟清理：把 purgeAt 顺延，保留到处理完毕
  if (targetType === "post") {
    const open = await prisma.report.count({
      where: { targetPostId: targetId, status: "pending" },
    });
    if (open > 0) {
      await prisma.post.updateMany({
        where: { id: targetId },
        data: { purgeAt: null },
      });
    }
  }

  await notify({
    userId: user.id,
    type: NOTIFY_TYPES.SYSTEM,
    title: "举报已提交",
    body: `我们已收到你关于「${REASON_LABEL[reason]}」的举报，管理员会尽快处理`,
    link: "/me/reports",
  });

  return ok({ report, message: "举报已提交，感谢你的反馈" }, 201);
}
