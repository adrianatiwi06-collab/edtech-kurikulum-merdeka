# 📋 Analisis & Saran Perbaikan - EdTech Kurikulum Merdeka

**Tanggal**: 5 Desember 2024  
**Status**: Comprehensive Code Review dengan 30+ rekomendasi perbaikan

---

## 📊 RINGKASAN EKSEKUTIF

| Kategori | Temuan | Severity |
|----------|--------|----------|
| **Keamanan** | 8 isu | 🔴 Critical/High |
| **Performance** | 7 isu | 🟠 Medium |
| **Code Quality** | 9 isu | 🟡 Low/Medium |
| **UX/Feature** | 6 isu | 🟡 Medium |
| **DevOps/Deployment** | 2 isu | 🟠 Medium |

**Skor Kesehatan Aplikasi**: 6.5/10
- ✅ **Kuat**: Architecture, Documentation, Firebase integration
- ⚠️ **Perlu Perbaikan**: Error handling, Logging, Rate limiting flexibility

---

## 🔴 CRITICAL ISSUES (Prioritas Tinggi)

### 1. **API Key Tidak Dirotasi di Client** 
**File**: `contexts/AuthContext.tsx`, `lib/firebase.ts`  
**Severity**: 🔴 CRITICAL  
**Deskripsi**: Firebase config keys (NEXT_PUBLIC_FIREBASE_API_KEY) terekspos di client.
```tsx
// ❌ Sekarang: Keys terekspos di .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
```
**Dampak**: 
- Key dapat digunakan untuk bypass quota limits
- Mudah di-reverse engineering dari browser DevTools
- Tidak dapat di-revoke tanpa redeployment

**Solusi**:
```tsx
// ✅ Gunakan API proxy layer
// app/api/auth/firebase-config/route.ts
export async function GET() {
  // Return hanya config yang aman (tanpa API key)
  return NextResponse.json({
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    // Jangan expose API_KEY
  });
}
```

---

### 2. **No Request Authentication di API Endpoints**
**File**: `app/api/generate-tp/route.ts`, `app/api/generate-soal/...`  
**Severity**: 🔴 CRITICAL  
**Deskripsi**: API endpoints menerima `userId` dari request body tanpa verifikasi Firebase token.
```typescript
// ❌ Sekarang: Trusting client-side userId
const { userId, textContent, pdfBase64, ... } = body;

if (!userId) {
  return NextResponse.json({ success: false, error: 'User ID diperlukan' }, { status: 401 });
}
```

**Risiko**:
- Attacker bisa generate unlimited soal dengan userId orang lain
- Bypass quota system dengan user ID palsu
- Exploit Gemini API resources

**Solusi**:
```typescript
// ✅ Verifikasi Firebase token di setiap endpoint
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const token = authHeader.substring(7);
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const userId = decodedToken.uid;
    
    // Sekarang userId adalah VERIFIED dari Firebase
    // Proceed dengan request...
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
```

---

### 3. **SQL/Injection-like Attack di Firestore Queries**
**File**: `app/dashboard/master-data/page.tsx`, `app/dashboard/koreksi/page.tsx`  
**Severity**: 🔴 CRITICAL  
**Deskripsi**: Tidak ada input sanitization sebelum Firestore queries.
```typescript
// ❌ User input langsung ke query (meski Firestore safer, still risk)
const q = query(
  collection(db, 'classes'),
  where('class_name', '==', classNameInput), // Potential injection point
  where('user_id', '==', user.uid)
);
```

**Solusi**:
```typescript
// ✅ Input validation & sanitization
import { z } from 'zod';

const classNameSchema = z.string()
  .min(1, 'Class name required')
  .max(100, 'Class name too long')
  .regex(/^[a-zA-Z0-9\s\-]+$/, 'Invalid characters');

const validatedName = classNameSchema.parse(classNameInput);

const q = query(
  collection(db, 'classes'),
  where('class_name', '==', validatedName),
  where('user_id', '==', user.uid)
);
```

---

