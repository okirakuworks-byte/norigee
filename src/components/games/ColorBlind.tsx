import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

const COLORS = [
  { name: '赤', hex: '#FF2D78' },
  { name: '青', hex: '#4488FF' },
  { name: '緑', hex: '#00F5D4' },
  { name: '黄', hex: '#FFE600' },
  { name: '紫', hex: '#AA44FF' },
  { name: '橙', hex: '#FF8844' },
];

type Phase = 'ready' | 'playing' | 'gameover';

interface Question {
  word: string;         // 文字の内容 (e.g., "赤")
  displayColor: string; // 文字の表示色 (e.g., "#4488FF" = blue)
  correctColor: string; // 正解の色名 (e.g., "青")
  answerMode: 'color' | 'word'; // color=文字色を答える, word=文字内容を答える
}

function generateQuestion(difficulty: number): Question {
  const wordColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  let displayColorObj: typeof COLORS[0];
  do {
    displayColorObj = COLORS[Math.floor(Math.random() * COLORS.length)];
  } while (displayColorObj.name === wordColor.name);

  // Lv3: sometimes ask for the WORD instead of color (rule flip)
  const answerMode = difficulty >= 3 && Math.random() < 0.3 ? 'word' : 'color';

  return {
    word: wordColor.name,
    displayColor: displayColorObj.hex,
    correctColor: answerMode === 'color' ? displayColorObj.name : wordColor.name,
    answerMode,
  };
}

interface ButtonOption {
  label: string;
  displayColor: string; // Lv2+: button color is also a lie
}

function generateButtons(question: Question, difficulty: number): ButtonOption[] {
  const colorNames = COLORS.map((c) => c.name);
  const buttons: ButtonOption[] = [];

  // Always include correct answer
  buttons.push({ label: question.correctColor, displayColor: COLORS.find((c) => c.name === question.correctColor)!.hex });

  // Add wrong answers
  const wrong = colorNames.filter((n) => n !== question.correctColor).sort(() => Math.random() - 0.5);
  const count = difficulty >= 3 ? 4 : 3;
  for (let i = 0; i < count && i < wrong.length; i++) {
    buttons.push({ label: wrong[i], displayColor: COLORS.find((c) => c.name === wrong[i])!.hex });
  }

  // Lv2+: Swap button colors (make them lies too)
  if (difficulty >= 2) {
    const shuffledColors = [...buttons.map((b) => b.displayColor)].sort(() => Math.random() - 0.5);
    buttons.forEach((b, i) => { b.displayColor = shuffledColors[i]; });
  }

  // Shuffle
  return buttons.sort(() => Math.random() - 0.5);
}

