import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

const ADDRESSES = [
  '0xAA', '0xBF', '0x3C', '0xD7', '0x12', '0x9E', '0x45', '0xF0',
  '0x6B', '0x81', '0x2D', '0xC4', '0x58', '0xA3', '0x7F', '0xE6',
];

type Phase = 'ready' | 'showing' | 'input' | 'correct' | 'segfault';

interface Block {
  id: number;
  address: string;
  position: number; // grid position
  alive: boolean;   // false = GC'd
}

export default function MemoryLeakGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [sequence, setSequence] = useState<number[]>([]);  // block ids in order
  const [showIdx, setShowIdx] = useState(-1);  // currently showing
  const [inputIdx, setInputIdx] = useState(0);  // player's progress
  const [leakOpacity, setLeakOpacity] = useState(0);
  const [wrongBlock, setWrongBlock] = useState<number | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const getDifficulty = useCallback(() => {
    if (round >= 9) return 4;
    if (round >= 7) return 3;
    if (round >= 4) return 2;
    if (round >= 2) return 1;
    return 0;
  }, [round]);

  const getSequenceLength = useCallback(() => {
    return Math.min(12, 3 + round);
  }, [round]);

  const initBlocks = useCallback(() => {
    const shuffled = [...ADDRESSES].sort(() => Math.random() - 0.5);
    return shuffled.map((addr, i) => ({
      id: i,
      address: addr,
      position: i,
      alive: true,
    }));
  }, []);

  const startRound = useCallback(() => {
    const diff = getDifficulty();
    let newBlocks: Block[];

    if (diff >= 1 && round > 0) {
      // Shuffle positions
      newBlocks = initBlocks();
    } else {
      newBlocks = initBlocks();
    }

    // GC: kill random blocks at diff >= 2
    if (diff >= 2) {
      const killCount = Math.min(4, diff - 1);
      const indices = newBlocks.map((_, i) => i).sort(() => Math.random() - 0.5);
      for (let i = 0; i < killCount; i++) {
        newBlocks[indices[i]] = { ...newBlocks[indices[i]], alive: false };
      }
    }

    setBlocks(newBlocks);

    // Generate sequence from alive blocks
    const aliveBlocks = newBlocks.filter((b) => b.alive);
    const seqLen = getSequenceLength();
    const seq: number[] = [];
    for (let i = 0; i < seqLen; i++) {
      seq.push(aliveBlocks[Math.floor(Math.random() * aliveBlocks.length)].id);
    }
    setSequence(seq);
    setInputIdx(0);
    setWrongBlock(null);

    // Memory leak visual
    if (diff >= 4) {
      setLeakOpacity(Math.min(0.4, (round - 8) * 0.1));
    } else {
      setLeakOpacity(0);
    }

    // Show sequence
    setPhase('showing');
    setShowIdx(0);
  }, [round, getDifficulty, getSequenceLength, initBlocks]);

  // Animate showing sequence
  useEffect(() => {
    if (phase !== 'showing') return;
    if (showIdx >= sequence.length) {
      // Done showing, player's turn
      setShowIdx(-1);
      setPhase('input');
      return;
    }

    const diff = getDifficulty();
    const speed = diff >= 3 ? 400 : diff >= 1 ? 600 : 800;

    showTimerRef.current = setTimeout(() => {
      setShowIdx((i) => i + 1);
    }, speed);

    return () => clearTimeout(showTimerRef.current);
  }, [phase, showIdx, sequence.length, getDifficulty]);

  const startGame = () => {
    setRound(0);
    setScore(0);
    setLeakOpacity(0);
    startRound();
  };

  // Need to call startRound when round changes
  useEffect(() => {
    if (phase === 'correct') return;
    // Only called from nextRound
  }, [round]);

  const clickBlock = (block: Block) => {
    if (phase !== 'input' || !block.alive) return;

    if (block.id === sequence[inputIdx]) {
      // Correct!
      const newIdx = inputIdx + 1;
      setInputIdx(newIdx);

      if (newIdx >= sequence.length) {
        // Round complete!
        const roundScore = sequence.length * 100 + round * 150;
        setScore((s) => s + roundScore);
        setPhase('correct');
      }
    } else {
      // WRONG - Segfault!
      setWrongBlock(block.id);
      setPhase('segfault');
    }
  };

  const nextRound = () => {
    setRound((r) => r + 1);
    // Small delay then start
    setTimeout(() => startRound(), 300);
  };

  // Re-startRound when round changes via nextRound isn't clean
  // So nextRound directly calls startRound after setState
  useEffect(() => {
    if (round > 0 && phase === 'correct') {
      // handled by nextRound timeout
    }
  }, [round, phase]);

  const activeBlockId = phase === 'showing' && showIdx >= 0 && showIdx < sequence.length
    ? sequence[showIdx]
    : null;

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      {/* Danmaku comments during play */}
      {(phase === 'showing' || phase === 'input') && (
        <GameComments gameId="memory-leak" mode="danmaku" />
      )}

      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-cyan tracking-[0.3em] mb-1">MEMORY LEAK</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">メモリリーク</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🧠"
              title="MEMORY LEAK"
              gameId="memory-leak"
              subtitle="メモリリーク"
              controls={[
                { icon: '👆', label: 'CLICK', desc: 'ブロックを選択' },
              ]}
              rules={[
                { text: 'メモリブロックが光る順番を記憶しろ' },
                { text: '同じ順番でクリックして再現しろ' },
                { text: '1つでも間違えたらSegmentation Fault', highlight: true },
                { text: 'Lv.2〜 シャッフル / Lv.4〜 GCでブロック消滅' },
              ]}
              tip="アドレスをグループで覚えるとミスが減る"
              buttonText="ALLOCATE"
              buttonColor="bg-neon-cyan text-bg-deep"
              onStart={startGame}
            />
          </motion.div>
        )}

        {(phase === 'showing' || phase === 'input') && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* HUD */}
            <div className="flex items-center justify-between text-xs mb-4">
              <span className="font-['Share_Tech_Mono'] text-neon-cyan">SCORE: {score}</span>
              <span className="font-['Orbitron'] text-text-muted">ROUND {round + 1}</span>
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">
                {phase === 'showing' ? 'MEMORIZE' : `${inputIdx}/${sequence.length}`}
              </span>
            </div>

            {/* Sequence length indicator */}
            <div className="flex gap-1 justify-center mb-4">
              {sequence.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    phase === 'showing' && i <= showIdx
                      ? 'bg-neon-cyan'
                      : phase === 'input' && i < inputIdx
                      ? 'bg-neon-cyan'
                      : 'bg-bg-raised'
                  }`}
                />
              ))}
            </div>

            {/* Grid */}
            <div className="relative">
              {/* Memory leak overlay */}
              {leakOpacity > 0 && (
                <div
                  className="absolute inset-0 bg-red-900 rounded-xl pointer-events-none z-10"
                  style={{ opacity: leakOpacity }}
                />
              )}

              <div className="grid grid-cols-4 gap-2 p-4 bg-bg-surface border border-bg-raised rounded-xl">
                {blocks.map((block) => {
                  const isActive = activeBlockId === block.id;
                  const isClickable = phase === 'input' && block.alive;

                  if (!block.alive) {
                    return (
                      <div
                        key={block.id}
                        className="aspect-square rounded-lg bg-bg-deep/30 border border-bg-raised/20 flex items-center justify-center"
                      >
                        <span className="text-text-muted/30 text-[8px] font-['Share_Tech_Mono']">GC</span>
                      </div>
                    );
                  }

                  return (
                    <motion.button
                      key={block.id}
                      layout
                      onClick={() => clickBlock(block)}
                      disabled={!isClickable}
                      className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center transition-all duration-150 ${
                        isActive
                          ? 'bg-neon-cyan/30 border-neon-cyan shadow-[0_0_20px_rgba(0,245,212,0.5)] scale-110'
                          : 'bg-bg-deep border-bg-raised hover:border-neon-cyan/50'
                      } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                      animate={isActive ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <span className={`font-['Share_Tech_Mono'] text-xs font-bold ${
                        isActive ? 'text-neon-cyan' : 'text-text-muted'
                      }`}>
                        {block.address}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <p className="text-center text-text-muted text-[10px] mt-3 font-['Share_Tech_Mono']">
              {phase === 'showing' ? '⏳ RECORDING TO MEMORY...' : '👆 REPLAY THE SEQUENCE'}
              {getDifficulty() >= 1 && ' | SHUFFLED'}
              {getDifficulty() >= 2 && ' | GC ACTIVE'}
              {getDifficulty() >= 4 && ' | ⚠ MEMORY LEAK'}
            </p>
          </motion.div>
        )}

        {phase === 'correct' && (
          <motion.div key="correct" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4 py-8">
            <p className="text-6xl">✅</p>
            <p className="font-['Orbitron'] text-neon-cyan font-bold">MEMORY OK</p>
            <p className="font-['Share_Tech_Mono'] text-text-muted text-xs">
              {sequence.length} blocks recalled | Round {round + 1}
            </p>
            <button onClick={nextRound} className="px-8 py-3 bg-neon-cyan text-bg-deep font-['Orbitron'] text-sm font-bold rounded-lg">
              NEXT ROUND
            </button>
          </motion.div>
        )}

        {phase === 'segfault' && (
          <motion.div
            key="segfault"
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <GameResult
              gameId="memory-leak"
              gameName="MEMORY LEAK"
              icon="🧠"
              score={score}
              level={round + 1}
              deathReason="Segmentation Fault (core dumped)"
              extraInfo={`Round ${round + 1} | ${inputIdx}/${sequence.length} recalled`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
