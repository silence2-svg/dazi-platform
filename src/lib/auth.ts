import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dazi-dev-secret-change-in-production-2026"
);

export const SESSION_COOKIE = "dazi_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 天

export type SessionUser = {
  id: string;
  nickname: string;
  role: string;
  verified: boolean;
  status: string;
  avatarUrl: string | null;
};

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(SECRET);

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, SECRET);
    const uid = payload.uid as string;
    if (!uid) return null;

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: {
        id: true,
        nickname: true,
        role: true,
        verified: true,
        status: true,
        avatarUrl: true,
      },
    });
    if (!user) return null;
    return user;
  } catch {
    return null;
  }
}

/** 需要登录；未登录返回 null（调用方决定 401 或跳转） */
export async function requireUser(): Promise<SessionUser | null> {
  const u = await getSessionUser();
  if (!u) return null;
  if (u.status === "banned") return null;
  return u;
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const u = await requireUser();
  if (!u || u.role !== "admin") return null;
  return u;
}

export function isAdmin(u: SessionUser | null) {
  return !!u && u.role === "admin";
}
