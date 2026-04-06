import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getWallet, payForPlay, canPlay, FREE_PLAY_MODE } from '../../lib/wallet';
import GameComments from './GameComments';

interface Control {
  icon: string;
  label: string;
  desc: string;
}

interface Rule {
  text: string;
  highlight?: boolean;
}

interface Props {
  icon: string;
  title: string;
  subtitle: string;
  gameId?: string;
  controls: Control[];
  rules: Rule[];
  tip?: string;
  buttonText?: string;
  buttonColor?: string;
  onStart: () => void;
  freePlay?: boolean;
}

export default function GameIntro({
  icon,
  title,
  subtitle,
  gameId,
  controls,
  rules,
  tip,
  buttonText = 'START',
  buttonColor = 'bg-neon-yellow text-bg-deep',
  onStart,
  freePlay = FREE_PLAY_MODE,
}: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [inserting, setInserting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (freePlay) return;
    getWallet().then((w) => { if (w) setBalance(w.balance); });
  }, [freePlay]);

  const handleStart = async () => {
    if (freePlay) { onStart(); return; }

    setInserting(true);
    setError(null);

    const check = await canPlay();
    if (!check.canPlay) {
      setError('お小遣いが足りません！フィードで共鳴やコメントをしてコインを稼ごう。');
      setInserting(false);
      return;
    }

    const result = await payForPlay();
    if (!result.success) {
      setError(result.error ?? 'コイン消費に失敗しました');
      setInserting(false);
      return;
    }

    // Coin insert animation
    await new Promise((r) => setTimeout(r, 600));
    setInserting(false);
    onStart();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center space-y-6 py-8"
    >
      <p className="text-5xl">{icon}</p>

      <div>
        <h3 className="font-['Orbitron'] text-sm font-bold text-text-primary tracking-wider">{title}</h3>
        <p className="text-text-muted text-xs mt-1">{subtitle}</p>
      </div>

      {/* Credit display */}
      {!freePlay && balance !== null && (
        <p className={`font-['Share_Tech_Mono'] text-xs ${balance <= 100 ? 'text-neon-pink' : 'text-text-muted'}`}>
          CREDIT: ¥{balance}
        </p>
      )}

      {/* Controls */}
      <div className="flex justify-center gap-4">
        {controls.map((ctrl, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 + i * 0.1 }}
            className="bg-bg-surface border border-bg-raised rounded-xl px-4 py-3 text-center min-w-[80px]"
          >
            <p className="text-2xl mb-1">{ctrl.icon}</p>
            <p className="font-['Orbitron'] text-[9px] text-neon-cyan tracking-wider">{ctrl.label}</p>
            <p className="text-text-muted text-[10px] mt-0.5">{ctrl.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Rules */}
      <div className="max-w-xs mx-auto text-left space-y-1.5">
        {rules.map((rule, i) => (
          <motion.div
            key={i}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            className="flex items-start gap-2"
          >
            <span className={`text-xs mt-0.5 ${rule.highlight ? 'text-neon-pink' : 'text-neon-cyan'}`}>
              {rule.highlight ? '⚠' : '▸'}
            </span>
            <p className={`text-xs ${rule.highlight ? 'text-neon-pink' : 'text-text-secondary'}`}>
              {rule.text}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Tip */}
      {tip && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-text-muted text-[10px] italic"
        >
          💡 {tip}
        </motion.p>
      )}

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-4 py-2 max-w-xs mx-auto"
        >
          <p className="text-neon-pink text-xs">{error}</p>
          <a href="/home" className="text-neon-cyan text-[10px] hover:underline mt-1 inline-block">
            フィードでコインを稼ぐ →
          </a>
        </motion.div>
      )}

      {/* Start button */}
      <AnimatePresence mode="wait">
        {inserting ? (
          <motion.div
            key="inserting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <motion.p
              className="text-3xl"
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 10 }}
            >
              🪙
            </motion.p>
            <p className="font-['Orbitron'] text-neon-yellow text-xs animate-pulse">INSERT COIN...</p>
          </motion.div>
        ) : (
          <motion.button
            key="button"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={handleStart}
            disabled={inserting}
            className={`px-10 py-4 ${buttonColor} font-['Orbitron'] font-bold text-lg rounded-xl hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] transition-shadow disabled:opacity-50`}
          >
            {buttonText}
            {!freePlay && <span className="block text-[10px] font-['Share_Tech_Mono'] mt-0.5 opacity-70">¥50</span>}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Scrolling comments from other players */}
      {gameId && <GameComments gameId={gameId} mode="list" />}
    </motion.div>
  );
}
