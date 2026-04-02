import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

type CaptchaType = 'text' | 'tiles';
type Phase = 'ready' | 'playing' | 'gameover';

const DISTORTED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function randomChars(len: number): string {
  return Array.from({ length: len }, () => DISTORTED_CHARS[Math.floor(Math.random() * DISTORTED_CHARS.length)]).join('');
}

const TILE_LABELS = ['信号機', 'バス', '横断歩道', '自転車', '消火栓', '山', '階段', '橋'];
const TRAP_LABELS = ['街灯', 'ポスト', '電柱', 'ゴミ箱', 'ベンチ', '柵', '看板', 'マンホール'];

interface TilePuzzle {
  target: string;
  tiles: { id: number; label: string; isTarget: boolean; emoji: string }[];
}

const TILE_EMOJIS: Record<string, string> = {
  '信号機': '🚦', 'バス': '🚌', '横断歩道': '🚶', '自転車': '🚲',
  '消火栓': '🧯', '山': '⛰️', '階段': '🪜', '橋': '🌉',
  '街灯': '🏮', 'ポスト': '📮', '電柱': '📡', 'ゴミ箱': '🗑️',
  'ベンチ': '🪑', '柵': '🚧', '看板': '🪧', 'マンホール': '⭕',
};

function generateTilePuzzle(difficulty: number): TilePuzzle {
  const target = TILE_LABELS[Math.floor(Math.random() * TILE_LABELS.length)];
  const targetCount = 2 + Math.floor(Math.random() * 2);
  const tiles: TilePuzzle['tiles'] = [];

  for (let i = 0; i < targetCount; i++) {
    tiles.push({ id: tiles.length, label: target, isTarget: true, emoji: TILE_EMOJIS[target] || '❓' });
  }

  // Add traps (similar looking things)
  const trapCount = difficulty >= 2 ? 2 : 1;
  for (let i = 0; i < trapCount; i++) {
    const trap = TRAP_LABELS[Math.floor(Math.random() * TRAP_LABELS.length)];
    tiles.push({ id: tiles.length, label: trap, isTarget: false, emoji: TILE_EMOJIS[trap] || '❓' });
  }

  // Fill rest with random non-targets
  while (tiles.length < 9) {
    const other = [...TILE_LABELS, ...TRAP_LABELS].filter((l) => l !== target);
    const pick = other[Math.floor(Math.random() * other.length)];
    tiles.push({ id: tiles.length, label: pick, isTarget: false, emoji: TILE_EMOJIS[pick] || '❓' });
  }

  // Shuffle
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  return { target, tiles };
}

