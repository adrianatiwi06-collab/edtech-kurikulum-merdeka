'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, FileText, BookOpen, Trash2, CalendarDays } from 'lucide-react';
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
}

export default function RiwayatJurnalPage() {
  const { user } = useAuth();
  const [jurnals, setJurnals] = useState<Jurnal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadJurnals(); }, [user]);

  const loadJurnals = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, 'jurnal_mengajar'), where('user_id', '==', user.uid)));
      const data: Jurnal[] = [];
      snapshot.forEach((item) => data.push({ id: item.id, ...item.data() } as Jurnal));
      data.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setJurnals(data);
    } catch (error) {
      console.error(error);
      alert('Gagal memuat riwayat jurnal.');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus jurnal ini?')) return;
    try {
      await deleteDoc(doc(db, 'jurnal_mengajar', id));
      setJurnals((prev) => prev.filter((item) => item.id !== id));
      alert('Jurnal berhasil dihapus.');
    } catch (error) {
      console.error(error);
      alert('Gagal menghapus jurnal.');
    }
  };

  const exportToExcel = () => {
    if (!jurnals.length) return alert('Tidak ada data untuk diexport.');
    const data = jurnals.map((j, i) => ({
      No: i + 1, Tanggal: j.tanggal, Kelas: j.class_name,
      'Mata Pelajaran': j.mata_pelajaran, 'Jam Ke-': j.jam_pelajaran || '-',
      'Materi / TP': j.materi, Metode: j.metode || '-', 'Catatan Guru': j.catatan || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Jurnal');
    XLSX.writeFile(wb, `Laporan_Jurnal_Mengajar_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    if (!jurnals.length) return alert('Tidak ada data untuk diexport.');
    const pdf = new jsPDF('landscape');
    pdf.setFontSize(16);
    pdf.text('Laporan Jurnal Mengajar', 14, 15);
    pdf.setFontSize(10);
    pdf.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);
    autoTable(pdf, {
      startY: 28,
      head: [['No', 'Tanggal', 'Kelas', 'Mata Pelajaran', 'Materi/TP', 'Metode', 'Catatan']],
      body: jurnals.map((j, i) => [i + 1, j.tanggal, `Kelas ${j.class_name}`, `${j.mata_pelajaran} (Jam ${j.jam_pelajaran || '-'})`, j.materi, j.metode || '-', j.catatan || '-']),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
    });
    pdf.save(`Laporan_Jurnal_Mengajar_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#f7f8fc] px-4 pb-12 pt-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-600 p-6 text-white shadow-[0_18px_50px_rgba(37,99,235,0.20)] md:p-8">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                <BookOpen className="h-3.5 w-3.5" /> Dokumentasi Pembelajaran
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Riwayat Jurnal</h1>
              <p className="mt-2 text-sm leading-6 text-blue-100 md:text-base">
                Kelola dan export seluruh catatan kegiatan mengajar Anda.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportToExcel} variant="outline" className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Download className="mr-2 h-4 w-4" /> Excel
              </Button>
              <Button onClick={exportToPDF} variant="outline" className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <FileText className="mr-2 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>
        </section>

        <Card className="overflow-hidden rounded-[28px] border-0 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.07)]">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-6 py-5 md:px-7">
            <CardTitle className="flex items-center gap-3 text-lg text-slate-800">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <CalendarDays className="h-5 w-5" />
              </span>
              Daftar Jurnal Mengajar
            </CardTitle>
            <CardDescription>Data diurutkan dari jurnal terbaru.</CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
            ) : !jurnals.length ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
                <BookOpen className="mb-4 h-12 w-12 text-slate-200" />
                <p className="font-semibold text-slate-600">Belum ada jurnal</p>
                <p className="mt-1 text-sm text-slate-400">Jurnal yang disimpan akan muncul di sini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px]">
                  <thead className="bg-slate-50/80">
                    <tr className="border-b border-slate-100">
                      {['No', 'Tanggal', 'Kelas & Mapel', 'Materi / TP', 'Metode', 'Catatan', 'Aksi'].map((x, i) => (
                        <th key={x} className={`px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 ${i === 0 || i === 6 ? 'text-center' : 'text-left'}`}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jurnals.map((jurnal, index) => (
                      <tr key={jurnal.id} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/30">
                        <td className="px-5 py-4 text-center text-sm font-semibold text-slate-400">{index + 1}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-700">{jurnal.tanggal}</td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-800">Kelas {jurnal.class_name}</div>
                          <div className="mt-1 text-sm text-slate-500">{jurnal.mata_pelajaran} · Jam {jurnal.jam_pelajaran || '-'}</div>
                        </td>
                        <td className="max-w-[360px] px-5 py-4 text-sm leading-6 text-slate-600">{jurnal.materi}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{jurnal.metode || '-'}</td>
                        <td className="max-w-[250px] px-5 py-4 text-sm text-slate-500">{jurnal.catatan || '-'}</td>
                        <td className="px-5 py-4 text-center">
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(jurnal.id)}
                            className="rounded-full text-rose-500 hover:bg-rose-50 hover:text-rose-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
