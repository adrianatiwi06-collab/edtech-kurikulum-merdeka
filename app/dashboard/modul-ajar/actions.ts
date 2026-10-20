// File: app/dashboard/modul-ajar/actions.ts
'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export async function generateModulAjarAction(prompt: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      return { 
        success: false, 
        error: 'API Key Gemini tidak ditemukan di environment variables server (.env).' 
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // GUNAKAN MODEL PALING STABIL YANG DIDUKUNG DI SEMUA VERSI API v1beta
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

    if (!aiText) {
      return { success: false, error: 'AI mengembalikan respons kosong.' };
    }

    return { 
      success: true, 
      data: aiText 
    };

  } catch (error: any) {
    console.error('Error Action Modul Ajar:', error);
    return { 
      success: false, 
      error: error.message || 'Gagal terhubung ke AI' 
    };
  }
}