### 4. **Error Messages Expose System Details**
**File**: `app/api/generate-tp/route.ts`, `app/dashboard/generate-soal/actions.ts`  
**Severity**: 🔴 CRITICAL  
**Deskripsi**: Error messages menampilkan stack trace dan API details.
```typescript
// ❌ Sekarang: Full error details ke client
catch (error: any) {
  return NextResponse.json(
    { 
      error: error.message,  // Bisa jadi "GEMINI_API_KEY is invalid"
      stack: error.stack     // Kadang dipretty-print
    },
    { status: 500 }
  );
}
```

**Risiko**:
- Attacker bisa identify exact API structure
- Learn API key format dari error messages
- Find database schema dari error details

**Solusi**:
```typescript
// ✅ Sanitized error messages
catch (error: any) {
  // Log penuh hanya di server
  console.error('[ERROR] Generate TP failed:', error);
  
  // Kirim generic message ke client
  return NextResponse.json(
    { error: 'Proses generation gagal. Silakan coba lagi.' },
    { status: 500 }
  );
}
```

---

### 5. **No Rate Limiting pada API Endpoints**
**File**: `app/api/generate-tp/route.ts`, `app/api/generate-soal/...`  
**Severity**: 🔴 CRITICAL  
**Deskripsi**: Tidak ada per-user rate limiting, hanya Gemini quota checking.
```typescript
// ❌ Sekarang: No per-user rate limit
export async function POST(request: NextRequest) {
  // Check only global quota
  const quotaStatus = getQuotaStatus();
  if (quotaStatus.isQuotaExhausted) {
    // Return error...
  }
  // But single user bisa hammer endpoint
}
```

**Dampak**:
- User bisa spam Gemini API
- Quota exhausted dengan 1 user abusing
- DDoS vulnerability

**Solusi**:
```typescript
// ✅ Tambahkan rate limiting dengan Redis
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'), // 5 requests per hour per user
  namespace: 'api_generate_tp',
});

export async function POST(request: NextRequest) {
  const ip = request.ip || 'unknown';
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }
  // Proceed...
}
```

---

### 6. **Hardcoded Secrets di Environment (If deployed)**
**File**: `.env.local`, `GEMINI_API_KEYS`  
**Severity**: 🔴 CRITICAL  
**Deskripsi**: Sensitive data dalam file yang bisa accidentally committed.
```bash
# ❌ Risk: .env.local accidentally committed
GEMINI_API_KEYS=key1,key2,key3
FIREBASE_ADMIN_PRIVATE_KEY="..."
```

**Solusi**:
```bash
# ✅ Gunakan secrets management
# For production: GitHub Secrets, Azure Key Vault, atau Google Secret Manager

# In GitHub Actions:
# .github/workflows/deploy.yml
- name: Deploy
  env:
    GEMINI_API_KEYS: ${{ secrets.GEMINI_API_KEYS }}
    FIREBASE_ADMIN_PRIVATE_KEY: ${{ secrets.FIREBASE_ADMIN_PRIVATE_KEY }}
```

---

## 🟠 HIGH PRIORITY ISSUES

### 7. **No Request/Response Logging untuk Auditing**
**File**: `app/api/`  
**Severity**: 🟠 HIGH  
**Deskripsi**: Tidak ada comprehensive logging untuk security auditing.
```typescript
// ❌ Minimal logging
console.log(`[API] Queue size: ${quotaStatus.queueSize}`);
```

**Solusi**:
```typescript
// ✅ Structured logging
interface AuditLog {
  timestamp: string;
  userId: string;
  action: string;
  status: 'success' | 'failure';
  resource: string;
  ipAddress: string;
  metadata: Record<string, any>;
}

async function logAudit(log: AuditLog) {
  // Log to Firestore audit collection
  await addDoc(collection(db, 'audit_logs'), {
    ...log,
    createdAt: new Date()
  });
  
  // Also log to console
  console.log(JSON.stringify(log));
}

// Usage
await logAudit({
  timestamp: new Date().toISOString(),
  userId: decodedToken.uid,
  action: 'GENERATE_TP',
  status: 'success',
  resource: 'learning_goals',
  ipAddress: request.ip || 'unknown',
  metadata: { gradeLevel: grade, contentSize: textContent.length }
});
```

