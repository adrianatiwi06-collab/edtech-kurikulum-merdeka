import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * CSRF Token Management untuk protect against Cross-Site Request Forgery attacks
 */

/**
 * Generate a unique CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate CSRF token from request
 * Expected: token should be in request header 'x-csrf-token'
 * And original token should be stored in secure cookie
 */
export function validateCSRFToken(
  headerToken: string | null,
  cookieToken: string | null
): boolean {
  if (!headerToken || !cookieToken) {
    return false;
  }

  // Compare tokens (timing-safe comparison)
  return crypto.timingSafeEqual(
    Buffer.from(headerToken),
    Buffer.from(cookieToken)
  );
}

/**
 * Middleware untuk validate CSRF token pada POST/PUT/DELETE requests
 * 
 * Usage:
 * export const POST = withCSRFProtection(async (request, { userId }) => { ... });
 */
export function withCSRFProtection(
  handler: (request: NextRequest, auth: { userId: string }) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    // Check request method
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      // Validate origin
      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');
      
      const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      // Check origin matches allowed origin
      if (origin && !origin.startsWith(allowedOrigin)) {
        console.warn(`[CSRF] Blocked request from origin: ${origin}`);
        return NextResponse.json(
          { error: 'Forbidden', code: 'CSRF_ORIGIN_MISMATCH' },
          { status: 403 }
        );
      }

      // Validate CSRF token
      const headerToken = request.headers.get('x-csrf-token');
      const cookies = request.headers.get('cookie');
      
      let csrfTokenFromCookie: string | null = null;
      if (cookies) {
        const csrfCookie = cookies
          .split(';')
          .find(c => c.trim().startsWith('csrf-token='));
        if (csrfCookie) {
          csrfTokenFromCookie = csrfCookie.split('=')[1];
        }
      }

      if (!validateCSRFToken(headerToken, csrfTokenFromCookie)) {
        console.warn('[CSRF] Invalid CSRF token');
        return NextResponse.json(
          { error: 'CSRF token invalid', code: 'CSRF_TOKEN_INVALID' },
          { status: 403 }
        );
      }
    }

    // Proceed with request
    return handler(request, { userId: '' }); // userId should be from auth middleware
  };
}

/**
 * Endpoint untuk get CSRF token (called on page load)
 * This should be called before making any state-changing requests
 * 
 * Usage on client:
 * const response = await fetch('/api/csrf-token');
 * const { token } = await response.json();
 * // Store token and include in future requests
 */
export async function csrfTokenEndpoint(request: NextRequest): Promise<NextResponse> {
  if (request.method !== 'GET') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const token = generateCSRFToken();
  
  // Set token in secure httpOnly cookie
  const response = NextResponse.json({
    token,
    message: 'CSRF token generated'
  });

  response.cookies.set({
    name: 'csrf-token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/'
  });

  return response;
}

/**
 * React hook untuk get dan manage CSRF token pada client-side
 * 
 * Usage dalam component:
 * const csrfToken = useCSRFToken();
 * 
 * Kemudian dalam fetch request:
 * fetch('/api/endpoint', {
 *   method: 'POST',
 *   headers: {
 *     'x-csrf-token': csrfToken
 *   },
 *   body: JSON.stringify(data)
 * })
 */
export const useCSRFTokenCode = `
import { useEffect, useState } from 'react';

export function useCSRFToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    async function fetchToken() {
      try {
        const response = await fetch('/api/csrf-token');
        const { token } = await response.json();
        setToken(token);
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
      }
    }

    fetchToken();
  }, []);

  return token;
}
`;
