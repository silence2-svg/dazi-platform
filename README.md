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

---

## 公网部署（Vercel，最快路径）

代码已初始化为 git 仓库，部署只需「推到 GitHub → Vercel 导入 → 填变量」三步。

### 0. 准备工作（本地，已帮你做好）

- 代码已 `git commit`，`.env` / `node_modules` / `*.db` / 运行日志均已 gitignore，**密钥不会上传**
- `.env.example` 是部署变量清单
- `npm run build` 已包含 `prisma db push`，部署时自动建表

### 1. 推到 GitHub

```bash
# 在 GitHub 网页新建一个空仓库（不要勾 README / .gitignore / License），
# 然后把下面两行里的 URL 换成你的仓库地址，执行：
git remote add origin https://github.com/你的用户名/你的仓库名.git
git branch -M main
git push -u origin main
```

> 提示：本地 `git push` 到 GitHub 需要登录。第一次会弹窗/要求 Personal Access Token（GitHub 现在不支持密码推送）。
> Token 在 GitHub → Settings → Developer settings → Personal access tokens 生成，勾 `repo` 权限即可。

### 2. Vercel 导入并配置

1. 打开 vercel.com → **Add New → Project** → 选你的 GitHub 仓库 → Import
2. Framework 会自动识别为 **Next.js**，无需改构建命令
3. 展开 **Environment Variables**，逐项填入（对照 `.env.example`）：
   - `DATABASE_URL`：托管 PostgreSQL 的连接串（见步骤 3）。**这一项必须先填好**，否则构建会因连不上库而失败
   - `SESSION_SECRET`、`NEXT_PUBLIC_VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`、`NEXT_PUBLIC_SITE_URL`：把本地 `.env` 里的对应值**原样复制**过来
   - `CRON_SECRET`：可留空（留空则 `/api/cron` 免校验）
4. 点击 **Deploy**

### 3. 准备数据库（PostgreSQL）

Vercel 的免费套餐没有数据库，需外接一个托管 Postgres（推荐 **Neon**，免费、和 Vercel 集成最好）：

1. 注册 neon.tech（可用 GitHub 登录）→ New Project → 拿到连接串
2. 连接串形如 `postgresql://user:pass@host/db?sslmode=require`，填到上面的 `DATABASE_URL`
3. 部署时 `prisma db push` 会自动把表结构推上去

> 国内访问 Neon 可能偏慢，也可换 Supabase（supabase.com，免费层同样可用）。

### 4. 写入演示数据（可选）

部署后数据库是空的（大厅为空）。想恢复演示账号和数据，在本地拉取 Vercel 环境变量后跑 seed：

```bash
npx vercel env pull .env.local   # 拉取 Vercel 上的变量到本地
# 把 .env.local 里的 DATABASE_URL 复制进 .env，然后：
npm run db:seed
```

或直接用管理员账号在线上注册、自己发帖。

### 5. 上线后注意

- Vercel 给的域名形如 `xxx.vercel.app`，**发给同学即可直接打开**（大陆访问可能偶发偏慢）
- 代码推新提交后，Vercel 会**自动重新部署**
- 定时任务：服务内置每 60 秒自动跑（`/api/cron` 由 `instrumentation.ts` 启动）。若需更可靠的兜底，可在 Vercel 用 Cron 或 GitHub Actions 定时请求你的 `/api/cron?secret=你的CRON_SECRET`

---

## 国内部署（腾讯云 CloudBase 云托管，推荐用于大陆访问）

Vercel 在大陆没有节点，国内同学经常打不开 / 响应超时。若目标用户主要在国内（如盘锦校区），推荐改用**腾讯云 CloudBase 云托管**：国内节点、访问稳定、支持 Next.js 容器化部署，且能**保留现有 Prisma + PostgreSQL 架构，业务代码零改动**。

### 1. 准备腾讯云账号

- 注册腾讯云（cloud.tencent.com）并完成**实名认证**（个人实名通常几分钟）。
- 进入「云开发 CloudBase」控制台 → 新建环境（基础版 / 按量计费均可，有免费额度）。

### 2. 部署（基于仓库的 Docker 构建）

仓库根目录已提供 `Dockerfile` 与 `.dockerignore`，云托管会据此把 Next.js 打成容器镜像：

1. 云开发控制台 → 左侧「云托管」→ 新建服务 → 选择「从代码仓库导入」（授权 GitHub / 绑定你的仓库）。
2. 构建方式选 **Docker 构建**，仓库分支选 `main`。
3. 设置**环境变量**（云托管控制台 → 服务 → 环境变量；注意 `NEXT_PUBLIC_*` 同时要在「构建环境变量」里填写，否则不会打进前端包）：
   - `DATABASE_URL`：PostgreSQL 连接串（可用 Neon / Supabase / 腾讯云 PostgreSQL，见上文数据库部分）
   - `SESSION_SECRET`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`、`NEXT_PUBLIC_SITE_URL`（后者填云托管分配到的国内域名）
4. 部署完成后，云托管会给出一个国内可访问的地址（形如 `*.apigw.tencentcs.com` 或你绑定的自定义域名）。

### 3. 数据库位置建议

- 应用部署在国内，若数据库仍在海外（Neon 美东），每次查询会跨边境、略慢但可用。
- 若要最佳体验，可把数据库也迁到国内（如腾讯云 PostgreSQL），只需改 `DATABASE_URL`，代码无需改动。

### 4. 其他

- 容器启动命令已在 Dockerfile 写好：先 `prisma db push`（幂等建表）再 `next start`，**无需手动建表**。
- 后续推新提交到 `main`，云托管可配置为自动重新部署。