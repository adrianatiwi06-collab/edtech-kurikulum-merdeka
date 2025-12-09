/**
 * Output Normalizer for TP Generation
 * Ensures consistent format and quality across all AI responses
 * Part of Critical AI Prompt Engineering Fix
 * 
 * @version 2.0.0 - Refactored with proper types and extracted constants
 */

import type { 
  TPOutput, 
  Chapter,
  GradeLevel, 
  NormalizationResult, 
  NormalizationOptions,
  KKOValidationResult,
  ABCDCheckResult 
} from './tp-types';

import { 
  TP_KERANJANG,
  TP_DEFAULTS, 
  QUALITY_SCORE,
  ABCD_CONDITION_KEYWORDS,
  ABCD_DEGREE_KEYWORDS,
  deepClone 
} from './tp-constants';

import { PHASE_KKO_RULES, DEFAULT_FASE } from '@/lib/constants/kko-rules';

/**
 * Normalize and validate TP output from Gemini API
 * Fixes common AI output issues:
 * - Missing ABCD components
 * - Inconsistent formatting
 * - Invalid KKO for grade level
 * - Length violations
 * 
 * @param raw - Raw TP output from AI
 * @param gradeLevel - Grade level phase (FASE_A, FASE_B, FASE_C)
 * @param options - Normalization options
 * @returns Normalized output with warnings and corrections
 */
export function normalizeTPOutput(
  raw: TPOutput | Partial<TPOutput>,
  gradeLevel: GradeLevel,
  options: NormalizationOptions = {}
): NormalizationResult {
  const { maxLength, autoFix = true } = options;
  const warnings: string[] = [];
  const corrections: string[] = [];
  
  // Input validation
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid input: raw must be an object');
  }
  
  if (!['FASE_A', 'FASE_B', 'FASE_C'].includes(gradeLevel)) {
    throw new Error(`Invalid gradeLevel: ${gradeLevel}. Must be FASE_A, FASE_B, or FASE_C`);
  }
  
  // ✅ PERFORMANCE FIX: Use structuredClone instead of JSON.parse/stringify
  const normalized: TPOutput = {
    semester1: deepClone(raw.semester1 || []),
    semester2: deepClone(raw.semester2 || [])
  };

  // Process each semester
  processSemesters(normalized, gradeLevel, maxLength, autoFix, warnings, corrections);
  
  return {
    normalized,
    warnings,
    corrections
  };
}

/**
 * Process both semesters
 */
function processSemesters(
  normalized: TPOutput,
  gradeLevel: GradeLevel,
  maxLength: number | undefined,
  autoFix: boolean,
  warnings: string[],
  corrections: string[]
): void {
  [normalized.semester1, normalized.semester2].forEach((semester, semIndex) => {
    const semNum = semIndex + 1;
    
    semester.forEach((chapter: Chapter, chapterIndex: number) => {
      processChapter(chapter, semNum, chapterIndex, gradeLevel, maxLength, autoFix, warnings, corrections);
    });
  });
}

/**
 * Process single chapter
 */
function processChapter(
  chapter: Chapter,
  semNum: number,
  chapterIndex: number,
  gradeLevel: GradeLevel,
  maxLength: number | undefined,
  autoFix: boolean,
  warnings: string[],
  corrections: string[]
): void {
  const chapterName = chapter.chapter || `Bab ${chapterIndex + 1}`;
  const tpCount = chapter.tp_count || 0;
  
  for (let i = 1; i <= tpCount; i++) {
    processTP(chapter, i, semNum, chapterName, gradeLevel, maxLength, autoFix, warnings, corrections);
  }
}

/**
 * Process single TP
 */
