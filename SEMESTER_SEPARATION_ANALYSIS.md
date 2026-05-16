# Analisis Logika Pemisahan TP ke Semester 1 & 2

## 📊 Status Saat Ini

Berdasarkan analisis kode `lib/gemini.ts` dan `app/api/generate-tp/route.ts`, berikut adalah flow pemisahan TP ke semester:

### ✅ Yang Sudah Dikerjakan

#### 1. **Instruksi Prompt (Baris 601 di gemini.ts)**
```typescript
1. Kelompokkan TP ke dalam Semester 1 dan Semester 2 dengan distribusi SEIMBANG (50:50)
   - Bab awal/dasar → Semester 1
   - Bab lanjutan/kompleks → Semester 2
```

**Detail Instruksi:**
- ✅ Semester 1 mendapat BAB AWAL/DASAR (konsep fundamental)
- ✅ Semester 2 mendapat BAB LANJUTAN/KOMPLEKS (aplikasi dan analisis)
- ✅ Target: 50:50 balance antara kedua semester
- ✅ Maksimal 3 TP per Bab untuk fokus pada kualitas

#### 2. **Format Output JSON (Baris 691-710 di gemini.ts)**
```json
{
  "semester1": [
    {
      "chapter": "Nama Bab/Elemen",
      "tps": [
        "Peserta didik mampu [kata kerja] [objek] [kondisi]",
        "Peserta didik mampu [kata kerja] [objek] [kondisi]"
      ]
    }
  ],
  "semester2": [
    {
      "chapter": "Nama Bab/Elemen",
      "tps": [...]
    }
  ]
}
```

**Validasi di Prompt (Baris 712-715):**
```
- Output harus punya TP untuk semester 1 DAN semester 2 (tidak boleh kosong salah satu)
- Distribusi bab harus seimbang antara kedua semester
```

#### 3. **Parsing & Validasi (Baris 724-900 di gemini.ts)**

A. **Parse Response**
```typescript
const parsed = parseJSONResponse(text); // Line 724
```
- Menghilangkan markdown code blocks jika ada
- Parse JSON dan throw error jika invalid

B. **Post-Processing Validation**
- ✅ Mengecek Bloom Taxonomy KKO compliance (FASE_A, FASE_B, dst)
- ✅ Mengecek format ABCD (Audience, Behavior, Condition, Degree)
- ✅ Mengecek kata-kata terlarang sesuai fase
- ✅ Mengecek word count jika tidak maxLength100
- ✅ Mengecek 100-character limit jika maxLength100 enabled
- ✅ Validasi dilakukan UNTUK SETIAP TP di semester 1 dan 2

**Kode Validasi:**
```typescript
if (parsed.semester1) {
  parsed.semester1.forEach((chapter: any) => {
    chapter.tps.forEach((tp: string) => {
      validateTP(tp, 1, chapter.chapter); // Validasi per TP
    });
  });
}

if (parsed.semester2) {
  parsed.semester2.forEach((chapter: any) => {
    chapter.tps.forEach((tp: string) => {
      validateTP(tp, 2, chapter.chapter); // Validasi per TP
    });
  });
}
```

#### 4. **Return ke Frontend (route.ts Line 138-150)**
```typescript
return NextResponse.json({
  success: true,
  data: tpData,  // Structure: { semester1: [...], semester2: [...] }
  quotaInfo: { ... }
});
```

#### 5. **Frontend Rendering (page.tsx)**
- ✅ State `semesterSelection` untuk filter
- ✅ Dropdown semester baru ditambahkan
- ✅ Rendering kondisional berdasarkan pilihan:
  ```jsx
  {(semesterSelection === 'both' || semesterSelection === 'semester1') && renderTPSection(1)}
  {(semesterSelection === 'both' || semesterSelection === 'semester2') && renderTPSection(2)}
  ```

---

## ⚠️ Masalah & Gap yang Ditemukan

### Issue #1: **TIDAK ADA VALIDASI POST-PROCESSING UNTUK EMPTY SEMESTER** 🔴

**Lokasi:** `lib/gemini.ts` (Line 724-900)

