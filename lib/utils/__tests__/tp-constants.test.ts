/**
 * Unit Tests for TP Constants
 * Tests deep clone functionality and constant values
 */
import { 
  deepClone, 
  TP_KERANJANG, 
  TP_DEFAULTS, 
  QUALITY_SCORE,
  ABCD_CONDITION_KEYWORDS,
  ABCD_DEGREE_KEYWORDS
} from '../tp-constants';

describe('deepClone', () => {
  it('should clone primitive values', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(true)).toBe(true);
    expect(deepClone(null)).toBe(null);
    expect(deepClone(undefined)).toBe(undefined);
  });

  it('should clone arrays', () => {
    const original = [1, 2, 3];
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('should clone nested arrays', () => {
    const original = [[1, 2], [3, 4]];
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[0]).not.toBe(original[0]);
  });

  it('should clone objects', () => {
    const original = { a: 1, b: 2 };
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('should clone nested objects', () => {
    const original = { 
      a: 1, 
      b: { c: 2, d: { e: 3 } } 
    };
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
    expect(cloned.b.d).not.toBe(original.b.d);
  });

  it('should clone complex TP structure', () => {
    const original = {
      semester1: [{
        chapter: 'Bab 1',
        tp_count: 2,
        tp_1: 'TP 1',
        tp_2: 'TP 2'
      }],
      semester2: []
    };

    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned.semester1).not.toBe(original.semester1);
    expect(cloned.semester1[0]).not.toBe(original.semester1[0]);
  });

  it('should not share references after cloning', () => {
    const original = { a: { b: 1 } };
    const cloned = deepClone(original);

    cloned.a.b = 2;

    expect(original.a.b).toBe(1);
    expect(cloned.a.b).toBe(2);
  });

  it('should handle arrays of objects', () => {
    const original = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' }
    ];

    const cloned = deepClone(original);

    cloned[0].name = 'Modified';

    expect(original[0].name).toBe('Item 1');
    expect(cloned[0].name).toBe('Modified');
  });
});

describe('Constants', () => {
  it('TP_KERANJANG should have correct values', () => {
    expect(TP_KERANJANG).toEqual(['A', 'B', 'C']);
    expect(TP_KERANJANG.length).toBe(3);
  });

  it('TP_DEFAULTS should have correct values', () => {
    expect(TP_DEFAULTS.KERANJANG).toBe('A');
    expect(TP_DEFAULTS.CAKUPAN_MATERI).toBe('Topik pembelajaran');
    expect(TP_DEFAULTS.AUDIENCE_PREFIX).toBe('Peserta didik mampu ');
    expect(TP_DEFAULTS.AUDIENCE_PREFIX_SHORT).toBe('Peserta didik ');
  });

  it('QUALITY_SCORE should have correct values', () => {
    expect(QUALITY_SCORE.BASE).toBe(100);
    expect(QUALITY_SCORE.WARNING_PENALTY).toBe(5);
    expect(QUALITY_SCORE.CORRECTION_PENALTY).toBe(3);
    expect(QUALITY_SCORE.MIN_SCORE).toBe(0);
    expect(QUALITY_SCORE.HIGH_QUALITY_THRESHOLD).toBe(2);
  });

  it('ABCD_CONDITION_KEYWORDS should contain common patterns', () => {
    expect(ABCD_CONDITION_KEYWORDS).toContain('melalui');
    expect(ABCD_CONDITION_KEYWORDS).toContain('dengan menggunakan');
    expect(ABCD_CONDITION_KEYWORDS).toContain('berdasarkan');
    expect(ABCD_CONDITION_KEYWORDS.length).toBeGreaterThan(5);
  });

  it('ABCD_DEGREE_KEYWORDS should contain quality indicators', () => {
    expect(ABCD_DEGREE_KEYWORDS).toContain('dengan benar');
    expect(ABCD_DEGREE_KEYWORDS).toContain('dengan tepat');
    expect(ABCD_DEGREE_KEYWORDS).toContain('dengan akurat');
    expect(ABCD_DEGREE_KEYWORDS.length).toBeGreaterThan(5);
  });
});
