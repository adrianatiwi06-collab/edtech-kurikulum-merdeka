import { z } from 'zod';

/**
 * Environment variables validation schema
 * Checks all required and optional environment variables on startup
 */

// Client-side env schema (NEXT_PUBLIC_*)
const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// Server-side env schema (only available on server)
const serverEnvSchema = z.object({
  // Firebase Admin
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1),
  
  // Gemini API
  GEMINI_API_KEYS: z.string().min(1),
  
  // Optional
  REDIS_URL: z.string().url().optional(),
  GEMINI_KEY_RPM: z.string().transform(Number).optional(),
  GEMINI_KEY_WINDOW_SECONDS: z.string().transform(Number).optional(),
  GEMINI_KEY_BAN_MS: z.string().transform(Number).optional(),
  
  // Node env
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  NEXTAUTH_SECRET: z.string().optional(),
});

type ClientEnv = z.infer<typeof clientEnvSchema>;
type ServerEnv = z.infer<typeof serverEnvSchema>;

let clientEnvValidated: ClientEnv | null = null;
let serverEnvValidated: ServerEnv | null = null;

/**
 * Validate client environment variables
 * This can be called in browser or server
 */
export function validateClientEnv(): ClientEnv {
  if (clientEnvValidated) {
    return clientEnvValidated;
  }

  try {
    const result = clientEnvSchema.parse(process.env);
    clientEnvValidated = result;
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('\n  ');
      
      console.error(
        `❌ Client environment validation failed:\n  ${missingVars}\n\n` +
        'Please check your .env.local or .env file.\n' +
        'Visit: https://console.firebase.google.com/ to get your credentials.'
      );
      throw new Error('Invalid client environment variables');
    }
    throw error;
  }
}

/**
 * Validate server environment variables
 * Only call this on the server side during startup
 */
export function validateServerEnv(): ServerEnv {
  if (serverEnvValidated) {
    return serverEnvValidated;
  }

  try {
    const result = serverEnvSchema.parse(process.env);
    serverEnvValidated = result;
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map(e => {
          const path = e.path.join('.');
          const message = e.message;
          let hint = '';
          
          if (path === 'FIREBASE_ADMIN_PROJECT_ID') {
            hint = ' (from Firebase Console > Project Settings > Service Accounts)';
          } else if (path === 'FIREBASE_ADMIN_PRIVATE_KEY') {
            hint = ' (from Firebase Console > Service Account JSON, escape \\n as \\\\n)';
          } else if (path === 'GEMINI_API_KEYS') {
            hint = ' (from Google AI Studio: https://makersuite.google.com/app/apikey)';
          }
          
          return `${path}: ${message}${hint}`;
        })
        .join('\n  ');
      
      console.error(
        `❌ Server environment validation failed:\n  ${missingVars}\n\n` +
        'Please check your .env or .env.local file.'
      );
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Check if running in development
 */
export function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in production
 */
export function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Export validated env for use in server code
 * This should be imported and called early during server initialization
 */
export const serverEnv = (() => {
  // Only validate on server
  if (typeof window === 'undefined') {
    return validateServerEnv();
  }
  return null;
})();
