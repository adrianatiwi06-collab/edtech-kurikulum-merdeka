/**
 * Prompt Templates for Question Generation
 * Based on Kurikulum Merdeka SD Assessment Standards
 * 
 * IMPLEMENTASI TEKNIS KRITIS:
 * 1. STRICT LEVEL MAPPING: 
 *    - Mudah → "MUDAH (C1-C2: Hafalan/Faktual)"
 *    - Sedang → "SEDANG (C3: Aplikasi Prosedural - DILARANG MEMINTA ALASAN/ANALISIS)"
 *    - Sulit → "SULIT (C4-C6: HOTS/Analisis & Evaluasi)"
 * 
 * 2. TEMPERATURE RENDAH (0.2-0.3):
 *    Agar AI tidak berimajinasi dan patuh pedoman ketat
 * 
 * 3. RESPONSE MIME TYPE: application/json
 *    Memaksa output JSON bersih tanpa markdown
 */

export interface MCQPromptParams {
  count: number;
  kelas: string;
  subject: string;
  tp_text: string;
  level: 'Mudah' | 'Sedang' | 'Sulit';
  options_count: number;
  distractor_quality: 'low' | 'medium' | 'high';
  include_explanation?: boolean;
}

export interface QuestionOutput {
  id: number;
  question_text: string;
  stimulus_text: string;
  image_suggestion: string;
  options: string[];
  correct_index: number;
  correct_answer_text: string;
  explanation: string;
  cognitive_level: string;
}

export interface GeneratedQuestionsResponse {
  questions: QuestionOutput[];
}

/**
 * Build MCQ prompt with strict difficulty guidelines for SD/Kurikulum Merdeka
 */
