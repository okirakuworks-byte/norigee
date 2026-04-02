import { useState, useEffect } from 'react';
import PostForm from './PostForm';
import { createSupabaseBrowser } from '../lib/supabase';

// Wrapper that handles client-side auth guard and URL param extraction
export default function PostFormWrapper() {
  const [ready, setReady] = useState(false);
  const [dailyId, setDailyId] = useState<number | undefined>();
  const [challengeTitle, setChallengeTitle] = useState<string | undefined>();

  useEffect(() => {
    async function init() {
      // Auth guard: redirect to login if not authenticated
      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.replace('/auth/login');
        return;
      }

      // Read URL params on the client side
      const params = new URLSearchParams(window.location.search);
      const daily = params.get('daily');
      if (daily) {
        setDailyId(Number(daily));
        setChallengeTitle('デイリーノリゲー');
      }

      setReady(true);
    }

    init();
  }, []);

  if (!ready) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="font-['Share_Tech_Mono'] text-text-muted text-sm animate-pulse">LOADING...</p>
      </div>
    );
  }

  return (
    <PostForm
      challengeTitle={challengeTitle}
      dailyId={dailyId}
    />
  );
}
