/**
 * Constants for TP normalization and validation
 */

export const TP_KERANJANG = ['A', 'B', 'C'] as const;

export const TP_DEFAULTS = {
  KERANJANG: 'A' as const,
  CAKUPAN_MATERI: 'Topik pembelajaran',
  AUDIENCE_PREFIX: 'Peserta didik mampu ',
  AUDIENCE_PREFIX_SHORT: 'Peserta didik '
} as const;

export const QUALITY_SCORE = {
  BASE: 100,
  WARNING_PENALTY: 5,
  CORRECTION_PENALTY: 3,
  MIN_SCORE: 0,
  HIGH_QUALITY_THRESHOLD: 2
} as const;

export const ABCD_CONDITION_KEYWORDS = [
  'melalui',
  'dengan menggunakan',
  'berdasarkan',
  'setelah',
  'menggunakan',
  'dari',
  'pada',
  'dalam konteks'
] as const;

export const ABCD_DEGREE_KEYWORDS = [
  'dengan benar',
  'dengan tepat',
  'dengan akurat',
  'secara sistematis',
  'minimal',
  'maksimal',
  'tanpa bantuan',
  'sesuai',
  'runtut'
] as const;

/**
 * Efficient deep clone using native structuredClone (Node 17+)
 * Falls back to manual clone for older environments
 */
export function deepClone<T>(obj: T): T {
  if (typeof structuredClone !== 'undefined') {
    return structuredClone(obj);
  }
  return deepCloneFallback(obj);
}

function deepCloneFallback<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepCloneFallback(item)) as any;
  }
  
  const cloned: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepCloneFallback(obj[key]);
    }
  }
  return cloned;
}
