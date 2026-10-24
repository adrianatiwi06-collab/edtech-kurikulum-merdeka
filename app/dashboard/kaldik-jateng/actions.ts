// app/dashboard/kaldik-jateng/actions.ts
'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

// Inisialisasi Gemini (Pastikan API Key sudah ada di .env.local)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function extractKaldikFromDocument(base64Data: string, mimeType: string, yearLabel: string) {
  try {
    // Gunakan gemini-1.5-flash atau pro yang mendukung visi dan dokumen
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
      Anda adalah asisten admin sekolah yang ahli dalam membaca dokumen Kalender Pendidikan Dinas Pendidikan Provinsi.
      Tugas Anda: Ekstrak seluruh agenda, jadwal libur, ujian, dan kegiatan dari dokumen terlampir untuk Tahun Ajaran ${yearLabel}.
      
      KEMBALIKAN HANYA FORMAT JSON ARRAY MURNI (tanpa markdown \`\`\`json).
      Setiap objek dalam array WAJIB memiliki properti persis seperti ini:
      [
        {
          "id": "generate-id-acak-singkat",
          "activity": "Nama kegiatan (misal: Penilaian Akhir Semester)",
          "type": "tes", // Pilih salah satu: "libur", "upacara", "rapor", "tes", atau "kegiatan"
          "start": "YYYY-MM-DD", // Tanggal mulai format ISO
          "end": "YYYY-MM-DD",   // Tanggal selesai format ISO (jika 1 hari, samakan dengan start)
          "noClass": true        // true jika meliburkan KBM (seperti libur, tes, pembagian rapor), false jika KBM tetap berjalan
        }
      ]
      Pastikan tanggal relevan dengan tahun ajaran ${yearLabel}.
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType } }
    ]);

    const responseText = result.response.text();
    // Bersihkan markdown jika AI masih bandel membungkusnya dengan ```json
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return { success: true, data: JSON.parse(cleanJson) };
  } catch (error: any) {
    console.error('Gagal mengekstrak Kaldik:', error);
    return { success: false, error: 'Gagal mengekstrak dokumen. Pastikan file valid.' };
  }
}