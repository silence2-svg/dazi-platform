"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { get, post, del } from "@/lib/client";
import { postTypeEmoji, postTypeLabel, APP_STATUS_LABEL } from "@/lib/constants";
import { fmtDateTime, fmtRelative, countdownText } from "@/lib/format";

type PostDetail = {
  id: string;
  type: string;
  title: string;
  description: string;
  location: string;
  eventStart: string;
  eventEnd: string;
  signupDeadline: string;
  maxParticipants: number;
  confirmedCount: number;
  remaining: number;
  status: string;
  tags: string[];
  costNote: string | null;
  cancelReason: string | null;
  createdAt: string;
  archivedAt: string | null;
  author: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
    college: string | null;
    grade: string | null;
    contactInfo: string | null;
  };
  isAuthor: boolean;
  contactVisibility: string;
};

type MyApp = { id: string; status: string; message: string; createdAt: string } | null;

const STATUS_LABEL: Record<string, string> = {
  open: "报名中",
  full: "已满员",
  closed: "报名已关闭",
  archived: "已归档",
  expired: "已结束",
  scheduled: "待发布",
};

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { show, node: toastNode } = useToast();

  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [myApp, setMyApp] = useState<MyApp>(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await get<{ post: PostDetail; myApplication: MyApp; canSeeContact: boolean }>(
      `/api/posts/${id}`
    );
    if (!r.ok) {
      show(r.error, "error");
      setLoading(false);
      return;
    }
    setDetail(r.data.post);
    setMyApp(r.data.myApplication);
    setLoading(false);
  }, [id, show]);

  useEffect(() => {
    load();
  }, [load]);

  // 页面活跃时，尝试震动 + 提示音（非核心依赖）
  const buzz = () => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(60);
    } catch {
      /* 忽略 */
    }
  };

  const doApply = async () => {
    setBusy(true);
    const r = await post<{ message: string }>(`/api/posts/${id}/applications`, { message });
    setBusy(false);
    buzz();
    if (!r.ok) {
      show(r.error, "error");
      return;
    }
    show(r.data.message, "success");
    setApplyOpen(false);
    setMessage("");
    load();
  };

  const cancelApply = async () => {
    if (!myApp) return;
    if (!confirm("确定取消报名吗？已确认的会通知发布者，候补可能自动递补。")) return;
    setBusy(true);
    const res = await fetch(`/api/applications/${myApp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const j = await res.json();
    setBusy(false);
    if (j?.ok) {
      show(j.data?.message || "已取消", "success");
      load();
    } else {
      show(j?.error || "操作失败", "error");
    }
  };

  const closePost = async (action: "close_signup" | "close_post") => {
    const label = action === "close_signup" ? "关闭报名" : "关闭并下架帖子";
    if (!confirm(`确定${label}吗？`)) return;
    setBusy(true);
    const r = await post<{ message: string }>(`/api/posts/${id}/close`, { action });
    setBusy(false);
    if (!r.ok) return show(r.error, "error");
    show(r.data.message, "success");
    load();
  };

  const removePost = async () => {
    if (!confirm("确定删除吗？帖子会下架归档，30 天后物理删除。")) return;
    setBusy(true);
    const r = await del<{ message: string }>(`/api/posts/${id}`);
    setBusy(false);
    if (!r.ok) return show(r.error, "error");
    show(r.data.message, "success");
    setTimeout(() => router.push("/me"), 600);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-400">
        加载中…
      </div>
    );
  }

  if (!detail) {
    return (
      <Shell title="帖子详情" back>
        <div className="px-6 py-20 text-center text-sm text-slate-400">帖子不存在或已被删除</div>
      </Shell>
    );
  }

  const canApplyNow =
    detail.status === "open" && new Date(detail.signupDeadline) > new Date() && !detail.isAuthor && !myApp;

  return (
    <>
      <Shell title="帖子详情" back hideNav>
        <div className="bg-white">
          {/* 头部 */}
          <div className="px-4 pb-4 pt-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11.5px] font-medium text-slate-600">
                {postTypeEmoji(detail.type)} {postTypeLabel(detail.type)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${
                  detail.status === "open"
                    ? "bg-emerald-50 text-emerald-700"
                    : detail.status === "full"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {STATUS_LABEL[detail.status] || detail.status}
              </span>
              {detail.tags.map((t) => (
                <span key={t} className="rounded-lg bg-brand-50 px-2 py-1 text-[11.5px] text-brand-700">
                  #{t}
                </span>
              ))}
            </div>

            <h1 className="text-[19px] font-bold leading-snug text-slate-900">{detail.title}</h1>

            {detail.cancelReason && (
              <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
                取消原因：{detail.cancelReason}
              </p>
            )}
          </div>

          {/* 信息块 */}
          <div className="space-y-2.5 border-y border-slate-100 px-4 py-4">
            <InfoRow
              icon="🕐"
              label="活动时间"
              value={`${fmtDateTime(detail.eventStart)} — ${fmtDateTime(detail.eventEnd).split(" ").pop()}`}
              extra={
                new Date(detail.eventStart) > new Date() ? (
                  <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-600">
                    {countdownText(detail.eventStart)}
                  </span>
                ) : null
              }
            />
            <InfoRow icon="📍" label="活动地点" value={detail.location} />
            <InfoRow
              icon="👥"
              label="人数"
              value={`已确认 ${detail.confirmedCount} / ${detail.maxParticipants} 人`}
              extra={
                detail.remaining > 0 ? (
                  <span className="ml-2 text-[12px] text-emerald-600">还差 {detail.remaining} 人</span>
                ) : (
                  <span className="ml-2 text-[12px] text-amber-600">已满</span>
                )
              }
            />
            <InfoRow
              icon="⏳"
              label="报名截止"
              value={fmtDateTime(detail.signupDeadline)}
              extra={
                detail.status === "open" ? (
                  <span className="ml-2 text-[12px] text-slate-400">
                    {countdownText(detail.signupDeadline)}
                  </span>
                ) : null
              }
            />
          </div>

          {/* 说明 */}
          {detail.description && (
            <div className="px-4 py-4">
              <p className="mb-1.5 text-[12.5px] font-medium text-slate-400">详细说明</p>
              <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-slate-700">
                {detail.description}
              </p>
            </div>
          )}

          {detail.costNote && (
            <div className="mx-4 mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[12px] font-medium text-amber-900">费用说明</p>
              <p className="mt-0.5 text-[13.5px] text-amber-800">{detail.costNote}</p>
              <p className="mt-1.5 text-[11.5px] text-amber-700">
                本平台仅提供信息撮合，不收取任何费用，费用由参与者自行结算。
              </p>
            </div>
          )}

          {/* 发布者 */}
          <div className="border-t border-slate-100 px-4 py-4">
            <p className="mb-2.5 text-[12.5px] font-medium text-slate-400">发布者</p>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[15px] font-semibold text-brand-700">
                {detail.author.nickname.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-medium text-slate-800">
                  {detail.author.nickname}
                </p>
                <p className="text-[12px] text-slate-400">
                  {[detail.author.college, detail.author.grade].filter(Boolean).join(" · ") || "盘锦校区"}
                </p>
              </div>
            </div>

            {detail.author.contactInfo ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[12px] font-medium text-emerald-800">联系方式（已对你可见）</p>
                <p className="mt-0.5 font-mono text-[14px] text-emerald-900">{detail.author.contactInfo}</p>
              </div>
            ) : detail.contactVisibility === "confirmed" ? (
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">
                🔒 联系方式在报名被确认后双方可见，保护双方隐私。
              </p>
            ) : null}
          </div>

          {/* 我的报名状态 */}
          {myApp && (
            <div className="mx-4 mb-4 rounded-xl border border-brand-200 bg-brand-50 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13.5px] font-semibold text-brand-800">
                    我的报名：{APP_STATUS_LABEL[myApp.status] || myApp.status}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-brand-600">
                    提交于 {fmtRelative(myApp.createdAt)}
                  </p>
                </div>
                {myApp.status === "confirmed" && (
                  <span className="text-2xl">🎉</span>
                )}
              </div>

              {myApp.status === "pending" && (
                <p className="mt-2 text-[12px] leading-relaxed text-brand-700">
                  已通知发布者，等待确认。确认后你会收到消息。
                </p>
              )}
              {myApp.status === "waitlisted" && (
                <p className="mt-2 text-[12px] leading-relaxed text-brand-700">
                  当前名额已满，你在候补中。有人取消时会自动递补并通知你。
                </p>
              )}
              {myApp.status === "confirmed" && (
                <p className="mt-2 text-[12px] leading-relaxed text-brand-700">
                  已确认参加，双方联系方式互相可见。请准时参加。
                </p>
              )}

              {(myApp.status === "pending" ||
                myApp.status === "confirmed" ||
                myApp.status === "waitlisted") && (
                <button
                  onClick={cancelApply}
                  disabled={busy}
                  className="mt-2.5 w-full rounded-lg border border-brand-300 py-2 text-[13px] font-medium text-brand-700 active:bg-brand-100"
                >
                  取消报名
                </button>
              )}
            </div>
          )}

          {/* 操作区 */}
          <div className="flex gap-2 px-4 pb-4">
            {!detail.isAuthor && (
              <button
                onClick={() => setReportOpen(true)}
                className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] text-slate-500 active:bg-slate-50"
              >
                举报
              </button>
            )}
            {detail.isAuthor && (
              <>
                <Link
                  href={`/post/${detail.id}/manage`}
                  className="flex-1 rounded-xl border border-brand-200 py-2.5 text-center text-[14px] font-medium text-brand-700"
                >
                  管理报名（{detail.confirmedCount}/{detail.maxParticipants}）
                </Link>
                {detail.status === "open" && (
                  <button
                    onClick={() => closePost("close_signup")}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] text-slate-600 active:bg-slate-50"
                  >
                    关闭报名
                  </button>
                )}
                {["open", "full", "closed"].includes(detail.status) && (
                  <button
                    onClick={() => closePost("close_post")}
                    disabled={busy}
                    className="rounded-xl border border-rose-200 px-3.5 py-2.5 text-[13px] text-rose-600 active:bg-rose-50"
                  >
                    下架
                  </button>
                )}
                {detail.status === "archived" && (
                  <button
                    onClick={removePost}
                    disabled={busy}
                    className="rounded-xl border border-rose-200 px-3.5 py-2.5 text-[13px] text-rose-600"
                  >
                    删除
                  </button>
                )}
              </>
            )}
          </div>

          <p className="px-4 pb-6 text-center text-[11.5px] text-slate-400">
            发布于 {fmtRelative(detail.createdAt)}
            {detail.archivedAt && ` · 已于 ${fmtDateTime(detail.archivedAt)} 归档`}
          </p>
        </div>

        {/* 报名弹层 */}
        {applyOpen && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/40">
            <div className="animate-toast w-full rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]">
              <div className="px-4 pb-2 pt-4">
                <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-200" />
                <h3 className="text-[16px] font-semibold text-slate-900">报名参加</h3>
                <p className="mt-1 text-[12.5px] text-slate-500">
                  报名后状态为「待确认」，发布者确认后你会收到通知。
                </p>
              </div>
              <div className="px-4 pb-4">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="给发布者留言（选填，仅发布者可见）"
                  className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-[14.5px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <p className="mt-1 text-[11.5px] text-slate-400">
                  留言仅发布者可见，不会公开展示
                </p>
              </div>
              <div className="flex gap-2 px-4 pb-5">
                <button
                  onClick={() => setApplyOpen(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-3 text-[15px] font-medium text-slate-600"
                >
                  取消
                </button>
                <button
                  onClick={doApply}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-brand-600 py-3 text-[15px] font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "提交中…" : "确认报名"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 举报弹层 */}
        {reportOpen && (
          <ReportSheet postId={detail.id} onClose={() => setReportOpen(false)} onDone={show} />
        )}
      </Shell>

      {/* 底部操作条 */}
      {!applyOpen && !reportOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          {canApplyNow ? (
            <button
              onClick={() => setApplyOpen(true)}
              className="w-full rounded-xl bg-brand-600 py-3 text-[15px] font-semibold text-white shadow-sm active:bg-brand-700"
            >
              {detail.remaining > 0 ? `报名参加（还差 ${detail.remaining} 人）` : "加入候补"}
            </button>
          ) : detail.isAuthor ? (
            <Link
              href={`/post/${detail.id}/manage`}
              className="block w-full rounded-xl border border-brand-200 py-3 text-center text-[15px] font-semibold text-brand-700"
            >
              管理报名名单
            </Link>
          ) : myApp ? (
            <div className="rounded-xl bg-slate-100 py-3 text-center text-[14px] text-slate-500">
              你已报名 · {APP_STATUS_LABEL[myApp.status]}
            </div>
          ) : (
            <div className="rounded-xl bg-slate-100 py-3 text-center text-[14px] text-slate-500">
              {detail.status === "full"
                ? "名额已满，无法报名"
                : detail.status === "archived"
                  ? "活动已结束"
                  : "报名已截止"}
            </div>
          )}
        </div>
      )}

      <BottomNav />
      {toastNode}
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
  extra,
}: {
  icon: string;
  label: string;
  value: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-[15px] leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-[12.5px] text-slate-400">{label}</span>
        <p className="text-[14.5px] text-slate-800">
          {value}
          {extra}
        </p>
      </div>
    </div>
  );
}

/** 举报面板 */
function ReportSheet({
  postId,
  onClose,
  onDone,
}: {
  postId: string;
  onClose: () => void;
  onDone: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [reason, setReason] = useState("spam");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  const REASONS = [
    { k: "spam", l: "垃圾广告" },
    { k: "fraud", l: "疑似诈骗/虚假信息" },
    { k: "harassment", l: "骚扰辱骂" },
    { k: "inappropriate", l: "色情低俗" },
    { k: "illegal", l: "违法违规" },
    { k: "other", l: "其他" },
  ];

  const submit = async () => {
    setBusy(true);
    const r = await post<{ message: string }>("/api/reports", {
      targetType: "post",
      targetId: postId,
      reason,
      detail,
    });
    setBusy(false);
    if (!r.ok) return onDone(r.error, "error");
    onDone(r.data.message, "success");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40">
      <div className="animate-toast w-full rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="px-4 pb-2 pt-4">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-200" />
          <h3 className="text-[16px] font-semibold text-slate-900">举报该帖子</h3>
        </div>
        <div className="space-y-2 px-4 pb-4">
          {REASONS.map((r) => (
            <button
              key={r.k}
              onClick={() => setReason(r.k)}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[14px] ${
                reason === r.k ? "border-brand-500 bg-brand-50" : "border-slate-200"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  reason === r.k ? "border-brand-600" : "border-slate-300"
                }`}
              >
                {reason === r.k && <span className="h-2 w-2 rounded-full bg-brand-600" />}
              </span>
              {r.l}
            </button>
          ))}
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="补充说明（选填）"
            className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-[14px] outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex gap-2 px-4 pb-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-100 py-3 text-[15px] font-medium text-slate-600"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 rounded-xl bg-rose-600 py-3 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "提交中…" : "提交举报"}
          </button>
        </div>
      </div>
    </div>
  );
}
