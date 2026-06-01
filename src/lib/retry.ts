// Retry helpers used across the app for resilient DB / RPC calls.
// All helpers fail-OPEN where appropriate so the UI is never blocked by transient backend issues.

export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  timeoutMs?: number;
}

/** Race a promise against a timeout. Resolves to `fallback` if the timer wins. */
export const withTimeout = <T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> =>
  new Promise<T>((resolve) => {
    let done = false;
    const t = window.setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
    Promise.resolve(p).then((v) => {
      if (!done) { done = true; window.clearTimeout(t); resolve(v); }
    }).catch(() => {
      if (!done) { done = true; window.clearTimeout(t); resolve(fallback); }
    });
  });

/** Retry an async function with exponential backoff. Last error is rethrown if all retries fail. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseMs ?? 400;
  const max = opts.maxMs ?? 3000;
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      if (opts.timeoutMs) {
        return await withTimeout(fn(), opts.timeoutMs, undefined as any);
      }
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === retries) break;
      const delay = Math.min(max, base * Math.pow(2, i)) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Retry + fallback: never throws; returns `fallback` if all attempts fail. */
export async function safeRetry<T>(
  fn: () => Promise<T>,
  fallback: T,
  opts: RetryOptions = {},
): Promise<T> {
  try {
    return await withRetry(fn, opts);
  } catch {
    return fallback;
  }
}
