import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "搭子 · 大连理工盘锦校区",
  description: "盘锦校区同学的轻量找搭子平台：约自习、约球、拼车、组队比赛",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "搭子",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1c65f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
