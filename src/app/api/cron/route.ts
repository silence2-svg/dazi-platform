import { NextRequest, NextResponse } from "next/server";
import { runCron } from "@/lib/cron";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron —— 手动触发定时任务
 * 生产环境用外部 cron 调用（建议加 CRON_SECRET 校验）
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.nextUrl.searchParams.get("key") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const summary = await runCron();
  return NextResponse.json({ ok: true, data: summary });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
