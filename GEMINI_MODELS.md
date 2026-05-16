# Model AI yang Tersedia

## 🤖 Model Gemini yang Digunakan

Aplikasi ini menggunakan **Gemini 2.0 Flash (Experimental)** untuk performa terbaik.

## 📋 Daftar Model yang Tersedia

### Gemini 2.0 (Recommended)
- **gemini-2.0-flash-exp** ⭐ (Saat ini digunakan)
  - Model terbaru dan tercepat
  - Support untuk API v1beta
  - Gratis untuk akun Pro
  - Performa terbaik untuk generate TP dan soal

### Gemini 1.5 (Legacy)
- **gemini-1.5-flash**
  - Model lama, mungkin tidak support v1beta
  - ❌ Error 404 Not Found

- **gemini-1.5-pro**
  - Lebih akurat tapi lebih lambat
  - Untuk akun berbayar

## 🔧 Cara Ganti Model

Edit file `lib/gemini.ts`:

```typescript
// BEFORE (Error 404)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// AFTER (Works)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
```

## 💡 Pilihan Model Alternatif

Jika `gemini-2.0-flash-exp` tidak tersedia di region Anda:

1. **gemini-2.5-flash** (Seperti di screenshot)
   ```typescript
   const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
   ```

2. **gemini-2.5-pro** (Akun Pro, lebih akurat)
   ```typescript
   const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
   ```

3. **gemini-1.5-pro** (Fallback)
   ```typescript
   const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
   ```

## ⚠️ Troubleshooting

### Error: "404 Not Found"
**Penyebab**: Model tidak tersedia di API version yang digunakan

**Solusi**:
1. Ganti ke `gemini-2.0-flash-exp`
2. Atau cek model yang tersedia di: https://ai.google.dev/models/gemini

### Error: "429 Too Many Requests"
**Penyebab**: Quota API habis

**Solusi**:
1. Tunggu beberapa menit
2. Upgrade ke akun berbayar
3. Ganti API key

### Error: "API key not valid"
**Penyebab**: API key salah atau expired

**Solusi**:
1. Generate API key baru di Google AI Studio
2. Update `.env` file

## 📊 Perbandingan Model

| Model | Kecepatan | Akurasi | Quota | Status |
|-------|-----------|---------|-------|--------|
| gemini-2.0-flash-exp | ⚡⚡⚡ | ⭐⭐⭐ | Free | ✅ Active |
| gemini-2.5-flash | ⚡⚡⚡ | ⭐⭐⭐⭐ | Free (Pro) | ✅ Active |
| gemini-2.5-pro | ⚡⚡ | ⭐⭐⭐⭐⭐ | Paid | ✅ Active |
| gemini-1.5-flash | ⚡⚡⚡ | ⭐⭐ | Free | ❌ Deprecated |
| gemini-1.5-pro | ⚡⚡ | ⭐⭐⭐⭐ | Paid | ⚠️ Limited |

## 🎯 Rekomendasi

**Untuk Development (Gratis):**
- ✅ `gemini-2.0-flash-exp`

**Untuk Production (Akun Pro):**
- ✅ `gemini-2.5-flash` (Cepat + Akurat)
- ✅ `gemini-2.5-pro` (Paling Akurat)

## 🔗 Referensi

- [Gemini API Models](https://ai.google.dev/models/gemini)
- [Google AI Studio](https://makersuite.google.com/)
- [API Documentation](https://ai.google.dev/docs)

---

**Model Updated:** December 2025
**Current Model:** gemini-2.0-flash-exp