**Masalah:**
- Prompt memerintahkan: "Output harus punya TP untuk semester 1 DAN semester 2 (tidak boleh kosong salah satu)"
- Namun **TIDAK ADA CODE** yang mengecek apakah semester1 atau semester2 kosong setelah parsing
- Jika AI mengembalikan `{ semester1: [...], semester2: [] }`, akan diterima apa adanya

**Skenario Risiko:**
```
1. AI generate TP hanya untuk semester 1
2. Parsing diterima tanpa validasi
3. Frontend render: hanya semester 1, semester 2 kosong
4. User bingung mengapa semester 2 tidak ada
```

**Current Code (Line 724):**
```typescript
const parsed = parseJSONResponse(text);

// Langsung ke validasi KKO tanpa cek empty semester!
console.log(`[TP Validation] Checking ${gradeLevel} compliance...`);

// Tidak ada validasi seperti:
// if (!parsed.semester1?.length || !parsed.semester2?.length) { throw error }
```

---

### Issue #2: **RETRY LOGIC JIKA SEMESTER KOSONG** 🔴

**Lokasi:** `lib/gemini.ts` (Line 881-894)

**Masalah:**
- Jika parsing gagal, ada retry dengan prompt tambahan (line 881+)
- **TETAPI** retry hanya untuk parse error (try-catch), bukan untuk semantic validation

**Current Code:**
```typescript
} catch (parseError) {  // Only JSON parsing errors!
  // Re-prompt with stricter instruction
  const retryPrompt = `${prompt}\n\nPERINGATAN: Response sebelumnya gagal di-parse...`;
  // TIDAK ada retry untuk "semester 1 kosong"
}
```

---

## 🎯 Rekomendasi Perbaikan

### Priority 1: Add Semester Validation 🔴 CRITICAL

**File:** `lib/gemini.ts`

**Tempat:** Setelah `parseJSONResponse(text)` (Line 724)

**Kode yang Ditambahkan:**
```typescript
const parsed = parseJSONResponse(text);

// ✅ VALIDATION: Check that both semesters have content
if (!parsed.semester1 || !Array.isArray(parsed.semester1) || parsed.semester1.length === 0) {
  console.error('[TP Validation CRITICAL] Semester 1 kosong atau tidak valid');
  throw new Error('AI failed to generate learning objectives for Semester 1. Please try again with more detailed CP reference.');
}

if (!parsed.semester2 || !Array.isArray(parsed.semester2) || parsed.semester2.length === 0) {
  console.error('[TP Validation CRITICAL] Semester 2 kosong atau tidak valid');
  throw new Error('AI failed to generate learning objectives for Semester 2. Please try again with more detailed CP reference.');
}

// ✅ VALIDATION: Check balance (optional but recommended)
const sem1Count = parsed.semester1.reduce((sum: number, ch: any) => sum + (ch.tps?.length || 0), 0);
const sem2Count = parsed.semester2.reduce((sum: number, ch: any) => sum + (ch.tps?.length || 0), 0);
const balance = Math.abs(sem1Count - sem2Count) / Math.max(sem1Count, sem2Count);

if (balance > 0.5) {  // More than 50% difference
  console.warn(`[TP Validation] Imbalance detected: Sem1=${sem1Count} TPs, Sem2=${sem2Count} TPs (${(balance*100).toFixed(1)}% difference)`);
  // Optional: warn or retry with stricter instruction
}

console.log(`[TP Validation] ✅ Both semesters valid - Semester1: ${sem1Count} TPs, Semester2: ${sem2Count} TPs`);

// Post-processing validation for generated TP with Bloom Taxonomy KKO check
console.log(`[TP Validation] Checking ${gradeLevel} compliance...`);
```

---

### Priority 2: Enhance Retry Logic 🟡 HIGH

**File:** `lib/gemini.ts`

**Tempat:** Ganti try-catch structure (Line 723-894)

