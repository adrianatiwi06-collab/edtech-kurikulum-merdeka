import { NextRequest, NextResponse } from 'next/server';
import { getQuotaStatus } from '@/lib/gemini';
import { withAuthAndRateLimit } from '@/lib/auth-middleware';
import { generateTPLimiter } from '@/lib/rate-limiter';
import { logAuditFromServer } from '@/lib/audit';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Inisialisasi Gemini menggunakan kunci API yang sama
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export const POST = withAuthAndRateLimit(generateTPLimiter, async (request: NextRequest, { userId }) => {
  try {
    // 1. Periksa status kuota
    const quotaStatus = getQuotaStatus();
    if (quotaStatus.isQuotaExhausted) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'API quota exhausted. Please try again in a few moments.',
          code: 'QUOTA_EXHAUSTED'
        },
        { status: 429 }
      );
    }
    
    // 2. Ambil data dari payload frontend
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Prompt atau data modul tidak boleh kosong', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // 3. Panggil Gemini AI menggunakan model TERBARU (Sesuai panduan GEMINI_MODELS.md)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' }); // <--- PERUBAHAN ADA DI SINI
    
    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

    if (!aiText || aiText.trim().length === 0) {
      throw new Error('AI menghasilkan respons kosong.');
    }

    // 4. Catat log audit sukses
    try {
      await logAuditFromServer(request, userId, 'CREATE', 'success', 'learning_modules', {
        metadata: { promptLength: prompt.length }
      });
    } catch (auditError: any) {
      console.warn('[Audit] Failed to log:', auditError.message);
    }

    // 5. Kembalikan data sukses ke frontend
    return NextResponse.json({
      success: true,
      result: aiText
    });

  } catch (error: any) {
    console.error('[GENERATE_MODUL_ERROR]', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      userId,
      timestamp: new Date().toISOString()
    });
    
    const quotaStatus = getQuotaStatus();
    const isQuotaError = error.message?.includes('quota') || 
                         error.code?.includes('RESOURCE_EXHAUSTED') ||
                         error.message?.includes('rate limit');
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Gagal menghasilkan Modul Ajar. Silakan coba lagi.',
        code: isQuotaError ? 'QUOTA_EXHAUSTED' : 'GENERATION_FAILED'
      },
      { status: isQuotaError ? 429 : 500 }
    );
  }
});