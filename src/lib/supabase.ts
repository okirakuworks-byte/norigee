import { createClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables: PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY must be set'
  );
}

/** Simple anon client for non-auth data queries (used by api.ts) */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Browser-side client (used in <script> tags) */
export function createSupabaseBrowser() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: 'pkce' },
  });
}

/** Server-side client (used in .astro frontmatter) — reads/writes cookies via Astro */
export function createSupabaseServer(Astro: { cookies: AstroCookies; request: Request }) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: 'pkce' },
    cookies: {
      getAll() {
        return parseCookieHeader(Astro.request.headers.get('cookie') ?? '');
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            Astro.cookies.set(name, value, { path: '/', ...options });
          }
        } catch {
          // Ignore ResponseSentError — token refresh after response is already streaming
        }
      },
    },
  });
}

/**
 * Server-side client from raw request (used in middleware or API routes).
 * Collects Set-Cookie headers to be sent in the response.
 */
export function createSupabaseServerFromRequest(request: Request) {
  const responseCookies: string[] = [];
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: 'pkce' },
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('cookie') ?? '');
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          responseCookies.push(serializeCookieHeader(name, value, options));
        }
      },
    },
  });
  return { client, responseCookies };
}
