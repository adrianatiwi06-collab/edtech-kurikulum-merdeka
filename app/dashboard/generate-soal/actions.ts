'use server';

import { generateQuestions } from '@/lib/gemini';

export async function generateQuestionsAction(
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
) {
  try {
    console.log('[Generate Soal] Starting with config:', questionConfig);
    console.log('[Generate Soal] Learning goals count:', learningGoals.length);
    
    const result = await generateQuestions(learningGoals, questionConfig);
    
    console.log('[Generate Soal] Success! Result:', {
      mcCount: result.multipleChoice?.length || 0,
      essayCount: result.essay?.length || 0
    });
    
    return { success: true, data: result };
  } catch (error: any) {
    console.error('[Generate Soal] Error:', error);
    const errorMsg = error.message || 'Terjadi kesalahan saat generate soal';
    
    // Tambahkan info debug untuk error
    let detailedError = errorMsg;
    if (error.stack) {
      console.error('[Generate Soal] Stack trace:', error.stack);
    }
    
    // User-friendly error messages
    if (errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      detailedError = '⚠️ API Quota habis. Silakan tunggu 1-2 menit atau restart server (npm run dev) untuk me-refresh API key.';
    } else if (errorMsg.includes('parse') || errorMsg.includes('JSON')) {
      detailedError = '❌ Format response tidak valid. Coba lagi atau kurangi jumlah soal yang diminta.';
    } else if (errorMsg.includes('API key')) {
      detailedError = '🔑 API Key tidak valid atau tidak ditemukan. Periksa file .env Anda.';
    }
    
    return { success: false, error: detailedError };
  }
}
