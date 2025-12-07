# 🔒 Quick Security Implementation Guide

**Tanggal**: 5 Desember 2024  
**Dibuat**: 4 quick wins security implementation

---

## 📋 Ringkasan Implementasi

Anda sekarang memiliki 4 layer security yang telah diimplementasikan:

```
┌─────────────────────────────────────────┐
│ 1️⃣  Firebase Token Auth                │
│    (Verifikasi user identity)           │
├─────────────────────────────────────────┤
│ 2️⃣  Rate Limiting (5 req/min/user)      │
│    (Prevent abuse & quota exhaustion)   │
├─────────────────────────────────────────┤
│ 3️⃣  Error Sanitization                 │
│    (Generic errors, server-side logging)│
├─────────────────────────────────────────┤
│ 4️⃣  CSRF Token Protection              │
│    (Prevent cross-site attacks)         │
└─────────────────────────────────────────┘
```

---

## 🎯 Next Steps untuk Deployment

### Step 1: Update Client-Side API Calls (Priority: HIGH)

**Cari semua fetch calls ke API endpoints** dan update ke menggunakan auth:

Gunakan find & replace di project:
- Search: `fetch('/api/generate-tp'` 
- Replace dengan: `authenticatedFetch('/api/generate-tp'`

Atau gunakan helper baru:
```typescript
import { authenticatedFetch } from '@/lib/auth-fetch';

// Replace old code:
// const response = await fetch('/api/generate-tp', { body: { userId, ... } })

// With new code:
const response = await authenticatedFetch('/api/generate-tp', {
  body: { /* NO userId field */ ... }
});
```

### Step 2: Apply CSRF Protection ke Form Components

**Tambahkan CSRF token ke semua form POST requests:**

```typescript
import { useCSRFToken } from '@/hooks/useCSRFToken';

export function MyForm() {
  const csrfToken = useCSRFToken();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken || ''  // ← Add this
      },
      body: JSON.stringify(formData)
    });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Step 3: Update Remaining API Endpoints

Terapkan auth middleware ke endpoints lain:

```typescript
// app/api/generate-soal/route.ts
import { withAuthAndRateLimit } from '@/lib/auth-middleware';
import { generateSoalLimiter } from '@/lib/rate-limiter';

export const POST = withAuthAndRateLimit(generateSoalLimiter, async (request, { userId }) => {
  // Your code here - userId is VERIFIED
});
```

### Step 4: Test Di Local

```bash
# 1. Start dev server
npm run dev

# 2. Open browser to http://localhost:3000

# 3. Login dengan user account

# 4. Try generate TP/Soal - should work

# 5. Check browser console - should see auth token in requests

# 6. Try making request without token:
curl http://localhost:3000/api/generate-tp
# Should return 401 Unauthorized
```

---

## 🚀 Deploy ke Production

### Pre-Deployment Checklist

- [ ] Update all API calls to use `authenticatedFetch`
- [ ] Add CSRF token to all form submissions
- [ ] Update all endpoints dengan auth middleware
- [ ] Test locally thoroughly
- [ ] Set `NEXT_PUBLIC_APP_URL` in production env
- [ ] Deploy to production
- [ ] Test production endpoints

### After Deployment

Monitor untuk:
```
✅ Auth failures - should be < 0.1%
✅ Rate limit hits - should be < 5% of requests
✅ CSRF failures - should be 0%
✅ API latency - should not increase
```

---

## 📊 What Changed

| Component | Before | After | Impact |
|-----------|--------|-------|--------|
| API Auth | No verification | Firebase token required | 🔴 Critical |
| Rate Limit | None | 5 req/min/user | 🔴 Critical |
| Errors | Detailed | Generic + logs | 🟠 High |
| CSRF | No protection | Token validation | 🟡 Medium |

---

## ⚠️ Important Notes

### Error Handling di Client

Response errors sekarang memiliki struktur berbeda:

**Old**:
```json
{ "error": "Gagal membaca PDF: Invalid PDF header" }
```

**New**:
```json
{ 
  "error": "Failed to process PDF file",
  "code": "PDF_PROCESSING_ERROR"
}
```

Update client error handling untuk gunakan `code`:
```typescript
try {
  const result = await authenticatedFetch('/api/generate-tp', { ... });
} catch (error: any) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    showMessage('Terlalu banyak request, tunggu beberapa saat');
  } else if (error.code === 'TOKEN_EXPIRED') {
    redirectToLogin();
  } else {
    showMessage('Terjadi kesalahan, coba lagi');
  }
}
```

### Rate Limit Response Headers

Cek header untuk smart retry logic:
```typescript
const response = await fetch('/api/generate-tp', ...);
const remaining = response.headers.get('X-RateLimit-Remaining');
const resetAt = response.headers.get('X-RateLimit-Reset');

if (remaining === '0') {
  console.log('Rate limited until:', resetAt);
}
```

---

## 🔧 Troubleshooting

### "Missing Authorization header"
- ✅ Solution: Gunakan `authenticatedFetch` atau manual tambahkan header dengan token

### "CSRF token invalid"
- ✅ Solution: Pastikan `useCSRFToken` hook digunakan dan token included di header

### "Rate limit exceeded" (429)
- ✅ Solution: Tunggu 60 detik atau cek `X-RateLimit-Reset` header

### "Token expired"
- ✅ Solution: User perlu login ulang (token lifetime: 1 jam)

---

## 📚 File Reference

| File | Purpose |
|------|---------|
| `lib/auth-middleware.ts` | Firebase token verification + rate limiting |
| `lib/rate-limiter.ts` | Rate limiter implementation |
| `lib/auth-fetch.ts` | Client-side authenticated fetch |
| `lib/csrf-protection.ts` | CSRF token generation & validation |
| `app/api/csrf-token/route.ts` | Endpoint for CSRF tokens |
| `hooks/useCSRFToken.ts` | React hooks for CSRF |
| `SECURITY_IMPLEMENTATION.md` | Full detailed documentation |

---

## ✅ Success Criteria

Implementasi sukses jika:

1. ✅ Semua API calls include Authorization header dengan valid token
2. ✅ Invalid requests return 401 Unauthorized
3. ✅ Rate limited requests return 429 dengan Retry-After header
4. ✅ Error responses tidak mengandung system details
5. ✅ CSRF tokens di-generate dan di-validate
6. ✅ Server logs berisi full error details (bukan di response)

---

**Estimation**: 2-3 jam untuk update semua components  
**Complexity**: Medium  
**Risk**: Low (backward compatible dengan fallback)

Hubungi jika ada pertanyaan! 🚀