export function buildMCQPrompt(params: MCQPromptParams): string {
  const {
    count,
    kelas,
    subject,
    tp_text,
    level,
    options_count,
    distractor_quality,
    include_explanation = true
  } = params;

  // STRICT LEVEL MAPPING - Agar AI tidak berimajinasi
  const strictLevel = level === 'Mudah' 
    ? 'MUDAH (C1-C2: Hafalan/Faktual)' 
    : level === 'Sedang' 
    ? 'SEDANG (C3: Aplikasi Prosedural - DILARANG MEMINTA ALASAN/ANALISIS)' 
    : 'SULIT (C4-C6: HOTS/Analisis & Evaluasi)';

  const distractorGuidance = getDistractorGuidance(distractor_quality);
  const difficultyGuidelines = getDifficultyGuidelines(level);

  return `Bertindaklah sebagai Spesialis Penyusun Soal Asesmen untuk Sekolah Dasar (Kurikulum Merdeka).

TUGAS:
Buatlah ${count} soal Pilihan Ganda (MCQ) berdasarkan parameter berikut:
- Fase/Kelas: ${kelas}
- Mata Pelajaran: ${subject}
- Tujuan Pembelajaran (TP): ${tp_text}
- Tingkat Kesulitan Target: ${strictLevel}
- Jumlah Opsi Jawaban: ${options_count}
- Kualitas Pengecoh (Distractor): ${distractor_quality}

PEDOMAN KETAT TINGKAT KESULITAN (WAJIB PATUH):
Gunakan pedoman ini untuk memastikan soal tidak melenceng dari levelnya.

1. JIKA LEVEL = MUDAH (Low Level)
   - Target Kognitif: C1 (Mengingat) & C2 (Memahami Dasar).
   - Karakteristik: Jawaban tersurat, faktual, hafalan, atau identifikasi visual langsung.
   - Kata Kerja Operasional: Sebutkan, Tunjukkan, Apa nama, Siapa, Kapan.
   - LARANGAN: Jangan gunakan soal cerita, jangan ada hitungan bertingkat.

2. JIKA LEVEL = SEDANG (Medium Level) -> *Perhatian Khusus*
   - Target Kognitif: C3 (Menerapkan/Aplikasi Prosedural).
   - Karakteristik: Menggunakan rumus/prosedur yang sudah dipelajari pada situasi standar.
   - Fokus: "HOW" (Bagaimana cara/hasilnya), BUKAN "WHY" (Mengapa).
   - Kata Kerja Operasional: Hitunglah, Urutkan, Kelompokkan, Lengkapi kalimat, Tentukan hasil.
   - LARANGAN KERAS: 
     - JANGAN meminta alasan ("Mengapa...").
     - JANGAN meminta analisis ("Jelaskan pendapatmu...").
     - JANGAN meminta evaluasi ("Apakah cara ini benar...").
     - Soal harus punya 1 jawaban pasti melalui hitungan/prosedur, bukan opini.

3. JIKA LEVEL = SULIT (High Level/HOTS)
   - Target Kognitif: C4 (Analisis), C5 (Evaluasi), C6 (Kreasi).
   - Karakteristik: Problem solving, logika sebab-akibat, transfer konsep ke situasi baru (kontekstual).
   - Kata Kerja Operasional: Analisislah, Simpulkan, Bandingkan, Mengapa, Apa akibatnya, Temukan kesalahan.
   - Sifat: Jawaban tersirat, butuh penalaran multi-langkah.

INSTRUKSI KHUSUS UNTUK LEVEL "${level}":
${difficultyGuidelines}

STRUKTUR PENGECOH (DISTRACTOR):
${distractorGuidance}
- Pengecoh harus masuk akal (plausible) dan berasal dari kesalahan umum siswa (common misconception).
- Panjang kalimat opsi jawaban harus relatif setara.
- Hindari pola jawaban yang mudah ditebak (misalnya opsi "Semua benar" atau "Tidak ada yang benar").

PANDUAN GAMBAR (IMAGE_SUGGESTION):
- Untuk soal SD, visualisasi sangat penting untuk keterlibatan siswa.
- Berikan deskripsi gambar yang detail, spesifik, dan relevan dengan konteks soal.
- Contoh: "Ilustrasi 4 ekor kucing dengan warna berbeda sedang bermain di taman" bukan "gambar kucing".
- Jika soal tidak memerlukan gambar, isi dengan string kosong "".

FORMAT OUTPUT (JSON):
Berikan HANYA format JSON valid tanpa markdown (tanpa \`\`\`json), tanpa teks pembuka/penutup. Struktur array:
{
  "questions": [
    {
      "id": 1,
      "question_text": "Pertanyaan utama...",
      "stimulus_text": "Teks cerita pendek/data pendukung (KOSONGKAN jika tidak perlu)",
      "image_suggestion": "Deskripsi visual detail untuk ilustrasi gambar (Wajib diisi untuk soal SD agar menarik)",
      "options": [
        "Teks Opsi Jawaban 1",
        "Teks Opsi Jawaban 2",
        "Teks Opsi Jawaban 3"
      ],
      "correct_index": 0,
      "correct_answer_text": "Teks jawaban benar",
      "explanation": "${include_explanation ? 'Penjelasan singkat langkah penyelesaian (untuk pembahasan).' : ''}",
      "cognitive_level": "Contoh: C3-Menerapkan"
    }
  ]
}

PENTING:
- Pastikan array "options" memiliki tepat ${options_count} elemen.
- correct_index harus berupa angka 0-${options_count - 1} (zero-based index).
- correct_answer_text harus sama persis dengan teks pada options[correct_index].
- Jangan tambahkan teks apapun di luar struktur JSON.
- Pastikan JSON valid (gunakan double quotes untuk string, escape karakter khusus).

MULAI GENERATE SEKARANG:`;
}

function getDifficultyGuidelines(level: 'Mudah' | 'Sedang' | 'Sulit'): string {
  switch (level) {
    case 'Mudah':
      return `- Gunakan pertanyaan faktual dan langsung
- Jawaban harus dapat ditemukan secara eksplisit dalam materi
- Hindari kalimat panjang atau berbelit-belit
- Gunakan kosakata sederhana yang sesuai tingkat kelas
- Fokus pada pengenalan konsep dasar (C1) atau pemahaman sederhana (C2)
- Contoh: "Apa nama hewan yang hidup di air dan bernapas dengan insang?"`;

    case 'Sedang':
      return `- Soal harus meminta penerapan prosedur atau rumus yang telah dipelajari
- Fokus pada "bagaimana melakukan" bukan "mengapa"
- Berikan data atau situasi standar yang memerlukan satu langkah penyelesaian
- Jawaban harus objektif dan dapat dihitung/ditentukan dengan pasti
- WAJIB: Hindari kata tanya "mengapa", "jelaskan alasanmu", "apakah benar"
- Contoh: "Ibu membeli 12 apel, kemudian memberikan 5 apel kepada kakak. Berapa sisa apel ibu?" (C3-Menerapkan)`;

    case 'Sulit':
      return `- Soal harus memerlukan analisis, evaluasi, atau penalaran multi-langkah
- Gunakan konteks situasi baru yang memerlukan transfer konsep
- Berikan stimulus yang lebih kompleks (cerita, data, diagram konseptual)
- Dorong siswa untuk membandingkan, menyimpulkan, atau mencari pola
- Boleh gunakan "mengapa", "bagaimana jika", "apa yang terjadi jika"
- Contoh: "Ani dan Budi berlari mengelilingi lapangan. Ani berlari 3 putaran dalam 6 menit, Budi 2 putaran dalam 5 menit. Siapa yang lebih cepat dan mengapa?" (C4-Analisis)`;

    default:
      return '';
  }
}

