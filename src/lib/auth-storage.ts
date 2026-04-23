import type { Session } from '@supabase/supabase-js';

const AUTH_TOKEN_FRAGMENT = 'auth-token';

type PersistedSessionPayload = {
  currentSession?: Session | null;
};

export const readStoredSession = (): Session | null => {
  if (typeof window === 'undefined') return null;

  try {
    for (const key of Object.keys(window.localStorage)) {
      if (!key.includes(AUTH_TOKEN_FRAGMENT)) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as PersistedSessionPayload | Session;
      const candidate = 'currentSession' in parsed ? parsed.currentSession : parsed;

      if (candidate?.access_token && candidate?.user) {
        return candidate as Session;
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const clearStoredAuthTokens = () => {
  if (typeof window === 'undefined') return;

  try {
    Object.keys(window.localStorage)
      .filter((key) => key.includes(AUTH_TOKEN_FRAGMENT))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage access failures
  }
};

export const shouldClearStoredSession = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');

  return /(refresh token|invalid refresh token|token has expired|jwt|session missing|token revoked|already used|user from sub claim|auth session missing)/i.test(
    message,
  );
};