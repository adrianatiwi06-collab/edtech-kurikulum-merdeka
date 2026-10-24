// lib/kalenderJateng.ts

export interface BulanAkademik {
  bulan: string;
  semester: '1 (Ganjil)' | '2 (Genap)';
  jumlahHariEfektif: number; 
  kegiatanLain: number;
  jumlahTotal: number;
  catatan?: string;
}

export const kalenderJateng2026_2027: BulanAkademik[] = [
  // Semester Gasal
  { bulan: 'Juli 2026', semester: '1 (Ganjil)', jumlahHariEfektif: 14, kegiatanLain: 1, jumlahTotal: 15, catatan: 'Permulaan tahun ajaran & MPLS' },
  { bulan: 'Agustus 2026', semester: '1 (Ganjil)', jumlahHariEfektif: 19, kegiatanLain: 0, jumlahTotal: 19 },
  { bulan: 'September 2026', semester: '1 (Ganjil)', jumlahHariEfektif: 22, kegiatanLain: 0, jumlahTotal: 22 },
  { bulan: 'Oktober 2026', semester: '1 (Ganjil)', jumlahHariEfektif: 22, kegiatanLain: 0, jumlahTotal: 22 },
  { bulan: 'November 2026', semester: '1 (Ganjil)', jumlahHariEfektif: 20, kegiatanLain: 1, jumlahTotal: 21 },
  { bulan: 'Desember 2026', semester: '1 (Ganjil)', jumlahHariEfektif: 13, kegiatanLain: 1, jumlahTotal: 14, catatan: 'Penyerahan rapor semester gasal' },

  // Semester Genap
  { bulan: 'Januari 2027', semester: '2 (Genap)', jumlahHariEfektif: 19, kegiatanLain: 0, jumlahTotal: 19 },
  { bulan: 'Februari 2027', semester: '2 (Genap)', jumlahHariEfektif: 19, kegiatanLain: 0, jumlahTotal: 19, catatan: 'Perkiraan awal puasa Ramadhan' },
  { bulan: 'Maret 2027', semester: '2 (Genap)', jumlahHariEfektif: 17, kegiatanLain: 0, jumlahTotal: 17, catatan: 'Libur sekitar Idulfitri' },
  { bulan: 'April 2027', semester: '2 (Genap)', jumlahHariEfektif: 13, kegiatanLain: 9, jumlahTotal: 22, catatan: 'Tes Kemampuan Akademik (TKA)' },
  { bulan: 'Mei 2027', semester: '2 (Genap)', jumlahHariEfektif: 17, kegiatanLain: 1, jumlahTotal: 18 },
  { bulan: 'Juni 2027', semester: '2 (Genap)', jumlahHariEfektif: 12, kegiatanLain: 1, jumlahTotal: 13, catatan: 'Penyerahan rapor semester genap' }
];

// Fungsi helper untuk menghitung total JP efektif dalam satu semester
export function hitungTotalJPEfektif(semester: '1 (Ganjil)' | '2 (Genap)', jampelPerMinggu: number = 4) {
  // PERBAIKAN: Menggunakan kalenderJateng2026_2027 dan mengonversi hari efektif ke pekan (asumsi 5 hari kerja)
  const bulanList = kalenderJateng2026_2027.filter(b => b.semester === semester);
  const totalPekan = bulanList.reduce((acc, curr) => acc + Math.floor(curr.jumlahHariEfektif / 5), 0);
  
  return {
    totalPekan,
    totalJP: totalPekan * jampelPerMinggu,
    rincian: bulanList
  };
}