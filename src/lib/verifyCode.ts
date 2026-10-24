import { prisma } from "./prisma";

/** 6 位数字验证码 */
export function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * 认证码存储。
 * 生产环境应换成 Redis；这里用数据库表，保证零依赖可跑通。
 * 说明：演示环境不会真实发送邮件，验证码通过响应 devCode 返回（仅非生产）。
 */
export type VerifyChannel = "email" | "student";

export async function issueCode(
  channel: VerifyChannel,
  identifier: string,
  purpose: "register" | "login"
) {
  const code = genCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟有效

  // 同一渠道同一目标，只保留最新一条有效码
  await prisma.verifyCode.deleteMany({ where: { channel, identifier, purpose } });
  await prisma.verifyCode.create({
    data: { channel, identifier, purpose, code, expiresAt },
  });

  return code;
}

export async function consumeCode(
  channel: VerifyChannel,
  identifier: string,
  purpose: "register" | "login",
  input: string
): Promise<boolean> {
  const row = await prisma.verifyCode.findFirst({
    where: { channel, identifier, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (!row) return false;
  if (row.expiresAt < new Date()) {
    await prisma.verifyCode.delete({ where: { id: row.id } }).catch(() => undefined);
    return false;
  }
  if (row.code !== input.trim()) return false;

  await prisma.verifyCode.delete({ where: { id: row.id } }).catch(() => undefined);
  return true;
}

const SCHOOL_EMAIL_DOMAINS = ["dlut.edu.cn", "pj.dlut.edu.cn"];

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isSchoolEmail(email: string) {
  const e = normalizeEmail(email);
  const domain = e.split("@")[1] || "";
  return SCHOOL_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith("." + d));
}

/** 校验学校邮箱格式 */
export function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validStudentNo(no: string) {
  return /^\d{8,12}$/.test(no.trim());
}
