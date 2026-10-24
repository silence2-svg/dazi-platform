"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { WechatBanner } from "@/components/Shell";
import { post, get } from "@/lib/client";

type Mode = "login" | "register";
type Channel = "email" | "student";

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("next") || "/hall";

  const [mode, setMode] = useState<Mode>("login");
  const [channel, setChannel] = useState<Channel>("email");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [grade, setGrade] = useState("");
  const [college, setCollege] = useState("");

  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  // 已登录则直接进入
  useEffect(() => {
    get<{ user: unknown }>("/api/users/me").then((r) => {
      if (r.ok && r.data?.user) router.replace(redirectTo);
      setChecking(false);
    });
  }, [router, redirectTo]);

  const sendCode = async () => {
    setError("");
    if (!identifier.trim()) return setError("请先填写邮箱或学号");
    setBusy(true);
    const r = await post<{ devCode?: string }>("/api/auth/code", {
      channel,
      identifier: identifier.trim(),
      purpose: mode === "register" ? "register" : "login",
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setCodeSent(true);
    setDevCode(r.data?.devCode || null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    const r = await post<{ message?: string }>("/api/auth/login", {
      action: mode,
      channel,
      identifier: identifier.trim(),
      code: code.trim(),
      password,
      nickname: nickname.trim(),
      grade: grade.trim(),
      college: college.trim(),
    });

    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.replace(redirectTo);
    router.refresh();
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-sm text-slate-400">加载中…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white">
      <div className="px-6 pt-14 pb-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-3xl shadow-lg shadow-brand-600/25">
            🤝
          </div>
          <h1 className="text-2xl font-bold text-slate-900">搭子</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">
            大连理工盘锦校区 · 找自习/运动/拼车搭子
          </p>
        </div>

        {/* 登录 / 注册切换 */}
        <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
                setCodeSent(false);
                setDevCode(null);
              }}
              className={`flex-1 rounded-lg py-2 text-[14px] font-medium transition ${
                mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {m === "login" ? "登录" : "注册"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          {/* 认证方式 */}
          {mode === "register" && (
            <div className="mb-1 flex gap-2">
              {([
                { k: "email" as Channel, label: "学校邮箱", hint: "推荐" },
                { k: "student" as Channel, label: "学号认证" },
              ]).map((c) => (
                <button
                  key={c.k}
                  type="button"
                  onClick={() => {
                    setChannel(c.k);
                    setCodeSent(false);
                    setDevCode(null);
                  }}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition ${
                    channel === c.k
                      ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                      : "border-slate-200"
                  }`}
                >
                  <span className="block text-[13.5px] font-medium text-slate-800">{c.label}</span>
                  {c.hint && (
                    <span className="text-[11px] text-brand-600">优先推荐</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <Field
            label={channel === "email" ? "邮箱" : "学号"}
            placeholder={channel === "email" ? "your@dlut.edu.cn" : "请输入 8-12 位学号"}
            value={identifier}
            onChange={(v) => {
              setIdentifier(v);
              setCodeSent(false);
              setDevCode(null);
            }}
            type={channel === "email" ? "email" : "text"}
          />

          {/* 验证码 */}
          {mode === "register" && (
            <div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Field
                    label="验证码"
                    placeholder="6 位验证码"
                    value={code}
                    onChange={setCode}
                    inputMode="numeric"
                  />
                </div>
                <div className="flex w-28 items-end pb-0.5">
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={busy || codeSent}
                    className="h-[42px] w-full rounded-xl border border-brand-200 bg-brand-50 text-[13px] font-medium text-brand-700 disabled:opacity-50"
                  >
                    {codeSent ? "已发送" : "获取验证码"}
                  </button>
                </div>
              </div>
              {devCode && (
                <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  开发环境未接入邮件服务，本次验证码为{" "}
                  <b className="font-mono text-[13px]">{devCode}</b>
                </p>
              )}
            </div>
          )}

          <Field
            label="密码"
            placeholder={mode === "register" ? "至少 6 位" : "请输入密码"}
            value={password}
            onChange={setPassword}
            type="password"
          />

          {mode === "register" && (
            <>
              <Field label="昵称" placeholder="同学们怎么称呼你" value={nickname} onChange={setNickname} />
              <div className="flex gap-2">
                <div className="flex-1">
                  <Field label="年级（选填）" placeholder="如 2024" value={grade} onChange={setGrade} />
                </div>
                <div className="flex-1">
                  <Field label="书院（选填）" placeholder="如 电信学部" value={college} onChange={setCollege} />
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand-600 py-3 text-[15px] font-semibold text-white shadow-sm active:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "处理中…" : mode === "login" ? "登录" : "注册并登录"}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-slate-400">
          登录即表示同意{" "}
          <Link href="/terms" className="text-brand-600">
            用户协议
          </Link>{" "}
          与{" "}
          <Link href="/privacy" className="text-brand-600">
            隐私政策
          </Link>
        </p>

        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-500">
          <p className="font-medium text-slate-600">为什么需要认证？</p>
          <p className="mt-1">
            发帖和报名需要完成学校邮箱或学号认证，用于确认你是校内同学。联系方式默认不公开，仅在报名被确认后双方可见。
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  inputMode,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: "numeric";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}
