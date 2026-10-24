/* 搭子 PWA Service Worker
 * 策略：
 *  - 静态资源：缓存优先
 *  - 页面导航：网络优先，失败回退缓存（保证离线可打开）
 *  - API 请求：只走网络，不缓存（数据必须新鲜）
 *  - Web Push：接收推送并显示通知
 */

const CACHE_NAME = "dazi-v1";
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/manifest.json", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API 不缓存
  if (url.pathname.startsWith("/api/")) return;

  // 页面导航：网络优先
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // 静态资源：缓存优先 + 后台更新
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* ---------- Web Push ---------- */

self.addEventListener("push", (event) => {
  let payload = { title: "搭子", body: "你有新的消息", url: "/messages" };

  try {
    if (event.data) {
      const data = event.data.json();
      payload = { ...payload, ...data };
    }
  } catch (e) {
    try {
      payload.body = event.data ? event.data.text() : payload.body;
    } catch (_) {}
  }

  const title = payload.title || "搭子";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "dazi",
    renotify: true,
    vibrate: [80, 40, 80],
    data: { url: payload.url || "/messages" },
    actions: [{ action: "open", title: "查看" }],
  };

  // 页面活跃时优先用页面内提示，避免重复打扰
  event.waitUntil(
    self.registration.showNotification(title, options).catch(() => undefined)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/messages";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.postMessage({ type: "notification-click", url: targetUrl });
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
