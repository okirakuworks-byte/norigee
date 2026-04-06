import { motion } from 'framer-motion';
import type { FeedPost } from '../lib/types';

interface HeroCardProps {
  post: FeedPost;
}

export default function HeroCard({ post }: HeroCardProps) {
  const isClear = post.result === 'success';
  const glowColor = isClear
    ? 'rgba(0, 245, 212, 0.3)'
    : 'rgba(255, 45, 120, 0.3)';

  const totalResonance = post.resonance_count;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="relative rounded-2xl overflow-hidden"
      style={{ boxShadow: `0 0 60px ${glowColor}, inset 0 0 60px rgba(0,0,0,0.3)` }}
    >
      <div className="bg-bg-surface border border-bg-raised rounded-2xl p-6 md:p-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {post.profiles.avatar_url ? (
              <img
                src={post.profiles.avatar_url}
                alt={`${post.profiles.display_name}のアバター`}
                className="w-10 h-10 rounded-full border-2 border-neon-cyan/40"
                loading="lazy"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-bg-raised flex items-center justify-center text-xl border-2 border-neon-cyan/40">
                {post.profiles.avatar_emoji ?? '?'}
              </div>
            )}
            <div>
              <span className="text-text-primary text-sm font-bold">
                {post.profiles.display_name}
              </span>
              {post.challenge_title && (
                <p className="text-text-muted text-xs">
                  {post.challenge_type === 'daily' ? '⚡' : '🎮'} {post.challenge_title}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-['Orbitron'] text-sm text-neon-cyan">
              DAY {post.day_number}
            </span>
            <motion.span
              initial={{ scale: 2, opacity: 0, rotate: isClear ? 0 : -10 }}
              animate={{ scale: 1, opacity: 1, rotate: isClear ? 0 : -3 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
              className={`px-4 py-1.5 border-2 font-['Orbitron'] text-sm font-bold tracking-widest ${
                isClear
                  ? 'border-neon-cyan text-neon-cyan'
                  : 'border-neon-pink text-neon-pink'
              }`}
              style={{
                textShadow: isClear
                  ? '0 0 15px rgba(0,245,212,0.8)'
                  : '0 0 15px rgba(255,45,120,0.8)',
                boxShadow: isClear
                  ? '0 0 20px rgba(0,245,212,0.3), inset 0 0 15px rgba(0,245,212,0.05)'
                  : '0 0 20px rgba(255,45,120,0.3), inset 0 0 15px rgba(255,45,120,0.05)',
              }}
            >
              {isClear ? 'CLEAR' : 'FAILED'}
            </motion.span>
          </div>
        </div>

        {/* Content */}
        <p className="text-text-primary text-lg md:text-xl leading-relaxed whitespace-pre-wrap mb-6">
          {post.content}
        </p>

        {/* Resonance stats */}
        <div className="flex items-center gap-4 text-sm">
          <span className="font-['Share_Tech_Mono'] text-neon-yellow">
            {totalResonance.toLocaleString()} resonance
          </span>
          <span className="text-text-muted">
            💬 {post.comment_count.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Crown badge */}
      <div className="absolute -top-1 -right-1">
        <motion.div
          initial={{ rotate: -20, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', delay: 0.5 }}
          className="bg-neon-yellow text-bg-deep font-['Orbitron'] text-[10px] font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl"
        >
          HOT
        </motion.div>
      </div>
    </motion.div>
  );
}
