# Panduan Import Siswa dari CSV

## 📋 Fitur Baru: Import Data Siswa

Sekarang Anda bisa mengimport data siswa dalam jumlah banyak menggunakan file CSV.

## 🎯 Cara Menggunakan

### 1. Download Template CSV

1. Buka halaman **Master Data**
2. Pilih kelas yang akan diisi siswa
3. Klik tombol **"Import CSV"**
4. Klik **"Download Template"**
5. File `template_siswa.csv` akan terdownload

### 2. Edit File CSV

Buka file CSV dengan Excel, Google Sheets, atau text editor:

```csv
Nama,NISN
Ahmad Fauzi,1234567890
Siti Nurhaliza,1234567891
Budi Santoso,1234567892
```

**Format:**
- Baris 1: Header (Nama,NISN)
- Baris berikutnya: Data siswa
- Kolom 1: Nama lengkap siswa
- Kolom 2: NISN (10 digit)

### 3. Import ke Aplikasi

1. Klik **"Pilih File CSV"**
2. Pilih file CSV yang sudah diedit
3. Tunggu proses import selesai
4. Alert akan muncul dengan hasil import

## ✅ Tips Import CSV

### Format yang Benar

```csv
Nama,NISN
Ahmad Fauzi,1234567890
Siti Nurhaliza,1234567891
Budi Santoso,1234567892
```

✅ **Benar:**
- Ada header di baris pertama
- Setiap baris punya 2 kolom (Nama,NISN)
- Tidak ada baris kosong di tengah
- NISN berupa angka

### Format yang Salah

❌ **Salah - Tanpa Header:**
```csv
Ahmad Fauzi,1234567890
```
*Solusi: Tambahkan header di baris pertama*

❌ **Salah - Ada kolom kosong:**
```csv
Nama,NISN
Ahmad Fauzi,
Siti Nurhaliza,1234567891
```
*Solusi: Isi semua kolom atau hapus baris yang tidak lengkap*

❌ **Salah - Format Excel:**
```
| Nama          | NISN       |
|---------------|------------|
| Ahmad Fauzi   | 1234567890 |
```
*Solusi: Save as CSV, bukan XLSX*

## 🔧 Edit File CSV

### Dengan Microsoft Excel

1. Buka file CSV
2. Edit data siswa
3. **File → Save As → CSV (Comma delimited) (*.csv)**
4. Pastikan format tetap CSV

### Dengan Google Sheets

1. Upload file CSV ke Google Drive
2. Buka dengan Google Sheets
3. Edit data siswa
4. **File → Download → Comma Separated Values (.csv)**

### Dengan Notepad/Text Editor

```csv
Nama,NISN
Ahmad Fauzi,1234567890
Siti Nurhaliza,1234567891
```

Simpan dengan encoding UTF-8.

## 📊 Contoh Data Lengkap

```csv
Nama,NISN
Ahmad Fauzi,1234567890
Siti Nurhaliza,1234567891
Budi Santoso,1234567892
Dewi Lestari,1234567893
Eko Prasetyo,1234567894
Fitri Handayani,1234567895
Galih Permana,1234567896
Hana Sakinah,1234567897
Indra Gunawan,1234567898
Jasmine Aulia,1234567899
```

## 🐛 Troubleshooting

### Error: "File CSV kosong atau tidak valid"

**Penyebab:**
- File kosong
- Hanya ada header tanpa data
- Format file bukan CSV

**Solusi:**
- Pastikan ada minimal 2 baris (header + 1 data)
- Cek format file (harus .csv)

### Error: "X berhasil, Y gagal"

**Penyebab:**
- Beberapa baris tidak lengkap
- Ada kolom yang kosong

**Solusi:**
- Cek baris yang gagal (biasanya ada kolom kosong)
- Pastikan setiap baris punya Nama dan NISN

### Error: "Gagal membaca file CSV"

**Penyebab:**
- File corrupt
- Encoding tidak didukung

**Solusi:**
- Download template baru
- Copy-paste data ke template baru
- Save dengan encoding UTF-8

### Data tidak muncul setelah import

**Solusi:**
- Refresh halaman (F5)
- Klik ulang nama kelas di sidebar

## 💡 Best Practices

### 1. Backup Data
Sebelum import dalam jumlah besar, backup data existing

### 2. Test dengan Data Kecil
Import 2-3 siswa dulu untuk testing

### 3. Validasi NISN
Pastikan NISN benar dan tidak duplikat

### 4. Format Konsisten
Gunakan format nama yang konsisten (Huruf Kapital di Awal)

### 5. Batch Import
Untuk 100+ siswa, split jadi beberapa file

## 🚀 Optimasi Performance

Aplikasi sudah dioptimasi untuk mengurangi lag:

### Fitur Optimasi:
✅ **Loading State** - Indicator saat berpindah halaman
✅ **Lazy Loading** - Data dimuat saat diperlukan
✅ **Transition API** - Navigasi lebih smooth
✅ **Active State** - Highlight menu aktif
✅ **Skeleton Loading** - Loading placeholder

### Tips untuk Performa Lebih Baik:

1. **Tutup Tab Tidak Terpakai**
   - Browser lebih cepat dengan sedikit tab

2. **Clear Browser Cache**
   ```
   Ctrl + Shift + Delete (Chrome)
   ```

3. **Gunakan Browser Modern**
   - Chrome, Edge, Firefox (versi terbaru)

4. **Koneksi Internet Stabil**
   - Firebase memerlukan koneksi internet

5. **Batch Operation**
   - Import siswa sekaligus daripada satu-satu

## 📋 Checklist Import Sukses

Sebelum import, pastikan:

- [ ] File format CSV (bukan XLSX atau XLS)
- [ ] Ada header: Nama,NISN
- [ ] Setiap baris punya 2 kolom
- [ ] Tidak ada baris kosong
- [ ] NISN berupa angka 10 digit
- [ ] Nama tidak ada karakter aneh
- [ ] File encoding UTF-8
- [ ] Sudah pilih kelas di sidebar
- [ ] Internet stabil

## 📞 Support

Jika masih ada masalah:

1. Cek console browser (F12) untuk error message
2. Screenshot error dan kirim ke admin
3. Coba dengan template fresh (download ulang)
4. Manual input jika import terus gagal

---

**Happy Teaching! 🎓**

*Last Updated: December 2025*