---

### 8. **Firebase Security Rules Terlalu Permissif**
**File**: `firestore.rules`  
**Severity**: 🟠 HIGH  
**Deskripsi**: Rule di `exam_templates` memungkinkan read semua user untuk documents tanpa `user_id`.
```firestore
// ⚠️ Sekarang: Memungkinkan read documents tanpa user_id check
match /exam_templates/{templateId} {
  allow read: if isAuthenticated() && (
    resource.data.user_id == request.auth.uid || 
    !exists(resource.data.user_id)  // ← Bahaya!
  );
}
```

**Risiko**: 
- Template ujian bisa diakses user lain jika `user_id` tidak set
- Data leakage potential

**Solusi**:
```firestore
// ✅ Stricter rule
match /exam_templates/{templateId} {
  allow read: if isAuthenticated() && 
                 resource.data.user_id == request.auth.uid;
  
  // Untuk shared templates, gunakan collection terpisah:
  match /public_exam_templates/{templateId} {
    allow read: if isAuthenticated();
    allow create: if isAuthenticated() && 
                     request.resource.data.created_by == request.auth.uid;
  }
}
```

---

### 9. **No Rate Limiting untuk Gemini API di Server**
**File**: `lib/gemini.ts`  
**Severity**: 🟠 HIGH  
**Deskripsi**: Redis rate limiting optional, bisa bypass jika Redis down.
```typescript
// ⚠️ Sekarang: Fallback ke no-rate-limit jika Redis fails
async function reserveKeyToken(key: string): Promise<boolean> {
  if (!redis) {
    return true; // ← Allow tanpa rate limit!
  }
  // ...
}
```

**Solusi**:
```typescript
// ✅ Hard rate limiting dengan in-memory fallback
class InMemoryRateLimiter {
  private keyLimits = new Map<string, { count: number; resetAt: number }>();
  private readonly CAPACITY = 15;
  private readonly WINDOW_MS = 60000;

  async canMakeRequest(key: string): Promise<boolean> {
    const now = Date.now();
    const existing = this.keyLimits.get(key);
    
    if (!existing || now >= existing.resetAt) {
      this.keyLimits.set(key, { count: 1, resetAt: now + this.WINDOW_MS });
      return true;
    }
    
    if (existing.count < this.CAPACITY) {
      existing.count++;
      return true;
    }
    
    return false;
  }
}

const inMemoryLimiter = new InMemoryRateLimiter();

async function reserveKeyToken(key: string): Promise<boolean> {
  if (redis) {
    // Try Redis first
    try {
      return await redisRateLimit(key);
    } catch (e) {
      console.warn('Redis failed, falling back to in-memory');
    }
  }
  // Always have fallback
  return inMemoryLimiter.canMakeRequest(key);
}
```

---

### 10. **No CSRF Protection**
**File**: `contexts/AuthContext.tsx`, API routes  
**Severity**: 🟠 HIGH  
**Deskripsi**: POST requests tidak ada CSRF token validation.
```typescript
// ❌ No CSRF token check
export async function POST(request: NextRequest) {
  // Bisa di-exploit dari cross-origin
  const body = await request.json();
}
```

**Solusi**:
```typescript
// ✅ Tambahkan CSRF protection
import { cookies } from 'next/headers';
import crypto from 'crypto';

// Middleware
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [process.env.NEXTAUTH_URL];
  
  if (!allowedOrigins.includes(origin || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify CSRF token
  const csrfToken = request.headers.get('x-csrf-token');
  const cookieStore = cookies();
  const storedToken = cookieStore.get('csrf-token')?.value;
  
  if (!csrfToken || csrfToken !== storedToken) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  
  // Proceed...
}
```

---

### 11. **Password Tidak Divalidasi**
**File**: `app/login/page.tsx`  
**Severity**: 🟠 HIGH  
**Deskripsi**: Tidak ada password strength validation.
```typescript
// ❌ Sekarang: Accept password apapun
const [password, setPassword] = useState('');

const handleLogin = async () => {
  try {
    if (isNewUser) {
      await signUp(email, password, displayName); // No validation!
    } else {
      await signIn(email, password);
    }
  } catch (err) {
    setError(err.message || 'Terjadi kesalahan');
  }
}
```

