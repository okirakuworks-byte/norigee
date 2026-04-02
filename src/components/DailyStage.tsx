import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface DailyTopic {
  id: number;
  title: string;
  description: string;
  difficulty: number;
  time_limit_seconds: number;
  status: string;
}

interface Props {
  topic: DailyTopic | null;
}

export default function DailyStage({ topic }: Props) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [challengers, setChallengers] = useState(0);
  const [clearRate, setClearRate] = useState<number | null>(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);

  useEffect(() => {
    if (!topic) return;

    // Timer
    const updateTimer = () => {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      const remaining = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
      setTimeLeft(remaining);
      setIsUrgent(remaining < 3600);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    // Fetch stats
    const fetchStats = async () => {
      // Count challengers
      const { count: total } = await supabase
        .from('participations')
        .select('id', { count: 'exact', head: true })
        .eq('challenge_type', 'daily')
        .eq('daily_topic_id', topic.id);

      setChallengers(total ?? 0);

      // Clear rate from posts
      const { data: posts } = await supabase
        .from('posts')
        .select('result')
        .eq('participation_id', topic.id);

      if (posts && posts.length > 0) {
        const clears = posts.filter((p) => p.result === 'success').length;
        setClearRate(Math.round((clears / posts.length) * 100));
      }

      // Check if current user already played
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: myPart } = await supabase
          .from('participations')
          .select('id')
          .eq('user_id', user.id)
          .eq('challenge_type', 'daily')
          .eq('daily_topic_id', topic.id)
          .maybeSingle();
        setAlreadyPlayed(!!myPart);
      }
    };
    fetchStats();

    return () => clearInterval(interval);
  }, [topic]);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!topic) {
    return (
      <div className="bg-bg-surface border border-bg-raised rounded-2xl p-8 text-center">
        <p className="text-text-muted font-['Orbitron'] text-sm">NO STAGE TODAY</p>
        <p className="text-text-muted text-xs mt-2">今日のお題はまだ設定されていません</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      {isUrgent && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              '0 0 0px rgba(255, 45, 120, 0)',
              '0 0 40px rgba(255, 45, 120, 0.6)',
              '0 0 0px rgba(255, 45, 120, 0)',
            ],
          }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}

      <div className="bg-bg-surface border border-bg-raised rounded-2xl overflow-hidden shadow-[inset_0_0_60px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <div className="bg-bg-raised px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-['Orbitron'] text-xs text-neon-yellow tracking-widest">
              TODAY'S STAGE
            </span>
            <span className="text-neon-pink text-xs">
              {'★'.repeat(topic.difficulty)}{'☆'.repeat(5 - topic.difficulty)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-text-muted font-['Share_Tech_Mono']">
            <span>👥 {challengers}</span>
            {clearRate !== null && (
              <span className={clearRate <= 20 ? 'text-neon-pink' : 'text-neon-cyan'}>
                CLEAR: {clearRate}%
              </span>
            )}
          </div>
        </div>

        {/* Stage content */}
        <div className="p-6 space-y-4">
          <h2 className="font-['Orbitron'] text-2xl font-bold text-text-primary leading-tight">
            {topic.title}
          </h2>

          {topic.description && (
            <p className="text-text-secondary text-sm leading-relaxed">
              {topic.description}
            </p>
          )}

          {/* Stats bar */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-text-muted">制限:</span>
              <span className="font-['Orbitron'] text-neon-yellow">
                {topic.time_limit_seconds >= 86400
                  ? '24h'
                  : topic.time_limit_seconds >= 3600
                  ? `${Math.floor(topic.time_limit_seconds / 3600)}h`
                  : topic.time_limit_seconds >= 60
                  ? `${Math.floor(topic.time_limit_seconds / 60)}min`
                  : `${topic.time_limit_seconds}sec`}
              </span>
            </div>

            <span className="font-['Orbitron'] text-neon-cyan text-[10px]">
              REWARD: ¥50
            </span>

            {timeLeft !== null && (
              <span
                className={`font-['Share_Tech_Mono'] text-lg tracking-widest ${
                  isUrgent ? 'text-neon-pink animate-pulse' : 'text-neon-cyan'
                }`}
              >
                {formatTime(timeLeft)}
              </span>
            )}
          </div>
        </div>

        {/* Play button */}
        <div className="px-6 pb-6">
          {alreadyPlayed ? (
            <div className="w-full py-3 bg-bg-raised text-neon-cyan font-['Orbitron'] font-bold text-center rounded-lg text-sm">
              ✓ CHALLENGED
            </div>
          ) : (
            <a
              href={`/posts/new?daily=${topic.id}`}
              className="block w-full py-3 bg-neon-yellow text-bg-deep font-['Orbitron'] font-bold text-center rounded-lg hover:shadow-[0_0_30px_rgba(255,230,0,0.5)] transition-shadow"
            >
              ▶ CHALLENGE
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
