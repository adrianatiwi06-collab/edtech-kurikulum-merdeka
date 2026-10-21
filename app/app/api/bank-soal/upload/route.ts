import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob;
    
    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Format file tidak didukung. Harap gunakan format PDF.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // BATAS AMAN UKURAN FILE (Mencegah Server Crash)
    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
    if (buffer.length > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Ukuran PDF terlalu besar (Maksimal 4MB). Silakan kompres PDF Anda.' }, { status: 400 });
    }

    // 1. Ambil API Key
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key Gemini belum dikonfigurasi di file .env' }, { status: 500 });
    }

    // 2. SISTEM CERDAS: Deteksi Model (HINDARI 2.0 UNTUK SEMENTARA KARENA LIMIT KUOTA 0)
    console.log("Memeriksa kemampuan API Key Anda...");
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!listResponse.ok) {
       throw new Error('Gagal memverifikasi API Key ke server Google.');
    }
    
    const listData = await listResponse.json();
    const availableModels = listData.models || [];
    
    // KITA KUNCI DI 1.5 FLASH KARENA KUOTA GRATISNYA BESAR
    let activeModel = ''; 
    const targetModel = availableModels.find((m: any) => 
      m.name === 'models/gemini-1.5-flash' || 
      (m.name.includes('gemini-1.5-flash') && m.supportedGenerationMethods?.includes('generateContent'))
    );

    if (targetModel) {
      activeModel = targetModel.name;
    } else {
      const basicModel = availableModels.find((m: any) => m.supportedGenerationMethods?.includes('generateContent'));
      activeModel = basicModel ? basicModel.name : 'models/gemini-1.5-flash';
    }

    // 3. PROMPT UNIVERSAL
    const prompt = `
      INSTRUKSI SANGAT PENTING:
      Tugasmu adalah membedah dokumen ujian ini dan mengekstrak soal-soalnya ke dalam format JSON.

      ATURAN EKSTRAKSI:
      - Untuk Pilihan Ganda (multipleChoice): ekstrak semua pilihan yang ada. Bobot (weight) default = 1.
      - Jika ada GAMBAR di dalam soal dan kamu bisa melihatnya, buatkan deskripsi singkat di dalam kurung siku. Contoh: "Perhatikan gambar [jam dinding pukul 07.00] berikut!"
      - Untuk Esai (essay): bobot (weight) default = 10.
      - "correctAnswer" hanya berisi SATU huruf kapital. Jika tidak ada kunci jawaban, tebak jawaban yang paling rasional.

      PENTING: Output WAJIB berupa teks JSON murni. JANGAN tambahkan tag markdown \`\`\`json. Bentuknya harus persis seperti ini:
      {
        "multipleChoice": [
          {
            "questionNumber": 1,
            "question": "Teks pertanyaan?",
            "options": { "A": "Pilihan A", "B": "Pilihan B", "C": "Pilihan C" },
            "correctAnswer": "A",
            "weight": 1,
            "relatedTP": ""
          }
        ],
        "essay": [
          {
            "questionNumber": 1,
            "question": "Teks pertanyaan?",
            "weight": 10,
            "relatedTP": ""
          }
        ]
      }
    `;

    let aiResponseText = "";
    let extractionSuccess = false;

    // 4. STRATEGI UTAMA: MODE VISUAL (Bisa lihat gambar)
    try {
      console.log(`Mengirim ke Mode Visual (${activeModel})...`);
      const base64Pdf = buffer.toString('base64');
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${activeModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inlineData: { mimeType: "application/pdf", data: base64Pdf } }
              ]
            }]
          }),
        }
      );

      if (response.ok) {
        const resData = await response.json();
        aiResponseText = resData.candidates[0].content.parts[0].text;
        extractionSuccess = true;
        console.log("✅ Berhasil ekstrak dengan Mode Visual!");
      } else {
        const errData = await response.json();
        console.warn("⚠️ Mode Visual ditolak (Mungkin Limit Kuota):", errData.error?.message);
      }
    } catch (error) {
      console.warn("⚠️ Gagal koneksi Mode Visual:", error);
    }

    // 5. STRATEGI CADANGAN: MODE TEKS KLASIK (Jika kuota visual habis/error)
    if (!extractionSuccess) {
      console.log("🔄 Beralih ke Mode Teks Klasik (Fallback)...");
      try {
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(buffer);
        
        const responseText = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${activeModel}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt + "\n\n--- BERIKUT ADALAH TEKS DARI PDF SOAL ---\n\n" + pdfData.text }
                ]
              }]
            }),
          }
        );

        if (responseText.ok) {
          const resData = await responseText.json();
          aiResponseText = resData.candidates[0].content.parts[0].text;
          extractionSuccess = true;
          console.log("✅ Berhasil ekstrak dengan Mode Teks Klasik!");
        } else {
          const errData = await responseText.json();
          throw new Error(errData.error?.message || 'Server Google menolak permintaan mode teks.');
        }
      } catch (err: any) {
        throw new Error('Kedua mode (Visual & Teks) gagal: ' + err.message);
      }
    }

    // 6. Pembersihan Format JSON
    if (aiResponseText.includes('```')) {
      aiResponseText = aiResponseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    }
    
    const structuredQuestions = JSON.parse(aiResponseText);
    return NextResponse.json({ success: true, questions: structuredQuestions });

  } catch (error: any) {
    console.error('Error Fatal Bank Soal Upload:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}