**Perubahan:**
```typescript
try {
  const parsed = parseJSONResponse(text);
  
  // ✅ NEW: Add semester validation BEFORE KKO check
  if (!parsed.semester1?.length || !parsed.semester2?.length) {
    throw new Error('Invalid response: One or both semesters are empty');
  }
  
  // ... existing KKO validation ...
  
  return parsed;
} catch (error: any) {
  // ✅ ENHANCED: Retry with stronger instruction
  const isEmptySemesterError = error.message?.includes('semester') || error.message?.includes('empty');
  
  const enhancedPrompt = isEmptySemesterError 
    ? `${prompt}\n\n⚠️ CRITICAL: Sebelumnya output kosong di semester tertentu!\n✅ WAJIB: Generasikan TP untuk KEDUA semester:\n- Semester 1: minimal 2 bab dengan TP-nya\n- Semester 2: minimal 2 bab dengan TP-nya\n- JANGAN output semester kosong!`
    : `${prompt}\n\nPERINGATAN: Response sebelumnya gagal di-parse...`;
    
  const retryResult = await model.generateContent(enhancedPrompt);
  const retryResponse = await retryResult.response;
  const retryText = retryResponse.text();
  
  // Parse dan validate ulang
  const retryParsed = parseJSONResponse(retryText);
  if (!retryParsed.semester1?.length || !retryParsed.semester2?.length) {
    throw new Error('Retry failed: Still missing semester data');
  }
  
  return retryParsed;
}
```

---

### Priority 3: Add Telemetry & Logging 🟡 MEDIUM

**File:** `lib/gemini.ts`

**Tambahan Logging:**
```typescript
// After successful parsing and validation
console.log(`[TP SUCCESS] Generation completed:
  - Semester 1: ${sem1Count} TPs in ${parsed.semester1.length} chapters
  - Semester 2: ${sem2Count} TPs in ${parsed.semester2.length} chapters
  - Grade Level: ${gradeLevel}
  - Max Length 100: ${maxLength100 ? 'YES' : 'NO'}
  - Balance: ${(sem1Count / (sem1Count + sem2Count) * 100).toFixed(1)}% sem1 / ${(sem2Count / (sem1Count + sem2Count) * 100).toFixed(1)}% sem2`);
```

---

## 📋 Checklist: Logika Pemisahan Semester

| Aspek | Status | Keterangan |
|-------|--------|-----------|
| ✅ Prompt instruction untuk 2 semester | ✅ Ada | Baris 601 gemini.ts |
| ✅ Format JSON output (sem1 & sem2) | ✅ Ada | Baris 691-710 gemini.ts |
| ✅ Parse JSON response | ✅ Ada | Line 337 (parseJSONResponse) |
| ❌ Validasi semester tidak kosong | ❌ **MISSING** | 🔴 PERLU DITAMBAH |
| ✅ KKO validation per TP | ✅ Ada | Line 800+ (validateTP) |
| ✅ Format ABCD check | ✅ Ada | hasAudience, hasBehavior |
| ❌ Balance check (50:50) | ❌ **OPTIONAL** | Bisa ditambah sebagai warning |
| ✅ Retry jika gagal parse | ✅ Ada | Line 881-894 |
| ❌ Retry jika semester kosong | ❌ **MISSING** | 🔴 PERLU DITAMBAH |
| ✅ Return ke frontend | ✅ Ada | route.ts line 138-150 |
| ✅ Frontend rendering (sem1/sem2) | ✅ Ada | page.tsx line 789-790 |
| ✅ Frontend filtering (dropdown) | ✅ Ada (BARU) | Baru ditambahkan hari ini |

---

## 🔍 Contoh Flow Lengkap

### Scenario: Generate TP Kelas 4 SD - Tema "Perubahan Lingkungan"

#### Input dari User:
```
Grade: Kelas 4 SD
Subject: IPA (Science)
CP Reference: Siswa mampu memahami jenis-jenis perubahan di lingkungan alam dan buatan, 
serta dampak perubahan tersebut terhadap kehidupan makhluk hidup
Text Content: [Materi tentang perubahan lingkungan...]
Semester Selection: Semester 1 & 2
```

#### Process di Backend:

