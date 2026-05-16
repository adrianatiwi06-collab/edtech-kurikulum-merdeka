# Update: Toggle 100 Karakter & Export XLSX untuk TP

**Tanggal:** 2 Desember 2025

## 🎯 Fitur Baru

### 1. **Strategi Pemotongan Bertahap untuk Toggle 100 Karakter**

Ketika toggle 100 karakter diaktifkan, sistem akan memotong TP dengan prioritas:

#### **TAHAP 1: Hilangkan Audience (A)**
```
SEBELUM: "Peserta didik mampu menghitung luas bangun datar dengan benar"
SESUDAH: "Dapat menghitung luas bangun datar dengan benar"
HEMAT: ~20 karakter
```

#### **TAHAP 2: Hilangkan Condition (C)**
```
SEBELUM: "Dapat menghitung luas bangun datar setelah diberikan soal bergambar dengan benar"
SESUDAH: "Dapat menghitung luas bangun datar dengan benar"
HEMAT: ~20-40 karakter (detail metode)
```

#### **TAHAP 3: Ringkas Degree (D)**
```
SEBELUM: "dengan ketelitian minimal 80% akurat"
SESUDAH: "dengan akurat"
HEMAT: ~10-20 karakter
```

#### **TAHAP 4: Ringkas Behavior (B)** - Jika masih >100 karakter

##### A. Gunakan Akronim/Singkatan
```
"sistem tata surya" → "sistem tatasurya"
"ilmu pengetahuan alam" → "IPA"
```

##### B. Fokus Satu Keterampilan
```
"mengidentifikasi dan menjelaskan" → "menjelaskan" (pilih yang utama)
```

##### C. Kosakata Lebih Padat
```
"memahami cara kerja dari" → "memahami prinsip kerja"
"berbagai macam jenis" → "jenis"
```

##### D. Ringkas Objek
```
"proses terjadinya fotosintesis pada tumbuhan hijau" → "proses fotosintesis"
"komponen-komponen utama sistem pencernaan" → "komponen sistem pencernaan"
```

##### E. Hindari Kata Mubazir
```
"dapat melakukan identifikasi terhadap" → "mengidentifikasi"
"mampu untuk menjelaskan tentang" → "menjelaskan"
```

### 2. **Field Baru: `isRaporFormat`**

Setiap TP yang disimpan sekarang memiliki flag `isRaporFormat`:
- `true`: TP dibuat dengan toggle 100 karakter (Format Rapor)
- `false` atau `undefined`: TP format lengkap ABCD

**Schema Update:**
```typescript
interface LearningGoal {
  id: string;
  user_id: string;
  chapter: string;
  tp: string;
  semester: number;
  grade: string;
  cpReference: string;
  created_at: string;
  subject?: string;
  isRaporFormat?: boolean; // NEW FIELD
}
```

### 3. **Pemisahan Data TP**

#### **Halaman My TP Sekarang Menampilkan:**
- 📋 Badge **"Format Rapor (100 char)"** (hijau) untuk TP dengan `isRaporFormat: true`
- 📚 Badge **"Format Lengkap ABCD"** (ungu) untuk TP tanpa flag atau `isRaporFormat: false`
- Badge jumlah karakter untuk setiap TP

**Tampilan:**
```
┌─────────────────────────────────────────────────────────┐
│ Dapat membandingkan dua bilangan dengan benar           │
│ [Matematika] [📋 Format Rapor] [52 karakter]           │
│ Dibuat: 2 Desember 2025                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Peserta didik mampu membandingkan dua bilangan 1-20... │
│ [Matematika] [📚 Format Lengkap ABCD] [93 karakter]   │
│ Dibuat: 1 Desember 2025                                 │
└─────────────────────────────────────────────────────────┘
```

### 4. **Fungsi Export XLSX (CSV)**

#### **Tombol Baru di My TP:**
```
[📊 Export Excel] [🗑️ Hapus Semua]
```

#### **Format Export:**
| No | Bab/Elemen | Tujuan Pembelajaran | Semester | Kelas | Mata Pelajaran | Format | Panjang | Tanggal Dibuat |
|----|------------|---------------------|----------|-------|----------------|--------|---------|----------------|
| 1 | Bilangan | Dapat membandingkan... | 1 | 2 | Matematika | Format Rapor (100 char) | 52 karakter | 2/12/2025 |
| 2 | Geometri | Peserta didik mampu... | 1 | 2 | Matematika | Format Lengkap ABCD | 120 karakter | 1/12/2025 |

#### **Fitur Export:**
- ✅ Support UTF-8 dengan BOM (Excel bisa baca bahasa Indonesia)
- ✅ Format CSV compatible dengan Excel
- ✅ Escape karakter spesial (koma, quotes, newline)
- ✅ Nama file: `TP_Tersimpan_Kelas2_2025-12-02.csv`
- ✅ Filter tetap berlaku (hanya export yang ditampilkan)

