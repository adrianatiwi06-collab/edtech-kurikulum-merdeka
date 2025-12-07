/**
 * TP Compressor Engine
 * 
 * Handles compression of existing Learning Goals (TP) from full ABCD format
 * to 100-character rapor format, with smart detection of multiple topics
 * and optional splitting functionality.
 */

export interface CompressionResult {
  status: 'success' | 'needs_manual_review';
  original: string;
  compressed: string;
  charCount: number;
  maxLength: number;
  topicCount: number;
  hasMultipleTopics: boolean;
  hasSplit: boolean;
  splits?: string[];
  confidenceScore: number; // 0.5-1.0
  recommendedAction: 'compress_only' | 'split_required' | 'manual_review';
}

export interface MultiTopicDetection {
  hasMultipleTopics: boolean;
  topics: string[];
  confidence: number;
}

/**
 * ABCD Parser untuk ekstrak dan maintain struktur
 * A = Audience (Peserta didik mampu / Dapat)
 * B = Behavior (verb + object)
 * C = Condition (setelah, berdasarkan, dll)
 * D = Degree (kriteria sukses: dengan tepat, akurat, dll)
 */
interface ABCDComponents {
  audience: string;
  behavior: string;
  condition: string;
  degree: string;
}

function parseABCD(tpText: string): ABCDComponents {
  let text = tpText.trim();

  // Extract Audience
  let audience = '';
  const audienceMatch = text.match(/^(Peserta didik mampu|Dapat|Peserta didik dapat)/i);
  if (audienceMatch) {
    audience = 'Dapat'; // Normalize ke "Dapat"
    text = text.substring(audienceMatch[0].length).trim();
  }

  // Extract Degree (D) - usually at end with "dengan X"
  let degree = '';
  const degreeMatch = text.match(/,?\s+(dengan\s+[^,.]+|secara\s+[^,.]+)\s*\.?\s*$/i);
  if (degreeMatch) {
    degree = degreeMatch[1].trim();
    text = text.substring(0, text.length - degreeMatch[0].length).trim();
  }

  // Extract Condition (C) - phrases like "setelah, berdasarkan, dalam"
  let condition = '';
  const conditionMatch = text.match(/,?\s+(setelah|berdasarkan|dalam|melalui|pada|ketika)\s+[^,.]+/i);
  if (conditionMatch) {
    condition = conditionMatch[0].substring(1).trim(); // Remove leading comma/space
    text = text.substring(0, text.length - conditionMatch[0].length).trim();
  }

  // Remaining is Behavior (B)
  let behavior = text.trim();
  // Remove trailing period if exists
  if (behavior.endsWith('.')) {
    behavior = behavior.substring(0, behavior.length - 1).trim();
  }

  return { audience, behavior, condition, degree };
}

function reconstructABCD(components: ABCDComponents): string {
  let result = components.audience;
  
  if (components.behavior) {
    result += ' ' + components.behavior;
  }
  
  if (components.condition) {
    result += ', ' + components.condition;
  }
  
  if (components.degree) {
    result += ' ' + components.degree;
  }
  
  result += '.';
  return result;
}

/**
 * Compress ABCD-aware
 * Maintains structure while compressing each component
 */
function compressABCDAware(tpText: string, maxLength: number): string {
  const abcd = parseABCD(tpText);

  // Compress Behavior (most important to keep)
  // Try different compression strategies
  let behavior = abcd.behavior;
  let condition = abcd.condition;
  let degree = abcd.degree;

  // Strategy 1: Remove condition first if present
  if (condition && (abcd.audience + ' ' + behavior + ' ' + degree).length <= maxLength) {
    condition = '';
  }

  // Strategy 2: Shorten degree
  degree = degree
    .replace(/dengan\s+ketelitian\s+minimal\s+\d+%?/gi, 'dengan teliti')
    .replace(/dengan\s+akurasi\s+minimal\s+\d+%?/gi, 'dengan akurat')
    .replace(/dengan\s+benar/gi, 'dengan tepat')
    .replace(/secara\s+mandiri/gi, 'mandiri');

  // Strategy 3: Compress behavior itself
  if ((abcd.audience + ' ' + behavior + ' ' + condition + ' ' + degree).length > maxLength) {
    behavior = behavior
      .replace(/menggunakan\s+'([^']+)'\s+sebagai\s+[^,]+,\s+serta\s+menggunakan\s+/gi, 'menggunakan \'$1\' & ')
      .replace(/mengidentifikasi\s+dan\s+menjelaskan/gi, 'menjelaskan')
      .replace(/pada\s+akhir\s+kalimat\s+perintah\s+dan\s+kalimat\s+yang\s+menunjukkan\s+kesungguhan/gi, 'dengan benar');
  }

  // Reconstruct
  let result = reconstructABCD({ 
    audience: abcd.audience, 
    behavior, 
    condition, 
    degree 
  });

  // Remove period for char count check, add back if needed
  if (result.endsWith('.')) {
    result = result.substring(0, result.length - 1);
  }

  return result;
}

