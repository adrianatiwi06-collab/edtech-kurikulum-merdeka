/**
 * TypeScript type definitions for TP (Tujuan Pembelajaran)
 * Provides strong typing for normalization process
 */

export type GradeLevel = 'FASE_A' | 'FASE_B' | 'FASE_C';
export type KeranjangType = 'A' | 'B' | 'C';

export interface Chapter {
  chapter: string;
  tp_count: number;
  // Dynamic properties for TPs (tp_1, tp_2, etc.)
  [key: `tp_${number}`]: string;
  [key: `keranjang_${number}`]: KeranjangType;
  [key: `cakupan_materi_${number}`]: string;
}

export interface TPOutput {
  semester1: Chapter[];
  semester2: Chapter[];
}

export interface NormalizationResult {
  normalized: TPOutput;
  warnings: string[];
  corrections: string[];
}

export interface NormalizationOptions {
  maxLength?: number;
  logLevel?: 'none' | 'errors' | 'warnings' | 'all';
  autoFix?: boolean;
}

export interface KKOValidationResult {
  valid: boolean;
  message: string;
}

export interface ABCDCheckResult {
  complete: boolean;
  missing: string[];
}
