import { GoogleGenerativeAI } from '@google/generative-ai';
import { AVAILABLE_MODELS } from './models';
import IORedis from 'ioredis';
import { getPhaseLanguageGuide } from './constants/phase-specific-rules';
import { executeWithContextAwareRetry, RetryStrategy, getRetryPromptModification } from './utils/context-aware-retry';
import { normalizeTPOutput, calculateQualityScore, getImprovementSuggestions } from './utils/output-normalizer';

// API Key rotation manager
const RAW_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(/[,\n\s]+/).filter(Boolean);
if (RAW_KEYS.length === 0) {
  throw new Error('No Gemini API key found. Define GEMINI_API_KEYS or GEMINI_API_KEY in environment variables');
}

class ApiKeyManager {
  private keys: string[] = RAW_KEYS;
  private idx = 0;
  // map key -> bannedUntil timestamp (ms)
  private banned = new Map<string, number>();
  private BAN_DURATION_MS = 2 * 60 * 1000; // 2 minutes

  getNextKey(): string | null {
    const now = Date.now();
    // cleanup expired bans
    for (const [k, until] of Array.from(this.banned.entries())) {
      if (until <= now) this.banned.delete(k);
    }

    const len = this.keys.length;
    for (let i = 0; i < len; i++) {
      this.idx = (this.idx + 1) % len;
      const key = this.keys[this.idx];
      const bannedUntil = this.banned.get(key) || 0;
      if (bannedUntil <= now) return key;
    }
    return null;
  }

  banKey(key: string) {
    const until = Date.now() + this.BAN_DURATION_MS;
    this.banned.set(key, until);
    console.log(`[ApiKeyManager] Banned key until ${new Date(until).toISOString()}`);
  }

  getAllKeys() { return this.keys.slice(); }
}

const apiKeyManager = new ApiKeyManager();

// Redis client (optional). If REDIS_URL not provided, Redis features are skipped and fallback to in-memory bans.
const REDIS_URL = process.env.REDIS_URL || '';
const redis = REDIS_URL ? new IORedis(REDIS_URL) : null;
const KEY_TOKEN_WINDOW_SECONDS = parseInt(process.env.GEMINI_KEY_WINDOW_SECONDS || '60', 10); // window seconds
// Use a sane default (15 RPM) if env not provided. Avoid referencing MAX_REQUESTS_PER_MINUTE
const KEY_TOKEN_CAPACITY = parseInt(process.env.GEMINI_KEY_RPM || '15', 10); // per-key capacity per window
const KEY_BAN_DURATION_MS = parseInt(process.env.GEMINI_KEY_BAN_MS || String(2 * 60 * 1000), 10);

async function reserveKeyToken(key: string): Promise<boolean> {
  if (!redis) {
    // fallback: allow - relying on in-process rate limiter
    return true;
  }

  const tokenKey = `gemini:tokens:${hashKeyShort(key)}`;
  try {
    const count = await redis.incr(tokenKey);
    if (count === 1) {
      await redis.expire(tokenKey, KEY_TOKEN_WINDOW_SECONDS);
    }
    if (count > KEY_TOKEN_CAPACITY) {
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[Redis] reserveKeyToken failed, allowing request as fallback', e);
    return true;
  }
}

async function banKeyShared(key: string) {
  // set a redis key with expiry to indicate banned status across instances
  if (!redis) return;
  try {
    const bkey = `gemini:banned:${hashKeyShort(key)}`;
    await redis.set(bkey, '1', 'PX', KEY_BAN_DURATION_MS);
    console.log(`[Redis] Banned key ${bkey} for ${KEY_BAN_DURATION_MS}ms`);
  } catch (e) {
    console.warn('[Redis] banKeyShared failed', e);
  }
}

async function isKeyBannedShared(key: string): Promise<boolean> {
  if (!redis) return false;
  try {
    const bkey = `gemini:banned:${hashKeyShort(key)}`;
    const exists = await redis.exists(bkey);
    return exists === 1;
  } catch (e) {
    console.warn('[Redis] isKeyBannedShared failed', e);
    return false;
  }
}

async function getKeyRemaining(key: string): Promise<number | null> {
  if (!redis) return null;
  try {
    const tokenKey = `gemini:tokens:${hashKeyShort(key)}`;
    const count = await redis.get(tokenKey);
    const current = count ? parseInt(count, 10) : 0;
    return Math.max(0, KEY_TOKEN_CAPACITY - current);
  } catch (e) {
    return null;
  }
}

function hashKeyShort(key: string) {
  // mask key by simple hash to avoid leaking full key in logs/status
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h << 5) - h + key.charCodeAt(i);
  return `k${Math.abs(h)}`;
}

async function chooseAvailableKey(): Promise<string | null> {
  const keys = apiKeyManager.getAllKeys();
  const len = keys.length;
  const start = Math.floor(Math.random() * len);
  for (let i = 0; i < len; i++) {
    const idx = (start + i) % len;
    const key = keys[idx];
    // check shared ban
    if (await isKeyBannedShared(key)) continue;
    // try reserve token
    const ok = await reserveKeyToken(key);
    if (!ok) continue;
    return key;
  }
  return null;
}

// Re-export AVAILABLE_MODELS for backward compatibility
export { AVAILABLE_MODELS };

// Safety settings - Block none untuk educational content
const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
];

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 15; // Limit to 15 requests per minute

// Rate Limiter Implementation
class RateLimiter {
  private requests: number[] = [];
  
  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove requests older than the window
    this.requests = this.requests.filter(time => now - time < RATE_LIMIT_WINDOW);
    return this.requests.length < MAX_REQUESTS_PER_MINUTE;
  }
  
  recordRequest(): void {
    this.requests.push(Date.now());
  }
  
  getWaitTime(): number {
    if (this.canMakeRequest()) return 0;
    const oldestRequest = Math.min(...this.requests);
    return RATE_LIMIT_WINDOW - (Date.now() - oldestRequest);
  }
  
  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < RATE_LIMIT_WINDOW);
    return Math.max(0, MAX_REQUESTS_PER_MINUTE - this.requests.length);
  }
}

