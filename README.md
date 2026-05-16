# EdTech Kurikulum Merdeka

Aplikasi web manajemen pengajaran berbasis AI dengan 5 fitur utama: Master Data, Generate TP, Generate Soal, Koreksi Digital, dan Rekap Nilai.

## Tech Stack

- **Framework**: Next.js 14+ (App Router) dengan TypeScript
- **Database**: Firebase Firestore + Firebase Authentication
- **AI Engine**: Google Gemini API (1.5 Flash/Pro)
- **Styling**: Tailwind CSS + Shadcn/UI
- **Export**: docx.js, pdf-parse

## Fitur Utama

### 1. Master Data 🧑‍🏫
- CRUD Kelas (misal: "7A", "8B")
- CRUD Data Siswa di dalam Kelas
- Data terisolasi per user (guru)

### 2. Generate TP (Tujuan Pembelajaran) 📝
- Upload PDF atau input teks materi
- Generate TP otomatis menggunakan Gemini AI dengan panduan ABCD (Audience, Behavior, Condition, Degree)
- Review & Edit sebelum disimpan
- Pengelompokan Semester 1 & 2
- Toggle format Rapor (100 karakter) atau Lengkap
- **Fokus SD**: Fase A (Kelas 1-2), Fase B (Kelas 3-4), Fase C (Kelas 5-6)
- Validasi KKO sesuai Taksonomi Bloom dan usia siswa

### 3. Buat Soal ❓
- Generate soal dari TP yang dipilih
- Konfigurasi jumlah & bobot soal PG dan Essay
- Export ke Word (.docx)
- Opsi menyertakan teks TP

### 4. Template Ujian Cepat 📝 **[NEW]**
- Buat template untuk ujian kertas (PAS/PTS/PAT) tanpa perlu input soal lengkap
- Wizard 3 langkah: Info Ujian → Pilih TP → Konfigurasi Soal & Pemetaan TP
- Input kunci jawaban PG untuk koreksi otomatis
- Pemetaan soal ke TP dengan fitur distribusi otomatis
- Cocok untuk ujian paper-based yang tidak perlu digitalisasi lengkap
- **📖 [Dokumentasi Lengkap](TEMPLATE_UJIAN_DOCS.md)**

### 5. Koreksi Digital ✅
- **Mode ganda**: Template Ujian (cepat, dengan kunci jawaban) atau Bank Soal (lengkap)
- Auto-load siswa dari Master Data
- Input jawaban PG dengan auto-tab
- Validasi ketat (PG: A-E, Essay: max bobot)
- Real-time scoring
- Grade finalization (locking)
- Pewarnaan cell (hijau/merah untuk PG)
- Support template-based grading untuk analisis TP

### 6. Analisis Ketercapaian TP 📊 **[NEW]**
- Analisis pencapaian Tujuan Pembelajaran per siswa
- Berdasarkan hasil koreksi dari Template Ujian
- 4 level ketercapaian:
  - 🟢 Sangat Berkembang (≥85%)
  - 🔵 Berkembang Sesuai Harapan (70-84%)
  - 🟡 Mulai Berkembang (50-69%)
  - 🔴 Belum Berkembang (<50%)
- Visualisasi progress bar per TP
- Export hasil analisis ke CSV/Excel
- **📖 [Dokumentasi Lengkap](TEMPLATE_UJIAN_DOCS.md)**

### 7. Rekap Nilai 📈
- Filter berdasarkan Mapel & Kelas
- Statistik (rata-rata, max, min)
- Pagination & Sorting
- Export ke CSV

## Setup & Installation

### Prerequisites

- Node.js 18+ dan npm/yarn
- Firebase Project dengan Firestore enabled
- Google Gemini API Key

### Installation Steps

1. **Clone atau extract project**

2. **Install dependencies**
```powershell
cd edtech-kurikulum-merdeka
npm install
```

3. **Setup Environment Variables**

Copy `.env.example` ke `.env` dan isi dengan kredensial Anda:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK (Server-side only)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_client_email
FIREBASE_ADMIN_PRIVATE_KEY=your_private_key

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key
```

4. **Setup Firestore Security Rules**

Di Firebase Console, deploy firestore rules dari file `firestore.rules`

5. **Run Development Server**

```powershell
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

## Project Structure

