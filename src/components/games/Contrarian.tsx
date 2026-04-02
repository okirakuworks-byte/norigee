import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

// --- Types ---

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Phase = 'ready' | 'playing' | 'gameover' | 'clear';
type Level = 1 | 2 | 3;

interface Arrow {
  id: number;
  direction: Direction;
  rotationDeg?: number; // Lv3: arrow visually rotated
  fakeColor?: boolean;  // Lv3: colored as distracting faint background
}

const DIRECTION_SYMBOLS: Record<Direction, string> = {
  UP: '↑',
  DOWN: '↓',
  LEFT: '←',
  RIGHT: '→',
};

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

const ALL_DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

// Time limit per input (ms) per level
const TIME_LIMITS: Record<Level, number> = { 1: 2000, 2: 1500, 3: 1000 };
const QUESTIONS_TO_CLEAR = 15;

function randomDir(): Direction {
  return ALL_DIRECTIONS[Math.floor(Math.random() * 4)];
}

function generateArrows(level: Level): Arrow[] {
  if (level === 1) {
    return [{ id: 1, direction: randomDir() }];
  }
  if (level === 2) {
    // Two simultaneous — must both be answered correctly
    const d1 = randomDir();
    let d2 = randomDir();
    // Allow same direction (harder to process two identical)
    return [
      { id: 1, direction: d1 },
      { id: 2, direction: d2 },
    ];
  }
  // Level 3: single arrow but rotated + fake background color
  const d = randomDir();
  const rotation = [0, 45, 90, 135, 180, 225, 270, 315][Math.floor(Math.random() * 8)];
  return [{ id: 1, direction: d, rotationDeg: rotation, fakeColor: Math.random() < 0.5 }];
}