// Request Queue Implementation
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        // Wait for rate limiter
        const waitTime = rateLimiter.getWaitTime();
        if (waitTime > 0) {
          console.log(`[Queue] Waiting ${waitTime}ms for rate limit...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        await fn();
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    this.processing = false;
  }
  
  getQueueSize(): number {
    return this.queue.length;
  }
}

// Quota Monitor
class QuotaMonitor {
  private errorCount = 0;
  private lastError: Date | null = null;
  private quotaExhausted = false;
  private autoResetTimeout: NodeJS.Timeout | null = null;
  
  recordSuccess(): void {
    this.errorCount = 0;
    this.quotaExhausted = false;
    if (this.autoResetTimeout) {
      clearTimeout(this.autoResetTimeout);
      this.autoResetTimeout = null;
    }
  }
  
  recordError(error: any): void {
    this.errorCount++;
    this.lastError = new Date();
    
    const errorMessage = error?.message || '';
    if (errorMessage.includes('quota') || 
        errorMessage.includes('rate limit') ||
        errorMessage.includes('RESOURCE_EXHAUSTED')) {
      this.quotaExhausted = true;
      
      // Auto-reset after 2 minutes
      if (this.autoResetTimeout) {
        clearTimeout(this.autoResetTimeout);
      }
      this.autoResetTimeout = setTimeout(() => {
        console.log('[Quota Monitor] Auto-reset after 2 minutes');
        this.reset();
      }, 120000); // 2 minutes
    }
  }
  
  isQuotaExhausted(): boolean {
    return this.quotaExhausted;
  }
  
  getErrorCount(): number {
    return this.errorCount;
  }
  
  getLastError(): Date | null {
    return this.lastError;
  }
  
  reset(): void {
    this.errorCount = 0;
    this.lastError = null;
    this.quotaExhausted = false;
    if (this.autoResetTimeout) {
      clearTimeout(this.autoResetTimeout);
      this.autoResetTimeout = null;
    }
  }
}

const rateLimiter = new RateLimiter();
const requestQueue = new RequestQueue();
const quotaMonitor = new QuotaMonitor();

/**
 * Retry logic wrapper for Gemini API calls with rate limiting and quota monitoring
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  // Check rate limit
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getWaitTime();
    console.log(`[Rate Limit] Waiting ${Math.ceil(waitTime / 1000)}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  try {
    rateLimiter.recordRequest();
    const result = await fn();
    quotaMonitor.recordSuccess();
    return result;
  } catch (error: any) {
    quotaMonitor.recordError(error);
    
    const errorMessage = error?.message || '';
    const isQuotaError = errorMessage.includes('quota') || 
                         errorMessage.includes('RESOURCE_EXHAUSTED') ||
                         errorMessage.includes('rate limit');
    
    if (isQuotaError) {
      // Don't throw immediately, let fallback models try
      console.log(`[Quota] ${errorMessage}`);
      throw error; // Re-throw to let fallback handle it
    }
    
    if (retries > 0) {
      const backoffDelay = RETRY_DELAY * Math.pow(2, MAX_RETRIES - retries);
      console.log(`[Retry] Attempt ${MAX_RETRIES - retries + 1}/${MAX_RETRIES}, waiting ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return retryWithBackoff(fn, retries - 1);
    }
    throw error;
  }
}

/**
 * Parse JSON response with strict validation
 */
/**
 * ✅ Validate semester structure integrity
 */
function validateSemesterStructure(semester: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!Array.isArray(semester)) {
    errors.push('Semester is not an array');
    return { valid: false, errors };
  }
  
  semester.forEach((chapter, idx) => {
    // Check chapter object
    if (!chapter || typeof chapter !== 'object') {
      errors.push(`Chapter ${idx}: Not an object`);
      return;
    }
    
    // Check chapter name
    if (!chapter.chapter || typeof chapter.chapter !== 'string' || chapter.chapter.trim().length === 0) {
      errors.push(`Chapter ${idx}: Missing or invalid chapter name`);
    }
    
    // Support both old format (tps array) and new format (tp_1, tp_2, tp_3)
    const hasOldFormat = Array.isArray(chapter.tps);
    const hasNewFormat = chapter.tp_1 || chapter.tp_2 || chapter.tp_3;
    
    if (!hasOldFormat && !hasNewFormat) {
      errors.push(`Chapter ${idx} (${chapter.chapter}): No TPs found (neither tps array nor tp_1/tp_2/tp_3)`);
      return;
    }
    
    // Validate old format (tps array)
    if (hasOldFormat) {
      if (chapter.tps.length === 0) {
        errors.push(`Chapter ${idx} (${chapter.chapter}): tps array is empty`);
        return;
      }
      
      chapter.tps.forEach((tp: any, tpIdx: number) => {
        if (typeof tp !== 'string') {
          errors.push(`Chapter ${idx} (${chapter.chapter}), TP ${tpIdx}: Not a string`);
        } else if (tp.trim().length === 0) {
          errors.push(`Chapter ${idx} (${chapter.chapter}), TP ${tpIdx}: Empty string`);
        } else if (tp.length < 20) {
          errors.push(`Chapter ${idx} (${chapter.chapter}), TP ${tpIdx}: Too short (${tp.length} chars)`);
        }
      });
    } 
    // Validate new format (tp_1, tp_2, tp_3)
    else if (hasNewFormat) {
      const tpCount = countTpsInChapter(chapter);
      if (tpCount === 0) {
        errors.push(`Chapter ${idx} (${chapter.chapter}): All tp_X fields are empty`);
        return;
      }
      
      // Check each tp_X field
      [1, 2, 3, 4, 5].forEach((num) => {
        const tpField = `tp_${num}`;
        const tp = chapter[tpField];
        if (tp !== undefined && tp !== null) {
          if (typeof tp !== 'string') {
            errors.push(`Chapter ${idx} (${chapter.chapter}), ${tpField}: Not a string`);
          } else if (tp.trim().length === 0) {
            errors.push(`Chapter ${idx} (${chapter.chapter}), ${tpField}: Empty string`);
          } else if (tp.length < 20) {
            errors.push(`Chapter ${idx} (${chapter.chapter}), ${tpField}: Too short (${tp.length} chars)`);
          }
        }
      });
    }
  });
  
  return { valid: errors.length === 0, errors };
}

// Helper function to count TPs in a chapter (supports both old and new format)
function countTpsInChapter(chapter: any): number {
  if (!chapter) return 0;
  
  // New format: tp_count field or individual tp_1, tp_2, tp_3
  if (chapter.tp_count && typeof chapter.tp_count === 'number') {
    return chapter.tp_count;
  }
  
  // Count individual tp_X fields
  if (chapter.tp_1 || chapter.tp_2 || chapter.tp_3 || chapter.tp_4 || chapter.tp_5) {
    let count = 0;
    if (chapter.tp_1 && typeof chapter.tp_1 === 'string' && chapter.tp_1.trim().length > 0) count++;
    if (chapter.tp_2 && typeof chapter.tp_2 === 'string' && chapter.tp_2.trim().length > 0) count++;
    if (chapter.tp_3 && typeof chapter.tp_3 === 'string' && chapter.tp_3.trim().length > 0) count++;
    if (chapter.tp_4 && typeof chapter.tp_4 === 'string' && chapter.tp_4.trim().length > 0) count++; // <--- TAMBAHKAN
    if (chapter.tp_5 && typeof chapter.tp_5 === 'string' && chapter.tp_5.trim().length > 0) count++; // <--- TAMBAHKAN
    return count;
  }
  
  // Old format: tps array
  if (Array.isArray(chapter.tps)) {
    return chapter.tps.length;
  }
  
  return 0;
}

function parseJSONResponse(text: string): any {
  // Remove markdown code blocks if present
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  
  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error}`);
  }
}

/**
 * Generate Learning Goals (Tujuan Pembelajaran) from text input
 */
export async function generateLearningGoals(
  textContent: string,
  grade: string,
  subject: string,
  cpReference: string,
  modelName?: string,
  maxLength100?: boolean,
  semesterSelection?: string,  // 'both' | 'semester1' | 'semester2'
  materiPokok?: string  // optional specific topics to focus on
): Promise<any> {
  // Add to queue for rate-limited processing
  return requestQueue.add(async () => {
    // Use models from AVAILABLE_MODELS with models/ prefix for API compatibility
    const fallbackModels = modelName 
      ? [`models/${modelName}`] 
      : [
          'models/gemini-2.0-flash',
          'models/gemini-2.5-flash',
          'models/gemini-1.5-flash',
          'models/gemini-1.5-flash-latest',
          'models/gemini-1.5-pro',
          'models/gemini-1.5-pro-latest'
        ];
    
    let lastError: any = null;
    
    const allKeys = apiKeyManager.getAllKeys();
    if (allKeys.length === 0) {
      throw new Error('No Gemini API keys available');
    }

    // Try each fallback model; for each model, try available API keys (rotation + ban on quota errors)
    for (const fallbackModel of fallbackModels) {
      let lastModelError: any = null;
      for (let attempt = 0; attempt < allKeys.length; attempt++) {
        const key = await chooseAvailableKey();
        if (!key) break; // no healthy key available right now

        try {
          const client = new GoogleGenerativeAI(key);
          const model = client.getGenerativeModel({ 
            model: fallbackModel,
            safetySettings: SAFETY_SETTINGS as any
          });
          console.log(`[Gemini] Trying model: ${fallbackModel} with maskedKey=${hashKeyShort(key)}`);
          return await executeGenerateLearningGoals(model, textContent, grade, subject, cpReference, maxLength100, semesterSelection, materiPokok);
        } catch (error: any) {
          lastModelError = error;
          const errorMessage = error?.message || '';
          if (errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('rate limit')) {
            // Ban the key temporarily (both in-memory & shared)
            try { apiKeyManager.banKey(key); } catch (e) { /* ignore */ }
            try { await banKeyShared(key); } catch (e) { /* ignore */ }
            console.log(`[Gemini] Key ${hashKeyShort(key)} caused quota error, banned and trying next key...`);
            continue;
          }
          // Non-quota error -> rethrow
          throw error;
        }
      }
      // If we exit inner loop without a successful attempt, continue to next fallback model
      lastError = lastModelError;
    }
    
    // If all models failed, throw the last error with helpful message
    const errorMsg = lastError?.message || '';
    if (errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(
        '⚠️ Semua model Gemini mencapai quota limit.\n\n' +
        'SOLUSI:\n' +
        '1. Tunggu 1-2 menit untuk rate limit reset\n' +
        '2. Atau buat API key BARU dari project Google BERBEDA di https://aistudio.google.com/apikey\n' +
        '3. Masukkan API key baru ke file .env\n' +
        '4. Restart server: npm run dev\n\n' +
        'Tips: Kurangi jumlah soal yang diminta (misal: 10 PG + 3 Essay) untuk menghemat quota.'
      );
    }
    
    throw new Error(
      `❌ Generate soal gagal. Error: ${errorMsg}. ` +
      'Silakan coba lagi atau hubungi administrator.'
    );
  });
}

// Helper function to iterate TPs from a chapter (supports both formats)
function iterateTpsInChapter(chapter: any, callback: (tp: string, tpIndex: number) => void): void {
  if (!chapter) return;
  
  // Old format: tps array
  if (Array.isArray(chapter.tps)) {
    chapter.tps.forEach((tp: string, idx: number) => {
      callback(tp, idx);
    });
  }
  // New format: tp_1, tp_2, tp_3
  else {
    let idx = 0;
    [1, 2, 3, 4, 5].forEach((num) => {
      const tp = chapter[`tp_${num}`];
      if (tp && typeof tp === 'string' && tp.trim().length > 0) {
        callback(tp, idx);
        idx++;
      }
    });
  }
}

// Helper: Convert new format (tp_1, keranjang_1) to backward-compatible format (tps array)
function convertToBackwardCompatibleFormat(data: any): any {
  console.log('[Converter] Starting conversion...');
  if (!data) {
    console.log('[Converter] Data is null/undefined, returning as-is');
    return data;
  }
  
  const convertChapter = (chapter: any) => {
    console.log(`[Converter] Converting chapter: ${chapter?.chapter}`);
    // Check if already in old format (has tps array)
    if (Array.isArray(chapter.tps)) {
      console.log(`[Converter]   - Already in old format (tps array with ${chapter.tps.length} items)`);
      return chapter;
    }
    
    // Convert new format to old format
    if (chapter.tp_1 || chapter.tp_2 || chapter.tp_3) {
      console.log(`[Converter]   - Converting new format (tp_1/tp_2/tp_3)`);
      const tps: string[] = [];
      if (chapter.tp_1 && typeof chapter.tp_1 === 'string') tps.push(chapter.tp_1);
      if (chapter.tp_2 && typeof chapter.tp_2 === 'string') tps.push(chapter.tp_2);
      if (chapter.tp_3 && typeof chapter.tp_3 === 'string') tps.push(chapter.tp_3);
      if (chapter.tp_4 && typeof chapter.tp_4 === 'string') tps.push(chapter.tp_4); // <--- TAMBAHKAN INI
      if (chapter.tp_5 && typeof chapter.tp_5 === 'string') tps.push(chapter.tp_5); // <--- OPSIONAL: Jaga-jaga
      
      console.log(`[Converter]   - Collected ${tps.length} valid TPs`);
      
      // Keep keranjang metadata for reference but main structure is tps array
      return {
        chapter: chapter.chapter,
        tps: tps.length > 0 ? tps : ['[Error: No valid TPs]'],
        keranjang_metadata: chapter.tp_count ? {
          keranjang_1: chapter.keranjang_1,
          keranjang_2: chapter.keranjang_2,
          keranjang_3: chapter.keranjang_3,
          cakupan_materi_1: chapter.cakupan_materi_1,
          cakupan_materi_2: chapter.cakupan_materi_2,
          cakupan_materi_3: chapter.cakupan_materi_3
        } : undefined
      };
    }
    
    // Already in unknown format, return as-is
    console.log(`[Converter]   - Unknown format, returning as-is`);
    return chapter;
  };
  
  return {
    semester1: (data.semester1 || []).map(convertChapter),
    semester2: (data.semester2 || []).map(convertChapter)
  };
}

/**
 * Execute generate learning goals with given model
 */
async function executeGenerateLearningGoals(
  model: any,
  textContent: string,
  grade: string,
  subject: string,
  cpReference: string,
  maxLength100?: boolean,
  semesterSelection?: string,  // 'both' | 'semester1' | 'semester2'
  materiPokok?: string  // optional specific topics to focus on
): Promise<any> {

  // OPTIMIZATION: Truncate text to prevent token overflow
  // Max 4000 tokens for input text (leaves room for prompt template)
  const truncatedContent = truncateToMaxTokens(textContent, 4000);
  const estimatedInputTokens = estimateTokens(truncatedContent);
  
  console.log(`[Generate TP] Input tokens: ~${estimatedInputTokens}`);
  
  const subjectInfo = subject ? `Mata Pelajaran: ${subject}` : '';

  // Determine grade level for language guidance - FOKUS SD ONLY
  const gradeLower = grade.toLowerCase();
  const gradeLevel = gradeLower.includes('1') || gradeLower.includes('2') || gradeLower.includes('fase a') ? 'FASE_A' :
                     gradeLower.includes('3') || gradeLower.includes('4') || gradeLower.includes('fase b') ? 'FASE_B' : 'FASE_C';

  // ✅ OPTIMIZATION: Load only the specific phase rules needed (reduces prompt by ~40%)
  const phaseRules = getPhaseLanguageGuide(gradeLevel);

  // Add length constraint instruction if maxLength100 is true
  const lengthConstraint = maxLength100 
    ? `\n\n⚠️ BATASAN PANJANG WAJIB (TOGGLE AKTIF - FORMAT RAPOR):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Setiap TP HARUS maksimal 100 karakter (termasuk spasi)
- Format ini untuk keperluan RAPOR, bukan perencanaan pembelajaran harian

📝 STRATEGI PEMOTONGAN BERTAHAP (PRIORITAS DARI ATAS KE BAWAH):

🎯 TAHAP 1: Hilangkan Audience (A)
   "Peserta didik mampu" → "Dapat"
   Hemat: ~20 karakter

🎯 TAHAP 2: Hilangkan Condition (C)
   Hapus detail metode/alat: "setelah mengamati video", "dengan menggunakan kalkulator", dll
   Hemat: ~20-40 karakter

🎯 TAHAP 3: Ringkas Degree (D)
   "dengan ketelitian minimal 80% akurat" → "dengan akurat"
   "sesuai prosedur yang telah ditetapkan" → "sesuai prosedur"
   Hemat: ~10-20 karakter

🎯 TAHAP 4: Ringkas Behavior (B) - JIKA MASIH >100 karakter
   
   A. Gunakan akronim/singkatan umum:
      "sistem tata surya" → "sistem tatasurya"
      "ilmu pengetahuan alam" → "IPA"
   
   B. Fokus satu keterampilan inti:
      "mengidentifikasi dan menjelaskan" → "menjelaskan" (pilih yang utama)
   
   C. Gunakan kosakata lebih padat:
      "memahami cara kerja dari" → "memahami prinsip kerja"
      "berbagai macam jenis" → "jenis"
   
   D. Ringkas objek pembelajaran:
      "proses terjadinya fotosintesis pada tumbuhan hijau" → "proses fotosintesis"
      "komponen-komponen utama sistem pencernaan" → "komponen sistem pencernaan"
   
   E. Hindari kata mubazir:
      "dapat melakukan identifikasi terhadap" → "mengidentifikasi"
      "mampu untuk menjelaskan tentang" → "menjelaskan"

⚠️ JANGAN PERNAH HILANGKAN:
- Kata Kerja Operasional (KKO) - Inti kompetensi
- Objek pembelajaran utama - Apa yang dipelajari
- Standar minimal (D) - Pembeda tingkat kemahiran

💡 CONTOH PEMOTONGAN BERTAHAP:

Awal (150 char): "Peserta didik mampu mengidentifikasi dan menjelaskan tahap-tahap siklus air dalam kehidupan sehari-hari setelah mengamati video dengan ketelitian minimal 80%"

Tahap 1 (130 char): "Dapat mengidentifikasi dan menjelaskan tahap-tahap siklus air dalam kehidupan sehari-hari setelah mengamati video dengan ketelitian minimal 80%"

Tahap 2 (90 char): "Dapat mengidentifikasi dan menjelaskan tahap-tahap siklus air dengan ketelitian minimal 80%"

Tahap 3 (67 char): "Dapat mengidentifikasi dan menjelaskan tahap siklus air dengan akurat"

Tahap 4 (42 char): "Dapat menjelaskan tahap siklus air dengan tepat" ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : `\n\n📐 PANJANG TP (FORMAT LENGKAP ABCD):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- TIDAK ada batasan maksimal karakter (toggle 100 karakter tidak aktif)
- Format ini untuk PERENCANAAN PEMBELAJARAN, bukan untuk rapor
- Fokus pada kelengkapan komponen ABCD, bukan pada panjang kalimat
- Boleh lebih dari 100 karakter jika diperlukan untuk menjelaskan kondisi (C) dan standar (D) dengan jelas

📋 GUNAKAN FORMAT LENGKAP:
"Peserta didik mampu [B: KKO] [objek] [C: kondisi/metode] [D: standar penguasaan]"

💡 CONTOH FORMAT LENGKAP (boleh >100 karakter):
- "Peserta didik mampu membandingkan dua bilangan 1-20 menggunakan simbol > dan < dengan benar"
- "Peserta didik mampu menjelaskan proses fotosintesis berdasarkan pengamatan percobaan dengan runtut dan sistematis"
- "Peserta didik mampu menganalisis hubungan sebab-akibat antara gaya dan gerak benda melalui percobaan sederhana dengan tepat"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  // ✅ Dynamic semester instruction based on user selection
  let semesterInstruction = '';
  let outputFormat = '';
  
  if (semesterSelection === 'semester1') {
    semesterInstruction = `
ATURAN PENTING:
1. ⚠️ SEMUA TP HARUS MASUK KE SEMESTER 1 SAJA - JANGAN pisahkan ke Semester 2
2. ⚠️ BUAT TP SEBANYAK YANG DIPERLUKAN UNTUK COVER SEMUA TOPIK UTAMA
   - 1 TP per topik utama yang ESSENTIAL
   - Jangan ada topik yang terlewat
   - Hindari TP detail/micro atau TP yang redundan
3. Gunakan 3-KERANJANG METHODOLOGY:

   LANGKAH 1: INVENTARISASI TOPIK
   - Pindai semua topik materi, list hanya topik UTAMA
   - Kelompokkan topik serupa jadi 1 item (jangan fragmented)
   
   LANGKAH 2: KLASIFIKASI 3 KERANJANG
   - Keranjang A (Pengetahuan Inti): Konsep/tema utama bab [KKO Level C2-C3]
   - Keranjang B (Teknis & Struktural): Aturan, rumus, kaidah [KKO Level C1-C2]
   - Keranjang C (Aplikasi & Keterampilan): Penerapan, masalah nyata [KKO Level C3-C4]
   
   LANGKAH 3: PERUMUSAN TP (MAKSIMAL 4 TP)
   - TP 1 dari Keranjang A (WAJIB)
   - TP 2 dari Keranjang B (WAJIB)
   - TP 3 dari Keranjang C (OPSIONAL jika tidak ada materi aplikasi)
   - TP 4 dari Keranjang A/B/C (OPSIONAL jika ada aspek penting lainnya)
   
   ⚠️ TIDAK BOLEH buat TP untuk detail micro (contoh: "menyebutkan perasaan Kiki", "menjawab pertanyaan spesifik tentang Mimi")
   ⚠️ HARUS fokus pada BIG PICTURE pembelajaran yang penting

4. Setiap TP harus GENERAL & IMPORTANT, bukan DETAIL & MINOR`
    outputFormat = `
OUTPUT FORMAT (JSON):
Berikan response HANYA dalam format JSON yang valid. Maksimal 5 TP per bab (jika materi pokok sangat padat):
{
  "semester1": [
    {
      "chapter": "Nama Bab/Elemen",
      "tp_count": 2 / 3 / 4 / 5,
      "tp_1": "Peserta didik mampu [GENERAL & IMPORTANT]",
      "keranjang_1": "A / B / C",
      "cakupan_materi_1": "Topik yang dicakup",
      "tp_2": "Peserta didik mampu...",
      "keranjang_2": "A / B / C",
      "cakupan_materi_2": "Topik yang dicakup",
      "tp_3": "Peserta didik mampu... (OPSIONAL)",
      "keranjang_3": "A / B / C",
      "cakupan_materi_3": "Topik yang dicakup (OPSIONAL)",
      "tp_4": "Peserta didik mampu... (OPSIONAL)",
      "keranjang_4": "A / B / C",
      "cakupan_materi_4": "Topik yang dicakup (OPSIONAL)"
    }
  ],
  "semester2": []
}

⚠️ WAJIB PATUHI:
- Maksimal 4 TP per bab (jangan lebih)
- Setiap TP mewakili 1 keranjang (A/B/C)
- Hindari TP redundan atau detail micro`;
  } else if (semesterSelection === 'semester2') {
    semesterInstruction = `
ATURAN PENTING:
1. ⚠️ SEMUA TP HARUS MASUK KE SEMESTER 2 SAJA - JANGAN pisahkan ke Semester 1
2. ⚠️ BUAT TP SEBANYAK YANG DIPERLUKAN UNTUK COVER SEMUA TOPIK UTAMA
   - 1 TP per topik utama yang ESSENTIAL
   - Jangan ada topik yang terlewat
   - Hindari TP detail/micro atau TP yang redundan
3. Gunakan 3-KERANJANG METHODOLOGY:

   LANGKAH 1: INVENTARISASI TOPIK
   - Pindai semua topik materi, list hanya topik UTAMA
   - Kelompokkan topik serupa jadi 1 item (jangan fragmented)
   - 🔴 PRIORITAS UTAMA: Identifikasi UNSUR KEBAHASAAN terlebih dahulu
     * Jika ada topik "Unsur Kebahasaan", "Tanda Baca", "Penggunaan Kata", "Tata Bahasa" → HARUS JADI TP PERTAMA
     * TP 1 selalu untuk unsur kebahasaan jika ada
   
   LANGKAH 2: KLASIFIKASI 3 KERANJANG (SETELAH IDENTIFIKASI KEBAHASAAN)
   - Keranjang A (Pengetahuan Inti): Konsep/tema utama bab [KKO Level C2-C3]
   - Keranjang B (Teknis & Struktural): Aturan, rumus, kaidah [KKO Level C1-C2]
   - Keranjang C (Aplikasi & Keterampilan): Penerapan, masalah nyata [KKO Level C3-C4]
   
   LANGKAH 3: PERUMUSAN TP (MAKSIMAL 4 TP)
   - 🔴 TP 1: UNSUR KEBAHASAAN (JIKA ADA) atau dari Keranjang A
     * Prioritas tertinggi: Unsur Kebahasaan/Tanda Baca/Tata Bahasa
     * Contoh: "Membedakan penggunaan tanda seru", "Mengidentifikasi awalan dan kata depan"
   - TP 2 dari Keranjang A/B/C (topik utama bab lainnya - setelah bahasa)
   - TP 3 dari Keranjang B/C (aspek teknis atau aplikasi)
   - TP 4 dari Keranjang A/B/C (OPSIONAL untuk topik penting lainnya)
   
   ⚠️ TIDAK BOLEH buat TP untuk detail micro (contoh: "menyebutkan perasaan Kiki", "menjawab pertanyaan spesifik tentang Mimi")
   ⚠️ HARUS fokus pada BIG PICTURE pembelajaran yang penting
   ⚠️ JIKA ADA UNSUR KEBAHASAAN → SELALU JADI TP #1, BUKAN NOMOR TERAKHIR!

4. Setiap TP harus GENERAL & IMPORTANT, bukan DETAIL & MINOR`;
    outputFormat = `
⚠️ INSTRUKSI PENTING - WAJIB DIPATUHI:
- BUAT TP SEBANYAK YANG DIPERLUKAN UNTUK COVER SEMUA TOPIK UTAMA
- MINIMUM 2 TP (untuk cover minimal 2 keranjang)
- TIDAK ADA MAKSIMUM jika semua topik penting tercakup
- Prioritas: Coverage semua topik LEBIH PENTING daripada membatasi jumlah TP
- Jika ada 4 TP, pastikan setiap TP dari keranjang berbeda atau aspek penting berbeda
- JANGAN HANYA 1 TP - itu tidak cukup

OUTPUT FORMAT (JSON):
Berikan response HANYA dalam format JSON yang valid. Structure (MAKSIMAL 4 TP):
{
  "semester1": [],
  "semester2": [
    {
      "chapter": "Nama Bab/Elemen",
      "tp_count": 2 / 3 / 4,
      "tp_1": "Peserta didik mampu [GENERAL & IMPORTANT]",
      "keranjang_1": "A / B / C",
      "cakupan_materi_1": "Topik yang dicakup",
      "tp_2": "Peserta didik mampu...",
      "keranjang_2": "A / B / C",
      "cakupan_materi_2": "Topik yang dicakup",
      "tp_3": "Peserta didik mampu... (OPSIONAL)",
      "keranjang_3": "A / B / C",
      "cakupan_materi_3": "Topik yang dicakup (OPSIONAL)",
      "tp_4": "Peserta didik mampu... (OPSIONAL)",
      "keranjang_4": "A / B / C",
      "cakupan_materi_4": "Topik yang dicakup (OPSIONAL)"
    }
  ]
}

⚠️ WAJIB PATUHI:
- Maksimal 4 TP per bab (jangan lebih)
- Setiap TP mewakili 1 keranjang (A/B/C)
- Hindari TP redundan atau detail micro`;
  } else {
    // 'both' - both semesters
    semesterInstruction = `
ATURAN PENTING:
1. ⚠️ PISAHKAN TP ke SEMESTER 1 dan SEMESTER 2 secara SEIMBANG (50:50 jika memungkinkan)
   - Semester 1: Topik dasar/fondasi (Basic & Intermediate)
   - Semester 2: Topik lanjutan/aplikasi (Advanced & Integration)
2. ⚠️ BUAT TP SEBANYAK YANG DIPERLUKAN PER SEMESTER
   - 1 TP per topik utama yang ESSENTIAL
   - Jangan ada topik yang terlewat dari materi
   - Hindari TP detail/micro atau TP yang redundan
   - Fokus pada coverage SEMUA topik penting
3. Gunakan 3-KERANJANG METHODOLOGY untuk MASING-MASING semester:

   LANGKAH 1: INVENTARISASI TOPIK
   - Pindai semua topik materi, list hanya topik UTAMA
   - Kelompokkan topik serupa jadi 1 item (jangan fragmented)
   
   LANGKAH 2: KLASIFIKASI 3 KERANJANG
   - Keranjang A (Pengetahuan Inti): Konsep/tema utama [KKO Level C2-C3]
   - Keranjang B (Teknis & Struktural): Aturan, rumus, kaidah [KKO Level C1-C2]
   - Keranjang C (Aplikasi & Keterampilan): Penerapan, masalah nyata [KKO Level C3-C4]
   
   LANGKAH 3: PERUMUSAN TP (FLEXIBLE BASED ON TOPICS)
   - TP 1 dari Keranjang A (WAJIB)
   - TP 2 dari Keranjang B (WAJIB)
   - TP 3 dari Keranjang C (WAJIB - selalu ada, jika tidak ada aplikasi gunakan konsep lanjutan)
   - TP 4 dari Keranjang A/B/C (WAJIB untuk topik yang kompleks/kaya - pilih aspek penting yang belum tercakup)
   
      
   ⚠️ TIDAK BOLEH buat TP untuk detail micro (contoh: "menyebutkan perasaan Kiki", "menjawab pertanyaan spesifik tentang Mimi")
   ⚠️ HARUS fokus pada BIG PICTURE pembelajaran yang penting

4. Setiap TP harus GENERAL & IMPORTANT, bukan DETAIL & MINOR`;
    outputFormat = `
OUTPUT FORMAT (JSON):
Berikan response HANYA dalam format JSON yang valid. Structure (MAKSIMAL 4 TP per bab per semester):
{
  "semester1": [
    {
      "chapter": "Nama Bab/Elemen",
      "tp_count": 2 / 3 / 4,
      "tp_1": "Peserta didik mampu [GENERAL & IMPORTANT]",
      "keranjang_1": "A / B / C",
      "cakupan_materi_1": "Topik yang dicakup",
      "tp_2": "Peserta didik mampu...",
      "keranjang_2": "A / B / C",
      "cakupan_materi_2": "Topik yang dicakup",
      "tp_3": "Peserta didik mampu... (OPSIONAL)",
      "keranjang_3": "A / B / C",
      "cakupan_materi_3": "Topik yang dicakup (OPSIONAL)",
      "tp_4": "Peserta didik mampu... (OPSIONAL)",
      "keranjang_4": "A / B / C",
      "cakupan_materi_4": "Topik yang dicakup (OPSIONAL)"
    }
  ],
  "semester2": [
    {
      "chapter": "Nama Bab/Elemen",
      "tp_count": 2 / 3 / 4,
      "tp_1": "Peserta didik mampu [GENERAL & IMPORTANT]",
      "keranjang_1": "A / B / C",
      "cakupan_materi_1": "Topik yang dicakup",
      "tp_2": "Peserta didik mampu...",
      "keranjang_2": "A / B / C",
      "cakupan_materi_2": "Topik yang dicakup",
      "tp_3": "Peserta didik mampu... (OPSIONAL)",
      "keranjang_3": "A / B / C",
      "cakupan_materi_3": "Topik yang dicakup (OPSIONAL)",
      "tp_4": "Peserta didik mampu... (OPSIONAL)",
      "keranjang_4": "A / B / C",
      "cakupan_materi_4": "Topik yang dicakup (OPSIONAL)"
    }
  ]
}

⚠️ WAJIB PATUHI:
- Maksimal 4 TP per bab per semester (jangan lebih)
- Setiap TP mewakili 1 keranjang (A/B/C)
- Hindari TP redundan atau detail micro
- Balance 50:50 antara semester 1 dan 2 jika memungkinkan`;
  }

  const prompt = `Kamu adalah seorang ahli kurikulum merdeka Indonesia yang berpengalaman dalam merancang Tujuan Pembelajaran (TP) berkualitas tinggi dengan mempertimbangkan perkembangan kognitif anak. Analisis teks materi pembelajaran berikut dan buatkan TP dengan ketentuan:

${semesterInstruction}
3. TP harus SPESIFIK, TERUKUR, dan sesuai dengan Capaian Pembelajaran (CP)${lengthConstraint}

📋 FORMAT ABCD UNTUK TUJUAN PEMBELAJARAN (WAJIB):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gunakan kerangka ABCD (Robert F. Mager) untuk merumuskan TP yang jelas dan terukur:

🎯 A - AUDIENCE (Khalayak Sasaran):
   → "Peserta didik" atau "Peserta didik kelas [X]"
   
🎯 B - BEHAVIOR (Perilaku/KKO):
   → Gunakan Kata Kerja Operasional (KKO) yang dapat diamati dan diukur
   → Sesuaikan dengan tingkat kognitif ${gradeLevel}
   
🎯 C - CONDITION (Kondisi/Syarat):
   → Jelaskan konteks, situasi, atau bantuan yang diberikan
   → Contoh: "setelah mengamati gambar", "dengan menggunakan alat peraga", 
            "melalui diskusi kelompok", "berdasarkan teks yang dibaca"
   
🎯 D - DEGREE (Derajat/Tingkat Penguasaan):
   → Tentukan standar kinerja yang diharapkan
   → Contoh: "dengan benar", "minimal 80% akurat", "sesuai prosedur", 
            "tanpa kesalahan", "dengan lancar", "minimal 3 contoh"

📌 CONTOH FORMAT LENGKAP ABCD:
   "Peserta didik mampu [B: mengidentifikasi] [objek: jenis-jenis tumbuhan] 
    [C: berdasarkan pengamatan di lingkungan sekitar] [D: minimal 5 jenis dengan benar]"

📌 FORMAT STANDAR (JIKA TIDAK ADA TOGGLE 100 KARAKTER):
   "Peserta didik mampu [B] [objek] [C] [D]"
   
📌 FORMAT RINGKAS (JIKA TOGGLE 100 KARAKTER AKTIF):
   "Peserta didik mampu [B] [objek] [C/D disingkat]"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. Pastikan setiap TP memiliki minimal komponen A-B-C (Audience-Behavior-Condition)
5. Komponen D (Degree) WAJIB disertakan kecuali jika toggle 100 karakter aktif

${phaseRules}

6. 📝 TIPS MERUMUSKAN KOMPONEN ABCD:
   - Komponen C (Condition): Jelaskan metode/media/konteks pembelajaran
     Contoh: "melalui pengamatan gambar", "dengan menggunakan tabel", "setelah membaca teks"
   - Komponen D (Degree): Tentukan kriteria keberhasilan yang spesifik
     Contoh: "dengan benar", "minimal 5 contoh", "sesuai prosedur", "tanpa bantuan"
${subject ? `6. Sesuaikan dengan karakteristik mata pelajaran ${subject} dan jenjang kelas ${grade}` : `6. Sesuaikan dengan jenjang kelas ${grade}`}

MATERI:
Kelas: ${grade}
${subjectInfo}
Referensi CP: ${cpReference}${materiPokok ? `\n📌 FOKUS MATERI POKOK: ${materiPokok}\n   (Prioritaskan SEMUA topik ini dalam pembuatan TP - jangan ada yang terlewat!)` : ''}

TEKS MATERI:
${truncatedContent}

INSTRUKSI KHUSUS PENGELOLAAN MATERI POKOK (WAJIB DIPATUHI):
1. Cek jumlah butir "Materi Pokok" (jika ada). Jika lebih dari 4 topik, Anda WAJIB melakukan PENGGABUNGAN (MERGING).
2. Gabungkan materi-materi kecil yang bersifat **teknis / aturan / unsur pendukung** ke dalam 1 TP yang relevan.
   - Jika Mapel BAHASA: Gabungkan semua **unsur kebahasaan** (tanda baca, ejaan, imbuhan, huruf kapital) menjadi 1 TP.
   - Jika Mapel MATEMATIKA/SAINS: Gabungkan **rumus-rumus kecil**, **sifat-sifat**, atau **klasifikasi sejenis** menjadi 1 TP.
   - Jika Mapel LAIN: Gabungkan topik-topik sub-bab yang satu tema menjadi 1 TP.
3. JANGAN MEMBUANG materi pokok apa pun! Jika slot TP penuh (4 TP), sisipkan materi tersisa ke dalam kalimat TP yang konteksnya paling dekat.

${outputFormat}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 ENHANCED SELF-VALIDATION WITH CHAIN-OF-THOUGHT (WAJIB):

⚠️ CRITICAL: Sebelum output JSON, WAJIB lakukan internal reasoning step-by-step:

╔═══════════════════════════════════════════════════════════════╗
║ STEP 1: CONTENT ANALYSIS                                      ║
╚═══════════════════════════════════════════════════════════════╝
Q1: Berapa banyak topik UTAMA dalam materi?
   → Internal: [List topik, hitung jumlah]
   → Decision: Jika >4 topik → perlu merge topik sejenis

Q2: Apakah ada "Unsur Kebahasaan" atau topik teknis?
   → Internal: [Cek keywords: tanda baca, ejaan, aturan, rumus]
   → Decision: Jika YA → HARUS jadi TP #1 (Keranjang B)

Q3: Materi ini cocok untuk semester berapa?${semesterSelection === 'both' ? `
   → Internal: [Identifikasi materi fundamental vs lanjutan]
   → Decision: Fundamental → Sem1, Lanjutan → Sem2` : `
   → Decision: Semua masuk ${semesterSelection === 'semester1' ? 'Semester 1' : 'Semester 2'}`}

╔═══════════════════════════════════════════════════════════════╗
║ STEP 2: TP FORMULATION (ABCD Check)                          ║
╚═══════════════════════════════════════════════════════════════╝
Untuk SETIAP TP yang akan dibuat:

✓ [A] AUDIENCE: "Peserta didik mampu..." → PRESENT?
✓ [B] BEHAVIOR: KKO ${gradeLevel} valid → CHECKED?
   → ${gradeLevel === 'FASE_A' ? 'menyebutkan, menunjukkan, menghitung' : gradeLevel === 'FASE_B' ? 'menjelaskan, menerapkan, mengidentifikasi' : 'menganalisis, menyimpulkan, memecahkan'}
✓ [C] CONDITION: Metode/media pembelajaran → ADDED?
   → Contoh: "melalui pengamatan", "dengan menggunakan tabel"
✓ [D] DEGREE: Standar keberhasilan → SPECIFIED?
   → Contoh: "dengan benar", "minimal 5", "sesuai prosedur"

${maxLength100 ? '✓ [LENGTH] Max 100 karakter → COUNTED?' : '✓ [LENGTH] Max 20 kata → COUNTED?'}

╔═══════════════════════════════════════════════════════════════╗
║ STEP 3: COVERAGE VERIFICATION                                 ║
╚═══════════════════════════════════════════════════════════════╝${materiPokok ? `
Q: Apakah SEMUA topik Materi Pokok tercakup?
   → Internal: [${materiPokok.split(',').slice(0, 3).join(', ')}...]
   → Cross-check: Setiap topik punya TP? → YES/NO
   → Action: Jika NO → tambah TP atau merge ke TP existing` : `
Q: Apakah 3 keranjang (A/B/C) terwakili?
   → Internal: [A: Konsep inti, B: Teknis/aturan, C: Aplikasi]
   → Check: Min 1 TP per keranjang → YES/NO`}

╔═══════════════════════════════════════════════════════════════╗
║ STEP 4: QUALITY ASSURANCE                                     ║
╚═══════════════════════════════════════════════════════════════╝
Q1: Apakah TP terlalu DETAIL/MICRO?
   → BAD: "Menyebutkan perasaan tokoh Kiki" ❌
   → GOOD: "Mengidentifikasi perasaan tokoh dalam cerita" ✅

Q2: Apakah TP menggunakan kata FORBIDDEN?
   → ${gradeLevel === 'FASE_A' ? 'regulasi, esensial, paradigma' : gradeLevel === 'FASE_B' ? 'signifikan, elaborasi' : 'epistemologi, sintesis teori'} → NOT PRESENT?

Q3: Apakah JSON structure VALID?
   → chapter: string, tp_count: number, tp_N: string, keranjang_N: string
   → All required fields → PRESENT?

╔═══════════════════════════════════════════════════════════════╗
║ STEP 5: FINAL OUTPUT DECISION                                 ║
╚═══════════════════════════════════════════════════════════════╝
Jika SEMUA checks PASSED → OUTPUT JSON
Jika ADA yang FAILED → REVISE internal dulu, JANGAN output

⚠️ INGAT: Output HANYA JSON valid tanpa markdown, tanpa penjelasan.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  // Use context-aware retry strategy
  return executeWithContextAwareRetry(async (strategy: RetryStrategy, attemptNumber: number) => {
    // Add strategy-specific modifications to prompt for retries
    let finalPrompt = prompt;
    if (strategy !== RetryStrategy.NORMAL) {
      const failureTypeGuide = strategy === RetryStrategy.FOCUS_KKO 
        ? 'kko' 
        : 'format';
      finalPrompt = prompt + getRetryPromptModification(strategy, failureTypeGuide, attemptNumber);
    }

    const result = await model.generateContent(finalPrompt);
    const response = await result.response;

    const text = response.text();
    
    try {
      const parsed = parseJSONResponse(text);
      
      // ✅ VALIDATION: Check semester structure based on selection
      // First validate structure integrity
      const validateSem1 = validateSemesterStructure(parsed.semester1 || []);
      const validateSem2 = validateSemesterStructure(parsed.semester2 || []);
      
      // Log structure issues
      if (!validateSem1.valid && parsed.semester1?.length > 0) {
        console.warn('[TP Validation] Semester 1 structure issues:', validateSem1.errors);
      }
      if (!validateSem2.valid && parsed.semester2?.length > 0) {
        console.warn('[TP Validation] Semester 2 structure issues:', validateSem2.errors);
      }
      
      // Check based on selection mode
      if (semesterSelection === 'semester1') {
        if (!validateSem1.valid || !parsed.semester1 || parsed.semester1.length === 0) {
          console.error('[TP Validation CRITICAL] Semester 1 invalid - expected valid data');
          throw new Error('EMPTY_SEMESTER_1: AI failed to generate valid learning objectives for Semester 1.');
        }
        const count = parsed.semester1.reduce((sum: number, ch: any) => sum + countTpsInChapter(ch), 0);
        console.log(`[TP Validation] Semester 1 selected - ${count} TPs generated`);
        parsed.semester2 = [];  // Explicitly empty semester2
      } else if (semesterSelection === 'semester2') {
        if (!validateSem2.valid || !parsed.semester2 || parsed.semester2.length === 0) {
          console.error('[TP Validation CRITICAL] Semester 2 invalid - expected valid data');
          throw new Error('EMPTY_SEMESTER_2: AI failed to generate valid learning objectives for Semester 2.');
        }
        const count = parsed.semester2.reduce((sum: number, ch: any) => sum + countTpsInChapter(ch), 0);
        console.log(`[TP Validation] Semester 2 selected - ${count} TPs generated`);
        parsed.semester1 = [];  // Explicitly empty semester1
      } else {
        // 'both' - both semesters should have data
        if (!validateSem1.valid || !parsed.semester1 || parsed.semester1.length === 0) {
          console.error('[TP Validation CRITICAL] Semester 1 invalid');
          throw new Error('EMPTY_SEMESTER_1: AI failed to generate valid learning objectives for Semester 1.');
        }
        if (!validateSem2.valid || !parsed.semester2 || parsed.semester2.length === 0) {
          console.error('[TP Validation CRITICAL] Semester 2 invalid');
          throw new Error('EMPTY_SEMESTER_2: AI failed to generate valid learning objectives for Semester 2.');
        }
      }
      
      // VALIDATION: Calculate semester distribution (only for 'both' selection)
      const sem1Count = parsed.semester1.reduce((sum: number, ch: any) => sum + countTpsInChapter(ch), 0);
      const sem2Count = parsed.semester2.reduce((sum: number, ch: any) => sum + countTpsInChapter(ch), 0);
      const totalCount = sem1Count + sem2Count;
      
      if (semesterSelection === 'both' && totalCount > 0) {
        const sem1Percent = ((sem1Count / totalCount) * 100).toFixed(1);
        const sem2Percent = ((sem2Count / totalCount) * 100).toFixed(1);
        
        console.log(`[TP Validation] Semester distribution - Sem1: ${sem1Count} TPs (${sem1Percent}%), Sem2: ${sem2Count} TPs (${sem2Percent}%)`);
        
        // Optional: Warn if imbalance is extreme (>60:40)
        const balance = Math.abs(sem1Count - sem2Count) / Math.max(sem1Count, sem2Count);
        if (balance > 0.5) {
          console.warn(`[TP Validation] WARNING - Imbalance detected: ${sem1Count} vs ${sem2Count} (${(balance*100).toFixed(1)}% difference)`);
        }
      }
      
      // Post-processing validation for generated TP with Bloom Taxonomy KKO check
      console.log(`[TP Validation] Checking ${gradeLevel} compliance...`);
      
      // Define KKO rules with context-aware validation
      const kkoRules: any = {
        'FASE_A': {
          appropriate: ['menyebutkan', 'menunjukkan', 'menghitung', 'menceritakan', 'meniru', 'mengelompokkan', 'mencontohkan', 'membandingkan'],
          // KKO yang perlu dicek konteksnya - boleh dipakai jika konteks sederhana
          contextSensitive: {
            'membandingkan': ['dua bilangan', 'besar kecil', 'panjang pendek', 'banyak sedikit'],
            'mengidentifikasi': 'GANTI dengan: menunjukkan, menyebutkan',
            'menganalisis': 'GANTI dengan: melihat perbedaan, membandingkan',
            'mendeskripsikan': 'GANTI dengan: menceritakan'
          },
          forbiddenWords: [
            'regulasi', 'esensial', 'kondusif', 'potensi', 'konflik', 'efisiensi',
            'edukasi', 'kompetensi', 'signifikan', 'harmonisan', 'akademik',
            'fundamental', 'optimal', 'relevan', 'substansial', 'eksplisit', 'implisit',
            'implikasi', 'sintesis', 'elaborasi', 'paradigma', 'konseptual'
          ],
          maxWords: 15
        },
        'FASE_B': {
          appropriate: ['menjelaskan', 'menghitung', 'membandingkan', 'mengelompokkan', 'menerapkan', 'mempraktikkan', 'mengidentifikasi', 'mengklasifikasikan'],
          contextSensitive: {
            'menganalisis': ['pola sederhana', 'data tabel', 'gambar', 'grafik sederhana'],
            'mengevaluasi': 'GANTI dengan: memilih yang tepat, menentukan yang benar',
            'merancang': ['percobaan sederhana'] // OK jika konteks sederhana
          },
          forbiddenWords: ['regulasi', 'esensial', 'kondusif', 'signifikan', 'paradigma', 'sintesis', 'elaborasi', 'konseptual'],
          maxWords: 18
        },
        'FASE_C': {
          appropriate: ['menganalisis', 'membandingkan', 'mengkategorikan', 'menyimpulkan', 'memecahkan', 'mengidentifikasi', 'menghubungkan', 'menerapkan'],
          contextSensitive: {
            'mengevaluasi': ['solusi sederhana', 'hasil percobaan'], // Hindari evaluasi teori abstrak
            'merancang': ['percobaan', 'model sederhana'], // Hindari merancang sistem kompleks
            'mensintesis': 'GANTI dengan: menyimpulkan, menggabungkan informasi'
          },
          forbiddenWords: ['paradigma', 'sintesis teori', 'elaborasi teori', 'epistemologi'],
          maxWords: 20
        }
      };
      
      const rules = kkoRules[gradeLevel];
      
      if (rules) {
        const validateTP = (tp: string, semester: number, chapterName: string) => {
          const tpLower = tp.toLowerCase();
          const wordCount = tp.split(' ').length;
          
          // Check ABCD format components
          const hasAudience = tpLower.includes('peserta didik');
          const hasBehavior = rules.appropriate.some((kko: string) => tpLower.includes(kko)) ||
                             (rules.contextSensitive && Object.keys(rules.contextSensitive).some((kko: string) => tpLower.includes(kko)));
          
          if (!hasAudience) {
            console.warn(`[TP Validation - ABCD] Semester ${semester} - "${chapterName}": Komponen A (Audience) tidak ditemukan`);
            console.warn(`[TP Validation - ABCD] TP harus diawali dengan "Peserta didik mampu..."`);
            console.warn(`[TP Validation] TP: ${tp}`);
          }
          
          if (!hasBehavior) {
            console.warn(`[TP Validation - ABCD] Semester ${semester} - "${chapterName}": Komponen B (Behavior/KKO) tidak jelas`);
            console.warn(`[TP Validation - ABCD] Gunakan KKO yang sesuai ${gradeLevel}: ${rules.appropriate.slice(0, 5).join(', ')}, dll`);
            console.warn(`[TP Validation] TP: ${tp}`);
          }
          
          // Check word count only if NOT using maxLength100 OR if toggle is active
          if (!maxLength100 && wordCount > 25) {
            console.info(`[TP Info] Semester ${semester} - "${chapterName}": TP cukup panjang (${wordCount} kata) - OK jika lengkap ABCD`);
          }
          
          // Check context-sensitive KKO (KKO yang perlu dicek konteksnya)
          if (rules.contextSensitive) {
            Object.keys(rules.contextSensitive).forEach((kko: string) => {
              if (tpLower.includes(kko)) {
                const contextInfo = rules.contextSensitive[kko];
                
                if (typeof contextInfo === 'string') {
                  // KKO ini sebaiknya diganti
                  console.warn(`[TP Validation - KKO] Semester ${semester} - "${chapterName}": KKO "${kko}" terlalu tinggi untuk ${gradeLevel}`);
                  console.warn(`[TP Validation - KKO] Saran: ${contextInfo}`);
                  console.warn(`[TP Validation] TP: ${tp}`);
                } else if (Array.isArray(contextInfo)) {
                  // KKO boleh dipakai jika konteks sesuai
                  const hasValidContext = contextInfo.some(ctx => tpLower.includes(ctx));
                  if (!hasValidContext) {
                    console.warn(`[TP Validation - KKO] Semester ${semester} - "${chapterName}": KKO "${kko}" perlu konteks lebih sederhana untuk ${gradeLevel}`);
                    console.warn(`[TP Validation - KKO] Contoh konteks yang sesuai: ${contextInfo.join(', ')}`);
                    console.warn(`[TP Validation] TP: ${tp}`);
                  }
                }
              }
            });
          }
          
          // Check forbidden words
          const foundForbidden = rules.forbiddenWords.filter((word: string) => tpLower.includes(word));
          if (foundForbidden.length > 0) {
            console.warn(`[TP Validation] Semester ${semester} - "${chapterName}": Mengandung kata kompleks: ${foundForbidden.join(', ')}`);
            console.warn(`[TP Validation] TP: ${tp}`);
          }
          
          // Check if maxLength100 is enabled
          if (maxLength100 && tp.length > 100) {
            console.warn(`[TP Validation] Semester ${semester} - "${chapterName}": TP melebihi 100 karakter (${tp.length} karakter)`);
            console.warn(`[TP Validation] TP: ${tp}`);
          }
        };
        
        // Validate all TPs
        if (parsed.semester1) {
          parsed.semester1.forEach((chapter: any) => {
            iterateTpsInChapter(chapter, (tp: string) => {
              validateTP(tp, 1, chapter.chapter);
            });
          });
        }
        
        if (parsed.semester2) {
          parsed.semester2.forEach((chapter: any) => {
            iterateTpsInChapter(chapter, (tp: string) => {
              validateTP(tp, 2, chapter.chapter);
            });
          });
        }
      }
      
      // Validation for maxLength100 for all grade levels
      if (maxLength100) {
        console.log('[TP Validation] Checking 100-character limit...');
        let violationCount = 0;
        
        const checkLength = (tp: string, semester: number, chapterName: string) => {
          if (tp.length > 100) {
            violationCount++;
            console.warn(`[TP Validation] Semester ${semester} - "${chapterName}": ${tp.length} karakter (limit: 100)`);
            console.warn(`[TP Validation] TP: ${tp.substring(0, 100)}...`);
          }
        };
        
        if (parsed.semester1) {
          parsed.semester1.forEach((chapter: any) => {
            iterateTpsInChapter(chapter, (tp: string) => checkLength(tp, 1, chapter.chapter));
          });
        }
        
        if (parsed.semester2) {
          parsed.semester2.forEach((chapter: any) => {
            iterateTpsInChapter(chapter, (tp: string) => checkLength(tp, 2, chapter.chapter));
          });
        }
        
        if (violationCount > 0) {
          console.warn(`[TP Validation] Total ${violationCount} TP melebihi 100 karakter`);
        }
      }
      
      // ✅ NEW: Apply output normalization for consistency and quality
      console.log('[TP Generation] Normalizing output...');
      const normalizationResult = normalizeTPOutput(parsed, gradeLevel, maxLength100);
      
      if (normalizationResult.warnings.length > 0) {
        console.warn('[TP Normalization] Warnings:', normalizationResult.warnings.slice(0, 5));
      }
      
      if (normalizationResult.corrections.length > 0) {
        console.log('[TP Normalization] Applied corrections:', normalizationResult.corrections.slice(0, 5));
      }
      
      const qualityScore = calculateQualityScore(normalizationResult);
      console.log(`[TP Quality] Score: ${qualityScore}/100`);
      
      const suggestions = getImprovementSuggestions(normalizationResult);
      if (suggestions.length > 0) {
        console.log('[TP Suggestions]', suggestions[0]);
      }
      
      console.log('[TP Generation] Converting to backward-compatible format...');
      const converted = convertToBackwardCompatibleFormat(normalizationResult.normalized);
      console.log('[TP Generation] Conversion successful');
      return converted;
    } catch (parseError: any) {
      // ✅ ENHANCED RETRY: With limit and graceful fallback
      const isEmptySemesterError = parseError.message?.includes('EMPTY_SEMESTER');
      const isStructureError = parseError.message?.includes('structure') || parseError.message?.includes('invalid');
      
      const MAX_RETRIES = 2;
      let retryAttempt = 0;
      
      while (retryAttempt < MAX_RETRIES) {
        try {
          retryAttempt++;
          console.warn(`[TP Generation] Retry attempt ${retryAttempt}/${MAX_RETRIES}...`);
          
          // Enhanced prompt with stronger instructions
          let retryPrompt = prompt;
          if (isEmptySemesterError && retryAttempt === 1) {
            retryPrompt = `${prompt}\n\n⚠️ CRITICAL ERROR - RETRY REQUIRED ⚠️:
Sebelumnya output kosong di salah satu semester!

✅ WAJIB PERBAIKI:
1. KEDUA semester HARUS punya data - jangan kosong!
2. Semester 1 minimal 2 bab dengan TP
3. Semester 2 minimal 2 bab dengan TP
4. Distribusi 50:50 jika memungkinkan

Contoh struktur yang BENAR:
{
  "semester1": [
    {"chapter": "Bab 1", "tps": ["TP 1", "TP 2"]},
    {"chapter": "Bab 2", "tps": ["TP 3"]}
  ],
  "semester2": [
    {"chapter": "Bab 3", "tps": ["TP 4", "TP 5"]},
    {"chapter": "Bab 4", "tps": ["TP 6"]}
  ]
}

JANGAN output struktur seperti ini (SALAH):
{"semester1": [...], "semester2": []}  ← Semester 2 KOSONG!
{"semester1": [], "semester2": [...]}  ← Semester 1 KOSONG!`;
          } else if (isStructureError && retryAttempt === 1) {
            retryPrompt = `${prompt}\n\n⚠️ STRUCTURE ERROR - Setiap chapter HARUS memiliki:
1. "chapter": string (nama bab)
2. "tps": array of strings (minimal 1 TP per bab)

Contoh BENAR:
{"chapter": "Bab 1", "tps": ["TP 1", "TP 2"]}

Contoh SALAH:
{"chapter": "Bab 1", "tps": "TP 1"}  ← tps HARUS array!
{"chapter": "Bab 1"}  ← tps MISSING!`;
          } else {
            retryPrompt = `${prompt}\n\nPERINGATAN: Response sebelumnya gagal. Pastikan:
1. Output adalah JSON valid murni
2. Tidak ada markdown code blocks
3. Mulai dengan { dan akhiri dengan }
4. Setiap chapter punya array tps dengan string TP`;
          }
          
          const retryResult = await model.generateContent(retryPrompt);
          const retryResponse = await retryResult.response;
          const retryText = retryResponse.text();
          
          // Parse retry response
          const retryParsed = parseJSONResponse(retryText);
          
          // ✅ NEW: Validate structure
          const validateSem1 = validateSemesterStructure(retryParsed.semester1 || []);
          const validateSem2 = validateSemesterStructure(retryParsed.semester2 || []);
          
          if (!validateSem1.valid) {
            console.warn(`[TP Validation] Semester 1 structure errors:`, validateSem1.errors);
          }
          if (!validateSem2.valid) {
            console.warn(`[TP Validation] Semester 2 structure errors:`, validateSem2.errors);
          }
          
          // ✅ Graceful Fallback: Return partial result instead of failing
          if (semesterSelection === 'semester1') {
            if (validateSem1.valid && retryParsed.semester1?.length > 0) {
              console.log('[TP Generation] Retry successful - semester1 populated');
              retryParsed.semester2 = [];  // Explicitly empty
              return convertToBackwardCompatibleFormat(retryParsed);
            }
          } else if (semesterSelection === 'semester2') {
            if (validateSem2.valid && retryParsed.semester2?.length > 0) {
              console.log('[TP Generation] Retry successful - semester2 populated');
              retryParsed.semester1 = [];  // Explicitly empty
              return convertToBackwardCompatibleFormat(retryParsed);
            }
          } else {
            // 'both' mode
            if (validateSem1.valid && validateSem2.valid && retryParsed.semester1?.length > 0 && retryParsed.semester2?.length > 0) {
              console.log('[TP Generation] Retry successful - both semesters populated');
              return retryParsed;
            }
            // Graceful fallback: Return what we have if at least one semester is valid
            if ((validateSem1.valid && retryParsed.semester1?.length > 0) || (validateSem2.valid && retryParsed.semester2?.length > 0)) {
              console.warn('[TP Generation] ⚠️ Partial success: Returning available semester(s)');
              if (!validateSem1.valid) retryParsed.semester1 = [];
              if (!validateSem2.valid) retryParsed.semester2 = [];
              return convertToBackwardCompatibleFormat(retryParsed);
            }
          }
          
          // If validation still fails, continue to next retry
          console.warn(`[TP Generation] Retry ${retryAttempt} failed validation, ${MAX_RETRIES - retryAttempt} attempts remaining...`);
          
        } catch (retryError: any) {
          console.warn(`[TP Generation] Retry ${retryAttempt} error:`, retryError.message);
          
          // If last retry, apply graceful fallback or throw
          if (retryAttempt >= MAX_RETRIES) {
            console.error('[TP Generation] ❌ Max retries exceeded');
            throw retryError;
          }
        }
      }
      
      // Should not reach here, but as safety net
      throw new Error('Failed to generate valid TP structure after all retry attempts');

    }
  });
}

/**
 * Generate questions from Learning Goals
 */
export async function generateQuestions(
  learningGoals: string[],
  questionConfig: {
    multipleChoice: { count: number; weight: number };
    essay: { count: number; weight: number };
    difficulty?: 'mudah' | 'sedang' | 'sulit';
    optionsCount?: 3 | 4 | 5;
    distractorQuality?: 'low' | 'medium' | 'high';
    includeImage?: boolean;
    modelName?: string;
    useDistribution?: boolean;
    difficultyDistribution?: {
      pg: {
        mudah: number;
        sedang: number;
        sulit: number;
      };
      isian: {
        mudah: number;
        sedang: number;
        sulit: number;
      };
      uraian: {
        mudah: number;
        sedang: number;
        sulit: number;
      };
    };
    uraianCount?: number;
    uraianWeight?: number;
  }
): Promise<any> {
  // Add to queue for rate-limited processing
  return requestQueue.add(async () => {
    // Use models from AVAILABLE_MODELS with models/ prefix for API compatibility
    const fallbackModels = questionConfig.modelName 
      ? [`models/${questionConfig.modelName}`] 
      : [
          'models/gemini-2.0-flash',
          'models/gemini-2.5-flash',
          'models/gemini-1.5-flash',
          'models/gemini-1.5-flash-latest',
          'models/gemini-1.5-pro',
          'models/gemini-1.5-pro-latest'
        ];
    
    let lastError: any = null;
    
    const allKeys = apiKeyManager.getAllKeys();
    if (allKeys.length === 0) {
      throw new Error('No Gemini API keys available');
    }

    for (let i = 0; i < fallbackModels.length; i++) {
      const fallbackModel = fallbackModels[i];
      let lastModelError: any = null;

      for (let attempt = 0; attempt < allKeys.length; attempt++) {
        const key = await chooseAvailableKey();
        if (!key) break;

        try {
          const client = new GoogleGenerativeAI(key);
          const model = client.getGenerativeModel({ 
            model: fallbackModel,
            safetySettings: SAFETY_SETTINGS as any
          });
          console.log(`[Gemini] Trying model ${i + 1}/${fallbackModels.length}: ${fallbackModel} with maskedKey=${hashKeyShort(key)}`);
          return await executeGenerateQuestions(model, learningGoals, questionConfig);
        } catch (error: any) {
          lastModelError = error;
          const errorMessage = error?.message || '';
          if (errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('rate limit')) {
            try { apiKeyManager.banKey(key); } catch (e) { /* ignore */ }
            try { await banKeyShared(key); } catch (e) { /* ignore */ }
            console.log(`[Gemini] Key ${hashKeyShort(key)} caused quota error for model ${fallbackModel}, banned and trying next key`);
            // wait small time before next key attempt
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          } else {
            throw error;
          }
        }
      }

      lastError = lastModelError;
      // If not successful with any key for this model, try next model
      if (i < fallbackModels.length - 1) {
        const waitTime = 2000; // 2 seconds
        console.log(`[Gemini] Waiting ${waitTime}ms before trying next model...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    }
    
    throw new Error(
      `❌ Semua model Gemini gagal. Error: ${lastError?.message}. ` +
      'Silakan coba lagi nanti atau hubungi administrator.'
    );
  });
}

