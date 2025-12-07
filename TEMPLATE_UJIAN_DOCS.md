# Template Ujian Cepat - Dokumentasi

## 📝 Ringkasan Fitur

Template Ujian Cepat adalah fitur untuk mengelola ujian berbasis kertas (PAS/PTS/PAT) dengan cara yang efisien. Fitur ini memungkinkan guru untuk:

1. **Membuat template ujian** dengan metadata dan kunci jawaban (tanpa perlu mengetik soal lengkap)
2. **Memetakan setiap soal ke Tujuan Pembelajaran (TP)** tertentu
3. **Melakukan koreksi digital** dengan cepat menggunakan template
4. **Menganalisis ketercapaian TP** per siswa secara otomatis

## 🎯 Mengapa Fitur Ini Penting?

**Masalah yang Diselesaikan:**
- Ujian PAS/PTS sering berupa kertas (bukan digital), sehingga input soal lengkap tidak praktis
- Guru perlu melacak ketercapaian TP dari hasil ujian, bukan hanya nilai total
- Analisis manual ketercapaian TP per siswa sangat memakan waktu

**Solusi:**
- Template hanya berisi metadata ujian + kunci jawaban + pemetaan TP
- Sistem otomatis menghitung skor per TP berdasarkan jawaban siswa
- Dashboard analisis memberikan insight ketercapaian TP dengan warna dan persentase

## 🚀 Cara Penggunaan

### 1. Membuat Template Ujian

**Langkah:**
1. Buka menu **Template Ujian** di sidebar
2. Ikuti wizard 3 langkah:

#### **Step 1: Informasi Ujian**
- Nama Ujian: Contoh "PAS Matematika Semester 1"
- Jenis Ujian: PAS / PTS / PAT / Ulangan / Kuis
- Kelas: 1-6
- Mata Pelajaran: Matematika, Bahasa Indonesia, dll.
- Semester: 1 atau 2

#### **Step 2: Pilih Tujuan Pembelajaran**
- Sistem akan memuat TP yang sesuai dengan filter (kelas, mapel, semester)
- Centang TP yang akan diuji dalam ujian ini
- Minimal pilih 1 TP

#### **Step 3: Konfigurasi Soal & Pemetaan TP**

**3.1 Konfigurasi Jumlah Soal:**
- **Soal Pilihan Ganda:**
  - Jumlah soal: Contoh 20
  - Bobot per soal: Contoh 1 poin
  
- **Soal Isian:**
  - Jumlah soal: Contoh 5
  - Bobot per soal: Contoh 4 poin

**3.2 Pemetaan TP ke Soal:**

**Cara Manual:**
- Setiap soal harus dipetakan ke salah satu TP yang sudah dipilih
- Pilih TP dari dropdown untuk setiap nomor soal

**Cara Otomatis (Distribusi Merata):**
- Klik tombol "🔄 Distribusi TP Otomatis"
- Sistem akan membagi soal secara merata ke semua TP yang dipilih
- Contoh: 3 TP dan 15 soal → Setiap TP mendapat 5 soal

**3.3 Input Kunci Jawaban (PG):**
- Pilih kunci jawaban (A/B/C/D/E) untuk setiap soal PG
- Kunci jawaban akan digunakan untuk koreksi otomatis

3. Klik **Simpan Template**

### 2. Menggunakan Template untuk Koreksi

**Langkah:**
1. Buka menu **Koreksi Digital**
2. Pilih **Mode Koreksi:**
   - **📝 Template Ujian** (untuk ujian kertas dengan kunci jawaban)
   - **📚 Bank Soal** (untuk ujian digital dengan soal lengkap)

3. Pilih template yang sudah dibuat
4. Pilih kelas yang akan dikoreksi
5. Input nama ujian (opsional, sudah otomatis dari template)
6. Klik **Mulai Koreksi**

**Proses Koreksi:**
- **Soal PG:** Input jawaban siswa (A/B/C/D/E), sistem otomatis membandingkan dengan kunci jawaban
- **Soal Isian:** Input skor manual untuk setiap siswa
- Klik **Hitung Semua Nilai** untuk kalkulasi otomatis
- Klik **Simpan** secara berkala untuk menyimpan progress

### 3. Analisis Ketercapaian TP

**Langkah:**
1. Buka menu **Analisis TP**
2. Pilih **Template Ujian** yang sudah digunakan untuk koreksi
3. Pilih **Kelas** yang ingin dianalisis
4. Klik **Analisis**

**Hasil yang Ditampilkan:**

**Per Siswa:**
- Nama siswa dan nilai total
- Breakdown ketercapaian per TP:
  - Nama TP
  - Soal nomor berapa saja yang mengukur TP ini
  - Skor yang diperoleh / maksimal
  - Persentase ketercapaian
  - Level ketercapaian (dengan warna):
    - 🟢 **Sangat Berkembang** (≥ 85%)
    - 🔵 **Berkembang Sesuai Harapan** (70-84%)
    - 🟡 **Mulai Berkembang** (50-69%)
    - 🔴 **Belum Berkembang** (< 50%)

