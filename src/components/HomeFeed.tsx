import { useState, useEffect } from 'react';
import DailyStage from './DailyStage';
import PostCard from './PostCard';
import { fetchDailyTopic, fetchFeed } from '../lib/api';
import type { DailyTopic, FeedPost } from '../lib/types';

// Mock data for development when DB is empty
const MOCK_DAILY_TOPIC: DailyTopic = {
  id: 1,
  title: '利き手じゃない方で自画像を描け',
  description: '制限時間内に、利き手ではない方の手で自分の顔を描いてください。どんなにひどくても投稿すること。',
  difficulty: 4,
  time_limit_seconds: 180,
  status: 'active',
  scheduled_date: null,
  tags: [],
};

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
    profiles: { username: 'tanaka_sake', display_name: 'たなか', avatar_url: null },
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
    profiles: { username: 'yamada_run', display_name: 'やまだ', avatar_url: null },
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
    profiles: { username: 'art_novice', display_name: 'えかきビギナー', avatar_url: null },
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
    profiles: { username: 'early_bird_fail', display_name: '朝活挫折マン', avatar_url: null },
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
    profiles: { username: 'tanaka_sake', display_name: 'たなか', avatar_url: null },
    challenge_title: '完璧なだし巻き卵への道',
    challenge_type: 'my',
  },
];

export default function HomeFeed() {
  const [topic, setTopic] = useState<DailyTopic | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [dailyTopic, feedResult] = await Promise.all([
        fetchDailyTopic(),
        fetchFeed(),
      ]);

      // Fall back to mock data in dev when DB is empty
      const isDev = import.meta.env.DEV;
      setTopic(dailyTopic ?? (isDev ? MOCK_DAILY_TOPIC : null));
      setPosts(feedResult.posts.length > 0 ? feedResult.posts : (isDev ? MOCK_POSTS : []));
      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="bg-bg-surface border border-bg-raised rounded-2xl p-8 animate-pulse">
          <div className="h-6 bg-bg-raised rounded w-1/3 mb-4" />
          <div className="h-4 bg-bg-raised rounded w-2/3" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-surface border border-bg-raised rounded-2xl p-6 animate-pulse">
              <div className="h-4 bg-bg-raised rounded w-3/4 mb-3" />
              <div className="h-4 bg-bg-raised rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* TODAY'S STAGE */}
      <section>
        <DailyStage topic={topic} />
      </section>

      {/* Feed */}
      <section>
        <h2 className="font-['Orbitron'] text-xs text-text-muted tracking-widest mb-4">
          EVERYONE'S STRUGGLE
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map((post, i) => (
            <PostCard key={post.id} post={post} index={i} />
          ))}
        </div>

        {posts.length === 0 && (
          <div className="text-center py-12">
            <p className="font-['Orbitron'] text-text-muted text-sm">NO RECORDS YET</p>
            <p className="text-text-muted text-xs mt-2">最初のチャレンジャーになれ</p>
          </div>
        )}
      </section>
    </div>
  );
}
