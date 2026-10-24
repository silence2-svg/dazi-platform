"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import BottomNav from "@/components/BottomNav";
import { get } from "@/lib/client";
import { fmtDate } from "@/lib/format";

type Me = {
  id: string;
  email: string | null;
  studentNo: string | null;
  nickname: string;
  campus: string;
  grade: string | null;
  college: string | null;
  contactInfo: string | null;
  contactVisibility: string;
  role: string;
  verified: boolean;
  verifyMethod: string | null;
  pushEnabled: boolean;
  createdAt: string;
  _count: { posts: number; applications: number };
  unreadCount: number;
};

export default function MePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<{ user: Me }>("/api/users/me").then((r) => {
      if (!r.ok || !r.data?.user) {
        router.replace("/login?next=/me");
        return;
      }
      setMe(r.data.user);
      setLoading(false);
    });
  }, [router]);

  const logout = async () => {
    if (!confirm("确定退出登录吗？")) return;
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-400">
        加载中…
      </div>
    );
  }

  if (!me) return null;

  return (
    <>
      <Shell hideNav>
        {/* 个人信息卡 */}
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-4 pb-16 pt-safe">
          <div className="flex items-center gap-3 pb-4 pt-4">
            <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white/20 text-[22px] font-bold text-white ring-2 ring-white/30">
              {me.nickname.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[17px] font-bold text-white">{me.nickname}</h1>
                {me.role === "admin" && (
                  <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950">
                    管理员
                  </span>
                )}
                {me.verified ? (
                  <span className="rounded bg-emerald-400 px-1.5 py-0.5 text-[10px] font-medium text-emerald-950">
                    已认证
                  </span>
                ) : (
                  <span className="rounded bg-white/25 px-1.5 py-0.5 text-[10px] text-white">
                    未认证
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[12px] text-white/70">
                {[me.college, me.grade].filter(Boolean).join(" · ") || me.campus}
              </p>
              <p className="mt-0.5 text-[11px] text-white/60">
                {me.verifyMethod === "email" ? "学校邮箱认证" : me.verifyMethod === "student" ? "学号认证" : "未认证"}
                {me.studentNo && ` · ${me.studentNo}`}
              </p>
            </div>
          </div>
        </div>

        {/* 数据概览 */}
        <div className="-mt-12 px-4">
          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-white p-3 shadow-sm">
            {[
              { l: "我发布的", v: me._count.posts, href: "/me/posts" },
              { l: "我的报名", v: me._count.applications, href: "/me/applications" },
              { l: "未读消息", v: me.unreadCount, href: "/messages" },
              { l: "已归档", v: null, href: "/me/archived" },
            ].map((s) => (
              <Link key={s.l} href={s.href} className="flex flex-col items-center py-1 active:opacity-60">
                <b className="text-[18px] text-slate-900">{s.v ?? "—"}</b>
                <span className="mt-0.5 text-[11.5px] text-slate-500">{s.l}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* 功能列表 */}
        <div className="mt-4 space-y-3 px-4 pb-6">
          <MenuGroup
            items={[
              { icon: "📝", label: "我的帖子", href: "/me/posts" },
              { icon: "🎯", label: "我的报名", href: "/me/applications" },
              { icon: "🗄️", label: "已结束 / 归档", href: "/me/archived" },
              { icon: "🔔", label: "我的通知", href: "/messages", badge: me.unreadCount },
            ]}
          />

          <MenuGroup
            items={[
              { icon: "🚫", label: "黑名单", href: "/me/blocked" },
              { icon: "⚙️", label: "设置", href: "/me/settings" },
              { icon: "📄", label: "用户协议", href: "/terms" },
              { icon: "🔒", label: "隐私政策", href: "/privacy" },
            ]}
          />

          {me.role === "admin" && (
            <MenuGroup items={[{ icon: "🛡️", label: "管理后台", href: "/admin" }]} />
          )}

          <button
            onClick={logout}
            className="w-full rounded-xl bg-white py-3.5 text-[14.5px] font-medium text-rose-600 shadow-sm ring-1 ring-slate-100 active:bg-slate-50"
          >
            退出登录
          </button>

          <p className="pt-2 text-center text-[11px] leading-relaxed text-slate-400">
            搭子 · 大连理工盘锦校区
            <br />
            加入时间 {fmtDate(me.createdAt)} · 本平台与学校官方无关
          </p>
        </div>
      </Shell>
      <BottomNav />
    </>
  );
}

function MenuGroup({
  items,
}: {
  items: { icon: string; label: string; href: string; badge?: number }[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
      {items.map((it, i) => (
        <Link
          key={it.href}
          href={it.href}
          className={`flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 ${
            i > 0 ? "border-t border-slate-50" : ""
          }`}
        >
          <span className="text-[17px]">{it.icon}</span>
          <span className="flex-1 text-[14.5px] text-slate-800">{it.label}</span>
          {!!it.badge && it.badge > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10.5px] font-medium text-white">
              {it.badge}
            </span>
          )}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-slate-300">
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ))}
    </div>
  );
}
