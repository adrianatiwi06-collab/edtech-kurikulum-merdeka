# Setup Instruksi untuk EdTech Kurikulum Merdeka

## Langkah-langkah Setup

### 1. Install Node.js
Jika belum terinstall, download dan install Node.js dari:
https://nodejs.org/ (Pilih versi LTS)

Verifikasi instalasi:
```powershell
node --version
npm --version
```

### 2. Setup Firebase Project

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Klik "Add project" dan buat project baru
3. Enable Firebase Authentication:
   - Go to Authentication > Sign-in method
   - Enable "Email/Password"
4. Enable Cloud Firestore:
   - Go to Firestore Database > Create database
   - Pilih "Start in test mode" (akan kita ubah dengan Security Rules)
5. Get Firebase Config:
   - Go to Project Settings > General > Your apps
   - Klik Web icon (</>) untuk add web app
   - Copy configuration object

### 3. Setup Firebase Admin SDK

1. Go to Project Settings > Service accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Extract values untuk environment variables:
   - `project_id`
   - `client_email`
   - `private_key` (ganti \n dengan \\n)

### 4. Get Gemini API Key

1. Buka [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Klik "Create API Key"
3. Copy API key yang dihasilkan

### 5. Install Dependencies

```powershell
cd edtech-kurikulum-merdeka
npm install
```

Jika ada error, coba:
```powershell
npm install --legacy-peer-deps
```

### 6. Setup Environment Variables

1. Copy file `.env.example` ke `.env`
2. Isi semua nilai dengan credentials dari langkah 2-4

### 7. Deploy Firestore Security Rules

Di Firebase Console:
1. Go to Firestore Database > Rules
2. Copy isi file `firestore.rules`
3. Paste dan Publish

### 8. Run Development Server

```powershell
npm run dev
```

Buka browser ke: http://localhost:3000

## Troubleshooting

### Error: Module not found

Solusi:
```powershell
rm -r node_modules
rm package-lock.json
npm install
```

### Error: Firebase not initialized

- Pastikan semua environment variables sudah diisi
- Restart development server

### Error: Gemini API quota exceeded

- Cek quota di Google AI Studio
- Tunggu reset quota (biasanya harian)

### Build Errors

```powershell
npm run build
```

Jika ada TypeScript errors, ignore dulu dengan:
```powershell
npm run build -- --no-lint
```

## Next Steps

1. Daftar akun baru di aplikasi
2. Login
3. Setup Master Data (Kelas & Siswa)
4. Coba fitur Generate TP
5. Buat soal dari TP
6. Lakukan koreksi digital
7. Lihat rekap nilai

## Additional Notes

- Firestore Free Tier: 50,000 reads/day, 20,000 writes/day
- Gemini API Free Tier: Check Google AI Studio for current limits
- Untuk production, upgrade Firestore plan dan enable proper security