## 📊 Contoh Pemotongan Lengkap

### Contoh 1: Kelas 2 SD (Fase A)
```
AWAL (150 char):
"Peserta didik mampu mengidentifikasi dan menjelaskan tahap-tahap siklus air 
dalam kehidupan sehari-hari setelah mengamati video dengan ketelitian minimal 80%"

TAHAP 1 - Hilangkan "Peserta didik" (130 char):
"Dapat mengidentifikasi dan menjelaskan tahap-tahap siklus air dalam kehidupan 
sehari-hari setelah mengamati video dengan ketelitian minimal 80%"

TAHAP 2 - Hilangkan Condition (90 char):
"Dapat mengidentifikasi dan menjelaskan tahap-tahap siklus air dengan 
ketelitian minimal 80%"

TAHAP 3 - Ringkas Degree (67 char):
"Dapat mengidentifikasi dan menjelaskan tahap siklus air dengan akurat"

TAHAP 4 - Ringkas Behavior (42 char):
"Dapat menjelaskan tahap siklus air dengan tepat" ✅
```

### Contoh 2: Kelas 5 SD (Fase C)
```
AWAL (139 char):
"Peserta didik mampu menganalisis hubungan sebab-akibat antara gaya dan gerak 
benda berdasarkan percobaan sederhana dengan tingkat akurasi minimal 85%"

TAHAP 1 (119 char):
"Dapat menganalisis hubungan sebab-akibat antara gaya dan gerak benda 
berdasarkan percobaan sederhana dengan tingkat akurasi minimal 85%"

TAHAP 2 (82 char):
"Dapat menganalisis hubungan sebab-akibat antara gaya dan gerak benda 
dengan tingkat akurasi minimal 85%"

TAHAP 3 (61 char):
"Dapat menganalisis hubungan gaya dan gerak benda dengan tepat" ✅
```

## 🔧 Implementasi Teknis

### File yang Dimodifikasi:

1. **`lib/gemini.ts`**
   - Update prompt dengan strategi pemotongan 4 tahap
   - Tambah validasi untuk format rapor vs lengkap

2. **`types/index.ts`**
   - Tambah field `isRaporFormat?: boolean` di interface `LearningGoal`

3. **`app/dashboard/generate-tp/page.tsx`**
   - Pass `isRaporFormat: maxLength100` saat save ke Firestore

4. **`app/dashboard/my-tp/page.tsx`**
   - Tambah fungsi `exportToExcel()` untuk export CSV
   - Tambah badge format (Rapor vs Lengkap ABCD)
   - Tambah badge jumlah karakter
   - Tambah tombol "Export Excel"

## 📚 Panduan Penggunaan

### Untuk Format Rapor (Toggle ON):
1. Aktifkan toggle "Batasi 100 karakter"
2. Generate TP
3. Sistem otomatis memotong sesuai prioritas
4. Save → TP tersimpan dengan badge 📋 "Format Rapor"

### Untuk Format Lengkap (Toggle OFF):
1. Jangan aktifkan toggle
2. Generate TP
3. Sistem membuat TP lengkap ABCD
4. Save → TP tersimpan dengan badge 📚 "Format Lengkap ABCD"

### Untuk Export Excel:
1. Buka "TP Tersimpan"
2. Filter sesuai kebutuhan (kelas, semester, mapel)
3. Klik "Export Excel"
4. File CSV ter-download, buka dengan Excel

## 🎯 Keuntungan Update

| Aspek | Keuntungan |
|-------|------------|
| **Pemisahan Data** | TP rapor dan TP lengkap tidak tercampur |
| **Visual Clarity** | Badge warna memudahkan identifikasi |
| **Export Flexibility** | Guru bisa export untuk administrasi |
| **Smart Cutting** | Pemotongan cerdas mempertahankan inti kompetensi |
| **Excel Compatible** | CSV dengan BOM UTF-8 langsung bisa dibuka Excel |

## ✅ Testing Checklist

- [ ] Generate TP dengan toggle OFF → cek badge "Format Lengkap ABCD"
- [ ] Generate TP dengan toggle ON → cek badge "Format Rapor"
- [ ] TP toggle ON tidak melebihi 100 karakter
- [ ] Export Excel → cek kolom "Format" menampilkan benar
- [ ] Excel bisa baca bahasa Indonesia (UTF-8 BOM)
- [ ] Filter work pada halaman My TP
- [ ] Badge jumlah karakter akurat

---

**Status:** ✅ Implemented
**Author:** AI Assistant  
**Date:** 2 Desember 2025
