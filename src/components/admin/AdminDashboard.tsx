import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createSupabaseBrowser } from '../../lib/supabase';

const supabase = createSupabaseBrowser();

interface Stats {
  totalUsers: number;
  totalPosts: number;
  totalGames: number;
  hiddenPosts: number;
  todayPosts: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function loadStats() {
      const today = new Date().toISOString().slice(0, 10);

      const [users, posts, hiddenPosts, todayPosts] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('posts').select('id', { count: 'exact', head: true }),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('is_hidden', true),
        supabase.from('posts').select('id', { count: 'exact', head: true }).gte('posted_at', `${today}T00:00:00`),
      ]);

      setStats({
        totalUsers: users.count ?? 0,
        totalPosts: posts.count ?? 0,
        totalGames: 27,
        hiddenPosts: hiddenPosts.count ?? 0,
        todayPosts: todayPosts.count ?? 0,
      });
    }

    loadStats();
  }, []);

  const statCards = [
    { label: 'PLAYERS', value: stats?.totalUsers ?? '---', color: 'text-neon-cyan' },
    { label: 'TOTAL POSTS', value: stats?.totalPosts ?? '---', color: 'text-neon-yellow' },
    { label: 'TODAY', value: stats?.todayPosts ?? '---', color: 'text-neon-yellow' },
    { label: 'HIDDEN', value: stats?.hiddenPosts ?? '---', color: 'text-neon-pink' },
    { label: 'GAMES', value: stats?.totalGames ?? '---', color: 'text-neon-cyan' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-bg-surface border border-bg-raised rounded-xl p-4 text-center"
          >
            <p className="font-['Orbitron'] text-[10px] text-text-muted tracking-widest mb-1">
              {card.label}
            </p>
            <p className={`font-['Share_Tech_Mono'] text-2xl font-bold ${card.color}`}>
              {stats ? (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {card.value}
                </motion.span>
              ) : (
                <span className="inline-block w-12 h-7 skeleton-shimmer rounded" />
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="/admin/topics"
          className="bg-bg-surface border border-bg-raised rounded-xl p-6 hover:border-neon-yellow/50 transition-colors group"
        >
          <p className="font-['Orbitron'] text-sm text-neon-yellow mb-1 group-hover:underline">
            お題管理
          </p>
          <p className="text-text-secondary text-xs">
            デイリーお題の作成・編集・削除
          </p>
        </a>
        <a
          href="/admin/users"
          className="bg-bg-surface border border-bg-raised rounded-xl p-6 hover:border-neon-cyan/50 transition-colors group"
        >
          <p className="font-['Orbitron'] text-sm text-neon-cyan mb-1 group-hover:underline">
            ユーザー管理
          </p>
          <p className="text-text-secondary text-xs">
            プレイヤー検索・管理者権限の付与/剥奪
          </p>
        </a>
        <a
          href="/admin/moderation"
          className="bg-bg-surface border border-bg-raised rounded-xl p-6 hover:border-neon-pink/50 transition-colors group"
        >
          <p className="font-['Orbitron'] text-sm text-neon-pink mb-1 group-hover:underline">
            モデレーション
          </p>
          <p className="text-text-secondary text-xs">
            投稿の非表示・削除・通報対応
          </p>
        </a>
      </div>
    </div>
  );
}
