import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { canDrawLottery, drawLottery, type LotteryResult, type LotteryPrize } from '../lib/wallet';

type Phase = 'checking' | 'ready' | 'spinning' | 'result' | 'already-drawn';

const PRIZE_CONFIG: Record<LotteryPrize, { label: string; color: string; ball: string; desc: string }> = {
  jackpot:      { label: '大当たり!!', color: 'text-neon-yellow', ball: '🟡', desc: '10回ゲーム券 GET!' },
  hit:          { label: '当たり!',    color: 'text-neon-cyan',   ball: '⚪', desc: '5回ゲーム券 GET!' },
  small_hit:    { label: '小当たり',   color: 'text-blue-400',    ball: '🔵', desc: '3回ゲーム券 GET!' },
  lucky:        { label: 'ラッキー',   color: 'text-neon-yellow', ball: '🟠', desc: '¥100 GET!' },
  consolation:  { label: '参加賞',     color: 'text-text-muted',  ball: '⚫', desc: '¥30...また明日！' },
};

export default function Lottery() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [result, setResult] = useState<LotteryResult | null>(null);

  useEffect(() => {
    canDrawLottery().then((can) => {
      setPhase(can ? 'ready' : 'already-drawn');
    });
  }, []);

  const draw = async () => {
    setPhase('spinning');
    // Suspense animation
    await new Promise((r) => setTimeout(r, 2000));
    const res = await drawLottery();
    if (res) {
      setResult(res);
      setPhase('result');
    } else {
      setPhase('already-drawn');
    }
  };

  const config = result ? PRIZE_CONFIG[result.prize_tier] : null;

  return (
    <div className="max-w-sm mx-auto px-4 py-8 text-center">
      <p className="font-['Orbitron'] text-[10px] text-neon-yellow tracking-[0.3em] mb-1">DAILY GACHA</p>
      <h2 className="font-['Orbitron'] text-lg font-black text-text-primary mb-6">毎日くじ引き</h2>

      <AnimatePresence mode="wait">
        {phase === 'checking' && (
          <motion.p key="check" className="text-text-muted animate-pulse">LOADING...</motion.p>
        )}

        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Gacha machine */}
            <div className="relative w-48 h-56 mx-auto bg-bg-surface border-2 border-neon-pink rounded-2xl overflow-hidden">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-28 bg-bg-deep rounded-xl border border-bg-raised flex items-center justify-center">
                <div className="flex flex-wrap gap-1 justify-center">
                  {['🟡', '⚪', '🔵', '🟠', '⚫', '🟡', '🔵', '🟠', '⚫'].map((b, i) => (
                    <motion.span
                      key={i}
                      className="text-sm"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 0.5, delay: i * 0.1, repeat: Infinity }}
                    >
                      {b}
                    </motion.span>
                  ))}
                </div>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-neon-pink rounded-full border-2 border-white" />
            </div>

            <motion.button
              onClick={draw}
              className="px-10 py-4 bg-neon-pink text-white font-['Orbitron'] font-bold text-lg rounded-xl hover:shadow-[0_0_30px_rgba(255,45,120,0.5)] transition-shadow"
              whileTap={{ rotate: -10 }}
            >
              回す！
            </motion.button>
            <p className="text-text-muted text-xs">1日1回無料</p>
          </motion.div>
        )}

        {phase === 'spinning' && (
          <motion.div key="spinning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 py-8">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
              className="text-5xl inline-block"
            >
              🎰
            </motion.div>
            <p className="font-['Orbitron'] text-text-muted animate-pulse">ガラガラ...</p>
          </motion.div>
        )}

        {phase === 'result' && config && result && (
          <motion.div key="result" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4 py-4">
            <motion.p
              className="text-6xl"
              animate={result.prize_tier === 'jackpot' ? { scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] } : { scale: [0.5, 1.2, 1] }}
              transition={{ duration: 0.5 }}
            >
              {config.ball}
            </motion.p>

            <p className={`font-['Orbitron'] text-xl font-black ${config.color}`}>
              {config.label}
            </p>
            <p className="text-text-primary text-sm">{config.desc}</p>

            {result.reward_type === 'ticket' && (
              <div className="bg-neon-yellow/10 border border-neon-yellow/30 rounded-xl px-4 py-2 inline-block">
                <p className="font-['Share_Tech_Mono'] text-neon-yellow text-sm">
                  🎟️ {result.reward_value}回ゲーム券（7日間有効）
                </p>
              </div>
            )}

            {result.prize_tier === 'jackpot' && (
              <motion.div
                className="fixed inset-0 pointer-events-none z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2 }}
              >
                <div className="absolute inset-0 bg-neon-yellow/10" />
              </motion.div>
            )}

            <a href="/home" className="inline-block px-6 py-2 bg-bg-raised text-text-secondary text-sm rounded-lg mt-4">
              BACK TO ARCADE
            </a>
          </motion.div>
        )}

        {phase === 'already-drawn' && (
          <motion.div key="drawn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 py-8">
            <p className="text-4xl">🎰</p>
            <p className="text-text-muted text-sm">今日はもう引いたよ</p>
            <p className="text-text-muted text-xs">明日の9時にリセットされます</p>
            <a href="/home" className="inline-block px-6 py-2 bg-bg-raised text-text-secondary text-sm rounded-lg">
              BACK
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