**Solusi**:
```typescript
// ✅ Implement password validation
const passwordSchema = z.string()
  .min(8, 'Password minimal 8 karakter')
  .regex(/[A-Z]/, 'Minimal 1 huruf besar')
  .regex(/[a-z]/, 'Minimal 1 huruf kecil')
  .regex(/[0-9]/, 'Minimal 1 angka')
  .regex(/[!@#$%^&*]/, 'Minimal 1 karakter spesial (!@#$%^&*)');

const handleLogin = async () => {
  try {
    if (isNewUser) {
      // Validate password
      const validatedPassword = passwordSchema.parse(password);
      await signUp(email, validatedPassword, displayName);
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      setError(err.errors[0].message);
    }
  }
}
```

---

### 12. **No Email Verification**
**File**: `contexts/AuthContext.tsx`, Firebase Auth config  
**Severity**: 🟠 HIGH  
**Deskripsi**: User bisa sign up dengan email palsu tanpa verification.

**Solusi**:
```typescript
// ✅ Enforce email verification
export async function useAuth() {
  // After sign up:
  await sendEmailVerification(user);
  
  // Before allowing access:
  if (!user.emailVerified && requireEmailVerification) {
    setError('Please verify your email first');
    // Show "Resend verification" button
  }
}

// Server action to verify
export async function verifyEmail(token: string) {
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    // Mark user as verified in Firestore users collection
    await updateDoc(doc(db, 'users', decodedToken.uid), {
      emailVerified: true,
      emailVerifiedAt: new Date()
    });
  } catch (error) {
    throw new Error('Invalid verification token');
  }
}
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### 13. **Inconsistent Error Handling**
**File**: Multiple pages  
**Severity**: 🟡 MEDIUM  
**Deskripsi**: Error handling bervariasi di berbagai file.
```typescript
// ❌ Inconsistent patterns
// Beberapa file:
catch (error: any) { setError(error.message); }

// File lain:
catch (error) { console.error(error); }

// File lain:
catch (err: any) { setError(err.message || 'Gagal'); }
```

**Solusi**: Buat error utility layer
```typescript
// utils/errorHandler.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public originalError?: Error
  ) {
    super(message);
  }
}

export function handleError(error: unknown): { message: string; code: string } {
  if (error instanceof AppError) {
    return { message: error.message, code: error.code };
  }
  
  if (error instanceof z.ZodError) {
    return {
      message: error.errors[0].message,
      code: 'VALIDATION_ERROR'
    };
  }
  
  return {
    message: 'Terjadi kesalahan tidak terduga',
    code: 'UNKNOWN_ERROR'
  };
}

// Usage:
try {
  // ...
} catch (error) {
  const { message, code } = handleError(error);
  setError(message);
}
```

---

### 14. **No Loading States untuk Long Operations**
**File**: `app/dashboard/generate-tp/page.tsx`  
**Severity**: 🟡 MEDIUM  
**Deskripsi**: Loading state ada tapi tidak comprehensive.
```typescript
// ⚠️ Sekarang: Loading state tapi user bisa close tab
const handleGenerate = async () => {
  setLoading(true);
  try {
    // API call bisa taak 30+ seconds...
  } finally {
    setLoading(false);
  }
}
```

**Solusi**:
```typescript
// ✅ Better loading UX
interface GenerationProgress {
  status: 'idle' | 'initializing' | 'processing' | 'finalizing';
  progress: number; // 0-100
  message: string;
  estimatedTime: number; // seconds
}

const [generationState, setGenerationState] = useState<GenerationProgress>({
  status: 'idle',
  progress: 0,
  message: '',
  estimatedTime: 0
});

