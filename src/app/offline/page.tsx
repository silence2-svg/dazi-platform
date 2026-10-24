import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-8 text-center">
      <div className="mb-4 text-5xl">📡</div>
      <h1 className="text-[17px] font-semibold text-slate-800">当前处于离线状态</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
        请检查网络连接后重试。
        <br />
        已经打开过的页面可能仍可查看，但新的数据需要联网加载。
      </p>
      <Link
        href="/hall"
        className="mt-6 rounded-xl bg-brand-600 px-5 py-2.5 text-[14px] font-medium text-white"
      >
        返回大厅
      </Link>
    </div>
  );
}
