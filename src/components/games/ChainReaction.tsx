import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

// --- Types ---

type Phase = 'ready' | 'memorize' | 'playing' | 'explode' | 'roundclear' | 'gameover' | 'clear';
type Level = 1 | 2 | 3;

interface Bomb {
  id: number;    // 1-based number to tap
  x: number;    // percent 0-85
  y: number;    // percent 0-80
  visible: boolean; // Lv3: hidden after memorize phase
  exploded: boolean;
}

// --- Config ---

const ROUND_CONFIGS = [
  { count: 5, level: 1 as Level, label: 'ROUND 1' },
  { count: 7, level: 1 as Level, label: 'ROUND 2' },
  { count: 9, level: 2 as Level, label: 'ROUND 3' },
  { count: 11, level: 2 as Level, label: 'ROUND 4' },
  { count: 13, level: 3 as Level, label: 'ROUND 5' },
];

const LV3_MEMORIZE_MS = 2000;
const TOTAL_ROUNDS = ROUND_CONFIGS.length;

function generateBombs(count: number): Bomb[] {
  const bombs: Bomb[] = [];
  const MARGIN = 12; // percent
  const maxX = 100 - MARGIN * 2;
  const maxY = 100 - MARGIN * 2;

  for (let i = 1; i <= count; i++) {
    // Spread out positions (retry if too close to existing)
    let x = 0, y = 0;
    let attempts = 0;
    do {
      x = MARGIN + Math.random() * maxX;
      y = MARGIN + Math.random() * maxY;
      attempts++;
      const tooClose = bombs.some((b) => Math.hypot(b.x - x, b.y - y) < 12);
      if (!tooClose) break;
    } while (attempts < 50);

    bombs.push({ id: i, x, y, visible: true, exploded: false });
  }
  return bombs;
}

