import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 });
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json(
    { ok: false, error: message, code: code ?? "BAD_REQUEST" },
    { status }
  );
}

export function unauthorized(message = "请先登录") {
  return fail(message, 401, "UNAUTHORIZED");
}

export function forbidden(message = "没有权限") {
  return fail(message, 403, "FORBIDDEN");
}

export function notFound(message = "内容不存在") {
  return fail(message, 404, "NOT_FOUND");
}
