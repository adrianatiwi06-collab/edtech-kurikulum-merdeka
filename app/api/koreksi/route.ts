/**
 * POST /api/koreksi
 * Update exam score corrections
 * Rate limited: 10 requests/minute per user
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndRateLimit } from '@/lib/auth-middleware';
import { logAuditFromServer } from '@/lib/audit';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Create rate limiter: 10 requests per minute for koreksi
class KoreksiLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number = 60 * 1000;
  private readonly maxRequests: number = 10;

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.requests.get(key) || [];
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    if (timestamps.length >= this.maxRequests) {
      this.requests.set(key, timestamps);
      return false;
    }

    timestamps.push(now);
    this.requests.set(key, timestamps);
    return true;
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = (this.requests.get(key) || []).filter(timestamp => timestamp > windowStart);
    return Math.max(0, this.maxRequests - timestamps.length);
  }

  getResetTime(key: string): number {
    const timestamps = this.requests.get(key);
    if (!timestamps || timestamps.length === 0) return Date.now();
    return Math.min(...timestamps) + this.windowMs;
  }
}

const koreksiLimiter = new KoreksiLimiter();

export const POST = withAuthAndRateLimit(koreksiLimiter, async (request: NextRequest, { userId }) => {
  try {
    const { examId, scores, corrections } = await request.json();

    if (!examId) {
      return NextResponse.json(
        { error: 'Exam ID required' },
        { status: 400 }
      );
    }

    if (!scores || typeof scores !== 'object') {
      return NextResponse.json(
        { error: 'Scores object required' },
        { status: 400 }
      );
    }

    // Verify exam belongs to user
    const db = getAdminFirestore();
    const examDoc = await db.collection('exams').doc(examId).get();
    if (!examDoc.exists || examDoc.data()?.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update exam scores
    await db.collection('exams').doc(examId).update({
      scores,
      corrections: corrections || null,
      updatedAt: Timestamp.now(),
    });

    // Log correction
    await logAuditFromServer(request, userId, 'KOREKSI_UPDATE', 'success', 'exam', {
      resourceId: examId,
      metadata: {
        scoreCount: Object.keys(scores).length,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Scores updated successfully',
    });
  } catch (error: any) {
    console.error('[KOREKSI_ERROR]', error);

    await logAuditFromServer(request, userId, 'KOREKSI_UPDATE', 'failure', 'exam', {
      errorMessage: error.message || 'Unknown error',
    }).catch(() => {});

    return NextResponse.json(
      { error: 'Failed to update scores' },
      { status: 500 }
    );
  }
});