1. **AI receives prompt** dengan instruksi:
   ```
   "Kelompokkan TP ke dalam Semester 1 dan Semester 2 dengan distribusi SEIMBANG (50:50)
   - Bab awal/dasar → Semester 1 (contoh: Jenis-jenis Perubahan Alam, Perubahan Buatan Sederhana)
   - Bab lanjutan/kompleks → Semester 2 (contoh: Dampak Perubahan, Adaptasi Makhluk Hidup)"
   ```

2. **AI generates response:**
   ```json
   {
     "semester1": [
       {
         "chapter": "Jenis-jenis Perubahan Lingkungan",
         "tps": [
           "Peserta didik mampu menyebutkan jenis-jenis perubahan lingkungan berdasarkan pengamatan di sekitar rumah",
           "Peserta didik mampu membedakan perubahan alam dan perubahan buatan dengan memberikan contoh minimal 3 dari masing-masing"
         ]
       },
       {
         "chapter": "Perubahan Lingkungan Buatan",
         "tps": [
           "Peserta didik mampu memberikan contoh perubahan lingkungan buatan di desa atau kota terdekat"
         ]
       }
     ],
     "semester2": [
       {
         "chapter": "Dampak Perubahan Lingkungan",
         "tps": [
           "Peserta didik mampu menjelaskan dampak perubahan lingkungan terhadap kehidupan makhluk hidup melalui studi kasus sederhana",
           "Peserta didik mampu menyebutkan adaptasi minimal 2 makhluk hidup terhadap perubahan lingkungan"
         ]
       },
       {
         "chapter": "Peran Manusia dalam Perubahan Lingkungan",
         "tps": [
           "Peserta didik mampu mengidentifikasi kegiatan manusia yang menyebabkan perubahan lingkungan"
         ]
       }
     ]
   }
   ```

3. **Validation checks:**
   - ✅ Semester 1 ada: 2 chapters × 2-3 TPs = 5 TPs
   - ✅ Semester 2 ada: 2 chapters × 2-1 TPs = 3 TPs
   - ✅ Balance: 5 vs 3 (60% vs 40%) - reasonably balanced
   - ✅ Setiap TP memiliki format ABCD lengkap
   - ✅ KKO sesuai FASE_B (menyebutkan, membedakan, memberikan contoh, menjelaskan, dst)
   - ⚠️ Catatan: Ada imbalance (60:40), tapi masih acceptable

4. **Frontend menerima:**
   ```json
   {
     "success": true,
     "data": { "semester1": [...], "semester2": [...] }
   }
   ```

5. **Frontend rendering:**
   - Default: Tampilkan Semester 1 & 2 side-by-side
   - Jika user pilih "Semester 1": Hanya semester 1 yang tampil
   - Jika user pilih "Semester 2": Hanya semester 2 yang tampil
   - User bisa edit, pindah chapter, atau save ke Firestore

---

## 🎓 Summary

### Apa yang SUDAH BERFUNGSI:
1. ✅ AI di-instruct untuk membuat 2 semester dengan format terstruktur
2. ✅ Response di-parse menjadi struktur `{ semester1, semester2 }`
3. ✅ Setiap TP di-validate untuk ABCD, KKO, dan kompleksitas
4. ✅ Frontend menampilkan kedua semester atau filter sesuai pilihan
5. ✅ User bisa save dari kedua semester ke database

### Apa yang PERLU DIPERBAIKI:
1. ❌ **CRITICAL**: Validasi bahwa semester 1 dan 2 tidak boleh kosong
2. ❌ **HIGH**: Retry logic yang lebih baik jika semester kosong
3. ❌ **MEDIUM**: Telemetry/logging untuk monitoring distribusi semester

### Rekomendasi Implementasi:
**Tambahkan validation check di `lib/gemini.ts` line 724-726** (setelah parseJSONResponse):
```typescript
if (!parsed.semester1?.length || !parsed.semester2?.length) {
  throw new Error('Invalid response structure');
}
```

Dengan ini, jika AI gagal membuat kedua semester, akan di-retry dengan prompt yang lebih ketat.

---

**Terakhir Diupdate:** December 5, 2025  
**Author:** Code Analysis
