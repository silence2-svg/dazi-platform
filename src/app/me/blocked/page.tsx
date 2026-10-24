"use client";

import { useEffect, useState } from "react";
import Shell, { EmptyState } from "@/components/Shell";
import BottomNav from "@/components/BottomNav";
import { get, post } from "@/lib/client";
import { fmtRelative } from "@/lib/format";
import { useToast } from "@/components/Toast";

type Blocked = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  college: string | null;
  grade: string | null;
  createdAt: string;
};

export default function BlockedPage() {
  const { show, node: toastNode } = useToast();
  const [list, setList] = useState<Blocked[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    get<{ list: Blocked[] }>("/api/users/blocked").then((r) => {
      if (r.ok) setList(r.data.list);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const unblock = async (id: string) => {
    const r = await post<{ message: string }>(`/api/users/${id}/block`);
    if (!r.ok) return show(r.error, "error");
    show(r.data.message, "success");
    load();
  };

  return (
    <>
      <Shell title="黑名单" back hideNav>
        <p className="px-4 py-3 text-[12px] leading-relaxed text-slate-400">
          拉黑后，对方无法报名你的帖子、给你留言，也无法查看你的联系方式。
        </p>

        {loading ? (
          <div className="space-y-2 p-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon="🚫" title="黑名单是空的" hint="在帖子详情页可以举报或拉黑用户" />
        ) : (
          <div className="space-y-2 p-3">
            {list.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-[15px] font-semibold text-slate-600">
                  {u.nickname.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium text-slate-800">{u.nickname}</p>
                  <p className="text-[11.5px] text-slate-400">
                    {[u.college, u.grade].filter(Boolean).join(" · ") || "盘锦校区"} ·{" "}
                    {fmtRelative(u.createdAt)}拉黑
                  </p>
                </div>
                <button
                  onClick={() => unblock(u.id)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-600"
                >
                  解除
                </button>
              </div>
            ))}
          </div>
        )}
      </Shell>
      <BottomNav />
      {toastNode}
    </>
  );
}
