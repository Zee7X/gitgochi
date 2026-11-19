// Best-effort, per-instance request limiter. It keeps one visitor from burning the free Upstash and GitHub
// quotas for everyone; Vercel runs several instances, so the real ceiling is a small multiple of these numbers.

const g = globalThis as unknown as { __ggRate?: Map<string, { n: number; reset: number }> };
const buckets = (g.__ggRate ??= new Map());
const MAX_BUCKETS = 5000;

/** The caller's IP as Vercel reports it (first X-Forwarded-For hop), or "unknown". */
export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

/** True when `key` may make another request in this window. */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || now >= b.reset) {
    if (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value as string);
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  b.n++;
  return b.n <= limit;
}

/** Test hook. */
export function resetRateLimits(): void {
  buckets.clear();
}

export const LIMITS = {
  /** Pet reads, actions and settings: a page polls every 15 s or slower, so this only stops floods. */
  pet: { limit: 120, windowMs: 60_000 },
  /** Summon Kiro reads up to three GitHub endpoints and a log per call. */
  heal: { limit: 10, windowMs: 60_000 },
  /** Starting sign in. */
  auth: { limit: 20, windowMs: 60_000 },
} as const;

export function tooMany(retryAfterS: number): Response {
  return Response.json(
    { error: 'too many requests, slow down' },
    { status: 429, headers: { 'Retry-After': String(retryAfterS), 'Cache-Control': 'no-store' } }
  );
}

/** Null when allowed, else a 429 response. */
export function limit(req: Request, kind: keyof typeof LIMITS): Response | null {
  const { limit: n, windowMs } = LIMITS[kind];
  return allow(`${kind}:${clientIp(req)}`, n, windowMs) ? null : tooMany(Math.ceil(windowMs / 1000));
}
