import { z } from 'zod';

/**
 * Password validation schema
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 */
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter (A-Z)')
  .regex(/[a-z]/, 'Password must contain at least 1 lowercase letter (a-z)')
  .regex(/[0-9]/, 'Password must contain at least 1 number (0-9)')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least 1 special character (!@#$%^&*)');

/**
 * Email validation schema
 */
export const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email too long');

/**
 * Display name validation
 */
export const displayNameSchema = z.string()
  .min(1, 'Name is required')
  .max(100, 'Name too long')
  .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

/**
 * Sign up form validation
 */
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  displayName: displayNameSchema,
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * Sign in form validation
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Get password validation error message
 */
export function getPasswordValidationErrors(password: string): string[] {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('At least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('1 uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('1 lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('1 number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('1 special character');
  }

  return errors;
}

/**
 * Check if password is strong
 */
export function isPasswordStrong(password: string): boolean {
  try {
    passwordSchema.parse(password);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get password strength percentage
 */
export function getPasswordStrength(password: string): number {
  let strength = 0;

  // Length
  if (password.length >= 8) strength += 20;
  if (password.length >= 12) strength += 10;
  if (password.length >= 16) strength += 10;

  // Character types
  if (/[a-z]/.test(password)) strength += 15;
  if (/[A-Z]/.test(password)) strength += 15;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 10;

  return Math.min(100, strength);
}

/**
 * Get password strength label
 */
export function getPasswordStrengthLabel(strength: number): string {
  if (strength < 40) return 'Weak';
  if (strength < 60) return 'Fair';
  if (strength < 80) return 'Good';
  return 'Strong';
}

/**
 * Get password strength color
 */
export function getPasswordStrengthColor(strength: number): string {
  if (strength < 40) return '#ef4444'; // red
  if (strength < 60) return '#f97316'; // orange
  if (strength < 80) return '#eab308'; // yellow
  return '#22c55e'; // green
}
