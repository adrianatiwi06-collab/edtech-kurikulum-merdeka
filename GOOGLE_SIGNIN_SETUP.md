# Setup Google Sign-In untuk EdTech Kurikulum Merdeka

## 📋 Langkah-Langkah Setup

### 1. Aktifkan Google Sign-In di Firebase Console

1. **Buka Firebase Console**
   - Kunjungi: https://console.firebase.google.com/
   - Pilih project: **edtech-kurikulum-merdeka**

2. **Masuk ke Authentication**
   - Klik menu **Authentication** di sidebar kiri
   - Klik tab **Sign-in method**

3. **Aktifkan Google Provider**
   - Cari **Google** di daftar providers
   - Klik **Google**
   - Toggle **Enable** menjadi aktif
   - Masukkan **Project support email** (email Anda)
   - Klik **Save**

### 2. (Opsional) Konfigurasi OAuth Consent Screen

Jika diminta untuk mengkonfigurasi OAuth consent screen:

1. Klik link yang diberikan atau buka: https://console.cloud.google.com/apis/credentials/consent
2. Pilih **External** (untuk testing) atau **Internal** (untuk organisasi)
3. Klik **Create**
4. Isi informasi:
   - **App name**: EdTech Kurikulum Merdeka
   - **User support email**: Email Anda
   - **Developer contact**: Email Anda
5. Klik **Save and Continue**
6. Skip **Scopes** (klik Continue)
7. Skip **Test users** (klik Continue)
8. Review dan klik **Back to Dashboard**

### 3. Verifikasi Setup

1. Jalankan aplikasi:
   ```powershell
   npm run dev
   ```

2. Buka browser: http://localhost:3000

3. Klik tombol **"Login dengan Google"**

4. Popup Google Sign-In akan muncul

5. Pilih akun Google Anda

6. Anda akan otomatis masuk ke dashboard

## ✅ Fitur Google Sign-In yang Ditambahkan

### AuthContext (contexts/AuthContext.tsx)
- Fungsi `signInWithGoogle()` menggunakan `GoogleAuthProvider`
- Otomatis membuat profil user di Firestore jika belum ada
- Mengambil `displayName` dan `email` dari Google Account

### Login Page (app/login/page.tsx)
- Tombol **"Login dengan Google"** dengan logo Google resmi
- Divider "Atau" untuk memisahkan login email dan Google
- Loading state terpisah untuk Google login
- Error handling untuk Google login

## 🎨 Tampilan UI

```
┌─────────────────────────────────┐
│   EdTech Kurikulum Merdeka     │
│   Login ke akun Anda            │
├─────────────────────────────────┤
│ Email: [________________]       │
│ Password: [________________]    │
│                                  │
│ [        Login        ]         │
│                                  │
│ ────────── Atau ──────────      │
│                                  │
│ [🔵 Login dengan Google]       │
│                                  │
│ Belum punya akun? Daftar        │
└─────────────────────────────────┘
```

## 🔐 Keamanan

Google Sign-In menggunakan:
- **OAuth 2.0** untuk autentikasi
- **Popup window** untuk login (tidak redirect)
- **Firebase Authentication** untuk manajemen session
- **Firestore Security Rules** untuk proteksi data

## 🐛 Troubleshooting

### Error: "Popup blocked by browser"
**Solusi**: 
- Allow popup untuk localhost di browser settings
- Atau gunakan `signInWithRedirect()` sebagai alternatif

### Error: "Firebase: Error (auth/popup-closed-by-user)"
**Solusi**: 
- User menutup popup sebelum selesai login
- Ini normal, tidak perlu action khusus

### Error: "Firebase: Error (auth/unauthorized-domain)"
**Solusi**:
1. Firebase Console → Authentication → Settings
2. Tab **Authorized domains**
3. Tambahkan domain yang Anda gunakan (misal: localhost, your-app.vercel.app)

### Error: "Firebase: Error (auth/operation-not-allowed)"
**Solusi**:
- Google provider belum diaktifkan di Firebase Console
- Ikuti langkah 1 di atas

## 📱 Login Flow

### Skenario 1: User Baru
1. User klik "Login dengan Google"
2. Popup Google Sign-In muncul
3. User pilih akun Google
4. Firebase membuat user di Authentication
5. Aplikasi membuat profil di Firestore collection `users`
6. User diredirect ke `/dashboard`

### Skenario 2: User Existing
1. User klik "Login dengan Google"
2. Popup Google Sign-In muncul
3. User pilih akun Google
4. Firebase mengenali user existing
5. User langsung diredirect ke `/dashboard`

## 📊 Data yang Disimpan di Firestore

Saat Google Sign-In, data berikut disimpan di `users/{uid}`:

```typescript
{
  email: string,              // Email dari Google Account
  displayName: string,         // Nama dari Google Account
  createdAt: string            // ISO timestamp
}
```

## 🎯 Keuntungan Google Sign-In

✅ **User Experience**
- Login cepat tanpa perlu mengingat password
- Tidak perlu verifikasi email
- Trusted provider (Google)

✅ **Security**
- OAuth 2.0 protocol
- No password storage
- Two-factor authentication (jika user aktifkan di Google)

✅ **Development**
- Firebase handles semua OAuth flow
- Minimal code required
- Built-in session management

## 🚀 Next Steps

### Untuk Production

1. **Konfigurasi OAuth Consent Screen** untuk production
   - Ganti dari "Testing" ke "Production"
   - Submit for verification jika diperlukan

2. **Tambahkan Authorized Domains**
   - Tambahkan production domain di Firebase Console
   - Authentication → Settings → Authorized domains

3. **Branding** (Opsional)
   - Upload logo aplikasi di OAuth Consent Screen
   - Tambahkan privacy policy dan terms of service URLs

### Fitur Tambahan yang Bisa Ditambahkan

- [ ] Sign-In with Apple
- [ ] Sign-In with Microsoft
- [ ] Sign-In with GitHub
- [ ] Two-factor authentication (2FA)
- [ ] Phone number authentication
- [ ] Email verification requirement

## 📚 Referensi

- [Firebase Google Sign-In Docs](https://firebase.google.com/docs/auth/web/google-signin)
- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [Firebase Authentication Best Practices](https://firebase.google.com/docs/auth/web/best-practices)

---

**Setup Complete! 🎉**

User sekarang bisa login dengan:
1. Email & Password
2. Google Account

*Last Updated: December 2025*