/**
 * ABCD Parser untuk ekstrak dan maintain struktur - END
 */

export function compressTP(
  tpText: string,
  maxLength: number = 100,
  allowSplit: boolean = true
): CompressionResult {
  if (!tpText || tpText.trim().length === 0) {
    return {
      status: 'needs_manual_review',
      original: tpText,
      compressed: '',
      charCount: 0,
      maxLength,
      topicCount: 0,
      hasMultipleTopics: false,
      hasSplit: false,
      confidenceScore: 0,
      recommendedAction: 'manual_review',
    };
  }

  const trimmed = tpText.trim();

  // First, try simple compression
  const simpleCompressed = intelligentCompress(trimmed, maxLength);

  if (simpleCompressed.length <= maxLength) {
    return {
      status: 'success',
      original: trimmed,
      compressed: simpleCompressed,
      charCount: simpleCompressed.length,
      maxLength,
      topicCount: 1,
      hasMultipleTopics: false,
      hasSplit: false,
      confidenceScore: 0.95,
      recommendedAction: 'compress_only',
    };
  }

  // If still too long and splitting allowed, try to detect and split
  if (allowSplit) {
    const topicDetection = detectMultipleTopics(trimmed);

    if (topicDetection.hasMultipleTopics && topicDetection.topics.length > 1) {
      const splits = smartSplit(trimmed, topicDetection.topics, maxLength);

      if (splits.length > 1) {
        // Verify all splits are under max length
        const allValid = splits.every(s => s.length <= maxLength);

        if (allValid) {
          return {
            status: 'success',
            original: trimmed,
            compressed: '', // Not used when split
            charCount: 0,
            maxLength,
            topicCount: splits.length,
            hasMultipleTopics: true,
            hasSplit: true,
            splits: splits.map(s => intelligentCompress(s, maxLength)),
            confidenceScore: topicDetection.confidence,
            recommendedAction: 'split_required',
          };
        }
      }
    }
  }

  // Fallback: aggressive compression
  const aggressiveCompressed = aggressiveCompress(trimmed, maxLength);

  return {
    status: 'needs_manual_review',
    original: trimmed,
    compressed: aggressiveCompressed,
    charCount: aggressiveCompressed.length,
    maxLength,
    topicCount: detectMultipleTopics(trimmed).topics.length,
    hasMultipleTopics: detectMultipleTopics(trimmed).hasMultipleTopics,
    hasSplit: false,
    confidenceScore: 0.6,
    recommendedAction: 'manual_review',
  };
}

/**
 * Detect if TP contains multiple topics/learning objectives
 * Keywords indicating topic boundaries: "dan", "serta", "serta juga"
 */
export function detectMultipleTopics(tpText: string): MultiTopicDetection {
  const text = tpText.toLowerCase();

  // Patterns that indicate multiple objectives
  const multiTopicPatterns = [
    /\bdan\s+([a-z]+(?:i|kan))/gi, // "dan [verb]" - capture the verb
    /\bserta\s+([a-z]+(?:i|kan))/gi, // "serta [verb]"
    /\b(membandingkan|mengidentifikasi|menganalisis|menggolongkan|menggunakan)\s+dan\s+(menjelaskan|menggolongkan|menyebutkan|menggunakan|mengidentifikasi)/gi,
  ];

  let matchCount = 0;
  let topics: string[] = [];

  // Check for conjunction patterns - more aggressive matching
  for (const pattern of multiTopicPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matchCount += matches.length;
    }
  }

  // Also check for "dan" as primary conjunction indicator
  const andMatches = text.split(/\s+dan\s+/i);
  if (andMatches.length > 1) {
    matchCount = Math.max(matchCount, andMatches.length - 1);
  }

  // If multiple conjunctions found, try to extract topics
  if (matchCount >= 1) {
    topics = extractTopics(tpText);
  }

  const hasMultiple = topics.length > 1 || matchCount >= 1;
  const confidence = Math.min(0.98, 0.65 + matchCount * 0.15); // Higher confidence for detected conjunctions

  return {
    hasMultipleTopics: hasMultiple,
    topics: hasMultiple ? topics : [tpText],
    confidence,
  };
}

