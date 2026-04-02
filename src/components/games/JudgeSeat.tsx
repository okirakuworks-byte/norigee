import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

// --- Data ---

interface Statement {
  real: string;
  fake: string;
}

// Level 1: short, somewhat distinguishable
const LEVEL1_STATEMENTS: Statement[] = [
  {
    real: '昨日、財布を洗濯してしまい、カードが全部使えなくなった。',
    fake: '昨日、財布を冷凍庫に入れてしまい、カードが全部溶けてなくなった。',
  },
  {
    real: '朝ごはんにカレーを食べたら、職場で3人から「いいにおい」と言われた。',
    fake: '朝ごはんにカレーを食べたら、電車で自然と周囲に人が集まってきた。',
  },
  {
    real: 'エスカレーターで逆走する夢を見て、リアルすぎて目が覚めた。',
    fake: 'エスカレーターで空中浮遊する夢を見て、着地したら月面だった。',
  },
  {
    real: '駅でスマホを落としたら、画面割れの衝撃で着信音が変わった。',
    fake: '駅でスマホを落としたら、拾ってくれた人が昔の同級生だった。',
  },
  {
    real: 'コンビニのセルフレジで袋の開け方がわからなくて3分かかった。',
    fake: 'コンビニのセルフレジが突然音楽を流し始めて係員が来た。',
  },
];

// Level 2: longer, harder to distinguish quickly
const LEVEL2_STATEMENTS: Statement[] = [
  {
    real: '先週、会社の会議中に椅子が壊れて突然床に座る形になり、そのまま30分議事録を書き続けた。上司は何も言わなかった。',
    fake: '先週、会社の会議中に椅子が突然ベルトコンベアのように動き出し、部屋をぐるぐる回りながら30分議事録を書き続けた。上司は何も言わなかった。',
  },
  {
    real: '先日、ATMで暗証番号を3回間違えてカードがロックされ、後ろに10人並んでいた。誰も何も言わなかったのが逆につらかった。',
    fake: '先日、ATMで暗証番号を3回間違えてカードが吐き出され、後ろの10人に自然と拍手された。誰が始めたかわからなかった。',
  },
  {
    real: '友人の結婚式でスピーチ中に名前を言い間違え、訂正しようとして別の名前を言い、最終的に新郎の名前を3種類呼んでしまった。',
    fake: '友人の結婚式でスピーチ中に感極まりすぎて倒れ、意識が戻ったら乾杯のタイミングだった。新郎は「予定通り」と言った。',
  },
];

// Level 3: both sound plausible, or both sound fake
const LEVEL3_STATEMENTS: Statement[] = [
  {
    real: 'コーヒーを飲みすぎて手が震えていたら、上司に「緊張してるの？」と言われた。',
    fake: 'コーヒーを飲みすぎて目が冴えすぎていたら、上司に「今日オーラがある」と言われた。',
  },
  {
    real: '夕方の空が異様にオレンジ色で、近所の人が全員外に出てきて写真を撮っていた。',
    fake: '夕方の空が異様に緑色で、近所の人が全員外に出てきて黙って見上げていた。',
  },
  {
    real: '猫が私のキーボードの上で寝て、2時間作業できなかった。移動させようとしたら噛まれた。',
    fake: '猫が私のキーボードの上で踊って、2時間作業できなかった。録画しようとしたら止まった。',
  },
];

const LEVEL_STATEMENTS = [LEVEL1_STATEMENTS, LEVEL2_STATEMENTS, LEVEL3_STATEMENTS];
const TIME_LIMITS = [3, 3, 3]; // seconds per level
const WIN_STREAK = 10;

type Phase = 'ready' | 'playing' | 'gameover' | 'clear';

interface GameState {
  level: number;
  streak: number;
  currentIdx: number;
  realIsLeft: boolean;
  timeLeft: number;
  lastResult: 'correct' | 'wrong' | null;
}

