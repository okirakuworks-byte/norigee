import { useCallback, useEffect, useRef, useState } from 'react';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

// --- Constants ---
const WORDS_POOL = [
  'phishing','malware','trojan','ransomware','spyware',
  'keylogger','botnet','exploit','rootkit','worm',
  'ddos','spam','scam','virus','hack',
  'breach','leak','spoof','pharming','vishing',
  'smishing','credential','payload','backdoor','zero-day',
  'brute-force','injection','xss','csrf','mitm',
  'firewall','encrypt','decrypt','patch','token',
  'ssl','vpn','ids','siem','soc',
  'alert','suspicious','urgent','verify','confirm',
  'account','password','login','click','update',
  'expire','invoice','delivery','prize','winner',
  'bank','paypal','amazon','apple','netflix',
  'security','warning','locked','unusual','activity',
];

const BONUS_WORDS = ['OKIRAKU','SECURITY','HUNTER','DEFEND','SHIELD'];
const POTION_WORDS = ['HEAL','RECOVER','POTION','REMEDY','RESTORE'];
const MAX_LIFE = 5;
const HELP_COMBO_THRESHOLD = 10;

const SAKURADA_LINES: Record<string, string[]> = {
  destroy: [
    'ナイスっす！👍','さすがボス！','一撃っすね！',
    'フィッシャー涙目っす！','お見事っす！','キレッキレっすね！',
    'やりますねぇ！','完璧っす！','撃破ァ！',
    'その調子っす！','かっけぇ…！','容赦ないっすね！',
  ],
  combo5: [
    '5コンボ！止まらないっすね！🔥','連続撃破キターー！',
    'コンボ継続！いい感じっす！','ノリノリじゃないっすか！',
  ],
  combo10: [
    '10コンボ！！神っす！！✨','鬼強い…！尊敬っす…！',
    '俺が手を出す隙がないっす…！','もはやプロっすね！',
  ],
  miss: [
    'ドンマイっす！','次いきましょ！🫡','逃げやがったっすね…！',
    'まだまだいけるっす！','気にしない気にしない！',
    '一匹くらい見逃してやりましょ！',
  ],
  lifeWarning: [
    'ヤバいっす…気合い入れて！😰','ライフ残りわずか…！',
    'ボス、集中っす！','ここが踏ん張りどころっす！',
    'まだ終わらないっすよ！',
  ],
  levelUp: [
    'レベルアップ！もっと来いっす！💪','強くなってるっすね！',
    '次のレベル、もっと来るっすよ！','成長してるっす！',
  ],
  potionSpawn: [
    '回復チャンスっす！急いで！💚','緑のやつ、取ってください！',
    'ポーション来たっす！逃すな！','ライフ回復のチャンスっすよ！',
  ],
  potionGet: [
    'ナイス回復！🩹','ライフ復活っす！','助かったっすね！',
    '回復成功！まだまだ戦えるっす！',
  ],
  help: [
    '任せてくださいっす！🛡️','桜田、いきます！！',
    '俺の出番っすね！','アシスト発動っす！！',
  ],
  bonus: [
    'ボーナスワード！高得点っす！⭐','激アツっす！！',
    'ボーナスゲットぉ！','うますぎっす！',
  ],
  idle: [
    '…ボス、寝てます？😴','タイプ！タイプ！','敵が来てるっすよ！',
    '指、動かして！','フィッシャーがニヤニヤしてるっす！',
  ],
  gameStart: [
    'よっしゃ！いくっすよボス！🔥','ミッション開始っす！',
    'フィッシャーども、覚悟しろっす！',
  ],
  gameOverGood: [
    'お疲れ様っす！最高の戦いだったっす！👏',
    'ボス、めちゃくちゃ強かったっす！また一緒に戦いましょ！',
    'すごいスコアっす！次はもっといけるっすよ！',
  ],
  gameOverBad: [
    'ドンマイっす…！次こそリベンジっすよ！💪',
    '敵が強すぎたっすね…でもボスならきっと！',
    'まだまだこれからっす！もう一回いきましょ！',
  ],
  gameOverDeath: [
    'うわぁぁ…！ライフが…！でもボスはよく戦ったっす！😭',
    'やられたっす…！でも次は絶対勝てるっすよ！',
    '悔しいっす…！リベンジいきましょ！🔥',
  ],
};

