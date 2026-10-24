import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
import {
  issueCode,
  isSchoolEmail,
  validEmail,
  validStudentNo,
  normalizeEmail,
} from "@/lib/verifyCode";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/code
 * 发送验证码。演示环境不真正发信，非生产环境直接在响应里返回 devCode。
 * body: { channel: "email" | "student", identifier, purpose: "register" | "login" }
 */
export async function POST(req: NextRequest) {
  let body: {
    channel?: string;
    identifier?: string;
    purpose?: string;
  };
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }

  const channel = body.channel === "student" ? "student" : "email";
  const purpose = body.purpose === "login" ? "login" : "register";
  const identifier = (body.identifier || "").trim();

  if (!identifier) return fail("请填写邮箱或学号");

  if (channel === "email") {
    if (!validEmail(identifier)) return fail("邮箱格式不正确");
  } else {
    if (!validStudentNo(identifier)) return fail("学号应为 8-12 位数字");
  }

  const existing = await prisma.user.findFirst({
    where: channel === "email" ? { email: normalizeEmail(identifier) } : { studentNo: identifier },
    select: { id: true },
  });

  if (purpose === "register" && existing) {
    return fail(channel === "email" ? "该邮箱已注册，请直接登录" : "该学号已注册，请直接登录");
  }
  if (purpose === "login" && !existing) {
    return fail("该账号尚未注册，请先注册");
  }

  // 简单防刷：60 秒内只能发一次
  const recent = await prisma.verifyCode.findFirst({
    where: { channel, identifier, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < 60_000) {
    return fail("验证码发送过于频繁，请 60 秒后再试", 429, "TOO_FREQUENT");
  }

  const code = await issueCode(channel, identifier, purpose);

  const payload: Record<string, unknown> = {
    channel,
    expiresIn: 600,
    hint: channel === "email" ? (isSchoolEmail(identifier) ? "学校邮箱" : "非学校邮箱也可注册，但需管理员审核认证") : "学号认证",
  };

  if (process.env.NODE_ENV !== "production") payload.devCode = code;

  return ok(payload);
}
