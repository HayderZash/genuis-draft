import type { Session } from '@supabase/supabase-js';

const AUTH_TOKEN_FRAGMENT = 'auth-token';

const getProjectRef = () => {
  const configuredProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (configuredProjectId) return configuredProjectId;

  const url = import.meta.env.VITE_SUPABASE_URL;
  try {
    return url ? new URL(url).hostname.split('.')[0] : null;
  } catch {
    return null;
  }
};

const getProjectStorageKey = () => {
  const projectRef = getProjectRef();
  return projectRef ? `sb-${projectRef}-${AUTH_TOKEN_FRAGMENT}` : null;
};

type PersistedSessionPayload = {
  currentSession?: Session | null;
};

const isSessionLike = (value: unknown): value is Session => {
  if (!value || typeof value !== 'object') return false;

  const maybeSession = value as Partial<Session>;
  return typeof maybeSession.access_token === 'string' && !!maybeSession.user;
};

export const readStoredSession = (): Session | null => {
  if (typeof window === 'undefined') return null;

  try {
    const projectStorageKey = getProjectStorageKey();
    const candidateKeys = projectStorageKey
      ? [projectStorageKey]
      : Object.keys(window.localStorage).filter((key) => key.includes(AUTH_TOKEN_FRAGMENT));

    for (const key of candidateKeys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as PersistedSessionPayload | Session;
      const candidate = 'currentSession' in parsed ? parsed.currentSession : parsed;

      if (isSessionLike(candidate)) {
        return candidate;
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
    const projectStorageKey = getProjectStorageKey();

    if (projectStorageKey) {
      window.localStorage.removeItem(projectStorageKey);
      return;
    }

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