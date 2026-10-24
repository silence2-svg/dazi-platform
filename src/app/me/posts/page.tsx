"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Shell, { EmptyState } from "@/components/Shell";
import BottomNav from "@/components/BottomNav";
import PostCard, { PostCardData } from "@/components/PostCard";
import { get } from "@/lib/client";

export default function MyPostsPage() {
  return (
    <Suspense fallback={null}>
      <MyPostsInner />
    </Suspense>
  );
}

function MyPostsInner() {
  const params = useSearchParams();
  const scope = params.get("scope") || "mine";
  const [list, setList] = useState<PostCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<{ list: PostCardData[] }>(`/api/posts?scope=${scope}&pageSize=50`).then((r) => {
      if (r.ok) setList(r.data.list);
      setLoading(false);
    });
  }, [scope]);

  const isArchive = scope === "archived";

  return (
    <>
      <Shell title={isArchive ? "已结束 / 归档" : "我的帖子"} back hideNav>
        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={isArchive ? "🗄️" : "📝"}
            title={isArchive ? "暂无归档帖子" : "你还没有发布过帖子"}
            hint={
              isArchive
                ? "活动结束后帖子会自动归档在这里保留 30 天"
                : "发布一条帖子，约上自习、球友或拼车伙伴"
            }
          />
        ) : (
          <>
            {isArchive && (
              <p className="px-4 py-2.5 text-[12px] leading-relaxed text-slate-400">
                归档帖子不再显示在大厅，保留 30 天后自动删除。
              </p>
            )}
            <div className="divide-y divide-slate-100 bg-white">
              {list.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </>
        )}
      </Shell>
      <BottomNav />
    </>
  );
}
