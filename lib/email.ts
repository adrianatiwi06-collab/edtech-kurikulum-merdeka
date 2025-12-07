/**
 * Email verification utilities
 * Handles sending verification emails and tracking verification status
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as crypto from 'crypto';

// Optional: Import nodemailer if available
let nodemailer: any;
try {
  nodemailer = require('nodemailer');
} catch {
  // nodemailer not installed - will use console logging as fallback
}

// Initialize Firebase Admin if not already done
let app = getApps()[0];
if (!app) {
  app = initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON || '{}')),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  });
}

const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Email verification record in Firestore
 */
export interface EmailVerificationRecord {
  userId: string;
  email: string;
  token: string;
  tokenHash: string; // Hash of token for security
  createdAt: Date | Timestamp;
  expiresAt: Date | Timestamp;
  verified: boolean;
  attempts: number;
  lastAttemptAt?: Date | Timestamp;
}

/**
 * Convert Firestore Timestamp or Date to Date object
 */
function toDate(value: Date | Timestamp | undefined): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  return new Date(0);
}

/**
 * Generate a secure verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash token using SHA256
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Send verification email using nodemailer
 * Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars
 */
export async function sendVerificationEmail(
  email: string,
  verificationLink: string,
  displayName?: string
): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // Fallback: Log to console if SMTP not configured
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn(
      `[EMAIL_VERIFICATION] Verification link (SMTP not configured):\n${verificationLink}\n\nSend this to: ${email}`
    );
    return;
  }

  // Configure nodemailer
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  // Email template
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Verifikasi Email Anda</h2>
      <p>Halo${displayName ? ` ${displayName}` : ''},</p>
      <p>Terima kasih telah mendaftar di EdTech Kurikulum Merdeka!</p>
      <p>Untuk melanjutkan, verifikasi email Anda dengan mengklik tombol di bawah:</p>
      <div style="margin: 30px 0;">
        <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Verifikasi Email
        </a>
      </div>
      <p style="color: #666; font-size: 12px;">Atau salin link ini ke browser Anda:</p>
      <p style="background-color: #f5f5f5; padding: 10px; border-radius: 3px; word-break: break-all; font-size: 12px;">
        ${verificationLink}
      </p>
      <p style="color: #999; font-size: 12px;">Link ini akan berlaku selama 24 jam.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">
        Jika Anda tidak membuat akun ini, abaikan email ini.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: smtpUser,
      to: email,
      subject: 'Verifikasi Email - EdTech Kurikulum Merdeka',
      html: emailHtml,
    });
    console.log(`[EMAIL_VERIFICATION] Email sent to ${email}`);
  } catch (error) {
    console.error('[EMAIL_VERIFICATION] Failed to send email:', error);
    throw new Error(`Failed to send verification email: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create verification record in Firestore
 */
export async function createVerificationRecord(
  userId: string,
  email: string,
  expiryHours: number = 24
): Promise<{ token: string; record: EmailVerificationRecord }> {
  const token = generateVerificationToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

  const record: EmailVerificationRecord = {
    userId,
    email,
    token: '', // Don't store plain token
    tokenHash,
    createdAt: now,
    expiresAt,
    verified: false,
    attempts: 0,
  };

  await db.collection('email_verifications').doc(userId).set(record);

  return { token, record };
}

/**
 * Verify email token
 * Returns user email if valid, null if invalid/expired
 */
export async function verifyEmailToken(userId: string, token: string): Promise<string | null> {
  try {
    const doc = await db.collection('email_verifications').doc(userId).get();

    if (!doc.exists) {
      return null;
    }

    const record = doc.data() as EmailVerificationRecord;

    // Check if already verified
    if (record.verified) {
      return record.email; // Already verified
    }

    // Check expiry
    if (toDate(record.expiresAt) < new Date()) {
      return null; // Expired
    }

    // Rate limit: max 5 attempts per day
    if (record.attempts >= 5) {
      const lastAttempt = toDate(record.lastAttemptAt);
      if (new Date().getTime() - lastAttempt.getTime() < 24 * 60 * 60 * 1000) {
        return null; // Too many attempts
      }
    }

    // Verify token
    const tokenHash = hashToken(token);
    if (tokenHash !== record.tokenHash) {
      // Increment attempts
      await db.collection('email_verifications').doc(userId).update({
        attempts: record.attempts + 1,
        lastAttemptAt: new Date(),
      });
      return null;
    }

    // Token is valid - mark as verified
    await db.collection('email_verifications').doc(userId).update({
      verified: true,
    });

    // Also update user profile
    await db.collection('users').doc(userId).update({
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    // Set Firebase Auth emailVerified
    await auth.updateUser(userId, { emailVerified: true });

    return record.email;
  } catch (error) {
    console.error('[EMAIL_VERIFICATION] Error verifying token:', error);
    return null;
  }
}

/**
 * Resend verification email
 * Rate limited to 1 per hour
 */
export async function resendVerificationEmail(
  userId: string,
  appUrl: string
): Promise<boolean> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return false;
    }

    const userData = userDoc.data();
    const email = userData?.email;
    const displayName = userData?.displayName;

    if (!email) {
      return false;
    }

    // Check rate limiting (1 per hour)
    const verificationDoc = await db.collection('email_verifications').doc(userId).get();
    if (verificationDoc.exists) {
      const record = verificationDoc.data() as EmailVerificationRecord;
      if (record.verified) {
        return true; // Already verified
      }

      if (record.lastAttemptAt) {
        const lastAttempt = toDate(record.lastAttemptAt);
        const hourAgo = new Date(new Date().getTime() - 60 * 60 * 1000);
        
        if (lastAttempt > hourAgo) {
          return false; // Rate limited
        }
      }

      // Create new token
      const { token } = await createVerificationRecord(userId, email);
      const verificationLink = `${appUrl}/verify-email?token=${token}&userId=${userId}`;
      await sendVerificationEmail(email, verificationLink, displayName);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[EMAIL_VERIFICATION] Error resending email:', error);
    return false;
  }
}

/**
 * Check if user email is verified
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    const user = await auth.getUser(userId);
    return user.emailVerified;
  } catch (error) {
    console.error('[EMAIL_VERIFICATION] Error checking verification status:', error);
    return false;
  }
}
