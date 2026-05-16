/**
 * Unit Tests for Output Normalizer
 * Tests TP normalization, validation, and quality scoring
 */
import { 
  normalizeTPOutput, 
  calculateQualityScore, 
  getImprovementSuggestions 
} from '../output-normalizer';
import type { TPOutput, NormalizationResult } from '../tp-types';

describe('normalizeTPOutput', () => {
  describe('Basic Normalization', () => {
    it('should handle empty input gracefully', () => {
      const input: TPOutput = {
        semester1: [],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1).toEqual([]);
      expect(result.normalized.semester2).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.corrections).toEqual([]);
    });

    it('should not mutate original input', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'menghitung penjumlahan',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const originalJSON = JSON.stringify(input);
      normalizeTPOutput(input, 'FASE_B');
      const afterJSON = JSON.stringify(input);

      expect(originalJSON).toBe(afterJSON);
    });

    it('should validate gradeLevel parameter', () => {
      const input: TPOutput = { semester1: [], semester2: [] };

      expect(() => {
        normalizeTPOutput(input, 'INVALID' as any);
      }).toThrow('Invalid gradeLevel');
    });

    it('should validate input is object', () => {
      expect(() => {
        normalizeTPOutput(null as any, 'FASE_B');
      }).toThrow('Invalid input: raw must be an object');
    });
  });

  describe('Audience Prefix (ABCD - A)', () => {
    it('should add "Peserta didik mampu" when missing audience', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'menghitung penjumlahan',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1[0].tp_1).toBe('Peserta didik mampu menghitung penjumlahan');
      expect(result.corrections).toContainEqual(
        expect.stringContaining('Prepended ABCD Audience')
      );
    });

    it('should add "Peserta didik" when starts with "mampu"', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'mampu menghitung penjumlahan',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1[0].tp_1).toBe('Peserta didik mampu menghitung penjumlahan');
      expect(result.corrections).toContainEqual(
        expect.stringContaining('Added "Peserta didik"')
      );
    });

    it('should convert "dapat" to "mampu"', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'dapat menghitung penjumlahan',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1[0].tp_1).toMatch(/Peserta didik mampu/);
    });

    it('should not modify TP that already has "Peserta didik"', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'Peserta didik mampu menghitung penjumlahan',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1[0].tp_1).toBe('Peserta didik mampu menghitung penjumlahan');
      expect(result.corrections.filter(c => c.includes('tp_1'))).toEqual([]);
    });
  });

  describe('Capitalization', () => {
    it('should capitalize first letter', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'peserta didik mampu menghitung',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1[0].tp_1.charAt(0)).toBe('P');
    });
  });

  describe('Trailing Period Removal', () => {
    it('should remove trailing period', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'Peserta didik mampu menghitung penjumlahan.',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1[0].tp_1).not.toMatch(/\.$/);
    });
  });

  describe('Length Validation', () => {
    it('should warn when TP exceeds maxLength', () => {
      const longTP = 'Peserta didik mampu ' + 'x'.repeat(100);
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: longTP,
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B', { maxLength: 100 });

      expect(result.warnings).toContainEqual(
        expect.stringContaining('Exceeds 100 chars')
      );
    });

    it('should not warn when TP is within maxLength', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'Peserta didik mampu menghitung',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B', { maxLength: 100 });

      expect(result.warnings.filter(w => w.includes('Exceeds'))).toEqual([]);
    });
  });

  describe('KKO Validation', () => {
    it('should warn when using KKO too advanced for FASE_A', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'Peserta didik mampu menganalisis data kompleks',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_A');

      expect(result.warnings).toContainEqual(
        expect.stringContaining('KKO issue')
      );
    });

    it('should accept appropriate KKO for FASE_B', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'Peserta didik mampu menjelaskan konsep penjumlahan',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.warnings.filter(w => w.includes('KKO issue'))).toEqual([]);
    });

    it('should accept analysis verbs for FASE_C', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'Peserta didik mampu menganalisis hubungan antar variabel',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_C');

      expect(result.warnings.filter(w => w.includes('KKO issue'))).toEqual([]);
    });
  });

  describe('ABCD Completeness', () => {
    it('should warn when missing Condition (C)', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'Peserta didik mampu menghitung',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.warnings).toContainEqual(
        expect.stringContaining('Missing ABCD')
      );
    });

    it('should not warn when all ABCD components present', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'Peserta didik mampu menghitung penjumlahan dengan menggunakan alat peraga dengan benar',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.warnings.filter(w => w.includes('Missing ABCD'))).toEqual([]);
    });
  });

  describe('Keranjang Validation', () => {
    it('should default invalid keranjang to A', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'Peserta didik mampu menghitung',
          keranjang_1: 'X' as any,
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1[0].keranjang_1).toBe('A');
      expect(result.corrections).toContainEqual(
        expect.stringContaining("defaulted to 'A'")
      );
    });

    it('should accept valid keranjang values', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 3,
          tp_1: 'Peserta didik mampu menghitung',
          tp_2: 'Peserta didik mampu menghitung',
          tp_3: 'Peserta didik mampu menghitung',
          keranjang_1: 'A',
          keranjang_2: 'B',
          keranjang_3: 'C',
          cakupan_materi_1: 'Mat',
          cakupan_materi_2: 'Mat',
          cakupan_materi_3: 'Mat'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1[0].keranjang_1).toBe('A');
      expect(result.normalized.semester1[0].keranjang_2).toBe('B');
      expect(result.normalized.semester1[0].keranjang_3).toBe('C');
    });
  });

  describe('Cakupan Materi', () => {
    it('should add default cakupan_materi when missing', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'Peserta didik mampu menghitung',
          keranjang_1: 'A',
          cakupan_materi_1: ''
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1[0].cakupan_materi_1).toBe('Topik pembelajaran');
      expect(result.corrections).toContainEqual(
        expect.stringContaining('Missing, added default')
      );
    });

    it('should preserve existing cakupan_materi', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'Peserta didik mampu menghitung',
          keranjang_1: 'A',
          cakupan_materi_1: 'Operasi Hitung'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1[0].cakupan_materi_1).toBe('Operasi Hitung');
    });
  });

  describe('Multiple Semesters', () => {
    it('should normalize both semesters', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'menghitung',
          keranjang_1: 'A',
          cakupan_materi_1: 'Mat'
        }],
        semester2: [{
          chapter: 'Bab 2',
          tp_count: 1,
          tp_1: 'membaca',
          keranjang_1: 'B',
          cakupan_materi_1: 'IPA'
        }]
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1[0].tp_1).toMatch(/^Peserta didik/);
      expect(result.normalized.semester2[0].tp_1).toMatch(/^Peserta didik/);
    });
  });

  describe('Multiple TPs per Chapter', () => {
    it('should normalize all TPs in a chapter', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 3,
          tp_1: 'menghitung',
          tp_2: 'membaca',
          tp_3: 'menulis',
          keranjang_1: 'A',
          keranjang_2: 'B',
          keranjang_3: 'C',
          cakupan_materi_1: 'M1',
          cakupan_materi_2: 'M2',
          cakupan_materi_3: 'M3'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B');

      expect(result.normalized.semester1[0].tp_1).toMatch(/^Peserta didik/);
      expect(result.normalized.semester1[0].tp_2).toMatch(/^Peserta didik/);
      expect(result.normalized.semester1[0].tp_3).toMatch(/^Peserta didik/);
    });
  });

  describe('AutoFix Option', () => {
    it('should not fix when autoFix is false', () => {
      const input: TPOutput = {
        semester1: [{
          chapter: 'Bab 1',
          tp_count: 1,
          tp_1: 'menghitung penjumlahan',
          keranjang_1: 'A',
          cakupan_materi_1: 'Matematika'
        }],
        semester2: []
      };

      const result = normalizeTPOutput(input, 'FASE_B', { autoFix: false });

      // Should still have warning but no correction
      expect(result.normalized.semester1[0].tp_1).toBe('menghitung penjumlahan');
    });
  });
});