/**
 * Extract individual topics from compound TP text
 */
function extractTopics(tpText: string): string[] {
  const topics: string[] = [];

  // Try to split by key conjunctions
  let parts = tpText.split(/\s+dan\s+/i);

  if (parts.length === 1) {
    parts = tpText.split(/\s+serta\s+/i);
  }

  if (parts.length > 1) {
    return parts.map(p => p.trim()).filter(p => p.length > 5);
  }

  // If no split found, return whole text as single topic
  return [tpText];
}

/**
 * Smart split: divide TP into multiple coherent TPs
 * Each split is INDIVIDUALLY compressed to fit maxLength
 */
export function smartSplit(tpText: string, topics: string[], maxLength: number = 100): string[] {
  if (topics.length === 0) {
    return [tpText];
  }

  if (topics.length === 1) {
    return [tpText];
  }

  // Extract the stem (usually starts with "Peserta didik mampu" or "Dapat")
  const stemMatch = tpText.match(/^(.*?)(mampu|dapat|bisa)\s+/i);
  const stem = stemMatch ? stemMatch[1] + (stemMatch[2] || '') : 'Dapat';

  // Build and compress individual TP for each topic
  const splits = topics.map(topic => {
    let cleaned = topic.trim();

    // Remove leading conjunctions
    cleaned = cleaned.replace(/^(dan|serta|atau)\s+/i, '');

    // If topic is just a verb phrase, add "dapat"
    if (!cleaned.match(/^(peserta didik|dapat|mampu|bisa)/i)) {
      cleaned = `${stem} ${cleaned}`;
    }

    cleaned = cleaned.trim();

    // COMPRESS this split individually to fit maxLength
    if (cleaned.length > maxLength) {
      cleaned = intelligentCompress(cleaned, maxLength);
    }

    return cleaned;
  });

  return splits.filter(s => s.length > 0);
}

/**
 * Intelligent compression - ABCD-aware strategy
 * Maintains ABCD structure while compressing
 */
export function intelligentCompress(
  tpText: string,
  maxLength: number = 100
): string {
  const trimmed = tpText.trim();

  // First try ABCD-aware compression (maintains structure)
  const abcdCompressed = compressABCDAware(trimmed, maxLength);
  if (abcdCompressed.length <= maxLength) {
    return abcdCompressed;
  }

  // Fallback to old strategy if ABCD-aware still too long
  let text = trimmed;

  // Stage 1: Remove "Peserta didik mampu" -> "Dapat"
  text = text.replace(/^peserta\s+didik\s+(mampu\s+)?/i, 'Dapat ');
  text = text.replace(/^dapat\s+/i, 'Dapat '); // Normalize

  if (text.length <= maxLength) {
    return text;
  }

  // Stage 2: Remove condition clues (setelah, berdasarkan, etc.)
  text = removeConditions(text);

  if (text.length <= maxLength) {
    return text;
  }

  // Stage 3: Shorten degree/criteria
  text = shortenDegree(text);

  if (text.length <= maxLength) {
    return text;
  }

  // Stage 4: Optimize behavior (verbs and objects)
  text = optimizeBehavior(text);

  if (text.length <= maxLength) {
    return text;
  }

  // If still too long, smart truncation without ellipsis
  // Try to truncate at word boundary
  if (text.length > maxLength) {
    // Find last space before maxLength
    let truncatePos = maxLength;
    for (let i = maxLength - 1; i >= maxLength - 20; i--) {
      if (text[i] === ' ' || text[i] === ',' || text[i] === '.') {
        truncatePos = i;
        break;
      }
    }
    
    // Fallback: just truncate at maxLength
    if (truncatePos === maxLength) {
      truncatePos = maxLength;
    }
    
    text = text.substring(0, truncatePos).trim();
  }
  
  return text;
}

