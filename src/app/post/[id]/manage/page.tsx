"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Shell, { EmptyState } from "@/components/Shell";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { get, post, patch } from "@/lib/client";
import { APP_STATUS_LABEL } from "@/lib/constants";
import { fmtRelative, fmtDateTime } from "@/lib/format";

type AppItem = {
  id: string;
  status: string;
  message: string;
  createdAt: string;
  decidedAt: string | null;
  applicant: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
    grade: string | null;
    college: string | null;
    contactInfo: string | null;
  };
};

type PostInfo = {
  id: string;
  title: string;
  maxParticipants: number;
  status: string;
  eventStart: string;
};

const STATUS_ORDER = ["pending", "confirmed", "waitlisted", "rejected", "cancelled"];

export default function ManagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { show, node: toastNode } = useToast();

  const [list, setList] = useState<AppItem[]>([]);
  const [detail, setDetail] = useState<PostInfo | null>(null);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<string>("all");

  const load = useCallback(async () => {
    const [a, d] = await Promise.all([
      get<{ list: AppItem[]; summary: Record<string, number> }>(
        `/api/posts/${id}/applications`
      ),
      get<{ post: PostInfo }>(`/api/posts/${id}`),
    ]);

    if (!a.ok) {
      show(a.error, "error");
      setLoading(false);
      return;
    }
    setList(a.data.list);
    setSummary(a.data.summary);
    if (d.ok) setDetail(d.data.post);
    setLoading(false);
  }, [id, show]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (appId: string, action: string, label: string) => {
    setBusy(true);
    const r = await patch<{ message: string }>(`/api/applications/${appId}`, { action });
    setBusy(false);
    if (!r.ok) return show(r.error, "error");
    show(r.data.message || `${label}成功`, "success");
    load();
  };

  const closeSignup = async () => {
    if (!confirm("确定提前关闭报名吗？关闭后不再接受新报名。")) return;
    setBusy(true);
    const r = await post<{ message: string }>(`/api/posts/${id}/close`, { action: "close_signup" });
    setBusy(false);
    if (!r.ok) return show(r.error, "error");
    show(r.data.message, "success");
    load();
  };

  const closePost = async () => {
    const reason = prompt("确定关闭并下架帖子吗？可填写取消原因（将通知已报名的人）：", "");
    if (reason === null) return;
    setBusy(true);
    const r = await post<{ message: string }>(`/api/posts/${id}/close`, {
      action: "close_post",
      reason,
    });
    setBusy(false);
    if (!r.ok) return show(r.error, "error");
    show(r.data.message, "success");
    setTimeout(() => router.push("/hall"), 600);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-400">
        加载中…
      </div>
    );
  }

  const filtered = tab === "all" ? list : list.filter((a) => a.status === tab);
  const sorted = [...filtered].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  );

  return (
    <>
      <Shell title="报名管理" back hideNav>
        {detail && (
          <div className="bg-white px-4 py-4">
            <Link href={`/post/${detail.id}`} className="block">
              <h1 className="text-[16px] font-semibold text-slate-900">{detail.title}</h1>
              <p className="mt-1 text-[12px] text-slate-500">
                {fmtDateTime(detail.eventStart)} · {detail.maxParticipants} 人上限
              </p>
            </Link>

            {/* 概览 */}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { k: "confirmed", l: "已确认", c: "text-emerald-600" },
                { k: "pending", l: "待确认", c: "text-amber-600" },
                { k: "waitlisted", l: "候补", c: "text-violet-600" },
                { k: "rejected", l: "已拒绝", c: "text-slate-400" },
              ].map((s) => (
                <div key={s.k} className="rounded-xl bg-slate-50 py-2 text-center">
                  <b className={`text-[17px] ${s.c}`}>{summary[s.k] || 0}</b>
                  <p className="text-[11px] text-slate-500">{s.l}</p>
                </div>
              ))}
            </div>

            {/* 操作 */}
            <div className="mt-3 flex gap-2">
              {["open", "full"].includes(detail.status) && (
                <button
                  onClick={closeSignup}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[13.5px] font-medium text-slate-600 active:bg-slate-50"
                >
                  提前关闭报名
                </button>
              )}
              {!["archived", "expired"].includes(detail.status) && (
                <button
                  onClick={closePost}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-rose-200 py-2.5 text-[13.5px] font-medium text-rose-600 active:bg-rose-50"
                >
                  取消活动并下架
                </button>
              )}
            </div>
          </div>
        )}

        {/* 筛选 tab */}
        <div className="no-scrollbar sticky top-12 z-20 flex gap-1.5 overflow-x-auto border-b border-slate-100 bg-white px-3 py-2.5">
          {[
            { k: "all", l: `全部 ${list.length}` },
            { k: "pending", l: `待确认 ${summary.pending || 0}` },
            { k: "confirmed", l: `已确认 ${summary.confirmed || 0}` },
            { k: "waitlisted", l: `候补 ${summary.waitlisted || 0}` },
            { k: "rejected", l: `已拒绝 ${summary.rejected || 0}` },
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

        {/* 报名列表 */}
        {sorted.length === 0 ? (
          <EmptyState icon="👥" title="还没有报名" hint="有人报名后会出现在这里，等待你确认" />
        ) : (
          <div className="space-y-2 p-3">
            {sorted.map((a) => (
              <div key={a.id} className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[14px] font-semibold text-brand-700">
                    {a.applicant.nickname.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[14.5px] font-medium text-slate-800">
                        {a.applicant.nickname}
                      </p>
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
                        {APP_STATUS_LABEL[a.status] || a.status}
                      </span>
                    </div>

                    <p className="mt-0.5 text-[11.5px] text-slate-400">
                      {[a.applicant.college, a.applicant.grade].filter(Boolean).join(" · ") || "盘锦校区"}
                      {" · "}
                      {fmtRelative(a.createdAt)}报名
                    </p>

                    {a.message && (
                      <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[11px] text-slate-400">留言（仅你可见）</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">{a.message}</p>
                      </div>
                    )}

                    {a.applicant.contactInfo && (
                      <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-[12.5px] text-emerald-800">
                        📱 {a.applicant.contactInfo}
                      </p>
                    )}

                    {/* 操作按钮 */}
                    <div className="mt-2.5 flex gap-2">
                      {a.status === "pending" && (
                        <>
                          <button
                            onClick={() => act(a.id, "confirm", "确认")}
                            disabled={busy}
                            className="flex-1 rounded-lg bg-brand-600 py-2 text-[13px] font-medium text-white disabled:opacity-50"
                          >
                            确认
                          </button>
                          <button
                            onClick={() => act(a.id, "reject", "拒绝")}
                            disabled={busy}
                            className="flex-1 rounded-lg border border-slate-200 py-2 text-[13px] text-slate-600 disabled:opacity-50"
                          >
                            拒绝
                          </button>
                        </>
                      )}
                      {a.status === "confirmed" && (
                        <button
                          onClick={() => act(a.id, "remove", "移除")}
                          disabled={busy}
                          className="w-full rounded-lg border border-slate-200 py-2 text-[13px] text-slate-600 disabled:opacity-50"
                        >
                          移除（会触发候补递补）
                        </button>
                      )}
                      {a.status === "waitlisted" && (
                        <>
                          <button
                            onClick={() => act(a.id, "confirm", "转正")}
                            disabled={busy}
                            className="flex-1 rounded-lg border border-brand-200 py-2 text-[13px] font-medium text-brand-700 disabled:opacity-50"
                          >
                            手动转正
                          </button>
                          <button
                            onClick={() => act(a.id, "remove", "移除")}
                            disabled={busy}
                            className="flex-1 rounded-lg border border-slate-200 py-2 text-[13px] text-slate-600 disabled:opacity-50"
                          >
                            移除
                          </button>
                        </>
                      )}
                      {(a.status === "rejected" || a.status === "cancelled") && (
                        <span className="text-[12px] text-slate-400">
                          {a.decidedAt ? `${fmtRelative(a.decidedAt)}处理` : "已结束"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="px-4 pb-6 pt-2 text-center text-[11.5px] leading-relaxed text-slate-400">
          确认后系统会通知报名者，并自动向双方展示联系方式。
          <br />
          名额满时自动停止报名，后续报名进入候补队列。
        </p>
      </Shell>
      <BottomNav />
      {toastNode}
    </>
  );
}
