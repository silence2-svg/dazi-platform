import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { pushEnabled } from "@/lib/push";

export const dynamic = "force-dynamic";

/** POST /api/push/subscribe —— 保存 Web Push 订阅 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  if (!pushEnabled()) {
    return fail(
      "服务器未配置 Web Push（缺少 VAPID 密钥），站内通知仍然可用",
      503,
      "PUSH_NOT_CONFIGURED"
    );
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }

  const endpoint = String(body.endpoint || "");
  const p256dh = String(body.keys?.p256dh || "");
  const auth = String(body.keys?.auth || "");

  if (!endpoint || !p256dh || !auth) return fail("订阅信息不完整");

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: user.id,
      endpoint,
      p256dh,
      auth,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) || null,
    },
    update: { userId: user.id, p256dh, auth },
  });

  await prisma.user.update({ where: { id: user.id }, data: { pushEnabled: true } });

  return ok({ message: "推送已开启" });
}

/** DELETE /api/push/subscribe —— 关闭推送 */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await prisma.pushSubscription.deleteMany({ where: { userId: user.id } });
  await prisma.user.update({ where: { id: user.id }, data: { pushEnabled: false } });

  return ok({ message: "推送已关闭" });
}

/** GET /api/push/key —— 获取 VAPID 公钥 */
export async function GET() {
  return ok({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
    enabled: pushEnabled(),
  });
}
