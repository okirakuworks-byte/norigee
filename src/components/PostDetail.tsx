import { useState, useEffect } from 'react';
import { fetchPostById, fetchResonancesForPosts } from '../lib/api';
import PostCard from './PostCard';
import type { FeedPost, ResonanceType } from '../lib/types';

interface PostDetailProps {
  postId: number;
}

export default function PostDetail({ postId }: PostDetailProps) {
  const [post, setPost] = useState<FeedPost | null>(null);
  const [resonances, setResonances] = useState<Record<ResonanceType, number> | undefined>();
  const [myResonance, setMyResonance] = useState<ResonanceType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const p = await fetchPostById(postId);
      if (!p) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setPost(p);

      const { counts, myResonances } = await fetchResonancesForPosts([postId]);
      setResonances(counts.get(postId));
      setMyResonance(myResonances.get(postId) ?? null);
      setLoading(false);
    }
    load();
  }, [postId]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className="bg-bg-surface border border-bg-raised rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 skeleton-shimmer rounded-full" />
            <div className="flex-1">
              <div className="h-4 skeleton-shimmer rounded w-24 mb-2" />
              <div className="h-3 skeleton-shimmer rounded w-32" />
            </div>
          </div>
          <div className="h-5 skeleton-shimmer rounded w-full mb-3" />
          <div className="h-5 skeleton-shimmer rounded w-3/4 mb-3" />
          <div className="h-5 skeleton-shimmer rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-4">
        <p className="font-['Orbitron'] text-neon-pink text-2xl font-bold tracking-widest">
          NOT FOUND
        </p>
        <p className="text-text-secondary text-sm">この投稿は見つかりませんでした</p>
        <a
          href="/home"
          className="inline-block mt-4 px-6 py-2 border border-neon-yellow/50 text-neon-yellow font-['Orbitron'] text-xs tracking-widest rounded-lg hover:bg-neon-yellow/10 transition-colors"
        >
          BACK TO ARCADE
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <a
        href="/home"
        className="text-text-muted text-xs hover:text-text-primary transition-colors mb-4 inline-flex items-center gap-1"
      >
        ← フィードに戻る
      </a>
      {post && (
        <PostCard
          post={post}
          index={0}
          featured
          initialResonances={resonances}
          initialMyResonance={myResonance}
        />
      )}
    </div>
  );
}
