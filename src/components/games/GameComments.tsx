import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createSupabaseBrowser } from '../../lib/supabase';

const supabase = createSupabaseBrowser();

interface ScreamPost {
  id: number;
  content: string;
  result: string;
  profiles: { display_name: string; avatar_url: string | null };
}

interface Props {
  gameId: string;
  mode: 'list' | 'danmaku'; // list = intro画面用, danmaku = ゲーム中弾幕
}

function extractScream(content: string): string | null {
  const match = content.match(/「(.+?)」/);
  return match ? match[1] : null;
}

function extractScore(content: string): string | null {
  const match = content.match(/Score:\s*(\d+)/);
  return match ? match[1] : null;
}

// ===== List mode: GameIntro 画面用 =====

function CommentList({ gameId }: { gameId: string }) {
  const [posts, setPosts] = useState<ScreamPost[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('posts')
        .select('id, content, result, profiles!posts_user_id_fkey(display_name, avatar_url)')
        .like('content', `%${gameId.toUpperCase().replace(/-/g, ' ')}%`)
        .order('id', { ascending: false })
        .limit(20);

      // Fallback: also search by game name variations
      if (!data || data.length === 0) {
        const { data: data2 } = await supabase
          .from('posts')
          .select('id, content, result, profiles!posts_user_id_fkey(display_name, avatar_url)')
          .like('content', '%「%」%')
          .order('id', { ascending: false })
          .limit(30);
        if (data2) setPosts(data2 as unknown as ScreamPost[]);
      } else {
        setPosts(data as unknown as ScreamPost[]);
      }
    };
    fetch();
  }, [gameId]);

  if (posts.length === 0) return null;

  return (
    <div className="max-w-xs mx-auto mt-6 max-h-40 overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-bg-deep to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-bg-deep to-transparent z-10 pointer-events-none" />

      <motion.div
        animate={{ y: [0, -(posts.length * 36)] }}
        transition={{ duration: posts.length * 3, repeat: Infinity, ease: 'linear' }}
        className="space-y-1"
      >
        {(posts.length > 2 ? [...posts, ...posts] : posts).map((post, i) => {
          const scream = extractScream(post.content);
          const scoreVal = extractScore(post.content);
          const name = (post.profiles as { display_name: string })?.display_name ?? '?';
          const isFail = post.result === 'failure';

          return (
            <div key={`${post.id}-${i}`} className="flex items-center gap-2 px-2 py-1 text-xs">
              <span className={isFail ? 'text-neon-pink' : 'text-neon-cyan'}>
                {isFail ? '💀' : '🏆'}
              </span>
              <span className="text-text-muted truncate">{name}</span>
              {scoreVal && <span className="font-['Share_Tech_Mono'] text-neon-yellow">{scoreVal}pt</span>}
              {scream && (
                <span className="text-text-secondary truncate max-w-[150px]">「{scream}」</span>
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

// ===== Danmaku mode: ゲーム中弾幕 =====

interface DanmakuMessage {
  id: string;
  text: string;
  y: number;
  speed: number;
  color: string;
}

function DanmakuOverlay({ gameId }: { gameId: string }) {
  const [messages, setMessages] = useState<DanmakuMessage[]>([]);
  const postsRef = useRef<ScreamPost[]>([]);
  const indexRef = useRef(0);

  // Load screams once
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('posts')
        .select('id, content, result, profiles!posts_user_id_fkey(display_name, avatar_url)')
        .like('content', '%「%」%')
        .order('id', { ascending: false })
        .limit(50);

      if (data) postsRef.current = data as unknown as ScreamPost[];
    };
    fetch();
  }, [gameId]);

  // Spawn danmaku messages periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (postsRef.current.length === 0) return;

      const post = postsRef.current[indexRef.current % postsRef.current.length];
      indexRef.current++;

      const scream = extractScream(post.content);
      const name = (post.profiles as { display_name: string })?.display_name ?? '?';
      const isFail = post.result === 'failure';

      const text = scream
        ? `${name}: ${scream}`
        : `${name} ${isFail ? '💀' : '🏆'} ${extractScore(post.content) ?? ''}pt`;

      const msg: DanmakuMessage = {
        id: `${post.id}-${Date.now()}-${Math.random()}`,
        text,
        y: 10 + Math.random() * 80, // % from top
        speed: 8 + Math.random() * 6, // seconds to cross
        color: isFail ? 'text-neon-pink/60' : 'text-neon-cyan/60',
      };

      setMessages((prev) => [...prev.slice(-15), msg]); // keep max 15
    }, 2500);

    return () => clearInterval(interval);
  }, [gameId]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      <AnimatePresence>
        {messages.map((msg) => (
          <motion.p
            key={msg.id}
            initial={{ x: '105%' }}
            animate={{ x: '-100%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: msg.speed, ease: 'linear' }}
            onAnimationComplete={() => {
              setMessages((prev) => prev.filter((m) => m.id !== msg.id));
            }}
            className={`absolute whitespace-nowrap font-['Share_Tech_Mono'] text-[11px] ${msg.color}`}
            style={{ top: `${msg.y}%` }}
          >
            {msg.text}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ===== Export =====

export default function GameComments({ gameId, mode }: Props) {
  if (mode === 'list') return <CommentList gameId={gameId} />;
  return <DanmakuOverlay gameId={gameId} />;
}
