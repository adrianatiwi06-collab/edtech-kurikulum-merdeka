# 🟢 Cara Install Node.js di Windows

## ❌ Error yang Anda Alami

```
The term 'node.exe' is not recognized as the name of a cmdlet, function, script file, or operable program.
```

**Artinya**: Node.js belum terinstall di komputer Anda.

---

## ✅ Solusi: Install Node.js

### Metode 1: Download dari Website Resmi (Recommended)

#### Step 1: Download Node.js

1. Buka browser dan kunjungi: **https://nodejs.org/**
2. Anda akan melihat 2 pilihan:
   - **LTS (Long Term Support)** - Recommended ✅
   - Current (Latest Features)
3. **Klik tombol hijau "Download Node.js (LTS)"**
4. File installer akan terdownload (sekitar 30-50 MB)

#### Step 2: Install Node.js

1. **Double-click** file installer yang sudah didownload
   - Nama file: `node-v20.x.x-x64.msi` atau similar
2. **Setup Wizard** akan terbuka:
   - Klik **Next**
   - Centang "I accept the terms..." → Klik **Next**
   - Destination folder (biarkan default) → Klik **Next**
   - Custom Setup (biarkan default, pastikan "Add to PATH" tercentang) → Klik **Next**
   - Tools for Native Modules (optional, bisa skip) → Klik **Next**
   - Klik **Install**
   - Tunggu proses instalasi (2-3 menit)
   - Klik **Finish**

#### Step 3: Verifikasi Instalasi

1. **Tutup semua terminal PowerShell yang sedang terbuka** ⚠️ (PENTING!)
2. Buka **PowerShell baru**
3. Jalankan command:

```powershell
node --version
```

**Output yang diharapkan**:
```
v20.10.0
```

4. Cek npm juga:

```powershell
npm --version
```

**Output yang diharapkan**:
```
10.2.3
```

✅ **Jika kedua command di atas berhasil, instalasi sukses!**

---

### Metode 2: Install via Winget (Windows 11/10)

Jika Anda punya Windows Package Manager:

```powershell
winget install OpenJS.NodeJS.LTS
```

Tunggu instalasi selesai, lalu tutup dan buka kembali PowerShell.

---

### Metode 3: Install via Chocolatey

Jika Anda sudah punya Chocolatey:

```powershell
choco install nodejs-lts
```

---

## 🔄 Setelah Install Node.js Selesai

### 1. Restart PowerShell

**⚠️ PENTING**: Tutup semua jendela PowerShell dan buka yang baru agar PATH ter-update.

### 2. Navigasi ke Project Folder

```powershell
cd "C:\Users\LENOVO\Documents\TP PLUS\edtech-kurikulum-merdeka"
```

### 3. Install Dependencies

```powershell
npm install
```

**Proses ini akan**:
- Download semua packages (~300MB)
- Memakan waktu 3-5 menit
- Membuat folder `node_modules`

**Output yang diharapkan**:
```
added 500 packages, and audited 501 packages in 2m

150 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

### 4. Setup Environment Variables

```powershell
Copy-Item .env.example .env
```

Kemudian edit file `.env` dan isi dengan kredensial Anda:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK (Service Account)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----\n"

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
```

📖 **Cara dapatkan kredensial**: Lihat [SETUP.md](./SETUP.md)

### 5. Deploy Firestore Rules

Jika belum install Firebase CLI:

```powershell
npm install -g firebase-tools
```

Login ke Firebase:

```powershell
firebase login
```

Deploy security rules:

```powershell
firebase deploy --only firestore:rules
```

### 6. Run Development Server

```powershell
npm run dev
```

**Output yang diharapkan**:
```
▲ Next.js 14.2.10
- Local:        http://localhost:3000
- Network:      http://192.168.1.x:3000

✓ Ready in 2.5s
```

### 7. Buka di Browser

Buka browser dan akses: **http://localhost:3000**

---

## 🐛 Troubleshooting

### Error: "'node' is not recognized" (setelah install)

**Solusi**:
1. Restart PowerShell
2. Jika masih error, restart komputer
3. Cek PATH environment variable:

```powershell
$env:Path -split ';' | Select-String "nodejs"
```

Seharusnya ada output: `C:\Program Files\nodejs\`

### Error: "npm WARN deprecated..."

**Solusi**: Peringatan ini normal, bisa diabaikan. Dependencies tetap terinstall.

### Error: "EACCES permission denied"

**Solusi**: Jalankan PowerShell sebagai Administrator:
1. Klik kanan PowerShell
2. Pilih "Run as Administrator"
3. Jalankan `npm install` lagi

### Error: "Cannot find module..."

**Solusi**: Hapus `node_modules` dan install ulang:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Error: Port 3000 sudah dipakai

**Solusi**: Ganti port:

```powershell
$env:PORT=3001; npm run dev
```

---

## 📊 Versi Yang Direkomendasikan

| Software | Versi Minimum | Versi Recommended |
|----------|---------------|-------------------|
| Node.js | v18.17.0 | v20.10.0+ (LTS) |
| npm | v9.6.7 | v10.2.0+ |
| Windows | Windows 10 | Windows 11 |

---

## 🎯 Quick Checklist

Setelah install Node.js, pastikan semua ini berfungsi:

- [ ] `node --version` menampilkan versi
- [ ] `npm --version` menampilkan versi
- [ ] `npm install` berjalan tanpa error
- [ ] File `.env` sudah dibuat dan diisi
- [ ] `npm run dev` berjalan sukses
- [ ] Browser bisa buka http://localhost:3000

---

## 📚 Next Steps

Setelah Node.js terinstall dan `npm install` sukses:

1. **Setup Firebase & Gemini**: Baca [SETUP.md](./SETUP.md)
2. **Mulai Development**: Baca [QUICKSTART.md](./QUICKSTART.md)
3. **Understand Structure**: Baca [STRUCTURE.md](./STRUCTURE.md)
4. **Test Features**: Baca [TESTING.md](./TESTING.md)

---

## 💡 Tips

1. **Selalu gunakan LTS version** Node.js untuk stabilitas
2. **Restart PowerShell** setelah install Node.js
3. **Backup `.env` file** jangan commit ke Git
4. **Run `npm audit`** secara berkala untuk security updates
5. **Update dependencies**: `npm update` (hati-hati, bisa break)

---

**Need Help?** Baca [DOCS_INDEX.md](./DOCS_INDEX.md) untuk panduan lengkap.

---

*Last Updated: December 2025*