describe('calculateQualityScore', () => {
  it('should return 100 for perfect output', () => {
    const result: NormalizationResult = {
      normalized: { semester1: [], semester2: [] },
      warnings: [],
      corrections: []
    };

    expect(calculateQualityScore(result)).toBe(100);
  });

  it('should deduct 5 points per warning', () => {
    const result: NormalizationResult = {
      normalized: { semester1: [], semester2: [] },
      warnings: ['warning1', 'warning2'],
      corrections: []
    };

    expect(calculateQualityScore(result)).toBe(90); // 100 - (2 * 5)
  });

  it('should deduct 3 points per correction', () => {
    const result: NormalizationResult = {
      normalized: { semester1: [], semester2: [] },
      warnings: [],
      corrections: ['correction1', 'correction2', 'correction3']
    };

    expect(calculateQualityScore(result)).toBe(91); // 100 - (3 * 3)
  });

  it('should not go below 0', () => {
    const result: NormalizationResult = {
      normalized: { semester1: [], semester2: [] },
      warnings: Array(50).fill('warning'),
      corrections: Array(50).fill('correction')
    };

    expect(calculateQualityScore(result)).toBe(0);
  });

  it('should handle mixed warnings and corrections', () => {
    const result: NormalizationResult = {
      normalized: { semester1: [], semester2: [] },
      warnings: ['w1', 'w2', 'w3'], // -15
      corrections: ['c1', 'c2'] // -6
    };

    expect(calculateQualityScore(result)).toBe(79); // 100 - 15 - 6
  });
});

