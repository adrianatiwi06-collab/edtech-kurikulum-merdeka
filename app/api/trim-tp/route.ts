import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndRateLimit } from '@/lib/auth-middleware';
import { trimTPLimiter } from '@/lib/rate-limiter';
import { logAuditFromServer } from '@/lib/audit';
import { getQuotaStatus } from '@/lib/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Get API keys - simple approach
const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(/[,\n\s]+/).filter(Boolean);

// Model fallback cascade - TANPA models/ prefix untuk GoogleGenerativeAI direct
const FALLBACK_MODELS = [
  'gemini-1.5-flash',       // Paling stabil & cepat
  'gemini-1.5-flash-002',   // Versi spesifik
  'gemini-1.5-pro',         // Fallback ke Pro
  'gemini-1.5-pro-002'      // Fallback terakhir
];

// Simple in-memory key rotation with ban tracking
let currentKeyIndex = 0;
const bannedKeysMap = new Map<string, number>();
const BAN_DURATION = 2 * 60 * 1000; // 2 minutes

function getNextAvailableKey(): string | null {
  const now = Date.now();
  
  // Clean expired bans
  for (const [key, expiry] of bannedKeysMap.entries()) {
    if (expiry <= now) {
      bannedKeysMap.delete(key);
    }
  }
  
  // Try to find available key
  for (let i = 0; i < API_KEYS.length; i++) {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    const key = API_KEYS[currentKeyIndex];
    
    if (!bannedKeysMap.has(key) || bannedKeysMap.get(key)! <= now) {
      return key;
    }
  }
  
  return null;
}

function banKey(key: string) {
  bannedKeysMap.set(key, Date.now() + BAN_DURATION);
  console.log(`[TrimTP] Key banned temporarily`);
}