/**
 * Execute generate questions with given model
 */
async function executeGenerateQuestions(
  model: any,
  learningGoals: string[],
  questionConfig: {
    multipleChoice: { count: number; weight: number };
    essay: { count: number; weight: number };
    difficulty?: 'mudah' | 'sedang' | 'sulit';
    optionsCount?: 3 | 4 | 5;
    distractorQuality?: 'low' | 'medium' | 'high';
    includeImage?: boolean;
    useDistribution?: boolean;
    difficultyDistribution?: {
      pg: {
        mudah: number;
        sedang: number;
        sulit: number;
      };
      isian: {
        mudah: number;
        sedang: number;
        sulit: number;
      };
      uraian: {
        mudah: number;
        sedang: number;
        sulit: number;
      };
    };
    uraianCount?: number;
    uraianWeight?: number;
  }
): Promise<any> {

  const difficulty = questionConfig.difficulty || 'sedang';
  const optionsCount = questionConfig.optionsCount || 4;
  const distractorQuality = questionConfig.distractorQuality || 'medium';
  const useDistribution = questionConfig.useDistribution || false;
  const difficultyDistribution = questionConfig.difficultyDistribution;
  const questionType = (questionConfig as any).questionType || 'regular'; // 'isian' or 'uraian' or 'regular'
  const options = optionsCount === 5 ? ['A', 'B', 'C', 'D', 'E'] : 
                  optionsCount === 4 ? ['A', 'B', 'C', 'D'] : 
                  ['A', 'B', 'C'];

  // STRICT LEVEL MAPPING - Agar AI tidak berimajinasi
  const strictLevel = difficulty === 'mudah' 
    ? 'MUDAH (C1-C2: Hafalan/Faktual)' 
    : difficulty === 'sedang' 
    ? 'SEDANG (C3: Aplikasi Prosedural - DILARANG MEMINTA ALASAN/ANALISIS)' 
    : 'SULIT (C4-C6: HOTS/Analisis & Evaluasi)';

  const difficultyGuide = {
    mudah: 'Soal bersifat pemahaman dasar, mengingat fakta, dan definisi sederhana (C1-C2)',
    sedang: 'Soal memerlukan penerapan prosedur/rumus standar, fokus pada "HOW" bukan "WHY" (C3)',
    sulit: 'Soal memerlukan analisis tingkat tinggi, evaluasi, sintesis, dan pemecahan masalah kompleks (C4-C6)'
  };

  const distractorGuide = {
    low: 'Pengecoh boleh cukup berbeda dari jawaban benar, fokus pada kesalahan umum yang jelas',
    medium: 'Pengecoh harus mirip dengan jawaban benar dalam struktur, gunakan kesalahan prosedural umum',
    high: 'Pengecoh harus sangat plausible dan sulit dibedakan, gunakan common misconceptions, panjang semua opsi setara'
  };

  const includeImage = questionConfig.includeImage || false;

  // Detect grade level from learning goals - FOKUS SD ONLY
  const tpText = learningGoals.join(' ').toLowerCase();
  const gradeLevel = tpText.includes('kelas 1') || tpText.includes('kelas 2') || tpText.includes('fase a') ? 'FASE_A' :
                     tpText.includes('kelas 3') || tpText.includes('kelas 4') || tpText.includes('fase b') ? 'FASE_B' : 'FASE_C';

  const languageGuide: any = {
    'FASE_A': {
      maxWords: 10,
      vocabulary: 'sangat sederhana, konkret, dan familiar (hewan, buah, warna, angka 1-20, kegiatan sehari-hari)',
      sentence: 'sangat pendek (5-10 kata), satu kalimat tunggal sederhana',
      example: 'Andi punya 3 apel. Budi memberi 2 apel lagi. Berapa apel Andi sekarang?',
      badExample: 'Mengapa kepatuhan regulasi di lingkungan sekolah esensial bagi terciptanya kondisi pembelajaran yang kondusif?',
      avoid: 'istilah abstrak (regulasi, esensial, kondusif, potensi, efisiensi), kalimat majemuk, angka >50, pecahan, kata-kata formal/akademis'
    },
    'FASE_B': {
      maxWords: 15,
      vocabulary: 'sederhana tapi bisa konseptual (pecahan sederhana, ratusan, konsep dasar sains)',
      sentence: 'pendek-menengah (10-15 kata), boleh kalimat majemuk sederhana dengan 1 konjungsi',
      example: 'Ibu membeli 1/2 kg gula dan 1/4 kg tepung. Berapa kg total belanjaan ibu?',
      avoid: 'istilah ilmiah rumit, perhitungan ribuan, teori kompleks'
    },
    'FASE_C': {
      maxWords: 18,
      vocabulary: 'menengah, dengan istilah ilmiah dasar SD (fotosintesis, peredaran darah, pecahan desimal, geometri)',
      sentence: 'menengah (12-18 kata), dapat menggunakan klausa majemuk dengan konjungsi standar',
      example: 'Jelaskan proses fotosintesis dan sebutkan faktor yang mempengaruhi pertumbuhan tanaman!',
      avoid: 'jargon tingkat SMP/SMA, konsep abstrak kompleks, matematika lanjut'
    }
  };

  const guide = languageGuide[gradeLevel] || languageGuide['FASE_B'];

  // Handle difficulty distribution if enabled
  if (useDistribution && difficultyDistribution) {
    console.log('[Generate] Using difficulty distribution:', difficultyDistribution);
    
    // Generate questions for each difficulty level separately and merge
    const allMultipleChoice: any[] = [];
    const allEssay: any[] = [];
    let mcQuestionNumber = 1;
    let essayQuestionNumber = 1;
    
    const difficulties: Array<'mudah' | 'sedang' | 'sulit'> = ['mudah', 'sedang', 'sulit'];
    
    // Generate PG questions with distribution
    for (const diff of difficulties) {
      const pgCount = difficultyDistribution.pg[diff];
      if (pgCount <= 0) continue;
      
      console.log(`[Generate] Generating ${pgCount} ${diff} PG questions...`);
      
      // Recursive call with specific difficulty and count
      const subConfig = {
        ...questionConfig,
        multipleChoice: { count: pgCount, weight: questionConfig.multipleChoice.weight },
        essay: { count: 0, weight: 0 },
        difficulty: diff,
        useDistribution: false, // Disable distribution for recursive call
      };
      
      const subResult = await executeGenerateQuestions(model, learningGoals, subConfig);
      
      // Renumber questions and merge
      subResult.multipleChoice.forEach((q: any) => {
        allMultipleChoice.push({
          ...q,
          questionNumber: mcQuestionNumber++,
          difficultyLevel: diff, // Tag difficulty
        });
      });
    }
    
    // Generate Isian questions with distribution
    for (const diff of difficulties) {
      const isianCount = difficultyDistribution.isian[diff];
      if (isianCount <= 0) continue;
      
      console.log(`[Generate] Generating ${isianCount} ${diff} Isian questions...`);
      
      const isianConfig = {
        ...questionConfig,
        multipleChoice: { count: 0, weight: 0 },
        essay: { count: isianCount, weight: questionConfig.essay.weight },
        difficulty: diff,
        useDistribution: false,
        questionType: 'isian', // Tag as isian
      };
      
      const isianResult = await executeGenerateQuestions(model, learningGoals, isianConfig);
      isianResult.essay.forEach((q: any) => {
        allEssay.push({
          ...q,
          questionNumber: essayQuestionNumber++,
          difficultyLevel: diff,
          type: 'isian', // Tag type
        });
      });
    }
    
    // Generate Uraian questions with distribution (if uraian is defined)
    if (difficultyDistribution.uraian) {
      const allUraian: any[] = [];
      let uraianQuestionNumber = 1;
      
      for (const diff of difficulties) {
        const uraianCount = difficultyDistribution.uraian[diff];
        if (uraianCount <= 0) continue;
        
        console.log(`[Generate] Generating ${uraianCount} ${diff} Uraian questions...`);
        
        const uraianConfig = {
          ...questionConfig,
          multipleChoice: { count: 0, weight: 0 },
          essay: { count: uraianCount, weight: questionConfig.uraianWeight || questionConfig.essay.weight },
          difficulty: diff,
          useDistribution: false,
          questionType: 'uraian', // Tag as uraian
        };
        
        const uraianResult = await executeGenerateQuestions(model, learningGoals, uraianConfig);
        uraianResult.essay.forEach((q: any) => {
          allUraian.push({
            ...q,
            questionNumber: uraianQuestionNumber++,
            difficultyLevel: diff,
            type: 'uraian', // Tag type
          });
        });
      }
      
      console.log('[Generate] Distribution complete:', {
        mcTotal: allMultipleChoice.length,
        isianTotal: allEssay.length,
        uraianTotal: allUraian.length
      });
      
      return {
        multipleChoice: allMultipleChoice,
        essay: allEssay,
        uraian: allUraian,
      };
    }
    
    console.log('[Generate] Distribution complete:', {
      mcTotal: allMultipleChoice.length,
      essayTotal: allEssay.length
    });
    
    return {
      multipleChoice: allMultipleChoice,
      essay: allEssay,
    };
  }

  // Special strict instruction for FASE_A (Kelas 1-2 SD)
  const faseAWarning = gradeLevel === 'FASE_A' ? `

🚨 PERHATIAN KHUSUS UNTUK FASE A (KELAS 1-2 SD - USIA 6-8 TAHUN):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Anak kelas 1-2 SD HANYA bisa memahami:
✓ Kata-kata sehari-hari: apa, siapa, kapan, berapa, di mana
✓ Benda konkret: buku, pensil, meja, kucing, apel, bunga
✓ Kegiatan sederhana: makan, minum, tidur, bermain, belajar
✓ Angka kecil: 1-20 (maksimal 50)
✓ Konsep dasar: besar-kecil, banyak-sedikit, tinggi-pendek

❌ JANGAN PERNAH gunakan kata-kata ini untuk Fase A (Kelas 1-2):
   regulasi, esensial, kondusif, potensi, konflik, efisiensi,
   edukasi, kompetensi, signifikan, harmonisan, akademik,
   menganalisis (gunakan: melihat, menghitung),
   mengidentifikasi (gunakan: menunjuk, menyebutkan),
   mengevaluasi (gunakan: memilih yang benar)

✅ CONTOH SOAL YANG BENAR:
   "Andi punya 3 apel. Budi memberi 2 apel. Berapa apel Andi?"
   [Sederhana, konkret, menggunakan nama & angka kecil]

❌ CONTOH SOAL YANG SALAH (JANGAN DITIRU!):
   "${guide.badExample || 'Mengapa regulasi penting?'}"
   [Terlalu formal, kata-kata sulit, konsep abstrak]

SEBELUM MEMBUAT SOAL, TANYAKAN PADA DIRI SENDIRI:
1. Apakah anak kelas 1-2 SD mengerti semua kata dalam soal ini?
2. Apakah soal ini menggunakan benda/kegiatan yang mereka kenal?
3. Apakah kalimatnya pendek (maksimal 10 kata)?
4. Apakah saya menghindari kata-kata formal/akademis?

Jika jawaban ada yang TIDAK, maka REVISI soal menjadi lebih sederhana!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : '';

  // PROMPT KHUSUS UNTUK SOAL URAIAN/ESSAY
  if (questionType === 'uraian' && questionConfig.essay.count > 0) {
    const uraianPrompt = `Bertindaklah sebagai Ahli Penyusun Asesmen Kurikulum Merdeka tingkat Sekolah Dasar (SD).

TUGAS:
Buatlah ${questionConfig.essay.count} soal Uraian/Essay berdasarkan parameter berikut:
- Fase/Kelas: ${gradeLevel}
- Tujuan Pembelajaran (TP): ${learningGoals.join(' | ')}
- Tingkat Kesulitan: ${strictLevel}

ATURAN KUNCI BERDASARKAN JENJANG KELAS (WAJIB PATUH):

1. JIKA KELAS 1 ATAU 2 (FASE A - KELAS RENDAH):
   - Karakteristik: Siswa baru belajar membaca/menulis lancar. Daya nalar masih sangat konkret.
   - Format Soal: Lebih condong ke "Isian Singkat" atau "Uraian Sangat Sederhana" (1 kalimat).
   - Larangan: JANGAN gunakan pertanyaan "Analisis...", "Jelaskan faktor-faktor...", atau soal yang butuh jawaban paragraf panjang.
   - Kata Tanya yang Diizinkan: "Apa...", "Siapa...", "Sebutkan 3...", "Bagaimana perasaanmu...", "Apa yang terjadi jika...".
   - Stimulus: Soal WAJIB didasarkan pada gambar atau cerita pendek yang sangat sederhana.

2. JIKA KELAS 3 S.D. 6 (FASE B & C - KELAS TINGGI):
   - Karakteristik: Siswa sudah mampu berpikir logis dan menulis kalimat majemuk.
   - Format Soal: Uraian terbatas hingga Uraian bebas (menjelaskan alasan).
   - Kata Tanya yang Diizinkan: "Mengapa...", "Jelaskan cara...", "Apa perbedaan...", "Tulislah pengalamanmu...", "Buatlah kesimpulan...".
   - Stimulus: Bisa berupa grafik sederhana, tabel, cerita rakyat, atau kasus sehari-hari.

PEDOMAN TINGKAT KESULITAN (UNTUK URAIAN):
- Mudah: Menyebutkan kembali informasi dari teks/gambar (Literal).
- Sedang: Menjelaskan hubungan sederhana atau mengurutkan kejadian (Inferensial).
- Sulit (HOTS): Memprediksi kejadian, memberikan pendapat dengan alasan, atau menghubungkan materi dengan kehidupan nyata (Evaluasi/Kreasi).

FORMAT OUTPUT (JSON MURNI):
{
  "essay": [
    {
      "questionNumber": 1,
      "question": "Pertanyaan utama...",
      "stimulus": "Teks cerita/konteks pendek sebagai pengantar soal (WAJIB ADA untuk soal cerita)",
      "imageDescription": "Deskripsi visual untuk ilustrasi (Sangat penting untuk Kelas Rendah)",
      "answerKeywords": [
        "Kata kunci 1 yang wajib ada",
        "Kata kunci 2",
        "Kata kunci 3"
      ],
      "modelAnswer": "Contoh jawaban lengkap yang ideal.",
      "scoringRubric": "Pedoman penskoran singkat (Misal: Skor 5 jika menyebutkan 3 hal, Skor 3 jika hanya 1 hal).",
      "weight": ${questionConfig.essay.weight},
      "relatedTP": "Tujuan Pembelajaran terkait"
    }
  ]
}

PENTING:
- Response harus JSON valid murni tanpa markdown code blocks
- Mulai langsung dengan { dan akhiri dengan }
- Setiap soal WAJIB memiliki stimulus (cerita/konteks)
- Image description WAJIB ada terutama untuk Fase A (Kelas 1-2)
- Answer keywords minimal 3 poin
- Scoring rubric harus jelas dan terukur`;

    return retryWithBackoff(async () => {
      const generationConfig = {
        temperature: 0.3, // Sedikit lebih tinggi untuk kreativitas soal uraian
        topP: 0.85,
        topK: 45,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      };

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: uraianPrompt }] }],
        generationConfig,
      });
      const response = await result.response;
      const text = response.text();
      
      console.log('[Generate Uraian] Raw response length:', text.length);
      
      try {
        const parsed = parseJSONResponse(text);
        if (!parsed.essay || !Array.isArray(parsed.essay)) {
          throw new Error('Response tidak memiliki array essay yang valid');
        }
        return { multipleChoice: [], essay: parsed.essay };
      } catch (parseError: any) {
        console.error('[Generate Uraian] Parse error:', parseError.message);
        throw parseError;
      }
    });
  }

  const prompt = `Kamu adalah seorang ahli pembuatan soal untuk kurikulum merdeka Indonesia yang SANGAT MEMPERHATIKAN kesesuaian bahasa dengan tingkat perkembangan siswa. Buatkan soal berdasarkan Tujuan Pembelajaran (TP) berikut:

TUJUAN PEMBELAJARAN:
${learningGoals.map((tp, idx) => `${idx + 1}. ${tp}`).join('\n')}

KONFIGURASI SOAL:
- Pilihan Ganda: ${questionConfig.multipleChoice.count} soal (bobot: ${questionConfig.multipleChoice.weight} per soal)
- Isian Singkat (Fill-in): ${questionConfig.essay.count} soal (bobot: ${questionConfig.essay.weight} per soal)
  🔴 PENTING: Isian adalah soal jawaban SINGKAT (1-5 kata), BUKAN essay/uraian panjang
- Tingkat Kesulitan: ${strictLevel}
- Jumlah Opsi Jawaban: ${optionsCount} opsi (${options.join(', ')})
- Kualitas Pengecoh: ${distractorQuality.toUpperCase()} - ${distractorGuide[distractorQuality]}
${includeImage ? '- Sertakan deskripsi gambar/ilustrasi yang mendukung soal' : ''}

📋 PEDOMAN KETAT TINGKAT KESULITAN (WAJIB PATUH):
${difficulty === 'mudah' ? `
1. MUDAH (Low Level - C1/C2):
   - Target Kognitif: Mengingat & Memahami Dasar
   - Karakteristik: Jawaban tersurat, faktual, hafalan, identifikasi visual langsung
   - Kata Kerja: Sebutkan, Tunjukkan, Apa nama, Siapa, Kapan
   - LARANGAN: Jangan gunakan soal cerita kompleks, jangan hitungan bertingkat
   - Contoh: "Apa nama hewan yang hidup di air dan bernapas dengan insang?"
` : difficulty === 'sedang' ? `
2. SEDANG (Medium Level - C3) ⚠️ PERHATIAN KHUSUS:
   - Target Kognitif: Menerapkan/Aplikasi Prosedural
   - Karakteristik: Menggunakan rumus/prosedur pada situasi standar
   - Fokus: "HOW" (Bagaimana cara/hasilnya), BUKAN "WHY" (Mengapa)
   - Kata Kerja: Hitunglah, Urutkan, Kelompokkan, Lengkapi, Tentukan hasil
   - LARANGAN KERAS:
     * JANGAN meminta alasan ("Mengapa...")
     * JANGAN meminta analisis ("Jelaskan pendapatmu...")
     * JANGAN meminta evaluasi ("Apakah cara ini benar...")
     * Soal harus punya 1 jawaban pasti melalui hitungan/prosedur, bukan opini
   - Contoh: "Ibu membeli 12 apel, lalu memberikan 5 kepada kakak. Berapa sisa apel ibu?"
` : `
3. SULIT (High Level/HOTS - C4/C5/C6):
   - Target Kognitif: Analisis, Evaluasi, Kreasi
   - Karakteristik: Problem solving, logika sebab-akibat, transfer konsep ke situasi baru
   - Kata Kerja: Analisislah, Simpulkan, Bandingkan, Mengapa, Apa akibatnya, Temukan kesalahan
   - Sifat: Jawaban tersirat, penalaran multi-langkah, kontekstual
   - Contoh: "Ani berlari 3 putaran dalam 6 menit, Budi 2 putaran dalam 5 menit. Siapa yang lebih cepat dan mengapa?"
`}

🎯 STRUKTUR PENGECOH (DISTRACTOR) - Level ${distractorQuality.toUpperCase()}:
${distractorGuide[distractorQuality]}
- Pengecoh harus masuk akal dan berasal dari kesalahan umum siswa (common misconception)
- Panjang kalimat opsi harus relatif setara
- Hindari petunjuk seperti "selalu", "tidak pernah", "semua"

🎯 PANDUAN BAHASA UNTUK TINGKAT ${gradeLevel} (WAJIB DIIKUTI):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Kosakata: ${guide.vocabulary}
✓ Struktur kalimat: ${guide.sentence}
✓ Panjang maksimal: ${guide.maxWords} kata per soal
✓ Contoh soal yang BENAR untuk tingkat ini:
  "${guide.example}"
✗ HINDARI: ${guide.avoid}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${faseAWarning}

ATURAN PEMBUATAN SOAL:
1. Soal harus relevan dengan TP yang diberikan dan mengukur pencapaian kompetensi
2. Pilihan Ganda: WAJIB ${optionsCount} opsi jawaban (${options.join(', ')}), hanya 1 jawaban benar
3. 🔴 SOAL ISIAN SINGKAT (FILL-IN-THE-BLANK) - BUKAN ESSAY/URAIAN PANJANG:
   - Format: Pertanyaan langsung dengan jawaban SINGKAT (1-5 kata maksimal)
   - Jawaban harus SPESIFIK, PASTI, dan TERUKUR (angka, nama, istilah)
   - JANGAN buat soal uraian/essay yang meminta penjelasan panjang
   - Contoh BENAR:
     * "Berapa hasil dari 5 + 3?" → Jawaban: "8"
     * "Ibu kota Indonesia adalah ...?" → Jawaban: "Jakarta"
     * "3 x 4 = ..." → Jawaban: "12"
     * "Hewan yang hidup di air dan bernapas dengan insang disebut ...?" → Jawaban: "Ikan"
   - Contoh SALAH (jangan ditiru):
     ❌ "Jelaskan proses fotosintesis!" (terlalu panjang, bukan isian)
     ❌ "Menurut pendapatmu, mengapa..." (meminta opini, bukan fakta)
     ❌ "Uraikan perbedaan..." (terlalu luas)
4. Semua soal harus sesuai tingkat kesulitan: ${difficulty}
5. Gunakan Bahasa Indonesia yang baku, jelas, dan tidak ambigu
6. Opsi jawaban harus homogen, proporsional panjangnya, dan tidak ada yang terlalu jelas salah
7. KUNCI JAWABAN harus ACAK - hindari pola berurutan (A-A-A atau A-B-C-D)
8. Hindari kata "kecuali", "tidak", "bukan" dalam stem soal (kecuali sangat diperlukan)
9. ⚠️ VALIDASI WAJIB SETIAP SOAL: Maksimal ${guide.maxWords} kata, kosakata sesuai tingkat ${gradeLevel}
10. Distribusi tingkat kognitif (Taksonomi Bloom):
   - 30% soal C1-C2 (Pengetahuan/Pemahaman): mengingat fakta, definisi, konsep dasar
   - 50% soal C3-C4 (Aplikasi/Analisis): menerapkan konsep, menganalisis situasi
   - 20% soal C5-C6 (Evaluasi/Kreasi): mengevaluasi, memecahkan masalah kompleks
${includeImage ? '11. Tambahkan field "imageDescription" berisi deskripsi gambar/diagram yang sesuai untuk soal' : ''}

OUTPUT FORMAT (JSON):
{
  "multipleChoice": [
    {
      "questionNumber": 1,
      "question": "Teks soal...",
      "options": {
        ${options.map(opt => `"${opt}": "Opsi ${opt}"`).join(',\n        ')}
      },
      "correctAnswer": "${options[0]}",
      "weight": ${questionConfig.multipleChoice.weight},
      "relatedTP": "Tujuan Pembelajaran terkait",
      "wordCount": 8${includeImage ? ',\n      "imageDescription": "Deskripsi gambar/ilustrasi yang mendukung soal (opsional)"' : ''}
    }
  ],
  "essay": [
    {
      "questionNumber": 1,
      "question": "Teks soal isian (gunakan ... atau _____ untuk tempat isian)...",
      "correctAnswer": "Jawaban singkat (1-5 kata)",
      "acceptableAnswers": ["Variasi jawaban yang diterima (opsional)"],
      "weight": ${questionConfig.essay.weight},
      "relatedTP": "Tujuan Pembelajaran terkait",
      "wordCount": 8${includeImage ? ',\n      "imageDescription": "Deskripsi gambar/ilustrasi yang mendukung soal (opsional)"' : ''}
    }
  ]
}

📝 CONTOH SOAL ISIAN SINGKAT YANG BENAR:
Mudah: "Ibu kota Indonesia adalah _____." → "Jakarta"
Sedang: "Jika 12 apel dibagi 3 anak sama rata, setiap anak mendapat _____ apel." → "4"
Sulit: "Jika harga 2 kg jeruk Rp 20.000, berapa harga 5 kg jeruk? Rp _____" → "50.000"

CONTOH SOAL YANG BAIK UNTUK TINGKAT ${gradeLevel}:
${guide.example}

PENTING: 
- Response harus JSON valid murni tanpa markdown code blocks, komentar, atau text lainnya
- Mulai langsung dengan { dan akhiri dengan }
- WAJIB gunakan ${optionsCount} opsi (${options.join(', ')}) untuk setiap soal pilihan ganda
- 🔴 SOAL ISIAN: Gunakan format fill-in-the-blank dengan jawaban SINGKAT (1-5 kata), BUKAN essay/uraian
- Field "correctAnswer" wajib diisi untuk soal isian, "rubric" TIDAK DIPERLUKAN
- Field "acceptableAnswers" berisi array variasi jawaban yang bisa diterima (optional)
- Kunci jawaban harus ACAK dan BERVARIASI antar soal
- Tingkat kesulitan: ${difficulty}
- Pastikan distribusi kognitif: 30% C1-C2, 50% C3-C4, 20% C5-C6
- ⚠️ VALIDASI AKHIR KRITIS: Setiap soal MAKSIMAL ${guide.maxWords} kata dan kosakata sesuai ${gradeLevel}!
- Tambahkan field "wordCount" untuk setiap soal (hitung jumlah kata dalam question)`;

  return retryWithBackoff(async () => {
    // KONFIGURASI KRITIS: Temperature rendah + responseMimeType JSON
    const generationConfig = {
      temperature: 0.2, // Rendah agar patuh instruksi, tidak berimajinasi
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "application/json", // Wajib JSON bersih
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });
    const response = await result.response;
    const text = response.text();
    
    console.log('[Generate Questions] Raw response length:', text.length);
    console.log('[Generate Questions] Raw response preview:', text.substring(0, 200));
    
    try {
      const parsed = parseJSONResponse(text);
      
      // Validate response structure
      if (!parsed.multipleChoice || !Array.isArray(parsed.multipleChoice)) {
        throw new Error('Response tidak memiliki array multipleChoice yang valid');
      }
      if (!parsed.essay || !Array.isArray(parsed.essay)) {
        throw new Error('Response tidak memiliki array essay yang valid');
      }
      
      console.log('[Generate Questions] Parsed successfully:', {
        mcCount: parsed.multipleChoice.length,
        essayCount: parsed.essay.length
      });
      
      // Post-processing validation for FASE_A (Kelas 1-2 SD)
      if (gradeLevel === 'FASE_A') {
        console.log('[Validation] Checking FASE_A (Kelas 1-2 SD) compliance...');
        
        // Forbidden words for SD kelas 1-3
        const forbiddenWords = [
          'regulasi', 'esensial', 'kondusif', 'potensi', 'konflik', 'efisiensi',
          'edukasi', 'kompetensi', 'signifikan', 'harmonisan', 'akademik',
          'menganalisis', 'mengidentifikasi', 'mengevaluasi', 'fundamental',
          'optimal', 'relevan', 'substansial', 'eksplisit', 'implisit'
        ];
        
        const validateQuestion = (q: any, type: string) => {
          const questionLower = q.question.toLowerCase();
          const wordCount = q.question.split(' ').length;
          
          // Check word count
          if (wordCount > guide.maxWords) {
            console.warn(`[Validation] ${type} #${q.questionNumber} exceeds ${guide.maxWords} words: ${wordCount} words`);
          }
          
          // Check forbidden words
          const foundForbidden = forbiddenWords.filter(word => questionLower.includes(word));
          if (foundForbidden.length > 0) {
            console.warn(`[Validation] ${type} #${q.questionNumber} contains forbidden words: ${foundForbidden.join(', ')}`);
            console.warn(`[Validation] Question: ${q.question}`);
          }
        };
        
        parsed.multipleChoice.forEach((q: any) => validateQuestion(q, 'PG'));
        parsed.essay.forEach((q: any) => validateQuestion(q, 'Essay'));
      }
      
      return parsed;
    } catch (parseError: any) {
      console.error('[Generate Questions] Parse error:', parseError.message);
      console.error('[Generate Questions] Failed text:', text);
      
      const retryPrompt = `${prompt}

PERINGATAN KRITIS: Response sebelumnya gagal di-parse dengan error: "${parseError.message}"
Pastikan output adalah JSON valid murni dengan struktur:
{
  "multipleChoice": [...],
  "essay": [...]
}
JANGAN gunakan markdown code blocks, JANGAN tambahkan komentar atau teks apapun.
Mulai langsung dengan { dan akhiri dengan }`;
      
      const retryResult = await model.generateContent(retryPrompt);
      const retryResponse = await retryResult.response;
      const retryText = retryResponse.text();
      
      console.log('[Generate Questions] Retry response length:', retryText.length);
      const retryParsed = parseJSONResponse(retryText);
      
      // Validate retry response
      if (!retryParsed.multipleChoice || !Array.isArray(retryParsed.multipleChoice)) {
        throw new Error('Retry: Response tidak memiliki array multipleChoice yang valid');
      }
      if (!retryParsed.essay || !Array.isArray(retryParsed.essay)) {
        throw new Error('Retry: Response tidak memiliki array essay yang valid');
      }
      
      return retryParsed;
    }
  });
}

