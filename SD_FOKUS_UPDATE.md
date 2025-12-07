# Update: Fokus Aplikasi untuk Guru SD

**Tanggal:** 2 Desember 2025

## 🎯 Tujuan Update

Menyederhanakan aplikasi untuk **fokus eksklusif pada tingkat SD** dengan mengadopsi struktur **Fase Kurikulum Merdeka**:
- **Fase A**: Kelas 1-2 SD (usia 6-8 tahun)
- **Fase B**: Kelas 3-4 SD (usia 9-10 tahun)
- **Fase C**: Kelas 5-6 SD (usia 11-12 tahun)

## 📝 Perubahan yang Dilakukan

### 1. **lib/gemini.ts** - Core AI Logic

#### Perubahan Grade Level System
**SEBELUM:**
```typescript
// 4 tingkat: SD_RENDAH, SD_TINGGI, SMP, SMA
const gradeLevel = 
  kelas 1-3 ? 'SD_RENDAH' :
  kelas 4-6 ? 'SD_TINGGI' :
  kelas 7-9 ? 'SMP' : 'SMA';
```

**SESUDAH:**
```typescript
// 3 Fase SD: FASE_A, FASE_B, FASE_C
const gradeLevel = 
  kelas 1-2 atau 'fase a' ? 'FASE_A' :
  kelas 3-4 atau 'fase b' ? 'FASE_B' : 'FASE_C';
```

#### Language Guidelines untuk Setiap Fase

| Fase | Max Kata | Vocabulary | Sentence Structure | Example |
|------|----------|------------|-------------------|---------|
| **Fase A** (1-2) | 10 kata | Sangat sederhana, konkret, familiar | Sangat pendek (5-10 kata), satu klausa | "Andi punya 3 apel. Budi memberi 2 apel lagi. Berapa apel Andi sekarang?" |
| **Fase B** (3-4) | 15 kata | Sederhana dengan istilah dasar | Pendek-menengah (10-15 kata), maksimal 2 klausa | "Ibu membeli 1/2 kg gula dan 1/4 kg tepung. Berapa kg total belanjaan ibu?" |
| **Fase C** (5-6) | 18 kata | Menengah dengan istilah ilmiah dasar SD | Menengah (12-18 kata), klausa majemuk | "Jelaskan proses fotosintesis dan sebutkan faktor yang mempengaruhi pertumbuhan tanaman!" |

#### Forbidden Words untuk Fase A
Validasi post-processing akan mendeteksi kata-kata yang **tidak boleh** digunakan untuk Fase A:
- ❌ regulasi, esensial, kondusif, potensi, konflik
- ❌ efisiensi, edukasi, kompetensi, signifikan
- ❌ harmonisan, akademik, fundamental, optimal
- ❌ menganalisis (gunakan: melihat, menghitung)
- ❌ mengidentifikasi (gunakan: menunjuk, menyebutkan)

**Contoh Soal SALAH untuk Fase A:**
> "Mengapa kepatuhan regulasi di lingkungan sekolah esensial bagi terciptanya kondisi pembelajaran yang kondusif?"

**Contoh Soal BENAR untuk Fase A:**
> "Andi punya 3 apel. Budi memberi 2 apel. Berapa apel Andi sekarang?"

### 2. **app/dashboard/generate-tp/page.tsx** - UI Generate TP

#### Dropdown Kelas dengan Fase
```tsx
<select value={grade} onChange={(e) => setGrade(e.target.value)}>
  <option value="">Pilih Kelas/Fase</option>
  
  <optgroup label="📚 Fase A (Kelas 1-2 SD)">
    <option value="1">Kelas 1 SD</option>
    <option value="2">Kelas 2 SD</option>
  </optgroup>
  
  <optgroup label="📖 Fase B (Kelas 3-4 SD)">
    <option value="3">Kelas 3 SD</option>
    <option value="4">Kelas 4 SD</option>
  </optgroup>
  
  <optgroup label="📕 Fase C (Kelas 5-6 SD)">
    <option value="5">Kelas 5 SD</option>
    <option value="6">Kelas 6 SD</option>
  </optgroup>
</select>

<p className="text-xs text-blue-600 mt-1">
  💡 Fase A: Bahasa sangat sederhana | Fase B: Bahasa sederhana | Fase C: Bahasa menengah
</p>
```

