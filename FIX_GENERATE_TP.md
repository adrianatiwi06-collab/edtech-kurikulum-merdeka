# Fix Generate TP - Server Actions Error

## 🐛 Problem yang Diperbaiki

### Error 1: Server Actions Error
```
Only plain objects, and a few built-ins, can be passed to Server Actions. 
Classes or null prototypes are not supported.
```

**Penyebab:** 
- Server Actions tidak bisa menerima File object atau ArrayBuffer
- Harus menggunakan plain objects (JSON serializable)

**Solusi:**
- ✅ Ganti Server Actions dengan API Route (`/api/generate-tp`)
- ✅ Convert PDF ke base64 di client-side sebelum dikirim
- ✅ Decode base64 ke Buffer di server-side

### Error 2: Tidak Ada Feedback Saat PDF Dibaca
**Solusi:**
- ✅ Tambahkan loading message dengan state yang jelas
- ✅ Indikator visual saat "Membaca file PDF..."
- ✅ Indikator visual saat "Sedang menganalisis..."

## ✅ Perubahan yang Dilakukan

### 1. File: `app/dashboard/generate-tp/page.tsx`

**Perubahan:**
```typescript
// BEFORE: Server Action (ERROR)
const arrayBuffer = await pdfFile!.arrayBuffer();
result = await generateTPFromPDF(arrayBuffer, grade, cpReference);

// AFTER: API Route + Base64
const arrayBuffer = await pdfFile!.arrayBuffer();
const bytes = new Uint8Array(arrayBuffer);
let binary = '';
for (let i = 0; i < bytes.length; i++) {
  binary += String.fromCharCode(bytes[i]);
}
const pdfBase64 = btoa(binary);

const response = await fetch('/api/generate-tp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: user.uid,
    pdfBase64: pdfBase64,
    // ... other data
  }),
});
```

**Loading State:**
```typescript
const [loadingMessage, setLoadingMessage] = useState('');

// Saat membaca PDF
setLoadingMessage('Membaca file PDF...');

// Setelah PDF dibaca
setLoadingMessage('PDF berhasil dibaca, sedang menganalisis...');

// Saat menganalisis text
setLoadingMessage('Sedang menganalisis materi...');
```

**UI Update:**
```tsx
{loading && loadingMessage && (
  <div className="p-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
    <Loader2 className="w-5 h-5 animate-spin" />
    <p className="font-medium">{loadingMessage}</p>
    {inputMethod === 'pdf' && (
      <p className="text-xs text-blue-600 mt-1">
        File PDF sedang diproses, mohon tunggu...
      </p>
    )}
  </div>
)}
```

### 2. File Baru: `app/api/generate-tp/route.ts`

**API Route Handler:**
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, textContent, pdfBase64, grade, cpReference } = body;

  // Decode base64 to Buffer (server-side)
  if (pdfBase64) {
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    contentToAnalyze = await extractTextFromPDF(pdfBuffer);
  }

  // Generate TP using Gemini AI
  const tpData = await generateLearningGoals(contentToAnalyze, grade, cpReference);

  return NextResponse.json({ success: true, data: tpData });
}
```

### 3. File Dihapus: `app/dashboard/generate-tp/actions.ts`

Server Actions tidak terpakai lagi, diganti dengan API Route.

## 🎯 Alur Kerja Baru

### Generate TP dari Text:
```
1. User input text
2. Click "Generate dari Teks"
3. Loading: "Sedang menganalisis materi..."
4. Fetch API: POST /api/generate-tp
5. Response: Generated TP data
6. Display hasil
```

### Generate TP dari PDF:
```
1. User upload PDF
2. Click "Generate dari PDF"
3. Loading: "Membaca file PDF..."
4. Convert PDF to base64 (client)
5. Loading: "PDF berhasil dibaca, sedang menganalisis..."
6. Fetch API: POST /api/generate-tp
7. Server: Decode base64 → Extract text → Generate TP
8. Response: Generated TP data
9. Display hasil
```

## 🔧 Technical Details

### Base64 Encoding (Client-Side)
```typescript
const arrayBuffer = await file.arrayBuffer();
const bytes = new Uint8Array(arrayBuffer);
let binary = '';
for (let i = 0; i < bytes.length; i++) {
  binary += String.fromCharCode(bytes[i]);
}
const base64 = btoa(binary);
```

### Base64 Decoding (Server-Side)
```typescript
const pdfBuffer = Buffer.from(pdfBase64, 'base64');
```

### Why Base64?
- ✅ JSON serializable (can send via fetch)
- ✅ No special characters
- ✅ Works with API routes
- ❌ ~33% larger than binary
- ❌ Extra encoding/decoding time

**Trade-off:** Sedikit lebih lambat, tapi lebih reliable dan tidak error.

## 📊 Performance Impact

| Metric | Before | After |
|--------|--------|-------|
| PDF processing | ❌ Error | ✅ Works |
| User feedback | ❌ No info | ✅ Clear messages |
| File size sent | N/A | +33% (base64) |
| Reliability | ❌ Fails | ✅ Stable |

## 🧪 Testing

### Test Case 1: Upload PDF
1. Pilih "Upload PDF"
2. Upload file PDF
3. Isi Grade dan CP Reference
4. Click "Generate dari PDF"
5. ✅ Muncul "Membaca file PDF..."
6. ✅ Muncul "PDF berhasil dibaca, sedang menganalisis..."
7. ✅ Hasil generate muncul

### Test Case 2: Input Text
1. Pilih "Input Teks"
2. Paste text materi
3. Isi Grade dan CP Reference
4. Click "Generate dari Teks"
5. ✅ Muncul "Sedang menganalisis materi..."
6. ✅ Hasil generate muncul

### Test Case 3: Large PDF (>5MB)
1. Upload PDF besar
2. ✅ Loading indicator tampil
3. ⏱️ Proses mungkin lambat (normal)
4. ✅ Berhasil atau error message jelas

## 💡 Best Practices

### For Users:
1. Gunakan PDF dengan text (bukan scan gambar)
2. PDF maksimal 10MB untuk performa optimal
3. Jika PDF gagal, coba copy-paste text manual
4. Pastikan internet stabil

### For Developers:
1. Always use API Routes for file processing
2. Never pass File/Blob/ArrayBuffer to Server Actions
3. Use base64 for binary data in JSON
4. Always provide loading feedback
5. Handle errors gracefully

## 🔮 Future Improvements

- [ ] Add file size validation (max 10MB)
- [ ] Add PDF preview before processing
- [ ] Add OCR for scanned PDF
- [ ] Add progress bar for large files
- [ ] Cache extracted PDF text
- [ ] Add file type validation

## 📚 References

- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Server Actions Limitations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#passing-arguments)
- [Base64 Encoding](https://developer.mozilla.org/en-US/docs/Glossary/Base64)

---

**Status:** ✅ Fixed and Tested
**Date:** December 2025