**Export:**
- Klik **Export CSV** untuk mendapatkan file Excel
- File berisi analisis lengkap per siswa dan per TP
- Format UTF-8 BOM (kompatibel dengan Excel Indonesia)

## 🗂️ Struktur Data

### ExamTemplate Interface

```typescript
interface ExamTemplate {
  id: string;
  user_id: string;
  
  // Metadata Ujian
  exam_name: string;
  exam_type: 'PAS' | 'PTS' | 'PAT' | 'Ulangan' | 'Kuis';
  grade: string;
  subject: string;
  semester: 1 | 2;
  
  // TP yang Dipilih
  tp_ids: string[];
  tp_details: Array<{
    tp_id: string;
    chapter: string;
    tp_text: string;
    question_numbers: number[];  // Soal nomor berapa yang mengukur TP ini
  }>;
  
  // Konfigurasi Soal PG
  multiple_choice: {
    count: number;
    weight: number;
    answer_keys: string[];  // ['A', 'B', 'C', 'D', 'A', ...]
    tp_mapping: { [questionNumber: number]: string };  // {1: "tp_id_1", 2: "tp_id_2"}
  };
  
  // Konfigurasi Soal Isian
  essay: {
    count: number;
    weight: number;
    tp_mapping: { [questionNumber: number]: string };
  };
  
  total_questions: number;
  max_score: number;
  created_at: string;
  updated_at: string;
}
```

### TPAchievementAnalysis Interface

```typescript
interface TPAchievementAnalysis {
  id: string;
  user_id: string;
  exam_template_id: string;
  exam_name: string;
  class_id: string;
  class_name: string;
  student_id: string;
  student_name: string;
  
  // Analisis Per TP
  tp_analysis: Array<{
    tp_id: string;
    tp_text: string;
    chapter: string;
    
    // Detail Soal untuk TP ini
    questions: Array<{
      number: number;
      type: 'PG' | 'Isian';
      max_score: number;
      student_score: number;
      is_correct?: boolean;  // Hanya untuk PG
    }>;
    
    total_score: number;
    max_possible_score: number;
    percentage: number;  // 0-100
    achievement_level: 'Belum Berkembang' | 'Mulai Berkembang' | 
                       'Berkembang Sesuai Harapan' | 'Sangat Berkembang';
  }>;
  
  overall_score: number;
  overall_percentage: number;
  created_at: string;
}
```

## 📊 Contoh Kasus Penggunaan

**Skenario:**
Ibu Ani ingin menganalisis hasil PAS Matematika Kelas 4 Semester 1.

**Langkah Ibu Ani:**

1. **Buat Template (5 menit):**
   - Nama: "PAS Matematika Semester 1 Kelas 4"
   - Jenis: PAS
   - Kelas: 4, Mapel: Matematika, Semester: 1
   - Pilih 5 TP yang relevan (Bilangan Bulat, Pecahan, Geometri, dll.)
   - Konfigurasi: 20 soal PG (1 poin) + 5 soal Isian (4 poin)
   - Klik "Distribusi TP Otomatis" untuk mapping otomatis
   - Input kunci jawaban PG: A, B, C, D, A, ...
   - Simpan

2. **Koreksi Digital (15 menit untuk 30 siswa):**
   - Pilih Template "PAS Matematika..."
   - Pilih Kelas "4A"
   - Input jawaban PG siswa (cepat karena tinggal ketik A/B/C/D/E)
   - Input skor Isian siswa
   - Klik "Hitung Semua Nilai"
   - Simpan

3. **Analisis TP (1 menit):**
   - Pilih template dan kelas
   - Klik "Analisis"
   - Lihat hasil:
     - Andi: TP Bilangan Bulat 90% (Sangat Berkembang), TP Pecahan 60% (Mulai Berkembang)
     - Budi: TP Bilangan Bulat 45% (Belum Berkembang), TP Pecahan 85% (Sangat Berkembang)
   - Export ke Excel untuk laporan

**Insight yang Didapat:**
- TP mana yang sudah dikuasai kelas
- TP mana yang perlu remedial
- Siswa mana yang perlu perhatian khusus pada TP tertentu
- Data kuantitatif untuk rapor berbasis TP

## 🔒 Keamanan

**Firestore Rules:**
```
match /exam_templates/{templateId} {
  allow read: if isAuthenticated() && resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && request.resource.data.user_id == request.auth.uid;
  allow update, delete: if isAuthenticated() && resource.data.user_id == request.auth.uid;
}
```

- Setiap user hanya bisa akses template miliknya sendiri
- Template tidak bisa diakses oleh user lain
- Update dan delete hanya bisa dilakukan oleh owner

## 🎨 UI/UX Highlights

