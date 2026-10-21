import { NextRequest, NextResponse } from 'next/server';
import { csrfTokenEndpoint } from '@/lib/csrf-protection';

/**
 * GET /api/csrf-token
 * 
 * Return CSRF token untuk client use
 * Token disimpan di httpOnly cookie, nilai juga dikirim ke client
 * Client harus include token dalam x-csrf-token header untuk state-changing requests
 */
export async function GET(request: NextRequest) {
  return csrfTokenEndpoint(request);
}
