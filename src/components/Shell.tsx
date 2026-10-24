"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  children: React.ReactNode;
  title?: string;
  back?: boolean;
  hideNav?: boolean;
  right?: React.ReactNode;
};

/** 移动端页面容器：顶部栏 + 底部安全区 */
export default function Shell({ children, title, back = false, hideNav = false, right }: Props) {
  const router = useRouter();

  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-100">
      {title !== undefined && (
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-12 items-center justify-between px-3 pt-safe">
            <div className="flex w-12 items-center">
              {back && (
                <button
                  onClick={() => router.back()}
                  className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 active:bg-slate-100"
                  aria-label="返回"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
            <h1 className="truncate text-[15px] font-semibold text-slate-900">{title}</h1>
            <div className="flex w-12 justify-end">{right}</div>
          </div>
        </header>
      )}

      <main className={hideNav ? "" : "pb-nav"}>{children}</main>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon = "🗓️",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-3 text-4xl">{icon}</div>
      <p className="text-[15px] font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-5">
      <h2 className="text-[13px] font-semibold text-slate-500">{children}</h2>
      {action}
    </div>
  );
}

/** 环境检测：能否开启 Web Push */
export function useEnvDetect() {
  const [env, setEnv] = useState({
    isWechat: false,
    isIOS: false,
    isStandalone: false,
    canPush: false,
  });

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isWechat = /micromessenger/.test(ua);
    const isIOS =
      /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    setEnv({
      isWechat,
      isIOS,
      isStandalone,
      canPush:
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window &&
        !isWechat,
    });
  }, []);

  return env;
}

/** 微信内打开提示条 */
export function WechatBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(/micromessenger/.test(navigator.userAgent.toLowerCase()));
  }, []);

  if (!show) return null;

  return (
    <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12.5px] leading-relaxed text-amber-900">
      <div className="flex gap-2">
        <span className="text-base leading-none">📱</span>
        <div>
          <p className="font-semibold">当前在微信内置浏览器中打开</p>
          <p className="mt-1 text-amber-800">
            微信内无法接收推送。请点右上角「···」→<b>在浏览器打开</b>，再通过浏览器菜单
            「添加到主屏幕」，即可正常接收活动提醒。
          </p>
          <p className="mt-1 text-amber-700">站内消息在微信内仍可正常查看。</p>
        </div>
      </div>
    </div>
  );
}
