import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

interface Notification {
  id: number;
  app: string;
  emoji: string;
  message: string;
  action: 'reply' | 'ignore' | 'urgent'; // correct action
}

const NOTIFICATIONS: Omit<Notification, 'id'>[] = [
  // Reply (right swipe)
  { app: 'LINE', emoji: '💬', message: '田中: 今夜飲みに行かない？', action: 'reply' },
  { app: 'LINE', emoji: '💬', message: '母: ご飯食べた？', action: 'reply' },
  { app: 'Slack', emoji: '💼', message: '#general: レビューお願いします', action: 'reply' },
  { app: 'メール', emoji: '📧', message: '【要返信】ミーティング日程確認', action: 'reply' },
  { app: 'LINE', emoji: '💬', message: '佐藤: 資料送ってもらえる？', action: 'reply' },
  // Ignore (left swipe)
  { app: '広告', emoji: '📢', message: '今だけ50%OFF！残り3時間！', action: 'ignore' },
  { app: '天気', emoji: '☀️', message: '明日は晴れ、最高気温24°C', action: 'ignore' },
  { app: 'ニュース', emoji: '📰', message: '【速報】パンダが竹を食べた', action: 'ignore' },
  { app: 'アプリ', emoji: '🔔', message: '最近使ってないですよ！', action: 'ignore' },
  { app: 'ゲーム', emoji: '🎮', message: '体力が回復しました！', action: 'ignore' },
  { app: '広告', emoji: '💎', message: '激レア確定ガチャ開催中！', action: 'ignore' },
  // Urgent (up swipe)
  { app: '上司', emoji: '🔥', message: 'ちょっといい？至急。', action: 'urgent' },
  { app: 'セキュリティ', emoji: '🚨', message: '不審なログインが検出されました', action: 'urgent' },
  { app: 'サーバー', emoji: '💀', message: 'CPU 98%: 本番環境アラート', action: 'urgent' },
  { app: '母', emoji: '📞', message: '電話出なさい（3回目）', action: 'urgent' },
  // Tricky
  { app: 'LINE', emoji: '💬', message: '鈴木: ...', action: 'reply' },
  { app: '設定', emoji: '⚙️', message: 'iOSアップデートが利用可能です', action: 'ignore' },
  { app: 'Slack', emoji: '💼', message: '@channel 緊急: 本番障害発生', action: 'urgent' },
];

type Phase = 'ready' | 'playing' | 'gameover';

let notifId = 0;

