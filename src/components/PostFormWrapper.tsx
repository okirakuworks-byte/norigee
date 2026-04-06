import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import PostForm from './PostForm';
import { createSupabaseBrowser } from '../lib/supabase';
import { fetchDailyTopic, fetchMyParticipations } from '../lib/api';
import type { DailyTopic } from '../lib/types';

type PostMode = 'select' | 'daily' | 'my' | 'free';

interface Participation {
  id: number;
  challenge_type: 'daily' | 'my';
  day_count: number;
  title: string;
}

export default function PostFormWrapper() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<PostMode>('select');
  const [dailyTopic, setDailyTopic] = useState<DailyTopic | null>(null);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [selectedParticipationId, setSelectedParticipationId] = useState<number | undefined>();
  const [challengeTitle, setChallengeTitle] = useState<string | undefined>();
  const [dailyId, setDailyId] = useState<number | undefined>();
  const [myChallengeId, setMyChallengeId] = useState<number | undefined>();

  useEffect(() => {
    async function init() {
      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.replace('/auth/login');
        return;
      }

      // Check URL params for direct access
      const params = new URLSearchParams(window.location.search);
      const dailyParam = params.get('daily');
      const myParam = params.get('my');

      if (dailyParam) {
        setDailyId(Number(dailyParam));
        setChallengeTitle('デイリーノリゲー');
        setMode('daily');
        setReady(true);
        return;
      }

      if (myParam) {
        setMyChallengeId(Number(myParam));
        setChallengeTitle('マイチャレンジ');
        setMode('my');
        setReady(true);
        return;
      }

      // Load data for selection screen
      const [topic, parts] = await Promise.all([
        fetchDailyTopic(),
        fetchMyParticipations(),
      ]);
      setDailyTopic(topic);
      setParticipations(parts);
      setReady(true);
    }

    init();
  }, []);

  if (!ready) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="font-['Share_Tech_Mono'] text-text-muted text-sm animate-pulse">LOADING...</p>
      </div>
    );
  }

  // Selection screen
  if (mode === 'select') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto space-y-4"
      >
        <p className="font-['Orbitron'] text-xs text-text-muted tracking-widest text-center mb-6">
          SELECT MODE
        </p>

        {/* Daily topic */}
        {dailyTopic && (
          <button
            onClick={() => {
              setDailyId(dailyTopic.id);
              setChallengeTitle(dailyTopic.title);
              setMode('daily');
            }}
            className="w-full text-left bg-bg-surface border border-neon-yellow/30 rounded-xl p-5 hover:border-neon-yellow/60 hover:shadow-[0_0_15px_rgba(255,230,0,0.1)] transition-all"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-neon-yellow text-sm">⚡</span>
              <span className="font-['Orbitron'] text-xs text-neon-yellow tracking-widest">DAILY STAGE</span>
            </div>
            <p className="text-text-primary text-sm font-bold">{dailyTopic.title}</p>
            <p className="text-text-muted text-xs mt-1">
              {'★'.repeat(dailyTopic.difficulty)}{'☆'.repeat(5 - dailyTopic.difficulty)}
            </p>
          </button>
        )}

        {/* My active challenges */}
        {participations.filter(p => p.challenge_type === 'my').length > 0 && (
          <div className="space-y-2">
            <p className="font-['Orbitron'] text-[10px] text-text-muted tracking-widest px-1">
              MY CHALLENGES
            </p>
            {participations
              .filter(p => p.challenge_type === 'my')
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedParticipationId(p.id);
                    setChallengeTitle(p.title);
                    setMode('my');
                  }}
                  className="w-full text-left bg-bg-surface border border-neon-cyan/20 rounded-xl p-4 hover:border-neon-cyan/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-neon-cyan text-sm">🎮</span>
                      <span className="text-text-primary text-sm">{p.title}</span>
                    </div>
                    <span className="font-['Orbitron'] text-xs text-neon-cyan">DAY {p.day_count}</span>
                  </div>
                </button>
              ))}
          </div>
        )}

        {/* New challenge */}
        <a
          href="/challenges/new"
          className="block w-full text-center bg-bg-surface border border-dashed border-bg-raised rounded-xl p-4 text-text-muted hover:border-neon-cyan/50 hover:text-neon-cyan transition-all text-sm"
        >
          + 新しいチャレンジを作る
        </a>

        {/* Free post */}
        <button
          onClick={() => {
            setChallengeTitle(undefined);
            setMode('free');
          }}
          className="w-full text-left bg-bg-surface border border-bg-raised rounded-xl p-4 hover:border-text-muted transition-all"
        >
          <div className="flex items-center gap-2">
            <span className="text-text-muted">📝</span>
            <span className="text-text-secondary text-sm">フリー投稿（チャレンジなし）</span>
          </div>
        </button>
      </motion.div>
    );
  }

  // Post form
  return (
    <div>
      <button
        onClick={() => setMode('select')}
        className="text-text-muted text-xs hover:text-text-primary transition-colors mb-4 flex items-center gap-1"
      >
        ← モード選択に戻る
      </button>
      <PostForm
        challengeTitle={challengeTitle}
        dailyId={dailyId}
        myChallengeId={myChallengeId}
      />
    </div>
  );
}
