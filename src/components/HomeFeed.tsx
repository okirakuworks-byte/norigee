import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import HeroCard from './HeroCard';
import LiveTicker from './LiveTicker';
import DailyBanner from './DailyBanner';
import PostCard from './PostCard';
import { fetchFeed, fetchResonancesForPosts } from '../lib/api';
import type { FeedSortOrder, ResonanceCounts } from '../lib/api';
import type { FeedPost, ResonanceType } from '../lib/types';

// Mock data for development when DB is empty
const MOCK_POSTS: FeedPost[] = [
  {
    id: 1,
    content: 'また焦げた。もう204回焦げてる。でも昨日よりマシな気がする。気がするだけ。',
    result: 'failure',
    day_number: 204,
    posted_at: '2026-03-31T10:00:00Z',
    resonance_count: 23,
    comment_count: 8,
    image_keys: [],
    profiles: { username: 'tanaka_sake', display_name: 'たなか', avatar_url: null, avatar_emoji: '🐱' },
    challenge_title: '完璧なだし巻き卵への道',
    challenge_type: 'my',
  },
  {
    id: 2,
    content: '今日は500m走って死んだ。42.195kmって誰が決めたんだ。',
    result: 'failure',
    day_number: 3,
    posted_at: '2026-03-31T09:30:00Z',
    resonance_count: 156,
    comment_count: 41,
    image_keys: [],
    profiles: { username: 'yamada_run', display_name: 'やまだ', avatar_url: null, avatar_emoji: '🐶' },
    challenge_title: 'フルマラソン完走（運動歴ゼロ）',
    challenge_type: 'my',
  },
  {
    id: 3,
    content: '顔...？これ顔なのか...？左手よ、お前には失望した。',
    result: 'failure',
    day_number: 1,
    posted_at: '2026-03-31T11:00:00Z',
    resonance_count: 89,
    comment_count: 15,
    image_keys: [],
    profiles: { username: 'art_novice', display_name: 'えかきビギナー', avatar_url: null, avatar_emoji: '🦊' },
    challenge_title: '利き手じゃない方で自画像を描け',
    challenge_type: 'daily',
  },
  {
    id: 4,
    content: '5時に目覚ましが鳴った。止めた。起きたら9時だった。Day 4、二度寝の勝利。',
    result: 'failure',
    day_number: 4,
    posted_at: '2026-03-31T09:00:00Z',
    resonance_count: 312,
    comment_count: 67,
    image_keys: [],
    profiles: { username: 'early_bird_fail', display_name: '朝活挫折マン', avatar_url: null, avatar_emoji: '🐧' },
    challenge_title: '毎日5時起き生活',
    challenge_type: 'my',
  },
  {
    id: 5,
    content: 'やった！！！ついに！！！204日目にして！！！完璧なだし巻きが！！！焼けた！！！泣いてる！！！',
    result: 'success',
    day_number: 205,
    posted_at: '2026-03-31T08:00:00Z',
    resonance_count: 1847,
    comment_count: 423,
    image_keys: [],
    profiles: { username: 'tanaka_sake', display_name: 'たなか', avatar_url: null, avatar_emoji: '🐱' },
    challenge_title: '完璧なだし巻き卵への道',
    challenge_type: 'my',
  },
];

const TABS: { key: FeedSortOrder; label: string }[] = [
  { key: 'hot', label: 'HOT' },
  { key: 'new', label: 'NEW' },
];

/** Threshold to consider a post "featured" (col-span-2) */
const FEATURED_RESONANCE_THRESHOLD = 100;
const FEATURED_COMMENT_THRESHOLD = 20;

function isFeatured(post: FeedPost): boolean {
  return (
    post.resonance_count >= FEATURED_RESONANCE_THRESHOLD ||
    post.comment_count >= FEATURED_COMMENT_THRESHOLD
  );
}

