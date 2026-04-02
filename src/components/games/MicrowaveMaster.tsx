import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

interface Food {
  name: string;
  emoji: string;
  speedCurve: 'linear' | 'explosive' | 'slow-start' | 'wave';
  targetZone: [number, number]; // % range
}

const FOODS: Food[] = [
  { name: 'ごはん', emoji: '🍚', speedCurve: 'linear', targetZone: [60, 70] },
  { name: 'カレー', emoji: '🍛', speedCurve: 'slow-start', targetZone: [65, 75] },
  { name: '卵', emoji: '🥚', speedCurve: 'explosive', targetZone: [40, 48] },
  { name: '牛乳', emoji: '🥛', speedCurve: 'wave', targetZone: [55, 63] },
  { name: 'グラタン', emoji: '🧀', speedCurve: 'slow-start', targetZone: [70, 78] },
  { name: 'おにぎり', emoji: '🍙', speedCurve: 'linear', targetZone: [50, 58] },
  { name: 'ピザ', emoji: '🍕', speedCurve: 'wave', targetZone: [62, 70] },
  { name: '弁当', emoji: '🍱', speedCurve: 'explosive', targetZone: [45, 52] },
];

type Phase = 'ready' | 'heating' | 'result' | 'exploded' | 'gameover';

export default function MicrowaveMasterGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [food, setFood] = useState<Food | null>(null);
  const [heat, setHeat] = useState(0); // 0-100
  const [hideGauge, setHideGauge] = useState(false);
  const [result, setResult] = useState<'perfect' | 'cold' | 'hot' | null>(null);
  const [streak, setStreak] = useState(0);
  const frameRef = useRef<number>();
  const startRef = useRef(0);
  const heatRef = useRef(0);

  const getDifficulty = useCallback(() => {
    if (round >= 4) return 3;
    if (round >= 2) return 2;
    return 1;
  }, [round]);

  const getSpeed = useCallback((t: number, curve: Food['speedCurve']): number => {
    const base = 0.3 + round * 0.05;
    switch (curve) {
      case 'linear': return base;
      case 'explosive': return base * (1 + t * t * 3); // Exponential acceleration
      case 'slow-start': return base * Math.max(0.2, t * 1.5);
      case 'wave': return base * (1 + Math.sin(t * Math.PI * 4) * 0.5);
    }
  }, [round]);

  const startRound = useCallback(() => {
    const f = FOODS[Math.floor(Math.random() * FOODS.length)];
    setFood(f);
    setHeat(0);
    heatRef.current = 0;
    setResult(null);
    setHideGauge(false);
    startRef.current = Date.now();
    setPhase('heating');
  }, []);

  // Game loop
  useEffect(() => {
    if (phase !== 'heating' || !food) return;

    const loop = () => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const t = Math.min(1, elapsed / 10); // normalize to 0-1 over 10 seconds
      const speed = getSpeed(t, food.speedCurve);
      heatRef.current = Math.min(100, heatRef.current + speed);
      setHeat(heatRef.current);

      // Lv2+: gauge flickers/hides
      if (getDifficulty() >= 2 && Math.random() < 0.02) {
        setHideGauge(true);
        setTimeout(() => setHideGauge(false), 500 + Math.random() * 1000);
      }

      // Explode at 100
      if (heatRef.current >= 100) {
        setPhase('exploded');
        return;
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [phase, food, getSpeed, getDifficulty]);

  const stop = () => {
    if (phase !== 'heating' || !food) return;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const h = heatRef.current;
    const [lo, hi] = food.targetZone;

    if (h >= lo && h <= hi) {
      setResult('perfect');
      const accuracy = 1 - Math.abs(h - (lo + hi) / 2) / ((hi - lo) / 2);
      setScore((s) => s + Math.floor(200 + accuracy * 300));
      setStreak((s) => s + 1);
    } else if (h < lo) {
      setResult('cold');
      setStreak(0);
    } else {
      setResult('hot');
      setStreak(0);
    }
    setPhase('result');
  };

  const nextRound = () => {
    if (result === 'cold' || result === 'hot') {
      if (round >= 4) {
        setPhase('gameover');
        return;
      }
    }
    setRound((r) => r + 1);
    startRound();
  };

  const start = () => {
    setRound(0);
    setScore(0);
    setStreak(0);
    startRound();
  };

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-yellow tracking-[0.3em] mb-1">MICROWAVE MASTER</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">レンチン職人</h2>
      </div>

      {phase === 'heating' && <GameComments gameId="microwave-master" mode="danmaku" />}

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🍱"
              title="MICROWAVE MASTER"
              gameId="microwave-master"
              subtitle="レンチン職人"
              controls={[
                { icon: '👆', label: 'STOP', desc: 'ちょうどいい温度で止める' },
              ]}
              rules={[
                { text: 'ちょうどいい温度でSTOPを押せ' },
                { text: '早すぎ→冷たい。遅すぎ→爆発', highlight: true },
                { text: '食品ごとに加熱カーブが違う' },
                { text: '卵は一瞬で爆発する', highlight: true },
              ]}
              tip="Lv2〜 ゲージが不定期に隠れる。気配で感じろ"
              buttonText="START COOKING"
              buttonColor="bg-neon-yellow text-bg-deep"
              onStart={start}
            />
          </motion.div>
        )}

        {phase === 'heating' && food && (
          <motion.div key="heating" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* HUD */}
            <div className="flex items-center justify-between text-xs mb-4">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              {streak >= 2 && <span className="text-neon-cyan">🔥{streak}</span>}
              <span className="font-['Orbitron'] text-text-muted">ROUND {round + 1}</span>
            </div>

            {/* Microwave */}
            <div className="bg-bg-surface border-2 border-bg-raised rounded-2xl p-6 relative">
              {/* Food */}
              <div className="text-center mb-6">
                <motion.p
                  className="text-6xl"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  {food.emoji}
                </motion.p>
                <p className="text-text-primary font-bold mt-2">{food.name}</p>
                <p className="text-text-muted text-[10px]">
                  {food.speedCurve === 'explosive' ? '⚠ 急加速注意' :
                   food.speedCurve === 'wave' ? '〜 加熱ムラあり' :
                   food.speedCurve === 'slow-start' ? '🐌 ゆっくりスタート' : '→ 一定速度'}
                </p>
              </div>

              {/* Heat gauge */}
              <div className={`relative h-8 bg-bg-deep rounded-full overflow-hidden border border-bg-raised ${hideGauge ? 'opacity-10' : ''} transition-opacity`}>
                {/* Target zone */}
                <div
                  className="absolute h-full bg-neon-cyan/20 border-x-2 border-neon-cyan"
                  style={{ left: `${food.targetZone[0]}%`, width: `${food.targetZone[1] - food.targetZone[0]}%` }}
                />

                {/* Heat bar */}
                <div
                  className={`h-full transition-none ${
                    heat > 85 ? 'bg-neon-pink' : heat > 60 ? 'bg-neon-yellow' : 'bg-neon-cyan'
                  }`}
                  style={{ width: `${heat}%` }}
                />

                {/* Labels */}
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] text-text-muted">冷</span>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-neon-pink">💥</span>
              </div>

              {hideGauge && (
                <p className="text-center text-neon-pink text-[10px] mt-1 animate-pulse">⚠ GAUGE MALFUNCTION</p>
              )}

              {/* Temperature */}
              <p className="text-center font-['Share_Tech_Mono'] text-2xl font-bold mt-4">
                <span className={heat > 85 ? 'text-neon-pink' : 'text-text-primary'}>
                  {Math.floor(20 + heat * 2.3)}°C
                </span>
              </p>
            </div>

            {/* STOP button */}
            <motion.button
              onClick={stop}
              className="w-full mt-6 py-5 bg-neon-pink text-white font-['Orbitron'] font-bold text-2xl rounded-xl hover:shadow-[0_0_30px_rgba(255,45,120,0.5)] transition-shadow"
              whileTap={{ scale: 0.95 }}
            >
              STOP
            </motion.button>
          </motion.div>
        )}

        {phase === 'result' && food && (
          <motion.div key="result" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4 py-8">
            <p className="text-6xl">
              {result === 'perfect' ? '😋' : result === 'cold' ? '🥶' : '🥵'}
            </p>
            <p className={`font-['Orbitron'] font-bold text-lg ${
              result === 'perfect' ? 'text-neon-cyan' : result === 'cold' ? 'text-blue-400' : 'text-neon-pink'
            }`}>
              {result === 'perfect' ? 'PERFECT HEAT!' : result === 'cold' ? 'STILL COLD...' : 'OVERHEATED!'}
            </p>
            <p className="text-text-muted text-sm">
              {food.emoji} {food.name}: {Math.floor(20 + heat * 2.3)}°C
              {result === 'perfect' && ` (target: ${Math.floor(20 + food.targetZone[0] * 2.3)}〜${Math.floor(20 + food.targetZone[1] * 2.3)}°C)`}
            </p>
            <button onClick={nextRound} className="px-8 py-3 bg-neon-yellow text-bg-deep font-['Orbitron'] text-sm font-bold rounded-lg">
              {result === 'perfect' ? 'NEXT FOOD' : 'TRY NEXT'}
            </button>
          </motion.div>
        )}

        {phase === 'exploded' && food && (
          <motion.div key="exploded" initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="microwave-master"
              gameName="MICROWAVE MASTER"
              icon="🍱"
              score={score}
              level={round + 1}
              deathReason="MICROWAVE EXPLODED — 調理師免許: 永久剥奪"
              extraInfo={`被害: レンジ全損 / 壁に${food.name} / 天井に${food.emoji}`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <GameResult
              gameId="microwave-master"
              gameName="MICROWAVE MASTER"
              icon="🍱"
              score={score}
              level={round + 1}
              extraInfo={`${round + 1} dishes attempted`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