export default function Contrarian() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [level, setLevel] = useState<Level>(1);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(TIME_LIMITS[1]);
  const [score, setScore] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingInputRef = useRef<Set<number>>(new Set());
  const phaseRef = useRef<Phase>('ready');
  phaseRef.current = phase;

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => () => clearTimer(), []);

  const getLevel = (s: number): Level => {
    if (s >= 10) return 3;
    if (s >= 5) return 2;
    return 1;
  };

  const nextQuestion = useCallback((currentScore: number) => {
    clearTimer();
    const lvl = getLevel(currentScore);
    const newArrows = generateArrows(lvl);
    pendingInputRef.current = new Set(newArrows.map((a) => a.id));
    setLevel(lvl);
    setArrows(newArrows);
    setAnswered(new Set());
    setTimeLeft(TIME_LIMITS[lvl]);

    // Start countdown
    let remaining = TIME_LIMITS[lvl];
    timerRef.current = setInterval(() => {
      remaining -= 100;
      setTimeLeft(Math.max(remaining, 0));
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        if (phaseRef.current === 'playing') {
          setPhase('gameover');
        }
      }
    }, 100);
  }, []);

  const startGame = useCallback(() => {
    clearTimer();
    setScore(0);
    setWrongFlash(false);
    setPhase('playing');
    phaseRef.current = 'playing';
    nextQuestion(0);
  }, [nextQuestion]);

  const handleInput = useCallback(
    (dir: Direction, arrowId: number) => {
      if (phase !== 'playing') return;

      const arrow = arrows.find((a) => a.id === arrowId);
      if (!arrow) return;
      if (answered.has(arrowId)) return;

      const expected = OPPOSITE[arrow.direction];
      if (dir !== expected) {
        // Wrong!
        clearTimer();
        setWrongFlash(true);
        setTimeout(() => setWrongFlash(false), 400);
        setPhase('gameover');
        return;
      }

      const newAnswered = new Set([...answered, arrowId]);
      setAnswered(newAnswered);

      // Check if all arrows answered
      if (newAnswered.size >= arrows.length) {
        clearTimer();
        const newScore = score + 1;
        setScore(newScore);
        if (newScore >= QUESTIONS_TO_CLEAR) {
          setPhase('clear');
        } else {
          nextQuestion(newScore);
        }
      }
    },
    [phase, arrows, answered, score, nextQuestion]
  );

  // Keyboard support
  useEffect(() => {
    if (phase !== 'playing') return;

    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
      };
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      // For Lv1/3: answer first unanswered arrow
      // For Lv2: alternate between arrows (first press = arrow 1, second = arrow 2)
      const unanswered = arrows.filter((a) => !answered.has(a.id));
      if (unanswered.length > 0) {
        handleInput(dir, unanswered[0].id);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, arrows, answered, handleInput]);

  const levelLabel: Record<Level, string> = { 1: 'LV.1', 2: 'LV.2', 3: 'LV.3' };
  const timeRatio = timeLeft / TIME_LIMITS[level];

  const renderArrowButtons = (arrow: Arrow) => {
    const symbol = DIRECTION_SYMBOLS[arrow.direction];
    const rotation = arrow.rotationDeg ?? 0;
    const bgColor = arrow.fakeColor ? 'bg-neon-pink/10 border-neon-pink/30' : 'bg-bg-surface border-bg-raised';
    const isAnswered = answered.has(arrow.id);

    return (
      <div key={arrow.id} className="space-y-3">
        {/* Arrow display */}
        <div className={`mx-auto w-24 h-24 rounded-full border-2 flex items-center justify-center ${bgColor}`}>
          <motion.span
            className="text-5xl select-none"
            style={{ display: 'block', transform: `rotate(${rotation}deg)` }}
            animate={isAnswered ? { scale: [1, 1.3, 1] } : {}}
          >
            {symbol}
          </motion.span>
        </div>

        {/* Direction buttons */}
        <div className="grid grid-cols-3 gap-1 w-40 mx-auto">
          <div />
          <button
            onClick={() => handleInput('UP', arrow.id)}
            disabled={isAnswered}
            className={`py-2 rounded-lg text-lg font-bold transition-colors ${
              isAnswered ? 'bg-bg-raised/30 text-text-muted' : 'bg-bg-surface border border-bg-raised text-text-primary hover:border-neon-yellow/50 active:bg-neon-yellow/20'
            }`}
          >
            ↑
          </button>
          <div />
          <button
            onClick={() => handleInput('LEFT', arrow.id)}
            disabled={isAnswered}
            className={`py-2 rounded-lg text-lg font-bold transition-colors ${
              isAnswered ? 'bg-bg-raised/30 text-text-muted' : 'bg-bg-surface border border-bg-raised text-text-primary hover:border-neon-yellow/50 active:bg-neon-yellow/20'
            }`}
          >
            ←
          </button>
          <button
            onClick={() => handleInput('DOWN', arrow.id)}
            disabled={isAnswered}
            className={`py-2 rounded-lg text-lg font-bold transition-colors ${
              isAnswered ? 'bg-bg-raised/30 text-text-muted' : 'bg-bg-surface border border-bg-raised text-text-primary hover:border-neon-yellow/50 active:bg-neon-yellow/20'
            }`}
          >
            ↓
          </button>
          <button
            onClick={() => handleInput('RIGHT', arrow.id)}
            disabled={isAnswered}
            className={`py-2 rounded-lg text-lg font-bold transition-colors ${
              isAnswered ? 'bg-bg-raised/30 text-text-muted' : 'bg-bg-surface border border-bg-raised text-text-primary hover:border-neon-yellow/50 active:bg-neon-yellow/20'
            }`}
          >
            →
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative max-w-lg mx-auto px-4 py-8">
      {/* Danmaku comments during play */}
      {phase === 'playing' && <GameComments gameId="contrarian" mode="danmaku" />}

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🔄"
              title="逆操作"
              gameId="contrarian"
              subtitle="矢印と逆方向を押せ。↑が出たら↓を押す。それだけ。"
              controls={[
                { icon: '↑↓←→', label: 'REVERSE', desc: '表示の逆方向を押す' },
              ]}
              rules={[
                { text: '表示された矢印の逆方向ボタンを押す' },
                { text: '1ミスで即ゲームオーバー', highlight: true },
                { text: 'Lv2: 矢印が2つ同時に表示される' },
                { text: 'Lv3: 矢印が回転する + 背景色でフェイント' },
                { text: '制限時間: 2秒 → 1.5秒 → 1秒' },
              ]}
              tip="キーボードの矢印キーでも操作できる。体が先に間違える。"
              buttonText="START"
              buttonColor="bg-neon-yellow text-bg-deep"
              onStart={startGame}
            />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div
            key={`q-${score}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: wrongFlash ? { backgroundColor: 'rgba(255,45,120,0.1)' } : {} }}
            className="space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="font-['Orbitron'] text-xs text-neon-yellow">{levelLabel[level]}</span>
              <span className="font-['Orbitron'] text-xs text-text-muted">
                {score} / {QUESTIONS_TO_CLEAR}
              </span>
              <span className={`font-['Orbitron'] text-sm font-bold ${
                timeLeft < 500 ? 'text-neon-pink' : timeLeft < 1000 ? 'text-neon-yellow' : 'text-neon-cyan'
              }`}>
                {(timeLeft / 1000).toFixed(1)}s
              </span>
            </div>

            {/* Timer bar */}
            <div className="w-full h-1.5 bg-bg-raised rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${timeRatio * 100}%`,
                  backgroundColor: timeRatio < 0.25 ? 'rgb(255,45,120)' : timeRatio < 0.5 ? 'rgb(255,230,0)' : 'rgb(0,245,212)',
                  transition: 'width 0.1s linear, background-color 0.3s',
                }}
              />
            </div>

            <p className="font-['Orbitron'] text-[10px] text-text-muted tracking-widest text-center">
              {level === 3 ? '矢印の向きと逆方向を押せ（回転に注意）' : level === 2 ? '両方の矢印と逆方向を押せ' : '矢印の逆方向を押せ'}
            </p>

            {/* Arrow(s) */}
            <div className={`flex ${arrows.length > 1 ? 'gap-8 justify-center' : 'justify-center'}`}>
              {arrows.map((arrow) => renderArrowButtons(arrow))}
            </div>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div
            key="gameover"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <GameResult
              gameId="contrarian"
              gameName="CONTRARIAN"
              icon="🔄"
              score={score * 100}
              level={level}
              deathReason="WRONG WAY — 脳の配線: 逆接続"
              extraInfo={`正解数: ${score} / ${QUESTIONS_TO_CLEAR}`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}

        {phase === 'clear' && (
          <motion.div
            key="clear"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <GameResult
              gameId="contrarian"
              gameName="CONTRARIAN"
              icon="🔄"
              score={score * 100}
              level={level}
              extraInfo="脳の配線: 正常に逆接続完了。"
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
