/**
 * POST /api/resend-verification-email
 * Resend verification email to user
 * Requires Firebase authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { resendVerificationEmail } from '@/lib/email';
import { logAuditFromServer } from '@/lib/audit';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Send verification email
    const success = await resendVerificationEmail(userId, appUrl);

    if (!success) {
      // Log failed attempt
      await logAuditFromServer(request, userId, 'EMAIL_VERIFY_FAILED', 'failure', 'user', {
        errorMessage: 'Could not resend verification email (rate limited or already verified)',
      }).catch(() => {});

      return NextResponse.json(
        { error: 'Could not resend verification email. Please try again later or contact support.' },
        { status: 429 }
      );
    }

    // Log successful resend
    await logAuditFromServer(request, userId, 'EMAIL_VERIFY_FAILED', 'success', 'user', {
      metadata: { action: 'resend' },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (error) {
    console.error('[RESEND_VERIFICATION_ERROR]', error);

    return NextResponse.json(
      { error: 'Failed to resend verification email' },
      { status: 500 }
    );
  }
});
