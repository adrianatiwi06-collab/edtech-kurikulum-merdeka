/**
 * Output Normalizer for TP Generation
 * Ensures consistent format and quality across all AI responses
 * Part of Critical AI Prompt Engineering Fix
 */

export interface TPOutput {
  semester1: any[];
  semester2: any[];
}

export interface NormalizationResult {
  normalized: TPOutput;
  warnings: string[];
  corrections: string[];
}

/**
 * Normalize and validate TP output from Gemini API
 * Fixes common AI output issues:
 * - Missing ABCD components
 * - Inconsistent formatting
 * - Invalid KKO for grade level
 * - Length violations
 */
export function normalizeTPOutput(
  raw: any,
  gradeLevel: string,
  maxLength100?: boolean
): NormalizationResult {
  const warnings: string[] = [];
  const corrections: string[] = [];
  
  // Deep clone to avoid mutation
  const normalized: TPOutput = {
    semester1: JSON.parse(JSON.stringify(raw.semester1 || [])),
    semester2: JSON.parse(JSON.stringify(raw.semester2 || []))
  };

  // Process each semester
  [normalized.semester1, normalized.semester2].forEach((semester, semIndex) => {
    const semNum = semIndex + 1;
    
    semester.forEach((chapter: any, chapterIndex: number) => {
      const chapterName = chapter.chapter || `Bab ${chapterIndex + 1}`;
      
      // Normalize TP fields
      const tpCount = chapter.tp_count || 0;
      
      for (let i = 1; i <= tpCount; i++) {
        const tpKey = `tp_${i}`;
        const keranjangKey = `keranjang_${i}`;
        const cakupanKey = `cakupan_materi_${i}`;
        
        if (!chapter[tpKey]) {
          warnings.push(`[Sem${semNum}][${chapterName}] Missing ${tpKey}`);
          continue;
        }
        
        let tp = chapter[tpKey].trim();
        const originalTP = tp;
        let modified = false;
        
        // ✅ FIX 1: Ensure starts with "Peserta didik"
        if (!tp.toLowerCase().includes('peserta didik')) {
          if (tp.toLowerCase().startsWith('dapat ')) {
            tp = 'Peserta didik mampu ' + tp.substring(6);
            modified = true;
            corrections.push(`[Sem${semNum}][${chapterName}][${tpKey}] Added "Peserta didik mampu"`);
          } else if (tp.toLowerCase().startsWith('mampu ')) {
            tp = 'Peserta didik ' + tp;
            modified = true;
            corrections.push(`[Sem${semNum}][${chapterName}][${tpKey}] Added "Peserta didik"`);
          } else {
            tp = 'Peserta didik mampu ' + tp;
            modified = true;
            corrections.push(`[Sem${semNum}][${chapterName}][${tpKey}] Prepended ABCD Audience`);
          }
        }
        
        // ✅ FIX 2: Capitalize first letter properly
        if (tp.charAt(0) !== tp.charAt(0).toUpperCase()) {
          tp = tp.charAt(0).toUpperCase() + tp.slice(1);
          modified = true;
        }
        
        // ✅ FIX 3: Remove trailing period if present
        if (tp.endsWith('.')) {
          tp = tp.slice(0, -1);
          modified = true;
        }
        
        // ✅ FIX 4: Check length constraint
        if (maxLength100 && tp.length > 100) {
          warnings.push(
            `[Sem${semNum}][${chapterName}][${tpKey}] Exceeds 100 chars (${tp.length}): "${tp.substring(0, 100)}..."`
          );
          // Note: We don't auto-trim as it might lose meaning
          // Let retry logic handle this
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
          const keranjang = chapter[keranjangKey].toUpperCase();
          if (!['A', 'B', 'C'].includes(keranjang)) {
            chapter[keranjangKey] = 'A'; // Default to A
            corrections.push(
              `[Sem${semNum}][${chapterName}][${keranjangKey}] Invalid value, defaulted to 'A'`
            );
          }
        }
        
        // ✅ FIX 8: Ensure cakupan_materi exists
        if (!chapter[cakupanKey] || chapter[cakupanKey].trim() === '') {
          chapter[cakupanKey] = 'Topik pembelajaran';
          corrections.push(
            `[Sem${semNum}][${chapterName}][${cakupanKey}] Missing, added default`
          );
        }
      }
    });
  });
  
  return {
    normalized,
    warnings,
    corrections
  };
}

/**
 * Validate KKO (Kata Kerja Operasional) for specific grade level
 */
function validateKKOForGrade(tp: string, gradeLevel: string): { valid: boolean; message: string } {
  const tpLower = tp.toLowerCase();
  
  const phaseKKO: Record<string, { appropriate: string[]; inappropriate: string[] }> = {
    'FASE_A': {
      appropriate: ['menyebutkan', 'menunjukkan', 'menghitung', 'menceritakan', 'meniru', 'mengelompokkan', 'membandingkan'],
      inappropriate: ['menganalisis', 'mengevaluasi', 'mensintesis', 'merancang sistem', 'mengkritisi']
    },
    'FASE_B': {
      appropriate: ['menjelaskan', 'menghitung', 'membandingkan', 'mengelompokkan', 'menerapkan', 'mempraktikkan', 'mengidentifikasi'],
      inappropriate: ['mengevaluasi teori', 'mensintesis', 'mengkritisi', 'merancang sistem kompleks']
    },
    'FASE_C': {
      appropriate: ['menganalisis', 'membandingkan', 'mengkategorikan', 'menyimpulkan', 'memecahkan', 'mengidentifikasi', 'menghubungkan'],
      inappropriate: ['mensintesis teori', 'merancang sistem kompleks', 'mengkritisi teori']
    }
  };
  
  const rules = phaseKKO[gradeLevel] || phaseKKO['FASE_B'];
  
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
function checkABCDCompleteness(tp: string): { complete: boolean; missing: string[] } {
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
  const conditionKeywords = [
    'melalui', 'dengan menggunakan', 'berdasarkan', 'setelah', 
    'menggunakan', 'dari', 'pada', 'dalam konteks'
  ];
  const hasCondition = conditionKeywords.some(keyword => tpLower.includes(keyword));
  if (!hasCondition) {
    missing.push('C (Condition)');
  }
  
  // D - Degree - Look for quality/quantity indicators
  const degreeKeywords = [
    'dengan benar', 'dengan tepat', 'dengan akurat', 'secara sistematis',
    'minimal', 'maksimal', 'tanpa bantuan', 'sesuai', 'runtut'
  ];
  const hasDegree = degreeKeywords.some(keyword => tpLower.includes(keyword));
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
  let score = 100;
  
  // Deduct points for warnings
  score -= result.warnings.length * 5;
  
  // Deduct points for corrections needed
  score -= result.corrections.length * 3;
  
  // Ensure score doesn't go below 0
  return Math.max(0, score);
}

/**
 * Get improvement suggestions based on normalization results
 */
export function getImprovementSuggestions(result: NormalizationResult): string[] {
  const suggestions: string[] = [];
  
  const lengthWarnings = result.warnings.filter(w => w.includes('Exceeds 100 chars'));
  if (lengthWarnings.length > 0) {
    suggestions.push(
      `${lengthWarnings.length} TP melebihi 100 karakter. Pertimbangkan retry dengan emphasis pada brevity.`
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
  
  if (result.warnings.length === 0 && result.corrections.length <= 2) {
    suggestions.push('✅ Output berkualitas tinggi. Tidak perlu retry.');
  }
  
  return suggestions;
}
