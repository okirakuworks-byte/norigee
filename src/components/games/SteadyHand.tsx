import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

type Phase = 'ready' | 'playing' | 'cleared' | 'failed';

interface PathPoint { x: number; y: number; }

function generatePath(difficulty: number): PathPoint[] {
  const points: PathPoint[] = [];
  const steps = 30 + difficulty * 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const baseX = 30 + t * 240;
    const waveAmplitude = 20 + difficulty * 15;
    const frequency = 2 + difficulty;
    const baseY = 150 + Math.sin(t * Math.PI * frequency) * waveAmplitude
                  + Math.cos(t * Math.PI * (frequency + 1)) * (waveAmplitude * 0.5);
    points.push({ x: baseX, y: Math.max(30, Math.min(270, baseY)) });
  }
  return points;
}

function distanceToPath(px: number, py: number, path: PathPoint[]): number {
  let minDist = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const ax = path[i].x, ay = path[i].y;
    const bx = path[i + 1].x, by = path[i + 1].y;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const cx = ax + t * dx, cy = ay + t * dy;
    const dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
    minDist = Math.min(minDist, dist);
  }
  return minDist;
}

function progressOnPath(px: number, path: PathPoint[]): number {
  let minDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < path.length; i++) {
    const d = Math.sqrt((px - path[i].x) ** 2);
    if (d < minDist) { minDist = d; bestIdx = i; }
  }
  return bestIdx / (path.length - 1);
}

