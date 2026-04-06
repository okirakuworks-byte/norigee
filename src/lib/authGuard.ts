import { createSupabaseBrowser } from './supabase';

/**
 * Client-side auth + profile guard.
 * Hides page content until auth is confirmed, preventing flash of protected content.
 * Redirects to /auth/login if not authenticated,
 * or /profile/setup if profile doesn't exist.
 */
export async function requireProfile(): Promise<{ id: string } | null> {
  const supabase = createSupabaseBrowser();

  // Hide main content and show loading until auth confirmed
  const mainEl = document.querySelector('main');
  const loadingEl = document.getElementById('auth-loading');
  if (mainEl) mainEl.style.opacity = '0';
  if (loadingEl) loadingEl.classList.remove('hidden');

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.replace('/auth/login');
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    window.location.replace('/profile/setup');
    return null;
  }

  // Auth confirmed — reveal content
  if (mainEl) mainEl.style.opacity = '1';
  if (loadingEl) loadingEl.classList.add('hidden');

  return user;
}
