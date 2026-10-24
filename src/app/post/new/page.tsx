"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Shell from "@/components/Shell";
import { useToast } from "@/components/Toast";
import { get, post } from "@/lib/client";
import { POST_TYPES, CAMPUS_LOCATIONS, TIME_RULES } from "@/lib/constants";
import { toLocalInput } from "@/lib/format";

type Mode = "now" | "scheduled";

export default function NewPostPage() {
  const router = useRouter();
  const { show, node: toastNode } = useToast();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [verified, setVerified] = useState(false);

  const [type, setType] = useState("study");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [costNote, setCostNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const [mode, setMode] = useState<Mode>("now");
  const [visibleAt, setVisibleAt] = useState("");
  const [signupDeadline, setSignupDeadline] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [contactVisibility, setContactVisibility] = useState("confirmed");

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 登录与认证状态
  useEffect(() => {
    get<{ user: { verified: boolean } }>("/api/users/me").then((r) => {
      if (!r.ok || !r.data?.user) {
        router.replace("/login?next=/post/new");
        return;
      }
      setVerified(!!r.data.user.verified);
      setAuthed(true);
    });
  }, [router]);

  // 默认时间：明天 19:00 - 21:00，报名截止今天 22:00
  useEffect(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() + 1);
    start.setHours(19, 0, 0, 0);
    const end = new Date(start);
    end.setHours(21, 0, 0, 0);
    const deadline = new Date(now);
    deadline.setHours(Math.min(22, 23), 0, 0, 0);

    setEventStart(toLocalInput(start));
    setEventEnd(toLocalInput(end));
    setSignupDeadline(toLocalInput(deadline));
    setVisibleAt(toLocalInput(now));
  }, []);

  // 实时校验
  const liveErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "请填写标题";
    else if (title.trim().length > TIME_RULES.titleMaxLen)
      e.title = `标题不超过 ${TIME_RULES.titleMaxLen} 字`;
    if (!location) e.location = "请选择地点";
    if (maxParticipants < 2) e.maxParticipants = "至少 2 人";
    else if (maxParticipants > TIME_RULES.maxParticipantsLimit)
      e.maxParticipants = `不超过 ${TIME_RULES.maxParticipantsLimit} 人`;

    const vs = visibleAt ? new Date(visibleAt) : null;
    const sd = signupDeadline ? new Date(signupDeadline) : null;
    const es = eventStart ? new Date(eventStart) : null;
    const ee = eventEnd ? new Date(eventEnd) : null;

    if (sd && es && sd > es) e.signupDeadline = "截止时间必须早于或等于活动开始";
    if (es && ee && ee < es) e.eventEnd = "结束时间不能早于开始";
    if (es && vs && es < vs) e.eventStart = "开始时间不能早于发布时间";
    if (vs && ee) {
      const span = (ee.getTime() - vs.getTime()) / 86400000;
      if (span > TIME_RULES.maxVisibleSpanDays)
        e.eventEnd = `从发布到结束最长 ${TIME_RULES.maxVisibleSpanDays} 天（当前 ${span.toFixed(1)} 天）`;
      if (span <= 0) e.eventEnd = "结束时间必须晚于发布时间";
    }
    return e;
  }, [title, location, maxParticipants, visibleAt, signupDeadline, eventStart, eventEnd]);

  const showErrors = Object.keys({ ...liveErrors, ...errors }).length > 0;

  const submit = async () => {
    setErrors({});
    if (Object.keys(liveErrors).length > 0) {
      show("请检查表单中标红的内容", "error");
      return;
    }

    setBusy(true);
    const r = await post<{ post: { id: string }; message: string }>("/api/posts", {
      type,
      title: title.trim(),
      description: description.trim(),
      location,
      maxParticipants,
      publishMode: mode,
      visibleAt: mode === "scheduled" ? new Date(visibleAt).toISOString() : undefined,
      signupDeadline: new Date(signupDeadline).toISOString(),
      eventStart: new Date(eventStart).toISOString(),
      eventEnd: new Date(eventEnd).toISOString(),
      contactVisibility,
      tags,
      costNote: type === "carpool" ? costNote.trim() : undefined,
    });
    setBusy(false);

    if (!r.ok) {
      show(r.error, "error");
      if (r.code === "VALIDATION_ERROR") {
        // 尝试从服务端错误中提取字段
        show(r.error, "error");
      }
      return;
    }

    show(r.data?.message || "发布成功", "success");
    setTimeout(() => router.push(`/post/${r.data!.post.id}`), 600);
  };

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-400">
        加载中…
      </div>
    );
  }

  return (
    <>
      <Shell title="发布搭子" back hideNav>
        {!verified && (
          <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-900">
            你的账号尚未完成身份认证，暂时无法发帖。请使用学校邮箱或学号完成认证后再试。
          </div>
        )}

        <div className="space-y-5 px-4 py-4">
          {/* 类型 */}
          <Section label="类型">
            <div className="grid grid-cols-4 gap-2">
              {POST_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[12px] font-medium transition ${
                    type === t.key
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  <span className="text-lg">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </Section>

          {/* 标题 */}
          <Section label="标题" error={showErrors ? liveErrors.title || errors.title : undefined}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TIME_RULES.titleMaxLen}
              placeholder="一句话说清楚，比如「明晚图书馆三楼一起自习」"
              className={inputCls(!!(showErrors && (liveErrors.title || errors.title)))}
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">
              {title.length}/{TIME_RULES.titleMaxLen}
            </p>
          </Section>

          {/* 说明 */}
          <Section
            label="详细说明"
            hint="选填"
            error={showErrors ? liveErrors.description || errors.description : undefined}
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={TIME_RULES.descMaxLen}
              rows={3}
              placeholder="补充细节：需要带什么、水平要求、是否接受新手等"
              className={`${inputCls(false)} resize-none leading-relaxed`}
            />
          </Section>

          {/* 拼车费用说明 */}
          {type === "carpool" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 text-[12.5px] font-medium text-amber-900">
                拼车规则：仅做信息撮合，禁止盈利
              </p>
              <input
                value={costNote}
                onChange={(e) => setCostNote(e.target.value)}
                placeholder="费用说明，如：预计油费约 60 元/人"
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-amber-400"
              />
            </div>
          )}

          {/* 地点 */}
          <Section label="地点" error={showErrors ? liveErrors.location || errors.location : undefined}>
            <div className="relative">
              <button
                onClick={() => setLocationOpen((v) => !v)}
                className={`${inputCls(!!(showErrors && liveErrors.location))} flex items-center justify-between text-left`}
              >
                <span className={location ? "text-slate-900" : "text-slate-300"}>
                  {location || "选择校区地点"}
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-slate-400">
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {locationOpen && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {CAMPUS_LOCATIONS.map((l) => (
                    <button
                      key={l}
                      onClick={() => {
                        setLocation(l);
                        setLocationOpen(false);
                      }}
                      className={`block w-full px-3.5 py-2.5 text-left text-[14px] ${
                        location === l ? "bg-brand-50 text-brand-700" : "text-slate-700"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* 时间 */}
          <Section label="时间安排">
            <div className="space-y-2.5">
              <TimeField
                label="活动开始"
                value={eventStart}
                onChange={setEventStart}
                error={showErrors ? liveErrors.eventStart || errors.eventStart : undefined}
              />
              <TimeField
                label="活动结束"
                value={eventEnd}
                onChange={setEventEnd}
                error={showErrors ? liveErrors.eventEnd || errors.eventEnd : undefined}
              />
              <TimeField
                label="报名截止"
                value={signupDeadline}
                onChange={setSignupDeadline}
                error={showErrors ? liveErrors.signupDeadline || errors.signupDeadline : undefined}
                hint="截止后自动关闭报名"
              />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">
              规则：报名截止 ≤ 活动开始，活动结束 ≥ 活动开始，从发布到活动结束最长 15 天。
            </p>
          </Section>

          {/* 人数 */}
          <Section
            label="人数上限"
            error={showErrors ? liveErrors.maxParticipants || errors.maxParticipants : undefined}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMaxParticipants((v) => Math.max(2, v - 1))}
                className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 text-lg font-medium text-slate-600 active:bg-slate-200"
              >
                −
              </button>
              <div className="flex-1 rounded-xl bg-slate-100 py-2.5 text-center">
                <b className="text-[17px] text-slate-900">{maxParticipants}</b>
                <span className="ml-1 text-[13px] text-slate-500">人</span>
              </div>
              <button
                onClick={() => setMaxParticipants((v) => Math.min(TIME_RULES.maxParticipantsLimit, v + 1))}
                className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 text-lg font-medium text-slate-600 active:bg-slate-200"
              >
                +
              </button>
            </div>
            <p className="mt-1.5 text-[11.5px] text-slate-400">含你自己，至少 2 人，上限 50 人</p>
          </Section>

          {/* 发布方式 */}
          <Section label="发布方式">
            <div className="flex gap-2">
              {([
                { k: "now" as Mode, t: "立即发布", d: "马上在大厅可见" },
                { k: "scheduled" as Mode, t: "定时发布", d: "到点自动出现" },
              ]).map((m) => (
                <button
                  key={m.k}
                  onClick={() => setMode(m.k)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition ${
                    mode === m.k ? "border-brand-500 bg-brand-50" : "border-slate-200"
                  }`}
                >
                  <span
                    className={`block text-[13.5px] font-medium ${
                      mode === m.k ? "text-brand-700" : "text-slate-700"
                    }`}
                  >
                    {m.t}
                  </span>
                  <span className="text-[11px] text-slate-400">{m.d}</span>
                </button>
              ))}
            </div>
            {mode === "scheduled" && (
              <div className="mt-2.5">
                <TimeField
                  label="定时可见时间"
                  value={visibleAt}
                  onChange={setVisibleAt}
                  error={showErrors ? liveErrors.eventStart || errors.visibleAt : undefined}
                />
              </div>
            )}
          </Section>

          {/* 联系方式可见性 */}
          <Section label="联系方式可见性">
            <div className="space-y-2">
              {[
                { k: "confirmed", t: "确认后可见", d: "报名被确认后，双方互相可见（推荐）" },
                { k: "public", t: "所有人可见", d: "任何登录用户都能看到你的联系方式" },
                { k: "private", t: "不公开", d: "始终不展示联系方式" },
              ].map((o) => (
                <button
                  key={o.k}
                  onClick={() => setContactVisibility(o.k)}
                  className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                    contactVisibility === o.k ? "border-brand-500 bg-brand-50" : "border-slate-200"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      contactVisibility === o.k ? "border-brand-600" : "border-slate-300"
                    }`}
                  >
                    {contactVisibility === o.k && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                  </span>
                  <span>
                    <span className="block text-[13.5px] font-medium text-slate-800">{o.t}</span>
                    <span className="text-[11.5px] text-slate-500">{o.d}</span>
                  </span>
                </button>
              ))}
            </div>
          </Section>

          {/* 标签 */}
          <Section label="标签" hint="选填">
            <div className="flex flex-wrap gap-1.5">
              {["认真", "长期", "安静", "爱学习", "菜鸟", "高手", "女生", "男生", "招募"].map((t) => (
                <button
                  key={t}
                  onClick={() =>
                    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
                  }
                  className={`rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium ${
                    tags.includes(t) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Section>

          <p className="rounded-xl bg-slate-50 p-3 text-[11.5px] leading-relaxed text-slate-500">
            发布即表示你已阅读并同意《用户协议》。禁止发布违法违规、虚假信息；
            拼车仅可分摊油费/过路费，不得盈利；运动与比赛风险自担。
          </p>
        </div>

        {/* 提交栏 */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3">
          <button
            onClick={submit}
            disabled={busy || !verified || Object.keys(liveErrors).length > 0}
            className="w-full rounded-xl bg-brand-600 py-3 text-[15px] font-semibold text-white shadow-sm active:bg-brand-700 disabled:bg-slate-300"
          >
            {busy ? "发布中…" : mode === "now" ? "立即发布" : "设定定时发布"}
          </button>
        </div>
      </Shell>
      <BottomNav />
      {toastNode}
    </>
  );
}

function Section({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <span className="text-[13.5px] font-medium text-slate-800">{label}</span>
        {hint && <span className="text-[11.5px] text-slate-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-[12px] text-rose-600">{error}</p>}
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-1.5">
        <span className="text-[12.5px] font-medium text-slate-600">{label}</span>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </span>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls(!!error)}
      />
    </label>
  );
}

function inputCls(hasError?: boolean) {
  return `w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none transition focus:ring-2 ${
    hasError
      ? "border-rose-300 bg-rose-50/40 focus:border-rose-400 focus:ring-rose-100"
      : "border-slate-200 bg-white focus:border-brand-500 focus:ring-brand-100"
  }`;
}
