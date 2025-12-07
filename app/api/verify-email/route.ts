/**
 * POST /api/verify-email
 * Verify user email with token
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/email';
import { logAuditFromServer } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const { userId, token } = await request.json();

    if (!userId || !token) {
      return NextResponse.json(
        { error: 'Missing userId or token' },
        { status: 400 }
      );
    }

    // Verify the token
    const email = await verifyEmailToken(userId, token);

    if (!email) {
      // Log failed verification attempt
      await logAuditFromServer(request, userId, 'EMAIL_VERIFY_FAILED', 'failure', 'user', {
        errorMessage: 'Invalid or expired verification token',
      }).catch(() => {}); // Non-blocking

      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Log successful verification
    await logAuditFromServer(request, userId, 'EMAIL_VERIFIED', 'success', 'user', {
      metadata: { email },
    }).catch(() => {}); // Non-blocking

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      email,
    });
  } catch (error) {
    console.error('[VERIFY_EMAIL_ERROR]', error);

    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    );
  }
}
