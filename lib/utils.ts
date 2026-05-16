import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validate grade input (e.g., "7A", "8B")
 */
export function validateGrade(grade: string): boolean {
  const gradeRegex = /^[1-9][0-9]?[A-Z]?$/;
  return gradeRegex.test(grade);
}

/**
 * Validate positive integer
 */
export function validatePositiveInteger(value: any): boolean {
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
}

/**
 * Calculate total score
 */
export function calculateTotalScore(
  mcAnswers: string[],
  mcCorrectAnswers: string[],
  mcWeight: number,
  essayScores: number[]
): number {
  // Calculate Multiple Choice score
  const mcScore = mcAnswers.reduce((total, answer, index) => {
    return total + (answer === mcCorrectAnswers[index] ? mcWeight : 0);
  }, 0);

  // Calculate Essay score
  const essayScore = essayScores.reduce((total, score) => total + score, 0);

  return mcScore + essayScore;
}

/**
 * Format date to Indonesian locale
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format timestamp
 */
export function formatTimestamp(timestamp: any): string {
  if (!timestamp) return '';
  
  let date: Date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }
  
  return formatDate(date);
}
