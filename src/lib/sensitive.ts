import { prisma } from "./prisma";

let cache: { words: string[]; at: number } | null = null;
const TTL = 60 * 1000;

async function loadWords(): Promise<string[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.words;
  try {
    const rows = await prisma.sensitiveWord.findMany({
      where: { enabled: true },
      select: { word: true },
    });
    const words = rows.map((r) => r.word.toLowerCase()).filter(Boolean);
    cache = { words, at: Date.now() };
    return words;
  } catch {
    return [];
  }
}

export function maskSensitive(text: string, words: string[]): string {
  let out = text;
  for (const w of words) {
    if (!w) continue;
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, "*".repeat(Math.min(w.length, 4)));
  }
  return out;
}

export type SensitiveResult = { blocked: boolean; masked: string; hit?: string };

/** 敏感词过滤：block 级直接拒绝，review 级脱敏 */
export async function checkSensitive(text: string): Promise<SensitiveResult> {
  if (!text) return { blocked: false, masked: text };
  const rows = await prisma.sensitiveWord.findMany({
    where: { enabled: true },
    select: { word: true, action: true },
  });

  const lower = text.toLowerCase();
  let blocked = false;
  let hit: string | undefined;

  for (const r of rows) {
    const w = r.word.toLowerCase();
    if (w && lower.includes(w)) {
      hit = r.word;
      if (r.action === "block") {
        blocked = true;
        break;
      }
    }
  }

  if (blocked) return { blocked: true, masked: "", hit };

  const words = rows.map((r) => r.word);
  return { blocked: false, masked: maskSensitive(text, words), hit };
}
