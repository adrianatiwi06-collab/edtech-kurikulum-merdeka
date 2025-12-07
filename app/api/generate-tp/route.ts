import { NextRequest, NextResponse } from 'next/server';
import { generateLearningGoals, getQuotaStatus } from '@/lib/gemini';
import { extractTextFromPDF } from '@/lib/pdf-utils';
import { withAuthAndRateLimit } from '@/lib/auth-middleware';
import { generateTPLimiter } from '@/lib/rate-limiter';
import { logAuditFromServer } from '@/lib/audit';

export const POST = withAuthAndRateLimit(generateTPLimiter, async (request: NextRequest, { userId }) => {
  try {
    // Check quota status first
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
    
    // Log queue info
    if (quotaStatus.queueSize > 0) {
      console.log(`[API] Queue size: ${quotaStatus.queueSize}, Remaining requests: ${quotaStatus.remainingRequests}`);
    }
    
    const body = await request.json();
    const { textContent, pdfBase64, grade, subject, cpReference, maxLength100, semesterSelection, materiPokok } = body;

    // userId is now VERIFIED from Firebase token

    if (!grade || !cpReference) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Validate CP length
    const cpLength = cpReference.trim().length;
    if (cpLength < 50) {
      return NextResponse.json(
        { success: false, error: 'CP terlalu singkat. Minimal 50 karakter untuk kualitas yang baik. Jelaskan kompetensi yang ingin dicapai siswa.' },
        { status: 400 }
      );
    }
    
    if (cpLength > 2000) {
      return NextResponse.json(
        { success: false, error: 'CP terlalu panjang. Maksimal 2000 karakter. Ringkas menjadi poin-poin kompetensi utama.' },
        { status: 400 }
      );
    }

    // Validate subject for SD (grade 1-6)
    const gradeNum = parseInt(grade);
    if (gradeNum >= 1 && gradeNum <= 6 && !subject) {
      return NextResponse.json(
        { success: false, error: 'Mata pelajaran diperlukan untuk kelas SD' },
        { status: 400 }
      );
    }

    let contentToAnalyze = textContent;

    // If PDF is provided, extract text from it
    if (pdfBase64) {
      try {
        // Convert base64 to buffer
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        
        // Validate file size (max 10 MB for safety)
        const fileSizeMB = pdfBuffer.length / (1024 * 1024);
        if (fileSizeMB > 10) {
          return NextResponse.json(
            { 
              success: false, 
              error: `File PDF terlalu besar (${fileSizeMB.toFixed(1)} MB). Maksimal 10 MB. Untuk buku lebih besar, gunakan fitur chunking atau upload per bab.` 
            },
            { status: 400 }
          );
        }
        
        console.log(`[PDF Upload] Size: ${fileSizeMB.toFixed(2)} MB`);
        contentToAnalyze = await extractTextFromPDF(pdfBuffer);
        
        if (!contentToAnalyze || contentToAnalyze.trim().length === 0) {
          return NextResponse.json(
            { success: false, error: 'Gagal mengekstrak teks dari PDF. File mungkin berisi gambar atau terenkripsi.' },
            { status: 400 }
          );
        }
      } catch (pdfError: any) {
        console.error('PDF extraction error:', pdfError);
        return NextResponse.json(
          { success: false, error: 'Gagal membaca PDF: ' + pdfError.message },
          { status: 400 }
        );
      }
    }

    if (!contentToAnalyze || contentToAnalyze.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Konten materi tidak boleh kosong' },
        { status: 400 }
      );
    }

    // Validate content length
    const contentLength = contentToAnalyze.trim().length;
    if (contentLength < 100) {
      return NextResponse.json(
        { success: false, error: 'Materi terlalu singkat (< 100 karakter). Tambahkan detail materi pembelajaran yang akan diajarkan.' },
        { status: 400 }
      );
    }

    // Generate TP using Gemini AI
    const tpData = await generateLearningGoals(
      contentToAnalyze, 
      grade, 
      subject, 
      cpReference, 
      undefined, // modelName - use default
      maxLength100, // pass the maxLength100 parameter
      semesterSelection, // pass the semesterSelection parameter (default: 'both')
      materiPokok // pass optional materi pokok for focused generation
    );

    // Get updated quota status
    const updatedQuota = getQuotaStatus();

    // Log successful generation (with undefined resourceId)
    try {
      await logAuditFromServer(request, userId, 'GENERATE_TP', 'success', 'learning_goals', {
        metadata: {
          gradeLevel: grade,
          hasSubject: !!subject,
          contentSize: contentToAnalyze.length,
          tpCount: (tpData?.semester1?.length || 0) + (tpData?.semester2?.length || 0),
        }
      });
    } catch (auditError: any) {
      console.warn('[Audit] Failed to log:', auditError.message);
    }

    return NextResponse.json({
      success: true,
      data: tpData,
      quotaInfo: {
        remainingRequests: updatedQuota.remainingRequests,
        maxRequestsPerMinute: updatedQuota.maxRequestsPerMinute,
        queueSize: updatedQuota.queueSize
      }
    });
  } catch (error: any) {
    // Log full error details server-side
    console.error('[GENERATE_TP_ERROR]', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      userId,
      timestamp: new Date().toISOString()
    });
    
    // Get quota status for error response
    const quotaStatus = getQuotaStatus();
    
    // Check if it's a quota error
    const isQuotaError = error.message?.includes('quota') || 
                         error.code?.includes('RESOURCE_EXHAUSTED') ||
                         error.message?.includes('rate limit');
    
    // Log failed generation
    await logAuditFromServer(request, userId, 'GENERATE_TP', 'failure', 'learning_goals', {
      errorMessage: error.message,
      metadata: {
        errorCode: error.code,
        isQuotaError,
      }
    });
    
    // Return generic error to client
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate learning objectives. Please try again.',
        code: isQuotaError ? 'QUOTA_EXHAUSTED' : 'GENERATION_FAILED'
      },
      { status: isQuotaError ? 429 : 500 }
    );
  }
});
