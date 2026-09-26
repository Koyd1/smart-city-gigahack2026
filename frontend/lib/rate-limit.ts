import { createClient, type RedisClientType } from "redis";

type LimitOptions = {
  key: string;
  capacity: number;
  refillPerSecond: number;
  cost?: number;
};

type LimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local values = redis.call('HMGET', key, 'tokens', 'updated')
local tokens = tonumber(values[1]) or capacity
local updated = tonumber(values[2]) or now
tokens = math.min(capacity, tokens + math.max(0, now - updated) * refill)
local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end
redis.call('HSET', key, 'tokens', tokens, 'updated', now)
redis.call('EXPIRE', key, math.max(60, math.ceil(capacity / refill) * 2))
local retry = 0
if allowed == 0 then retry = math.ceil((cost - tokens) / refill) end
return {allowed, math.floor(tokens), retry}
`;

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

function redisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const password = process.env.REDIS_PASSWORD;
  if (!password) throw new Error("REDIS_URL or REDIS_PASSWORD is required");
  return `redis://:${encodeURIComponent(password)}@127.0.0.1:6379/0`;
}

async function getClient(): Promise<RedisClientType> {
  if (client?.isReady) return client;
  if (!connecting) {
    const next = createClient({ url: redisUrl() });
    next.on("error", (error) => console.error("redis.client_error", error));
    connecting = next.connect().then(() => {
      client = next as RedisClientType;
      connecting = null;
      return client;
    });
  }
  return connecting;
}

export function requestIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function consumeRateLimit(options: LimitOptions): Promise<LimitResult> {
  try {
    const redis = await getClient();
    const result = (await redis.eval(TOKEN_BUCKET_SCRIPT, {
      keys: [`civis:limit:${options.key}`],
      arguments: [
        String(options.capacity),
        String(options.refillPerSecond),
        String(Date.now() / 1000),
        String(options.cost ?? 1)
      ]
    })) as number[];
    return {
      allowed: result[0] === 1,
      remaining: result[1] ?? 0,
      retryAfterSeconds: Math.max(1, result[2] ?? 1)
    };
  } catch (error) {
    console.error("rate_limit.unavailable", error);
    return { allowed: true, remaining: 0, retryAfterSeconds: 1 };
  }
}

export async function acquireConcurrencyLease(
  key: string,
  maxConcurrent: number,
  ttlSeconds = 180
): Promise<{ acquired: boolean; release: () => Promise<void> }> {
  const leaseId = crypto.randomUUID();
  const redisKey = `civis:concurrency:${key}`;
  try {
    const redis = await getClient();
    const now = Date.now();
    await redis.zRemRangeByScore(redisKey, 0, now);
    const count = await redis.zCard(redisKey);
    if (count >= maxConcurrent) {
      return { acquired: false, release: async () => undefined };
    }
    await redis.zAdd(redisKey, [{ score: now + ttlSeconds * 1000, value: leaseId }]);
    await redis.expire(redisKey, ttlSeconds + 10);
    return {
      acquired: true,
      release: async () => {
        await redis.zRem(redisKey, leaseId).catch(() => undefined);
      }
    };
  } catch (error) {
    console.error("concurrency_limit.unavailable", error);
    return { acquired: true, release: async () => undefined };
  }
}