export default function NotificationHellGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [stack, setStack] = useState<Notification[]>([]);
  const [combo, setCombo] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const spawnRef = useRef<ReturnType<typeof setInterval>>();
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startRef = useRef(0);
  const stackRef = useRef<Notification[]>([]);
  const phaseRef = useRef<Phase>('ready');

  const MAX_STACK = 10;

  const getDifficulty = useCallback(() => {
    if (timeElapsed >= 40) return 3;
    if (timeElapsed >= 20) return 2;
    return 1;
  }, [timeElapsed]);

  const spawnNotif = useCallback(() => {
    if (isOffline) return;
    const template = NOTIFICATIONS[Math.floor(Math.random() * NOTIFICATIONS.length)];
    const notif: Notification = { ...template, id: ++notifId };
    stackRef.current = [notif, ...stackRef.current];

    if (stackRef.current.length > MAX_STACK) {
      phaseRef.current = 'gameover';
      setPhase('gameover');
      setUnreadCount(stackRef.current.length);
      return;
    }

    setStack([...stackRef.current]);
  }, [isOffline]);

  const start = () => {
    notifId = 0;
    setScore(0);
    setCombo(0);
    setTimeElapsed(0);
    setStack([]);
    stackRef.current = [];
    setIsOffline(false);
    phaseRef.current = 'playing';
    startRef.current = Date.now();
    setPhase('playing');
  };

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      const e = (Date.now() - startRef.current) / 1000;
      setTimeElapsed(e);

      // Random offline event (diff 3)
      if (e >= 40 && !isOffline && Math.random() < 0.002) {
        setIsOffline(true);
        setTimeout(() => setIsOffline(false), 3000);
      }
    }, 100);
    return () => clearInterval(timerRef.current);
  }, [phase, isOffline]);

  // Spawn notifications
  useEffect(() => {
    if (phase !== 'playing') return;
    const diff = getDifficulty();
    const interval = [1000, 600, 350][diff - 1];

    spawnRef.current = setInterval(spawnNotif, interval);
    return () => clearInterval(spawnRef.current);
  }, [phase, getDifficulty, spawnNotif]);

  const handleSwipe = (notif: Notification, direction: 'left' | 'right' | 'up') => {
    if (phase !== 'playing') return;

    const actionMap: Record<string, Notification['action']> = {
      'right': 'reply', 'left': 'ignore', 'up': 'urgent',
    };
    const playerAction = actionMap[direction];
    const correct = playerAction === notif.action;

    // Remove from stack
    stackRef.current = stackRef.current.filter((n) => n.id !== notif.id);
    setStack([...stackRef.current]);

    if (correct) {
      const comboBonus = combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1;
      setScore((s) => s + Math.floor(50 * comboBonus));
      setCombo((c) => c + 1);
    } else {
      setCombo(0);
      // Wrong swipe adds 2 more notifications as penalty
      setTimeout(() => { spawnNotif(); spawnNotif(); }, 200);
    }
  };

  const handleDragEnd = (notif: Notification, _: never, info: PanInfo) => {
    const { offset } = info;
    const threshold = 60;

    if (offset.y < -threshold) {
      handleSwipe(notif, 'up');
    } else if (offset.x > threshold) {
      handleSwipe(notif, 'right');
    } else if (offset.x < -threshold) {
      handleSwipe(notif, 'left');
    }
  };

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-pink tracking-[0.3em] mb-1">NOTIFICATION HELL</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">通知地獄</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🔔"
              title="NOTIFICATION HELL"
              gameId="notification-hell"
              subtitle="通知地獄"
              controls={[
                { icon: '→', label: '右スワイプ', desc: '返信必要' },
                { icon: '←', label: '左スワイプ', desc: '無視OK' },
                { icon: '↑', label: '上スワイプ', desc: '緊急対応' },
              ]}
              rules={[
                { text: '通知をスワイプで正しく分類しろ' },
                { text: `${MAX_STACK}件溜まったら精神崩壊`, highlight: true },
                { text: '間違えると通知が2件追加される', highlight: true },
              ]}
              tip="Lv3〜 圏外になる。その間も通知は増え続ける"
              buttonText="CHECK PHONE"
              buttonColor="bg-neon-pink text-white"
              onStart={start}
            />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <GameComments gameId="notification-hell" mode="danmaku" />
            {/* HUD */}
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              {combo >= 3 && <span className="text-neon-cyan animate-pulse">🔥{combo}</span>}
              <span className="font-['Share_Tech_Mono'] text-text-muted">{Math.floor(timeElapsed)}s</span>
            </div>

            {/* Stack capacity */}
            <div className="h-2 bg-bg-raised rounded-full overflow-hidden mb-2">
              <div
                className={`h-full transition-all ${stack.length >= 7 ? 'bg-neon-pink' : 'bg-neon-cyan'}`}
                style={{ width: `${(stack.length / MAX_STACK) * 100}%` }}
              />
            </div>
            <p className="text-text-muted text-[10px] text-right mb-3">{stack.length}/{MAX_STACK}</p>

            {/* Swipe guide */}
            <div className="flex justify-between text-[8px] text-text-muted mb-2 px-2">
              <span>← 無視</span>
              <span>↑ 緊急</span>
              <span>返信 →</span>
            </div>

            {/* Offline overlay */}
            {isOffline && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-bg-deep/90"
              >
                <div className="text-center">
                  <p className="text-4xl mb-2">📵</p>
                  <p className="font-['Orbitron'] text-neon-pink animate-pulse">圏外</p>
                </div>
              </motion.div>
            )}

            {/* Notification stack */}
            <div className="space-y-2 min-h-[300px] relative">
              <AnimatePresence>
                {stack.map((notif, i) => (
                  <motion.div
                    key={notif.id}
                    layout
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                    drag
                    dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                    dragElastic={0.5}
                    onDragEnd={(_, info) => handleDragEnd(notif, _ as never, info)}
                    whileDrag={{ scale: 1.05, zIndex: 50 }}
                    className={`bg-bg-surface border border-bg-raised rounded-xl px-4 py-3 flex items-center gap-3 cursor-grab active:cursor-grabbing ${
                      getDifficulty() >= 3 && i > 5 ? 'blur-[1px]' : ''
                    }`}
                  >
                    <span className="text-xl flex-shrink-0">{notif.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-muted text-[10px]">{notif.app}</p>
                      <p className="text-text-primary text-sm truncate">{notif.message}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {stack.length === 0 && (
                <p className="text-center text-text-muted text-xs py-8">通知なし...今のうちに休め...</p>
              )}
            </div>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="notification-hell"
              gameName="NOTIFICATION HELL"
              icon="🔔"
              score={score}
              level={getDifficulty()}
              deathReason="MENTAL BREAKDOWN — 通知が溜まりすぎた"
              extraInfo={`未読: ${unreadCount}件 | ${Math.floor(timeElapsed)}秒 生存`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
