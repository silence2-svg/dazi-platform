"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Shell, { EmptyState } from "@/components/Shell";
import BottomNav from "@/components/BottomNav";
import { get, post } from "@/lib/client";
import { fmtRelative } from "@/lib/format";
import { useEnvDetect } from "@/components/Shell";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

const TYPE_ICON: Record<string, string> = {
  new_application: "📝",
  application_confirmed: "✅",
  application_rejected: "❌",
  waitlist_promoted: "🎉",
  post_full: "🎯",
  event_remind: "⏰",
  post_cancelled: "🚫",
  post_closed: "🔒",
  system: "📢",
  report_resolved: "🛡️",
};

export default function MessagesPage() {
  const router = useRouter();
  const [list, setList] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);
  const env = useEnvDetect();
  const [pushState, setPushState] = useState<"off" | "on" | "unsupported" | "denied">("off");

  const load = useCallback(async () => {
    const r = await get<{ list: Notification[]; unreadCount: number }>(
      "/api/notifications?pageSize=50"
    );
    if (!r.ok) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    setList(r.data.list);
    setUnread(r.data.unreadCount);
    setAuthed(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 检测已有推送订阅
  useEffect(() => {
    if (!env.canPush) {
      setPushState("unsupported");
      return;
    }
    (async () => {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (!reg) return setPushState("unsupported");
      const sub = await reg.pushManager.getSubscription().catch(() => null);
      setPushState(sub ? "on" : "off");
    })();
  }, [env.canPush]);

  const enablePush = async () => {
    if (!env.canPush) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setPushState("denied");

    const reg = await navigator.serviceWorker.ready;
    const keyRes = await get<{ publicKey: string | null }>("/api/push");
    const publicKey = keyRes.ok ? keyRes.data?.publicKey : null;
    if (!publicKey) {
      alert("服务器未配置推送密钥，站内通知仍然可用");
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const r = await post("/api/push/subscribe", sub.toJSON());
    if (r.ok) {
      setPushState("on");
      alert("推送已开启，活动前会提醒你");
    } else {
      alert(r.error);
    }
  };

  const disablePush = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe();
    await fetch("/api/push/subscribe", { method: "DELETE" });
    setPushState("off");
  };

  const markAll = async () => {
    await post("/api/notifications/read", { all: true });
    load();
  };

  const open = async (n: Notification) => {
    if (!n.isRead) {
      await post("/api/notifications/read", { ids: [n.id] });
    }
    if (n.link) router.push(n.link);
    else load();
  };

  if (!authed && !loading) {
    return (
      <Shell title="消息" back>
        <EmptyState
          icon="🔔"
          title="登录后查看消息"
          hint="报名确认、活动提醒都会在这里通知你"
          action={
            <Link href="/login?next=/messages" className="rounded-xl bg-brand-600 px-5 py-2.5 text-[14px] text-white">
              去登录
            </Link>
          }
        />
      </Shell>
    );
  }

  return (
    <>
      <Shell
        title={`消息${unread > 0 ? ` (${unread})` : ""}`}
        hideNav
        right={
          unread > 0 ? (
            <button onClick={markAll} className="text-[12.5px] text-brand-600">
              全部已读
            </button>
          ) : undefined
        }
      >
        {/* 推送设置 */}
        <div className="mx-3 mt-3 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-slate-800">📲 活动提醒推送</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">
                {pushState === "on"
                  ? "已开启，活动前 1 天 / 1 小时提醒你"
                  : pushState === "unsupported"
                    ? "当前浏览器不支持推送，站内消息照常可看"
                    : pushState === "denied"
                      ? "通知权限被拒绝，请在浏览器设置中开启"
                      : "开启后即使关闭页面也能收到提醒"}
              </p>
            </div>
            {pushState === "on" ? (
              <button
                onClick={disablePush}
                className="ml-2 shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-[12.5px] text-slate-600"
              >
                关闭
              </button>
            ) : env.canPush && pushState !== "denied" ? (
              <button
                onClick={enablePush}
                className="ml-2 shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-[12.5px] font-medium text-white"
              >
                开启
              </button>
            ) : null}
          </div>
          {env.isWechat && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-800">
              微信内不支持推送，请用外部浏览器打开并添加到主屏幕。
            </p>
          )}
          {env.isIOS && !env.isStandalone && pushState !== "on" && (
            <p className="mt-2 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11.5px] text-blue-800">
              iPhone 需先通过 Safari「分享」→「添加到主屏幕」，再从桌面打开才能接收推送。
            </p>
          )}
        </div>

        {/* 通知列表 */}
        {loading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon="📭" title="暂无消息" hint="有人报名、确认或活动提醒时会出现在这里" />
        ) : (
          <div className="mt-3 space-y-2 px-3 pb-4">
            {list.map((n) => (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`block w-full rounded-xl p-3.5 text-left shadow-sm ring-1 transition active:bg-slate-50 ${
                  n.isRead ? "bg-white ring-slate-100" : "bg-brand-50/50 ring-brand-100"
                }`}
              >
                <div className="flex gap-3">
                  <span className="text-[17px] leading-none">{TYPE_ICON[n.type] || "📢"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`flex-1 text-[14px] leading-snug ${
                          n.isRead ? "text-slate-700" : "font-semibold text-slate-900"
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                    </div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">{n.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{fmtRelative(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Shell>
      <BottomNav />
    </>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
