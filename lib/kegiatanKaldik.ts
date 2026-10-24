// lib/kegiatanKaldik.ts

export interface Kegiatan {
  date: string;
  activity: string;
  type?: 'libur' | 'kegiatan' | 'upacara' | 'rapor' | 'tes';
}

export const kegiatanKaldik2026_2027: Kegiatan[] = [
  { date: '13 Juli 2026', activity: 'Hari Pertama Masuk Sekolah', type: 'kegiatan' },
  { date: '13 – 17 Juli 2026', activity: 'Kegiatan MPLS', type: 'kegiatan' },
  { date: '17 Agustus 2026', activity: 'Mengikuti Upacara HUT Kemerdekaan RI', type: 'upacara' },
  { date: '5 September 2026', activity: 'Libur Umum (Peringatan Maulid Nabi Muhammad SAW 1448 H)', type: 'libur' },
  { date: '1 Oktober 2026', activity: 'Mengikuti Upacara Hari Kesaktian Pancasila', type: 'upacara' },
  { date: '28 Oktober 2026', activity: 'Mengikuti Upacara Peringatan Hari Sumpah Pemuda', type: 'upacara' },
  { date: '10 November 2026', activity: 'Mengikuti Upacara Peringatan Hari Pahlawan', type: 'upacara' },
  { date: '18 Desember 2026', activity: 'Penyerahan Buku Laporan Hasil Belajar Semester Gasal untuk 5 hari sekolah', type: 'rapor' },
  { date: '19 Desember 2026', activity: 'Penyerahan Buku Laporan Hasil Belajar Semester Gasal untuk 6 hari sekolah', type: 'rapor' },
  { date: '21 Desember 2026 – 1 Januari 2027', activity: 'Libur Akhir Semester Gasal untuk 5 hari sekolah', type: 'libur' },
  { date: '21 Desember 2026 – 2 Januari 2027', activity: 'Libur Akhir Semester Gasal untuk 6 hari sekolah', type: 'libur' },
  { date: '24 Desember 2026', activity: 'Cuti Bersama sebelum Hari Raya Natal', type: 'libur' },
  { date: '25 Desember 2026', activity: 'Libur Umum (Hari Raya Natal)', type: 'libur' },
  { date: '1 Januari 2027', activity: 'Libur Umum (Tahun Baru Masehi 2027)', type: 'libur' },
  { date: '5 Januari 2027', activity: 'Libur Umum (Isro\' Mi\'raj 1448 H)', type: 'libur' },
  { date: '6 Februari 2027', activity: 'Libur Umum (Tahun Baru Imlek 2578)', type: 'libur' },
  { date: '10 Februari 2027', activity: 'Libur perkiraan awal Puasa Ramadhan 1448 H', type: 'libur' },
  { date: '8 Maret 2027', activity: 'Libur Umum (Hari Raya Nyepi Tahun Baru Saka 1949)', type: 'libur' },
  { date: '9 Maret 2027', activity: 'Libur Umum (Sebelum Hari Raya Idul Fitri 1448 H)', type: 'libur' },
  { date: '10 – 11 Maret 2027', activity: 'Libur Umum (Hari Raya Idul Fitri 1448 H)', type: 'libur' },
  { date: '12 – 13 Maret 2027', activity: 'Libur Umum (Sesudah Hari Raya Idul Fitri 1448 H)', type: 'libur' },
  { date: '26 Maret 2027', activity: 'Libur Umum (Wafat Yesus Kristus – Hari Paskah)', type: 'libur' },
  { date: '19 – 29 April 2027', activity: 'Tes Kemampuan Akademik (TKA)', type: 'tes' },
  { date: '21 April 2027', activity: 'Mengikuti Upacara Hari Kartini', type: 'upacara' },
  { date: '1 Mei 2027', activity: 'Libur Umum (Hari Buruh Internasional)', type: 'libur' },
  { date: '2 Mei 2027', activity: 'Mengikuti Upacara Peringatan Hari Pendidikan Nasional', type: 'upacara' },
  { date: '6 Mei 2027', activity: 'Libur Umum (Hari Kenaikan Yesus Kristus)', type: 'libur' },
  { date: '17 Mei 2027', activity: 'Libur Umum (Hari Raya Idul Adha 1448 H)', type: 'libur' },
  { date: '20 Mei 2027', activity: 'Mengikuti Upacara Peringatan Hari Kebangkitan Nasional', type: 'upacara' },
  { date: '20 Mei 2027', activity: 'Libur Umum (Hari Raya Waisak 2571 BE)', type: 'libur' },
  { date: '1 Juni 2027', activity: 'Mengikuti Upacara Peringatan Hari Lahir Pancasila', type: 'upacara' },
  { date: '6 Juni 2027', activity: 'Libur Umum (Tahun Baru Islam 1449 H)', type: 'libur' },
  { date: '7 Juni 2027', activity: 'Perkiraan Pengumuman Kelulusan', type: 'kegiatan' },
  { date: '18 Juni 2027', activity: 'Penyerahan Buku Laporan Hasil Belajar Semester Genap untuk 5 hari sekolah', type: 'rapor' },
  { date: '19 Juni 2027', activity: 'Penyerahan Buku Laporan Hasil Belajar Semester Genap untuk 6 hari sekolah', type: 'rapor' },
  { date: '21 Juni – 10 Juli 2027', activity: 'Libur Akhir Semester Genap/Libur Akhir Tahun Ajaran 2026/2027', type: 'libur' },
  { date: '12 Juli 2027', activity: 'Permulaan Tahun Ajaran 2027/2028', type: 'kegiatan' },
];
