import { NextRequest, NextResponse } from 'next/server';
import { getQuotaStatus } from '@/lib/gemini';

/**
 * API endpoint untuk monitoring quota status
 * GET /api/quota-status
 */
export async function GET(request: NextRequest) {
  try {
    const status = getQuotaStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        isQuotaExhausted: status.isQuotaExhausted,
        remainingRequests: status.remainingRequests,
        maxRequestsPerMinute: status.maxRequestsPerMinute,
        errorCount: status.errorCount,
        lastError: status.lastError,
        queueSize: status.queueSize,
        status: status.isQuotaExhausted ? 'exhausted' : 
                status.remainingRequests < 5 ? 'warning' : 'healthy',
        message: status.isQuotaExhausted 
          ? '⚠️ Quota habis. Silakan tunggu atau gunakan API key baru.'
          : status.remainingRequests < 5
          ? `⚠️ Quota hampir habis (${status.remainingRequests} tersisa)`
          : `✅ Quota sehat (${status.remainingRequests}/${status.maxRequestsPerMinute})`
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get quota status'
      },
      { status: 500 }
    );
  }
}