function processTP(
  chapter: Chapter,
  tpNumber: number,
  semNum: number,
  chapterName: string,
  gradeLevel: GradeLevel,
  maxLength: number | undefined,
  autoFix: boolean,
  warnings: string[],
  corrections: string[]
): void {
  const tpKey = `tp_${tpNumber}` as const;
  const keranjangKey = `keranjang_${tpNumber}` as const;
  const cakupanKey = `cakupan_materi_${tpNumber}` as const;
  
  // Check if TP exists
  if (!chapter[tpKey]) {
    warnings.push(`[Sem${semNum}][${chapterName}] Missing ${tpKey}`);
    return;
  }
  
  let tp = chapter[tpKey].trim();
  let modified = false;
  
  // ✅ FIX 1: Ensure starts with "Peserta didik"
  if (autoFix && !tp.toLowerCase().includes('peserta didik')) {
    const result = fixAudiencePrefix(tp);
    tp = result.fixed;
    modified = result.modified;
    if (modified) {
      corrections.push(`[Sem${semNum}][${chapterName}][${tpKey}] ${result.message}`);
    }
  }
  
  // ✅ FIX 2: Capitalize first letter properly
  if (autoFix && tp.charAt(0) !== tp.charAt(0).toUpperCase()) {
    tp = tp.charAt(0).toUpperCase() + tp.slice(1);
    modified = true;
  }
  
  // ✅ FIX 3: Remove trailing period if present
  if (autoFix && tp.endsWith('.')) {
    tp = tp.slice(0, -1);
    modified = true;
  }
  
  // ✅ FIX 4: Check length constraint
  if (maxLength && tp.length > maxLength) {
    warnings.push(
      `[Sem${semNum}][${chapterName}][${tpKey}] Exceeds ${maxLength} chars (${tp.length}): "${tp.substring(0, maxLength)}..."`
    );
  }
  
  // ✅ FIX 5: Validate KKO for grade level
  const kkoValidation = validateKKOForGrade(tp, gradeLevel);
  if (!kkoValidation.valid) {
    warnings.push(
      `[Sem${semNum}][${chapterName}][${tpKey}] KKO issue: ${kkoValidation.message}`
    );
  }
  
  // ✅ FIX 6: Check ABCD completeness
  const abcdCheck = checkABCDCompleteness(tp);
  if (!abcdCheck.complete) {
    warnings.push(
      `[Sem${semNum}][${chapterName}][${tpKey}] Missing ABCD: ${abcdCheck.missing.join(', ')}`
    );
  }
  
  // Apply modifications
  if (modified) {
    chapter[tpKey] = tp;
  }
  
  // ✅ FIX 7: Validate keranjang value
  if (chapter[keranjangKey]) {
    const keranjang = chapter[keranjangKey].toUpperCase() as any;
    if (!TP_KERANJANG.includes(keranjang)) {
      chapter[keranjangKey] = TP_DEFAULTS.KERANJANG;
      corrections.push(
        `[Sem${semNum}][${chapterName}][${keranjangKey}] Invalid value, defaulted to '${TP_DEFAULTS.KERANJANG}'`
      );
    }
  }
  
  // ✅ FIX 8: Ensure cakupan_materi exists
  if (!chapter[cakupanKey] || chapter[cakupanKey].trim() === '') {
    chapter[cakupanKey] = TP_DEFAULTS.CAKUPAN_MATERI;
    corrections.push(
      `[Sem${semNum}][${chapterName}][${cakupanKey}] Missing, added default`
    );
  }
}

/**
 * Fix audience prefix
 */
function fixAudiencePrefix(tp: string): { fixed: string; modified: boolean; message: string } {
  const lower = tp.toLowerCase();
  
  if (lower.startsWith('dapat ')) {
    return {
      fixed: TP_DEFAULTS.AUDIENCE_PREFIX + tp.substring(6),
      modified: true,
      message: 'Added "Peserta didik mampu"'
    };
  }
  
  if (lower.startsWith('mampu ')) {
    return {
      fixed: TP_DEFAULTS.AUDIENCE_PREFIX_SHORT + tp,
      modified: true,
      message: 'Added "Peserta didik"'
    };
  }
  
  return {
    fixed: TP_DEFAULTS.AUDIENCE_PREFIX + tp,
    modified: true,
    message: 'Prepended ABCD Audience'
  };
}

/**
 * Validate KKO (Kata Kerja Operasional) for specific grade level
 */
