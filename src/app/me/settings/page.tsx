"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import BottomNav from "@/components/BottomNav";
import { get, patch } from "@/lib/client";
import { useToast } from "@/components/Toast";
import { useEnvDetect } from "@/components/Shell";

type Me = {
  nickname: string;
  grade: string | null;
  college: string | null;
  contactInfo: string | null;
  contactVisibility: string;
  verified: boolean;
  verifyMethod: string | null;
  email: string | null;
  studentNo: string | null;
};

export default function SettingsPage() {
  const { show, node: toastNode } = useToast();
  const env = useEnvDetect();
  const [me, setMe] = useState<Me | null>(null);
  const [nickname, setNickname] = useState("");
  const [grade, setGrade] = useState("");
  const [college, setCollege] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [visibility, setVisibility] = useState("confirmed");
  const [busy, setBusy] = useState(false);

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");

  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    get<{ user: Me }>("/api/users/me").then((r) => {
      if (!r.ok) return;
      const u = r.data.user;
      setMe(u);
      setNickname(u.nickname);
      setGrade(u.grade || "");
      setCollege(u.college || "");
      setContactInfo(u.contactInfo || "");
      setVisibility(u.contactVisibility);
    });
  }, []);

  // 捕获 PWA 安装提示
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // 注册 Service Worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const save = async () => {
    setBusy(true);
    const r = await patch<{ message: string }>("/api/users/me", {
      nickname,
      grade,
      college,
      contactInfo,
      contactVisibility: visibility,
    });
    setBusy(false);
    if (!r.ok) return show(r.error, "error");
    show(r.data.message || "已保存", "success");
  };

  const changePwd = async () => {
    setBusy(true);
    const r = await patch<{ message: string }>("/api/users/me", {
      oldPassword: oldPwd,
      newPassword: newPwd,
    });
    setBusy(false);
    if (!r.ok) return show(r.error, "error");
    show(r.data.message, "success");
    setOldPwd("");
    setNewPwd("");
  };

  const install = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const res = await installPrompt.userChoice;
    if (res.outcome === "accepted") show("已添加到主屏幕", "success");
    setInstallPrompt(null);
  };

  return (
    <>
      <Shell title="设置" back hideNav>
        <div className="space-y-4 p-3">
          {/* 资料 */}
          <Group title="个人资料">
            <Field label="昵称" value={nickname} onChange={setNickname} />
            <div className="flex gap-2">
              <div className="flex-1">
                <Field label="年级" value={grade} onChange={setGrade} placeholder="如 2024" />
              </div>
              <div className="flex-1">
                <Field label="书院/学院" value={college} onChange={setCollege} placeholder="如 电信学部" />
              </div>
            </div>
            <Field
              label="联系方式"
              value={contactInfo}
              onChange={setContactInfo}
              placeholder="微信号 / 手机号"
            />
            <button
              onClick={save}
              disabled={busy}
              className="mt-1 w-full rounded-xl bg-brand-600 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
            >
              保存资料
            </button>
          </Group>

          {/* 联系方式可见性 */}
          <Group title="联系方式可见性">
            {[
              { k: "private", l: "不公开", d: "始终不展示给任何人" },
              { k: "confirmed", l: "确认后可见", d: "报名被确认后双方可见（推荐）" },
              { k: "public", l: "所有人可见", d: "任何登录用户都能看到" },
            ].map((o) => (
              <button
                key={o.k}
                onClick={() => setVisibility(o.k)}
                className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left ${
                  visibility === o.k ? "border-brand-500 bg-brand-50" : "border-slate-200"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    visibility === o.k ? "border-brand-600" : "border-slate-300"
                  }`}
                >
                  {visibility === o.k && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                </span>
                <span>
                  <span className="block text-[13.5px] font-medium text-slate-800">{o.l}</span>
                  <span className="text-[11.5px] text-slate-500">{o.d}</span>
                </span>
              </button>
            ))}
          </Group>

          {/* 认证信息 */}
          <Group title="认证信息">
            <InfoRow label="认证方式" value={me?.verifyMethod === "email" ? "学校邮箱" : me?.verifyMethod === "student" ? "学号" : "未认证"} />
            <InfoRow label="账号" value={me?.email || me?.studentNo || "—"} />
            <InfoRow label="状态" value={me?.verified ? "已认证，可发帖与报名" : "未认证，暂不可发帖报名"} />
          </Group>

          {/* PWA */}
          <Group title="添加到手机桌面">
            {env.isStandalone ? (
              <p className="text-[13px] text-emerald-600">✓ 已在桌面模式下运行</p>
            ) : installPrompt ? (
              <button
                onClick={install}
                className="w-full rounded-xl bg-brand-600 py-2.5 text-[14px] font-semibold text-white"
              >
                立即添加到主屏幕
              </button>
            ) : (
              <div className="space-y-1.5 text-[12.5px] leading-relaxed text-slate-500">
                <p className="font-medium text-slate-700">手动添加方法：</p>
                <p>· <b>Android Chrome</b>：右上角菜单 → 添加到主屏幕</p>
                <p>· <b>iPhone Safari</b>：底部分享按钮 → 添加到主屏幕</p>
                {env.isWechat && (
                  <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-800">
                    当前在微信内，请先「在浏览器打开」
                  </p>
                )}
              </div>
            )}
            <p className="text-[11.5px] leading-relaxed text-slate-400">
              添加到主屏幕后可接收活动提醒推送（需浏览器支持 Web Push）。
            </p>
          </Group>

          {/* 修改密码 */}
          <Group title="修改密码">
            <Field label="原密码" value={oldPwd} onChange={setOldPwd} type="password" />
            <Field label="新密码" value={newPwd} onChange={setNewPwd} type="password" placeholder="至少 6 位" />
            <button
              onClick={changePwd}
              disabled={busy || !oldPwd || !newPwd}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 text-[14px] font-medium text-slate-700 disabled:opacity-40"
            >
              修改密码
            </button>
          </Group>
        </div>
      </Shell>
      <BottomNav />
      {toastNode}
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-3 text-[13.5px] font-semibold text-slate-700">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[14.5px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[12.5px] text-slate-500">{label}</span>
      <span className="text-[13px] text-slate-700">{value}</span>
    </div>
  );
}
