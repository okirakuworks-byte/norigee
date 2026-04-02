import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

type Phase = 'ready' | 'playing' | 'correct' | 'gameover';

// SVG key shapes - subtle variations
const KEY_SHAPES = [
  'M10,2 L10,14 L14,14 L14,11 L12,11 L12,9 L14,9 L14,7 L12,7 L12,2 Z',
  'M10,2 L10,14 L14,14 L14,11 L12,11 L12,8 L14,8 L14,6 L12,6 L12,2 Z',
  'M10,2 L10,14 L14,14 L14,10 L12,10 L12,8 L14,8 L14,6 L12,6 L12,2 Z',
  'M10,2 L10,14 L14,14 L14,12 L12,12 L12,9 L14,9 L14,7 L12,7 L12,2 Z',
  'M10,2 L10,14 L14,14 L14,11 L12,11 L12,10 L14,10 L14,7 L12,7 L12,2 Z',
  'M10,2 L10,14 L14,14 L14,12 L12,12 L12,8 L14,8 L14,6 L12,6 L12,2 Z',
];

function generateKeys(difficulty: number): { shapes: string[]; correctIdx: number } {
  const correct = Math.floor(Math.random() * 4);

  if (difficulty <= 1) {
    // Very different shapes
    const pool = [...KEY_SHAPES].sort(() => Math.random() - 0.5);
    return { shapes: pool.slice(0, 4), correctIdx: correct };
  }

  // Higher difficulty: all shapes are similar, correct one has subtle glow
  const base = KEY_SHAPES[Math.floor(Math.random() * KEY_SHAPES.length)];
  const shapes = Array(4).fill(base);
  // Correct key gets a slightly different shape
  const altIdx = (Math.floor(Math.random() * KEY_SHAPES.length) + 1) % KEY_SHAPES.length;
  shapes[correct] = KEY_SHAPES[altIdx];
  return { shapes, correctIdx: correct };
}