function validateKKOForGrade(tp: string, gradeLevel: GradeLevel): KKOValidationResult {
  const tpLower = tp.toLowerCase();
  const rules = PHASE_KKO_RULES[gradeLevel] || PHASE_KKO_RULES[DEFAULT_FASE];
  
  // Check for inappropriate KKO
  for (const badKKO of rules.inappropriate) {
    if (tpLower.includes(badKKO)) {
      return {
        valid: false,
        message: `KKO "${badKKO}" terlalu tinggi untuk ${gradeLevel}`
      };
    }
  }
  
  // Check if any appropriate KKO exists
  const hasAppropriateKKO = rules.appropriate.some(kko => tpLower.includes(kko));
  
  if (!hasAppropriateKKO) {
    return {
      valid: false,
      message: `Tidak ditemukan KKO yang sesuai untuk ${gradeLevel}. Gunakan: ${rules.appropriate.slice(0, 3).join(', ')}, dll`
    };
  }
  
  return { valid: true, message: '' };
}

/**
 * Check ABCD (Audience, Behavior, Condition, Degree) completeness
 */
function checkABCDCompleteness(tp: string): ABCDCheckResult {
  const missing: string[] = [];
  const tpLower = tp.toLowerCase();
  
  // A - Audience
  if (!tpLower.includes('peserta didik')) {
    missing.push('A (Audience)');
  }
  
  // B - Behavior (KKO) - Basic check for verb
  const hasVerb = /\bmampu\s+(\w+)/i.test(tp) || /\bdapat\s+(\w+)/i.test(tp);
  if (!hasVerb) {
    missing.push('B (Behavior/KKO)');
  }
  
  // C - Condition - Look for common condition patterns
  const hasCondition = ABCD_CONDITION_KEYWORDS.some(keyword => tpLower.includes(keyword));
  if (!hasCondition) {
    missing.push('C (Condition)');
  }
  
  // D - Degree - Look for quality/quantity indicators
  const hasDegree = ABCD_DEGREE_KEYWORDS.some(keyword => tpLower.includes(keyword));
  if (!hasDegree) {
    missing.push('D (Degree)');
  }
  
  return {
    complete: missing.length === 0,
    missing
  };
}

/**
 * Calculate quality score for TP output (0-100)
 */
export function calculateQualityScore(result: NormalizationResult): number {
  let score = QUALITY_SCORE.BASE;
  
  // Deduct points for warnings
  score -= result.warnings.length * QUALITY_SCORE.WARNING_PENALTY;
  
  // Deduct points for corrections needed
  score -= result.corrections.length * QUALITY_SCORE.CORRECTION_PENALTY;
  
  // Ensure score doesn't go below minimum
  return Math.max(QUALITY_SCORE.MIN_SCORE, score);
}

/**
 * Get improvement suggestions based on normalization results
 */
export function getImprovementSuggestions(result: NormalizationResult): string[] {
  const suggestions: string[] = [];
  
  const lengthWarnings = result.warnings.filter(w => w.includes('Exceeds'));
  if (lengthWarnings.length > 0) {
    suggestions.push(
      `${lengthWarnings.length} TP melebihi batas karakter. Pertimbangkan retry dengan emphasis pada brevity.`
    );
  }
  
  const kkoWarnings = result.warnings.filter(w => w.includes('KKO issue'));
  if (kkoWarnings.length > 0) {
    suggestions.push(
      `${kkoWarnings.length} TP menggunakan KKO tidak sesuai fase. Perlu retry dengan KKO focus.`
    );
  }
  
  const abcdWarnings = result.warnings.filter(w => w.includes('Missing ABCD'));
  if (abcdWarnings.length > 0) {
    suggestions.push(
      `${abcdWarnings.length} TP kurang komponen ABCD. Perlu retry dengan ABCD validation.`
    );
  }
  
  if (result.warnings.length === 0 && result.corrections.length <= QUALITY_SCORE.HIGH_QUALITY_THRESHOLD) {
    suggestions.push('✅ Output berkualitas tinggi. Tidak perlu retry.');
  }
  
  return suggestions;
}

// Re-export types for convenience
export type {
  TPOutput,
  Chapter,
  GradeLevel,
  NormalizationResult,
  NormalizationOptions,
  KKOValidationResult,
  ABCDCheckResult
} from './tp-types';
