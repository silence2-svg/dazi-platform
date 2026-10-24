"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
  message: string | null;
  onDone?: () => void;
  type?: "success" | "error" | "info";
  duration?: number;
};

/** 轻提示 Toast */
export default function Toast({ message, onDone, type = "info", duration = 2400 }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;
    timer.current = setTimeout(() => onDone?.(), duration);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [message, onDone, duration]);

  if (!message) return null;

  const bg =
    type === "success" ? "bg-emerald-600" : type === "error" ? "bg-rose-600" : "bg-slate-800";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-6 pt-[calc(var(--safe-top)+56px)]">
      <div
        className={`animate-toast max-w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ${bg}`}
      >
        {message}
      </div>
    </div>
  );
}

/** 提供页面内 toast 状态 */
export function useToast() {
  const [toast, setToast] = useState<{
    message: string | null;
    type: "success" | "error" | "info";
  }>({ message: null, type: "info" });

  const show = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  const node = (
    <Toast
      message={toast.message}
      type={toast.type}
      onDone={() => setToast({ message: null, type: "info" })}
    />
  );

  return { show, node };
}