function getDistractorGuidance(quality: 'low' | 'medium' | 'high'): string {
  switch (quality) {
    case 'low':
      return `- Pengecoh boleh cukup berbeda dari jawaban benar
- Fokus pada kesalahan umum yang jelas
- Panjang opsi tidak perlu terlalu seragam`;

    case 'medium':
      return `- Pengecoh harus mirip dengan jawaban benar dalam struktur
- Gunakan kesalahan prosedural yang umum (misal: lupa langkah, salah operasi)
- Panjang opsi sebaiknya relatif sama`;

    case 'high':
      return `- Pengecoh harus sangat plausible dan sulit dibedakan tanpa pemahaman mendalam
- Gunakan common misconceptions atau kesalahan konseptual
- Setiap pengecoh harus punya "logical appeal" tersendiri
- Panjang semua opsi harus setara (±1-2 kata)
- Hindari petunjuk seperti "selalu", "tidak pernah", "semua"`;

    default:
      return '';
  }
}

/**
 * Parse and validate the model's JSON response
 */
export function parseQuestionResponse(text: string): GeneratedQuestionsResponse | null {
  try {
    // Remove potential markdown code blocks
    let cleanedText = text.trim();
    
    // Remove ```json and ``` if present
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
    
    // Try to find JSON object in the text
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }
    
    const parsed = JSON.parse(cleanedText) as GeneratedQuestionsResponse;
    
    // Validate structure
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      console.error('Invalid structure: questions array missing');
      return null;
    }
    
    // Validate each question
    for (const q of parsed.questions) {
      if (!q.question_text || !q.options || !Array.isArray(q.options)) {
        console.error('Invalid question structure:', q);
        return null;
      }
      if (typeof q.correct_index !== 'number' || q.correct_index < 0 || q.correct_index >= q.options.length) {
        console.error('Invalid correct_index:', q.correct_index, 'Options length:', q.options.length);
        return null;
      }
    }
    
    return parsed;
  } catch (error) {
    console.error('Failed to parse question response:', error);
    console.error('Raw text:', text);
    return null;
  }
}

/**
 * Get recommended model parameters based on difficulty level
 * KRITIS: Temperature rendah (0.2-0.3) agar AI patuh instruksi, tidak berimajinasi
 */
export function getModelParameters(level: 'Mudah' | 'Sedang' | 'Sulit') {
  // Gunakan temperature rendah untuk semua level agar patuh pedoman ketat
  switch (level) {
    case 'Mudah':
      return {
        temperature: 0.2, // Sangat rendah untuk faktual/hafalan
        maxOutputTokens: 2000,
        topP: 0.8,
        topK: 40,
        responseMimeType: "application/json" // Wajib JSON bersih
      };
    case 'Sedang':
      return {
        temperature: 0.25, // Rendah agar tidak melenceng ke analisis
        maxOutputTokens: 3000,
        topP: 0.8,
        topK: 40,
        responseMimeType: "application/json"
      };
    case 'Sulit':
      return {
        temperature: 0.3, // Tetap rendah meski HOTS
        maxOutputTokens: 4000,
        topP: 0.85,
        topK: 45,
        responseMimeType: "application/json"
      };
    default:
      return {
        temperature: 0.25,
        maxOutputTokens: 3000,
        topP: 0.8,
        topK: 40,
        responseMimeType: "application/json"
      };
  }
}