const handleGenerate = async () => {
  setGenerationState({ status: 'initializing', progress: 10, message: 'Mempersiapkan...', estimatedTime: 45 });
  
  try {
    // Start generation
    setGenerationState(prev => ({ ...prev, status: 'processing', progress: 30, message: 'Menganalisis konten...' }));
    
    // Call API with progress
    const response = await generateQuestionsAction({
      // ...
      onProgress: (event) => {
        setGenerationState(prev => ({
          ...prev,
          progress: event.progress,
          message: event.message
        }));
      }
    });
    
    setGenerationState(prev => ({ ...prev, status: 'finalizing', progress: 90 }));
  } finally {
    setGenerationState({ status: 'idle', progress: 0, message: '', estimatedTime: 0 });
  }
}
```

---

### 15. **No Pagination untuk Firestore Queries**
**File**: `app/dashboard/master-data/page.tsx`, `app/dashboard/rekap-nilai/page.tsx`  
**Severity**: 🟡 MEDIUM  
**Deskripsi**: Load semua documents bisa timeout untuk large datasets.
```typescript
// ⚠️ Sekarang: Load all classes (max 50)
const q = query(
  collection(db, 'classes'),
  where('user_id', '==', user.uid),
  limit(50) // Hardcoded limit, tidak flexible
);
```

**Solusi**:
```typescript
// ✅ Implement cursor-based pagination
interface PaginationState {
  docs: any[];
  lastVisible: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

const [pagination, setPagination] = useState<PaginationState>({
  docs: [],
  lastVisible: null,
  hasMore: true
});

const loadMore = async () => {
  let q = query(
    collection(db, 'classes'),
    where('user_id', '==', user.uid),
    limit(25) // Page size
  );

  if (pagination.lastVisible) {
    q = query(q, startAfter(pagination.lastVisible));
  }

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;

  setPagination(prev => ({
    docs: [...prev.docs, ...docs.map(d => ({ id: d.id, ...d.data() }))],
    lastVisible: docs[docs.length - 1],
    hasMore: docs.length === 25
  }));
}
```

---

### 16. **No Caching Strategy**
**File**: `app/dashboard/generate-soal/page.tsx`, learning goals loading  
**Severity**: 🟡 MEDIUM  
**Deskripsi**: Same queries executed multiple times tanpa caching.
```typescript
// ⚠️ Load learning goals every time component mounts
useEffect(() => {
  if (user) {
    loadLearningGoals(); // Query Firestore setiap render
  }
}, [user]);
```

**Solusi**:
```typescript
// ✅ Implement caching layer
const useQueryCache = <T,>(
  key: string,
  fetcher: () => Promise<T>,
  options = { ttl: 5 * 60 * 1000 } // 5 min default
) => {
  const cache = useRef<{ data: T; timestamp: number } | null>(null);
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    const now = Date.now();
    
    if (cache.current && now - cache.current.timestamp < options.ttl) {
      setData(cache.current.data);
      return;
    }

    fetcher().then(result => {
      cache.current = { data: result, timestamp: now };
      setData(result);
    });
  }, [key]);

  return data;
};

// Usage:
const learningGoals = useQueryCache(
  `learning-goals-${user?.uid}`,
  loadLearningGoals,
  { ttl: 10 * 60 * 1000 } // 10 min
);
```

---

### 17. **No Offline Support**
**File**: `lib/firebase.ts`  
**Severity**: 🟡 MEDIUM  
**Deskripsi**: App tidak support offline mode.
```typescript
// ⚠️ Sekarang: Persistent local cache ada tapi incomplete
db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
```

**Solusi**:
```typescript
// ✅ Full offline support dengan sync queue
interface SyncQueue {
  id: string;
  operation: 'create' | 'update' | 'delete';
  collection: string;
  docId: string;
  data: any;
  timestamp: number;
}

export class OfflineManager {
  private syncQueue: SyncQueue[] = [];

  async queueOperation(
    op: SyncQueue['operation'],
    collection: string,
    docId: string,
    data: any
  ) {
    this.syncQueue.push({
      id: crypto.randomUUID(),
      operation: op,
      collection,
      docId,
      data,
      timestamp: Date.now()
    });
    await this.persistQueue();
  }

