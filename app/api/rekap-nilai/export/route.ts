/**
 * POST /api/rekap-nilai/export
 * Export score summary to PDF/Excel
 * Rate limited: 5 requests/minute per user
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndRateLimit } from '@/lib/auth-middleware';
import { logAuditFromServer } from '@/lib/audit';
import { getAdminFirestore } from '@/lib/firebase-admin';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';

// Create rate limiter: 5 exports per minute
class ExportLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number = 60 * 1000;
  private readonly maxRequests: number = 5;

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

const exportLimiter = new ExportLimiter();

export const POST = withAuthAndRateLimit(exportLimiter, async (request: NextRequest, { userId }) => {
  try {
    const { classId, format = 'json' } = await request.json();

    if (!classId) {
      return NextResponse.json(
        { error: 'Class ID required' },
        { status: 400 }
      );
    }

    if (!['json', 'csv', 'pdf'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Supported: json, csv, pdf' },
        { status: 400 }
      );
    }

    // Verify class belongs to user
    const db = getAdminFirestore();
    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists || classDoc.data()?.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get all exams for this class with scores
    const examsSnapshot = await db.collection('exams')
      .where('classId', '==', classId)
      .where('status', '==', 'completed')
      .get();

    const exams = examsSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (exams.length === 0) {
      return NextResponse.json(
        { error: 'No completed exams found' },
        { status: 404 }
      );
    }

    // Log export
    await logAuditFromServer(request, userId, 'REKAP_EXPORT', 'success', 'scores', {
      resourceId: classId,
      metadata: {
        format,
        examCount: exams.length,
      },
    }).catch(() => {});

    // For now, return JSON. In production, generate PDF/CSV
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: {
          classId,
          exportDate: new Date().toISOString(),
          format,
          exams,
          totalExams: exams.length,
        },
      });
    }

    // Placeholder for PDF/CSV generation
    return NextResponse.json(
      { error: 'PDF/CSV export coming soon. Use JSON format for now.' },
      { status: 501 }
    );
  } catch (error: any) {
    console.error('[REKAP_EXPORT_ERROR]', error);

    await logAuditFromServer(request, userId, 'REKAP_EXPORT', 'failure', 'scores', {
      errorMessage: error.message || 'Unknown error',
    }).catch(() => {});

    return NextResponse.json(
      { error: 'Failed to export scores' },
      { status: 500 }
    );
  }
});