export default function CaptchaHellGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [captchaType, setCaptchaType] = useState<CaptchaType>('text');
  const [textAnswer, setTextAnswer] = useState('');
  const [textChars, setTextChars] = useState('');
  const [textInput, setTextInput] = useState('');
  const [tilePuzzle, setTilePuzzle] = useState<TilePuzzle | null>(null);
  const [selectedTiles, setSelectedTiles] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(5);
  const [trustScore, setTrustScore] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const getDifficulty = useCallback(() => {
    if (level >= 7) return 3;
    if (level >= 4) return 2;
    return 1;
  }, [level]);

  const getTimeLimit = useCallback(() => {
    const d = getDifficulty();
    return [5, 3, 1.5][d - 1];
  }, [getDifficulty]);

  const generateCaptcha = useCallback(() => {
    const type: CaptchaType = Math.random() > 0.5 ? 'text' : 'tiles';
    setCaptchaType(type);
    setSelectedTiles(new Set());
    setTextInput('');

    if (type === 'text') {
      const d = getDifficulty();
      const len = [4, 6, 8][d - 1];
      const chars = randomChars(len);
      setTextChars(chars);
      setTextAnswer(chars);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setTilePuzzle(generateTilePuzzle(getDifficulty()));
    }

    // Timer
    const limit = getTimeLimit();
    setTimeLeft(limit);
    const start = Date.now();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, limit - (Date.now() - start) / 1000);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        handleFail();
      }
    }, 50);
  }, [getDifficulty, getTimeLimit]);

  const handleFail = useCallback(() => {
    setLives((l) => {
      const newL = l - 1;
      setTrustScore((t) => Math.max(0, t - 25));
      if (newL <= 0) {
        clearInterval(timerRef.current);
        setPhase('gameover');
      } else {
        // Next captcha
        setTimeout(() => generateCaptcha(), 500);
      }
      return newL;
    });
  }, [generateCaptcha]);

  const handleSuccess = useCallback(() => {
    clearInterval(timerRef.current);
    setScore((s) => s + Math.floor(100 + timeLeft * 50));
    setLevel((l) => l + 1);
    setTimeout(() => generateCaptcha(), 300);
  }, [generateCaptcha, timeLeft]);

  const start = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setTrustScore(100);
    setPhase('playing');
    generateCaptcha();
  };

  const submitText = () => {
    if (textInput.toLowerCase() === textAnswer.toLowerCase()) {
      handleSuccess();
    } else {
      handleFail();
    }
  };

  const submitTiles = () => {
    if (!tilePuzzle) return;
    const targetIds = new Set(tilePuzzle.tiles.filter((t) => t.isTarget).map((t) => t.id));
    const correct = selectedTiles.size === targetIds.size &&
      [...selectedTiles].every((id) => targetIds.has(id));
    if (correct) {
      handleSuccess();
    } else {
      handleFail();
    }
  };

  const toggleTile = (id: number) => {
    setSelectedTiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const diff = getDifficulty();

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      {/* Danmaku comments during play */}
      {phase === 'playing' && <GameComments gameId="captcha-hell" mode="danmaku" />}

      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-yellow tracking-[0.3em] mb-1">CAPTCHA HELL</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">キャプチャ地獄</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🤖"
              title="CAPTCHA HELL"
              gameId="captcha-hell"
              subtitle="キャプチャ地獄"
              controls={[
                { icon: '⌨️', label: 'TYPE', desc: '文字を入力' },
                { icon: '👆', label: 'TAP', desc: 'タイルを選択' },
              ]}
              rules={[
                { text: 'お前がbotじゃないことを証明しろ' },
                { text: '制限時間: 5秒→3秒→1.5秒' },
                { text: '3回ミスでbot認定', highlight: true },
              ]}
              tip="信頼スコアが下がると最終的にルンバ認定される"
              buttonText="I'M NOT A ROBOT"
              buttonColor="bg-neon-yellow text-bg-deep"
              onStart={start}
            />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* HUD */}
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              <span className="text-text-muted">{'❤️'.repeat(lives)}{'🖤'.repeat(3 - lives)}</span>
              <span className="font-['Orbitron'] text-text-muted">Lv.{level}</span>
            </div>

            {/* Timer */}
            <div className="h-2 bg-bg-raised rounded-full overflow-hidden mb-4">
              <div
                className={`h-full transition-all duration-100 ${timeLeft <= 1 ? 'bg-neon-pink' : 'bg-neon-yellow'}`}
                style={{ width: `${(timeLeft / getTimeLimit()) * 100}%` }}
              />
            </div>

            {/* CAPTCHA box */}
            <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                <div className="w-6 h-6 rounded border-2 border-gray-300 flex items-center justify-center">
                  <span className="text-xs">☐</span>
                </div>
                <span className="text-gray-700 text-sm">I'm not a robot</span>
                <span className="ml-auto text-gray-400 text-[10px]">reCAPTCHA</span>
              </div>

              {captchaType === 'text' && (
                <div className="space-y-3">
                  <p className="text-gray-500 text-xs text-center">以下の文字を入力してください</p>

                  {/* Distorted text */}
                  <div className="bg-gray-100 rounded-lg p-4 text-center overflow-hidden">
                    <div className="flex justify-center gap-0">
                      {textChars.split('').map((char, i) => (
                        <motion.span
                          key={i}
                          className="inline-block text-2xl font-bold text-gray-800"
                          style={{
                            fontFamily: ['serif', 'monospace', 'cursive', 'fantasy'][i % 4],
                          }}
                          animate={diff >= 2 ? {
                            rotate: [0, (Math.random() - 0.5) * 30],
                            y: diff >= 3 ? [0, Math.random() * 20] : 0,
                            opacity: diff >= 3 ? [1, 0.3, 1] : 1,
                          } : {
                            rotate: (Math.random() - 0.5) * 15,
                          }}
                          transition={diff >= 3 ? { duration: 0.5 + Math.random(), repeat: Infinity } : { duration: 0 }}
                        >
                          {char}
                        </motion.span>
                      ))}
                    </div>
                    {/* Noise lines */}
                    {diff >= 2 && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30" viewBox="0 0 200 60">
                        <line x1="0" y1={10 + Math.random() * 40} x2="200" y2={10 + Math.random() * 40} stroke="#666" strokeWidth="1" />
                        <line x1="0" y1={10 + Math.random() * 40} x2="200" y2={10 + Math.random() * 40} stroke="#999" strokeWidth="1" />
                      </svg>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitText()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-gray-800 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="文字を入力..."
                      autoComplete="off"
                    />
                    <button onClick={submitText} className="px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">
                      確認
                    </button>
                  </div>
                </div>
              )}

              {captchaType === 'tiles' && tilePuzzle && (
                <div className="space-y-3">
                  <p className="text-gray-700 text-sm text-center font-bold">
                    「{tilePuzzle.target}」を全て選択してください
                  </p>

                  <div className="grid grid-cols-3 gap-1">
                    {tilePuzzle.tiles.map((tile) => (
                      <button
                        key={tile.id}
                        onClick={() => toggleTile(tile.id)}
                        className={`aspect-square rounded flex flex-col items-center justify-center text-2xl transition-all ${
                          selectedTiles.has(tile.id)
                            ? 'bg-blue-100 border-2 border-blue-500'
                            : 'bg-gray-100 border-2 border-transparent hover:bg-gray-200'
                        } ${diff >= 2 ? 'grayscale' : ''}`}
                        style={diff >= 3 ? { filter: `blur(${Math.random() * 2}px) grayscale(0.8)` } : {}}
                      >
                        <span>{tile.emoji}</span>
                        {diff < 2 && <span className="text-[8px] text-gray-500">{tile.label}</span>}
                      </button>
                    ))}
                  </div>

                  <button onClick={submitTiles} className="w-full py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">
                    確認
                  </button>
                </div>
              )}
            </div>

            <p className="text-center text-text-muted text-[10px] mt-2 font-['Share_Tech_Mono']">
              TRUST SCORE: {trustScore}%
            </p>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="captcha-hell"
              gameName="CAPTCHA HELL"
              icon="🤖"
              score={score}
              level={level}
              deathReason="ACCESS DENIED — BOT DETECTED"
              extraInfo={`信頼スコア: ${trustScore}%`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
