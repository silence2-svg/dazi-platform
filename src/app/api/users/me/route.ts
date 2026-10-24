import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkSensitive } from "@/lib/sensitive";

export const dynamic = "force-dynamic";

/** GET /api/users/me —— 我的资料 */
export async function GET() {
  const u = await getSessionUser();
  if (!u) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: u.id },
    select: {
      id: true,
      email: true,
      studentNo: true,
      nickname: true,
      avatarUrl: true,
      campus: true,
      grade: true,
      college: true,
      contactInfo: true,
      contactVisibility: true,
      role: true,
      status: true,
      verified: true,
      verifyMethod: true,
      pushEnabled: true,
      createdAt: true,
      _count: { select: { posts: true, applications: true, notifications: true } },
    },
  });

  if (!user) return unauthorized();

  const unread = await prisma.notification.count({
    where: { userId: u.id, isRead: false },
  });

  return ok({ user: { ...user, unreadCount: unread } });
}

/** PATCH /api/users/me —— 更新资料 */
export async function PATCH(req: NextRequest) {
  const u = await getSessionUser();
  if (!u) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }

  const data: Record<string, unknown> = {};

  if (typeof body.nickname === "string") {
    const n = body.nickname.trim();
    if (!n) return fail("昵称不能为空");
    if (n.length > 20) return fail("昵称不超过 20 字");
    const s = await checkSensitive(n);
    if (s.blocked) return fail("昵称包含违规内容", 400, "SENSITIVE");
    data.nickname = s.masked;
  }

  if (typeof body.avatarUrl === "string") data.avatarUrl = body.avatarUrl || null;
  if (typeof body.grade === "string") data.grade = body.grade.trim() || null;
  if (typeof body.college === "string") data.college = body.college.trim() || null;
  if (typeof body.contactInfo === "string") {
    const c = body.contactInfo.trim();
    if (c.length > 60) return fail("联系方式不超过 60 字");
    const s = await checkSensitive(c);
    if (s.blocked) return fail("联系方式包含违规内容", 400, "SENSITIVE");
    data.contactInfo = s.masked || null;
  }
  if (typeof body.contactVisibility === "string") {
    if (!["private", "confirmed", "public"].includes(body.contactVisibility))
      return fail("可见性设置无效");
    data.contactVisibility = body.contactVisibility;
  }

  if (Object.keys(data).length === 0) return fail("没有需要修改的内容");

  const user = await prisma.user.update({
    where: { id: u.id },
    data,
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      grade: true,
      college: true,
      contactInfo: true,
      contactVisibility: true,
    },
  });

  return ok({ user, message: "已保存" });
}

/** POST /api/users/me —— 修改密码 */
export async function POST(req: NextRequest) {
  const u = await getSessionUser();
  if (!u) return unauthorized();

  let body: { oldPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }

  const user = await prisma.user.findUnique({
    where: { id: u.id },
    select: { id: true, passwordHash: true },
  });
  if (!user) return unauthorized();

  if (!verifyPassword(String(body.oldPassword || ""), user.passwordHash))
    return fail("原密码不正确");

  const np = String(body.newPassword || "");
  if (np.length < 6) return fail("新密码至少 6 位");

  await prisma.user.update({
    where: { id: u.id },
    data: { passwordHash: hashPassword(np) },
  });

  return ok({ message: "密码已修改" });
}
