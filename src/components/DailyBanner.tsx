import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fetchDailyTopic } from '../lib/api';
import type { DailyTopic } from '../lib/types';

export default function DailyBanner() {
  const [topic, setTopic] = useState<DailyTopic | null>(null);

  useEffect(() => {
    fetchDailyTopic().then(setTopic);
  }, []);

  if (!topic) return null;

  return (
    <motion.a
      href={`/posts/new?daily=${topic.id}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="block bg-bg-surface border border-neon-yellow/20 rounded-xl p-4 hover:border-neon-yellow/50 hover:shadow-[0_0_15px_rgba(255,230,0,0.08)] transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-neon-yellow/10 flex items-center justify-center">
            <span className="text-neon-yellow text-sm">⚡</span>
          </div>
          <div className="min-w-0">
            <p className="font-['Orbitron'] text-[10px] text-neon-yellow/70 tracking-widest">
              TODAY'S STAGE
            </p>
            <p className="text-text-primary text-sm font-bold truncate">
              {topic.title}
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-neon-pink text-[10px]">
            {'★'.repeat(topic.difficulty)}{'☆'.repeat(5 - topic.difficulty)}
          </span>
          <span className="font-['Orbitron'] text-[10px] text-neon-yellow group-hover:text-neon-yellow/80 transition-colors">
            CHALLENGE →
          </span>
        </div>
      </div>
    </motion.a>
  );
}
