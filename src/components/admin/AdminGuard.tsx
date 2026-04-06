import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createSupabaseBrowser } from '../../lib/supabase';

const supabase = createSupabaseBrowser();

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const [status, setStatus] = useState<'loading' | 'authorized' | 'denied'>('loading');

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.replace('/auth/login');
        return;
      }

      const { data: admin } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      setStatus(admin ? 'authorized' : 'denied');
    }

    checkAdmin();
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-['Orbitron'] text-text-muted text-sm animate-pulse tracking-widest">
          VERIFYING ACCESS...
        </p>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 space-y-4"
      >
        <motion.p
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-4xl"
        >
          ⛔
        </motion.p>
        <p className="font-['Orbitron'] text-neon-pink text-xl font-bold tracking-widest text-glow-pink">
          GAME OVER
        </p>
        <p className="text-text-secondary text-sm">
          このエリアは管理者専用です
        </p>
        <a
          href="/home"
          className="mt-4 px-6 py-2.5 border border-neon-yellow/50 text-neon-yellow font-['Orbitron'] text-xs tracking-widest rounded-lg hover:bg-neon-yellow/10 transition-colors"
        >
          CONTINUE →
        </a>
      </motion.div>
    );
  }

  return <>{children}</>;
}
