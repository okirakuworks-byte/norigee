import { motion } from 'framer-motion';
import type { FeedPost } from '../lib/types';

interface LiveTickerProps {
  posts: FeedPost[];
}

function formatEntry(post: FeedPost): string {
  const emoji = post.result === 'success' ? '✨' : '💀';
  const dayLabel = post.day_number > 1 ? ` DAY${post.day_number}` : '';
  const result = post.result === 'success' ? 'クリア' : '失敗';
  return `${emoji} ${post.profiles.display_name}${dayLabel} ${result}`;
}

export default function LiveTicker({ posts }: LiveTickerProps) {
  if (posts.length === 0) return null;

  const entries = posts.slice(0, 10).map(formatEntry);
  const tickerText = entries.join('   ///   ');
  const doubled = `${tickerText}   ///   ${tickerText}`;

  return (
    <div className="w-full overflow-hidden bg-neon-yellow/5 border-y border-neon-yellow/20 py-1.5 relative">
      {/* LIVE badge */}
      <div className="absolute left-0 top-0 bottom-0 flex items-center px-2.5 bg-neon-yellow z-10">
        <span className="font-['Orbitron'] text-[9px] text-bg-deep font-bold tracking-wider">
          LIVE
        </span>
      </div>

      {/* Scrolling text */}
      <div className="pl-14">
        <motion.div
          className="whitespace-nowrap font-['Share_Tech_Mono'] text-xs text-neon-yellow/70"
          animate={{ x: ['0%', '-50%'] }}
          transition={{
            x: {
              duration: Math.max(20, entries.length * 4),
              repeat: Infinity,
              ease: 'linear',
            },
          }}
        >
          {doubled}
        </motion.div>
      </div>

      {/* Right fade gradient */}
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-bg-deep to-transparent pointer-events-none" />
    </div>
  );
}