/**
 * Remove condition-related phrases (STAGE 2)
 * ONLY removes instructional conditions (HOW to teach), NOT compound objectives (WHAT to learn)
 * Patterns like: "setelah diberikan", "berdasarkan", context info in parentheses
 * DOES NOT remove "menggunakan" in mid-objective context (prevents removing "dan menggunakan" which is part of learning goal)
 */
function removeConditions(text: string): string {
  let result = text;

  // ONLY remove truly conditional phrases (instructional context, not learning objectives)
  const conditionPatterns = [
    // Remove pre-condition instructions: "Setelah peserta didik...", "Berdasarkan materi..."
    /^setelah\s+[^,.]*/gi,
    /^berdasarkan\s+[^,.]*/gi,
    
    // Remove instructional method ONLY if it's parenthetical/contextual: "(dengan menggunakan kalkulator)"
    // But NOT if it's part of learning objective: "menggunakan kalimat aktif"
    /\s+\(\s*dengan\s+[^)]*\)/gi,
    /\s+\(\s*menggunakan\s+[^)]*\)/gi,
    
    // Remove trailing contextual info
    /dalam\s+konteks\s+[^,.]*/gi,
    /pada\s+konteks\s+[^,.]*/gi,
  ];

  for (const pattern of conditionPatterns) {
    result = result.replace(pattern, '');
  }

  // Remove trailing "dengan" only if isolated (not part of compound verb)
  result = result.replace(/\s+dengan\s*$/, '');

  return result.trim();
}

/**
 * Shorten degree/success criteria (STAGE 3)
 * Replace long criteria with short versions
 */
function shortenDegree(text: string): string {
  const replacements = [
    { from: /dengan\s+ketelitian\s+minimal\s+\d+\%?/gi, to: 'dengan teliti' },
    { from: /dengan\s+akurasi\s+minimal\s+\d+\%?/gi, to: 'dengan akurat' },
    { from: /dengan\s+tingkat\s+akurasi\s+minimal\s+\d+\%?/gi, to: 'dengan akurat' },
    { from: /dengan\s+benar/gi, to: 'dengan tepat' },
    { from: /minimal\s+\d+\%?/gi, to: 'tepat' },
    { from: /dengan\s+sempurna/gi, to: 'dengan baik' },
    { from: /secara\s+mandiri/gi, to: 'mandiri' },
  ];

  let result = text;

  for (const replacement of replacements) {
    result = result.replace(replacement.from, replacement.to);
  }

  return result;
}

/**
 * Optimize behavior/verb phrases (STAGE 4)
 * Use shorter verbs, remove redundancy, abbreviate
 */
function optimizeBehavior(text: string): string {
  const optimizations = [
    // Combine verbs with "serta" connector
    { from: /menggunakan\s+'([^']+)'\s+sebagai\s+[^,]+,\s+serta\s+menggunakan\s+/gi, to: 'menggunakan \'$1\' & ' },
    
    // Combine verbs
    { from: /mengidentifikasi\s+dan\s+menjelaskan/gi, to: 'menjelaskan' },
    { from: /membandingkan\s+dan\s+mengurutkan/gi, to: 'membandingkan' },
    { from: /menyebutkan\s+dan\s+menjelaskan/gi, to: 'menjelaskan' },

    // Shorten common phrases
    { from: /memahami\s+cara\s+kerja\s+dari/gi, to: 'memahami prinsip' },
    { from: /berbagai\s+macam\s+jenis/gi, to: 'jenis-jenis' },
    { from: /proses\s+terjadinya\s+([a-z]+)/gi, to: 'proses $1' },
    { from: /komponen[\s-]+komponen\s+utama/gi, to: 'komponen' },
    { from: /ilmu\s+pengetahuan\s+alam/gi, to: 'IPA' },
    { from: /ilmu\s+pengetahuan\s+sosial/gi, to: 'IPS' },
    { from: /pada\s+akhir\s+kalimat\s+perintah\s+dan\s+kalimat\s+yang\s+menunjukkan\s+kesungguhan/gi, to: 'dengan benar' },

    // Remove redundancy
    { from: /dapat\s+melakukan\s+([a-z]+)/gi, to: '$1' },
    { from: /mampu\s+untuk\s+([a-z]+)/gi, to: '$1' },
    { from: /dapat\s+melakukan\s+identifikasi\s+terhadap/gi, to: 'mengidentifikasi' },

    // Abbreviations
    { from: /tahap[\s-]?tahap/gi, to: 'tahap' },
    { from: /konsep[\s-]?konsep/gi, to: 'konsep' },
    { from: /ciri[\s-]?ciri/gi, to: 'ciri' },
  ];

  let result = text;

  for (const opt of optimizations) {
    result = result.replace(opt.from, opt.to);
  }

  return result;
}