export default function ChainReaction() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [roundIdx, setRoundIdx] = useState(0);
  const [bombs, setBombs] = useState<Bomb[]>([]);
  const [nextToTap, setNextToTap] = useState(1);
  const [explodedId, setExplodedId] = useState<number | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const memorizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMemorizeTimer = () => {
    if (memorizeTimerRef.current) clearTimeout(memorizeTimerRef.current);
  };

  useEffect(() => () => clearMemorizeTimer(), []);

  const currentRound = ROUND_CONFIGS[roundIdx] ?? ROUND_CONFIGS[ROUND_CONFIGS.length - 1];

  const startRound = useCallback((rIdx: number) => {
    clearMemorizeTimer();
    const config = ROUND_CONFIGS[rIdx] ?? ROUND_CONFIGS[ROUND_CONFIGS.length - 1];
    const newBombs = generateBombs(config.count);
    setBombs(newBombs);
    setNextToTap(1);
    setExplodedId(null);
    setRoundIdx(rIdx);

    if (config.level === 3) {
      setPhase('memorize');
      memorizeTimerRef.current = setTimeout(() => {
        // Hide all numbers
        setBombs((prev) => prev.map((b) => ({ ...b, visible: false })));
        setPhase('playing');
      }, LV3_MEMORIZE_MS);
    } else {
      setPhase('playing');
    }
  }, []);

  const startGame = useCallback(() => {
    setTotalScore(0);
    startRound(0);
  }, [startRound]);

  const handleTap = useCallback(
    (bomb: Bomb) => {
      if (phase !== 'playing') return;
      if (bomb.exploded) return;

      if (bomb.id !== nextToTap) {
        // Wrong tap → explode
        setExplodedId(bomb.id);
        setBombs((prev) => prev.map((b) => b.id === bomb.id ? { ...b, exploded: true } : b));
        setTimeout(() => setPhase('gameover'), 600);
        return;
      }

      // Correct tap
      setBombs((prev) =>
        prev.map((b) =>
          b.id === bomb.id ? { ...b, exploded: true } : b
        )
      );

      const allCount = bombs.length;
      if (nextToTap >= allCount) {
        // Round cleared
        const newScore = totalScore + allCount;
        setTotalScore(newScore);
        if (roundIdx + 1 >= TOTAL_ROUNDS) {
          setPhase('clear');
        } else {
          setPhase('roundclear');
        }
      } else {
        setNextToTap((n) => n + 1);
      }
    },
    [phase, bombs, nextToTap, totalScore, roundIdx]
  );

  const levelLabel: Record<Level, string> = { 1: 'LV.1 (動かない)', 2: 'LV.2 (動き回る)', 3: 'LV.3 (記憶)' };

  // Lv2: bombs move around
  const BombButton = ({ bomb }: { bomb: Bomb }) => {
    const level = currentRound.level;
    const isExploded = bomb.exploded;
    const isTarget = bomb.id === nextToTap && !isExploded;

    const motionProps =
      level === 2 && !isExploded
        ? {
            animate: {
              x: [0, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0],
              y: [0, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0],
            },
            transition: {
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }
        : {};

    if (isExploded) {
      return (
        <motion.div
          className="absolute flex items-center justify-center"
          style={{ left: `${bomb.x}%`, top: `${bomb.y}%`, transform: 'translate(-50%, -50%)' }}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 2, 0], opacity: [1, 0.5, 0] }}
          transition={{ duration: 0.4 }}
        >
          <span className="text-3xl">💥</span>
        </motion.div>
      );
    }

    return (
      <motion.button
        className={`absolute flex items-center justify-center w-10 h-10 rounded-full font-['Orbitron'] font-bold text-sm select-none
          ${isTarget ? 'bg-neon-yellow text-bg-deep shadow-[0_0_12px_rgba(255,230,0,0.6)]' : 'bg-bg-surface border border-bg-raised text-text-primary'}
          ${bomb.visible ? '' : 'text-transparent'}
          transition-colors`}
        style={{ left: `${bomb.x}%`, top: `${bomb.y}%`, transform: 'translate(-50%, -50%)' }}
        onClick={() => handleTap(bomb)}
        whileTap={{ scale: 0.85 }}
        {...motionProps}
      >
        {bomb.visible ? bomb.id : '?'}
      </motion.button>
    );
  };

  return (
    <div className="relative max-w-lg mx-auto px-4 py-8">
      {/* Danmaku comments during play */}
      {(phase === 'memorize' || phase === 'playing') && (
        <GameComments gameId="chain-reaction" mode="danmaku" />
      )}

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="💣"
              title="連鎖爆弾"
              gameId="chain-reaction"
              subtitle="1から順番にタップせよ。間違えたら爆発する。"
              controls={[{ icon: '👆', label: 'TAP', desc: '数字を順番にタップ' }]}
              rules={[
                { text: '1→2→3...と順番にボタンをタップ' },
                { text: '間違えたら即爆発 → ゲームオーバー', highlight: true },
                { text: 'Lv2: ボタンが動き回る' },
                { text: 'Lv3: 2秒表示後に全部「?」に変わる（位置を記憶せよ）' },
              ]}
              tip="全5ラウンド。ボタン数が5→7→9→11→13と増えていく。"
              buttonText="START"
              buttonColor="bg-neon-pink text-white"
              onStart={startGame}
            />
          </motion.div>
        )}

        {(phase === 'memorize' || phase === 'playing') && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="font-['Orbitron'] text-xs text-neon-pink">{currentRound.label}</span>
              <span className="font-['Orbitron'] text-xs text-text-muted">{levelLabel[currentRound.level]}</span>
              <span className="font-['Orbitron'] text-xs text-neon-yellow">
                NEXT: {nextToTap}
              </span>
            </div>

            {phase === 'memorize' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <p className="font-['Orbitron'] text-xs text-neon-yellow animate-pulse tracking-widest">
                  MEMORIZE POSITIONS...
                </p>
                <motion.div
                  className="w-full h-1 bg-neon-yellow rounded-full origin-right mt-2"
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: LV3_MEMORIZE_MS / 1000, ease: 'linear' }}
                />
              </motion.div>
            )}

            {/* Bomb field */}
            <div
              className="relative bg-bg-surface border border-bg-raised rounded-xl overflow-hidden"
              style={{ height: 320 }}
            >
              {bombs.map((bomb) => (
                <BombButton key={bomb.id} bomb={bomb} />
              ))}
            </div>

            <p className="text-text-muted text-xs text-center font-['Share_Tech_Mono']">
              残り: {bombs.filter((b) => !b.exploded).length} 個
            </p>
          </motion.div>
        )}

        {phase === 'explode' && (
          <motion.div key="explode" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4 py-8">
            <motion.p
              className="text-6xl"
              animate={{ scale: [1, 2, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
            >
              💥
            </motion.p>
          </motion.div>
        )}

        {phase === 'roundclear' && (
          <motion.div key="roundclear" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6 py-8">
            <p className="text-5xl">🔗</p>
            <p className="font-['Orbitron'] text-neon-cyan text-xl font-black">{currentRound.label} CLEAR!</p>
            <p className="text-text-muted text-sm">
              次: <span className="text-neon-pink font-bold">{ROUND_CONFIGS[roundIdx + 1]?.label}</span>
              {' '}({ROUND_CONFIGS[roundIdx + 1]?.count}個)
            </p>
            <button
              onClick={() => startRound(roundIdx + 1)}
              className="px-10 py-4 bg-neon-yellow text-bg-deep font-['Orbitron'] font-bold text-sm rounded-xl hover:shadow-[0_0_25px_rgba(255,230,0,0.5)] transition-shadow"
            >
              NEXT ROUND
            </button>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="chain-reaction"
              gameName="CHAIN REACTION"
              icon="💣"
              score={totalScore}
              level={roundIdx + 1}
              deathReason="WRONG ORDER — 連鎖爆弾: 不発"
              extraInfo={`到達: ${currentRound.label}`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}

        {phase === 'clear' && (
          <motion.div key="clear" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="chain-reaction"
              gameName="CHAIN REACTION"
              icon="💣"
              score={totalScore + bombs.length}
              level={TOTAL_ROUNDS}
              extraInfo="全5ラウンド制覇。連鎖は完成した。"
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