  async syncQueue() {
    for (const item of this.syncQueue) {
      try {
        const docRef = doc(db, item.collection, item.docId);
        
        switch (item.operation) {
          case 'create':
            await setDoc(docRef, item.data);
            break;
          case 'update':
            await updateDoc(docRef, item.data);
            break;
          case 'delete':
            await deleteDoc(docRef);
            break;
        }
        
        // Remove from queue
        this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
      } catch (error) {
        console.error('Sync failed:', error);
        break; // Stop on first error
      }
    }
  }

  private async persistQueue() {
    // Save queue to local storage
    localStorage.setItem('sync-queue', JSON.stringify(this.syncQueue));
  }
}
```

---

### 18. **No Input Validation di Frontend**
**File**: `app/dashboard/master-data/page.tsx`  
**Severity**: 🟡 MEDIUM  
**Deskripsi**: Form inputs tidak validate client-side sebelum submit.
```typescript
// ⚠️ Minimal validation
const handleAddClass = async (formData: FormData) => {
  const className = formData.get('className');
  
  if (!className) {
    return; // Only check empty, tidak validate format
  }
  
  // Try to save...
};
```

**Solusi**: Gunakan React Hook Form + Zod
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const classSchema = z.object({
  className: z.string()
    .min(1, 'Class name required')
    .max(100, 'Class name too long')
    .regex(/^[a-zA-Z0-9\s\-]+$/, 'Invalid characters'),
  gradeLevel: z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, 'Format: 2024-2025')
});

export function AddClassForm() {
  const {
    register,
    formState: { errors },
    handleSubmit
  } = useForm({
    resolver: zodResolver(classSchema)
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('className')} />
      {errors.className && <span>{errors.className.message}</span>}
      
      <select {...register('gradeLevel')}>
        {/* Options */}
      </select>
      {errors.gradeLevel && <span>{errors.gradeLevel.message}</span>}
    </form>
  );
}
```

---

### 19. **No Environment Validation on Startup**
**File**: `lib/firebase.ts`, `lib/gemini.ts`  
**Severity**: 🟡 MEDIUM  
**Deskripsi**: App crash silent jika env var missing, tidak ada early warning.
```typescript
// ⚠️ Sekarang: Error di startup tidak clear
if (RAW_KEYS.length === 0) {
  throw new Error('No Gemini API key found. Define GEMINI_API_KEYS or GEMINI_API_KEY in environment variables');
}
```

**Solusi**:
```typescript
// ✅ Comprehensive env validation
import { z } from 'zod';

const envSchema = z.object({
  // Firebase
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  
  // Firebase Admin (only on server)
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1),
  
  // Gemini
  GEMINI_API_KEYS: z.string().min(1),
  
  // Optional
  REDIS_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map(e => e.path.join('.')).join(', ');
      console.error(`❌ Missing or invalid environment variables: ${missing}`);
      console.error('Please check your .env.local file');
      process.exit(1);
    }
    throw error;
  }
}

const env = validateEnv();
export default env;
```

---

### 20. **No Database Transactions**
**File**: `app/dashboard/koreksi/page.tsx`  
**Severity**: 🟡 MEDIUM  
**Deskripsi**: Operasi multi-document tidak atomic, bisa inconsistent state.
```typescript
// ⚠️ Sekarang: Update siswa dan grades terpisah
const updateScore = async (studentId: string, gradeData: any) => {
  await updateDoc(doc(db, 'classes', classId, 'students', studentId), {
    updated_at: new Date()
  });
  
  // Jika fail di sini, data inconsistent
  await addDoc(collection(db, 'grades'), gradeData);
};
```

**Solusi**:
```typescript
// ✅ Use Firestore transaction
import { runTransaction } from 'firebase/firestore';

const updateScore = async (studentId: string, gradeData: any) => {
  await runTransaction(db, async (transaction) => {
    // Both operations succeed or both fail
    transaction.update(
      doc(db, 'classes', classId, 'students', studentId),
      { updated_at: new Date() }
    );
    
    transaction.set(
      doc(collection(db, 'grades')),
      gradeData
    );
  });
};
```

---