export const POST = withAuthAndRateLimit(trimTPLimiter, async (request: NextRequest, { userId }) => {
  console.log('[TrimTP] POST request received, userId:', userId);
  try {
    // Check quota status first
    const quotaStatus = getQuotaStatus();
    console.log('[TrimTP] Quota status:', quotaStatus);
    
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

    const body = await request.json();
    const { tpText, maxLength = 100, allowSplit = true, grade, subject } = body;

    if (!tpText || tpText.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'TP text kosong', code: 'EMPTY_INPUT' },
        { status: 400 }
      );
    }

    if (tpText.trim().length <= maxLength) {
      return NextResponse.json(
        { 
          success: true, 
          trimmed: tpText.trim(),
          charCount: tpText.trim().length,
          requiresTrim: false,
          splits: [],
          message: 'TP sudah di bawah batas karakter' 
        }
      );
    }

    // Validate API keys
    if (API_KEYS.length === 0) {
      return NextResponse.json(
        { success: false, error: 'API key tidak dikonfigurasi', code: 'NO_API_KEY' },
        { status: 500 }
      );
    }

    // Build prompt untuk trim TP
    let prompt: string;
    try {
      prompt = buildTrimTPPrompt(tpText, maxLength, allowSplit, grade, subject);
      console.log('[TrimTP] Prompt built, length:', prompt.length);
    } catch (promptError: any) {
      console.error('[TrimTP] Error building prompt:', promptError);
      return NextResponse.json(
        { success: false, error: 'Gagal membuat prompt', code: 'PROMPT_ERROR' },
        { status: 500 }
      );
    }

    // Try models and keys dengan simple rotation
    let responseText: string | null = null;
    let lastError: any = null;

    // Try each fallback model
    for (const fallbackModel of FALLBACK_MODELS) {
      console.log(`[TrimTP] Trying model: ${fallbackModel}`);
      let modelSuccess = false;
      
      // For each model, try available API keys
      for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
        const key = getNextAvailableKey();
        if (!key) {
          console.log('[TrimTP] No available keys, all banned');
          break;
        }

        try {
          console.log(`[TrimTP] Trying ${fallbackModel} with key #${currentKeyIndex + 1}`);
          const client = new GoogleGenerativeAI(key);
          const model = client.getGenerativeModel({ 
            model: fallbackModel,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1500,
              responseMimeType: 'application/json',
            },
          });

          console.log('[TrimTP] Sending request to Gemini API...');
          const response = await model.generateContent(prompt);
          console.log('[TrimTP] Got response from Gemini API');
          const resolvedResponse = await response.response;
          responseText = resolvedResponse.text();
          
          if (responseText) {
            console.log(`[TrimTP] Success with ${fallbackModel}, response length: ${responseText.length}`);
            modelSuccess = true;
            break; // Success, exit key loop
          }
        } catch (error: any) {
          lastError = error;
          const errorMessage = error?.message || '';
          
          // If quota error, ban key and try next
          if (errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('rate limit')) {
            banKey(key);
            console.log(`[TrimTP] Quota error, trying next key...`);
            continue;
          }
          
          // For other errors (like 404), try next key with same model
          console.log(`[TrimTP] Error: ${errorMessage.substring(0, 100)}`);
          continue;
        }
      }
      
      if (modelSuccess) {
        break; // Exit model loop if successful
      }
    }

    // Check if we got response
    if (!responseText) {
      const errorMsg = lastError?.message || 'Unknown error';
      console.error(`[TrimTP] All attempts failed. Last error: ${errorMsg}`);
      
      if (errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        return NextResponse.json(
          { success: false, error: 'Quota API habis. Silakan coba lagi dalam beberapa menit.', code: 'QUOTA_EXHAUSTED' },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: 'Gagal mendapat respons dari AI. Silakan coba lagi.', code: 'AI_ERROR' },
        { status: 500 }
      );
    }

    // Parse response
    const result = parseTrimmingResponse(responseText);

    if (!result) {
      console.error(`[TrimTP] Failed to parse response: ${responseText.substring(0, 200)}`);
      return NextResponse.json(
        { success: false, error: 'Format respons tidak valid dari AI', code: 'PARSE_ERROR' },
        { status: 500 }
      );
    }

    // Log audit
    await logAuditFromServer(request, userId, 'GENERATE_TP', 'success', 'learning_goals', {
      metadata: {
        originalLength: tpText.length,
        resultLength: result.trimmed?.length || 0,
        splits: result.splits?.length || 0,
        method: 'ai_trim'
      }
    });

    return NextResponse.json({
      success: true,
      trimmed: result.trimmed,
      splits: result.splits || [],
      charCount: result.trimmed?.length || 0,
      requiresTrim: true,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[TrimTP API] Top-level error caught:', error);
    console.error('[TrimTP API] Error name:', error?.name);
    console.error('[TrimTP API] Error message:', error?.message);
    console.error('[TrimTP API] Error stack:', error?.stack?.substring(0, 500));
    
    // Handle Gemini API errors
    const errorMessage = error.message || 'Unknown error';
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let userMessage = 'Terjadi kesalahan saat memproses permintaan';

    // Check for quota errors
    if (errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      statusCode = 429;
      errorCode = 'QUOTA_EXHAUSTED';
      userMessage = 'Quota API Gemini telah habis. Silakan coba lagi nanti.';
    } else if (errorMessage.includes('API_ERROR') || errorMessage.includes('429')) {
      statusCode = 429;
      errorCode = 'RATE_LIMIT';
      userMessage = 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.';
    } else if (errorMessage.includes('INVALID_ARGUMENT')) {
      statusCode = 400;
      errorCode = 'INVALID_INPUT';
      userMessage = 'Input tidak valid untuk pemrosesan AI.';
    }
    
    await logAuditFromServer(
      request,
      userId,
      'GENERATE_TP',
      'failure',
      'learning_goals',
      { errorMessage: errorMessage }
    );

    return NextResponse.json(
      { 
        success: false, 
        error: userMessage,
        code: errorCode
      },
      { status: statusCode }
    );
  }
});

/**
 * Build prompt untuk trim TP menggunakan AI
 * Mengikuti pola dari Generate TP dengan modifikasi untuk compression
 */
