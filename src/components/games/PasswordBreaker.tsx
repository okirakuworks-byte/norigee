import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

const PASSWORD_POOL = [
  { password: 'P@ssw0rd', hint: 'The classic' },
  { password: 'Tr0ub4dor', hint: 'XKCD famous' },
  { password: 'hunter2', hint: 'IRC legend' },
  { password: 'qwerty123', hint: 'Keyboard walk' },
  { password: 'letmein!', hint: 'Polite request' },
  { password: 'dragon99', hint: 'Fantasy creature' },
  { password: 'master01', hint: 'Default cred' },
  { password: 'shadow42', hint: 'Dark number' },
  { password: 'monkey!1', hint: 'Animal password' },
  { password: 'trustno1', hint: 'X-Files fan' },
  { password: 'abc123!@', hint: 'First grade' },
  { password: 'iloveyou', hint: 'Romantic breach' },
  { password: 'welcome1', hint: 'Front door' },
  { password: 'football', hint: 'Sports fan' },
  { password: 'princess', hint: 'Royal weakness' },
  { password: 'batman99', hint: 'Dark Knight' },
  { password: 'access14', hint: 'Permission slip' },
  { password: 'charlie!', hint: 'NATO alphabet' },
  { password: 'hello123', hint: 'Friendly start' },
  { password: 'Admin@01', hint: 'Lazy sysadmin' },
];

type Phase = 'ready' | 'playing' | 'correct' | 'locked' | 'gameover';

