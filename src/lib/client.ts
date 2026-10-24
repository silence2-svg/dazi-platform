"use client";

export type ApiResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

/** 统一 API 请求封装 */
export async function api<T = unknown>(
  url: string,
  options: RequestInit & { method?: string } = {}
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({ ok: false, error: "服务器无响应" }));
    return json as ApiResult<T>;
  } catch {
    return { ok: false, error: "网络异常，请检查连接后重试" };
  }
}

export function get<T = unknown>(url: string) {
  return api<T>(url, { method: "GET" });
}

export function post<T = unknown>(url: string, body?: unknown) {
  return api<T>(url, { method: "POST", body: JSON.stringify(body ?? {}) });
}

export function patch<T = unknown>(url: string, body?: unknown) {
  return api<T>(url, { method: "PATCH", body: JSON.stringify(body ?? {}) });
}

export function del<T = unknown>(url: string) {
  return api<T>(url, { method: "DELETE" });
}
