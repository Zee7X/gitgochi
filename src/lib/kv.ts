// Tiny key-value layer over the Upstash REST API, with an in-memory fallback for local development.
// Every value is a string. Errors never quote the KV URL or token.

const KV_TIMEOUT_MS = 5000;

/** A KV call failed. The message never contains the KV URL or token. */
export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreError';
  }
}

interface KvConfig {
  url: string;
  token: string;
}

/** Upstash's own names win over the KV_* names the Vercel integration injects. Null means in-memory. */
export function kvConfig(): KvConfig | null {
  const env = process.env;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN };
  }
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return { url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN };
  }
  return null;
}

// Kept on globalThis so Next dev HMR and every route module share it. A restart empties it.
const g = globalThis as unknown as { __gitgotchiKv?: Map<string, { value: string; expiresAt: number | null }> };
const memory = (g.__gitgotchiKv ??= new Map());

/** Test hook: empties the in-memory fallback. */
export function resetMemoryKv(): void {
  memory.clear();
}

/** Runs one Upstash REST command such as ['GET', key] and returns its `result`. */
async function kv({ url, token }: KvConfig, command: (string | number)[]): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command.map(String)),
      signal: AbortSignal.timeout(KV_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (e) {
    // Fetch errors can quote the URL, so only the kind of failure is kept.
    throw new StoreError((e as Error)?.name === 'TimeoutError' ? 'store timed out' : 'store unreachable');
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok || typeof body !== 'object' || body === null || 'error' in body) {
    throw new StoreError(`store responded ${res.status}`);
  }
  return (body as { result?: unknown }).result;
}

export async function kvGet(key: string): Promise<string | null> {
  const cfg = kvConfig();
  if (cfg) {
    const v = await kv(cfg, ['GET', key]);
    return typeof v === 'string' ? v : null;
  }
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt !== null && hit.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

/** `ttlSeconds` sets an expiry; without it the key lives until deleted. */
export async function kvSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const cfg = kvConfig();
  if (cfg) {
    await kv(cfg, ttlSeconds ? ['SET', key, value, 'EX', Math.ceil(ttlSeconds)] : ['SET', key, value]);
    return;
  }
  memory.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
}

export async function kvDel(...keys: string[]): Promise<void> {
  if (!keys.length) return;
  const cfg = kvConfig();
  if (cfg) {
    await kv(cfg, ['DEL', ...keys]);
    return;
  }
  for (const k of keys) memory.delete(k);
}