export default function ColorBlindGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(1);
  const [question, setQuestion] = useState<Question | null>(null);
  const [buttons, setButtons] = useState<ButtonOption[]>([]);
  const [timeLeft, setTimeLeft] = useState(2);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const getDifficulty = useCallback(() => {
    if (level >= 10) return 3;
    if (level >= 5) return 2;
    return 1;
  }, [level]);

  const getTimeLimit = useCallback(() => {
    return [2, 1.5, 1][getDifficulty() - 1];
  }, [getDifficulty]);

  const nextQuestion = useCallback(() => {
    const diff = getDifficulty();
    const q = generateQuestion(diff);
    const btns = generateButtons(q, diff);
    setQuestion(q);
    setButtons(btns);
    setFeedback(null);

    const limit = getTimeLimit();
    setTimeLeft(limit);
    const start = Date.now();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, limit - (Date.now() - start) / 1000);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        miss();
      }
    }, 50);
  }, [getDifficulty, getTimeLimit]);

  const miss = useCallback(() => {
    setFeedback('wrong');
    setStreak(0);
    setLives((l) => {
      if (l <= 1) {
        clearInterval(timerRef.current);
        setTimeout(() => setPhase('gameover'), 500);
        return 0;
      }
      setTimeout(() => nextQuestion(), 500);
      return l - 1;
    });
  }, [nextQuestion]);

  const answer = (colorName: string) => {
    if (!question || feedback) return;
    clearInterval(timerRef.current);

    if (colorName === question.correctColor) {
      setFeedback('correct');
      setScore((s) => s + Math.floor(100 + timeLeft * 80));
      setStreak((s) => s + 1);
      setLevel((l) => l + 1);
      setTimeout(() => nextQuestion(), 300);
    } else {
      miss();
    }
  };

  const start = () => {
    setScore(0);
    setLives(3);
    setStreak(0);
    setLevel(1);
    setPhase('playing');
    nextQuestion();
  };

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const diff = getDifficulty();

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-pink tracking-[0.3em] mb-1">COLOR BLIND</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">色覚カオス</h2>
      </div>

      {phase === 'playing' && <GameComments gameId="color-blind" mode="danmaku" />}

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🎨"
              title="COLOR BLIND"
              gameId="color-blind"
              subtitle="色覚カオス"
              controls={[
                { icon: '👆', label: 'TAP', desc: '色ボタンを選択' },
              ]}
              rules={[
                { text: '表示される文字の色を答えろ' },
                { text: '文字の内容は無視しろ', highlight: true },
                { text: 'Lv.5〜 ボタンの色も嘘になる' },
                { text: 'Lv.10〜 突然ルールが反転する', highlight: true },
              ]}
              tip="「赤」という文字が青色で表示されたら「青」が正解"
              buttonText="START"
              buttonColor="bg-neon-pink text-white"
              onStart={start}
            />
          </motion.div>
        )}

        {phase === 'playing' && question && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* HUD */}
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              <span>{'❤️'.repeat(lives)}{'🖤'.repeat(3 - lives)}</span>
              {streak >= 3 && <span className="text-neon-cyan animate-pulse">🔥{streak}</span>}
              <span className="font-['Orbitron'] text-text-muted">Lv.{level}</span>
            </div>

            {/* Timer */}
            <div className="h-2 bg-bg-raised rounded-full overflow-hidden mb-6">
              <div
                className={`h-full transition-all duration-100 ${timeLeft <= 0.5 ? 'bg-neon-pink' : 'bg-neon-cyan'}`}
                style={{ width: `${(timeLeft / getTimeLimit()) * 100}%` }}
              />
            </div>

            {/* Mode indicator */}
            {question.answerMode === 'word' && (
              <motion.p
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center text-neon-yellow text-xs font-['Orbitron'] mb-2 animate-pulse"
              >
                ⚠ 文字の「内容」を答えろ！
              </motion.p>
            )}

            {/* The word */}
            <div className="text-center py-8">
              <motion.span
                key={level}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{
                  scale: 1, opacity: 1,
                  rotate: diff >= 3 ? [0, 5, -5, 0] : 0,
                  fontSize: diff >= 3 ? ['4rem', '5rem', '4rem'] : '4rem',
                }}
                transition={diff >= 3 ? { duration: 0.8, repeat: Infinity } : {}}
                className="font-black"
                style={{ color: question.displayColor }}
              >
                {question.word}
              </motion.span>
            </div>

            {/* Feedback flash */}
            {feedback && (
              <motion.p
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-center text-sm font-bold mb-2 ${feedback === 'correct' ? 'text-neon-cyan' : 'text-neon-pink'}`}
              >
                {feedback === 'correct' ? '✓' : '✗'}
              </motion.p>
            )}

            {/* Answer buttons */}
            <div className={`grid ${buttons.length > 4 ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
              {buttons.map((btn, i) => (
                <motion.button
                  key={`${level}-${i}`}
                  layout
                  onClick={() => answer(btn.label)}
                  className="py-4 rounded-xl font-bold text-lg border-2 border-bg-raised hover:border-white transition-all"
                  style={diff >= 2 ? { color: btn.displayColor, backgroundColor: 'var(--color-bg-surface)' } : { color: btn.displayColor, backgroundColor: 'var(--color-bg-surface)' }}
                  whileTap={{ scale: 0.9 }}
                >
                  {btn.label}
                </motion.button>
              ))}
            </div>

            <p className="text-center text-text-muted text-[10px] mt-3">
              {diff >= 2 && '⚠ ボタンの色も嘘 '}{diff >= 3 && '| ルール反転あり'}
            </p>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="color-blind"
              gameName="COLOR BLIND"
              icon="🎨"
              score={score}
              level={level}
              deathReason="COLOR SYSTEM FAILURE — 脳のRGBケーブルが断線"
              extraInfo={`${streak} best streak`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