/**
 * Aggressive compression - use when intelligent compression still too long
 * Last resort: remove less critical parts
 */
function aggressiveCompress(text: string, maxLength: number): string {
  let result = intelligentCompress(text, maxLength);

  if (result.length <= maxLength) {
    return result;
  }

  // Remove all degree/criteria
  result = result.replace(/\s+dengan\s+[^.]*/, '');
  result = result.replace(/\s+secara\s+[^.]*/, '');

  if (result.length <= maxLength) {
    return result;
  }

  // Keep only first part if compound
  const parts = result.split(/\s+dan\s+/i);
  if (parts.length > 1) {
    result = parts[0].trim();
  }

  if (result.length <= maxLength) {
    return result;
  }

  // Try removing specific long phrases
  result = result
    .replace(/\([^)]*\)/g, '') // Remove parenthetical content
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  if (result.length <= maxLength) {
    return result;
  }

  // Last resort: find sentence boundaries and keep meaningful content
  // Don't just truncate - try to cut at word boundary
  if (result.length > maxLength) {
    let truncated = result.substring(0, maxLength);
    // Find last space and cut there instead of mid-word
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength - 20) {
      // If space is reasonably close, use it
      truncated = truncated.substring(0, lastSpace);
    }
    return truncated.trim();
  }

  return result;
}

/**
 * Validate compression quality
 * Returns score 0-100 indicating how good the compression is
 */
export function validateCompressionQuality(
  original: string,
  compressed: string
): number {
  if (!compressed) return 0;

  const charRatio = compressed.length / original.length;
  const minRatio = 0.3; // At least 30% of original
  const maxRatio = 0.95; // At most 95% (should actually compress)

  if (charRatio < minRatio) {
    return 50; // Too aggressive
  }

  if (charRatio > maxRatio) {
    return 30; // Not compressed enough
  }

  // Good compression ratio
  let score = 80;

  // Check if key words preserved
  const keywordPatterns = [
    /dapat|mampu|bisa/i,
    /[a-z]{4,}/i, // Has meaningful words
  ];

  for (const pattern of keywordPatterns) {
    if (!pattern.test(compressed)) {
      score -= 10;
    }
  }

  // Check no obvious truncation issues
  if (compressed.endsWith('...')) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Format compression result for display
 */
export function formatCompressionResult(result: CompressionResult): {
  displayText: string;
  subText: string;
  status: 'success' | 'warning' | 'error';
} {
  if (result.hasSplit && result.splits) {
    return {
      displayText: `Split ke ${result.splits.length} TP`,
      subText: result.splits
        .map((s, i) => `TP${i + 1}: ${s.substring(0, 50)}...`)
        .join('\n'),
      status: 'success',
    };
  }

  if (result.status === 'success') {
    return {
      displayText: `✅ Dikompres (${result.charCount} char)`,
      subText: result.compressed.substring(0, 80),
      status: 'success',
    };
  }

  if (result.confidenceScore < 0.7) {
    return {
      displayText: `⚠️ Review Diperlukan`,
      subText: `Confidence: ${(result.confidenceScore * 100).toFixed(0)}%`,
      status: 'warning',
    };
  }

  return {
    displayText: `ℹ️ Memerlukan Edit Manual`,
    subText: 'Panjang masih > 100 char setelah kompresi',
    status: 'error',
  };
}
