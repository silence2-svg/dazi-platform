import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { checkSensitive } from "@/lib/sensitive";

export const dynamic = "force-dynamic";

/** GET /api/admin/words —— 敏感词列表 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return unauthorized("需要管理员权限");

  const list = await prisma.sensitiveWord.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, word: true, action: true, enabled: true, createdAt: true },
  });

  return ok({ list });
}

/** POST /api/admin/words —— 新增敏感词 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized("需要管理员权限");

  let body: { word?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误");
  }

  const word = String(body.word || "").trim();
  if (!word) return fail("请输入敏感词");
  if (word.length > 30) return fail("敏感词过长");

  const action = body.action === "review" ? "review" : "block";

  const exists = await prisma.sensitiveWord.findUnique({ where: { word } });
  if (exists) return fail("该敏感词已存在", 409);

  const item = await prisma.sensitiveWord.create({
    data: { word, action },
    select: { id: true, word: true, action: true, enabled: true },
  });

  return ok({ item, message: "已添加" }, 201);
}

/** DELETE /api/admin/words?id=xxx */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return unauthorized("需要管理员权限");

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("缺少 id");

  await prisma.sensitiveWord.deleteMany({ where: { id } });
  return ok({ message: "已删除" });
}
