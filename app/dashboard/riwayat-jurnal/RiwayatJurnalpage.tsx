'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, Download, FileText } from 'lucide-react';

// Import library untuk Export
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Jurnal {
  id: string;
  tanggal: string;
  class_name: string;
  mata_pelajaran: string;
  jam_pelajaran: string;
  materi: string;
  metode?: string;
  catatan?: string;
  rekap_absensi: {
    hadir: number;
    izin: number;
    sakit: number;
    alfa: number;
  };
}

export default function RiwayatJurnalPage() {
  const { user } = useAuth();
  const [jurnals, setJurnals] = useState<Jurnal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadJurnals();
    }
  }, [user]);

  const loadJurnals = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'jurnal_mengajar'), where('user_id', '==', user?.uid));
      const querySnapshot = await getDocs(q);
      const data: Jurnal[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Jurnal);
      });
      
      data.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setJurnals(data);
    } catch (error) {
      console.error("Gagal memuat jurnal:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus riwayat jurnal ini?')) return;
    try {
      await deleteDoc(doc(db, 'jurnal_mengajar', id));
      setJurnals(jurnals.filter(j => j.id !== id));
      alert('✅ Jurnal berhasil dihapus!');
    } catch (error) {
      console.error(error);
      alert('Gagal menghapus jurnal.');
    }
  };

  // --- FUNGSI EXPORT KE EXCEL ---
  const exportToExcel = () => {
    if (jurnals.length === 0) {
      alert("Tidak ada data untuk diexport");
      return;
    }

    // Siapkan data lengkap termasuk yang disembunyikan di tabel web
    const exportData = jurnals.map((j, index) => ({
      'No': index + 1,
      'Tanggal': j.tanggal,
      'Kelas': j.class_name,
      'Mata Pelajaran': j.mata_pelajaran,
      'Jam Ke-': j.jam_pelajaran,
      'Materi / TP': j.materi,
      'Metode': j.metode || '-',
      'Catatan Guru': j.catatan || '-',
      'Hadir': j.rekap_absensi?.hadir || 0,
      'Izin': j.rekap_absensi?.izin || 0,
      'Sakit': j.rekap_absensi?.sakit || 0,
      'Alfa': j.rekap_absensi?.alfa || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Jurnal");
    XLSX.writeFile(workbook, `Laporan_Jurnal_Mengajar_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // --- FUNGSI EXPORT KE PDF ---
  const exportToPDF = () => {
    if (jurnals.length === 0) {
      alert("Tidak ada data untuk diexport");
      return;
    }

    const doc = new jsPDF('landscape'); // Kertas memanjang agar muat banyak kolom
    
    // Judul Dokumen
    doc.setFontSize(16);
    doc.text('Laporan Jurnal Mengajar', 14, 15);
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);

    // Siapkan baris data tabel
    const tableData = jurnals.map((j, index) => [
      index + 1,
      j.tanggal,
      `Kelas ${j.class_name}`,
      `${j.mata_pelajaran} (Jam ${j.jam_pelajaran})`,
      j.materi,
      j.metode || '-',
      j.catatan || '-',
      `${j.rekap_absensi?.hadir || 0}H, ${j.rekap_absensi?.izin || 0}I, ${j.rekap_absensi?.sakit || 0}S, ${j.rekap_absensi?.alfa || 0}A`
    ]);

    // Render Tabel
    autoTable(doc, {
      startY: 28,
      head: [['No', 'Tanggal', 'Kelas', 'Mata Pelajaran', 'Materi/TP', 'Metode', 'Catatan', 'Absensi']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185] }, // Warna biru
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 25 },
        2: { cellWidth: 20 },
        3: { cellWidth: 35 },
        4: { cellWidth: 60 },
        5: { cellWidth: 35 },
        6: { cellWidth: 45 },
        7: { cellWidth: 30 }
      }
    });

    doc.save(`Laporan_Jurnal_Mengajar_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="container mx-auto pb-10 px-4 pt-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Riwayat Jurnal</h1>
          <p className="mt-2 text-gray-600">Daftar catatan mengajar dan kehadiran siswa yang telah disimpan.</p>
        </div>
        <div className="flex gap-2">
          {/* Tombol Export yang sudah berfungsi */}
          <Button onClick={exportToExcel} variant="outline" className="border-green-500 text-green-700 hover:bg-green-50 shadow-sm">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button onClick={exportToPDF} variant="outline" className="border-red-500 text-red-700 hover:bg-red-50 shadow-sm">
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="border-blue-200 shadow-sm">
        <CardHeader className="bg-blue-50/50 border-b border-blue-100">
          <CardTitle className="text-blue-800">Data Jurnal Mengajar</CardTitle>
          <CardDescription>Semua jurnal Anda akan tampil di sini, diurutkan dari yang terbaru.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : jurnals.length === 0 ? (
            <div className="text-center p-12 text-gray-500">
              Belum ada riwayat jurnal. Silakan isi jurnal mengajar terlebih dahulu.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-12 text-center">No</TableHead>
                    <TableHead className="min-w-[120px]">Tanggal</TableHead>
                    <TableHead>Kelas & Mapel</TableHead>
                    <TableHead className="min-w-[200px]">Materi</TableHead>
                    <TableHead className="text-center">Kehadiran</TableHead>
                    <TableHead className="text-center w-24">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jurnals.map((jurnal, idx) => (
                    <TableRow key={jurnal.id} className="hover:bg-blue-50/30 transition-colors">
                      <TableCell className="text-center font-medium">{idx + 1}</TableCell>
                      <TableCell className="font-semibold text-gray-700">{jurnal.tanggal}</TableCell>
                      <TableCell>
                        <div className="font-bold text-blue-800">Kelas {jurnal.class_name}</div>
                        <div className="text-sm text-gray-600">{jurnal.mata_pelajaran} (Jam ke-{jurnal.jam_pelajaran})</div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">{jurnal.materi}</TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1.5 text-xs font-bold text-white">
                          <span className="bg-green-500 px-2 py-1 rounded shadow-sm" title="Hadir">{jurnal.rekap_absensi?.hadir || 0} H</span>
                          <span className="bg-blue-500 px-2 py-1 rounded shadow-sm" title="Izin">{jurnal.rekap_absensi?.izin || 0} I</span>
                          <span className="bg-yellow-500 px-2 py-1 rounded shadow-sm" title="Sakit">{jurnal.rekap_absensi?.sakit || 0} S</span>
                          <span className="bg-red-500 px-2 py-1 rounded shadow-sm" title="Alfa">{jurnal.rekap_absensi?.alfa || 0} A</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(jurnal.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                          title="Hapus Jurnal"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}