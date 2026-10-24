# 搭子 · 盘锦校区轻量活动搭子平台

移动端优先的 PWA，为大连理工盘锦校区同学提供约自习、约球、拼车、组队比赛的短期活动撮合。

**无广告、无公开私信、无推荐算法。** 只做一件事：把想参加同一件事的人找到彼此。

---

## 快速开始

```bash
npm install
npm run setup      # 初始化数据库 + 写入演示数据
npm run dev        # 开发模式 http://localhost:3000
# 生产模式
npm run build && npm start
```

### 演示账号（密码统一 `dazi2026`）

| 账号 | 角色 |
|---|---|
| `admin@dlut.edu.cn` | 管理员，可进入管理后台 |
| `user1@dlut.edu.cn` ~ `user6@dlut.edu.cn` | 普通用户 |

登录支持**邮箱**或**学号**两种方式。学校邮箱（`dlut.edu.cn` / `pj.dlut.edu.cn`）注册后自动认证通过；非学校邮箱需管理员审核。

---

## 技术栈与关键决策

| 项 | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js 15 App Router + TypeScript | 页面与 API 同构部署 |
| 样式 | Tailwind CSS 3.4 | 移动端优先 |
| 数据库 | Prisma 6 + **SQLite**（默认） | 见下方「切换 PostgreSQL」 |
| 认证 | `jose` HS256 JWT + httpOnly Cookie | 自研，替代 NextAuth |
| 推送 | Web Push（VAPID） | 站内通知必达，Push 尽力而为 |
| PWA | manifest + Service Worker | 支持添加到手机桌面 |

### 为什么不用 NextAuth

NextAuth 配置复杂，且本地开发无法真实发送验证邮件，会导致「注册流程跑不通」。自研方案用 `jose` 签发 30 天有效的 httpOnly cookie，逻辑完整且开箱即用。

### 为什么默认 SQLite

为了本地零配置跑通。Schema 中所有状态字段都用 `String` 而非 Prisma `enum`，正是为了让两种数据库保持零差异。

### 切换到 PostgreSQL（生产部署只需改两处）

1. `prisma/schema.prisma`：`provider = "sqlite"` → `provider = "postgresql"`
2. `.env`：`DATABASE_URL` 换成 PostgreSQL 连接串

随后执行 `npx prisma db push && npm run db:seed`。业务代码无需任何改动。

---

## 核心业务规则实现

### 时间字段严格拆分

`Post` 表按 PRD 要求把时间拆成独立字段，不做合并：

| 字段 | 含义 |
|---|---|
| `createdAt` | 创建时间 |
| `visibleAt` | 定时可见时间 |
| `signupDeadline` | 报名截止时间 |
| `eventStart` / `eventEnd` | 活动开始 / 结束 |
| `closedAt` | 自动关闭报名时间 |
| `archivedAt` / `purgeAt` | 归档 / 物理删除时间 |

`src/lib/validate.ts` 强制校验：报名截止 ≤ 活动开始、活动结束 ≥ 活动开始、从可见到活动结束 ≤ 15 天、人数 2–50。

### 状态机

`src/lib/postStatus.ts` 的 `refreshPostStatus()` 幂等推进：

```
scheduled → open → full / closed → archived
```

满员停止**确认**流程，但仍接受报名进入**候补队列**，这样有人取消时候补者才能自动递补（PRD 第二节第 5 条）。

### 自动任务

`src/instrumentation.ts` 启动时注册 `setInterval`，每 60 秒跑一次 `runCron()`，无需 BullMQ/Redis。也可通过 `GET /api/cron` 手动触发（支持 `CRON_SECRET` 校验）。

处理六类自动化：定时发布、报名截止关闭、满员关闭、活动结束归档、归档满 30 天物理删除（有未处理举报则顺延）、活动前 1 天 / 1 小时提醒。

### 内容安全（先发后审）

- **敏感词**：block 级直接拒绝，review 级脱敏
- **频率限制**：`DailyQuota` 表按 UTC+8 日期键计数（发帖 5 / 报名 20 / 留言 50）
- **举报与拉黑**：拉黑关系双向生效，被拉黑者无法报名、留言、查看联系方式
- **管理后台**：数据概览、举报处理（含下架 / 封禁动作）、敏感词管理、用户封禁解封

### 联系方式可见性

三档 `private | confirmed | public`，默认 `confirmed`。**仅在存在已确认的报名关系时双向可见**，未确认时连发布者本人都看不到报名者的联系方式。

---

## 目录结构

```
src/
├── app/
│   ├── (hall|post|me|admin|pages)/   18 个页面
│   └── api/                           17 个 API 路由
├── lib/
│   ├── constants.ts   业务常量单一来源
│   ├── validate.ts    发帖时间校验
│   ├── postStatus.ts  状态机 + 满员/候补判定
│   ├── cron.ts        六类自动任务
│   ├── auth.ts        JWT 会话
│   ├── notify.ts      站内通知（必达）
│   └── push.ts        Web Push（尽力而为）
└── instrumentation.ts 定时任务注册

prisma/schema.prisma   数据模型
scripts/e2e.mjs        45 项端到端验收
```

---

## 验收

```bash
npm run build
npm start          # 另开一个终端
node scripts/e2e.mjs
```

`scripts/e2e.mjs` 会在运行前自动重置数据库（因为产品内置的频率限制会让脚本第二次运行全部 429），然后逐条验证 PRD 第十节的验收标准。

当前状态：**45 项通过，0 项失败**，覆盖 16 个场景组：认证、时间校验、发帖、报名状态机、联系方式可见性、拒绝通知、满员候补、候补递补、手动关闭、自动归档、频率限制、敏感词、举报拉黑、管理后台、权限边界、我的报名。

---

## PWA 与通知说明

- **添加到桌面**：`manifest.json` + Service Worker，静态资源 cache-first，页面导航 network-first，API 不缓存，离线回退 `/offline`
- **Web Push**：iOS 需先添加到主屏幕才能授权；站内通知始终可用，不依赖 Push
- **微信内置浏览器**：页面会提示用外部浏览器打开

## 上线前必读

- 大陆服务器需完成**ICP 备案**并启用 **HTTPS**（Service Worker 与 Web Push 均要求安全上下文，`localhost` 除外）
- 拼车功能仅撮合，**禁止盈利**，已在帖子发布页与免责声明中明示
- 运动类活动风险自担，已在用户协议与免责声明中明示