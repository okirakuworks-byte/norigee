import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { postGameScore, fetchLeaderboard, type GameScoreResult } from '../../lib/api';

interface LeaderboardEntry {
  score: number;
  level: number;
  death_reason: string | null;
  profiles: { display_name: string; avatar_url: string | null };
}

interface Props {
  gameId: string;
  gameName: string;
  icon: string;
  score: number;
  level: number;
  deathReason?: string;
  extraInfo?: string;
  onRetry: () => void;
}

type Step = 'scream' | 'posted';

// Placeholder suggestions based on result
const SCREAM_PLACEHOLDERS = {
  fail: [
    'これ無理ゲーじゃん！！',
    'あー！また失敗した！バカ野郎！',
    'あとちょっとだったのに...',
    '誰だこのゲーム作ったやつ',
    '指が言うこと聞かない',
    'もう1回...もう1回だけ...',
  ],
  clear: [
    'やった！！！ついに！！！',
    'できた...震えてる...',
    '天才かもしれない',
    'これ才能じゃん',
  ],
};

function randomPlaceholder(isCleared: boolean): string {
  const pool = isCleared ? SCREAM_PLACEHOLDERS.clear : SCREAM_PLACEHOLDERS.fail;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function GameResult({
  gameId,
  gameName,
  icon,
  score,
  level,
  deathReason,
  extraInfo,
  onRetry,
}: Props) {
  const [step, setStep] = useState<Step>('scream');
  const [scream, setScream] = useState('');
  const [result, setResult] = useState<GameScoreResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isCleared = !deathReason;
  const [placeholder] = useState(() => randomPlaceholder(isCleared));

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 500);
  }, []);

  const submitScream = async () => {
    setPosting(true);

    // Post score + scream to feed
    const { data } = await postGameScore(
      gameId,
      gameName,
      score,
      level,
      deathReason,
      scream.trim() || undefined
    );
    if (data) setResult(data);

    const { scores } = await fetchLeaderboard(gameId);
    setLeaderboard(scores as unknown as LeaderboardEntry[]);

    setPosting(false);
    setStep('posted');
  };

  // Skip scream (post without comment)
  const skipScream = async () => {
    setPosting(true);
    const { data } = await postGameScore(gameId, gameName, score, level, deathReason);
    if (data) setResult(data);
    const { scores } = await fetchLeaderboard(gameId);
    setLeaderboard(scores as unknown as LeaderboardEntry[]);
    setPosting(false);
    setStep('posted');
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="text-center space-y-4 py-6"
    >
      {/* Icon + Result */}
      <motion.p
        className="text-5xl"
        animate={isCleared ? { scale: [1, 1.3, 1] } : { rotate: [0, 10, -10, 0] }}
        transition={{ duration: 0.5 }}
      >
        {isCleared ? '🏆' : icon}
      </motion.p>

      <p className={`font-['Orbitron'] font-bold text-lg ${isCleared ? 'text-neon-cyan' : 'text-neon-pink'}`}>
        {isCleared ? 'CLEAR!' : deathReason}
      </p>

      {/* Score */}
      <div className="bg-bg-surface rounded-xl p-4 inline-block">
        <p className="font-['Orbitron'] text-3xl font-black text-neon-yellow">{score}</p>
        <p className="text-text-muted text-xs">Lv.{level}{extraInfo ? ` | ${extraInfo}` : ''}</p>
      </div>

      <AnimatePresence mode="wait">
        {step === 'scream' && (
          <motion.div
            key="scream"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="max-w-sm mx-auto space-y-3"
          >
            {/* Scream input */}
            <p className="font-['Orbitron'] text-[10px] text-neon-yellow tracking-widest">
              {isCleared ? 'VICTORY SCREAM' : 'DEATH SCREAM'}
            </p>
            <textarea
              ref={inputRef}
              value={scream}
              onChange={(e) => setScream(e.target.value)}
              placeholder={placeholder}
              maxLength={200}
              rows={2}
              className="w-full px-4 py-3 bg-bg-deep border border-bg-raised rounded-lg text-text-primary text-sm placeholder:text-text-muted/50 focus:border-neon-yellow focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={submitScream}
                disabled={posting}
                className="flex-1 py-3 bg-neon-yellow text-bg-deep font-['Orbitron'] text-sm font-bold rounded-lg disabled:opacity-50"
              >
                {posting ? 'POSTING...' : '叫ぶ！'}
              </button>
              <button
                onClick={skipScream}
                disabled={posting}
                className="px-4 py-3 bg-bg-raised text-text-muted text-xs rounded-lg disabled:opacity-50"
              >
                SKIP
              </button>
            </div>
          </motion.div>
        )}

        {step === 'posted' && (
          <motion.div
            key="posted"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="space-y-4"
          >
            {/* Posted confirmation */}
            {scream && (
              <div className="bg-bg-surface border border-bg-raised rounded-xl px-4 py-3 max-w-sm mx-auto">
                <p className="text-text-primary text-sm">「{scream}」</p>
              </div>
            )}

            {/* Rank info */}
            {result && (
              <div className="space-y-1">
                {result.rank && (
                  <p className="font-['Share_Tech_Mono'] text-neon-cyan text-xs">
                    RANK #{result.rank}
                  </p>
                )}
                {result.isHighScore && (
                  <p className="text-neon-yellow text-xs animate-pulse font-bold">
                    NEW HIGH SCORE!
                  </p>
                )}
              </div>
            )}

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div className="text-left max-w-xs mx-auto">
                <p className="font-['Orbitron'] text-[10px] text-text-muted tracking-widest mb-2 text-center">
                  TOP {Math.min(5, leaderboard.length)}
                </p>
                <div className="space-y-1">
                  {leaderboard.slice(0, 5).map((entry, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                        i === 0 ? 'bg-neon-yellow/10 border border-neon-yellow/30' : 'bg-bg-surface/50'
                      }`}
                    >
                      <span className="font-['Orbitron'] text-text-muted w-5">
                        {i === 0 ? '👑' : `#${i + 1}`}
                      </span>
                      {entry.profiles?.avatar_url ? (
                        <img src={entry.profiles.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-bg-raised" />
                      )}
                      <span className="text-text-primary flex-1 truncate">
                        {entry.profiles?.display_name ?? '?'}
                      </span>
                      <span className="font-['Share_Tech_Mono'] text-neon-cyan">{entry.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 justify-center pt-2">
              <button
                onClick={onRetry}
                className={`px-8 py-3 font-['Orbitron'] text-sm font-bold rounded-lg ${
                  isCleared ? 'bg-neon-cyan text-bg-deep' : 'bg-neon-pink text-white'
                }`}
              >
                RETRY
              </button>
              <a
                href="/games"
                className="px-8 py-3 bg-bg-raised text-text-secondary text-sm rounded-lg inline-flex items-center"
              >
                ARCADE
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
