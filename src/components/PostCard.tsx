import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toggleResonance, fetchResonancesForPost, addComment, fetchComments, type Comment } from '../lib/api';
import { earnResonanceReward, earnCommentReward } from '../lib/wallet';
import type { FeedPost, ResonanceType } from '../lib/types';

interface ResonanceCounts {
  wakaru: number;
  donmai: number;
  oremoda: number;
}

interface Props {
  post: FeedPost;
  index: number;
  featured?: boolean;
  /** Pre-fetched resonance counts from bulk query (avoids N+1) */
  initialResonances?: ResonanceCounts;
  /** Pre-fetched current user's resonance type */
  initialMyResonance?: ResonanceType | null;
}

export default function PostCard({ post, index, featured = false, initialResonances, initialMyResonance }: Props) {
  const isFailed = post.result === 'failure';
  const initialRotate = useRef((Math.random() - 0.5) * 4);

  const [resonances, setResonances] = useState<ResonanceCounts>(
    initialResonances ?? {
      wakaru: post.resonance_count > 0 ? post.resonance_count : 0,
      donmai: 0,
      oremoda: 0,
    }
  );
  const [myResonance, setMyResonance] = useState<ResonanceType | null>(initialMyResonance ?? null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentCount, setCommentCount] = useState(post.comment_count);

  // Load comments when expanded
  useEffect(() => {
    if (!showComments) return;
    setLoadingComments(true);
    fetchComments(post.id).then((c) => {
      setComments(c);
      setLoadingComments(false);
    });
  }, [showComments, post.id]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const result = await addComment(post.id, newComment.trim());
    if (!result.error) {
      setNewComment('');
      setCommentCount((c) => c + 1);
      const updated = await fetchComments(post.id);
      setComments(updated);
      // Earn coins for commenting (min 10 chars)
      if (newComment.trim().length >= 10) {
        const reward = await earnCommentReward();
        if (reward.earned) setCoinPopup(`+¥${reward.amount}`);
      }
    }
  };

  // Load initial resonance counts (skip if pre-fetched via initialResonances)
  useEffect(() => {
    if (initialResonances) return;
    fetchResonancesForPost(post.id).then(({ counts }) => {
      setResonances(counts);
    });
  }, [post.id, initialResonances]);

  // Note: Realtime resonance updates are handled via optimistic local state
  // in handleResonance(). Per-PostCard Realtime channels were removed to prevent
  // channel explosion (20 posts = 20 WebSocket channels).

  const [coinPopup, setCoinPopup] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleResonance = useCallback(async (type: ResonanceType) => {
    const result = await toggleResonance(post.id, type);
    if ('error' in result && result.error) return;

    if (result.action === 'added') {
      setResonances(prev => ({ ...prev, [type]: prev[type] + 1 }));
      setMyResonance(type);
      const reward = await earnResonanceReward();
      if (reward.earned) setCoinPopup(`+¥${reward.amount}`);
    } else if (result.action === 'switched' && 'previousType' in result) {
      // DB already deleted old + inserted new
      setResonances(prev => ({
        ...prev,
        [result.previousType]: Math.max(0, prev[result.previousType] - 1),
        [type]: prev[type] + 1,
      }));
      setMyResonance(type);
    } else {
      // removed
      setResonances(prev => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
      setMyResonance(null);
    }
  }, [post.id]);

  return (
    <motion.div
      initial={{ opacity: 0, rotate: initialRotate.current, scale: 0.95 }}
      animate={{ opacity: 1, rotate: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`relative bg-bg-surface border rounded-xl overflow-hidden transition-colors ${
        featured
          ? 'border-neon-yellow/30 hover:border-neon-yellow/50 shadow-[0_0_20px_rgba(255,230,0,0.08)]'
          : 'border-bg-raised hover:border-neon-cyan/20 hover:shadow-[0_0_12px_rgba(0,245,212,0.06)]'
      }`}
    >
      {/* User info + meta */}
      <div className="px-4 pt-3 flex items-center gap-2">
        {post.profiles.avatar_url ? (
          <img
            src={post.profiles.avatar_url}
            alt={`${post.profiles.display_name}のアバター`}
            className="w-7 h-7 rounded-full border border-bg-raised/80"
            loading="lazy"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-bg-raised flex items-center justify-center text-sm border border-bg-raised/80">
            {post.profiles.avatar_emoji ?? '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-text-primary text-sm font-bold">{post.profiles.display_name}</span>
          <div className="flex items-center gap-1.5">
            {post.challenge_type === 'daily' ? (
              <span className="text-neon-yellow text-[10px]">⚡</span>
            ) : (
              <span className="text-neon-cyan text-[10px]">🎮</span>
            )}
            <span className="text-text-muted text-[10px] truncate">
              {post.challenge_title}
            </span>
          </div>
        </div>
        <span className="font-['Orbitron'] text-xs text-neon-cyan flex items-center gap-1 shrink-0">
          DAY {post.day_number}
          {post.day_number >= 100 && (
            <span className="text-[10px] text-neon-yellow border border-neon-yellow/50 px-1 rounded">
              LEGEND
            </span>
          )}
        </span>
      </div>

      {/* Content */}
      <div className="px-4 py-3 relative pr-20">
        <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>

        {isFailed ? (
          <motion.div
            initial={{ scale: 3, opacity: 0, rotate: -15 }}
            animate={{ scale: 1, opacity: 0.85, rotate: -3 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
            className="absolute top-2 right-2 px-3 py-1 border-2 border-neon-pink text-neon-pink font-['Orbitron'] text-xs font-bold tracking-widest"
            style={{ textShadow: '0 0 10px rgba(255,45,120,0.5)' }}
          >
            FAILED
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.85 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            className="absolute top-2 right-2 px-3 py-1 border-2 border-neon-cyan text-neon-cyan font-['Orbitron'] text-xs font-bold tracking-widest"
            style={{ textShadow: '0 0 10px rgba(0,245,212,0.5)' }}
          >
            CLEAR
          </motion.div>
        )}
      </div>

      {/* Images */}
      {post.image_keys.length > 0 && (
        <div className={`px-4 pb-2 ${post.image_keys.length > 1 ? 'grid grid-cols-2 gap-1.5' : ''}`}>
          {post.image_keys.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => setLightboxUrl(url)}
              className="block w-full overflow-hidden rounded-lg border border-bg-raised hover:border-neon-cyan/30 transition-colors"
            >
              <img
                src={url}
                alt="投稿画像"
                className="w-full h-32 object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/90 backdrop-blur-sm p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightboxUrl}
              alt="拡大画像"
              className="max-w-full max-h-[85vh] rounded-xl border border-bg-raised"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary text-2xl"
              aria-label="閉じる"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resonance buttons */}
      <div className="px-4 pb-3 flex items-center gap-3">
        <ResonanceButton
          emoji="🤝" label="わかる" type="wakaru"
          count={resonances.wakaru} active={myResonance === 'wakaru'}
          onClick={handleResonance}
        />
        <ResonanceButton
          emoji="💪" label="ドンマイ" type="donmai"
          count={resonances.donmai} active={myResonance === 'donmai'}
          onClick={handleResonance}
        />
        <ResonanceButton
          emoji="🔥" label="俺もだ" type="oremoda"
          count={resonances.oremoda} active={myResonance === 'oremoda'}
          onClick={handleResonance}
        />
        <button
          onClick={() => setShowComments(!showComments)}
          className="ml-auto flex items-center gap-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-raised px-2 py-1 rounded transition-colors"
          aria-expanded={showComments}
          aria-label={`コメント${commentCount}件`}
        >
          💬 <span>{commentCount}</span>
          <span className="text-[10px]">{showComments ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Coin popup */}
      <AnimatePresence>
        {coinPopup && (
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -30 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            onAnimationComplete={() => setCoinPopup(null)}
            className="absolute top-2 left-1/2 -translate-x-1/2 font-['Share_Tech_Mono'] text-neon-yellow text-sm font-bold pointer-events-none z-10"
          >
            {coinPopup}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-bg-raised"
          >
            <div className="px-4 py-3 space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2 items-start">
                  {c.profiles.avatar_url ? (
                    <img src={c.profiles.avatar_url} alt="" className="w-5 h-5 rounded-full mt-0.5" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-bg-raised mt-0.5 flex items-center justify-center text-[10px]">
                      {c.profiles.avatar_emoji ?? '?'}
                    </div>
                  )}
                  <div>
                    <span className="text-text-secondary text-[10px]">{c.profiles.display_name}</span>
                    <p className="text-text-primary text-xs">{c.content}</p>
                  </div>
                </div>
              ))}
              {loadingComments && <p className="text-text-muted text-[10px] animate-pulse">LOADING...</p>}

              <form onSubmit={submitComment} className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="コメント..."
                  maxLength={200}
                  className="flex-1 px-3 py-1.5 bg-bg-deep border border-bg-raised rounded text-text-primary text-xs placeholder:text-text-muted focus:border-neon-cyan focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-3 py-1.5 bg-neon-cyan text-bg-deep text-xs font-bold rounded disabled:opacity-30"
                >
                  送信
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ResonanceButton({
  emoji, label, type, count, active, onClick,
}: {
  emoji: string;
  label: string;
  type: ResonanceType;
  count: number;
  active: boolean;
  onClick: (type: ResonanceType) => void;
}) {
  return (
    <motion.button
      onClick={() => onClick(type)}
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.05 }}
      animate={active ? { scale: [1, 1.2, 1] } : {}}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
        active
          ? 'bg-neon-yellow/20 text-neon-yellow'
          : 'text-text-secondary hover:bg-bg-raised hover:text-text-primary'
      }`}
      title={label}
    >
      <span>{emoji}</span>
      <span>{label}</span>
      {count > 0 && <span className="text-text-muted">{count}</span>}
    </motion.button>
  );
}
