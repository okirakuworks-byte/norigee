import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

type Phase = 'ready' | 'playing' | 'gameover';

interface Noodle {
  id: number;
  x: number;
  y: number;
  wobbleAmp: number;
  wobbleSpeed: number;
  speed: number;
  isFake: boolean;
  thickness: number;
}

let noodleId = 0;

export default function NoodleCatchGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [noodles, setNoodles] = useState<Noodle[]>([]);
  const [chopsticksClosed, setChopsticksClosed] = useState(false);
  const [catchFlash, setCatchFlash] = useState(false);
  const noodlesRef = useRef<Noodle[]>([]);
  const frameRef = useRef<number>();
  const spawnRef = useRef<ReturnType<typeof setInterval>>();
  const startRef = useRef(0);
  const phaseRef = useRef<Phase>('ready');
  const missesRef = useRef(0);

  const CATCH_ZONE_Y = 380;
  const FIELD_W = 300;

  const getDifficulty = useCallback(() => {
    const elapsed = (Date.now() - startRef.current) / 1000;
    if (elapsed >= 30) return 3;
    if (elapsed >= 15) return 2;
    return 1;
  }, []);

  const spawnNoodle = useCallback(() => {
    const diff = getDifficulty();
    const n: Noodle = {
      id: ++noodleId,
      x: 50 + Math.random() * (FIELD_W - 100),
      y: -30,
      wobbleAmp: diff >= 2 ? 20 + Math.random() * 30 : 5,
      wobbleSpeed: 2 + Math.random() * 3,
      speed: 1 + diff * 0.5 + Math.random() * 0.5,
      isFake: diff >= 2 && Math.random() < 0.2,
      thickness: diff >= 2 ? 2 + Math.random() * 2 : 4 + Math.random() * 3,
    };
    noodlesRef.current = [...noodlesRef.current, n];
  }, [getDifficulty]);

  const start = () => {
    noodleId = 0;
    setScore(0);
    setMisses(0);
    missesRef.current = 0;
    setCombo(0);
    setNoodles([]);
    noodlesRef.current = [];
    startRef.current = Date.now();
    phaseRef.current = 'playing';
    setPhase('playing');
  };

  // Game loop
  useEffect(() => {
    if (phase !== 'playing') return;
    const loop = () => {
      if (phaseRef.current !== 'playing') return;
      const t = Date.now() / 1000;

      noodlesRef.current = noodlesRef.current.map((n) => ({
        ...n,
        y: n.y + n.speed,
        x: n.x + Math.sin(t * n.wobbleSpeed) * n.wobbleAmp * 0.03,
      }));

      // Remove fallen noodles
      const fallen = noodlesRef.current.filter((n) => n.y > CATCH_ZONE_Y + 60);
      if (fallen.length > 0) {
        const realFallen = fallen.filter((n) => !n.isFake);
        if (realFallen.length > 0) {
          missesRef.current += realFallen.length;
          setMisses(missesRef.current);
          setCombo(0);
          if (missesRef.current >= 5) {
            phaseRef.current = 'gameover';
            setPhase('gameover');
            return;
          }
        }
        noodlesRef.current = noodlesRef.current.filter((n) => n.y <= CATCH_ZONE_Y + 60);
      }

      setNoodles([...noodlesRef.current]);
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [phase]);

  // Spawner
  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = () => {
      const diff = getDifficulty();
      clearInterval(spawnRef.current);
      spawnRef.current = setInterval(() => {
        if (phaseRef.current === 'playing') spawnNoodle();
      }, [1200, 800, 500][diff - 1]);
    };
    tick();
    const check = setInterval(tick, 5000);
    return () => { clearInterval(spawnRef.current); clearInterval(check); };
  }, [phase, getDifficulty, spawnNoodle]);

  const catchNoodle = () => {
    if (phase !== 'playing') return;
    setChopsticksClosed(true);
    setTimeout(() => setChopsticksClosed(false), 200);

    // Check if any noodle is in catch zone
    const catchRange = 25;
    const caught = noodlesRef.current.find(
      (n) => Math.abs(n.y - CATCH_ZONE_Y) < catchRange && !n.isFake
    );
    const caughtFake = noodlesRef.current.find(
      (n) => Math.abs(n.y - CATCH_ZONE_Y) < catchRange && n.isFake
    );

    if (caughtFake) {
      // Caught fake (konnyaku) - penalty
      noodlesRef.current = noodlesRef.current.filter((n) => n.id !== caughtFake.id);
      setCombo(0);
      missesRef.current += 1;
      setMisses(missesRef.current);
      setCatchFlash(false);
    } else if (caught) {
      noodlesRef.current = noodlesRef.current.filter((n) => n.id !== caught.id);
      const multiplier = combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1;
      setScore((s) => s + Math.floor(100 * multiplier));
      setCombo((c) => c + 1);
      setCatchFlash(true);
      setTimeout(() => setCatchFlash(false), 200);
    }
  };

  const diff = getDifficulty();

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-yellow tracking-[0.3em] mb-1">NOODLE CATCH</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">麺キャッチ</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🍜"
              title="NOODLE CATCH"
              gameId="noodle-catch"
              subtitle="麺キャッチ"
              controls={[
                { icon: '👆', label: 'TAP', desc: 'お箸でキャッチ' },
              ]}
              rules={[
                { text: '落ちてくる麺をタップでキャッチ' },
                { text: '5回落としたらのびた', highlight: true },
                { text: 'Lv.2〜 麺が揺れる+蒟蒻混入' },
                { text: '蒟蒻を掴んだらミスカウント', highlight: true },
              ]}
              tip="Lv.3〜 湯気で視界が悪くなる。気配で感じろ"
              buttonText="いただきます"
              buttonColor="bg-neon-yellow text-bg-deep"
              onStart={start}
            />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              <span className="text-text-muted">MISS: {misses}/5</span>
              {combo >= 3 && <span className="text-neon-cyan animate-pulse">🔥{combo}</span>}
            </div>

            {/* Game field */}
            <div
              className="relative bg-bg-deep border-2 border-bg-raised rounded-xl overflow-hidden mx-auto cursor-pointer"
              style={{ width: FIELD_W, height: 450 }}
              onClick={catchNoodle}
              onTouchStart={(e) => { e.preventDefault(); catchNoodle(); }}
            >
              <GameComments gameId="noodle-catch" mode="danmaku" />
              {/* Steam overlay for Lv3 */}
              {diff >= 3 && (
                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 pointer-events-none z-10" />
              )}

              {/* Noodles */}
              {noodles.map((n) => (
                <div
                  key={n.id}
                  className="absolute"
                  style={{
                    left: n.x,
                    top: n.y,
                    opacity: n.isFake ? 0.5 : (diff >= 3 ? 0.7 : 1),
                  }}
                >
                  <div
                    className={`rounded-full ${n.isFake ? 'bg-gray-500' : 'bg-neon-yellow'}`}
                    style={{
                      width: n.thickness,
                      height: 40 + Math.random() * 10,
                      transform: `rotate(${Math.sin(Date.now() / 300 * n.wobbleSpeed) * 10}deg)`,
                    }}
                  />
                  {n.isFake && <span className="text-[6px] text-gray-500 absolute -top-2 left-0">蒟蒻</span>}
                </div>
              ))}

              {/* Chopsticks / catch zone */}
              <div
                className="absolute left-0 right-0 flex justify-center gap-1"
                style={{ top: CATCH_ZONE_Y - 20 }}
              >
                <motion.div
                  className="w-1 h-12 bg-amber-700 rounded-full origin-bottom"
                  animate={{ rotate: chopsticksClosed ? 5 : 15 }}
                  transition={{ duration: 0.1 }}
                />
                <motion.div
                  className="w-1 h-12 bg-amber-700 rounded-full origin-bottom"
                  animate={{ rotate: chopsticksClosed ? -5 : -15 }}
                  transition={{ duration: 0.1 }}
                />
              </div>

              {/* Catch zone line */}
              <div
                className={`absolute left-0 right-0 h-px ${catchFlash ? 'bg-neon-cyan shadow-[0_0_10px_rgba(0,245,212,0.5)]' : 'bg-bg-raised/30'}`}
                style={{ top: CATCH_ZONE_Y }}
              />

              {catchFlash && (
                <motion.p
                  initial={{ scale: 2, opacity: 1 }}
                  animate={{ scale: 0.5, opacity: 0 }}
                  className="absolute text-neon-cyan font-['Orbitron'] text-xs font-bold"
                  style={{ top: CATCH_ZONE_Y - 30, left: '40%' }}
                >
                  CATCH!
                </motion.p>
              )}
            </div>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="noodle-catch"
              gameName="NOODLE CATCH"
              icon="🍜"
              score={score}
              level={getDifficulty()}
              deathReason="のびた — 麺がのびて食えたもんじゃない"
              extraInfo={`max combo: ${combo}`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
