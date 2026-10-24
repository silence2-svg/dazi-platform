# 腾讯云 CloudBase 云托管（容器）部署镜像
# 适用于 Next.js 15 App Router（SSR + API 路由），保留 Prisma + PostgreSQL 架构。

FROM node:22-slim

WORKDIR /app

# Prisma 引擎依赖 openssl；ca-certificates 用于 HTTPS 对外请求
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 先安装依赖（利用 Docker 缓存层）
COPY package.json package-lock.json ./
RUN npm ci

# 复制源码并构建
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建（注意：建表放在运行时，避免构建期强依赖数据库连通性）
RUN npx next build

ENV NODE_ENV=production
EXPOSE 3000

# 启动：先确保数据库表结构（prisma db push 幂等），再启动 Next 服务。
# CloudBase 会注入 PORT 环境变量；未注入时回退到 3000。
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx next start -p ${PORT:-3000} -H 0.0.0.0"]