function pickStatement(level: number, usedIndices: Set<number>): { idx: number; realIsLeft: boolean } | null {
  const pool = LEVEL_STATEMENTS[level] ?? LEVEL_STATEMENTS[0];
  const available = pool
    .map((_, i) => i)
    .filter((i) => !usedIndices.has(i + level * 100));
  if (available.length === 0) return null;
  const idx = available[Math.floor(Math.random() * available.length)];
  return { idx, realIsLeft: Math.random() < 0.5 };
}

export default function JudgeSeat() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [state, setState] = useState<GameState>({
    level: 0,
    streak: 0,
    currentIdx: 0,
    realIsLeft: true,
    timeLeft: TIME_LIMITS[0],
    lastResult: null,
  });
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentPool = LEVEL_STATEMENTS[state.level] ?? LEVEL_STATEMENTS[0];
  const currentStatement = currentPool[state.currentIdx];
  const timeLimit = TIME_LIMITS[state.level] ?? 3;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.timeLeft <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return { ...prev, timeLeft: 0, lastResult: 'wrong', streak: 0 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
  }, [clearTimer]);

  // When time runs out → gameover
  useEffect(() => {
    if (phase === 'playing' && state.timeLeft === 0 && state.lastResult === 'wrong') {
      setTimeout(() => setPhase('gameover'), 600);
    }
  }, [phase, state.timeLeft, state.lastResult]);

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  const startGame = useCallback(() => {
    clearTimer();
    const pick = pickStatement(0, new Set());
    if (!pick) return;
    setState({
      level: 0,
      streak: 0,
      currentIdx: pick.idx,
      realIsLeft: pick.realIsLeft,
      timeLeft: TIME_LIMITS[0],
      lastResult: null,
    });
    setUsedIndices(new Set([pick.idx]));
    setPhase('playing');
    setTimeout(() => startTimer(), 50);
  }, [clearTimer, startTimer]);

  const handleChoice = useCallback(
    (choseLeft: boolean) => {
      if (phase !== 'playing' || state.timeLeft === 0) return;
      clearTimer();

      const correct = choseLeft === state.realIsLeft;

      if (!correct) {
        setState((prev) => ({ ...prev, lastResult: 'wrong', streak: 0 }));
        setTimeout(() => setPhase('gameover'), 600);
        return;
      }

      const newStreak = state.streak + 1;
      if (newStreak >= WIN_STREAK) {
        setState((prev) => ({ ...prev, lastResult: 'correct', streak: newStreak }));
        setPhase('clear');
        return;
      }

      // Advance level: 0-3 → Lv1, 4-6 → Lv2, 7+ → Lv3
      const newLevel = newStreak >= 7 ? 2 : newStreak >= 4 ? 1 : 0;
      const newUsed = new Set([...usedIndices, state.currentIdx + state.level * 100]);
      const pick = pickStatement(newLevel, newUsed);

      if (!pick) {
        // Ran out of questions — just pick any
        const fallback = { idx: 0, realIsLeft: Math.random() < 0.5 };
        setState((prev) => ({
          ...prev,
          level: newLevel,
          streak: newStreak,
          currentIdx: fallback.idx,
          realIsLeft: fallback.realIsLeft,
          timeLeft: TIME_LIMITS[newLevel],
          lastResult: 'correct',
        }));
        setUsedIndices(new Set());
        setTimeout(() => startTimer(), 100);
        return;
      }

      setUsedIndices(new Set([...newUsed, pick.idx + newLevel * 100]));
      setState((prev) => ({
        ...prev,
        level: newLevel,
        streak: newStreak,
        currentIdx: pick.idx,
        realIsLeft: pick.realIsLeft,
        timeLeft: TIME_LIMITS[newLevel],
        lastResult: 'correct',
      }));
      setTimeout(() => startTimer(), 100);
    },
    [phase, state, clearTimer, startTimer, usedIndices]
  );

  const levelLabel = ['LV.1', 'LV.2', 'LV.3'][state.level] ?? 'LV.1';
  const timerColor =
    state.timeLeft <= 1
      ? 'text-neon-pink'
      : state.timeLeft <= 2
        ? 'text-neon-yellow'
        : 'text-neon-cyan';

  return (
    <div className="relative max-w-lg mx-auto px-4 py-8">
      {/* Danmaku comments during play */}
      {phase === 'playing' && <GameComments gameId="judge-seat" mode="danmaku" />}

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🔍"
              title="嘘発見器"
              gameId="judge-seat"
              subtitle="2つの体験談。どちらが本物の体験か3秒で見抜け。"
              controls={[{ icon: '👈👉', label: 'LEFT / RIGHT', desc: '本物だと思う方を選択' }]}
              rules={[
                { text: '2文章が表示される。どちらが本物の体験談か判定せよ' },
                { text: '3秒以内に選択しないとタイムアウト → 即ゲームオーバー', highlight: true },
                { text: '10連続正解でクリア。1ミスで連続リセット' },
                { text: 'Lv2: 文章が長くなり3秒で読めない / Lv3: どちらも本物っぽい' },
              ]}
              tip="自分の直感を信じろ。考えすぎると時間切れになる。"
              buttonText="START"
              buttonColor="bg-neon-cyan text-bg-deep"
              onStart={startGame}
            />
          </motion.div>
        )}

        {phase === 'playing' && currentStatement && (
          <motion.div
            key={`q-${state.streak}-${state.currentIdx}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="font-['Orbitron'] text-xs text-neon-yellow tracking-widest">{levelLabel}</span>
              <span className="font-['Orbitron'] text-xs text-text-muted">
                STREAK: <span className="text-neon-cyan">{state.streak}</span> / {WIN_STREAK}
              </span>
              <motion.span
                key={state.timeLeft}
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
                className={`font-['Orbitron'] text-xl font-black ${timerColor}`}
              >
                {state.timeLeft}
              </motion.span>
            </div>

            {/* Timer bar */}
            <div className="w-full h-1 bg-bg-raised rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-neon-cyan rounded-full"
                animate={{ width: `${(state.timeLeft / timeLimit) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <p className="font-['Orbitron'] text-[10px] text-text-muted tracking-widest text-center">
              どちらが本物の体験談？
            </p>

            {/* Two statements */}
            <div className="grid grid-cols-1 gap-3">
              {[
                { text: state.realIsLeft ? currentStatement.real : currentStatement.fake, isLeft: true },
                { text: state.realIsLeft ? currentStatement.fake : currentStatement.real, isLeft: false },
              ].map(({ text, isLeft }) => (
                <motion.button
                  key={isLeft ? 'left' : 'right'}
                  onClick={() => handleChoice(isLeft)}
                  whileTap={{ scale: 0.97 }}
                  className={`w-full text-left p-4 rounded-xl border transition-all
                    ${state.lastResult === 'correct' && isLeft === state.realIsLeft
                      ? 'border-neon-cyan bg-neon-cyan/10'
                      : state.lastResult === 'wrong' && isLeft !== state.realIsLeft
                        ? 'border-neon-pink bg-neon-pink/10'
                        : 'border-bg-raised bg-bg-surface hover:border-neon-yellow/50'
                    }`}
                >
                  <p className="text-[10px] font-['Orbitron'] text-text-muted mb-2">
                    {isLeft ? '< A >' : '< B >'}
                  </p>
                  <p className="text-text-primary text-sm leading-relaxed">{text}</p>
                </motion.button>
              ))}
            </div>

            {/* Feedback flash */}
            <AnimatePresence>
              {state.lastResult === 'correct' && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center font-['Orbitron'] text-neon-cyan text-sm"
                >
                  CORRECT
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div
            key="gameover"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <GameResult
              gameId="judge-seat"
              gameName="JUDGE SEAT"
              icon="⚖️"
              score={state.streak * 100}
              level={state.level + 1}
              deathReason={state.timeLeft === 0 ? 'TIME OUT — 審判資格: 剥奪' : 'WRONG JUDGMENT — 嘘を見抜く力: 占い師以下'}
              extraInfo={`最高連続正解: ${state.streak}問`}
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
              gameId="judge-seat"
              gameName="JUDGE SEAT"
              icon="⚖️"
              score={state.streak * 100}
              level={state.level + 1}
              extraInfo="10連続正解。審判資格: 仮認定。"
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
