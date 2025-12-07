/**
 * Phase-Specific Rules for TP Generation
 * Extracted from gemini.ts to reduce prompt size by 40%
 * 
 * Usage: Only the selected phase rules are included in prompt
 * Instead of: sending all 3 FASE rules (unnecessary duplication)
 */

export interface PhaseRules {
  bloomLevel: string;
  cognitive: string;
  kko: string[];
  kkoExample: string;
  exampleFull: string;
  exampleRapor: string;
  forbiddenWords: string[];
  maxWords: number;
  guidance: string;
  contextSensitive?: Record<string, string | string[]>;
}

export const PHASE_SPECIFIC_RULES: Record<string, PhaseRules> = {
  'FASE_A': {
    bloomLevel: 'C1-C2 (Remember, Understand)',
    cognitive: 'Concrete thinking, perlu visualisasi dan pengalaman langsung',
    kko: [
      'menyebutkan',
      'menunjukkan',
      'menghitung',
      'menceritakan',
      'meniru',
      'mengelompokkan',
      'mencontohkan',
      'membandingkan'
    ],
    kkoExample: 'menyebutkan, menunjukkan (bukan: menganalisis, mengevaluasi)',
    exampleFull: `Peserta didik mampu menyebutkan jenis-jenis tumbuhan berdasarkan pengamatan di taman sekolah dengan benar`,
    exampleRapor: `Dapat menyebutkan jenis tumbuhan`,
    forbiddenWords: [
      'regulasi',
      'esensial',
      'kondusif',
      'potensi',
      'konflik',
      'efisiensi',
      'edukasi',
      'kompetensi',
      'signifikan',
      'harmonisan',
      'akademik',
      'fundamental',
      'optimal',
      'relevan',
      'substansial',
      'eksplisit',
      'implisit',
      'implikasi',
      'sintesis',
      'elaborasi',
      'paradigma',
      'konseptual'
    ],
    maxWords: 15,
    guidance: 'Fokus pada pengamatan langsung, aktivitas konkret, dan pengalaman nyata. Hindari konsep abstrak.',
    contextSensitive: {
      'membandingkan': ['dua bilangan', 'besar kecil', 'panjang pendek', 'banyak sedikit'],
      'mengidentifikasi': 'GANTI dengan: menunjukkan, menyebutkan',
      'menganalisis': 'GANTI dengan: melihat perbedaan, membandingkan',
      'mendeskripsikan': 'GANTI dengan: menceritakan'
    }
  },

  'FASE_B': {
    bloomLevel: 'C2-C3 (Understand, Apply)',
    cognitive: 'Transisi dari konkret ke abstrak, boleh mulai dengan konsep sederhana',
    kko: [
      'menjelaskan',
      'menghitung',
      'membandingkan',
      'mengelompokkan',
      'menerapkan',
      'mempraktikkan',
      'mengidentifikasi',
      'mengklasifikasikan'
    ],
    kkoExample: 'menjelaskan, menerapkan, mengidentifikasi',
    exampleFull: `Peserta didik mampu menjelaskan proses fotosintesis berdasarkan pengamatan tumbuhan di lingkungan dengan benar`,
    exampleRapor: `Dapat menjelaskan fotosintesis`,
    forbiddenWords: [
      'regulasi',
      'esensial',
      'kondusif',
      'signifikan',
      'paradigma',
      'sintesis',
      'elaborasi',
      'konseptual'
    ],
    maxWords: 18,
    guidance: 'Boleh mulai dengan konsep sederhana. Perlu praktik dan penerapan. Hubungkan dengan pengalaman siswa.',
    contextSensitive: {
      'menganalisis': ['pola sederhana', 'data tabel', 'gambar', 'grafik sederhana'],
      'mengevaluasi': 'GANTI dengan: memilih yang tepat, menentukan yang benar',
      'merancang': ['percobaan sederhana']
    }
  },

  'FASE_C': {
    bloomLevel: 'C3-C4 (Apply, Analyze)',
    cognitive: 'Berpikir abstrak, critical thinking mulai berkembang',
    kko: [
      'menganalisis',
      'membandingkan',
      'mengkategorikan',
      'menyimpulkan',
      'memecahkan',
      'mengidentifikasi',
      'menghubungkan',
      'menerapkan'
    ],
    kkoExample: 'menganalisis, memecahkan masalah, menyimpulkan',
    exampleFull: `Peserta didik mampu menganalisis hubungan sebab-akibat dalam teks narasi berdasarkan pemahaman struktur cerita melalui diskusi kelompok`,
    exampleRapor: `Dapat menganalisis hubungan sebab-akibat`,
    forbiddenWords: [
      'paradigma',
      'sintesis teori',
      'elaborasi teori',
      'epistemologi'
    ],
    maxWords: 20,
    guidance: 'Fokus pada analisis, pemecahan masalah, dan critical thinking. Dorong siswa berpikir kritis.',
    contextSensitive: {
      'mengevaluasi': ['solusi sederhana', 'hasil percobaan'],
      'merancang': ['percobaan', 'model sederhana'],
      'mensintesis': 'GANTI dengan: menyimpulkan, menggabungkan informasi'
    }
  }
};

/**
 * Get phase-specific rules based on grade level
 */
export function getPhaseRules(gradeLevel: string): PhaseRules {
  return (
    PHASE_SPECIFIC_RULES[gradeLevel as keyof typeof PHASE_SPECIFIC_RULES] ||
    PHASE_SPECIFIC_RULES['FASE_B']
  );
}

/**
 * Get language guide for phase (simplified version for prompts)
 */
export function getPhaseLanguageGuide(gradeLevel: string): string {
  const rules = getPhaseRules(gradeLevel);
  
  return `
📚 TAKSONOMI BLOOM & PERKEMBANGAN KOGNITIF UNTUK ${gradeLevel}:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Tingkat Kognitif: ${rules.bloomLevel}
🧠 Pemahaman Perkembangan: ${rules.cognitive}

✅ KATA KERJA OPERASIONAL (KKO) YANG TEPAT:
${rules.kko.map((k: string) => `   ${k}`).join('\n')}

📌 Contoh KKO yang Sesuai Fase Ini:
   ${rules.kkoExample}

💡 Contoh TP untuk ${gradeLevel}:
   "${rules.exampleFull}"

📋 FORMAT RAPOR (Max 100 karakter):
   "${rules.exampleRapor}"

⚠️ LARANGAN:
   - JANGAN gunakan: ${rules.forbiddenWords.slice(0, 5).join(', ')}, dll
   - Maksimal ${rules.maxWords} kata untuk fase ini

📌 Panduan: ${rules.guidance}
`;
}