// --- Types ---
type WordType = 'normal' | 'bonus' | 'potion';

interface ActiveWord {
  id: number;
  text: string;
  type: WordType;
  x: number;
  y: number;
  speed: number;
  matched: number;
  destroyed: boolean;
}

interface GameState {
  score: number;
  level: number;
  combo: number;
  maxCombo: number;
  life: number;
  timeLeft: number;
  destroyed: number;
  missed: number;
  totalTyped: number;
  correctTyped: number;
  deathCause: 'life' | 'time' | null;
}

type Phase = 'start' | 'playing' | 'gameover';

// --- Helpers ---
const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T,>(arr: T[]): T => arr[randInt(0, arr.length - 1)];

function getSpeedForLevel(level: number) {
  return 0.4 + level * 0.15;
}
function getSpawnInterval(level: number) {
  return Math.max(600, 2000 - level * 150);
}
function getPointsForWord(word: string, combo: number, isBonus: boolean) {
  const base = word.length * 10;
  const comboMultiplier = 1 + combo * 0.1;
  const bonusMultiplier = isBonus ? 3 : 1;
  return Math.floor(base * comboMultiplier * bonusMultiplier);
}

export default function PhishingHunter() {
  const [phase, setPhase] = useState<Phase>('start');
  const [sakuradaLine, setSakuradaLine] = useState('');
  const [sakuradaBounce, setSakuradaBounce] = useState(false);
  const [sakuradaDash, setSakuradaDash] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [damageFlash, setDamageFlash] = useState(false);
  const [healFlash, setHealFlash] = useState(false);

  // Mutable game state in refs for animation loop
  const stateRef = useRef<GameState>({
    score: 0, level: 1, combo: 0, maxCombo: 0,
    life: MAX_LIFE, timeLeft: 60, destroyed: 0, missed: 0,
    totalTyped: 0, correctTyped: 0, deathCause: null,
  });
  const wordsRef = useRef<ActiveWord[]>([]);
  const nextIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef(0);
  const timerRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const idleTimerRef = useRef(0);
  const lastTypeRef = useRef(0);
  const helpUsedRef = useRef(false);
  const bubbleTimerRef = useRef(0);
  const runningRef = useRef(false);

  // Force re-render for HUD
  const [, forceRender] = useState(0);
  const tick = useCallback(() => forceRender(n => n + 1), []);

  // --- Sakurada ---
  const sakuradaSay = useCallback((category: string) => {
    const line = pick(SAKURADA_LINES[category]);
    setSakuradaLine(line);
    setSakuradaBounce(true);
    setTimeout(() => setSakuradaBounce(false), 400);
    clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = window.setTimeout(() => setSakuradaLine(''), 2200);
  }, []);

  // --- Game actions ---
  const destroyWord = useCallback((wordObj: ActiveWord) => {
    wordObj.destroyed = true;
    const s = stateRef.current;

    if (wordObj.type === 'potion') {
      if (s.life < MAX_LIFE) {
        s.life = Math.min(MAX_LIFE, s.life + 1);
        setHealFlash(true);
        setTimeout(() => setHealFlash(false), 200);
        sakuradaSay('potionGet');
      }
    }

    const points = getPointsForWord(wordObj.text, s.combo, wordObj.type === 'bonus');
    s.score += points;
    s.destroyed++;
    s.combo++;
    if (s.combo > s.maxCombo) s.maxCombo = s.combo;

    // Sakurada reactions
    if (wordObj.type === 'bonus') {
      sakuradaSay('bonus');
    } else if (s.combo === HELP_COMBO_THRESHOLD && !helpUsedRef.current) {
      // Trigger help
      sakuradaSay('help');
      setSakuradaDash(true);
      setTimeout(() => setSakuradaDash(false), 600);
      setShowHelp(true);
      setTimeout(() => setShowHelp(false), 1200);
      helpUsedRef.current = true;
      // Auto-destroy most dangerous enemy
      setTimeout(() => {
        const words = wordsRef.current.filter(w => !w.destroyed);
        let target: ActiveWord | null = null;
        let maxY = -Infinity;
        for (const w of words) {
          if (w.type === 'normal' && w.y > maxY) { maxY = w.y; target = w; }
        }
        if (target) destroyWord(target);
      }, 300);
    } else if (s.combo > 0 && s.combo % 10 === 0) {
      sakuradaSay('combo10');
    } else if (s.combo > 0 && s.combo % 5 === 0) {
      sakuradaSay('combo5');
    } else if (wordObj.type !== 'potion' && Math.random() < 0.4) {
      sakuradaSay('destroy');
    }

    // Level up check
    const newLevel = Math.floor(s.destroyed / 8) + 1;
    if (newLevel > s.level) {
      s.level = newLevel;
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 1200);
      sakuradaSay('levelUp');
      clearInterval(spawnTimerRef.current);
      spawnTimerRef.current = window.setInterval(spawnWord, getSpawnInterval(s.level));
    }

    // Remove from array after animation
    setTimeout(() => {
      wordsRef.current = wordsRef.current.filter(w => w !== wordObj);
    }, 350);

    tick();
  }, [sakuradaSay, tick]);

  const missWord = useCallback((wordObj: ActiveWord) => {
    wordsRef.current = wordsRef.current.filter(w => w !== wordObj);
    const s = stateRef.current;
    s.missed++;
    s.combo = 0;
    helpUsedRef.current = false;

    if (wordObj.type !== 'potion') {
      s.life = Math.max(0, s.life - 1);
      setDamageFlash(true);
      setTimeout(() => setDamageFlash(false), 150);

      if (s.life <= 2 && s.life > 0) {
        sakuradaSay('lifeWarning');
      } else if (s.life > 0) {
        sakuradaSay('miss');
      }

      if (s.life <= 0) {
        s.deathCause = 'life';
        endGame();
        return;
      }
    }
    tick();
  }, [sakuradaSay, tick]);

  // spawnWord needs to be stable
  const spawnWord = useCallback(() => {
    if (!runningRef.current) return;
    const s = stateRef.current;
    const gameArea = gameAreaRef.current;
    if (!gameArea) return;

    const potionRoll = Math.random();
    const bonusRoll = Math.random();
    let type: WordType = 'normal';
    let text: string;

    if (potionRoll < 0.05) {
      type = 'potion';
      text = pick(POTION_WORDS);
      sakuradaSay('potionSpawn');
    } else if (bonusRoll < 0.08) {
      type = 'bonus';
      text = pick(BONUS_WORDS);
    } else {
      text = pick(WORDS_POOL);
    }

    const areaWidth = gameArea.clientWidth;
    const wordObj: ActiveWord = {
      id: nextIdRef.current++,
      text: text.toLowerCase(),
      type,
      x: rand(20, areaWidth - 160),
      y: -40,
      speed: getSpeedForLevel(s.level) * rand(0.8, 1.2),
      matched: 0,
      destroyed: false,
    };
    wordsRef.current.push(wordObj);
    tick();
  }, [sakuradaSay, tick]);

  const endGame = useCallback(() => {
    runningRef.current = false;
    clearInterval(timerRef.current);
    clearInterval(spawnTimerRef.current);
    clearInterval(idleTimerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    wordsRef.current = [];
    setPhase('gameover');
    tick();
  }, [tick]);

  const startGame = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(spawnTimerRef.current);
    clearInterval(idleTimerRef.current);
    cancelAnimationFrame(animFrameRef.current);

    stateRef.current = {
      score: 0, level: 1, combo: 0, maxCombo: 0,
      life: MAX_LIFE, timeLeft: 60, destroyed: 0, missed: 0,
      totalTyped: 0, correctTyped: 0, deathCause: null,
    };
    wordsRef.current = [];
    nextIdRef.current = 0;
    lastTypeRef.current = Date.now();
    helpUsedRef.current = false;
    runningRef.current = true;

    setPhase('playing');
    tick();
    sakuradaSay('gameStart');

    // Timer
    timerRef.current = window.setInterval(() => {
      const s = stateRef.current;
      s.timeLeft--;
      tick();
      if (s.timeLeft <= 0) {
        s.deathCause = 'time';
        endGame();
      }
    }, 1000);

    // Spawn
    spawnTimerRef.current = window.setInterval(spawnWord, getSpawnInterval(1));
    spawnWord();

    // Idle detection
    idleTimerRef.current = window.setInterval(() => {
      if (runningRef.current && Date.now() - lastTypeRef.current > 5000) {
        sakuradaSay('idle');
      }
    }, 6000);

    // Game loop
    function gameLoop() {
      if (!runningRef.current) return;
      const gameArea = gameAreaRef.current;
      if (!gameArea) return;
      const areaHeight = gameArea.clientHeight;

      for (let i = wordsRef.current.length - 1; i >= 0; i--) {
        const w = wordsRef.current[i];
        if (w.destroyed) continue;
        w.y += w.speed;
        if (w.y > areaHeight + 20) {
          missWord(w);
        }
      }
      tick();
      animFrameRef.current = requestAnimationFrame(gameLoop);
    }
    animFrameRef.current = requestAnimationFrame(gameLoop);

    setTimeout(() => inputRef.current?.focus(), 50);
  }, [endGame, missWord, sakuradaSay, spawnWord, tick]);

  // Handle input
  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().trim();
    if (!val) return;
    const s = stateRef.current;
    s.totalTyped++;
    lastTypeRef.current = Date.now();

    let bestMatch: ActiveWord | null = null;
    for (const w of wordsRef.current) {
      if (!w.destroyed && w.text === val) { bestMatch = w; break; }
    }

    if (bestMatch) {
      s.correctTyped++;
      destroyWord(bestMatch);
      e.target.value = '';
      return;
    }

    // Partial match
    for (const w of wordsRef.current) {
      if (!w.destroyed && w.text.startsWith(val)) {
        w.matched = val.length;
        tick();
        return;
      }
    }
  }, [destroyWord, tick]);

  // Keyboard: Enter to start/retry, keep focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && phase !== 'playing') {
        startGame();
      }
      if (phase === 'playing' && inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [phase, startGame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(spawnTimerRef.current);
      clearInterval(idleTimerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      runningRef.current = false;
    };
  }, []);

  const s = stateRef.current;
  const accuracy = s.totalTyped > 0 ? Math.round((s.correctTyped / s.totalTyped) * 100) + '%' : '---';

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0e17] text-[#e0e6ed] font-mono select-none">
      {/* Danmaku comments during play */}
      {phase === 'playing' && <GameComments gameId="phishing-hunter" mode="danmaku" />}

      {/* Scanline overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[999]"
        style={{
          background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,229,255,.03) 2px,rgba(0,229,255,.03) 4px)',
        }}
      />

      {/* Damage / Heal flash */}
      <div className={`fixed inset-0 z-30 pointer-events-none transition-opacity duration-100 ${damageFlash ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'rgba(255,23,68,.15)' }} />
      <div className={`fixed inset-0 z-30 pointer-events-none transition-opacity duration-100 ${healFlash ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'rgba(118,255,3,.1)' }} />

      {/* HUD */}
      {phase === 'playing' && (
        <div className="fixed top-0 left-0 right-0 flex justify-between items-center px-5 py-2.5 z-10 text-sm" style={{ background: 'rgba(15,25,50,.85)', borderBottom: '1px solid rgba(0,229,255,.2)' }}>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-white/50">Score</div>
            <div className="text-xl font-bold text-[#00e5ff]" style={{ textShadow: '0 0 12px rgba(0,229,255,.4)' }}>{s.score}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-white/50">Level</div>
            <div className="text-xl font-bold text-[#00e5ff]" style={{ textShadow: '0 0 12px rgba(0,229,255,.4)' }}>{s.level}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-white/50">Combo</div>
            <div className="text-xl font-bold text-[#ffea00]">{s.combo}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-white/50">Life</div>
            <div className="text-[22px] tracking-wider">
              {Array.from({ length: MAX_LIFE }, (_, i) => (
                <span key={i} className={i < s.life ? 'text-[#ff1744]' : 'text-[#ff1744]/20'} style={i < s.life ? { textShadow: '0 0 8px rgba(255,23,68,.6)' } : undefined}>
                  ♥
                </span>
              ))}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-white/50">Time</div>
            <div className="text-xl font-bold text-[#ff1744]">{s.timeLeft}</div>
          </div>
        </div>
      )}

      {/* Game Area */}
      <div ref={gameAreaRef} className="fixed left-0 right-0 overflow-hidden" style={{ top: phase === 'playing' ? 52 : 0, bottom: phase === 'playing' ? 80 : 0 }}>
        {phase === 'playing' && wordsRef.current.filter(w => !w.destroyed).map(w => {
          const typeStyles: Record<WordType, { bg: string; border: string; color: string; shadow: string }> = {
            normal: { bg: 'rgba(255,23,68,.15)', border: '#ff1744', color: '#ff1744', shadow: '0 0 8px rgba(255,23,68,.5)' },
            bonus: { bg: 'rgba(255,234,0,.15)', border: '#ffea00', color: '#ffea00', shadow: '0 0 8px rgba(255,234,0,.5)' },
            potion: { bg: 'rgba(118,255,3,.15)', border: '#76ff03', color: '#76ff03', shadow: '0 0 8px rgba(118,255,3,.5)' },
          };
          const st = typeStyles[w.type];
          return (
            <div
              key={w.id}
              className={`absolute px-3.5 py-1.5 rounded font-bold tracking-wider whitespace-nowrap text-lg border ${w.type === 'bonus' ? 'animate-pulse' : ''}`}
              style={{
                left: w.x,
                top: w.y,
                background: st.bg,
                borderColor: st.border,
                color: st.color,
                textShadow: st.shadow,
                animation: w.type === 'potion' ? 'potionGlow 1.2s infinite' : undefined,
              }}
            >
              {w.matched > 0 ? (
                <>
                  <span className="text-[#00e676]" style={{ textShadow: '0 0 6px rgba(0,230,118,.6)' }}>
                    {w.text.substring(0, w.matched).toUpperCase()}
                  </span>
                  {w.text.substring(w.matched).toUpperCase()}
                </>
              ) : (
                w.text.toUpperCase()
              )}
            </div>
          );
        })}
      </div>

      {/* Sakurada Character */}
      {phase === 'playing' && (
        <div className="fixed bottom-[90px] right-4 z-20 flex flex-col items-end pointer-events-none">
          <div
            className={`mb-2 px-3.5 py-2 rounded-xl max-w-[220px] text-[13px] leading-relaxed transition-all duration-300 ${sakuradaLine ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-90'}`}
            style={{
              background: 'rgba(15,25,50,.92)',
              border: '1px solid #00e5ff',
              borderRadius: '12px 12px 4px 12px',
              boxShadow: '0 0 15px rgba(0,229,255,.15)',
            }}
          >
            {sakuradaLine}
          </div>
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-[28px] relative overflow-hidden ${sakuradaBounce ? 'animate-bounce' : ''}`}
            style={{
              background: 'linear-gradient(135deg,#1a2a4a,#0d1a30)',
              border: '2px solid #00e5ff',
              boxShadow: '0 0 12px rgba(0,229,255,.3)',
              animation: sakuradaDash ? 'sakuradaDash .6s' : sakuradaBounce ? 'sakuradaBounce .4s' : undefined,
            }}
          >
            🛡️
          </div>
        </div>
      )}

      {/* Input Bar */}
      {phase === 'playing' && (
        <div className="fixed bottom-0 left-0 right-0 h-20 flex items-center justify-center z-10" style={{ background: 'rgba(15,25,50,.85)', borderTop: '1px solid rgba(0,229,255,.2)' }}>
          <input
            ref={inputRef}
            type="text"
            onChange={handleInput}
            placeholder="Type to destroy..."
            autoComplete="off"
            className="w-[min(500px,80vw)] px-5 py-3 text-[22px] font-mono text-center tracking-wider rounded-lg outline-none"
            style={{
              background: 'rgba(0,0,0,.6)',
              border: '2px solid #00e5ff',
              color: '#00e5ff',
              boxShadow: '0 0 12px rgba(0,229,255,.4)',
            }}
          />
        </div>
      )}

      {/* Level Up Banner */}
      <div
        className={`fixed top-1/2 left-1/2 z-50 pointer-events-none text-4xl font-bold text-[#ffea00] transition-all duration-400 ${showLevelUp ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
        style={{
          transform: `translate(-50%,-50%) scale(${showLevelUp ? 1 : 0})`,
          textShadow: '0 0 20px rgba(255,234,0,.6)',
        }}
      >
        LEVEL UP!
      </div>

      {/* Sakurada Help Banner */}
      <div
        className={`fixed top-1/2 left-1/2 z-50 pointer-events-none text-2xl font-bold text-[#00e5ff] whitespace-nowrap transition-all duration-400 ${showHelp ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
        style={{
          transform: `translate(-50%,-50%) scale(${showHelp ? 1 : 0})`,
          textShadow: '0 0 20px rgba(0,229,255,.6)',
        }}
      >
        🛡️ SAKURADA ASSIST!
      </div>

      {/* Start Screen */}
      {phase === 'start' && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-[100]" style={{ background: 'rgba(10,14,23,.92)' }}>
          <GameIntro
            icon="🛡️"
            title="PHISHING HUNTER"
            gameId="phishing-hunter"
            subtitle="フィッシング詐欺を撃退せよ"
            controls={[
              { icon: '⌨️', label: 'TYPE', desc: 'キーワードを入力' },
              { icon: '↵', label: 'ENTER', desc: 'スタート/リトライ' },
            ]}
            rules={[
              { text: '上から落ちてくるフィッシングワードをタイプして撃破' },
              { text: 'ライフ0でゲームオーバー', highlight: true },
              { text: '緑の回復ワードでライフ回復' },
              { text: '桜田くんが10コンボでアシスト発動' },
            ]}
            tip="ボーナスワード(OKIRAKU等)は3倍点数！"
            buttonText="HUNT"
            buttonColor="bg-[#00e5ff] text-[#0a0e17]"
            onStart={startGame}
          />
        </div>
      )}

      {/* Game Over Screen */}
      {phase === 'gameover' && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-[100] overflow-auto" style={{ background: 'rgba(10,14,23,.92)' }}>
          <GameResult
            gameId="phishing-hunter"
            gameName="PHISHING HUNTER"
            icon="🛡️"
            score={s.score}
            level={s.level}
            deathReason={s.deathCause === 'life' ? 'LIFE LOST — ライフが尽きた' : undefined}
            extraInfo={`撃破: ${s.destroyed} | 逃走: ${s.missed} | 最大コンボ: ${s.maxCombo} | 正確率: ${accuracy}`}
            onRetry={() => setPhase('ready')}
          />
        </div>
      )}

      {/* Keyframe styles */}
      <style>{`
        @keyframes potionGlow {
          0%,100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.08); filter: brightness(1.3); }
        }
        @keyframes sakuradaBounce {
          0%,100% { transform: scale(1); }
          30% { transform: scale(1.2) rotate(-5deg); }
          60% { transform: scale(.95) rotate(3deg); }
        }
        @keyframes sakuradaDash {
          0% { transform: scale(1) translateX(0); }
          30% { transform: scale(1.3) translateX(-40px); }
          60% { transform: scale(1.1) translateX(-20px); }
          100% { transform: scale(1) translateX(0); }
        }
      `}</style>
    </div>
  );
}