describe('getImprovementSuggestions', () => {
  it('should suggest retry for length issues', () => {
    const result: NormalizationResult = {
      normalized: { semester1: [], semester2: [] },
      warnings: ['Exceeds 100 chars', 'Exceeds 100 chars'],
      corrections: []
    };

    const suggestions = getImprovementSuggestions(result);

    expect(suggestions).toContainEqual(
      expect.stringContaining('melebihi batas karakter')
    );
  });

  it('should suggest retry for KKO issues', () => {
    const result: NormalizationResult = {
      normalized: { semester1: [], semester2: [] },
      warnings: ['KKO issue: too advanced'],
      corrections: []
    };

    const suggestions = getImprovementSuggestions(result);

    expect(suggestions).toContainEqual(
      expect.stringContaining('KKO tidak sesuai fase')
    );
  });

  it('should suggest retry for ABCD issues', () => {
    const result: NormalizationResult = {
      normalized: { semester1: [], semester2: [] },
      warnings: ['Missing ABCD: C (Condition)'],
      corrections: []
    };

    const suggestions = getImprovementSuggestions(result);

    expect(suggestions).toContainEqual(
      expect.stringContaining('kurang komponen ABCD')
    );
  });

  it('should indicate high quality when minimal issues', () => {
    const result: NormalizationResult = {
      normalized: { semester1: [], semester2: [] },
      warnings: [],
      corrections: ['correction1']
    };

    const suggestions = getImprovementSuggestions(result);

    expect(suggestions).toContainEqual(
      expect.stringContaining('berkualitas tinggi')
    );
  });

  it('should handle multiple issue types', () => {
    const result: NormalizationResult = {
      normalized: { semester1: [], semester2: [] },
      warnings: [
        'Exceeds 100 chars',
        'KKO issue',
        'Missing ABCD: D'
      ],
      corrections: []
    };

    const suggestions = getImprovementSuggestions(result);

    expect(suggestions.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Integration Tests', () => {
  it('should handle realistic TP generation output', () => {
    const input: TPOutput = {
      semester1: [
        {
          chapter: 'Bilangan Cacah',
          tp_count: 2,
          tp_1: 'menghitung penjumlahan bilangan cacah sampai 100',
          tp_2: 'Peserta didik mampu mengurangkan bilangan cacah sampai 100 dengan benar',
          keranjang_1: 'A',
          keranjang_2: 'A',
          cakupan_materi_1: 'Operasi Hitung',
          cakupan_materi_2: 'Operasi Hitung'
        }
      ],
      semester2: [
        {
          chapter: 'Geometri',
          tp_count: 1,
          tp_1: 'dapat mengidentifikasi bentuk geometri sederhana.',
          keranjang_1: 'B',
          cakupan_materi_1: ''
        }
      ]
    };

    const result = normalizeTPOutput(input, 'FASE_A', { maxLength: 100 });

    // Check semester 1
    expect(result.normalized.semester1[0].tp_1).toMatch(/^Peserta didik mampu/);
    expect(result.normalized.semester1[0].tp_2).not.toMatch(/\.$/);

    // Check semester 2
    expect(result.normalized.semester2[0].tp_1).toMatch(/^Peserta didik mampu/);
    expect(result.normalized.semester2[0].tp_1).not.toMatch(/\.$/);
    expect(result.normalized.semester2[0].cakupan_materi_1).toBe('Topik pembelajaran');

    // Check quality
    const score = calculateQualityScore(result);
    expect(score).toBeGreaterThan(50);
  });
});
