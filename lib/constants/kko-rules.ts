/**
 * KKO (Kata Kerja Operasional) Rules per Phase
 * Based on Bloom's Taxonomy for Kurikulum Merdeka
 */

export interface KKORules {
  appropriate: readonly string[];
  inappropriate: readonly string[];
}

export const PHASE_KKO_RULES: Record<'FASE_A' | 'FASE_B' | 'FASE_C', KKORules> = {
  FASE_A: {
    appropriate: [
      'menyebutkan',
      'menunjukkan',
      'menghitung',
      'menceritakan',
      'meniru',
      'mengelompokkan',
      'membandingkan'
    ],
    inappropriate: [
      'menganalisis',
      'mengevaluasi',
      'mensintesis',
      'merancang sistem',
      'mengkritisi'
    ]
  },
  FASE_B: {
    appropriate: [
      'menjelaskan',
      'menghitung',
      'membandingkan',
      'mengelompokkan',
      'menerapkan',
      'mempraktikkan',
      'mengidentifikasi'
    ],
    inappropriate: [
      'mengevaluasi teori',
      'mensintesis',
      'mengkritisi',
      'merancang sistem kompleks'
    ]
  },
  FASE_C: {
    appropriate: [
      'menganalisis',
      'membandingkan',
      'mengkategorikan',
      'menyimpulkan',
      'memecahkan',
      'mengidentifikasi',
      'menghubungkan'
    ],
    inappropriate: [
      'mensintesis teori',
      'merancang sistem kompleks',
      'mengkritisi teori'
    ]
  }
} as const;

export const DEFAULT_FASE = 'FASE_B' as const;
