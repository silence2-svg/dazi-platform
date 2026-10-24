// 种子数据：生成演示账号、帖子、报名、通知
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function at(daysFromNow: number, hour: number, durationH = 2) {
  const d = new Date(Date.now() + daysFromNow * DAY);
  d.setHours(hour, 0, 0, 0);
  const end = new Date(d.getTime() + durationH * HOUR);
  return { start: d, end };
}

async function main() {
  console.log("🌱 开始写入种子数据…");

  // ---------- 清空 ----------
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.eventReminder.deleteMany();
  await prisma.application.deleteMany();
  await prisma.post.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.block.deleteMany();
  await prisma.dailyQuota.deleteMany();
  await prisma.verifyCode.deleteMany();
  await prisma.sensitiveWord.deleteMany();
  await prisma.user.deleteMany();

  // ---------- 敏感词 ----------
  const words = [
    { word: "代写论文", action: "block" },
    { word: "刷单", action: "block" },
    { word: "代考", action: "block" },
    { word: "微商", action: "block" },
    { word: "贷款", action: "block" },
    { word: "傻逼", action: "review" },
    { word: "废物", action: "review" },
  ];
  await prisma.sensitiveWord.createMany({ data: words });
  console.log(`  ✓ 敏感词 ${words.length} 条`);

  // ---------- 用户 ----------
  const hash = bcrypt.hashSync("dazi2026", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@dlut.edu.cn",
      studentNo: "20240001",
      nickname: "平台管理员",
      passwordHash: hash,
      campus: "盘锦校区",
      college: "电信学部",
      grade: "2024",
      contactInfo: "微信 admin_dazi",
      role: "admin",
      verified: true,
      verifyMethod: "email",
      verifiedAt: new Date(),
    },
  });

  const users = await Promise.all(
    [
      { nickname: "林小满", college: "电信学部", grade: "2024", contact: "微信 linxiaoman_0421" },
      { nickname: "陈屿", college: "机械学部", grade: "2023", contact: "微信 chenyu_jx" },
      { nickname: "苏晴", college: "化工学部", grade: "2024", contact: "微信 suqing_2024" },
      { nickname: "周子昂", college: "计算机学部", grade: "2022", contact: "微信 zza_coding" },
      { nickname: "何雨桐", college: "经管学部", grade: "2024", contact: "微信 heyutong" },
      { nickname: "张浩然", college: "电信学部", grade: "2023", contact: "微信 zhanghaoran" },
    ].map((u, i) =>
      prisma.user.create({
        data: {
          email: `user${i + 1}@dlut.edu.cn`,
          studentNo: `2024${String(i + 10).padStart(4, "0")}`,
          nickname: u.nickname,
          passwordHash: hash,
          campus: "盘锦校区",
          college: u.college,
          grade: u.grade,
          contactInfo: u.contact,
          verified: true,
          verifyMethod: "email",
          verifiedAt: new Date(),
        },
      })
    )
  );

  const [lin, chen, su, zhou, he, zhang] = users;
  console.log(`  ✓ 用户 ${users.length + 1} 个（统一密码 dazi2026）`);

  // ---------- 帖子 ----------
  const posts: any[] = [];

  // 1. 明晚自习（立即发布，报名中）
  const p1 = await prisma.post.create({
    data: {
      authorId: lin.id,
      type: "study",
      title: "明晚图书馆三楼一起自习，冲考研英语",
      description:
        "打算明晚 7 点到 9 点在图书馆三楼靠窗区自习，主要过一遍英语真题作文模板。\n\n有一起的可以拼个桌，互相监督，自带笔和纸。位置有限，先到先坐。",
      location: "图书馆",
      visibleAt: new Date(Date.now() - 2 * HOUR),
      signupDeadline: new Date(Date.now() + 6 * HOUR),
      eventStart: at(1, 19, 2).start,
      eventEnd: at(1, 19, 2).end,
      maxParticipants: 4,
      status: "open",
      contactVisibility: "confirmed",
      tags: "认真,长期,安静",
    },
  });
  posts.push(p1);

  // 2. 篮球（已满）
  const p2 = await prisma.post.create({
    data: {
      authorId: chen.id,
      type: "basketball",
      title: "周六下午篮球场 3v3，缺 2 人",
      description:
        "固定球友局，打半场，随便打打出出汗。场地费 AA，每人 15 左右。\n\n水平不限，新手也欢迎，不会盖帽的。",
      location: "篮球场",
      visibleAt: new Date(Date.now() - 5 * HOUR),
      signupDeadline: new Date(Date.now() + 2 * DAY),
      eventStart: at(2, 15, 2).start,
      eventEnd: at(2, 15, 2).end,
      maxParticipants: 6,
      status: "full",
      currentConfirmed: 6,
      contactVisibility: "confirmed",
      tags: "菜鸟,招募",
    },
  });
  posts.push(p2);

  // 3. 羽毛球
  const p3 = await prisma.post.create({
    data: {
      authorId: su.id,
      type: "badminton",
      title: "周日下午羽毛球场，有没有一起的",
      description: "刚学会打球，想找人练练基本功，球拍可以借。场馆 20/h，我出。",
      location: "羽毛球场",
      visibleAt: new Date(Date.now() - 1 * HOUR),
      signupDeadline: new Date(Date.now() + 1.5 * DAY),
      eventStart: at(3, 14, 2).start,
      eventEnd: at(3, 14, 2).end,
      maxParticipants: 4,
      status: "open",
      contactVisibility: "confirmed",
      tags: "新手",
    },
  });
  posts.push(p3);

  // 4. 拼车回沈阳
  const p4 = await prisma.post.create({
    data: {
      authorId: zhou.id,
      type: "carpool",
      title: "周五晚上拼车回沈阳方向，可带 2 人",
      description:
        "周五晚 6 点从盘锦校区出发，走营口方向上高速，预计 2 小时到沈阳。\n\n高速费按人数均摊，油费也分摊，不赚任何差价。",
      location: "校门口",
      visibleAt: new Date(Date.now() - 3 * HOUR),
      signupDeadline: new Date(Date.now() + 20 * HOUR),
      eventStart: at(1, 18, 2.5).start,
      eventEnd: at(1, 18, 2.5).end,
      maxParticipants: 3,
      status: "open",
      contactVisibility: "confirmed",
      tags: "拼车",
      costNote: "预计高速费约 90 元，油费约 120 元，三人平摊约 70 元/人",
    },
  });
  posts.push(p4);

  // 5. 网球比赛（定时发布，尚未到时间）
  const p5 = await prisma.post.create({
    data: {
      authorId: zhang.id,
      type: "tournament",
      title: "院系网球双打友谊赛，报名中",
      description: "4 组双打，循环赛制。奖品自备（零食饮料）。水平不限，重在参与。",
      location: "网球馆",
      visibleAt: new Date(Date.now() + 1 * DAY), // 明天才可见
      signupDeadline: new Date(Date.now() + 3 * DAY),
      eventStart: at(5, 15, 3).start,
      eventEnd: at(5, 15, 3).end,
      maxParticipants: 8,
      status: "scheduled",
      contactVisibility: "confirmed",
      tags: "比赛,招募",
    },
  });
  posts.push(p5);

  // 6. 已结束的帖子（已归档，用于展示归档功能）
  const endedStart = at(-3, 19, 2).start;
  const endedEnd = at(-3, 19, 2).end;
  const p6 = await prisma.post.create({
    data: {
      authorId: he.id,
      type: "study",
      title: "上周日的自习搭子（已结束）",
      description: "上周日图书馆自习，活动已结束，帖子自动归档。",
      location: "图书馆自习室",
      visibleAt: new Date(Date.now() - 5 * DAY),
      signupDeadline: endedStart,
      eventStart: endedStart,
      eventEnd: endedEnd,
      maxParticipants: 4,
      status: "archived",
      archivedAt: endedEnd,
      purgeAt: new Date(endedEnd.getTime() + 30 * DAY),
      closedAt: endedStart,
      contactVisibility: "confirmed",
    },
  });
  posts.push(p6);

  console.log(`  ✓ 帖子 ${posts.length} 条`);

  // ---------- 报名 ----------
  // 帖子1：2 个已确认，1 个待确认
  await prisma.application.createMany({
    data: [
      { postId: p1.id, applicantId: su.id, message: "在的，我带英语真题", status: "confirmed", contactRevealed: true },
      { postId: p1.id, applicantId: zhou.id, message: "同蹲！", status: "confirmed", contactRevealed: true },
      { postId: p1.id, applicantId: he.id, message: "还有位置吗", status: "pending" },
    ],
  });
  await prisma.post.update({
    where: { id: p1.id },
    data: { currentConfirmed: 2, currentPending: 1 },
  });

  // 帖子2：满员 6 人（发布者 + 5 名确认）+ 1 名候补
  await prisma.application.createMany({
    data: [
      { postId: p2.id, applicantId: lin.id, status: "confirmed", contactRevealed: true },
      { postId: p2.id, applicantId: su.id, status: "confirmed", contactRevealed: true },
      { postId: p2.id, applicantId: zhou.id, status: "confirmed", contactRevealed: true },
      { postId: p2.id, applicantId: he.id, status: "confirmed", contactRevealed: true },
      { postId: p2.id, applicantId: zhang.id, status: "confirmed", contactRevealed: true },
      { postId: p2.id, applicantId: chen.id, status: "confirmed", contactRevealed: true },
      { postId: p2.id, applicantId: admin.id, message: "还有位置吗", status: "waitlisted", waitlistSeq: 1 },
    ],
  });
  await prisma.post.update({
    where: { id: p2.id },
    data: { currentConfirmed: 6, currentWaitlisted: 1 },
  });

  // 帖子3
  await prisma.application.createMany({
    data: [
      { postId: p3.id, applicantId: zhou.id, message: "我也刚学", status: "confirmed", contactRevealed: true },
      { postId: p3.id, applicantId: chen.id, status: "pending" },
    ],
  });
  await prisma.post.update({
    where: { id: p3.id },
    data: { currentConfirmed: 1, currentPending: 1 },
  });

  // 帖子4 拼车
  await prisma.application.createMany({
    data: [{ postId: p4.id, applicantId: lin.id, message: "我回沈阳，可以带我一个", status: "pending" }],
  });
  await prisma.post.update({ where: { id: p4.id }, data: { currentPending: 1 } });

  // 帖子6 已结束
  await prisma.application.createMany({
    data: [{ postId: p6.id, applicantId: zhou.id, status: "confirmed", contactRevealed: true }],
  });
  await prisma.post.update({ where: { id: p6.id }, data: { currentConfirmed: 1 } });

  console.log("  ✓ 报名记录已生成");

  // ---------- 通知 ----------
  await prisma.notification.createMany({
    data: [
      {
        userId: lin.id,
        type: "new_application",
        title: "有新的报名",
        body: "何雨桐 报名了「明晚图书馆三楼一起自习，冲考研英语」",
        link: `/post/${p1.id}/manage`,
        isRead: false,
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        userId: su.id,
        type: "application_confirmed",
        title: "报名已确认，搭子已找到！",
        body: `你已被确认参加「明晚图书馆三楼一起自习，冲考研英语」，时间：${at(1, 19, 2).start.toLocaleString("zh-CN")}。联系方式已对双方可见。`,
        link: `/post/${p1.id}`,
        isRead: false,
        createdAt: new Date(Date.now() - 2 * HOUR),
      },
      {
        userId: lin.id,
        type: "event_remind",
        title: "活动提醒：明天见",
        body: "「明晚图书馆三楼一起自习」明天 19:00 开始（图书馆）",
        link: `/post/${p1.id}`,
        isRead: false,
        createdAt: new Date(Date.now() - HOUR),
      },
      {
        userId: he.id,
        type: "waitlist_promoted",
        title: "候补转正啦！",
        body: "有人取消，「周六下午篮球场 3v3，缺 2 人」有空位，你已从候补转为确认参加",
        link: `/post/${p2.id}`,
        isRead: true,
        createdAt: new Date(Date.now() - 3 * HOUR),
      },
      {
        userId: admin.id,
        type: "system",
        title: "平台使用提示",
        body: "种子数据已生成。帖子到点会自动发布，活动结束会自动归档，30 天后清理。",
        isRead: true,
        createdAt: new Date(Date.now() - 5 * HOUR),
      },
    ],
  });
  console.log("  ✓ 通知已生成");

  // ---------- 举报示例 ----------
  await prisma.report.create({
    data: {
      reporterId: zhou.id,
      targetType: "post",
      targetPostId: p3.id,
      reason: "spam",
      detail: "感觉像广告，反复发",
    },
  });
  console.log("  ✓ 举报示例 1 条");

  console.log("\n✅ 种子数据完成！");
  console.log("\n📱 演示账号（密码统一 dazi2026）：");
  console.log("   管理员：admin@dlut.edu.cn");
  console.log("   普通用户：user1@dlut.edu.cn ~ user6@dlut.edu.cn");
}

main()
  .catch((e) => {
    console.error("❌ 种子数据失败：", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
