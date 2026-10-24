export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 只在服务端运行时启动定时任务
    await import("./lib/cron").then((m) => m.startCron());
  }
}