export default function SteadyHandGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [path, setPath] = useState<PathPoint[]>([]);
  const [trail, setTrail] = useState<PathPoint[]>([]);
  const [shakeMagnitude, setShakeMagnitude] = useState(3);
  const [progress, setProgress] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [invertControls, setInvertControls] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const shakeRef = useRef({ x: 0, y: 0 });

  const getDifficulty = useCallback(() => {
    if (level >= 5) return 3;
    if (level >= 3) return 2;
    return 1;
  }, [level]);

  const getPathWidth = useCallback(() => {
    return [30, 15, 8][getDifficulty() - 1];
  }, [getDifficulty]);

  const getShakeAmount = useCallback(() => {
    return [3, 8, 15][getDifficulty() - 1];
  }, [getDifficulty]);

  const startLevel = useCallback(() => {
    const newPath = generatePath(getDifficulty());
    setPath(newPath);
    setTrail([]);
    setProgress(0);
    setIsDrawing(false);
    setShakeMagnitude(getShakeAmount());
    setInvertControls(getDifficulty() >= 3 && Math.random() < 0.3);
    setPhase('playing');
  }, [getDifficulty, getShakeAmount]);

  // Shake animation
  useEffect(() => {
    if (phase !== 'playing') return;
    let frame: number;
    const shake = () => {
      const t = Date.now() / 100;
      shakeRef.current = {
        x: Math.sin(t * 1.3) * shakeMagnitude + Math.cos(t * 2.7) * (shakeMagnitude * 0.5),
        y: Math.cos(t * 1.7) * shakeMagnitude + Math.sin(t * 3.1) * (shakeMagnitude * 0.5),
      };
      frame = requestAnimationFrame(shake);
    };
    frame = requestAnimationFrame(shake);
    return () => cancelAnimationFrame(frame);
  }, [phase, shakeMagnitude]);

  const handleMove = (clientX: number, clientY: number) => {
    if (phase !== 'playing' || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    let y = clientY - rect.top;

    // Apply shake
    x += shakeRef.current.x;
    y += shakeRef.current.y;

    // Invert controls
    if (invertControls) {
      x = rect.width - x;
      y = rect.height - y;
    }

    // Clamp
    x = Math.max(0, Math.min(300, x));
    y = Math.max(0, Math.min(300, y));

    // Check distance to path
    const dist = distanceToPath(x, y, path);
    const maxDist = getPathWidth();

    setTrail((prev) => [...prev, { x, y }]);

    if (!isDrawing) {
      // Must start near the beginning of the path
      if (dist < maxDist && x < path[2]?.x) {
        setIsDrawing(true);
      }
      return;
    }

    if (dist > maxDist) {
      setPhase('failed');
      return;
    }

    // Update progress
    const prog = progressOnPath(x, path);
    setProgress(prog);
    if (prog >= 0.95) {
      const levelScore = Math.floor(500 + level * 200);
      setScore((s) => s + levelScore);
      setPhase('cleared');
    }
  };

  const start = () => {
    setLevel(1);
    setScore(0);
    startLevel();
  };

  const nextLevel = () => {
    setLevel((l) => l + 1);
    startLevel();
  };

  const pathD = path.length > 0
    ? `M ${path[0].x},${path[0].y} ` + path.slice(1).map((p) => `L ${p.x},${p.y}`).join(' ')
    : '';

  const trailD = trail.length > 1
    ? `M ${trail[0].x},${trail[0].y} ` + trail.slice(1).map((p) => `L ${p.x},${p.y}`).join(' ')
    : '';

  const diff = getDifficulty();

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      {/* Danmaku comments during play */}
      {phase === 'playing' && <GameComments gameId="steady-hand" mode="danmaku" />}

      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-cyan tracking-[0.3em] mb-1">STEADY HAND</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">激カタ手ぶれ補正</h2>
      </div>

      {phase === 'ready' && (
        <GameIntro
          icon="🫨"
          title="STEADY HAND"
          gameId="steady-hand"
          subtitle="激カタ手ぶれ補正"
          controls={[
            { icon: '🖱️', label: 'DRAG', desc: '線をなぞる' },
            { icon: '👆', label: 'TOUCH', desc: 'でもOK' },
          ]}
          rules={[
            { text: '線の上をなぞるだけ' },
            { text: 'ただしカーソルは常に震えている', highlight: true },
            { text: 'Lv.3〜 パス幅8px / 揺れ±15px' },
            { text: 'Lv.3〜 逆操作ゾーンあり', highlight: true },
          ]}
          tip="ゆっくり動かすほど制御しやすい"
          buttonText="OPERATE"
          buttonColor="bg-neon-cyan text-bg-deep"
          onStart={start}
        />
      )}

      {(phase === 'playing' || phase === 'failed' || phase === 'cleared') && (
        <div>
          {/* HUD */}
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-['Share_Tech_Mono'] text-neon-cyan">SCORE: {score}</span>
            <span className="font-['Orbitron'] text-text-muted">Lv.{level}</span>
            <span className="font-['Share_Tech_Mono'] text-neon-yellow">{Math.floor(progress * 100)}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-bg-raised rounded-full overflow-hidden mb-3">
            <div className="h-full bg-neon-cyan transition-all" style={{ width: `${progress * 100}%` }} />
          </div>

          {invertControls && phase === 'playing' && (
            <p className="text-center text-neon-pink text-[10px] font-['Orbitron'] mb-1 animate-pulse">
              ⚠ INVERTED CONTROLS
            </p>
          )}

          {/* SVG field */}
          <svg
            ref={svgRef}
            width={300}
            height={300}
            className="bg-bg-deep border-2 border-bg-raised rounded-xl mx-auto cursor-crosshair touch-none"
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onTouchMove={(e) => { e.preventDefault(); const t = e.touches[0]; handleMove(t.clientX, t.clientY); }}
          >
            {/* Path outline (guide) */}
            <path
              d={pathD}
              fill="none"
              stroke="rgba(0,245,212,0.15)"
              strokeWidth={getPathWidth() * 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Path center line */}
            <path
              d={pathD}
              fill="none"
              stroke="rgba(0,245,212,0.4)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            {/* Trail */}
            {trailD && (
              <path
                d={trailD}
                fill="none"
                stroke={phase === 'failed' ? '#FF2D78' : '#00F5D4'}
                strokeWidth={2}
                strokeLinecap="round"
              />
            )}
            {/* Start/End markers */}
            {path.length > 0 && (
              <>
                <circle cx={path[0].x} cy={path[0].y} r={6} fill="#00F5D4" opacity={0.6} />
                <circle cx={path[path.length - 1].x} cy={path[path.length - 1].y} r={6} fill="#FFE600" opacity={0.6} />
              </>
            )}
          </svg>

          <p className="text-center text-text-muted text-[10px] mt-2">
            幅{getPathWidth()}px / 揺れ±{getShakeAmount()}px
          </p>

          {phase === 'cleared' && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mt-4 space-y-3">
              <p className="font-['Orbitron'] text-neon-cyan font-bold">CLEAR!</p>
              <button onClick={nextLevel} className="px-8 py-3 bg-neon-cyan text-bg-deep font-['Orbitron'] text-sm font-bold rounded-lg">NEXT LEVEL</button>
            </motion.div>
          )}

          {phase === 'failed' && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              <GameResult
                gameId="steady-hand"
                gameName="STEADY HAND"
                icon="🫨"
                score={score}
                level={level}
                deathReason="PATIENT LOST — 手術失敗"
                extraInfo={`Lv.${level} | ${Math.floor(progress * 100)}% reached`}
                onRetry={() => setPhase('ready')}
              />
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