export default function PasswordBreakerGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [currentPassword, setCurrentPassword] = useState('');
  const [currentHint, setCurrentHint] = useState('');
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [fakeRevealed, setFakeRevealed] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(20);
  const [hintsUsed, setHintsUsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const hintTimerRef = useRef<ReturnType<typeof setInterval>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const getDifficulty = useCallback(() => {
    if (round >= 7) return 3;
    if (round >= 4) return 2;
    if (round >= 1) return 1;
    return 0;
  }, [round]);

  const startRound = useCallback(() => {
    const pool = [...PASSWORD_POOL].sort(() => Math.random() - 0.5);
    const pw = pool[round % pool.length];
    setCurrentPassword(pw.password);
    setCurrentHint(pw.hint);
    setRevealed(new Array(pw.password.length).fill(false));
    setFakeRevealed(null);
    setInput('');
    setHintsUsed(0);

    const diff = getDifficulty();
    const time = [20, 18, 15, 12][diff];
    setTimeLeft(time);

    // Start timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, time - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        clearInterval(hintTimerRef.current);
        setPhase('locked');
      }
    }, 100);

    // Start hint reveals
    const hintInterval = [2000, 2500, 3000, 3000][diff];
    hintTimerRef.current = setInterval(() => {
      setRevealed((prev) => {
        const hidden = prev.map((v, i) => ({ v, i })).filter((x) => !x.v);
        if (hidden.length <= 1) {
          clearInterval(hintTimerRef.current);
          return prev;
        }

        // Difficulty 2+: random order instead of left-to-right
        const diff = getDifficulty();
        let idx: number;
        if (diff >= 1) {
          idx = hidden[Math.floor(Math.random() * hidden.length)].i;
        } else {
          idx = hidden[0].i;
        }

        // Difficulty 3: fake hint first
        if (diff >= 3 && Math.random() < 0.3) {
          setFakeRevealed(idx);
          setTimeout(() => setFakeRevealed(null), 500);
          return prev; // Don't actually reveal
        }

        const next = [...prev];
        next[idx] = true;
        setHintsUsed((h) => h + 1);
        return next;
      });
    }, hintInterval);

    setPhase('playing');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [round, getDifficulty]);

  const startGame = () => {
    setRound(0);
    setScore(0);
    setStreak(0);
    startRound();
  };

  useEffect(() => {
    if (phase === 'playing') {
      // Cleanup on unmount
      return () => {
        clearInterval(timerRef.current);
        clearInterval(hintTimerRef.current);
      };
    }
  }, [phase]);

  const submitGuess = () => {
    if (!input.trim()) return;
    clearInterval(timerRef.current);
    clearInterval(hintTimerRef.current);

    if (input === currentPassword) {
      // Correct!
      const baseScore = 1000 - (hintsUsed * 100);
      const timeBonus = Math.floor(timeLeft * 50);
      const streakBonus = streak * 200;
      const roundScore = Math.max(100, baseScore + timeBonus + streakBonus);
      setScore((s) => s + roundScore);
      setStreak((s) => s + 1);
      setPhase('correct');
    } else {
      // Wrong - ACCOUNT LOCKED
      setPhase('locked');
    }
  };

  const nextRound = () => {
    setRound((r) => r + 1);
    startRound();
  };

  const diff = getDifficulty();

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      {/* Danmaku comments during play */}
      {phase === 'playing' && <GameComments gameId="password-breaker" mode="danmaku" />}

      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-yellow tracking-[0.3em] mb-1">PASSWORD BREAKER</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">パスワードクラッカー</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🔐"
              title="PASSWORD BREAKER"
              gameId="password-breaker"
              subtitle="パスワードクラッカー"
              controls={[
                { icon: '⌨️', label: 'TYPE', desc: 'パスワードを入力' },
                { icon: '↵', label: 'ENTER', desc: '答えを送信' },
              ]}
              rules={[
                { text: '伏せ字パスワードが表示される' },
                { text: 'ヒントが1文字ずつ開示される' },
                { text: '間違えたらACCOUNT LOCKED', highlight: true },
                { text: 'チャンスは1回だけ' },
              ]}
              tip="ヒントが少ないほど高得点。焦らず推理しろ"
              buttonText="CRACK"
              buttonColor="bg-neon-yellow text-bg-deep"
              onStart={startGame}
            />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* HUD */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              <span className="font-['Orbitron'] text-text-muted">Lv.{round + 1}</span>
              <span className={`font-['Share_Tech_Mono'] ${timeLeft <= 5 ? 'text-neon-pink animate-pulse' : 'text-neon-cyan'}`}>
                {Math.ceil(timeLeft)}s
              </span>
            </div>

            {/* Timer bar */}
            <div className="h-1 bg-bg-raised rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${timeLeft <= 5 ? 'bg-neon-pink' : 'bg-neon-yellow'}`}
                style={{ width: `${(timeLeft / [20, 18, 15, 12][diff]) * 100}%` }}
              />
            </div>

            {/* Password display */}
            <div className="bg-bg-surface border border-bg-raised rounded-xl p-6 text-center">
              <p className="text-text-muted text-[10px] font-['Orbitron'] mb-3">TARGET PASSWORD</p>

              <div className="flex justify-center gap-1 mb-4 flex-wrap">
                {currentPassword.split('').map((char, i) => (
                  <motion.span
                    key={i}
                    className={`inline-flex items-center justify-center w-9 h-12 rounded-lg font-['Share_Tech_Mono'] text-lg font-bold border ${
                      revealed[i]
                        ? 'bg-neon-yellow/20 border-neon-yellow text-neon-yellow'
                        : fakeRevealed === i
                        ? 'bg-neon-pink/20 border-neon-pink text-neon-pink'
                        : 'bg-bg-deep border-bg-raised text-text-muted'
                    }`}
                    animate={revealed[i] ? { scale: [1.2, 1] } : fakeRevealed === i ? { scale: [1.3, 1], rotate: [5, 0] } : {}}
                  >
                    {revealed[i] ? char : fakeRevealed === i ? String.fromCharCode(33 + Math.floor(Math.random() * 90)) : '●'}
                  </motion.span>
                ))}
              </div>

              <p className="text-text-muted text-xs">💡 {currentHint}</p>
              {streak > 0 && <p className="text-neon-cyan text-[10px] mt-1">🔥 {streak} streak</p>}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
                placeholder="パスワードを入力..."
                className="flex-1 px-4 py-3 bg-bg-deep border border-bg-raised rounded-lg text-text-primary font-['Share_Tech_Mono'] text-lg placeholder:text-text-muted focus:border-neon-yellow focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={submitGuess}
                disabled={!input.trim()}
                className="px-6 py-3 bg-neon-yellow text-bg-deep font-['Orbitron'] text-sm font-bold rounded-lg disabled:opacity-30"
              >
                CRACK
              </button>
            </div>

            <p className="text-text-muted text-[10px] text-center">⚠ 1回間違えたらアカウントロック。慎重に。</p>
          </motion.div>
        )}

        {phase === 'correct' && (
          <motion.div key="correct" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4 py-8">
            <motion.p className="text-6xl" animate={{ rotate: [0, 360] }} transition={{ duration: 0.5 }}>🔓</motion.p>
            <p className="font-['Orbitron'] text-neon-cyan font-bold text-lg">ACCESS GRANTED</p>
            <p className="font-['Share_Tech_Mono'] text-neon-yellow">{currentPassword}</p>
            <p className="text-text-muted text-xs">
              ヒント{hintsUsed}個で解読 | 残り{Math.ceil(timeLeft)}秒
            </p>
            <button onClick={nextRound} className="px-8 py-3 bg-neon-yellow text-bg-deep font-['Orbitron'] text-sm font-bold rounded-lg">
              NEXT TARGET
            </button>
          </motion.div>
        )}

        {phase === 'locked' && (
          <motion.div key="locked" initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="password-breaker"
              gameName="PASSWORD BREAKER"
              icon="🔐"
              score={score}
              level={round + 1}
              deathReason="ACCOUNT LOCKED"
              extraInfo={`${streak} streak | ${input ? `入力: "${input}"` : 'TIME OUT'}`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
