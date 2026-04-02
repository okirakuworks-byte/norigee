import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

type Phase = 'ready' | 'playing' | 'stopped' | 'gameover';

export default function ElevatorHellGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [currentFloor, setCurrentFloor] = useState(1);
  const [targetFloor, setTargetFloor] = useState(5);
  const [speed, setSpeed] = useState(0.5);
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [glitch, setGlitch] = useState(false);
  const [result, setResult] = useState<'perfect' | 'close' | 'miss' | null>(null);
  const [round, setRound] = useState(0);
  const floorRef = useRef(1);
  const speedRef = useRef(0.5);
  const directionRef = useRef<'up' | 'down'>('up');
  const targetRef = useRef(5);
  const frameRef = useRef<number>();
  const phaseRef = useRef<Phase>('ready');
  const livesRef = useRef(3);

  const getDifficulty = useCallback(() => {
    if (round >= 6) return 3;
    if (round >= 3) return 2;
    return 1;
  }, [round]);

  const startRound = useCallback(() => {
    const diff = getDifficulty();
    const target = 3 + Math.floor(Math.random() * (10 + round * 2));
    targetRef.current = target;
    setTargetFloor(target);
    floorRef.current = 1;
    setCurrentFloor(1);
    directionRef.current = 'up';
    setDirection('up');
    speedRef.current = 0.3 + diff * 0.2;
    setSpeed(speedRef.current);
    setResult(null);
    setGlitch(false);
    phaseRef.current = 'playing';
    setPhase('playing');
  }, [getDifficulty, round]);

  const start = () => {
    setScore(0);
    setLives(3);
    livesRef.current = 3;
    setRound(0);
    startRound();
  };

  // Game loop
  useEffect(() => {
    if (phase !== 'playing') return;

    const loop = () => {
      if (phaseRef.current !== 'playing') return;
      const diff = getDifficulty();

      // Acceleration
      speedRef.current = Math.min(3, speedRef.current + 0.002 + diff * 0.001);

      // Direction changes at Lv3
      if (diff >= 3 && Math.random() < 0.003) {
        directionRef.current = directionRef.current === 'up' ? 'down' : 'up';
        setDirection(directionRef.current);
      }

      // Move
      const delta = directionRef.current === 'up' ? speedRef.current * 0.05 : -speedRef.current * 0.05;
      floorRef.current += delta;

      // Glitch display at Lv2+
      if (diff >= 2 && Math.random() < 0.01) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 200);
      }

      // Target change at Lv3
      if (diff >= 3 && Math.random() < 0.002 && Math.abs(floorRef.current - targetRef.current) < 5) {
        targetRef.current = targetRef.current + (Math.random() > 0.5 ? 2 : -2);
        setTargetFloor(Math.max(1, Math.round(targetRef.current)));
      }

      // Bounds
      if (floorRef.current > targetRef.current + 10) {
        phaseRef.current = 'gameover';
        setPhase('gameover');
        return;
      }
      if (floorRef.current < 0) floorRef.current = 0;

      setCurrentFloor(floorRef.current);
      setSpeed(speedRef.current);
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [phase, getDifficulty]);

  const brake = () => {
    if (phase !== 'playing') return;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    phaseRef.current = 'stopped';

    // Apply inertia (brake doesn't stop instantly)
    const diff = getDifficulty();
    const inertia = diff >= 2 ? speedRef.current * 0.8 : speedRef.current * 0.3;
    const finalFloor = floorRef.current + (directionRef.current === 'up' ? inertia : -inertia);
    floorRef.current = finalFloor;
    setCurrentFloor(finalFloor);

    // Check accuracy
    const distance = Math.abs(finalFloor - targetRef.current);
    if (distance < 0.3) {
      setResult('perfect');
      setScore((s) => s + 500 + round * 100);
    } else if (distance < 1.5) {
      setResult('close');
      setScore((s) => s + 200);
    } else {
      setResult('miss');
      livesRef.current -= 1;
      setLives(livesRef.current);
      if (livesRef.current <= 0) {
        setPhase('gameover');
        return;
      }
    }
    setPhase('stopped');
  };

  const nextRound = () => {
    setRound((r) => r + 1);
    startRound();
  };

  const displayFloor = glitch
    ? Math.floor(Math.random() * 99)
    : Math.max(1, Math.round(currentFloor));

  const diff = getDifficulty();

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-cyan tracking-[0.3em] mb-1">ELEVATOR HELL</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">エレベーター地獄</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🛗"
              title="ELEVATOR HELL"
              gameId="elevator-hell"
              subtitle="エレベーター地獄"
              controls={[
                { icon: '🛑', label: 'BRAKE', desc: '目標階でブレーキ' },
              ]}
              rules={[
                { text: '目標階でピタリ止めろ' },
                { text: 'ブレーキには慣性がある', highlight: true },
                { text: 'Lv.2〜 表示がグリッチする' },
                { text: 'Lv.3〜 方向転換+目標変更', highlight: true },
              ]}
              tip="速度が上がるほど慣性が大きくなる。早めにブレーキを"
              buttonText="GOING UP"
              buttonColor="bg-neon-cyan text-bg-deep"
              onStart={start}
            />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <GameComments gameId="elevator-hell" mode="danmaku" />
            <div className="flex items-center justify-between text-xs mb-4">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              <span>{'❤️'.repeat(Math.max(0, lives))}{'🖤'.repeat(Math.max(0, 3 - lives))}</span>
              <span className="font-['Orbitron'] text-text-muted">R{round + 1}</span>
            </div>

            {/* Elevator display */}
            <div className="bg-bg-surface border-2 border-bg-raised rounded-2xl p-8 text-center relative overflow-hidden">
              {/* Direction indicator */}
              <p className="text-neon-cyan text-xs font-['Orbitron'] mb-2">
                {direction === 'up' ? '▲ GOING UP' : '▼ GOING DOWN'}
              </p>

              {/* Current floor */}
              <motion.p
                className={`font-['Orbitron'] text-7xl font-black mb-2 ${
                  glitch ? 'text-neon-pink' : 'text-text-primary'
                }`}
                animate={glitch ? { x: [-2, 2, -2], opacity: [1, 0.5, 1] } : {}}
                transition={{ duration: 0.1 }}
              >
                {displayFloor}F
              </motion.p>

              {/* Target */}
              <div className="bg-bg-deep rounded-lg px-4 py-2 inline-block">
                <span className="text-text-muted text-xs">TARGET: </span>
                <span className="font-['Orbitron'] text-neon-yellow font-bold text-xl">{targetFloor}F</span>
              </div>

              {/* Speed indicator */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="text-text-muted text-[10px]">SPEED:</span>
                <div className="w-32 h-2 bg-bg-deep rounded-full overflow-hidden">
                  <div
                    className={`h-full ${speed > 2 ? 'bg-neon-pink' : 'bg-neon-cyan'}`}
                    style={{ width: `${Math.min(100, (speed / 3) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Distance to target */}
              <p className="text-text-muted text-[10px] mt-2 font-['Share_Tech_Mono']">
                {Math.abs(currentFloor - targetFloor) < 3 ? '⚠ APPROACHING' : ''}
                {diff >= 2 && ' | INERTIA: HIGH'} {diff >= 3 && ' | ⚡ UNSTABLE'}
              </p>
            </div>

            {/* Brake button */}
            <motion.button
              onClick={brake}
              className="w-full mt-6 py-6 bg-neon-pink text-white font-['Orbitron'] font-bold text-2xl rounded-xl active:scale-95 transition-transform"
              whileTap={{ scale: 0.95 }}
            >
              🛑 BRAKE
            </motion.button>
          </motion.div>
        )}

        {phase === 'stopped' && result && (
          <motion.div key="stopped" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4 py-8">
            <p className="text-6xl">{result === 'perfect' ? '🎯' : result === 'close' ? '👍' : '😵'}</p>
            <p className={`font-['Orbitron'] font-bold text-lg ${
              result === 'perfect' ? 'text-neon-cyan' : result === 'close' ? 'text-neon-yellow' : 'text-neon-pink'
            }`}>
              {result === 'perfect' ? 'PERFECT STOP!' : result === 'close' ? 'CLOSE ENOUGH' : 'WRONG FLOOR'}
            </p>
            <p className="font-['Share_Tech_Mono'] text-text-muted text-sm">
              Stopped at {Math.round(currentFloor * 10) / 10}F (target: {targetFloor}F)
            </p>
            <button onClick={nextRound} className="px-8 py-3 bg-neon-cyan text-bg-deep font-['Orbitron'] text-sm font-bold rounded-lg">
              NEXT FLOOR
            </button>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <GameResult
              gameId="elevator-hell"
              gameName="ELEVATOR HELL"
              icon="🛗"
              score={score}
              level={round + 1}
              deathReason="屋上を突き破った — 建築基準法違反"
              extraInfo={`Round ${round + 1}`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
