import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

type Phase = 'ready' | 'playing' | 'victory' | 'defeat';

// Boss attacks that mess with the player
interface BossAttack {
  type: 'shake' | 'flip' | 'blur' | 'scramble' | 'shrink';
  duration: number;
}

const BOSS_WORDS = [
  'FIREWALL', 'MALWARE', 'PHISHING', 'RANSOMWARE', 'EXPLOIT',
  'TROJAN', 'ROOTKIT', 'BOTNET', 'KEYLOGGER', 'SPYWARE',
  'BACKDOOR', 'WORM', 'ADWARE', 'HIJACK', 'PAYLOAD',
  'CRYPTOJACK', 'SHELLCODE', 'OVERFLOW', 'INJECTION', 'BRUTE',
];

export default function WeeklyBossGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [bossHp, setBossHp] = useState(100);
  const [playerHp, setPlayerHp] = useState(100);
  const [score, setScore] = useState(0);
  const [word, setWord] = useState('');
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(5);
  const [bossLevel, setBossLevel] = useState(1);
  const [activeAttack, setActiveAttack] = useState<BossAttack | null>(null);
  const [combo, setCombo] = useState(0);
  const [bossName, setBossName] = useState('SCRIPT KIDDIE');
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const attackRef = useRef<ReturnType<typeof setInterval>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const BOSS_NAMES = ['SCRIPT KIDDIE', 'WORM MASTER', 'ROOTKIT KING', 'APT OVERLORD', 'ZERO DAY GOD'];

  const getTimeLimit = useCallback(() => Math.max(2, 5 - bossLevel * 0.5), [bossLevel]);

  const nextWord = useCallback(() => {
    const w = BOSS_WORDS[Math.floor(Math.random() * BOSS_WORDS.length)];
    setWord(w);
    setInput('');
    const limit = getTimeLimit();
    setTimeLeft(limit);
    clearInterval(timerRef.current);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const r = Math.max(0, limit - (Date.now() - start) / 1000);
      setTimeLeft(r);
      if (r <= 0) {
        clearInterval(timerRef.current);
        setPlayerHp((h) => {
          const dmg = 15 + bossLevel * 5;
          const next = Math.max(0, h - dmg);
          if (next <= 0) setPhase('defeat');
          return next;
        });
        setCombo(0);
        nextWord();
      }
    }, 50);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [bossLevel, getTimeLimit]);

  const startBossAttacks = useCallback(() => {
    attackRef.current = setInterval(() => {
      const attacks: BossAttack['type'][] = ['shake'];
      if (bossLevel >= 2) attacks.push('flip', 'blur');
      if (bossLevel >= 3) attacks.push('scramble', 'shrink');
      const type = attacks[Math.floor(Math.random() * attacks.length)];
      const duration = 1000 + Math.random() * 1500;
      setActiveAttack({ type, duration });
      setTimeout(() => setActiveAttack(null), duration);
    }, 3000 - bossLevel * 300);
  }, [bossLevel]);

  const start = () => {
    setBossHp(100);
    setPlayerHp(100);
    setScore(0);
    setCombo(0);
    setBossLevel(1);
    setBossName(BOSS_NAMES[0]);
    setActiveAttack(null);
    setPhase('playing');
    nextWord();
    startBossAttacks();
  };

  // Check input
  useEffect(() => {
    if (phase !== 'playing') return;
    if (input.toUpperCase() === word) {
      clearInterval(timerRef.current);
      const damage = 10 + combo * 2 + Math.floor(timeLeft * 3);
      setScore((s) => s + damage * 10);
      setCombo((c) => c + 1);
      setBossHp((h) => {
        const next = Math.max(0, h - damage);
        if (next <= 0) {
          if (bossLevel >= 5) {
            setPhase('victory');
            clearInterval(attackRef.current);
          } else {
            setBossLevel((l) => {
              const nl = l + 1;
              setBossName(BOSS_NAMES[Math.min(nl - 1, BOSS_NAMES.length - 1)]);
              setBossHp(100);
              return nl;
            });
          }
        }
        return next;
      });
      nextWord();
    }
  }, [input, word, phase, timeLeft, combo, bossLevel, nextWord]);

  useEffect(() => () => { clearInterval(timerRef.current); clearInterval(attackRef.current); }, []);

  const getAttackStyle = (): string => {
    if (!activeAttack) return '';
    switch (activeAttack.type) {
      case 'shake': return 'animate-[shake_0.1s_infinite]';
      case 'flip': return 'scale-x-[-1]';
      case 'blur': return 'blur-[2px]';
      case 'shrink': return 'scale-75';
      default: return '';
    }
  };

  const displayWord = activeAttack?.type === 'scramble'
    ? word.split('').sort(() => Math.random() - 0.5).join('')
    : word;

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      {/* Danmaku comments during play */}
      {phase === 'playing' && <GameComments gameId="weekly-boss" mode="danmaku" />}

      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-pink tracking-[0.3em] mb-1">WEEKLY BOSS</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">ボスバトル</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="👹"
              title="WEEKLY BOSS"
              gameId="weekly-boss"
              subtitle="ボスバトル"
              controls={[
                { icon: '⌨️', label: 'TYPE', desc: 'ワードを入力' },
              ]}
              rules={[
                { text: 'ボスのワードを正確にタイプしてダメージを与えろ' },
                { text: '制限時間内に打てないとボスが攻撃してくる', highlight: true },
                { text: 'ボスは画面を揺らす・反転・ぼかす・文字をシャッフルする', highlight: true },
                { text: '5体のボスを倒せばクリア' },
              ]}
              tip="コンボを繋げるとダメージが増加する"
              buttonText="FIGHT"
              buttonColor="bg-neon-pink text-white"
              onStart={start}
            />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Boss info */}
            <div className="text-center mb-3">
              <p className="font-['Orbitron'] text-neon-pink text-xs">Lv.{bossLevel} {bossName}</p>
              <div className="h-3 bg-bg-raised rounded-full overflow-hidden mt-1 max-w-xs mx-auto">
                <div className="h-full bg-neon-pink transition-all duration-300" style={{ width: `${bossHp}%` }} />
              </div>
              <p className="text-[10px] text-text-muted mt-1">BOSS HP: {Math.ceil(bossHp)}%</p>
            </div>

            {/* Boss emoji */}
            <div className="text-center mb-4">
              <motion.p
                className="text-5xl inline-block"
                animate={activeAttack?.type === 'shake' ? { x: [-3, 3, -3] } : {}}
                transition={{ duration: 0.1, repeat: Infinity }}
              >
                {bossLevel <= 2 ? '👹' : bossLevel <= 4 ? '☠️' : '💀'}
              </motion.p>
              {activeAttack && (
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-neon-pink text-[10px] font-['Orbitron'] mt-1"
                >
                  {activeAttack.type === 'shake' && '🌀 EARTHQUAKE!'}
                  {activeAttack.type === 'flip' && '🔄 MIRROR!'}
                  {activeAttack.type === 'blur' && '💨 SMOKE!'}
                  {activeAttack.type === 'scramble' && '🔀 SCRAMBLE!'}
                  {activeAttack.type === 'shrink' && '🔍 SHRINK!'}
                </motion.p>
              )}
            </div>

            {/* Word to type */}
            <div className={`bg-bg-surface border border-bg-raised rounded-xl p-6 text-center mb-4 transition-all ${getAttackStyle()}`}>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className={`font-['Share_Tech_Mono'] ${timeLeft <= 1.5 ? 'text-neon-pink animate-pulse' : 'text-neon-cyan'}`}>
                  {timeLeft.toFixed(1)}s
                </span>
                {combo >= 3 && <span className="text-neon-yellow">🔥{combo} COMBO</span>}
                <span className="text-text-muted font-['Share_Tech_Mono']">SCORE: {score}</span>
              </div>

              <div className="h-1 bg-bg-raised rounded-full overflow-hidden mb-4">
                <div className={`h-full transition-all ${timeLeft <= 1.5 ? 'bg-neon-pink' : 'bg-neon-cyan'}`} style={{ width: `${(timeLeft / getTimeLimit()) * 100}%` }} />
              </div>

              <p className="font-['Share_Tech_Mono'] text-2xl font-bold tracking-wider mb-4">
                {displayWord.split('').map((c, i) => (
                  <span key={i} className={i < input.length ? (input[i]?.toUpperCase() === word[i] ? 'text-neon-cyan' : 'text-neon-pink') : 'text-text-primary'}>
                    {c}
                  </span>
                ))}
              </p>

              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full px-4 py-2 bg-bg-deep border border-bg-raised rounded-lg text-neon-cyan font-['Share_Tech_Mono'] text-center text-lg focus:border-neon-pink focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Player HP */}
            <div className="flex items-center gap-2">
              <span className="text-text-muted text-[10px]">YOU</span>
              <div className="flex-1 h-2 bg-bg-raised rounded-full overflow-hidden">
                <div className={`h-full transition-all ${playerHp <= 30 ? 'bg-neon-pink' : 'bg-neon-cyan'}`} style={{ width: `${playerHp}%` }} />
              </div>
              <span className="text-text-muted text-[10px]">{Math.ceil(playerHp)}%</span>
            </div>
          </motion.div>
        )}

        {phase === 'victory' && (
          <motion.div key="victory" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="weekly-boss"
              gameName="WEEKLY BOSS"
              icon="👹"
              score={score}
              level={bossLevel}
              extraInfo={`残りHP: ${Math.ceil(playerHp)}%`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}

        {phase === 'defeat' && (
          <motion.div key="defeat" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="weekly-boss"
              gameName="WEEKLY BOSS"
              icon="👹"
              score={score}
              level={bossLevel}
              deathReason={`YOU DIED — Lv.${bossLevel} ${bossName} に敗北`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
      `}</style>
    </div>
  );
}
