import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

interface Enemy {
  id: number;
  x: number;
  y: number;
  type: 'tracker' | 'stealth' | 'splitter' | 'friendly';
  speed: number;
  alive: boolean;
}

type Phase = 'ready' | 'playing' | 'gameover';

let enemyIdCounter = 0;

export default function CookieDefenseGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [cookies, setCookies] = useState(5);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [combo, setCombo] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [fakeHistory, setFakeHistory] = useState<string[]>([]);
  const frameRef = useRef<number>();
  const spawnRef = useRef<ReturnType<typeof setInterval>>();
  const startRef = useRef(0);
  const cookiesRef = useRef(5);
  const enemiesRef = useRef<Enemy[]>([]);

  const FIELD_SIZE = 300;
  const COOKIE_POS = { x: FIELD_SIZE / 2, y: FIELD_SIZE / 2 };

  const FAKE_HISTORIES = [
    '深夜3時 "猫 かわいい 動画 3時間"',
    '"退職届 書き方 テンプレ"',
    '"上司 うざい 対処法"',
    '"宝くじ 当たる 方法 確実"',
    '"明日 会社 休む 理由 一覧"',
    '"筋トレ やり方" → 3日で検索停止',
    '"一人暮らし 寂しい 夜"',
    '"カップ麺 アレンジ 高級感"',
  ];

  const getDifficulty = useCallback(() => {
    if (timeElapsed >= 45) return 3;
    if (timeElapsed >= 25) return 2;
    return 1;
  }, [timeElapsed]);

  const spawnEnemy = useCallback(() => {
    const diff = getDifficulty();
    const side = Math.floor(Math.random() * 4);
    let x: number, y: number;
    switch (side) {
      case 0: x = Math.random() * FIELD_SIZE; y = -20; break;
      case 1: x = FIELD_SIZE + 20; y = Math.random() * FIELD_SIZE; break;
      case 2: x = Math.random() * FIELD_SIZE; y = FIELD_SIZE + 20; break;
      default: x = -20; y = Math.random() * FIELD_SIZE; break;
    }

    const types: Enemy['type'][] = ['tracker'];
    if (diff >= 2) types.push('stealth', 'friendly');
    if (diff >= 3) types.push('splitter');
    const type = types[Math.floor(Math.random() * types.length)];

    const enemy: Enemy = {
      id: ++enemyIdCounter,
      x, y,
      type,
      speed: 0.5 + Math.random() * 0.5 + diff * 0.2,
      alive: true,
    };

    enemiesRef.current = [...enemiesRef.current, enemy];
    setEnemies([...enemiesRef.current]);
  }, [getDifficulty]);

  const start = () => {
    enemyIdCounter = 0;
    setCookies(5);
    cookiesRef.current = 5;
    setScore(0);
    setCombo(0);
    setTimeElapsed(0);
    setEnemies([]);
    enemiesRef.current = [];
    startRef.current = Date.now();
    setPhase('playing');
  };

  // Game loop
  useEffect(() => {
    if (phase !== 'playing') return;

    const loop = () => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      setTimeElapsed(elapsed);

      // Move enemies toward cookie
      enemiesRef.current = enemiesRef.current.map((e) => {
        if (!e.alive) return e;
        const dx = COOKIE_POS.x - e.x;
        const dy = COOKIE_POS.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 20) {
          // Reached cookie!
          if (e.type === 'friendly') return e; // friendly doesn't steal
          cookiesRef.current = Math.max(0, cookiesRef.current - 1);
          setCookies(cookiesRef.current);
          if (cookiesRef.current <= 0) {
            setPhase('gameover');
            const histories = [...FAKE_HISTORIES].sort(() => Math.random() - 0.5).slice(0, 4);
            setFakeHistory(histories);
          }
          return { ...e, alive: false };
        }

        return {
          ...e,
          x: e.x + (dx / dist) * e.speed,
          y: e.y + (dy / dist) * e.speed,
        };
      }).filter((e) => e.alive);

      setEnemies([...enemiesRef.current]);
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [phase]);

  // Spawn enemies
  useEffect(() => {
    if (phase !== 'playing') return;
    const diff = getDifficulty();
    const interval = [1000, 600, 350][diff - 1];

    spawnRef.current = setInterval(spawnEnemy, interval);
    return () => clearInterval(spawnRef.current);
  }, [phase, getDifficulty, spawnEnemy]);

  const tapEnemy = (enemy: Enemy) => {
    if (phase !== 'playing') return;

    if (enemy.type === 'friendly') {
      // Hit friendly = penalty
      cookiesRef.current = Math.max(0, cookiesRef.current - 1);
      setCookies(cookiesRef.current);
      setCombo(0);
      if (cookiesRef.current <= 0) {
        setPhase('gameover');
        setFakeHistory([...FAKE_HISTORIES].sort(() => Math.random() - 0.5).slice(0, 4));
      }
      return;
    }

    // Kill enemy
    enemiesRef.current = enemiesRef.current.map((e) =>
      e.id === enemy.id ? { ...e, alive: false } : e
    );
    setEnemies([...enemiesRef.current]);

    const comboMultiplier = combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1;
    setScore((s) => s + Math.floor(50 * comboMultiplier));
    setCombo((c) => c + 1);

    // Splitter: spawn 2 smaller enemies
    if (enemy.type === 'splitter') {
      for (let i = 0; i < 2; i++) {
        const child: Enemy = {
          id: ++enemyIdCounter,
          x: enemy.x + (Math.random() - 0.5) * 30,
          y: enemy.y + (Math.random() - 0.5) * 30,
          type: 'tracker',
          speed: enemy.speed * 1.2,
          alive: true,
        };
        enemiesRef.current.push(child);
      }
      setEnemies([...enemiesRef.current]);
    }
  };

  const getEnemyStyle = (enemy: Enemy) => {
    switch (enemy.type) {
      case 'tracker': return { emoji: '🦠', opacity: 1, label: '3rd party' };
      case 'stealth': return { emoji: '👻', opacity: 0.3, label: 'stealth' };
      case 'splitter': return { emoji: '🧫', opacity: 1, label: 'splits!' };
      case 'friendly': return { emoji: '🍪', opacity: 1, label: '1st party' };
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-yellow tracking-[0.3em] mb-1">COOKIE DEFENSE</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">クッキー防衛戦</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🍪"
              title="COOKIE DEFENSE"
              gameId="cookie-defense"
              subtitle="クッキー防衛戦"
              controls={[
                { icon: '👆', label: 'TAP', desc: 'トラッカーを撃退' },
              ]}
              rules={[
                { text: '四方から迫るトラッカー🦠をタップで撃退' },
                { text: '🍪 1st partyを叩くとCookieが割れる', highlight: true },
                { text: '👻 ステルスは半透明。見逃すな' },
                { text: 'Cookieが全部盗まれたらセッションハイジャック完了', highlight: true },
              ]}
              tip="🧫スプリッターを倒すと2体に分裂するぞ"
              buttonText="DEFEND"
              buttonColor="bg-neon-yellow text-bg-deep"
              onStart={start}
            />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* HUD */}
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              <span>{'🍪'.repeat(cookies)}</span>
              {combo >= 3 && <span className="text-neon-cyan animate-pulse">x{combo >= 5 ? '2.0' : '1.5'}</span>}
              <span className="font-['Share_Tech_Mono'] text-text-muted">{Math.floor(timeElapsed)}s</span>
            </div>

            {/* Game field */}
            <div
              className="relative bg-bg-deep border-2 border-bg-raised rounded-xl overflow-hidden mx-auto"
              style={{ width: FIELD_SIZE, height: FIELD_SIZE }}
            >
              <GameComments gameId="cookie-defense" mode="danmaku" />

              {/* Cookie in center */}
              <div
                className="absolute flex items-center justify-center"
                style={{ left: COOKIE_POS.x - 20, top: COOKIE_POS.y - 20, width: 40, height: 40 }}
              >
                <motion.span
                  className="text-3xl"
                  animate={cookies <= 2 ? { scale: [1, 0.8, 1] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  🍪
                </motion.span>
              </div>

              {/* Enemies */}
              {enemies.filter((e) => e.alive).map((enemy) => {
                const style = getEnemyStyle(enemy);
                return (
                  <motion.button
                    key={enemy.id}
                    onClick={() => tapEnemy(enemy)}
                    className="absolute w-10 h-10 flex items-center justify-center cursor-pointer"
                    style={{
                      left: enemy.x - 20,
                      top: enemy.y - 20,
                      opacity: style.opacity,
                    }}
                    whileTap={{ scale: 0 }}
                  >
                    <span className="text-xl">{style.emoji}</span>
                  </motion.button>
                );
              })}
            </div>

            <p className="text-center text-text-muted text-[10px] mt-2 font-['Share_Tech_Mono']">
              PHASE {getDifficulty()}/3 {getDifficulty() >= 2 && '| 👻 STEALTH'} {getDifficulty() >= 3 && '| 🧫 SPLITTERS'}
            </p>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="cookie-defense"
              gameName="COOKIE DEFENSE"
              icon="🍪"
              score={score}
              level={getDifficulty()}
              deathReason="SESSION HIJACKED"
              extraInfo={`${Math.floor(timeElapsed)}秒 生存`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