export default function HomeFeed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [resonanceMap, setResonanceMap] = useState<Map<number, ResonanceCounts>>(new Map());
  const [myResonanceMap, setMyResonanceMap] = useState<Map<number, ResonanceType | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<FeedSortOrder>('hot');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadFeed = async (order: FeedSortOrder) => {
    setLoading(true);
    setHasMore(true);
    setNextCursor(null);
    const feedResult = await fetchFeed(undefined, 20, order);

    const isDev = import.meta.env.DEV;
    const feedPosts = feedResult.posts.length > 0
      ? feedResult.posts
      : (isDev ? MOCK_POSTS : []);

    const postIds = feedPosts.map((p) => p.id);
    const { counts: rMap, myResonances } = await fetchResonancesForPosts(postIds);
    setResonanceMap(rMap);
    setMyResonanceMap(myResonances);

    setPosts(feedPosts);
    setNextCursor(feedResult.nextCursor);
    setHasMore(feedResult.nextCursor !== null);
    setLoading(false);
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || nextCursor === null) return;
    setLoadingMore(true);

    const feedResult = await fetchFeed(nextCursor, 20, activeTab);

    if (feedResult.posts.length > 0) {
      const newPostIds = feedResult.posts.map((p) => p.id);
      const { counts: newRMap, myResonances: newMyR } = await fetchResonancesForPosts(newPostIds);
      setResonanceMap((prev) => {
        const merged = new Map(prev);
        for (const [k, v] of newRMap) merged.set(k, v);
        return merged;
      });
      setMyResonanceMap((prev) => {
        const merged = new Map(prev);
        for (const [k, v] of newMyR) merged.set(k, v);
        return merged;
      });
      setPosts((prev) => [...prev, ...feedResult.posts]);
    }

    setNextCursor(feedResult.nextCursor);
    setHasMore(feedResult.nextCursor !== null);
    setLoadingMore(false);
  }, [loadingMore, hasMore, nextCursor, activeTab]);

  useEffect(() => {
    loadFeed(activeTab);
  }, [activeTab]);

  // Infinite scroll: IntersectionObserver on sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Pick hero: highest resonance post
  const heroPost = posts.length > 0
    ? posts.reduce((best, p) => p.resonance_count > best.resonance_count ? p : best, posts[0])
    : null;

  // Feed posts: exclude hero
  const feedPosts = heroPost
    ? posts.filter((p) => p.id !== heroPost.id)
    : posts;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Ticker skeleton */}
        <div className="h-8 skeleton-shimmer rounded" />
        {/* Hero skeleton */}
        <div className="bg-bg-surface border border-bg-raised rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 skeleton-shimmer rounded-full" />
            <div className="flex-1">
              <div className="h-4 skeleton-shimmer rounded w-24 mb-2" />
              <div className="h-3 skeleton-shimmer rounded w-32" />
            </div>
          </div>
          <div className="h-5 skeleton-shimmer rounded w-2/3 mb-3" />
          <div className="h-5 skeleton-shimmer rounded w-1/2" />
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-surface border border-bg-raised rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 skeleton-shimmer rounded-full" />
                <div className="h-3 skeleton-shimmer rounded w-20" />
              </div>
              <div className="h-4 skeleton-shimmer rounded w-3/4 mb-2" />
              <div className="h-4 skeleton-shimmer rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Live Ticker */}
      <LiveTicker posts={posts} />

      {/* Hero Card */}
      {heroPost && <HeroCard post={heroPost} />}

      {/* Daily Stage Banner */}
      <DailyBanner />

      {/* Feed Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-bg-raised pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2 font-['Orbitron'] text-xs tracking-widest rounded-t-lg transition-colors ${
              activeTab === tab.key
                ? 'text-neon-yellow font-bold'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-1 right-1 h-0.5 bg-neon-yellow rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
        <span className="ml-auto font-['Share_Tech_Mono'] text-text-muted text-[10px]">
          {posts.length} posts
        </span>
      </div>

      {/* Feed Grid — uneven layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {feedPosts.map((post, i) => (
          <motion.div
            key={post.id}
            className={isFeatured(post) ? 'md:col-span-2' : ''}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
          >
            <PostCard
              post={post}
              index={i}
              featured={isFeatured(post)}
              initialResonances={resonanceMap.get(post.id)}
              initialMyResonance={myResonanceMap.get(post.id) ?? null}
            />
          </motion.div>
        ))}
      </div>

      {feedPosts.length === 0 && !heroPost && (
        <div className="text-center py-16 space-y-4">
          <p className="font-['Orbitron'] text-text-muted text-2xl tracking-widest">NO RECORDS YET</p>
          <p className="text-text-secondary text-sm">まだ誰もチャレンジしていない。最初のプレイヤーになれ。</p>
          <div className="flex justify-center gap-3 mt-6">
            <a
              href="/posts/new"
              className="px-6 py-2.5 bg-neon-yellow text-bg-deep font-['Orbitron'] text-xs font-bold tracking-widest rounded-lg neon-glow-yellow hover:shadow-[0_0_30px_rgba(255,230,0,0.5)] transition-shadow"
            >
              INSERT COIN
            </a>
            <a
              href="/games"
              className="px-6 py-2.5 border border-neon-cyan/50 text-neon-cyan font-['Orbitron'] text-xs tracking-widest rounded-lg hover:bg-neon-cyan/10 transition-colors"
            >
              GAMES →
            </a>
          </div>
        </div>
      )}

      {/* Infinite scroll sentinel + loading */}
      {!loading && hasMore && (
        <div ref={sentinelRef} className="py-6">
          {loadingMore && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-bg-surface border border-bg-raised rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 skeleton-shimmer rounded-full" />
                    <div className="h-3 skeleton-shimmer rounded w-20" />
                  </div>
                  <div className="h-4 skeleton-shimmer rounded w-3/4 mb-2" />
                  <div className="h-4 skeleton-shimmer rounded w-1/2" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && !hasMore && posts.length > 0 && (
        <p className="text-center text-text-muted text-xs font-['Orbitron'] tracking-widest py-6">
          END OF FEED
        </p>
      )}
    </div>
  );
}
