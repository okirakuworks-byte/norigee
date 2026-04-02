import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

// Zone config per round: degrees of target zone out of 360
const ROUNDS = [
  { zoneSize: 90, label: '1/4', roundLabel: 'ROUND 1' },
  { zoneSize: 45, label: '1/8', roundLabel: 'ROUND 2' },
  { zoneSize: 22.5, label: '1/16', roundLabel: 'ROUND 3' },
  { zoneSize: 11.25, label: '1/32', roundLabel: 'ROUND 4' },
];

const WINS_NEEDED = 3;
const TRIES_PER_ROUND = 5;
// Target zone is always at angle 0 (top of the wheel — where the pointer is)
const TARGET_ZONE_START = 0;

type Phase = 'ready' | 'spinning' | 'pending' | 'result' | 'roundclear' | 'gameover' | 'clear';

interface RoundState {
  roundIdx: number;
  tries: number;
  wins: number;
  totalWins: number;
  totalTries: number;
}

function normalizeAngle(a: number): number {
  return ((a % 360) + 360) % 360;
}

function isInZone(pointerAngle: number, zoneSize: number): boolean {
  // The pointer is fixed at the top; wheel rotates.
  // "Pointer angle relative to wheel" = -wheelAngle (mod 360)
  // Target zone on wheel: 0 to zoneSize degrees
  const rel = normalizeAngle(pointerAngle);
  return rel >= TARGET_ZONE_START && rel <= TARGET_ZONE_START + zoneSize;
}

