"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Shell, { EmptyState, WechatBanner } from "@/components/Shell";
import PostCard, { PostCardData } from "@/components/PostCard";
import { get } from "@/lib/client";
import { POST_TYPES, CAMPUS_LOCATIONS } from "@/lib/constants";

export default function HallPage() {
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);

  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [when, setWhen] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [onlyNotFull, setOnlyNotFull] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (type) sp.set("type", type);
    if (location) sp.set("location", location);
    if (when) sp.set("when", when);
    if (onlyMissing) sp.set("onlyMissing", "1");
    if (onlyNotFull) sp.set("onlyNotFull", "1");
    if (keyword) sp.set("q", keyword);
    sp.set("pageSize", "30");

    const r = await get<{ list: PostCardData[] }>(`/api/posts?${sp.toString()}`);
    if (r.ok) setPosts(r.data.list);
    setLoading(false);
  }, [type, location, when, onlyMissing, onlyNotFull, keyword]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount =
    (type ? 1 : 0) + (location ? 1 : 0) + (when ? 1 : 0) + (onlyMissing ? 1 : 0) + (onlyNotFull ? 1 : 0);

  const clearAll = () => {
    setType("");
    setLocation("");
    setWhen("");
    setOnlyMissing(false);
    setOnlyNotFull(false);
  };

  return (
    <>
      <Shell hideNav>
        {/* 顶部 */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 pb-2 pt-safe">
            <div>
              <h1 className="text-[17px] font-bold text-slate-900">搭子大厅</h1>
              <p className="text-[11.5px] text-slate-400">大连理工盘锦校区</p>
            </div>
            <Link href="/me" className="text-[13px] text-slate-500">
              我的
            </Link>
          </div>

          {/* 搜索 + 筛选 */}
          <div className="flex gap-2 px-3 pb-2.5">
            <form
              className="flex flex-1 items-center gap-2 rounded-xl bg-slate-100 px-3"
              onSubmit={(e) => {
                e.preventDefault();
                setKeyword(searchInput.trim());
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-slate-400">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4.5 4.5" strokeLinecap="round" />
              </svg>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="搜索自习、篮球、拼车…"
                className="w-full bg-transparent py-2.5 text-[14px] outline-none placeholder:text-slate-400"
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(""); setKeyword(""); }} className="text-slate-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                    <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </form>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`relative flex shrink-0 items-center gap-1 rounded-xl px-3 text-[13px] font-medium transition ${
                activeCount ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              筛选
              {activeCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 px-1 text-[10px]">
                  {activeCount}
                </span>
              )}
            </button>
          </div>

          {/* 筛选面板 */}
          {filterOpen && (
            <div className="animate-fade-up space-y-3 border-t border-slate-100 px-4 py-3">
              <FilterGroup title="类型">
                <Chip active={!type} onClick={() => setType("")}>
                  全部
                </Chip>
                {POST_TYPES.map((t) => (
                  <Chip key={t.key} active={type === t.key} onClick={() => setType(type === t.key ? "" : t.key)}>
                    {t.emoji} {t.label}
                  </Chip>
                ))}
              </FilterGroup>

              <FilterGroup title="时间">
                {[
                  { k: "", l: "不限" },
                  { k: "today", l: "今天" },
                  { k: "week", l: "未来7天" },
                  { k: "upcoming", l: "即将开始" },
                ].map((t) => (
                  <Chip key={t.k} active={when === t.k} onClick={() => setWhen(t.k)}>
                    {t.l}
                  </Chip>
                ))}
              </FilterGroup>

              <FilterGroup title="地点">
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={!location} onClick={() => setLocation("")}>
                    不限
                  </Chip>
                  {CAMPUS_LOCATIONS.slice(0, 12).map((l) => (
                    <Chip key={l} active={location === l} onClick={() => setLocation(location === l ? "" : l)}>
                      {l}
                    </Chip>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup title="其他">
                <Chip active={onlyMissing} onClick={() => setOnlyMissing((v) => !v)}>
                  仅看缺人
                </Chip>
                <Chip active={onlyNotFull} onClick={() => setOnlyNotFull((v) => !v)}>
                  仅看未满
                </Chip>
              </FilterGroup>

              {activeCount > 0 && (
                <button
                  onClick={clearAll}
                  className="w-full rounded-lg py-2 text-[13px] text-slate-500 active:bg-slate-100"
                >
                  清空筛选条件
                </button>
              )}
            </div>
          )}

          {/* 已选条件标签 */}
          {activeCount > 0 && !filterOpen && (
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2">
              {type && (
                <TagChip onClear={() => setType("")}>
                  {POST_TYPES.find((t) => t.key === type)?.label}
                </TagChip>
              )}
              {when && (
                <TagChip onClear={() => setWhen("")}>
                  {{ today: "今天", week: "未来7天", upcoming: "即将开始" }[when as string]}
                </TagChip>
              )}
              {location && <TagChip onClear={() => setLocation("")}>{location}</TagChip>}
              {onlyMissing && <TagChip onClear={() => setOnlyMissing(false)}>仅看缺人</TagChip>}
              {onlyNotFull && <TagChip onClear={() => setOnlyNotFull(false)}>仅看未满</TagChip>}
            </div>
          )}
        </div>

        <WechatBanner />

        {/* 列表 */}
        <div className="divide-y divide-slate-100 bg-white">
          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={activeCount || keyword ? "没有符合条件的搭子" : "大厅还很安静"}
              hint={
                activeCount || keyword
                  ? "换个筛选条件试试，或者第一个发帖"
                  : "发布一条帖子，约上自习、球友或拼车伙伴"
              }
              action={
                <Link
                  href="/post/new"
                  className="inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-[14px] font-medium text-white"
                >
                  去发帖
                </Link>
              }
            />
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>

        {posts.length > 0 && (
          <p className="py-6 text-center text-[12px] text-slate-400">
            共 {posts.length} 条 · 活动结束自动归档，不长期堆积
          </p>
        )}
      </Shell>
      <BottomNav />
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-medium text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition ${
        active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 active:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function TagChip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-[12px] font-medium text-brand-700">
      {children}
      <button onClick={onClear} className="text-brand-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
          <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}