## 🔵 LOW PRIORITY / NICE-TO-HAVE

### 21. **No WebSocket Support**
Untuk real-time collaboration (multiple teachers editing TP simultaneously).

### 22. **No Dark Mode**
Tambahkan dark mode toggle untuk UX experience.

### 23. **No Analytics Tracking**
Tidak ada usage analytics untuk understand user behavior.

### 24. **No AI Model Comparison**
Bisa compare hasil dari different Gemini models.

### 25. **No Bulk Export/Import**
Hanya support individual file operations.

### 26. **No Teacher-to-Teacher Sharing**
TP tidak bisa dishare antar guru.

### 27. **No Backup System**
Tidak ada automatic backup mechanism.

### 28. **No Version Control untuk TP**
Tidak bisa lihat history changes dari TP.

---

## ✅ IMPLEMENTATION ROADMAP

### Phase 1: Security Hardening (1-2 weeks) - **MUST DO**
```
Priority 1 (Critical):
[ ] Implement API token verification (Issue #2)
[ ] Add per-user rate limiting (Issue #5)
[ ] Remove error message leakage (Issue #4)
[ ] Implement CSRF protection (Issue #10)
[ ] Secure API key exposure (Issue #1)

Priority 2 (High):
[ ] Implement password validation (Issue #11)
[ ] Add email verification (Issue #12)
[ ] Stricter Firestore rules (Issue #8)
[ ] Add comprehensive logging (Issue #7)
[ ] Improve rate limiting resilience (Issue #9)
```

### Phase 2: Code Quality & Reliability (2-3 weeks)
```
[ ] Standardize error handling (Issue #13)
[ ] Add input validation (Issue #18)
[ ] Implement pagination (Issue #15)
[ ] Add environment validation (Issue #19)
[ ] Use transactions (Issue #20)
[ ] Improve loading states (Issue #14)
```

### Phase 3: Performance & UX (2-3 weeks)
```
[ ] Add caching layer (Issue #16)
[ ] Offline support (Issue #17)
[ ] Optimize Firestore queries
[ ] Add analytics tracking
[ ] Dark mode support
```

---

## 📊 METRICS & KPIs

Setelah implementasi improvements, track:

```
Security:
- [ ] Failed auth attempts / day
- [ ] API abuse attempts detected
- [ ] Security audit log entries

Performance:
- [ ] API response time (target: <2s)
- [ ] Cache hit rate (target: >80%)
- [ ] Firestore quota usage (track daily)

Reliability:
- [ ] Error rate (target: <0.1%)
- [ ] Uptime (target: 99.9%)
- [ ] Page load time (target: <3s)

User Experience:
- [ ] Page bounce rate (target: <20%)
- [ ] Feature usage (analytics)
- [ ] User satisfaction (survey)
```

---

## 📚 RESOURCES & REFERENCES

### Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Best Practices](https://firebase.google.com/docs/security)
- [Node.js Security Checklist](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)

### Performance
- [Next.js Performance Guide](https://nextjs.org/docs/advanced-features/performance-optimizations)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)

### Code Quality
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [React Best Practices](https://react.dev/reference/rules)

---

## 💬 KESIMPULAN

Aplikasi ini memiliki **foundation yang kuat** dengan:
- ✅ Good documentation
- ✅ Clean architecture
- ✅ Proper use of Firebase

Namun perlu **urgent security improvements** terutama:
1. API endpoint authentication
2. Rate limiting implementation
3. Input validation dan error handling

**Estimated effort**: 
- Security fixes: 3-4 weeks
- Code quality: 2-3 weeks  
- Performance: 2-3 weeks
- **Total: 7-10 weeks untuk full hardening**

**Quick wins (dapat implement hari ini)**:
1. Tambahkan Firebase token verification di API endpoints (2-3 jam)
2. Add rate limiting dengan Upstash (1-2 jam)
3. Sanitize error messages (1-2 jam)
4. Add CSRF protection (2-3 jam)

---

**Generated**: 5 December 2024  
**Reviewed by**: AI Code Analysis System  
**Next Review**: After Phase 1 implementation
