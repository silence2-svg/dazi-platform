import webpush from "web-push";
import { prisma } from "./prisma";

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@dazi.example.com",
    pub,
    priv
  );
  configured = true;
  return true;
}

export function pushEnabled() {
  return ensureConfigured();
}

/** 发送 Web Push；失败自动清理失效订阅 */
export async function sendPush(userId: string, payload: object) {
  if (!ensureConfigured()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        sent++;
      } catch (err: unknown) {
        const e = err as { statusCode?: number };
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await prisma.pushSubscription
            .deleteMany({ where: { endpoint: s.endpoint } })
            .catch(() => undefined);
        }
      }
    })
  );

  return sent;
}

export async function sendPushToMany(userIds: string[], payload: object) {
  await Promise.all(userIds.map((id) => sendPush(id, payload)));
}
