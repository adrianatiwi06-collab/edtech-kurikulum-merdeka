import { Timestamp, addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Audit log types
 */
export type AuditAction = 
  | 'USER_SIGNUP'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_DELETE'
  | 'EMAIL_VERIFIED'
  | 'EMAIL_VERIFY_FAILED'
  | 'GENERATE_TP'
  | 'GENERATE_SOAL'
  | 'KOREKSI_CREATE'
  | 'KOREKSI_UPDATE'
  | 'KOREKSI_FINALIZE'
  | 'REKAP_EXPORT'
  | 'MASTER_DATA_IMPORT'
  | 'MASTER_DATA_UPDATE'
  | 'TEMPLATE_CREATE'
  | 'TEMPLATE_UPDATE'
  | 'TEMPLATE_DELETE';

export interface AuditLog {
  timestamp: Timestamp;
  userId: string;
  action: AuditAction;
  status: 'success' | 'failure';
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Log audit event
 * Should be called from server-side code only
 */
export async function logAudit(
  userId: string,
  action: AuditAction,
  status: 'success' | 'failure',
  resourceType: string,
  options?: {
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    const auditLog: AuditLog = {
      timestamp: Timestamp.now(),
      userId,
      action,
      status,
      resourceType,
      resourceId: options?.resourceId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      errorMessage: options?.errorMessage,
      metadata: options?.metadata,
    };

    // Log to console (for development/monitoring)
    const logLevel = status === 'success' ? 'info' : 'warn';
    console[logLevel as 'info' | 'warn'](
      `[AUDIT] ${action} (${status}) by user ${userId}`,
      auditLog
    );

    // Log to Firestore audit collection
    await addDoc(collection(db, 'audit_logs'), auditLog);
  } catch (error) {
    // Log error but don't throw - don't break main flow if audit fails
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Server-side audit logging for API endpoints
 * Use in try-catch blocks
 */
export async function logAuditFromServer(
  request: any,
  userId: string,
  action: AuditAction,
  status: 'success' | 'failure',
  resourceType: string,
  options?: {
    resourceId?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const ipAddress = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') ||
                    request.ip ||
                    'unknown';
  
  const userAgent = request.headers.get('user-agent') || 'unknown';

  await logAudit(userId, action, status, resourceType, {
    ...options,
    ipAddress,
    userAgent,
  });
}

/**
 * Example usage in API endpoints:
 * 
 * export const POST = withAuthAndRateLimit(limiter, async (request, { userId }) => {
 *   try {
 *     // Your code
 *     const result = await generateTP(...);
 *     
 *     // Log success
 *     await logAuditFromServer(request, userId, 'GENERATE_TP', 'success', 'learning_goals', {
 *       metadata: {
 *         grade: grade,
 *         contentSize: textContent.length,
 *       }
 *     });
 *     
 *     return NextResponse.json({ success: true, data: result });
 *   } catch (error) {
 *     // Log failure
 *     await logAuditFromServer(request, userId, 'GENERATE_TP', 'failure', 'learning_goals', {
 *       errorMessage: error.message,
 *     });
 *     
 *     return NextResponse.json({ error: 'Failed' }, { status: 500 });
 *   }
 * });
 */
