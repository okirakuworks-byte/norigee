import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

interface Wall {
  x: number;
  gapY: number;
  gapSize: number;
  passed: boolean;
}

type Phase = 'ready' | 'playing' | 'dead';

const FIELD_W = 400;
const FIELD_H = 500;
const PACKET_SIZE = 20;
const WALL_WIDTH = 30;
const GRAVITY = 0.4;
const JUMP_FORCE = -7;

export default function FirewallDashGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [packetY, setPacketY] = useState(FIELD_H / 2);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [idsY, setIdsY] = useState(0); // IDS scan line
  const [showIds, setShowIds] = useState(false);

  const velocityRef = useRef(0);
  const packetYRef = useRef(FIELD_H / 2);
  const wallsRef = useRef<Wall[]>([]);
  const scoreRef = useRef(0);
  const frameRef = useRef<number>();
  const lastWallRef = useRef(0);
  const idsYRef = useRef(0);
  const phaseRef = useRef<Phase>('ready');

  const getDifficulty = useCallback(() => {
    const s = scoreRef.current;
    if (s >= 15) return 3;
    if (s >= 10) return 2;
    if (s >= 5) return 1;
    return 0;
  }, []);

  const spawnWall = useCallback(() => {
    const diff = getDifficulty();
    const gapSize = [160, 130, 100, 80][diff];
    const gapY = 60 + Math.random() * (FIELD_H - 120 - gapSize);

    const newWall: Wall = {
      x: FIELD_W + WALL_WIDTH,
      gapY,
      gapSize,
      passed: false,
    };

    wallsRef.current = [...wallsRef.current, newWall];
    setWalls([...wallsRef.current]);
  }, [getDifficulty]);

  const gameLoop = useCallback(() => {
    if (phaseRef.current !== 'playing') return;

    // Gravity
    velocityRef.current += GRAVITY;
    packetYRef.current += velocityRef.current;

    // Bounds
    if (packetYRef.current < 0) {
      packetYRef.current = 0;
      velocityRef.current = 0;
    }
    if (packetYRef.current > FIELD_H - PACKET_SIZE) {
      phaseRef.current = 'dead';
      setPhase('dead');
      return;
    }

    // Move walls
    const diff = getDifficulty();
    const speed = [2, 2.5, 3, 3.5][diff];

    wallsRef.current = wallsRef.current
      .map((w) => ({ ...w, x: w.x - speed }))
      .filter((w) => w.x > -WALL_WIDTH);

    // Spawn walls
    lastWallRef.current += speed;
    const spawnDist = [200, 180, 160, 140][diff];
    if (lastWallRef.current >= spawnDist) {
      spawnWall();
      lastWallRef.current = 0;
    }

    // Collision & scoring
    const packetLeft = 60;
    const packetRight = packetLeft + PACKET_SIZE;
    const packetTop = packetYRef.current;
    const packetBottom = packetTop + PACKET_SIZE;

    for (const wall of wallsRef.current) {
      const wallLeft = wall.x;
      const wallRight = wall.x + WALL_WIDTH;

      // Check overlap
      if (packetRight > wallLeft && packetLeft < wallRight) {
        // In wall zone - check if in gap
        if (packetTop < wall.gapY || packetBottom > wall.gapY + wall.gapSize) {
          phaseRef.current = 'dead';
          setPhase('dead');
          return;
        }
      }

      // Score when passed
      if (!wall.passed && wall.x + WALL_WIDTH < packetLeft) {
        wall.passed = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);
      }
    }

    // IDS scan line (diff >= 2)
    if (diff >= 2) {
      setShowIds(true);
      idsYRef.current += 2;
      if (idsYRef.current > FIELD_H) idsYRef.current = 0;
      setIdsY(idsYRef.current);

      // IDS collision
      if (Math.abs(packetYRef.current - idsYRef.current) < PACKET_SIZE) {
        phaseRef.current = 'dead';
        setPhase('dead');
        return;
      }
    }

    setPacketY(packetYRef.current);
    setWalls([...wallsRef.current]);

    frameRef.current = requestAnimationFrame(gameLoop);
  }, [getDifficulty, spawnWall]);

  const jump = () => {
    if (phase === 'ready') {
      start();
      return;
    }
    if (phase === 'playing') {
      velocityRef.current = JUMP_FORCE;
    }
  };

  const start = () => {
    velocityRef.current = 0;
    packetYRef.current = FIELD_H / 2;
    wallsRef.current = [];
    scoreRef.current = 0;
    lastWallRef.current = 150;
    idsYRef.current = 0;
    phaseRef.current = 'playing';

    setPacketY(FIELD_H / 2);
    setWalls([]);
    setScore(0);
    setShowIds(false);
    setPhase('playing');

    frameRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === 'dead') {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      setBestScore((b) => Math.max(b, scoreRef.current));
    }
  }, [phase]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-cyan tracking-[0.3em] mb-1">FIREWALL DASH</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">ファイアウォール突破</h2>
      </div>

      {/* HUD */}
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-['Share_Tech_Mono'] text-neon-cyan">WALLS: {score}</span>
        <span className="font-['Share_Tech_Mono'] text-text-muted">BEST: {bestScore}</span>
      </div>

      {/* Game field */}
      <div
        className="relative bg-bg-deep border-2 border-bg-raised rounded-xl overflow-hidden cursor-pointer select-none mx-auto"
        style={{ width: FIELD_W, height: FIELD_H }}
        onClick={jump}
        onTouchStart={(e) => { e.preventDefault(); jump(); }}
      >
        {/* Grid lines */}
        {[...Array(10)].map((_, i) => (
          <div key={i} className="absolute w-full border-t border-bg-raised/20" style={{ top: `${(i + 1) * 10}%` }} />
        ))}

        {/* IDS scan line */}
        {showIds && (
          <div
            className="absolute w-full h-[2px] bg-red-500/60 shadow-[0_0_10px_rgba(255,0,0,0.3)]"
            style={{ top: idsY }}
          />
        )}

        {/* Walls (Firewalls) */}
        {walls.map((wall, i) => (
          <div key={i}>
            {/* Top wall */}
            <div
              className="absolute bg-neon-pink/30 border-r-2 border-neon-pink"
              style={{
                left: wall.x,
                top: 0,
                width: WALL_WIDTH,
                height: wall.gapY,
              }}
            />
            {/* Bottom wall */}
            <div
              className="absolute bg-neon-pink/30 border-r-2 border-neon-pink"
              style={{
                left: wall.x,
                top: wall.gapY + wall.gapSize,
                width: WALL_WIDTH,
                height: FIELD_H - wall.gapY - wall.gapSize,
              }}
            />
            {/* FW label */}
            <span
              className="absolute font-['Share_Tech_Mono'] text-[8px] text-neon-pink/50"
              style={{ left: wall.x + 2, top: wall.gapY - 12 }}
            >
              FW
            </span>
          </div>
        ))}

        {/* Packet */}
        <div
          className="absolute rounded bg-neon-cyan shadow-[0_0_10px_rgba(0,245,212,0.6)]"
          style={{
            left: 60,
            top: packetY,
            width: PACKET_SIZE,
            height: PACKET_SIZE,
          }}
        >
          <span className="text-[8px] font-['Share_Tech_Mono'] text-bg-deep absolute inset-0 flex items-center justify-center">
            PKT
          </span>
        </div>

        {/* Danmaku comments during play */}
        {phase === 'playing' && <GameComments gameId="firewall-dash" mode="danmaku" />}

        {/* Overlays */}
        {phase === 'ready' && (
          <div className="absolute inset-0 bg-bg-deep/90 overflow-auto">
            <GameIntro
              icon="📦"
              title="FIREWALL DASH"
              gameId="firewall-dash"
              subtitle="ファイアウォール突破"
              controls={[
                { icon: '👆', label: 'TAP', desc: 'ジャンプ' },
                { icon: '⌨️', label: 'SPACE', desc: 'でもOK' },
              ]}
              rules={[
                { text: 'ファイアウォールの隙間を通り抜けろ' },
                { text: '壁に当たったら即死', highlight: true },
                { text: 'Lv.2〜 IDS追跡レーザー出現' },
                { text: 'Lv.3〜 隙間がより狭くなる' },
              ]}
              tip="タップのタイミングよりも予測が重要"
              buttonText="FLY"
              buttonColor="bg-neon-cyan text-bg-deep"
              onStart={start}
            />
          </div>
        )}

        {phase === 'dead' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-bg-deep/90 overflow-auto"
          >
            <GameResult
              gameId="firewall-dash"
              gameName="FIREWALL DASH"
              icon="📦"
              score={score}
              level={getDifficulty() + 1}
              deathReason="CONNECTION REFUSED"
              extraInfo={`${score} firewalls passed | BEST: ${bestScore}`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </div>

      <p className="text-center text-text-muted text-[10px] mt-2 font-['Share_Tech_Mono']">
        {getDifficulty() >= 2 ? '⚠ IDS ACTIVE' : ''} {getDifficulty() >= 3 ? '| NARROW GAPS' : ''}
      </p>
    </div>
  );
}
