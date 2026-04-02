import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

const COLORS_MAP: Record<string, string> = {
  '赤': '#FF2D78', '青': '#4488FF', '緑': '#00F5D4', '黄': '#FFE600',
};
const COLOR_NAMES = Object.keys(COLORS_MAP);

type Phase = 'ready' | 'playing' | 'gameover';

interface MathQ { text: string; answer: number; options: number[]; }
interface StroopQ { word: string; color: string; correctName: string; options: string[]; }

function genMath(difficulty: number): MathQ {
  const ops = difficulty >= 2 ? ['+', '-', '×'] : ['+', '-'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, ans: number;
  if (op === '+') { a = 1 + Math.floor(Math.random() * 20); b = 1 + Math.floor(Math.random() * 20); ans = a + b; }
  else if (op === '-') { a = 10 + Math.floor(Math.random() * 30); b = 1 + Math.floor(Math.random() * a); ans = a - b; }
  else { a = 2 + Math.floor(Math.random() * 9); b = 2 + Math.floor(Math.random() * 9); ans = a * b; }

  const options = [ans];
  while (options.length < 4) {
    const wrong = ans + Math.floor(Math.random() * 10) - 5;
    if (wrong !== ans && !options.includes(wrong) && wrong >= 0) options.push(wrong);
  }
  return { text: `${a} ${op} ${b}`, answer: ans, options: options.sort(() => Math.random() - 0.5) };
}

function genStroop(): StroopQ {
  const word = COLOR_NAMES[Math.floor(Math.random() * COLOR_NAMES.length)];
  let colorName: string;
  do { colorName = COLOR_NAMES[Math.floor(Math.random() * COLOR_NAMES.length)]; } while (colorName === word);
  return {
    word,
    color: COLORS_MAP[colorName],
    correctName: colorName,
    options: COLOR_NAMES.sort(() => Math.random() - 0.5),
  };
}

export default function BrainOverflowGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [mathQ, setMathQ] = useState<MathQ | null>(null);
  const [stroopQ, setStroopQ] = useState<StroopQ | null>(null);
  const [mathTimer, setMathTimer] = useState(5);
  const [stroopTimer, setStroopTimer] = useState(5);
  const [cpuUsage, setCpuUsage] = useState(0);
  const mathTimerRef = useRef<ReturnType<typeof setInterval>>();
  const stroopTimerRef = useRef<ReturnType<typeof setInterval>>();

  const getDifficulty = useCallback(() => {
    if (level >= 8) return 3;
    if (level >= 4) return 2;
    return 1;
  }, [level]);

  const getTimeLimit = useCallback(() => {
    return [5, 4, 3][getDifficulty() - 1];
  }, [getDifficulty]);

  const nextRound = useCallback(() => {
    const diff = getDifficulty();
    setMathQ(genMath(diff));
    setStroopQ(genStroop());

    const limit = getTimeLimit();
    setMathTimer(limit);
    setStroopTimer(limit);

    clearInterval(mathTimerRef.current);
    clearInterval(stroopTimerRef.current);

    const mStart = Date.now();
    mathTimerRef.current = setInterval(() => {
      const r = Math.max(0, limit - (Date.now() - mStart) / 1000);
      setMathTimer(r);
      if (r <= 0) { clearInterval(mathTimerRef.current); miss(); }
    }, 50);

    const sStart = Date.now();
    stroopTimerRef.current = setInterval(() => {
      const r = Math.max(0, limit - (Date.now() - sStart) / 1000);
      setStroopTimer(r);
      if (r <= 0) { clearInterval(stroopTimerRef.current); miss(); }
    }, 50);

    setCpuUsage(Math.min(999, 100 + level * 80 + Math.floor(Math.random() * 100)));
  }, [getDifficulty, getTimeLimit]);

  const miss = useCallback(() => {
    setLives((l) => {
      if (l <= 1) {
        clearInterval(mathTimerRef.current);
        clearInterval(stroopTimerRef.current);
        setPhase('gameover');
        return 0;
      }
      return l - 1;
    });
    nextRound();
  }, [nextRound]);

  const answerMath = (val: number) => {
    if (!mathQ) return;
    clearInterval(mathTimerRef.current);
    if (val === mathQ.answer) {
      setScore((s) => s + Math.floor(100 + mathTimer * 30));
      setLevel((l) => l + 1);
      setMathQ(null);
      // Generate new math if stroop is also done
      if (!stroopQ) nextRound();
      else {
        const diff = getDifficulty();
        const newQ = genMath(diff);
        setMathQ(newQ);
        const limit = getTimeLimit();
        setMathTimer(limit);
        const start = Date.now();
        mathTimerRef.current = setInterval(() => {
          const r = Math.max(0, limit - (Date.now() - start) / 1000);
          setMathTimer(r);
          if (r <= 0) { clearInterval(mathTimerRef.current); miss(); }
        }, 50);
      }
    } else {
      miss();
    }
  };

  const answerStroop = (colorName: string) => {
    if (!stroopQ) return;
    clearInterval(stroopTimerRef.current);
    if (colorName === stroopQ.correctName) {
      setScore((s) => s + Math.floor(100 + stroopTimer * 30));
      setLevel((l) => l + 1);
      // Generate new stroop
      const newQ = genStroop();
      setStroopQ(newQ);
      const limit = getTimeLimit();
      setStroopTimer(limit);
      const start = Date.now();
      stroopTimerRef.current = setInterval(() => {
        const r = Math.max(0, limit - (Date.now() - start) / 1000);
        setStroopTimer(r);
        if (r <= 0) { clearInterval(stroopTimerRef.current); miss(); }
      }, 50);
    } else {
      miss();
    }
  };

  const start = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setCpuUsage(0);
    setPhase('playing');
    nextRound();
  };

  useEffect(() => {
    return () => {
      clearInterval(mathTimerRef.current);
      clearInterval(stroopTimerRef.current);
    };
  }, []);

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      {/* Danmaku comments during play */}
      {phase === 'playing' && <GameComments gameId="brain-overflow" mode="danmaku" />}

      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-yellow tracking-[0.3em] mb-1">BRAIN OVERFLOW</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">脳キャパオーバー</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🫠"
              title="BRAIN OVERFLOW"
              gameId="brain-overflow"
              subtitle="脳キャパオーバー"
              controls={[
                { icon: '🔢', label: 'LEFT', desc: '計算を解く' },
                { icon: '🎨', label: 'RIGHT', desc: '色判定をする' },
              ]}
              rules={[
                { text: '左で計算、右で色判定' },
                { text: '同時にやれ', highlight: true },
                { text: '個別なら小学生でもできる' },
                { text: '同時にやると脳がバグる' },
              ]}
              tip="どちらかを優先すると片方が時間切れになる"
              buttonText="BOOT"
              buttonColor="bg-neon-yellow text-bg-deep"
              onStart={start}
            />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* HUD */}
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              <span>{'❤️'.repeat(lives)}{'🖤'.repeat(3 - lives)}</span>
              <span className="font-['Orbitron'] text-text-muted">Lv.{level}</span>
            </div>

            {/* Split screen */}
            <div className="grid grid-cols-2 gap-2">
              {/* LEFT: Math */}
              <div className="bg-bg-surface border border-neon-cyan/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-['Orbitron'] text-[8px] text-neon-cyan">MATH</span>
                  <span className={`font-['Share_Tech_Mono'] text-[10px] ${mathTimer <= 1 ? 'text-neon-pink animate-pulse' : 'text-text-muted'}`}>
                    {Math.ceil(mathTimer)}s
                  </span>
                </div>
                {/* Timer bar */}
                <div className="h-0.5 bg-bg-raised rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-neon-cyan transition-all" style={{ width: `${(mathTimer / getTimeLimit()) * 100}%` }} />
                </div>

                {mathQ && (
                  <>
                    <p className="text-center font-['Share_Tech_Mono'] text-xl font-bold text-text-primary mb-3">
                      {mathQ.text} = ?
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {mathQ.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => answerMath(opt)}
                          className="py-2 bg-bg-deep border border-bg-raised rounded text-text-primary text-sm hover:border-neon-cyan transition-colors"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* RIGHT: Stroop */}
              <div className="bg-bg-surface border border-neon-pink/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-['Orbitron'] text-[8px] text-neon-pink">COLOR</span>
                  <span className={`font-['Share_Tech_Mono'] text-[10px] ${stroopTimer <= 1 ? 'text-neon-pink animate-pulse' : 'text-text-muted'}`}>
                    {Math.ceil(stroopTimer)}s
                  </span>
                </div>
                <div className="h-0.5 bg-bg-raised rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-neon-pink transition-all" style={{ width: `${(stroopTimer / getTimeLimit()) * 100}%` }} />
                </div>

                {stroopQ && (
                  <>
                    <p className="text-center text-2xl font-black mb-1" style={{ color: stroopQ.color }}>
                      {stroopQ.word}
                    </p>
                    <p className="text-center text-[8px] text-text-muted mb-2">↑ 文字の色は？</p>
                    <div className="grid grid-cols-2 gap-1">
                      {stroopQ.options.map((name) => (
                        <button
                          key={name}
                          onClick={() => answerStroop(name)}
                          className="py-2 bg-bg-deep border border-bg-raised rounded text-sm hover:border-neon-pink transition-colors"
                          style={{ color: COLORS_MAP[name] }}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="brain-overflow"
              gameName="BRAIN OVERFLOW"
              icon="🫠"
              score={score}
              level={level}
              deathReason="SYSTEM OVERLOAD — brain.exe は応答していません"
              extraInfo={`CPU: ${cpuUsage}% | マルチタスク能力: ${level <= 3 ? '金魚' : level <= 6 ? 'ハムスター' : '人間（下の上）'}`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
