import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple in-memory rate limiter dengan sliding window
 * For production, use Upstash Redis
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60 * 1000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create request timestamps for this key
    let timestamps = this.requests.get(key) || [];

    // Remove old timestamps outside the window
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    // Check if we've exceeded the limit
    if (timestamps.length >= this.maxRequests) {
      this.requests.set(key, timestamps);
      return false;
    }

    // Add current request
    timestamps.push(now);
    this.requests.set(key, timestamps);

    return true;
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.requests.get(key) || [];

    const recentRequests = timestamps.filter(timestamp => timestamp > windowStart).length;
    return Math.max(0, this.maxRequests - recentRequests);
  }

  getResetTime(key: string): number {
    const timestamps = this.requests.get(key);
    if (!timestamps || timestamps.length === 0) return Date.now();

    const oldest = Math.min(...timestamps);
    return oldest + this.windowMs;
  }
}

// Create rate limiters for different endpoints
export const generateTPLimiter = new RateLimiter(
  60 * 1000,  // 1 minute window
  5           // 5 requests per minute
);

export const generateSoalLimiter = new RateLimiter(
  60 * 1000,  // 1 minute window
  5           // 5 requests per minute
);

export const trimTPLimiter = new RateLimiter(
  60 * 1000,  // 1 minute window
  20          // 20 requests per minute (lenient for trim/compress with retries)
);

/**
 * Middleware wrapper to apply rate limiting
 * Usage: export const POST = withRateLimit(generateTPLimiter, async (request, { userId }) => { ... });
 */
export function withRateLimit(
  limiter: RateLimiter,
  handler: (request: NextRequest, auth: { userId: string }) => Promise<NextResponse>
) {
  return async (request: NextRequest, auth: { userId: string }) => {
    const key = auth.userId;
    
    if (!limiter.isAllowed(key)) {
      const resetTime = new Date(limiter.getResetTime(key)).toISOString();
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((limiter.getResetTime(key) - Date.now()) / 1000),
          resetAt: resetTime
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((limiter.getResetTime(key) - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': limiter.getRemainingRequests(key).toString(),
            'X-RateLimit-Reset': resetTime
          }
        }
      );
    }

    // Add rate limit info to response headers
    const response = await handler(request, auth);
    response.headers.set('X-RateLimit-Limit', '5');
    response.headers.set('X-RateLimit-Remaining', limiter.getRemainingRequests(key).toString());
    response.headers.set('X-RateLimit-Reset', new Date(limiter.getResetTime(key)).toISOString());

    return response;
  };
}

/**
 * For production, use Upstash Redis rate limiting
 * Install: npm install @upstash/ratelimit @upstash/redis
 * 
 * export async function rateLimitWithUpstash(userId: string) {
 *   const redis = new Redis({
 *     url: process.env.UPSTASH_REDIS_REST_URL!,
 *     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 *   });
 * 
 *   const ratelimit = new Ratelimit({
 *     redis,
 *     limiter: Ratelimit.slidingWindow(5, '1 m'),
 *     namespace: 'api_rate_limit',
 *   });
 * 
 *   const { success } = await ratelimit.limit(userId);
 *   return success;
 * }
 */
