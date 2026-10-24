"use client";

import Link from "next/link";
import { postTypeEmoji, postTypeLabel } from "@/lib/constants";
import { fmtDate, fmtTime, countdownText } from "@/lib/format";

export type PostCardData = {
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
  author: { id: string; nickname: string; avatarUrl: string | null; college: string | null; grade: string | null };
  isMine: boolean;
  createdAt: string;
};

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  open: { label: "报名中", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  full: { label: "已满", cls: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  closed: { label: "已关闭", cls: "bg-slate-100 text-slate-500 ring-slate-400/20" },
  archived: { label: "已归档", cls: "bg-slate-100 text-slate-400 ring-slate-400/20" },
  expired: { label: "已结束", cls: "bg-slate-100 text-slate-400 ring-slate-400/20" },
  scheduled: { label: "待发布", cls: "bg-violet-50 text-violet-700 ring-violet-600/20" },
};

export default function PostCard({ post, compact = false }: { post: PostCardData; compact?: boolean }) {
  const st = STATUS_STYLE[post.status] || STATUS_STYLE.open;
  const start = new Date(post.eventStart);
  const end = new Date(post.eventEnd);
  const isPast = end.getTime() < Date.now();
  const days = Math.ceil((start.getTime() - Date.now()) / 86400000);

  return (
    <Link
      href={`/post/${post.id}`}
      className="block bg-white px-4 py-3.5 active:bg-slate-50"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-lg">
          {postTypeEmoji(post.type)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 flex-1 text-[15px] font-semibold leading-snug text-slate-900">
              {post.title}
            </h3>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${st.cls}`}>
              {st.label}
            </span>
          </div>

          {!compact && post.description && (
            <p className="mt-1 line-clamp-1 text-[13px] text-slate-500">{post.description}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-3.5 w-3.5">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" strokeLinecap="round" />
              </svg>
              {fmtDate(start)} {fmtTime(start)}–{fmtTime(end)}
            </span>
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-3.5 w-3.5">
                <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              {post.location}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
              <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[9px] font-semibold text-brand-700">
                {post.author.nickname.slice(0, 1)}
              </span>
              <span className="max-w-[90px] truncate">{post.author.nickname}</span>
              {post.isMine && (
                <span className="rounded bg-brand-50 px-1 py-px text-[10px] font-medium text-brand-600">
                  我发布的
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[12px]">
              {!isPast && days >= 0 && days <= 3 && post.status === "open" && (
                <span className="rounded bg-rose-50 px-1.5 py-0.5 font-medium text-rose-600">
                  {countdownText(start)}
                </span>
              )}
              <span className="text-slate-400">
                <b className="font-semibold text-slate-700">{post.confirmedCount}</b>
                <span className="text-slate-300">/{post.maxParticipants}</span> 人
              </span>
              {post.remaining > 0 && post.status === "open" && (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-600">
                  还差 {post.remaining} 人
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function postTypeName(key: string) {
  return postTypeLabel(key);
}