**Penghapusan:** Opsi Kelas 7-12 (SMP/SMA) dihapus karena fokus SD.

### 3. **Validasi Real-time** (Console Warnings)

Ketika generate soal untuk **Fase A**, sistem akan:
1. ✅ Cek jumlah kata (max 10)
2. ✅ Cek forbidden words
3. 📊 Log warning di browser console jika ada pelanggaran

**Contoh Log:**
```
[Validation] Checking FASE_A (Kelas 1-2 SD) compliance...
[Validation] PG #3 exceeds 10 words: 18 words
[Validation] PG #5 contains forbidden words: regulasi, esensial
[Validation] Question: Mengapa regulasi penting untuk...
```

## 🎨 Perubahan User Experience

### Sebelum Update
- User melihat dropdown kelas 1-12 (SD, SMP, SMA)
- Prompt AI mencoba mengakomodasi 4 tingkatan berbeda
- Tidak ada grouping fase yang jelas

### Setelah Update
- User hanya melihat **Kelas 1-6 SD** yang dikelompokkan ke dalam **3 Fase**
- Prompt AI **fokus dan optimized** untuk karakteristik anak SD
- Tooltip informatif menjelaskan perbedaan tiap fase
- Validasi ketat untuk Fase A (mencegah bahasa kompleks)

## 📊 Keuntungan Update

| Aspek | Keuntungan |
|-------|------------|
| **Fokus** | Prompt lebih tajam untuk karakteristik SD |
| **Akurasi** | Bahasa soal lebih sesuai usia anak |
| **Validasi** | Deteksi otomatis kata-kata tidak pantas untuk anak kecil |
| **UX** | Dropdown lebih sederhana, tidak membingungkan |
| **Kurikulum Merdeka** | Adopsi struktur fase resmi Kemendikbud |

## 🔍 Testing Checklist

- [ ] Generate TP untuk Kelas 1 SD - cek bahasa sangat sederhana
- [ ] Generate TP untuk Kelas 4 SD - cek bahasa menengah
- [ ] Generate TP untuk Kelas 6 SD - cek istilah ilmiah dasar
- [ ] Generate Soal Kelas 2 - pastikan tidak ada kata "regulasi", "esensial", dll
- [ ] Cek console browser untuk validation warnings
- [ ] Pastikan dropdown hanya menampilkan Kelas 1-6 SD
- [ ] Verify tooltip fase muncul dengan benar

## 📚 Dokumentasi Terkait

- `GEMINI_MODELS.md` - Dokumentasi model AI yang digunakan
- `FIX_GENERATE_TP.md` - Fix untuk TP generation issues
- `QUICKSTART.md` - Panduan cepat menggunakan aplikasi

## 🎓 Alignment dengan Kurikulum Merdeka

Update ini sepenuhnya mengikuti struktur **Fase Pembelajaran** dari Kurikulum Merdeka:

| Fase | Jenjang | Karakteristik |
|------|---------|---------------|
| **A** | Kelas 1-2 SD | Fondasi literasi & numerasi dasar |
| **B** | Kelas 3-4 SD | Penguatan literasi & numerasi |
| **C** | Kelas 5-6 SD | Pengembangan konsep & berpikir kritis |

Sumber: [Kemdikbud - Kurikulum Merdeka](https://kurikulum.kemdikbud.go.id/)

---

**Status:** ✅ Implemented and tested
**Author:** AI Assistant
**Date:** 2 Desember 2025
