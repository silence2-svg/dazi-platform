"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell, { EmptyState } from "@/components/Shell";
import BottomNav from "@/components/BottomNav";
import { get, post } from "@/lib/client";
import { APP_STATUS_LABEL, postTypeEmoji, postTypeLabel } from "@/lib/constants";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { useToast } from "@/components/Toast";

type Item = {
  id: string;
  status: string;
  message: string;
  createdAt: string;
  post: {
    id: string;
    title: string;
    type: string;
    location: string;
    eventStart: string;
    eventEnd: string;
    status: string;
    isPast: boolean;
    authorContact: string | null;
    author: { id: string; nickname: string; avatarUrl: string | null };
  };
};

type Counts = { pending: number; confirmed: number; waitlisted: number; history: number };

export default function MyApplicationsPage() {
  const { show, node: toastNode } = useToast();
  const [list, setList] = useState<Item[]>([]);
  const [counts, setCounts] = useState<Counts>({
    pending: 0,
    confirmed: 0,
    waitlisted: 0,
    history: 0,
  });
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<{ list: Item[]; counts: Counts }>(`/api/my/applications?status=${tab}`).then((r) => {
      if (r.ok) {
        setList(r.data.list);
        setCounts(r.data.counts);
      }
      setLoading(false);
    });
  }, [tab]);

  const cancel = async (id: string) => {
    if (!confirm("确定取消报名吗？")) return;
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const j = await res.json();
    if (j?.ok) {
      show(j.data?.message || "已取消", "success");
      const r = await get<{ list: Item[]; counts: Counts }>(`/api/my/applications?status=${tab}`);
      if (r.ok) {
        setList(r.data.list);
        setCounts(r.data.counts);
      }
    } else {
      show(j?.error || "操作失败", "error");
    }
  };

  return (
    <>
      <Shell title="我的报名" back hideNav>
        <div className="no-scrollbar sticky top-12 z-20 flex gap-1.5 overflow-x-auto border-b border-slate-100 bg-white px-3 py-2.5">
          {[
            { k: "all", l: "全部" },
            { k: "confirmed", l: `已确认 ${counts.confirmed}` },
            { k: "pending", l: `待确认 ${counts.pending}` },
            { k: "waitlisted", l: `候补 ${counts.waitlisted}` },
            { k: "history", l: `历史 ${counts.history}` },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium ${
                tab === t.k ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="还没有报名记录"
            hint="在大厅找到合适的活动，点「报名参加」即可"
            action={
              <Link href="/hall" className="rounded-xl bg-brand-600 px-5 py-2.5 text-[14px] text-white">
                去大厅看看
              </Link>
            }
          />
        ) : (
          <div className="space-y-2.5 p-3">
            {list.map((a) => (
              <div key={a.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-base">
                    {postTypeEmoji(a.post.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/post/${a.post.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-semibold text-slate-900">
                          {a.post.title}
                        </p>
                      </Link>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          a.status === "confirmed"
                            ? "bg-emerald-50 text-emerald-700"
                            : a.status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : a.status === "waitlisted"
                                ? "bg-violet-50 text-violet-700"
                                : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {APP_STATUS_LABEL[a.status]}
                      </span>
                    </div>

                    <p className="mt-1 text-[12px] text-slate-500">
                      {postTypeLabel(a.post.type)} · {a.post.location}
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {fmtDateTime(a.post.eventStart)}
                      {a.post.isPast && <span className="ml-1 text-slate-400">（已结束）</span>}
                    </p>

                    {a.status === "confirmed" && a.post.authorContact && (
                      <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-[12.5px] text-emerald-800">
                        📱 发布者联系方式：{a.post.authorContact}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11.5px] text-slate-400">
                        {fmtRelative(a.createdAt)}报名
                      </span>
                      {["pending", "confirmed", "waitlisted"].includes(a.status) && (
                        <button
                          onClick={() => cancel(a.id)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-500"
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </div>
                </div>
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
