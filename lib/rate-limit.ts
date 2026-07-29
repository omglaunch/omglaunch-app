import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      analytics: true,
      prefix: 'omglaunch:api',
    });
  }
  return ratelimit;
}

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

/**
 * Rate-limit API execution routes by user ID.
 * Falls open when Upstash is not configured (local dev).
 */
export async function checkUserRateLimit(userId: string): Promise<RateLimitResult> {
  const limiter = getRatelimit();
  if (!limiter) {
    return { success: true, limit: 10, remaining: 10, reset: Date.now() + 60_000 };
  }

  const result = await limiter.limit(userId);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
