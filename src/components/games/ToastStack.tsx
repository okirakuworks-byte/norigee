import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

interface Toast {
  id: number;
  x: number; // offset from center (-50 to 50)
  width: number;
  isButtered: boolean;
}

type Phase = 'ready' | 'aiming' | 'falling' | 'stacked' | 'gameover';

export default function ToastStackGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [stack, setStack] = useState<Toast[]>([]);
  const [aimX, setAimX] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [windOffset, setWindOffset] = useState(0);
  const [round, setRound] = useState(0);
  const aimRef = useRef(0);
  const aimDirRef = useRef(1);
  const frameRef = useRef<number>();
  const stackRef = useRef<Toast[]>([]);
  const tiltRef = useRef(0);

  const STACK_W = 240;
  const TOAST_H = 20;
  const MAX_TILT = 35; // degrees before topple

  const getDifficulty = useCallback(() => {
    if (round >= 8) return 3;
    if (round >= 4) return 2;
    return 1;
  }, [round]);

  const getSwingSpeed = useCallback(() => {
    return [1.5, 2.5, 4][getDifficulty() - 1];
  }, [getDifficulty]);

  const getToastWidth = useCallback(() => {
    const diff = getDifficulty();
    if (diff >= 3) return 50 + Math.floor(Math.random() * 40); // random sizes
    return 70; // fixed
  }, [getDifficulty]);

  const startAiming = useCallback(() => {
    aimRef.current = -50;
    aimDirRef.current = 1;
    setPhase('aiming');
  }, []);

  const start = () => {
    setScore(0);
    setStack([]);
    stackRef.current = [];
    setRound(0);
    setTilt(0);
    tiltRef.current = 0;
    setWindOffset(0);
    startAiming();
  };

  // Aiming swing
  useEffect(() => {
    if (phase !== 'aiming') return;
    const speed = getSwingSpeed();
    const loop = () => {
      aimRef.current += aimDirRef.current * speed;
      if (aimRef.current > 50) { aimRef.current = 50; aimDirRef.current = -1; }
      if (aimRef.current < -50) { aimRef.current = -50; aimDirRef.current = 1; }

      // Wind at Lv2+
      const diff = getDifficulty();
      if (diff >= 2) {
        setWindOffset(Math.sin(Date.now() / 500) * 5 * diff);
      }

      setAimX(aimRef.current);
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [phase, getSwingSpeed, getDifficulty]);

  const drop = () => {
    if (phase !== 'aiming') return;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const diff = getDifficulty();
    const finalX = aimRef.current + windOffset;
    const isButtered = diff >= 2 && Math.random() < 0.3;
    const width = getToastWidth();

    const newToast: Toast = {
      id: round,
      x: finalX,
      width,
      isButtered,
    };

    stackRef.current = [...stackRef.current, newToast];
    setStack([...stackRef.current]);

    // Calculate tilt based on cumulative offset
    const totalOffset = stackRef.current.reduce((sum, t) => sum + t.x, 0);
    const butterPenalty = stackRef.current.filter((t) => t.isButtered).length * 3;
    const newTilt = (totalOffset / stackRef.current.length) * 0.8 + butterPenalty * (totalOffset > 0 ? 1 : -1);
    tiltRef.current = newTilt;
    setTilt(newTilt);

    if (Math.abs(newTilt) >= MAX_TILT) {
      setPhase('gameover');
      return;
    }

    // Score based on accuracy
    const accuracy = Math.max(0, 1 - Math.abs(finalX) / 50);
    const bonus = Math.floor(accuracy * 200) + 50;
    setScore((s) => s + bonus);

    setPhase('stacked');
  };

  const nextRound = () => {
    setRound((r) => r + 1);
    startAiming();
  };

  const diff = getDifficulty();

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-yellow tracking-[0.3em] mb-1">TOAST STACK</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">トースト積み</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🍞"
              title="TOAST STACK"
              gameId="toast-stack"
              subtitle="トースト積み"
              controls={[
                { icon: '👆', label: 'TAP', desc: 'パンを落とす' },
              ]}
              rules={[
                { text: 'タップで食パンを真っ直ぐ積め' },
                { text: '傾き過ぎたら崩壊', highlight: true },
                { text: 'Lv.2〜 バター付き（滑る）+風' },
                { text: 'Lv.3〜 サイズがランダムになる' },
              ]}
              tip="累積オフセットで傾く。左右交互に積むとバランスが保てる"
              buttonText="STACK"
              buttonColor="bg-neon-yellow text-bg-deep"
              onStart={start}
            />
          </motion.div>
        )}

        {(phase === 'aiming' || phase === 'stacked') && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              <span className="font-['Orbitron'] text-text-muted">x{stack.length}</span>
              <span className={`font-['Share_Tech_Mono'] ${Math.abs(tilt) > 20 ? 'text-neon-pink' : 'text-text-muted'}`}>
                TILT: {Math.round(tilt)}°
              </span>
            </div>

            {/* Game field */}
            <div
              className="relative bg-bg-deep border-2 border-bg-raised rounded-xl overflow-hidden mx-auto cursor-pointer"
              style={{ width: STACK_W + 40, height: 400 }}
              onClick={phase === 'aiming' ? drop : undefined}
              onTouchStart={phase === 'aiming' ? (e) => { e.preventDefault(); drop(); } : undefined}
            >
              <GameComments gameId="toast-stack" mode="danmaku" />
              {/* Wind indicator */}
              {diff >= 2 && phase === 'aiming' && (
                <div className="absolute top-2 right-2">
                  <span className="text-text-muted text-[8px]">
                    {windOffset > 0 ? '💨→' : '←💨'} {Math.abs(windOffset).toFixed(0)}
                  </span>
                </div>
              )}

              {/* Aiming toast (swinging) */}
              {phase === 'aiming' && (
                <div
                  className="absolute top-8"
                  style={{ left: `calc(50% + ${aimX}px - ${getToastWidth() / 2}px)` }}
                >
                  <div
                    className="h-5 rounded-sm bg-neon-yellow/80 border border-neon-yellow"
                    style={{ width: getToastWidth() }}
                  >
                    {diff >= 2 && Math.random() < 0.3 && (
                      <span className="text-[6px] text-bg-deep absolute inset-0 flex items-center justify-center">butter</span>
                    )}
                  </div>
                  <div className="text-center">
                    <span className="text-text-muted text-[8px]">▼</span>
                  </div>
                </div>
              )}

              {/* Stack */}
              <div
                className="absolute bottom-0 left-1/2"
                style={{
                  transform: `translateX(-50%) rotate(${tilt}deg)`,
                  transformOrigin: 'bottom center',
                  transition: 'transform 0.3s ease-out',
                }}
              >
                {/* Base plate */}
                <div className="w-40 h-2 bg-bg-raised rounded-sm mx-auto" />

                {/* Stacked toasts */}
                {stack.map((toast, i) => (
                  <motion.div
                    key={toast.id}
                    initial={{ y: -200 }}
                    animate={{ y: 0 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                    className="relative"
                    style={{
                      marginLeft: `calc(50% - ${toast.width / 2}px + ${toast.x}px)`,
                      marginTop: -2,
                    }}
                  >
                    <div
                      className={`rounded-sm ${toast.isButtered ? 'bg-yellow-400 border border-yellow-500' : 'bg-amber-200 border border-amber-300'}`}
                      style={{ width: toast.width, height: TOAST_H }}
                    >
                      {toast.isButtered && (
                        <span className="text-[6px] text-amber-800 absolute inset-0 flex items-center justify-center">🧈</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Danger zone indicator */}
              {Math.abs(tilt) > 20 && (
                <p className="absolute top-2 left-2 text-neon-pink text-[8px] font-['Orbitron'] animate-pulse">
                  ⚠ UNSTABLE
                </p>
              )}
            </div>

            {phase === 'aiming' && (
              <p className="text-center text-text-muted text-xs mt-2">タップで落とせ</p>
            )}

            {phase === 'stacked' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mt-4">
                <p className="text-neon-cyan font-['Orbitron'] text-xs mb-2">
                  {Math.abs(stack[stack.length - 1]?.x ?? 0) < 5 ? '🎯 PERFECT!' : Math.abs(stack[stack.length - 1]?.x ?? 0) < 15 ? '👍 NICE' : '😰 CLOSE...'}
                </p>
                <button onClick={nextRound} className="px-8 py-3 bg-neon-yellow text-bg-deep font-['Orbitron'] text-sm font-bold rounded-lg">
                  NEXT TOAST
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ rotate: tilt > 0 ? 30 : -30, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}>
            <GameResult
              gameId="toast-stack"
              gameName="TOAST STACK"
              icon="🍞"
              score={score}
              level={round + 1}
              deathReason="こんがり焼けました — 積みゲーならぬ詰みゲー"
              extraInfo={`${stack.length}枚積み | 最終傾斜${Math.round(Math.abs(tilt))}°`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
