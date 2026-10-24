"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell, { EmptyState } from "@/components/Shell";
import { get, post, patch, del } from "@/lib/client";
import { useToast } from "@/components/Toast";
import { fmtRelative, fmtDateTime } from "@/lib/format";

type Stats = {
  users: { total: number; active: number; banned: number };
  posts: { total: number; open: number; scheduled: number; archived: number; byStatus: Record<string, number> };
  applications: { total: number; confirmed: number; byStatus: Record<string, number> };
  reports: { pending: number; handled: number };
  completionRate: number;
  trend: { date: string; posts: number; applications: number }[];
  recentReports: { id: string; reason: string; status: string; targetType: string; createdAt: string }[];
};

type Report = {
  id: string;
  targetType: string;
  reason: string;
  detail: string;
  status: string;
  handlerNote: string;
  createdAt: string;
  reporter: { id: string; nickname: string };
  targetPost: { id: string; title: string; status: string } | null;
  targetUser: { id: string; nickname: string } | null;
};

const REASON_LABEL: Record<string, string> = {
  spam: "垃圾广告",
  fraud: "疑似诈骗",
  harassment: "骚扰辱骂",
  inappropriate: "色情低俗",
  illegal: "违法违规",
  other: "其他",
};

export default function AdminPage() {
  const router = useRouter();
  const { show, node: toastNode } = useToast();
  const [tab, setTab] = useState<"stats" | "reports" | "words" | "users">("stats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [words, setWords] = useState<{ id: string; word: string; action: string; enabled: boolean }[]>([]);
  const [newWord, setNewWord] = useState("");
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const loadStats = useCallback(() => {
    get<Stats>("/api/admin/dashboard").then((r) => {
      if (!r.ok) {
        setDenied(true);
        setLoading(false);
        return;
      }
      setStats(r.data);
      setLoading(false);
    });
  }, []);

  const loadReports = useCallback(() => {
    get<{ list: Report[] }>("/api/admin/reports?status=pending").then((r) => {
      if (r.ok) setReports(r.data.list);
    });
  }, []);

  const loadWords = useCallback(() => {
    get<{ list: typeof words }>("/api/admin/words").then((r) => {
      if (r.ok) setWords(r.data.list);
    });
  }, []);

  useEffect(() => {
    loadStats();
    loadReports();
    loadWords();
  }, [loadStats, loadReports, loadWords]);

  const handleReport = async (id: string, status: "resolved" | "rejected", action?: string) => {
    const note = action ? prompt("请填写处理说明：", "") : "已核实处理";
    if (action && note === null) return;
    const r = await patch<{ message: string }>(`/api/admin/reports/${id}`, { status, handlerNote: note, action });
    if (!r.ok) return show(r.error, "error");
    show("已处理", "success");
    loadReports();
    loadStats();
  };

  const addWord = async () => {
    if (!newWord.trim()) return;
    const r = await post("/api/admin/words", { word: newWord.trim(), action: "block" });
    if (!r.ok) return show(r.error, "error");
    show("已添加", "success");
    setNewWord("");
    loadWords();
  };

  const removeWord = async (id: string) => {
    const r = await del(`/api/admin/words?id=${id}`);
    if (!r.ok) return show(r.error, "error");
    loadWords();
  };

  const banUser = async (id: string, nickname: string) => {
    const days = prompt(`封禁 ${nickname} 多少天？（1-365）`, "7");
    if (!days) return;
    const r = await patch<{ message: string }>(`/api/admin/users/${id}`, {
      action: "ban",
      days: Number(days),
      reason: "违反社区规范",
    });
    if (!r.ok) return show(r.error, "error");
    show(r.data.message, "success");
    loadStats();
  };

  if (denied) {
    return (
      <Shell title="管理后台" back>
        <EmptyState icon="🔒" title="无访问权限" hint="该页面仅管理员可访问" />
      </Shell>
    );
  }

  return (
    <>
      <Shell title="管理后台" back hideNav>
        <div className="no-scrollbar sticky top-12 z-20 flex gap-1.5 overflow-x-auto border-b border-slate-100 bg-white px-3 py-2.5">
          {[
            { k: "stats" as const, l: "数据概览" },
            { k: "reports" as const, l: `举报 ${stats?.reports.pending || 0}` },
            { k: "words" as const, l: "敏感词" },
            { k: "users" as const, l: "用户" },
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

        <div className="p-3">
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-white" />
          ) : tab === "stats" && stats ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <StatBox label="用户总数" value={stats.users.total} sub={`封禁 ${stats.users.banned}`} />
                <StatBox label="帖子总数" value={stats.posts.total} sub={`报名中 ${stats.posts.open}`} />
                <StatBox label="报名总数" value={stats.applications.total} sub={`已确认 ${stats.applications.confirmed}`} />
                <StatBox label="完成率" value={`${stats.completionRate}%`} sub="已结束且成局" />
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <h3 className="mb-3 text-[13.5px] font-semibold text-slate-700">近 7 天趋势</h3>
                <div className="flex h-28 items-end gap-1.5">
                  {stats.trend.map((t) => {
                    const max = Math.max(...stats.trend.map((x) => x.posts + x.applications), 1);
                    return (
                      <div key={t.date} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex h-20 w-full items-end justify-center gap-0.5">
                          <div
                            className="w-1/3 rounded-t bg-brand-500"
                            style={{ height: `${(t.posts / max) * 100}%` }}
                            title={`发帖 ${t.posts}`}
                          />
                          <div
                            className="w-1/3 rounded-t bg-emerald-400"
                            style={{ height: `${(t.applications / max) * 100}%` }}
                            title={`报名 ${t.applications}`}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400">{t.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-center gap-4 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-brand-500" />发帖
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-emerald-400" />报名
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <h3 className="mb-2.5 text-[13.5px] font-semibold text-slate-700">举报概况</h3>
                <div className="flex justify-around text-center">
                  <div>
                    <b className="text-[19px] text-rose-600">{stats.reports.pending}</b>
                    <p className="text-[11px] text-slate-500">待处理</p>
                  </div>
                  <div>
                    <b className="text-[19px] text-slate-700">{stats.reports.handled}</b>
                    <p className="text-[11px] text-slate-500">已处理</p>
                  </div>
                  <div>
                    <b className="text-[19px] text-slate-700">{stats.posts.archived}</b>
                    <p className="text-[11px] text-slate-500">已归档</p>
                  </div>
                  <div>
                    <b className="text-[19px] text-violet-600">{stats.posts.scheduled}</b>
                    <p className="text-[11px] text-slate-500">待发布</p>
                  </div>
                </div>
              </div>
            </div>
          ) : tab === "reports" ? (
            reports.length === 0 ? (
              <EmptyState icon="✅" title="没有待处理的举报" />
            ) : (
              <div className="space-y-2.5">
                {reports.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="rounded-lg bg-rose-50 px-2 py-0.5 text-[11.5px] font-medium text-rose-700">
                        {REASON_LABEL[r.reason] || r.reason}
                      </span>
                      <span className="text-[11px] text-slate-400">{fmtRelative(r.createdAt)}</span>
                    </div>

                    <p className="mt-2 text-[12.5px] text-slate-500">
                      举报人：{r.reporter.nickname} · 对象：
                      {r.targetType === "post"
                        ? "帖子"
                        : r.targetType === "user"
                          ? "用户"
                          : "留言"}
                    </p>

                    {r.targetPost && (
                      <p className="mt-1 truncate text-[13.5px] font-medium text-slate-800">
                        「{r.targetPost.title}」
                      </p>
                    )}
                    {r.targetUser && (
                      <p className="mt-1 text-[13.5px] font-medium text-slate-800">
                        用户：{r.targetUser.nickname}
                      </p>
                    )}
                    {r.detail && (
                      <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
                        {r.detail}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <button
                        onClick={() => handleReport(r.id, "resolved", "remove_post")}
                        className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[12px] font-medium text-white"
                      >
                        下架帖子
                      </button>
                      {r.targetUser && (
                        <button
                          onClick={() => handleReport(r.id, "resolved", "ban_user")}
                          className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-[12px] text-rose-600"
                        >
                          封禁用户
                        </button>
                      )}
                      <button
                        onClick={() => handleReport(r.id, "resolved")}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-600"
                      >
                        仅标记处理
                      </button>
                      <button
                        onClick={() => handleReport(r.id, "rejected")}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-400"
                      >
                        驳回
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab === "words" ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <h3 className="mb-2 text-[13.5px] font-semibold text-slate-700">新增敏感词</h3>
                <div className="flex gap-2">
                  <input
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="输入要屏蔽的词"
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={addWord}
                    className="rounded-xl bg-brand-600 px-4 text-[13.5px] font-medium text-white"
                  >
                    添加
                  </button>
                </div>
                <p className="mt-1.5 text-[11.5px] text-slate-400">
                  命中 block 级敏感词的内容将被直接拒绝提交
                </p>
              </div>

              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                {words.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[13px] text-slate-400">暂无敏感词</p>
                ) : (
                  words.map((w, i) => (
                    <div
                      key={w.id}
                      className={`flex items-center justify-between px-4 py-2.5 ${
                        i > 0 ? "border-t border-slate-50" : ""
                      }`}
                    >
                      <span className="text-[14px] text-slate-700">{w.word}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10.5px] ${
                            w.action === "block"
                              ? "bg-rose-50 text-rose-600"
                              : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {w.action === "block" ? "拦截" : "脱敏"}
                        </span>
                        <button
                          onClick={() => removeWord(w.id)}
                          className="text-[12px] text-slate-400"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <UsersTab stats={stats} onBan={banUser} />
          )}
        </div>
      </Shell>
      {toastNode}
    </>
  );
}

function StatBox({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100">
      <p className="text-[12px] text-slate-500">{label}</p>
      <b className="mt-0.5 block text-[22px] text-slate-900">{value}</b>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

function UsersTab({
  stats,
  onBan,
}: {
  stats: Stats | null;
  onBan: (id: string, nickname: string) => void;
}) {
  const [list, setList] = useState<
    { id: string; nickname: string; status: string; verified: boolean; banReason: string | null }[]
  >([]);

  useEffect(() => {
    // 通过举报入口拿不到全量用户，这里展示概要 + 封禁数
    setList([]);
  }, []);

  if (!stats) return null;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h3 className="mb-3 text-[13.5px] font-semibold text-slate-700">用户概况</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <b className="text-[20px] text-slate-900">{stats.users.total}</b>
            <p className="text-[11px] text-slate-500">总用户</p>
          </div>
          <div>
            <b className="text-[20px] text-emerald-600">{stats.users.active}</b>
            <p className="text-[11px] text-slate-500">正常</p>
          </div>
          <div>
            <b className="text-[20px] text-rose-600">{stats.users.banned}</b>
            <p className="text-[11px] text-slate-500">封禁中</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h3 className="mb-2 text-[13.5px] font-semibold text-slate-700">管理说明</h3>
        <p className="text-[12.5px] leading-relaxed text-slate-500">
          · 可在「举报」页对违规用户执行封禁与帖子下架
          <br />· 封禁用户会立即失去发帖与报名权限，其进行中的帖子自动下架
          <br />· 举报处理完毕后，被举报帖子按规则在归档 30 天后清理
        </p>
      </div>
    </div>
  );
}
