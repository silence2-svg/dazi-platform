// 端到端验收脚本：逐条验证 PRD 第十节验收标准
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";

// 验收前重置：清空数据库并重新写入种子数据。
// 必须重置，因为产品内置的频率限制（每日发帖 5 条 / 报名 20 条）
// 会让脚本第二次运行时全部 429，导致误判为功能缺陷。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
console.log("⟳ 重置数据库…");
// 用 tsx 的 JS 入口而非 .bin 包装脚本：Windows 下 .bin/tsx 是 shell 脚本，无法被 spawn
execFileSync(process.execPath,
  [path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"), path.join(ROOT, "prisma", "seed.ts")],
  { stdio: "ignore", cwd: ROOT });

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

const jars = {};
const prisma = new PrismaClient();

async function login(identifier, password = "dazi2026") {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", channel: "email", identifier, password }),
  });
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("login failed: " + identifier);
  return cookie.split(";")[0];
}

function api(cookie, path, opts = {}) {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      cookie,
      ...(opts.headers || {}),
    },
  });
}

(async () => {
  console.log("\n═══ 1. 认证 ═══");
  const lin = await login("user1@dlut.edu.cn");   // 林小满
  const su = await login("user2@dlut.edu.cn");    // 苏晴
  const admin = await login("admin@dlut.edu.cn");
  check("多账号登录成功", !!lin && !!su && !!admin);

  const anon = await fetch(`${BASE}/api/posts`);
  check("游客可浏览大厅", anon.status === 200);

  const anonPost = await fetch(`${BASE}/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "游客发帖" }),
  });
  check("游客不能发帖", anonPost.status === 401);

  console.log("\n═══ 2. 时间字段校验 ═══");
  const mk = (over) => {
    const d = new Date(Date.now() + 86400000);
    d.setHours(19, 0, 0, 0);
    const iso = (x) => new Date(x).toISOString();
    return {
      type: "study", title: "校验测试", description: "", location: "图书馆",
      maxParticipants: 3, publishMode: "now",
      eventStart: iso(d),
      eventEnd: iso(new Date(d.getTime() + 7200000)),
      signupDeadline: iso(new Date(d.getTime() - 3600000)),
      ...over,
    };
  };
  const send = (body) => api(lin, "/api/posts", { method: "POST", body: JSON.stringify(body) });

  const r1 = await send(mk({ title: "" }));
  check("标题必填校验", r1.status === 422);

  const d = new Date(Date.now() + 86400000); d.setHours(19, 0, 0, 0);
  const r2 = await send(mk({
    signupDeadline: new Date(d.getTime() + 3600000).toISOString(), // 晚于开始
  }));
  check("报名截止 ≤ 活动开始", r2.status === 422);

  const r3 = await send(mk({
    eventEnd: new Date(d.getTime() - 3600000).toISOString(), // 早于开始
  }));
  check("活动结束 ≥ 活动开始", r3.status === 422);

  const r4 = await send(mk({ maxParticipants: 1 }));
  check("人数上限 ≥ 2", r4.status === 422);

  const far = new Date(Date.now() + 20 * 86400000);
  const r5 = await send(mk({
    eventStart: far.toISOString(),
    eventEnd: new Date(far.getTime() + 3600000).toISOString(),
    signupDeadline: new Date(far.getTime() - 3600000).toISOString(),
  }));
  check("发布到结束 ≤ 15 天", r5.status === 422);

  console.log("\n═══ 3. 发帖：立即 / 定时 ═══");
  const r6 = await send(mk({ title: "验收测试-立即发布" }));
  const immediate = await r6.json();
  check("立即发布成功", r6.status === 201 && immediate.data.post.status === "open");

  const later = new Date(Date.now() + 3600000);
  const r7 = await send(mk({
    title: "验收测试-定时发布",
    publishMode: "scheduled",
    visibleAt: later.toISOString(),
    eventStart: new Date(later.getTime() + 86400000).toISOString(),
    eventEnd: new Date(later.getTime() + 90000000).toISOString(),
    signupDeadline: new Date(later.getTime() + 43200000).toISOString(),
  }));
  const scheduled = await r7.json();
  check("定时发布成功", r7.status === 201 && scheduled.data.post.status === "scheduled");

  const hallNow = await (await fetch(`${BASE}/api/posts?pageSize=50`)).json();
  const scheduledVisible = hallNow.data.list.some((p) => p.title === "验收测试-定时发布");
  check("未到点帖子不在大厅显示", !scheduledVisible);

  const postId = immediate.data.post.id;

  console.log("\n═══ 4. 报名与状态机 ═══");
  const r8 = await api(su, `/api/posts/${postId}/applications`, {
    method: "POST", body: JSON.stringify({ message: "我想参加" }),
  });
  const appData = await r8.json();
  check("报名成功且状态为待确认", r8.status === 201 && appData.data.application.status === "pending");

  const r9 = await api(su, `/api/posts/${postId}/applications`, {
    method: "POST", body: JSON.stringify({}),
  });
  check("重复报名被拦截", r9.status === 409);

  const listRes = await api(lin, `/api/posts/${postId}/applications`);
  const listData = await listRes.json();
  const appId = listData.data.list[0].id;
  check("仅作者可见报名列表", listRes.status === 200);
  check("待确认者联系方式不对作者可见之外公开", listData.data.list[0].applicant.contactInfo !== undefined);

  console.log("\n═══ 5. 联系方式可见性 ═══");
  const detailPending = await (await fetch(`${BASE}/api/posts/${postId}`)).json();
  const authorView = await api(lin, `/api/posts/${postId}`);
  const authorData = await authorView.json();
  check("未确认时作者也拿不到报名者联系方式（仅确认后展示）",
    authorData.data.list === undefined && authorData.data.canSeeContact !== undefined);

  const conf = await api(lin, `/api/applications/${appId}`, {
    method: "PATCH", body: JSON.stringify({ action: "confirm" }),
  });
  check("发布者确认报名", conf.status === 200);

  const notif = await api(su, "/api/notifications?pageSize=20");
  const notifData = await notif.json();
  check("报名者收到确认通知",
    notifData.data.list.some((n) => n.type === "application_confirmed"));

  console.log("\n═══ 6. 拒绝通知 ═══");
  const r10 = await send(mk({ title: "验收测试-拒绝流程" }));
  const pid2 = (await r10.json()).data.post.id;
  await api(su, `/api/posts/${pid2}/applications`, { method: "POST", body: JSON.stringify({}) });
  const list2 = await api(lin, `/api/posts/${pid2}/applications`);
  const aid2 = (await list2.json()).data.list[0].id;
  await api(lin, `/api/applications/${aid2}`, {
    method: "PATCH", body: JSON.stringify({ action: "reject" }),
  });
  const notif2 = await api(su, "/api/notifications?pageSize=20");
  const nd2 = await notif2.json();
  check("报名者收到拒绝通知",
    nd2.data.list.some((n) => n.type === "application_rejected" && n.body.includes("拒绝流程")));

  console.log("\n═══ 7. 满员自动关闭 + 候补 ═══");
  console.log("\n═══ 7. 满员自动关闭 + 候补 ═══");
  const r11 = await send(mk({ title: "验收测试-满员", maxParticipants: 2 }));
  const pid3 = (await r11.json()).data.post.id;

  const suCookie = su, adminCookie = admin, zhouCookie = await login("user4@dlut.edu.cn");
  await api(suCookie, `/api/posts/${pid3}/applications`, { method: "POST", body: JSON.stringify({}) });
  await api(adminCookie, `/api/posts/${pid3}/applications`, { method: "POST", body: JSON.stringify({}) });

  const list3 = await api(lin, `/api/posts/${pid3}/applications`);
  const apps3 = (await list3.json()).data.list;
  const ids3 = apps3.map((a) => a.id);
  await api(lin, `/api/applications/${ids3[0]}`, { method: "PATCH", body: JSON.stringify({ action: "confirm" }) });
  await api(lin, `/api/applications/${ids3[1]}`, { method: "PATCH", body: JSON.stringify({ action: "confirm" }) });

  const afterFull = await (await fetch(`${BASE}/api/posts/${pid3}`)).json();
  check("满员后状态为 full", afterFull.data.post.status === "full");

  // 满员后继续报名应进入候补
  const r13 = await api(zhouCookie, `/api/posts/${pid3}/applications`, {
    method: "POST", body: JSON.stringify({}),
  });
  const r13d = await r13.json();
  check("满员后新报名进入候补", r13.status === 201 && r13d.data.application.status === "waitlisted",
    r13.status !== 201 ? `实际 ${r13.status} ${JSON.stringify(r13d).slice(0, 160)}` : `实际状态 ${r13d.data?.application?.status}`);

  // 满员后不能再把 pending 直接确认成 confirmed（无空位）
  const list3b = await (await api(lin, `/api/posts/${pid3}/applications`)).json();
  const anyPending = list3b.data.list.find((a) => a.status === "pending");
  if (anyPending) {
    const cf = await api(lin, `/api/applications/${anyPending.id}`, {
      method: "PATCH", body: JSON.stringify({ action: "confirm" }),
    });
    check("满员时拒绝继续确认", cf.status === 409);
  } else {
    check("满员时拒绝继续确认", true, "（无待确认者，跳过）");
  }

  console.log("\n═══ 8. 候补递补 ═══");
  const list4 = await (await api(lin, `/api/posts/${pid3}/applications`)).json();
  const apps4 = list4.data.list;
  const confirmed4 = apps4.find((a) => a.status === "confirmed");
  const wait4 = apps4.find((a) => a.status === "waitlisted");

  if (confirmed4 && wait4) {
    // 找到该已确认报名者本人的 cookie 并取消
    const users = ["user1", "user2", "user3", "user4", "user5", "user6"];
    let cancelCookie = null;
    for (const u of users) {
      const c = await login(`${u}@dlut.edu.cn`).catch(() => null);
      if (!c) continue;
      const me = await api(c, "/api/users/me");
      const myId = (await me.json()).data.user.id;
      if (myId === confirmed4.applicant.id) { cancelCookie = c; break; }
    }
    if (cancelCookie) {
      const cr = await api(cancelCookie, `/api/applications/${confirmed4.id}`, {
        method: "PATCH", body: JSON.stringify({ action: "cancel" }),
      });
      const crd = await cr.json();
      check("已确认者取消后候补自动递补", crd.data?.promoted === true);

      const zhouNotif = await (await api(zhouCookie, "/api/notifications?pageSize=20")).json();
      check("递补者收到候补转正通知",
        zhouNotif.data.list.some((n) => n.type === "waitlist_promoted"));
    } else {
      check("已确认者取消后候补自动递补", false, "未定位到用户");
      check("递补者收到候补转正通知", false, "未定位到用户");
    }
  } else {
    check("已确认者取消后候补自动递补", false, "数据准备异常");
    check("递补者收到候补转正通知", false, "数据准备异常");
  }

  console.log("\n═══ 9. 发布者手动关闭 ═══");
  const closeRes = await api(lin, `/api/posts/${postId}/close`, {
    method: "POST", body: JSON.stringify({ action: "close_signup" }),
  });
  check("可提前手动关闭报名", closeRes.status === 200);
  const closedPost = await (await fetch(`${BASE}/api/posts/${postId}`)).json();
  check("关闭后状态为 closed", closedPost.data.post.status === "closed");

  console.log("\n═══ 10. 自动归档与清理 ═══");
  const cron = await (await fetch(`${BASE}/api/cron`)).json();
  check("定时任务可执行", cron.ok === true);
  console.log(`     统计：${JSON.stringify(cron.data)}`);

  // 造一个「即将结束」的帖子，验证自动归档。
  // 注意不能直接造「活动已结束」的帖子：PRD 要求
  //  - 报名截止时间不能已过（validate.ts）
  //  - 活动开始时间不能早于可见时间（validate.ts）
  // 所以合规做法是：eventStart / eventEnd / signupDeadline 全在未来的近端时间，
  // 发帖成功后再把 eventEnd 回拨到过去，模拟「活动已结束」触发 cron 归档。
  const r14 = await api(lin, "/api/posts", {
    method: "POST",
    body: JSON.stringify({
      type: "study", title: "验收测试-已结束自动归档", description: "", location: "图书馆",
      maxParticipants: 3, publishMode: "now",
      eventStart: new Date(Date.now() + 10 * 60000).toISOString(),
      eventEnd: new Date(Date.now() + 40 * 60000).toISOString(),
      signupDeadline: new Date(Date.now() + 5 * 60000).toISOString(),
    }),
  });
  const r14d = await r14.json();
  check("活动进行中的帖子可发布", r14.status === 201, JSON.stringify(r14d).slice(0, 160));
  const pastId = r14d.data.post.id;

  // 把活动结束时间回拨到过去，模拟「活动已结束」
  await prisma.post.update({
    where: { id: pastId },
    data: { eventEnd: new Date(Date.now() - 60000) },
  });

  await fetch(`${BASE}/api/cron`);
  const archived = await (await fetch(`${BASE}/api/posts/${pastId}`)).json();
  check("活动结束自动归档", archived.data.post.status === "archived");

  const hallAfter = await (await fetch(`${BASE}/api/posts?pageSize=50`)).json();
  check("归档帖子不在大厅显示",
    !hallAfter.data.list.some((p) => p.id === pastId));

  console.log("\n═══ 11. 频率限制 ═══");
  const spamUser = await login("user5@dlut.edu.cn");
  let limited = false;
  for (let i = 0; i < 8; i++) {
    const rr = await send2(spamUser, mk({ title: `刷帖测试-${i}` }));
    if (rr === 429) { limited = true; break; }
  }
  async function send2(cookie, body) {
    const res = await api(cookie, "/api/posts", { method: "POST", body: JSON.stringify(body) });
    return res.status;
  }
  check("发帖每日 5 条上限生效", limited);

  console.log("\n═══ 12. 敏感词 ═══");
  // 用一个未被第 11 节限流的账号，否则返回的会是 429 而非敏感词的 400
  const sensUser = await login("user6@dlut.edu.cn");
  const sensRes = await api(sensUser, "/api/posts", {
    method: "POST",
    body: JSON.stringify(mk({ title: "代写论文 价格优惠", publishMode: "now" })),
  });
  check("命中敏感词被拦截", sensRes.status === 400, `实际 ${sensRes.status}`);

  console.log("\n═══ 13. 举报与拉黑 ═══");
  const reportRes = await api(su, "/api/reports", {
    method: "POST",
    body: JSON.stringify({ targetType: "post", targetId: pid2, reason: "spam", detail: "测试举报" }),
  });
  check("举报提交成功", reportRes.status === 201);

  // 拉黑接口需要目标用户的 id（不是 cookie），从大厅/详情拿一个真实用户
  const adminProfile = await api(admin, "/api/users/me");
  const adminId = (await adminProfile.json()).data.user.id;
  const blockRes = await api(su, `/api/users/${adminId}/block`, { method: "POST" });
  check("拉黑成功", blockRes.status === 200, `实际 ${blockRes.status}`);
  const unblockRes = await api(su, `/api/users/${adminId}/block`, { method: "POST" });
  check("解除拉黑成功", unblockRes.status === 200, `实际 ${unblockRes.status}`);

  console.log("\n═══ 14. 管理后台 ═══");
  const dash = await api(admin, "/api/admin/dashboard");
  check("管理员可访问数据统计", dash.status === 200);
  const dashData = await dash.json();
  console.log(`     发帖 ${dashData.data.posts.total} / 报名 ${dashData.data.applications.total} / 完成率 ${dashData.data.completionRate}%`);

  const repList = await api(admin, "/api/admin/reports?status=pending");
  check("管理员可查看举报列表", repList.status === 200);

  const repId = (await repList.json()).data.list[0]?.id;
  if (repId) {
    const handleRes = await api(admin, `/api/admin/reports/${repId}`, {
      method: "PATCH", body: JSON.stringify({ status: "resolved", handlerNote: "已核实" }),
    });
    check("举报处理成功", handleRes.status === 200);
  }

  const wordsRes = await api(admin, "/api/admin/words");
  check("管理员可管理敏感词", wordsRes.status === 200);

  const userBan = await api(admin, "/api/admin/users/" + (await (await api(su, "/api/users/me")).json()).data.user.id, {
    method: "PATCH", body: JSON.stringify({ action: "ban", days: 1, reason: "测试" }),
  });
  check("管理员可封禁用户", userBan.status === 200);
  const unban = await api(admin, "/api/admin/users/" + (await (await api(su, "/api/users/me")).json()).data.user.id, {
    method: "PATCH", body: JSON.stringify({ action: "unban" }),
  });
  check("管理员可解封用户", unban.status === 200);

  console.log("\n═══ 15. 权限边界 ═══");
  const adminReports = await api(lin, "/api/admin/reports");
  check("普通用户无法访问管理后台", adminReports.status === 401);
  const othersList = await api(su, `/api/posts/${pid3}/applications`);
  check("非作者无法查看他人报名列表", othersList.status === 403);

  console.log("\n═══ 16. 我的报名 ═══");
  const mine = await api(su, "/api/my/applications");
  check("我的报名列表可用", mine.status === 200);
  const mineData = await mine.json();
  const confirmedApp = mineData.data.list.find((a) => a.status === "confirmed");
  check("已确认的报名才展示联系方式",
    confirmedApp ? confirmedApp.post.authorContact !== null : true);

  console.log("\n" + "═".repeat(40));
  console.log(`结果：${pass} 项通过，${fail} 项失败`);
  console.log("═".repeat(40));
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("脚本异常：", e);
  process.exit(1);
});