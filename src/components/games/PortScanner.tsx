import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

interface Server {
  id: number;
  port: number;
  x: number;
  y: number;
  isOpen: boolean;
  isHoneypot: boolean;
  openTimer: ReturnType<typeof setTimeout> | null;
}

type Phase = 'ready' | 'playing' | 'gameover';

const PORTS = [22, 80, 443, 3306, 5432, 8080, 8443, 3000, 6379, 27017, 9200, 1433];

function randomPort(): number {
  return PORTS[Math.floor(Math.random() * PORTS.length)];
}

function randomPos(max: number): number {
  return 10 + Math.floor(Math.random() * (max - 20));
}

export default function PortScannerGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [servers, setServers] = useState<Server[]>([]);
  const [blocked, setBlocked] = useState(0);
  const [deathReason, setDeathReason] = useState('');
  const [difficulty, setDifficulty] = useState(0); // 0-3 phases
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const openIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef(0);

  const initServers = useCallback((count: number, honeypots: number) => {
    const s: Server[] = [];
    for (let i = 0; i < count; i++) {
      s.push({
        id: i,
        port: randomPort(),
        x: randomPos(90),
        y: randomPos(80),
        isOpen: false,
        isHoneypot: i < honeypots,
        openTimer: null,
      });
    }
    // Shuffle so honeypots aren't always first
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  }, []);

  const start = () => {
    setScore(0);
    setCombo(0);
    setBlocked(0);
    setTimeLeft(60);
    setDifficulty(0);
    setDeathReason('');
    startTimeRef.current = Date.now();
    setServers(initServers(6, 0));
    setPhase('playing');
  };

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return;
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, 60 - elapsed);
      setTimeLeft(remaining);

      // Difficulty phases
      if (elapsed > 45) setDifficulty(3);
      else if (elapsed > 30) setDifficulty(2);
      else if (elapsed > 15) setDifficulty(1);

      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        setPhase('gameover');
        setDeathReason('TIME UP');
      }
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [phase]);

  // Update servers based on difficulty
  useEffect(() => {
    if (phase !== 'playing') return;
    const honeypots = [0, 1, 2, 3][difficulty];
    const count = [6, 8, 10, 10][difficulty];
    setServers(initServers(count, honeypots));
  }, [difficulty, phase, initServers]);

  // Open random servers periodically
  useEffect(() => {
    if (phase !== 'playing') return;
    const openDuration = [1500, 800, 500, 300][difficulty];
    const openInterval = [2000, 1500, 1000, 800][difficulty];

    openIntervalRef.current = setInterval(() => {
      setServers((prev) => {
        const closed = prev.filter((s) => !s.isOpen);
        if (closed.length === 0) return prev;
        const target = closed[Math.floor(Math.random() * closed.length)];

        // Move servers in later phases
        const shouldMove = difficulty >= 2;

        return prev.map((s) => {
          if (s.id === target.id) {
            return { ...s, isOpen: true, ...(shouldMove ? { x: randomPos(90), y: randomPos(80) } : {}) };
          }
          return s;
        });
      });

      // Close after duration
      setTimeout(() => {
        setServers((prev) => prev.map((s) => ({ ...s, isOpen: false })));
      }, openDuration);
    }, openInterval);

    return () => clearInterval(openIntervalRef.current);
  }, [phase, difficulty]);

  const clickServer = (server: Server) => {
    if (phase !== 'playing') return;

    if (server.isHoneypot && server.isOpen) {
      // HONEYPOT - instant death
      clearInterval(intervalRef.current);
      clearInterval(openIntervalRef.current);
      setDeathReason(`HONEYPOT ACTIVATED on port ${server.port}`);
      setScore((s) => Math.floor(s / 2));
      setPhase('gameover');
      return;
    }

    if (server.isOpen) {
      // Success!
      const comboMultiplier = combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1;
      setScore((s) => s + Math.floor(100 * comboMultiplier));
      setCombo((c) => c + 1);
      setServers((prev) => prev.map((s) =>
        s.id === server.id ? { ...s, isOpen: false } : s
      ));
    } else {
      // BLOCKED
      setBlocked((b) => b + 1);
      setScore((s) => Math.max(0, s - 50));
      setCombo(0);
    }
  };

  const getServerColor = (server: Server) => {
    if (!server.isOpen) return 'bg-bg-raised border-bg-raised';
    if (server.isHoneypot) {
      // Slightly different green - the trap
      return 'bg-[#2a7a3a] border-[#3a9a4a] shadow-[0_0_15px_rgba(50,180,70,0.5)]';
    }
    return 'bg-[#1a6a2a] border-[#2a8a3a] shadow-[0_0_15px_rgba(0,200,50,0.5)]';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-cyan tracking-[0.3em] mb-1">PORT SCANNER</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">ポートスキャナー</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🔍"
              title="PORT SCANNER"
              gameId="port-scanner"
              subtitle="ポートスキャナー"
              controls={[
                { icon: '👆', label: 'CLICK', desc: 'OPENサーバーを叩く' },
              ]}
              rules={[
                { text: 'OPEN が光った瞬間にクリックしろ' },
                { text: 'CLOSEDを叩くとBLOCKED（-50点）' },
                { text: 'HONEYPOTは即死。微妙に色が違う', highlight: true },
                { text: '60秒。生き残れ。' },
              ]}
              tip="Phase4でブラックアウト。色の差を見極めろ"
              buttonText="SCAN"
              buttonColor="bg-neon-cyan text-bg-deep"
              onStart={start}
            />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* HUD */}
            <div className="flex items-center justify-between mb-4 text-xs">
              <span className="font-['Share_Tech_Mono'] text-neon-cyan">SCORE: {score}</span>
              {combo >= 3 && <span className="font-['Orbitron'] text-neon-yellow animate-pulse">x{combo >= 5 ? '2.0' : '1.5'} COMBO</span>}
              <span className={`font-['Share_Tech_Mono'] ${timeLeft <= 15 ? 'text-neon-pink animate-pulse' : 'text-text-muted'}`}>
                {Math.ceil(timeLeft)}s
              </span>
            </div>

            {/* Timer bar */}
            <div className="h-1 bg-bg-raised rounded-full overflow-hidden mb-4">
              <div className="h-full bg-neon-cyan transition-all duration-100" style={{ width: `${(timeLeft / 60) * 100}%` }} />
            </div>

            {/* Game field */}
            <div
              className="relative bg-bg-deep border border-bg-raised rounded-xl overflow-hidden"
              style={{ height: '400px' }}
            >
              <GameComments gameId="port-scanner" mode="danmaku" />

              {/* Blackout overlay for phase 3 */}
              {difficulty >= 3 && (
                <div className="absolute inset-0 pointer-events-none z-10">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute bg-bg-deep"
                      style={{ width: '30%', height: '30%' }}
                      animate={{
                        x: [randomPos(70) + '%', randomPos(70) + '%'],
                        y: [randomPos(70) + '%', randomPos(70) + '%'],
                      }}
                      transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse', delay: i * 0.5 }}
                    />
                  ))}
                </div>
              )}

              {servers.map((server) => (
                <motion.button
                  key={server.id}
                  onClick={() => clickServer(server)}
                  className={`absolute w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center transition-colors duration-150 cursor-pointer ${getServerColor(server)}`}
                  style={{ left: `${server.x}%`, top: `${server.y}%` }}
                  animate={difficulty >= 2 ? { left: `${server.x}%`, top: `${server.y}%` } : {}}
                  transition={{ duration: 0.5 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <span className="text-lg">🖥️</span>
                  <span className="font-['Share_Tech_Mono'] text-[9px] text-text-muted">
                    :{server.port}
                  </span>
                  {server.isOpen && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 text-[8px] font-['Orbitron'] text-green-400 bg-bg-deep px-1 rounded"
                    >
                      OPEN
                    </motion.span>
                  )}
                </motion.button>
              ))}
            </div>

            {/* Phase indicator */}
            <p className="text-center text-text-muted text-[10px] mt-2 font-['Share_Tech_Mono']">
              PHASE {difficulty + 1}/4 {difficulty >= 1 && '⚠ HONEYPOTS'} {difficulty >= 2 && '🔄 MOVING'} {difficulty >= 3 && '🌑 BLACKOUT'}
            </p>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div
            key="gameover"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <GameResult
              gameId="port-scanner"
              gameName="PORT SCANNER"
              icon="🔍"
              score={score}
              level={difficulty + 1}
              deathReason={deathReason.includes('HONEYPOT') ? 'HONEYPOT ACTIVATED — YOUR IP HAS BEEN LOGGED' : 'TIME UP — SCAN COMPLETE'}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
