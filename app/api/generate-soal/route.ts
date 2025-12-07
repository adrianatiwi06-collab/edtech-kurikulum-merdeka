/**
 * POST /api/generate-soal
 * Generate exam questions using Gemini AI
 * Rate limited: 5 requests/minute per user
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndRateLimit } from '@/lib/auth-middleware';
import { generateQuestions } from '@/lib/gemini';
import { logAuditFromServer } from '@/lib/audit';
import { generateSoalLimiter } from '@/lib/rate-limiter';

export const POST = withAuthAndRateLimit(generateSoalLimiter, async (request: NextRequest, { userId }) => {
  try {
    const { learningGoals, questionConfig } = await request.json();

    if (!learningGoals || !Array.isArray(learningGoals) || learningGoals.length === 0) {
      return NextResponse.json(
        { error: 'Invalid learning goals' },
        { status: 400 }
      );
    }

    if (!questionConfig) {
      return NextResponse.json(
        { error: 'Question config required' },
        { status: 400 }
      );
    }

    // Generate questions
    const result = await generateQuestions(learningGoals, questionConfig);

    // Log successful generation
    await logAuditFromServer(request, userId, 'GENERATE_SOAL', 'success', 'questions', {
      metadata: {
        goalsCount: learningGoals.length,
        mcCount: result.multipleChoice?.length || 0,
        essayCount: result.essay?.length || 0,
        shortAnswerCount: result.shortAnswer?.length || 0,
      },
    }).catch(() => {}); // Non-blocking

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[GENERATE_SOAL_ERROR]', error);

    // Log failed attempt
    await logAuditFromServer(request, userId, 'GENERATE_SOAL', 'failure', 'questions', {
      errorMessage: error.message || 'Unknown error',
    }).catch(() => {}); // Non-blocking

    // Sanitize error message
    const isQuotaError = error.message?.includes('quota') || error.message?.includes('429');
    const errorMessage = isQuotaError 
      ? 'Quota limit reached. Please try again later.'
      : 'Failed to generate questions. Please try again.';

    return NextResponse.json(
      { 
        error: errorMessage,
        code: isQuotaError ? 'QUOTA_EXCEEDED' : 'GENERATION_ERROR',
      },
      { status: isQuotaError ? 429 : 500 }
    );
  }
});