export default function SpinTheWheel() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [showIntro, setShowIntro] = useState(true);
  const [roundState, setRoundState] = useState<RoundState>({
    roundIdx: 0, tries: 0, wins: 0, totalWins: 0, totalTries: 0,
  });
  const [wheelRotation, setWheelRotation] = useState(0);
  const [finalAngle, setFinalAngle] = useState<number | null>(null);
  const [hit, setHit] = useState<boolean | null>(null);
  const [lagMs, setLagMs] = useState(0);

  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const velocityRef = useRef(0); // deg/ms
  const currentAngleRef = useRef(0);
  const phaseRef = useRef<Phase>('ready');
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  phaseRef.current = phase;

  const cancelAnim = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (pendingTimeoutRef.current !== null) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelAnim(), [cancelAnim]);

  // Run the spin animation loop
  const runSpin = useCallback((prevTime: number) => {
    const now = performance.now();
    const dt = now - prevTime;

    if (phaseRef.current !== 'spinning') return;

    // Irregular velocity: accelerate with jitter
    const jitter = (Math.random() - 0.5) * 0.008;
    velocityRef.current = Math.min(velocityRef.current + 0.006 + jitter, 1.0);
    currentAngleRef.current = normalizeAngle(currentAngleRef.current + velocityRef.current * dt);
    setWheelRotation(currentAngleRef.current);

    animRef.current = requestAnimationFrame(() => runSpin(now));
  }, []);

  // Run the stopping deceleration loop
  const runStop = useCallback((prevTime: number) => {
    const now = performance.now();
    const dt = now - prevTime;

    if (phaseRef.current !== 'pending') return;

    velocityRef.current = Math.max(velocityRef.current - 0.012, 0);
    currentAngleRef.current = normalizeAngle(currentAngleRef.current + velocityRef.current * dt);
    setWheelRotation(currentAngleRef.current);

    if (velocityRef.current > 0) {
      animRef.current = requestAnimationFrame(() => runStop(now));
    } else {
      // Stopped
      const stopped = currentAngleRef.current;
      const currentRound = ROUNDS[phaseRef.current === 'pending' ? 0 : 0]; // resolved below
      void stopped;
    }
  }, []);

  const handleSpin = useCallback(() => {
    if (phase !== 'ready') return;
    cancelAnim();
    velocityRef.current = 0.1;
    currentAngleRef.current = normalizeAngle(currentAngleRef.current);
    startTimeRef.current = performance.now();
    setFinalAngle(null);
    setHit(null);
    setPhase('spinning');
    phaseRef.current = 'spinning';
    animRef.current = requestAnimationFrame(() => runSpin(performance.now()));
  }, [phase, cancelAnim, runSpin]);

  const handleStop = useCallback(() => {
    if (phase !== 'spinning') return;
    cancelAnim();

    const lag = 100 + Math.random() * 700;
    setLagMs(Math.round(lag));
    setPhase('pending');
    phaseRef.current = 'pending';

    // After lag, start deceleration
    pendingTimeoutRef.current = setTimeout(() => {
      const now = performance.now();
      // Decelerate over ~60 frames
      const decel = () => {
        const frameNow = performance.now();
        const dt = frameNow - now;
        void dt;

        velocityRef.current = Math.max(velocityRef.current - 0.015, 0);
        const noise = (Math.random() - 0.4) * 0.003;
        currentAngleRef.current = normalizeAngle(currentAngleRef.current + velocityRef.current * 16 + noise);
        setWheelRotation(currentAngleRef.current);

        if (velocityRef.current > 0) {
          animRef.current = requestAnimationFrame(decel);
        } else {
          // Final stop
          const stopped = currentAngleRef.current;
          const roundIdx = roundState.roundIdx;
          const currentRound = ROUNDS[roundIdx] ?? ROUNDS[ROUNDS.length - 1];
          // Pointer angle relative to wheel = stopped (wheel rotated that much, pointer fixed at top)
          const didHit = isInZone(stopped, currentRound.zoneSize);
          setFinalAngle(stopped);
          setHit(didHit);
          setPhase('result');
          phaseRef.current = 'result';
        }
      };
      animRef.current = requestAnimationFrame(decel);
    }, lag);
  }, [phase, cancelAnim, roundState.roundIdx]);

  const handleNext = useCallback(() => {
    if (hit === null) return;
    const newTries = roundState.tries + 1;
    const newWins = roundState.wins + (hit ? 1 : 0);
    const newTotalWins = roundState.totalWins + (hit ? 1 : 0);
    const newTotalTries = roundState.totalTries + 1;

    if (newTries >= TRIES_PER_ROUND) {
      if (newWins >= WINS_NEEDED) {
        const nextRound = roundState.roundIdx + 1;
        if (nextRound >= ROUNDS.length) {
          setRoundState({ roundIdx: nextRound, tries: 0, wins: 0, totalWins: newTotalWins, totalTries: newTotalTries });
          setPhase('clear');
        } else {
          setRoundState({ roundIdx: nextRound, tries: 0, wins: 0, totalWins: newTotalWins, totalTries: newTotalTries });
          setPhase('roundclear');
        }
      } else {
        setRoundState((p) => ({ ...p, tries: newTries, wins: newWins, totalWins: newTotalWins, totalTries: newTotalTries }));
        setPhase('gameover');
      }
    } else {
      setRoundState((p) => ({ ...p, tries: newTries, wins: newWins, totalWins: newTotalWins, totalTries: newTotalTries }));
      setPhase('ready');
      phaseRef.current = 'ready';
    }
  }, [hit, roundState]);

  const resetGame = useCallback(() => {
    cancelAnim();
    velocityRef.current = 0;
    currentAngleRef.current = 0;
    setWheelRotation(0);
    setFinalAngle(null);
    setHit(null);
    setRoundState({ roundIdx: 0, tries: 0, wins: 0, totalWins: 0, totalTries: 0 });
    setShowIntro(true);
    setPhase('ready');
    phaseRef.current = 'ready';
  }, [cancelAnim]);

  const currentRound = ROUNDS[roundState.roundIdx] ?? ROUNDS[ROUNDS.length - 1];
  const WHEEL_SIZE = 240;
  const cx = WHEEL_SIZE / 2;
  const r = cx - 6;

  const renderWheel = () => {
    // Draw target zone arc (highlight on the wheel, static visual — zone is at 0 deg on the wheel)
    const zoneStartRad = (TARGET_ZONE_START - 90) * (Math.PI / 180);
    const zoneEndRad = (TARGET_ZONE_START + currentRound.zoneSize - 90) * (Math.PI / 180);
    const zx1 = cx + r * Math.cos(zoneStartRad);
    const zy1 = cx + r * Math.sin(zoneStartRad);
    const zx2 = cx + r * Math.cos(zoneEndRad);
    const zy2 = cx + r * Math.sin(zoneEndRad);
    const largeArc = currentRound.zoneSize > 180 ? 1 : 0;

    return (
      <div className="relative mx-auto" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
        {/* Fixed pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div
            className="w-0 h-0"
            style={{
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '20px solid var(--color-neon-yellow, #FFE600)',
            }}
          />
        </div>

        {/* Rotating wheel */}
        <div
          className="absolute inset-0 rounded-full border-4 border-bg-raised overflow-hidden"
          style={{ transform: `rotate(${wheelRotation}deg)`, willChange: 'transform' }}
        >
          <svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
            {/* Segments */}
            {Array.from({ length: 12 }).map((_, i) => {
              const segDeg = 360 / 12;
              const s = ((i * segDeg) - 90) * (Math.PI / 180);
              const e = (((i + 1) * segDeg) - 90) * (Math.PI / 180);
              const x1 = cx + r * Math.cos(s);
              const y1 = cx + r * Math.sin(s);
              const x2 = cx + r * Math.cos(e);
              const y2 = cx + r * Math.sin(e);
              const fills = ['#1a1a2e', '#16213e'];
              return (
                <path
                  key={i}
                  d={`M ${cx} ${cx} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
                  fill={fills[i % 2]}
                  stroke="#2a2a4e"
                  strokeWidth="1"
                />
              );
            })}
            {/* Target zone highlight */}
            <path
              d={`M ${cx} ${cx} L ${zx1} ${zy1} A ${r} ${r} 0 ${largeArc} 1 ${zx2} ${zy2} Z`}
              fill="rgba(0,245,212,0.35)"
              stroke="rgb(0,245,212)"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Center */}
        <div
          className="absolute rounded-full bg-neon-yellow z-10"
          style={{ width: 14, height: 14, top: cx - 7, left: cx - 7 }}
        />
      </div>
    );
  };

  if (showIntro) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <GameIntro
          icon="🎯"
          title="精密ルーレット"
          gameId="spin-the-wheel"
          subtitle="目標ゾーンでSTOPを押せ。ただし止まるまでラグがある。"
          controls={[
            { icon: '▶', label: 'SPIN', desc: 'ルーレットを回す' },
            { icon: '■', label: 'STOP', desc: '目標ゾーンで止める' },
          ]}
          rules={[
            { text: 'シアン色のゾーン（車輪上）にポインターが重なった状態で止める' },
            { text: 'STOPを押してから実際に止まるまで0.1〜0.8秒のランダムラグ', highlight: true },
            { text: 'ゾーンは1/4→1/8→1/16→1/32と小さくなる' },
            { text: '5回中3回当てればラウンドクリア' },
          ]}
          tip="ラグを予測して早めにSTOPを押せ。どれくらい早めかはわからない。"
          buttonText="START"
          buttonColor="bg-neon-yellow text-bg-deep"
          onStart={() => setShowIntro(false)}
        />
      </div>
    );
  }

  return (
    <div className="relative max-w-lg mx-auto px-4 py-8">
      {/* Danmaku comments during play */}
      {(phase === 'ready' || phase === 'spinning' || phase === 'pending' || phase === 'result') && (
        <GameComments gameId="spin-the-wheel" mode="danmaku" />
      )}

      <AnimatePresence mode="wait">
        {(phase === 'ready' || phase === 'spinning' || phase === 'pending' || phase === 'result') && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {/* Round info */}
            <div className="flex items-center justify-between">
              <span className="font-['Orbitron'] text-xs text-neon-yellow">{currentRound.roundLabel}</span>
              <span className="font-['Orbitron'] text-xs text-text-muted">
                ZONE: <span className="text-neon-cyan">{currentRound.label}</span>
              </span>
              <span className="font-['Orbitron'] text-xs text-text-muted">
                {roundState.wins}W / {roundState.tries}T
              </span>
            </div>

            {renderWheel()}

            {phase === 'pending' && (
              <p className="text-center font-['Orbitron'] text-xs text-neon-pink animate-pulse">
                STOPPING... (lag: {lagMs}ms)
              </p>
            )}

            <AnimatePresence>
              {phase === 'result' && hit !== null && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center space-y-1"
                >
                  <p className={`font-['Orbitron'] text-xl font-black ${hit ? 'text-neon-cyan' : 'text-neon-pink'}`}>
                    {hit ? 'HIT!' : 'MISS'}
                  </p>
                  <p className="text-text-muted text-[10px]">
                    停止角: {finalAngle?.toFixed(1)}° | ゾーン: 0°〜{currentRound.zoneSize}°
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-center">
              {phase === 'ready' && (
                <button
                  onClick={handleSpin}
                  className="px-10 py-4 bg-neon-yellow text-bg-deep font-['Orbitron'] font-bold text-sm rounded-xl hover:shadow-[0_0_25px_rgba(255,230,0,0.5)] transition-shadow"
                >
                  SPIN
                </button>
              )}
              {phase === 'spinning' && (
                <motion.button
                  onClick={handleStop}
                  whileTap={{ scale: 0.92 }}
                  className="px-12 py-4 bg-neon-pink text-white font-['Orbitron'] font-bold text-xl rounded-xl shadow-[0_0_20px_rgba(255,45,120,0.5)]"
                >
                  STOP
                </motion.button>
              )}
              {phase === 'pending' && (
                <button disabled className="px-10 py-4 bg-bg-raised text-text-muted font-['Orbitron'] text-sm rounded-xl cursor-not-allowed">
                  ...
                </button>
              )}
              {phase === 'result' && (
                <button
                  onClick={handleNext}
                  className="px-10 py-4 bg-neon-cyan text-bg-deep font-['Orbitron'] font-bold text-sm rounded-xl"
                >
                  NEXT
                </button>
              )}
            </div>

            {/* Progress */}
            <div className="flex justify-center gap-2">
              {Array.from({ length: TRIES_PER_ROUND }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i < roundState.tries
                      ? i < roundState.wins
                        ? 'bg-neon-cyan'
                        : 'bg-neon-pink'
                      : 'bg-bg-raised'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'roundclear' && (
          <motion.div key="roundclear" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6 py-8">
            <p className="text-5xl">🎯</p>
            <p className="font-['Orbitron'] text-neon-cyan text-xl font-black">ROUND CLEAR!</p>
            <p className="text-text-muted text-sm">
              次のゾーン: <span className="text-neon-pink font-bold">{currentRound.label}</span>
            </p>
            <button
              onClick={() => { setPhase('ready'); phaseRef.current = 'ready'; }}
              className="px-10 py-4 bg-neon-yellow text-bg-deep font-['Orbitron'] font-bold text-sm rounded-xl"
            >
              NEXT ROUND
            </button>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="spin-the-wheel"
              gameName="SPIN THE WHEEL"
              icon="🎯"
              score={roundState.totalWins * 100}
              level={roundState.roundIdx}
              deathReason={`MISSED — 命中率: ${roundState.totalTries > 0 ? Math.round((roundState.totalWins / roundState.totalTries) * 100) : 0}%`}
              extraInfo={`到達: ${ROUNDS[roundState.roundIdx - 1]?.roundLabel ?? 'ROUND 1'}`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}

        {phase === 'clear' && (
          <motion.div key="clear" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="spin-the-wheel"
              gameName="SPIN THE WHEEL"
              icon="🎯"
              score={roundState.totalWins * 100}
              level={ROUNDS.length}
              extraInfo="全ラウンド制覇。ルーレットの神に認められた。"
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
