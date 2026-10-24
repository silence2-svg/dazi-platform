"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  { href: "/hall", label: "大厅", icon: HallIcon },
  { href: "/post/new", label: "发布", icon: PlusIcon, center: true },
  { href: "/messages", label: "消息", icon: BellIcon, badge: true },
  { href: "/me", label: "我的", icon: UserIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  // 拉取未读数
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/notifications?pageSize=1", { cache: "no-store" });
        const json = await res.json();
        if (alive && json?.ok) setUnread(json.data?.unreadCount || 0);
      } catch {
        /* 未登录或网络失败时静默 */
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[var(--nav-height)] max-w-md items-stretch justify-around">
        {TABS.map((t) => {
          const active = pathname === t.href || (t.href !== "/hall" && pathname.startsWith(t.href));
          const Icon = t.icon;

          if (t.center) {
            return (
              <Link
                key={t.href}
                href={t.href}
                className="flex flex-1 flex-col items-center justify-center"
                aria-label={t.label}
              >
                <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30">
                  <Icon className="h-6 w-6 text-white" />
                </span>
                <span className="text-[11px] font-medium text-slate-500">{t.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={t.href}
              href={t.href}
              className="relative flex flex-1 flex-col items-center justify-center"
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                <Icon
                  className={`h-6 w-6 ${active ? "text-brand-600" : "text-slate-400"}`}
                />
                {t.badge && unread > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </span>
              <span
                className={`mt-0.5 text-[11px] ${
                  active ? "font-semibold text-brand-600" : "text-slate-400"
                }`}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div style={{ height: "var(--safe-bottom)" }} />
    </nav>
  );
}

type IconProps = { className?: string };

function HallIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7Z" strokeLinejoin="round" />
      <path d="M10.3 20a2 2 0 0 0 3.4 0" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" strokeLinecap="round" />
    </svg>
  );
}