export default function AuthOrDieGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(1);
  const [keys, setKeys] = useState<{ shapes: string[]; correctIdx: number }>({ shapes: [], correctIdx: 0 });
  const [timeLeft, setTimeLeft] = useState(3);
  const [positions, setPositions] = useState([0, 1, 2, 3]);
  const [rotation, setRotation] = useState([0, 0, 0, 0]);
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const shuffleRef = useRef<ReturnType<typeof setInterval>>();

  const getDifficulty = useCallback(() => {
    if (level >= 8) return 3;
    if (level >= 4) return 2;
    return 1;
  }, [level]);

  const getTimeLimit = useCallback(() => {
    return [3, 1.5, 0.8][getDifficulty() - 1];
  }, [getDifficulty]);

  const nextRound = useCallback(() => {
    const diff = getDifficulty();
    const newKeys = generateKeys(diff);
    setKeys(newKeys);
    setPositions([0, 1, 2, 3].sort(() => Math.random() - 0.5));

    // Rotation for Lv2+
    if (diff >= 2) {
      setRotation(Array(4).fill(0).map(() => Math.floor(Math.random() * 4) * 90));
    } else {
      setRotation([0, 0, 0, 0]);
    }

    const limit = getTimeLimit();
    setTimeLeft(limit);
    const start = Date.now();

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, limit - (Date.now() - start) / 1000);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        clearInterval(shuffleRef.current);
        setPhase('gameover');
      }
    }, 30);

    // Lv3: shuffle positions continuously
    clearInterval(shuffleRef.current);
    if (diff >= 3) {
      shuffleRef.current = setInterval(() => {
        setPositions((prev) => [...prev].sort(() => Math.random() - 0.5));
      }, 400);
    }

    setPhase('playing');
  }, [getDifficulty, getTimeLimit]);

  const start = () => {
    setScore(0);
    setStreak(0);
    setLevel(1);
    setAttempts(0);
    nextRound();
  };

  const selectKey = (displayIdx: number) => {
    if (phase !== 'playing') return;
    clearInterval(timerRef.current);
    clearInterval(shuffleRef.current);

    // Map display position back to original key index
    const originalIdx = positions[displayIdx];

    if (originalIdx === keys.correctIdx) {
      const timeBonus = Math.floor(timeLeft * 200);
      setScore((s) => s + 300 + timeBonus);
      setStreak((s) => s + 1);
      setLevel((l) => l + 1);
      setPhase('correct');
    } else {
      setAttempts((a) => a + 1);
      setPhase('gameover');
    }
  };

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(shuffleRef.current);
    };
  }, []);

  const diff = getDifficulty();

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-yellow tracking-[0.3em] mb-1">AUTH OR DIE</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">認証キメろ</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🔑"
              title="AUTH OR DIE"
              gameId="auth-or-die"
              subtitle="認証キメろ"
              controls={[
                { icon: '👆', label: 'TAP', desc: '正しい鍵を選択' },
              ]}
              rules={[
                { text: '正しい鍵を1つだけ選べ' },
                { text: '制限時間: 3秒→1.5秒→0.8秒', highlight: true },
                { text: 'Lv.4〜 鍵が回転する' },
                { text: 'Lv.8〜 位置がシャッフルされ続ける', highlight: true },
              ]}
              tip="形の微妙な違いに集中しろ。色は関係ない"
              buttonText="AUTHENTICATE"
              buttonColor="bg-neon-yellow text-bg-deep"
              onStart={start}
            />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <GameComments gameId="auth-or-die" mode="danmaku" />
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              {streak >= 3 && <span className="text-neon-cyan">🔥{streak}</span>}
              <span className="font-['Orbitron'] text-text-muted">Lv.{level}</span>
            </div>

            {/* Timer */}
            <div className="h-3 bg-bg-raised rounded-full overflow-hidden mb-6">
              <div
                className={`h-full transition-all duration-50 ${timeLeft <= 0.5 ? 'bg-neon-pink' : 'bg-neon-yellow'}`}
                style={{ width: `${(timeLeft / getTimeLimit()) * 100}%` }}
              />
            </div>

            <p className="text-center text-text-muted text-xs mb-4">正しい鍵をタップ</p>

            {/* Keys grid */}
            <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
              {positions.map((originalIdx, displayIdx) => {
                const isCorrect = originalIdx === keys.correctIdx;
                return (
                  <motion.button
                    key={displayIdx}
                    layout
                    onClick={() => selectKey(displayIdx)}
                    className={`aspect-square bg-bg-surface border-2 border-bg-raised rounded-xl flex items-center justify-center hover:border-neon-yellow transition-colors ${
                      isCorrect && diff >= 2 ? 'shadow-[0_0_8px_rgba(255,230,0,0.15)]' : ''
                    }`}
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-16 h-16"
                      style={{ transform: `rotate(${rotation[originalIdx]}deg)` }}
                    >
                      {/* Key head (circle) */}
                      <circle cx="7" cy="7" r="5" fill="none" stroke={isCorrect && diff >= 2 ? '#FFE600' : '#888'} strokeWidth="1.5" />
                      <circle cx="7" cy="7" r="2" fill={isCorrect && diff >= 2 ? '#FFE600' : '#888'} opacity="0.5" />
                      {/* Key blade */}
                      <path
                        d={keys.shapes[originalIdx] ?? KEY_SHAPES[0]}
                        fill="none"
                        stroke={isCorrect && diff >= 2 ? '#FFE600' : '#888'}
                        strokeWidth="1.5"
                      />
                    </svg>
                  </motion.button>
                );
              })}
            </div>

            <p className="text-center text-text-muted text-[10px] mt-3 font-['Share_Tech_Mono']">
              {diff >= 2 && '🔄 ROTATING'} {diff >= 3 && '| 🔀 SHUFFLING'}
            </p>
          </motion.div>
        )}

        {phase === 'correct' && (
          <motion.div key="correct" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4 py-8">
            <motion.p className="text-6xl" animate={{ rotate: [0, -30, 0] }} transition={{ duration: 0.3 }}>🔓</motion.p>
            <p className="font-['Orbitron'] text-neon-cyan font-bold">AUTHENTICATED</p>
            <p className="text-text-muted text-xs">残り{timeLeft.toFixed(1)}秒 | Lv.{level}</p>
            <button onClick={nextRound} className="px-8 py-3 bg-neon-yellow text-bg-deep font-['Orbitron'] text-sm font-bold rounded-lg">
              NEXT DOOR
            </button>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="auth-or-die"
              gameName="AUTH OR DIE"
              icon="🔑"
              score={score}
              level={level}
              deathReason="ACCESS DENIED — 認証失敗"
              extraInfo={`${streak} streak | 試行: ${attempts + 1}回目`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
