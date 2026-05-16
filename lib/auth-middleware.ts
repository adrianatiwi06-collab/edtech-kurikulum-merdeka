import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from './firebase-admin';

export interface AuthenticatedRequest extends NextRequest {
  userId?: string;
}

/**
 * Middleware untuk verify Firebase ID token dari Authorization header
 * Usage: const { userId } = await verifyAuth(request);
 */
export async function verifyAuth(request: NextRequest): Promise<{ 
  userId: string;
  email?: string;
}> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('MISSING_AUTH_TOKEN');
  }

  try {
    const token = authHeader.substring(7);
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    
    return {
      userId: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error: any) {
    if (error.code === 'auth/id-token-expired') {
      throw new Error('TOKEN_EXPIRED');
    }
    if (error.code === 'auth/invalid-id-token') {
      throw new Error('INVALID_TOKEN');
    }
    throw error;
  }
}

/**
 * Wrap API route handlers dengan auth verification + rate limiting
 * Usage:
 * export const POST = withAuthAndRateLimit(limiter, async (request, { userId }) => { ... });
 */
export function withAuthAndRateLimit(
  limiter: { isAllowed: (key: string) => boolean; getRemainingRequests: (key: string) => number; getResetTime: (key: string) => number },
  handler: (request: NextRequest, auth: { userId: string; email?: string }) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      // 1. Verify auth first
      const auth = await verifyAuth(request);
      const userId = auth.userId;

      // 2. Check rate limit
      if (!limiter.isAllowed(userId)) {
        const resetTime = new Date(limiter.getResetTime(userId)).toISOString();
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((limiter.getResetTime(userId) - Date.now()) / 1000),
            resetAt: resetTime
          },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil((limiter.getResetTime(userId) - Date.now()) / 1000).toString(),
              'X-RateLimit-Limit': '5',
              'X-RateLimit-Remaining': limiter.getRemainingRequests(userId).toString(),
              'X-RateLimit-Reset': resetTime
            }
          }
        );
      }

      // 3. Call handler
      const response = await handler(request, auth);
      
      // 4. Add rate limit info to response headers
      response.headers.set('X-RateLimit-Limit', '5');
      response.headers.set('X-RateLimit-Remaining', limiter.getRemainingRequests(userId).toString());
      response.headers.set('X-RateLimit-Reset', new Date(limiter.getResetTime(userId)).toISOString());

      return response;
    } catch (error: any) {
      // Log full error server-side
      console.error('[AUTH_ERROR]', error.message);

      // Return generic error to client
      if (error.message === 'MISSING_AUTH_TOKEN') {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'MISSING_AUTH' },
          { status: 401 }
        );
      }

      if (error.message === 'TOKEN_EXPIRED') {
        return NextResponse.json(
          { error: 'Token expired', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        );
      }

      if (error.message === 'INVALID_TOKEN') {
        return NextResponse.json(
          { error: 'Invalid token', code: 'INVALID_TOKEN' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Authentication failed', code: 'AUTH_FAILED' },
        { status: 401 }
      );
    }
  };
}

/**
 * Legacy withAuth for endpoints that don't need rate limiting
 */
export function withAuth(handler: (request: NextRequest, auth: { userId: string; email?: string }) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    try {
      const auth = await verifyAuth(request);
      return await handler(request, auth);
    } catch (error: any) {
      // Log full error server-side
      console.error('[AUTH_ERROR]', error.message);

      // Return generic error to client
      if (error.message === 'MISSING_AUTH_TOKEN') {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'MISSING_AUTH' },
          { status: 401 }
        );
      }

      if (error.message === 'TOKEN_EXPIRED') {
        return NextResponse.json(
          { error: 'Token expired', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        );
      }

      if (error.message === 'INVALID_TOKEN') {
        return NextResponse.json(
          { error: 'Invalid token', code: 'INVALID_TOKEN' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Authentication failed', code: 'AUTH_FAILED' },
        { status: 401 }
      );
    }
  };
}

/**
 * Optional CORS validation
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ];

  if (!origin) return true; // Allow non-browser requests
  
  return allowedOrigins.some(allowed => 
    origin === allowed || origin?.endsWith(allowed.replace('http://', '').replace('https://', ''))
  );
}
