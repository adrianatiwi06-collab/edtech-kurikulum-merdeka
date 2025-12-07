# Quick Start Guide - EdTech Kurikulum Merdeka

## ⚡ Instalasi Cepat

### Windows PowerShell

```powershell
# 1. Masuk ke folder project
cd "c:\Users\LENOVO\Documents\TP PLUS\edtech-kurikulum-merdeka"

# 2. Install dependencies
npm install

# 3. Setup environment file
# Copy .env.example ke .env dan isi dengan credentials Anda
Copy-Item .env.example .env
# Edit file .env dengan text editor

# 4. Jalankan development server
npm run dev
```

## 🔑 Environment Variables yang Diperlukan

Edit file `.env` dan isi dengan nilai berikut:

```env
# Firebase Client (dari Firebase Console > Project Settings)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Firebase Admin (dari Firebase Console > Service Accounts)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\n-----END PRIVATE KEY-----\n"

# Gemini API (dari Google AI Studio)
GEMINI_API_KEY=AIzaSy...
```

## 🎯 Cara Mendapatkan Credentials

### 1. Firebase Configuration

1. Buka https://console.firebase.google.com/
2. Pilih/buat project
3. Klik ⚙️ (Settings) > Project settings
4. Scroll ke "Your apps" > pilih Web app
5. Copy configuration object

### 2. Firebase Admin SDK

1. Firebase Console > ⚙️ > Service accounts
2. Click "Generate new private key"
3. Download JSON file
4. Extract `project_id`, `client_email`, dan `private_key`

⚠️ **PENTING**: Untuk `private_key`, pastikan:
- Tetap ada tanda kutip
- `\n` diganti dengan `\\n` di dalam string

### 3. Gemini API Key

1. Buka https://makersuite.google.com/app/apikey
2. Login dengan Google Account
3. Click "Create API Key"
4. Copy key yang dihasilkan

## 🔐 Setup Firestore Security Rules

1. Firebase Console > Firestore Database > Rules
2. Copy isi file `firestore.rules` dari project
3. Paste ke editor dan click "Publish"

## 🚀 Jalankan Aplikasi

```powershell
npm run dev
```

Buka browser: **http://localhost:3000**

## ✅ Checklist Setup

- [ ] Node.js terinstall (v18+)
- [ ] Firebase project sudah dibuat
- [ ] Firestore Database enabled
- [ ] Authentication Email/Password enabled
- [ ] Environment variables sudah diisi
- [ ] Firestore Rules sudah di-deploy
- [ ] Dependencies sudah terinstall
- [ ] Development server running

## 🎓 First Steps Setelah Setup

1. **Buka aplikasi** di http://localhost:3000
2. **Daftar akun baru** dengan email & password
3. **Login** ke dashboard
4. **Master Data**: Buat kelas pertama (misal: "7A")
5. **Master Data**: Tambahkan siswa ke kelas
6. **Generate TP**: Upload materi atau input teks, generate TP
7. **Buat Soal**: Pilih TP, generate soal, download Word
8. **Koreksi**: Input jawaban siswa, simpan nilai
9. **Rekap Nilai**: Lihat statistik dan export CSV

## 🆘 Troubleshooting Umum

### Error: "Cannot find module"
```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Error: "Firebase not initialized"
- Pastikan file `.env` ada dan terisi
- Restart development server (Ctrl+C lalu `npm run dev`)

### Error: "Gemini API error"
- Cek API key sudah benar
- Cek quota di Google AI Studio
- Pastikan tidak ada typo di environment variable

### Port 3000 sudah dipakai
```powershell
npm run dev -- -p 3001
```

## 📚 Dokumentasi Lengkap

- **README.md** - Overview fitur dan tech stack
- **SETUP.md** - Detailed setup instructions
- **firestore.rules** - Database security rules

## 🔗 Links Berguna

- [Firebase Console](https://console.firebase.google.com/)
- [Google AI Studio](https://makersuite.google.com/)
- [Next.js Docs](https://nextjs.org/docs)
- [Firestore Docs](https://firebase.google.com/docs/firestore)
- [Gemini API Docs](https://ai.google.dev/docs)

## 💡 Tips

1. **Development**: Gunakan mode test Firestore dulu, lalu terapkan rules
2. **Production**: Pastikan deploy dengan Firestore rules yang ketat
3. **Backup**: Export data Firestore secara berkala
4. **Monitoring**: Pantau usage Firestore dan Gemini API
5. **Security**: Jangan commit file `.env` ke git

## 📞 Support

Jika ada masalah atau pertanyaan:
1. Cek console browser (F12) untuk error messages
2. Cek terminal untuk server errors
3. Review dokumentasi di README.md dan SETUP.md
4. Check Firebase Console untuk database/auth issues

---

**Happy Coding! 🎉**