function buildTrimTPPrompt(
  tpText: string,
  maxLength: number,
  allowSplit: boolean,
  grade?: string,
  subject?: string
): string {
  const gradeInfo = grade ? `Tingkat: ${grade}` : '';
  const subjectInfo = subject ? `Mata Pelajaran: ${subject}` : '';
  const splitInfo = allowSplit 
    ? `Jika TP mengandung 2+ topik pembelajaran, pisahkan menjadi TP individual (masing-masing max ${maxLength} karakter).`
    : `Jangan pisahkan. Kompresi menjadi 1 TP maksimal ${maxLength} karakter.`;

  return `Anda adalah ahli kurikulum yang berpengalaman dalam menyederhanakan Tujuan Pembelajaran (TP) tanpa menghilangkan esensi pembelajaran.

TUGAS:
Pangkas/kompresi TP berikut agar berukuran MAKSIMAL ${maxLength} karakter, sambil mempertahankan makna dan kompetensi inti.

${gradeInfo}
${subjectInfo}

TP ASLI (${tpText.length} karakter):
"${tpText}"

PEDOMAN KOMPRESI:

1. PRIORITAS UTAMA: Pertahankan BEHAVIOR (kata kerja operasional)
   - Jangan hapus kata kerja utama seperti "mengidentifikasi", "menjelaskan", "menerapkan"
   - Behavior adalah INTI pembelajaran, harus selalu ada

2. STRATEGI KOMPRESI (urutan prioritas):
   a) HAPUS audience: "Peserta didik mampu" → "Dapat" (hemat 16 karakter)
   b) SINGKATKAN OBJECT: 
      - "berbagai konteks" → "konteks"
      - "dengan tepat dan akurat" → "dengan tepat"
      - "bisa mengidentifikasi dan menjelaskan serta membandingkan" → "membandingkan"
   c) HAPUS CONDITION yang bukan essential:
      - "(dengan menggunakan kalkulator)" → hapus jika tidak essential
      - "dalam berbagai kondisi pembelajaran" → hapus
   d) SINGKATKAN DEGREE:
      - "dengan ketelitian minimal 80%" → "dengan teliti"
      - "secara akurat dan efisien" → "akurat"

3. DETEKSI MULTI-TOPIK:
   Jika TP memiliki LEBIH DARI 1 topik pembelajaran yang terpisah:
   - Cari penghubung: "dan", "serta", "atau", koma
   - Contoh: "Dapat mengidentifikasi kalimat aktif DAN kalimat pasif" = 2 topik
   - Jika multi-topik ditemukan dan allowSplit=true:
     * PISAHKAN menjadi TP individual
     * Setiap TP: "Dapat [behavior] [object1]" ~ ${maxLength} char
     * Contoh split:
       Original (${tpText.length} char): "${tpText}"
       Split 1 (≤${maxLength} char): "Dapat mengidentifikasi kalimat aktif"
       Split 2 (≤${maxLength} char): "Dapat menggunakan kalimat pasif dengan tepat"

4. VALIDASI HASIL:
   ✓ Behavior masih jelas dan dapat diukur
   ✓ Object (apa yang dipelajari) masih terpahami
   ✓ Degree/kriteria masih ada jika esensial
   ✓ Total karakter ≤ ${maxLength} (untuk single) ATAU setiap split ≤ ${maxLength}
   ✗ Jangan: Menghapus verb utama, membuat kalimat yang tidak jelas, menghilangkan kriteria sukses

${splitInfo}

FORMAT OUTPUT JSON:
Berikan HANYA JSON valid (tanpa markdown, tanpa teks tambahan):
{
  "trimmed": "TP hasil kompresi (jika tidak di-split) atau TP pertama (jika di-split)",
  "splits": [
    "TP kedua jika ada split (optional, bisa kosong jika single)",
    "TP ketiga jika ada split (optional)"
  ],
  "explanation": "Penjelasan singkat strategi kompresi yang digunakan (1-2 baris)",
  "characterCount": ${maxLength},
  "originalLength": ${tpText.length},
  "compressionRatio": "XX%"
}

PENTING:
- Jangan tambahkan teks apapun di luar JSON
- JSON harus valid (gunakan double quotes, escape karakter khusus)
- Setiap hasil HARUS ≤ ${maxLength} karakter
- Jika tidak bisa kompresi, tetap berikan "trimmed" dengan hasil terbaik

MULAI SEKARANG:`;
}

/**
 * Parse trimming response dari AI
 */
interface TrimmingResponse {
  trimmed: string;
  splits?: string[];
  explanation?: string;
  characterCount?: number;
  originalLength?: number;
  compressionRatio?: string;
}

function parseTrimmingResponse(text: string): TrimmingResponse | null {
  try {
    let cleanedText = text.trim();
    
    // Remove markdown code blocks if present
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.slice(7);
    }
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3);
    }
    
    cleanedText = cleanedText.trim();
    
    // Find JSON in text
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }
    
    const parsed = JSON.parse(cleanedText) as TrimmingResponse;
    
    // Validate
    if (!parsed.trimmed || typeof parsed.trimmed !== 'string') {
      console.error('Invalid trimmed value:', parsed.trimmed);
      return null;
    }
    
    // Ensure splits is array
    if (!Array.isArray(parsed.splits)) {
      parsed.splits = [];
    }
    
    return parsed;
  } catch (error) {
    console.error('Failed to parse trimming response:', error);
    console.error('Raw text:', text);
    return null;
  }
}