### Template Ujian Page
- **3-step wizard** dengan progress indicator
- **Auto-distribute TP** untuk mapping cepat
- **Grid view** untuk input kunci jawaban PG (5 kolom, mudah di-scan)
- **Validation** lengkap sebelum save (semua soal harus mapped, semua kunci jawaban harus diisi)

### Koreksi Digital Page
- **Mode selection** di awal (Template vs Bank Soal)
- **Template card** dengan info ringkas (PG count, Isian count, TP count, max score)
- **Auto-calculation** untuk soal PG berdasarkan kunci jawaban

### Analisis TP Page
- **Color-coded badges** untuk achievement level
- **Progress bar** visual untuk persentase ketercapaian
- **Collapsible cards** per siswa untuk navigasi mudah
- **CSV export** dengan UTF-8 BOM (Excel-ready)
- **Legend** untuk kriteria ketercapaian

## 🚧 Fitur Future (Belum Diimplementasi)

### 1. Import Template dari Excel
**Tujuan:** Batch input kunci jawaban dan mapping TP dari file Excel

**Format Template:**
```
Kolom A: Nomor Soal
Kolom B: Jenis (PG/Isian)
Kolom C: Kunci Jawaban (untuk PG)
Kolom D: TP ID
```

**Manfaat:**
- Input lebih cepat untuk ujian dengan banyak soal (50+ soal)
- Bisa disiapkan offline
- Mudah untuk kolaborasi dengan tim guru

### 2. Template Library (Sharing antar Guru)
**Tujuan:** Berbagi template ujian dengan guru lain di sekolah yang sama

**Fitur:**
- Publish template ke library sekolah
- Copy template orang lain ke akun sendiri
- Rating dan review template

### 3. Analisis Agregat per Kelas
**Tujuan:** Melihat ketercapaian TP secara klasikal (bukan per siswa)

**Tampilan:**
- Grafik batang: Persentase siswa yang mencapai setiap level per TP
- Rekomendasi: TP mana yang perlu remedi kelas

## 🐛 Troubleshooting

### Template tidak muncul di Koreksi Digital
**Penyebab:** User belum membuat template atau filter salah

**Solusi:** 
1. Pastikan sudah membuat template di menu "Template Ujian"
2. Pilih mode "Template Ujian" (bukan "Bank Soal")

### Analisis TP tidak muncul
**Penyebab:** Belum ada data koreksi menggunakan template tersebut

**Solusi:**
1. Pastikan sudah melakukan koreksi menggunakan template
2. Pastikan sudah klik "Hitung Semua Nilai" dan "Simpan" di halaman Koreksi

### Kunci jawaban salah/hilang
**Penyebab:** User belum input kunci jawaban saat membuat template

**Solusi:**
1. Buat template baru dengan kunci jawaban yang benar
2. Atau edit template (fitur edit akan ditambahkan di versi mendatang)

## 📚 Technical Notes

### Perhitungan TP Achievement

```typescript
// Untuk setiap TP, hitung skor dari soal-soal yang mengukur TP tersebut
tp_details.forEach((tpDetail) => {
  let totalScore = 0;
  let maxPossibleScore = 0;
  
  tpDetail.question_numbers.forEach((qNum) => {
    if (qNum <= pgCount) {
      // Soal PG
      const isCorrect = (studentAnswer === correctAnswer);
      totalScore += isCorrect ? pgWeight : 0;
      maxPossibleScore += pgWeight;
    } else {
      // Soal Isian
      totalScore += essayScore;
      maxPossibleScore += essayWeight;
    }
  });
  
  const percentage = (totalScore / maxPossibleScore) * 100;
  
  // Determine achievement level
  if (percentage >= 85) level = "Sangat Berkembang";
  else if (percentage >= 70) level = "Berkembang Sesuai Harapan";
  else if (percentage >= 50) level = "Mulai Berkembang";
  else level = "Belum Berkembang";
});
```

### Auto-distribute TP Algorithm

```typescript
// Membagi soal secara merata ke semua TP
const tpArray = Array.from(selectedTPs);
const totalQuestions = pgCount + essayCount;

for (let i = 1; i <= totalQuestions; i++) {
  const tpIndex = (i - 1) % tpArray.length;  // Round-robin
  const tpId = tpArray[tpIndex];
  
  if (i <= pgCount) {
    pgTPMapping[i] = tpId;
  } else {
    essayTPMapping[i - pgCount] = tpId;
  }
}
```

## 📝 Changelog

### Version 1.0.0 (2024)
- ✅ Initial release
- ✅ Template creation wizard (3 steps)
- ✅ TP mapping with auto-distribute
- ✅ Template-based grading in Koreksi Digital
- ✅ TP Achievement Analysis dashboard
- ✅ CSV export for analysis results
- ✅ Color-coded achievement levels
- ✅ Firestore security rules

---

**Dibuat:** 2024  
**Terakhir Diupdate:** 2024  
**Maintainer:** EdTech Kurikulum Merdeka Team
