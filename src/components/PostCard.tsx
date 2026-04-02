import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toggleResonance, fetchResonancesForPost, addComment, fetchComments, type Comment } from '../lib/api';
import { earnResonanceReward, earnCommentReward } from '../lib/wallet';
import { supabase } from '../lib/supabase';
import type { FeedPost, ResonanceType } from '../lib/types';

interface Props {
  post: FeedPost;
  index: number;
}

export default function PostCard({ post, index }: Props) {
  const isFailed = post.result === 'failure';
  const initialRotate = useRef((Math.random() - 0.5) * 4);

  const [resonances, setResonances] = useState({
    wakaru: post.resonance_count > 0 ? post.resonance_count : 0,
    donmai: 0,
    oremoda: 0,
  });
  const [myResonance, setMyResonance] = useState<ResonanceType | null>(null);
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

  // Load initial resonance counts
  useEffect(() => {
    fetchResonancesForPost(post.id).then(({ counts }) => {
      setResonances(counts);
    });
  }, [post.id]);

  // Realtime subscription for resonance changes
  useEffect(() => {
    const channel = supabase
      .channel(`resonances-${post.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resonances', filter: `post_id=eq.${post.id}` },
        () => {
          // Re-fetch counts on any change
          fetchResonancesForPost(post.id).then(({ counts }) => {
            setResonances(counts);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [post.id]);

  const [coinPopup, setCoinPopup] = useState<string | null>(null);

  const handleResonance = useCallback(async (type: ResonanceType) => {
    const result = await toggleResonance(post.id, type);
    if ('error' in result && result.error) return;

    if (result.action === 'added') {
      if (myResonance && myResonance !== type) {
        setResonances(prev => ({ ...prev, [myResonance]: Math.max(0, prev[myResonance] - 1) }));
      }
      setResonances(prev => ({ ...prev, [type]: prev[type] + 1 }));
      setMyResonance(type);
      // Earn coins
      const reward = await earnResonanceReward();
      if (reward.earned) setCoinPopup(`+¥${reward.amount}`);
    } else {
      setResonances(prev => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
      setMyResonance(null);
    }
  }, [post.id, myResonance]);

  return (
    <motion.div
      initial={{ opacity: 0, rotate: initialRotate.current, scale: 0.95 }}
      animate={{ opacity: 1, rotate: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="relative bg-bg-surface border border-bg-raised rounded-xl overflow-hidden hover:border-bg-raised/80 transition-colors"
    >
      {/* Challenge badge */}
      <div className="px-4 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {post.challenge_type === 'daily' ? (
            <span className="text-neon-yellow text-xs">⚡</span>
          ) : (
            <span className="text-neon-cyan text-xs">🎮</span>
          )}
          <span className="text-text-muted text-xs truncate max-w-[180px]">
            {post.challenge_title}
          </span>
        </div>
        <span className="font-['Orbitron'] text-xs text-neon-cyan">
          DAY {post.day_number}
        </span>
      </div>

      {/* User info */}
      <div className="px-4 pt-2 flex items-center gap-2">
        {post.profiles.avatar_url ? (
          <img
            src={post.profiles.avatar_url}
            alt={`${post.profiles.display_name}のアバター`}
            className="w-6 h-6 rounded-full"
            loading="lazy"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-bg-raised flex items-center justify-center text-xs text-text-muted">
            ?
          </div>
        )}
        <span className="text-text-secondary text-sm">{post.profiles.display_name}</span>
      </div>

      {/* Content */}
      <div className="px-4 py-3 relative">
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
          className="ml-auto text-text-muted text-xs hover:text-text-primary transition-colors"
        >
          💬 {commentCount}
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
                    <div className="w-5 h-5 rounded-full bg-bg-raised mt-0.5" />
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
    <button
      onClick={() => onClick(type)}
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
    </button>
  );
}