/**
 * Estimate tokens (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to max tokens with smart boundary
 */
function truncateToMaxTokens(text: string, maxTokens: number = 4000): string {
  const estimatedTokens = estimateTokens(text);
  
  if (estimatedTokens <= maxTokens) {
    return text;
  }
  
  // Calculate max chars (rough: 1 token = 4 chars)
  const maxChars = maxTokens * 4;
  
  // Try to truncate at sentence boundary
  let truncated = text.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  
  const boundary = Math.max(lastPeriod, lastNewline);
  if (boundary > maxChars * 0.8) {
    truncated = truncated.substring(0, boundary + 1);
  }
  
  console.log(`[Token Limiter] Truncated from ${estimatedTokens} to ~${estimateTokens(truncated)} tokens`);
  return truncated + '\n\n[... teks dipotong untuk menghemat quota ...]';
}

/**
 * Chunk text content for efficient processing
 */
export function chunkText(text: string, maxChunkSize: number = 3000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split('\n\n');
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length < maxChunkSize) {
      currentChunk += paragraph + '\n\n';
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph + '\n\n';
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Get quota and rate limit status
 */
export function getQuotaStatus() {
  return {
    isQuotaExhausted: quotaMonitor.isQuotaExhausted(),
    errorCount: quotaMonitor.getErrorCount(),
    lastError: quotaMonitor.getLastError(),
    remainingRequests: rateLimiter.getRemainingRequests(),
    maxRequestsPerMinute: MAX_REQUESTS_PER_MINUTE,
    queueSize: requestQueue.getQueueSize()
  };
}

/**
 * Reset quota monitor (for testing or after fixing API key)
 */
export function resetQuotaMonitor() {
  quotaMonitor.reset();
  console.log('[Quota Monitor] Reset successful');
}

// Note: genAI is created per-request using selected API key via ApiKeyManager

export async function getApiKeyStatus() {
  const keys = apiKeyManager.getAllKeys();
  const items: any[] = [];
  for (const key of keys) {
    const id = hashKeyShort(key);
    const masked = maskKey(key);
    let banned = false;
    let bannedTTL = null;
    let remaining = null;
    if (redis) {
      try {
        const bkey = `gemini:banned:${hashKeyShort(key)}`;
        const exists = await redis.exists(bkey);
        banned = exists === 1;
        if (banned) {
          const ttl = await redis.pttl(bkey);
          bannedTTL = ttl > 0 ? ttl : 0;
        }
        remaining = await getKeyRemaining(key);
      } catch (e) {
        console.warn('[getApiKeyStatus] redis read failed', e);
      }
    }
    items.push({ id, masked, banned, bannedTTL, remaining });
  }
  return {
    redisEnabled: !!redis,
    keys: items
  };
}

function maskKey(key: string) {
  if (!key || key.length < 8) return '****';
  return '****' + key.slice(-6);
}
