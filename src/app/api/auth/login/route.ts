import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, getSessionUser } from "@/lib/auth";
import { checkSensitive } from "@/lib/sensitive";
import {
  consumeCode,
  isSchoolEmail,
  normalizeEmail,
  validEmail,
  validStudentNo,
} from "@/lib/verifyCode";

export const dynamic = "force-dynamic";

type Body = {
  action?: "register" | "login" | "logout" | "me";
  channel?: string;
  identifier?: string;
  code?: string;
  password?: string;
  nickname?: string;
  campus?: string;
  grade?: string;
  college?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }

  switch (body.action) {
    case "register":
      return register(body);
    case "login":
      return login(body);
    case "logout":
      await destroySession();
      return ok({ loggedOut: true });
    case "me":
      return me();
    default:
      return fail("未知操作");
  }
}

/** POST /api/auth/login  —— 邮箱/学号 + 密码登录 */
export async function PUT(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }
  return login(body);
}

async function me() {
  const u = await getSessionUser();
  if (!u) return ok({ user: null });
  const full = await prisma.user.findUnique({
    where: { id: u.id },
    select: {
      id: true,
      nickname: true,
      email: true,
      studentNo: true,
      avatarUrl: true,
      campus: true,
      grade: true,
      college: true,
      contactInfo: true,
      contactVisibility: true,
      role: true,
      verified: true,
      verifyMethod: true,
      pushEnabled: true,
      createdAt: true,
      _count: { select: { posts: true, applications: true } },
    },
  });
  return ok({ user: full });
}

async function register(body: Body) {
  const channel = body.channel === "student" ? "student" : "email";
  const identifier = (body.identifier || "").trim();
  const code = (body.code || "").trim();
  const password = body.password || "";
  const nickname = (body.nickname || "").trim();

  if (!identifier) return fail("请填写邮箱或学号");
  if (!code) return fail("请填写验证码");
  if (password.length < 6) return fail("密码至少 6 位");
  if (!nickname) return fail("请填写昵称");
  if (nickname.length > 20) return fail("昵称不超过 20 字");

  if (channel === "email" && !validEmail(identifier)) return fail("邮箱格式不正确");
  if (channel === "student" && !validStudentNo(identifier)) return fail("学号格式不正确");

  const sens = await checkSensitive(nickname);
  if (sens.blocked) return fail("昵称包含违规内容", 400, "SENSITIVE");

  const verified = await consumeCode(channel, identifier, "register", code);
  if (!verified) return fail("验证码错误或已过期", 400, "BAD_CODE");

  const email = channel === "email" ? normalizeEmail(identifier) : null;
  const studentNo = channel === "student" ? identifier : null;

  const dup = await prisma.user.findFirst({
    where: email ? { OR: [{ email }, ...(studentNo ? [{ studentNo }] : [])] } : { studentNo: studentNo! },
    select: { id: true },
  });
  if (dup) return fail("该账号已注册，请直接登录");

  // 学校邮箱自动通过认证；学号认证同样视为已认证（PRD：学号/邀请码认证）
  const user = await prisma.user.create({
    data: {
      email,
      studentNo,
      nickname: sens.masked,
      passwordHash: hashPassword(password),
      campus: body.campus?.trim() || "盘锦校区",
      grade: body.grade?.trim() || null,
      college: body.college?.trim() || null,
      verified: true,
      verifyMethod: channel === "email" ? "email" : "student",
      verifiedAt: new Date(),
      ...(channel === "email" && !isSchoolEmail(email!)
        ? { verified: false as const }
        : {}),
    },
    select: { id: true, nickname: true, verified: true },
  });

  await createSession(user.id);
  return ok({
    user,
    message:
      channel === "email" && !isSchoolEmail(email!)
        ? "注册成功！非学校邮箱需管理员审核后才能发帖与报名"
        : "注册成功",
  });
}

async function login(body: Body) {
  const channel = body.channel === "student" ? "student" : "email";
  const identifier = (body.identifier || "").trim();
  const password = body.password || "";

  if (!identifier) return fail("请填写邮箱或学号");
  if (!password) return fail("请填写密码");

  const user = await prisma.user.findFirst({
    where: channel === "email" ? { email: normalizeEmail(identifier) } : { studentNo: identifier },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return fail("账号或密码不正确", 401, "BAD_CREDENTIALS");
  }

  if (user.status === "banned") {
    const until = user.bannedUntil ? new Date(user.bannedUntil).toLocaleString("zh-CN") : "永久";
    return fail(`账号已被封禁（至 ${until}）：${user.banReason || "违反社区规范"}`, 403, "BANNED");
  }

  await createSession(user.id);
  return ok({
    user: {
      id: user.id,
      nickname: user.nickname,
      verified: user.verified,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  });
}
