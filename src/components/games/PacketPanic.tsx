import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

interface Packet {
  id: number;
  label: string;
  action: 'allow' | 'deny';
  color: string;  // display color (may lie at higher levels)
  y: number;
  speed: number;
  isFake: boolean; // color lies
}

type Phase = 'ready' | 'playing' | 'gameover';

let packetId = 0;

const ALLOW_LABELS = ['GET /api', 'POST /login', 'HTTPS 443', 'DNS query', 'SSH 22'];
const DENY_LABELS = ['SYN flood', 'SQL inject', 'XSS <script>', 'BRUTE FORCE', 'PORT SCAN'];

export default function PacketPanicGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [combo, setCombo] = useState(0);
  const packetsRef = useRef<Packet[]>([]);
  const frameRef = useRef<number>();
  const spawnRef = useRef<ReturnType<typeof setInterval>>();
  const startRef = useRef(0);
  const phaseRef = useRef<Phase>('ready');
  const livesRef = useRef(3);

  const getDifficulty = useCallback(() => {
    const elapsed = (Date.now() - startRef.current) / 1000;
    if (elapsed >= 30) return 3;
    if (elapsed >= 15) return 2;
    return 1;
  }, []);

  const spawnPacket = useCallback(() => {
    const diff = getDifficulty();
    const isAllow = Math.random() > 0.5;
    const labels = isAllow ? ALLOW_LABELS : DENY_LABELS;
    const isFake = diff >= 2 && Math.random() < 0.25;

    const p: Packet = {
      id: ++packetId,
      label: labels[Math.floor(Math.random() * labels.length)],
      action: isAllow ? 'allow' : 'deny',
      color: isFake
        ? (isAllow ? '#FF2D78' : '#00F5D4') // Fake: wrong color
        : (isAllow ? '#00F5D4' : '#FF2D78'), // Real: correct color
      y: -40,
      speed: 1.5 + diff * 0.5 + Math.random() * 0.5,
      isFake,
    };

    packetsRef.current = [...packetsRef.current, p];
    setPackets([...packetsRef.current]);

    // Spawn extra simultaneous packets at higher levels
    if (diff >= 2 && Math.random() < 0.3) {
      setTimeout(() => spawnPacket(), 200);
    }
  }, [getDifficulty]);

  const start = () => {
    packetId = 0;
    setScore(0);
    setLives(3);
    livesRef.current = 3;
    setCombo(0);
    setPackets([]);
    packetsRef.current = [];
    startRef.current = Date.now();
    phaseRef.current = 'playing';
    setPhase('playing');
  };

  // Game loop
  useEffect(() => {
    if (phase !== 'playing') return;
    const loop = () => {
      if (phaseRef.current !== 'playing') return;

      packetsRef.current = packetsRef.current.map((p) => ({ ...p, y: p.y + p.speed }));

      // Check for missed packets (fell off screen)
      const missed = packetsRef.current.filter((p) => p.y > 500);
      if (missed.length > 0) {
        livesRef.current -= missed.length;
        setLives(livesRef.current);
        setCombo(0);
        if (livesRef.current <= 0) {
          phaseRef.current = 'gameover';
          setPhase('gameover');
          return;
        }
        packetsRef.current = packetsRef.current.filter((p) => p.y <= 500);
      }

      setPackets([...packetsRef.current]);
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [phase]);

  // Spawn
  useEffect(() => {
    if (phase !== 'playing') return;
    const spawn = () => {
      const diff = getDifficulty();
      const interval = [1200, 800, 500][diff - 1];
      clearInterval(spawnRef.current);
      spawnRef.current = setInterval(() => {
        if (phaseRef.current === 'playing') spawnPacket();
      }, interval);
    };
    spawn();
    const diffCheck = setInterval(spawn, 5000);
    return () => { clearInterval(spawnRef.current); clearInterval(diffCheck); };
  }, [phase, getDifficulty, spawnPacket]);

  const handleSwipe = (packet: Packet, direction: 'left' | 'right') => {
    if (phase !== 'playing') return;
    // Right = ALLOW, Left = DENY
    const playerAction = direction === 'right' ? 'allow' : 'deny';
    const correct = playerAction === packet.action;

    packetsRef.current = packetsRef.current.filter((p) => p.id !== packet.id);
    setPackets([...packetsRef.current]);

    if (correct) {
      const multiplier = combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1;
      setScore((s) => s + Math.floor(100 * multiplier));
      setCombo((c) => c + 1);
    } else {
      livesRef.current -= 1;
      setLives(livesRef.current);
      setCombo(0);
      if (livesRef.current <= 0) {
        phaseRef.current = 'gameover';
        setPhase('gameover');
      }
    }
  };

  const onDragEnd = (packet: Packet, _: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 50) {
      handleSwipe(packet, info.offset.x > 0 ? 'right' : 'left');
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-cyan tracking-[0.3em] mb-1">PACKET PANIC</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">パケットパニック</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="📦"
              title="PACKET PANIC"
              gameId="packet-panic"
              subtitle="パケットパニック"
              controls={[
                { icon: '→', label: '右スワイプ', desc: 'ALLOW' },
                { icon: '←', label: '左スワイプ', desc: 'DENY' },
              ]}
              rules={[
                { text: 'パケットを左右にスワイプで仕分けろ' },
                { text: 'ラベルで判断しろ。色は嘘をつく', highlight: true },
                { text: '逃したパケットはライフを1減らす' },
                { text: 'Lv.2〜 偽装パケット出現' },
              ]}
              tip="コンボを繋げると得点が最大2倍になる"
              buttonText="FILTER"
              buttonColor="bg-neon-cyan text-bg-deep"
              onStart={start}
            />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-['Share_Tech_Mono'] text-neon-cyan">SCORE: {score}</span>
              <span>{'❤️'.repeat(Math.max(0, lives))}{'🖤'.repeat(Math.max(0, 3 - lives))}</span>
              {combo >= 3 && <span className="text-neon-yellow animate-pulse">x{combo >= 5 ? '2.0' : '1.5'}</span>}
            </div>

            <div className="flex justify-between text-[8px] text-text-muted mb-1 px-4">
              <span>← DENY</span>
              <span>ALLOW →</span>
            </div>

            <div className="relative bg-bg-deep border-2 border-bg-raised rounded-xl overflow-hidden mx-auto" style={{ width: 320, height: 480 }}>
              <GameComments gameId="packet-panic" mode="danmaku" />
              {/* Center divider */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px border-l border-dashed border-bg-raised/30" />

              <AnimatePresence>
                {packets.map((p) => (
                  <motion.div
                    key={p.id}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.8}
                    onDragEnd={(_, info) => onDragEnd(p, _, info)}
                    className="absolute w-[280px] left-[20px] cursor-grab active:cursor-grabbing"
                    style={{ top: p.y }}
                    exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                  >
                    <div
                      className="rounded-lg border-2 px-4 py-2 flex items-center gap-3"
                      style={{ borderColor: p.color, backgroundColor: p.color + '15' }}
                    >
                      <span className="text-lg">{p.action === 'allow' ? '✅' : '🚫'}</span>
                      <div className="flex-1">
                        <p className="font-['Share_Tech_Mono'] text-xs" style={{ color: p.color }}>
                          {p.label}
                        </p>
                        {p.isFake && getDifficulty() < 3 && (
                          <p className="text-text-muted text-[8px]">⚠</p>
                        )}
                      </div>
                      <span className="text-[8px] text-text-muted font-['Orbitron']">
                        {p.action === 'allow' ? 'ALLOW' : 'DENY'}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="packet-panic"
              gameName="PACKET PANIC"
              icon="📦"
              score={score}
              level={getDifficulty()}
              deathReason="BUFFER OVERFLOW — お前のACLはザルだ"
              extraInfo={`max combo: ${combo}`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