```
edtech-kurikulum-merdeka/
├── app/
│   ├── dashboard/
│   │   ├── master-data/          # CRUD Kelas & Siswa
│   │   ├── generate-tp/          # Generate Tujuan Pembelajaran
│   │   ├── generate-soal/        # Generate Soal dari TP
│   │   ├── koreksi/              # Koreksi Digital
│   │   └── rekap-nilai/          # Rekap Nilai
│   ├── login/                    # Authentication
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── ui/                       # Shadcn/UI components
├── contexts/
│   └── AuthContext.tsx           # Firebase Auth Context
├── lib/
│   ├── firebase.ts               # Firebase Client SDK
│   ├── firebase-admin.ts         # Firebase Admin SDK
│   ├── gemini.ts                 # Gemini AI Integration
│   ├── docx-utils.ts             # Word Document Generation
│   ├── pdf-utils.ts              # PDF Parsing
│   └── utils.ts                  # Helper Functions
└── firestore.rules               # Firestore Security Rules
```

## Security Features

- **Data Isolation**: Semua data terikat pada `user_id` (UID dari Auth)
- **Firestore Security Rules**: Enforce user ownership di level database
- **Server Actions**: API Key Gemini dilindungi di server-side
- **Grade Locking**: Finalized grades tidak bisa diedit

## AI Features

### Gemini Integration
- **Retry Logic**: 3x retry jika parsing JSON gagal
- **Chunking**: Otomatis memecah teks panjang untuk efisiensi
- **Structured Output**: JSON response yang tervalidasi
- **Error Handling**: Robust error handling dengan fallback

## Firebase Collections Structure

### `classes`
```typescript
{
  user_id: string,
  name: string,        // e.g., "7A"
  grade: string,       // e.g., "7"
  created_at: string
}
```

### `classes/{classId}/students` (subcollection)
```typescript
{
  name: string,
  nisn: string,
  created_at: string
}
```

### `learning_goals`
```typescript
{
  user_id: string,
  chapter: string,
  tp: string,
  semester: number,    // 1 or 2
  grade: string,
  cpReference: string,
  created_at: string
}
```

### `question_banks`
```typescript
{
  user_id: string,
  subject: string,
  examTitle: string,
  duration: number,
  tp_ids: string[],    // Array of learning_goals IDs
  questions: {
    multipleChoice: Array<...>,
    essay: Array<...>
  },
  created_at: string
}
```

### `grades`
```typescript
{
  user_id: string,
  subject: string,
  exam_title: string,
  exam_name: string,
  class_id: string,
  class_name: string,
  question_bank_id: string,
  grades: Array<{
    studentId: string,
    studentName: string,
    mcAnswers: string[],
    essayScores: number[],
    totalScore: number
  }>,
  is_finalized: boolean,
  created_at: string,
  updated_at: string
}
```

## Usage Guide

### 1. First Time Setup
1. Daftar akun baru di halaman login
2. Masuk ke Dashboard
3. Buat Master Data (Kelas & Siswa)

### 2. Generate Tujuan Pembelajaran
1. Pilih "Generate TP" di sidebar
2. Input teks atau upload PDF
3. Masukkan kelas dan referensi CP
4. Review & edit hasil generate
5. Simpan TP yang dicentang

### 3. Buat Soal
1. Pilih "Buat Soal" di sidebar
2. Pilih TP yang ingin digunakan
3. Konfigurasi jumlah & bobot soal
4. Generate soal
5. Download Word document

### 4. Koreksi Digital
1. Pilih "Koreksi Digital" di sidebar
2. Pilih mata pelajaran & bank soal
3. Pilih kelas
4. Input nama ulangan
5. Mulai koreksi (input jawaban siswa)
6. Simpan dan finalisasi

### 5. Rekap Nilai
1. Pilih "Rekap Nilai" di sidebar
2. Filter berdasarkan mapel/kelas
3. Lihat statistik dan detail nilai
4. Export ke CSV jika diperlukan

## Development Notes

### Adding New Dependencies
```powershell
npm install package-name
```

### Building for Production
```powershell
npm run build
npm start
```

### Linting
```powershell
npm run lint
```

## Troubleshooting

### Firebase Connection Issues
- Pastikan semua environment variables sudah diisi dengan benar
- Cek Firebase Console untuk memastikan Firestore & Auth sudah enabled

### Gemini API Errors
- Pastikan API Key valid
- Cek quota Gemini API di Google AI Studio
- Periksa format response JSON dari Gemini

### Build Errors
- Hapus folder `.next` dan `node_modules`, lalu install ulang
- Pastikan TypeScript tidak ada error

## License

This project is for educational purposes.

## Support

Untuk pertanyaan atau bantuan, silakan buat issue di repository ini.
