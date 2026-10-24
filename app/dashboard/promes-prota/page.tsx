'use client';
import { generateModulAjarAction } from '../modul-ajar/actions';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProtaPromesExport } from '@/lib/prota-promes/useProtaPromesExport'; // ← Hook Ekspor DOCX Professional
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, Loader2, Trash2, Search, FileText, Download, Calendar, ListChecks 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

// IMPOR FUNGSI KALDIK DARI MODEL & STORE ANDA
import { loadYear, fallbackDoc } from '@/lib/kaldik/store';
import { buildModel } from '@/lib/kaldik/model';

export default function ProtaPromesPage() {
  const { user } = useAuth();
  
  // Inisialisasi Hook Ekspor DOCX Prota & Promes
  const { exportAsDocx } = useProtaPromesExport();

  // Tab State
  const [activeTab, setActiveTab] = useState<'generator' | 'tersimpan'>('generator');

  // Form State
  const [namaSekolah, setNamaSekolah] = useState('SD Negeri Nusawangkal 02');
  const [namaKepalaSekolah, setNamaKepalaSekolah] = useState('Painem,S.Pd.SD.');
  const [nipKepalaSekolah, setNipKepalaSekolah] = useState('198507242009032008');
  const [namaGuru, setNamaGuru] = useState('Gara Nuradin, S.Pd.SD.');
  const [nipGuru, setNipGuru] = useState('198207142022211006');
  
  const [mataPelajaran, setMataPelajaran] = useState('Matematika');
  const [kelas, setKelas] = useState('2');
  const [fase, setFase] = useState('A');
  const [tahunPelajaran, setTahunPelajaran] = useState('2026/2027');
  const [kota, setKota] = useState('Nusawangkal');
  const [tanggalPembuatan, setTanggalPembuatan] = useState('20 Juli 2026');

  // Generator & Database Tersimpan
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedDoc, setGeneratedDoc] = useState<any | null>(null);
  const [savedDocs, setSavedDocs] = useState<any[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');

  const sdSubjects = [
    'Pendidikan Agama Islam', 'Pendidikan Pancasila', 'Bahasa Indonesia', 'Matematika',
    'Ilmu Pengetahuan Alam', 'IPAS (Ilmu Pengetahuan Alam dan Sosial)', 
    'Pendidikan Jasmani Olahraga dan Kesehatan (PJOK)', 'Seni Rupa', 'Bahasa Inggris', 'Bahasa Daerah'
  ];

  useEffect(() => {
    if (user) {
      loadSavedDocuments();
    }
  }, [user]);

  const loadSavedDocuments = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'prota_promes_docs'), where('user_id', '==', user.uid));
      const snapshot = await getDocs(q);
      const docsList: any[] = [];
      snapshot.forEach(d => docsList.push({ id: d.id, ...d.data() }));
      docsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSavedDocs(docsList);
    } catch (err) {
      console.error('Gagal memuat dokumen Prota & Promes:', err);
    }
  };

  // LOGIKA AI DINAMIS TERHUBUNG DENGAN DATABASE KALDIK
  const handleGenerate = async () => {
    setLoading(true);
    setLoadingMessage('Mengekstrak data Kalender Pendidikan dari database...');

    try {
      const kaldikId = tahunPelajaran.replace('/', '-');
      
      let kaldikDocData = null;
      try {
        kaldikDocData = await loadYear(kaldikId);
      } catch (e) {
        console.warn("Gagal memuat kaldik dari DB", e);
      }

      if (!kaldikDocData) {
        kaldikDocData = fallbackDoc().doc;
        toast.info(`Data Kaldik khusus ${tahunPelajaran} belum disimpan di database. Menggunakan data standar aplikasi.`);
      }

      const kaldikModel = buildModel(kaldikDocData);
      const rowsSem1 = kaldikModel.rowsOfSemester(1);
      const rowsSem2 = kaldikModel.rowsOfSemester(2);
      const totalSem1 = kaldikModel.effectiveTotal(1);
      const totalSem2 = kaldikModel.effectiveTotal(2);
      const totalHbe = totalSem1 + totalSem2;

      const textHbeSem1 = rowsSem1.map(r => `- ${r.bulan}: ${r.jumlahHariEfektif} Hari Belajar Efektif (${r.pekan} Pekan). Catatan: ${r.catatan || 'Normal'}`).join('\n   ');
      const textHbeSem2 = rowsSem2.map(r => `- ${r.bulan}: ${r.jumlahHariEfektif} Hari Belajar Efektif (${r.pekan} Pekan). Catatan: ${r.catatan || 'Normal'}`).join('\n   ');

      setLoadingMessage(`Data Kaldik ditemukan (${totalHbe} HBE). AI sedang menyusun Prota & Promes...`);

      const prompt = `
Bertindaklah sebagai ahli kurikulum nasional, perancang pembelajaran, dan praktisi administrasi guru profesional di Indonesia.

Tugasmu adalah menyusun dokumen **Program Tahunan (Prota) dan Program Semester (Promes) secara lengkap, logis, terstruktur, dan siap pakai** untuk tahun ajaran ${tahunPelajaran}, dengan **WAJIB menyesuaikan Kalender Pendidikan Resmi Provinsi Jawa Tengah untuk jenjang SD (Sistem 5 Hari Sekolah)**.

Data Acuan:
- Nama Satuan Pendidikan: ${namaSekolah}
- Mata Pelajaran: ${mataPelajaran}
- Fase: ${fase} / Kelas: ${kelas}
- Tahun Pelajaran: ${tahunPelajaran}
- Wilayah / Acuan Kaldik: Provinsi Jawa Tengah (5 Hari Sekolah)
- Penyusun: ${namaGuru} (NIP: ${nipGuru})

DATA REFERENSI HARI BELAJAR EFEKTIF (HBE) BERDASARKAN DATABASE KALDIK TERBARU:
1. **Semester Gasal (Total ${totalSem1} Hari Belajar Efektif):**
   ${textHbeSem1}
   
2. **Semester Genap (Total ${totalSem2} Hari Belajar Efektif):**
   ${textHbeSem2}

ATURAN FORMAT OUTPUT (WAJIB, karena output langsung diekspor ke dokumen Word):
- JANGAN menulis halaman sampul, judul ganda, atau blok tanda tangan di dokumen. Aplikasi menambahkannya sendiri. Mulai langsung dari "## BAGIAN I".
- Gunakan HANYA heading: "## " untuk bagian utama (HURUF KAPITAL), dan "### " untuk sub-bagian bernomor.
- Sajikan informasi dalam TABEL Markdown dengan baris pemisah |---|---|. Setiap baris tabel harus satu baris teks dengan jumlah kolom sama header.
- Dilarang: blok kode, diagram ASCII, emoji, garis pemisah "---", HTML. Gunakan <br> untuk baris baru di sel tabel.
- Gunakan **tebal** hanya untuk penekanan penting. Daftar pakai "- " atau "1. ". Kelompok daftar tulis sebagai satu blok.
- Gunakan bahasa Indonesia baku, konkret, siap pakai. Hindari kalimat pembuka/penutup berbelit.

Struktur Dokumen:

## BAGIAN I: ANALISIS STRUKTUR WAKTU & KALENDER PENDIDIKAN JATENG
- Tabel Perhitungan Hari Belajar Efektif (HBE) Semester Gasal Berdasarkan Kaldik Jateng (Kolom: No | Bulan | Hari Belajar Efektif | Jumlah Pekan | Catatan Kegiatan)
- Tabel Perhitungan Hari Belajar Efektif (HBE) Semester Genap Berdasarkan Kaldik Jateng (Kolom sama, menyesuaikan data semester genap)
- Tabel Rekapitulasi Total HBE 1 Tahun Ajaran (Total ${totalHbe} HBE)

## BAGIAN II: PROGRAM TAHUNAN (PROTA)
- Tabel pemetaan materi/lingkup materi seluruh bab untuk Semester 1 dan Semester 2 (Kolom: No | Bab / Lingkup Materi | Alokasi Waktu / JP)

## BAGIAN III: PROGRAM SEMESTER (PROMES) SEMESTER GASAL
- Tabel matriks bulanan untuk Semester Gasal dengan rincian alokasi per minggu efektif berdasarkan jumlah HBE bulanan dari data di atas.

## BAGIAN IV: PROGRAM SEMESTER (PROMES) SEMESTER GENAP
- Tabel matriks bulanan untuk Semester Genap dengan rincian alokasi per minggu efektif berdasarkan jumlah HBE bulanan dari data di atas.
      `;

      const result = await generateModulAjarAction(prompt);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Server AI gagal merespons.');
      }

      const docData = {
        title: `Prota & Promes ${mataPelajaran} Kelas ${kelas} (Kaldik Jateng)`,
        school: namaSekolah,
        headmaster: namaKepalaSekolah,
        headmasterNip: nipKepalaSekolah,
        teacher: namaGuru,
        teacherNip: nipGuru,
        subject: mataPelajaran,
        grade: kelas,
        fase: fase,
        academicYear: tahunPelajaran,
        city: kota,
        date: tanggalPembuatan,
        konten_ai: result.data,
        created_at: new Date().toISOString()
      };

      setGeneratedDoc(docData);
      toast.success('Prota & Promes berbasis Kaldik Database berhasil digenerate!');
    } catch (err: any) {
      toast.error('Gagal generate: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSaveDoc = async () => {
    if (!user || !generatedDoc) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'prota_promes_docs'), {
        user_id: user.uid,
        ...generatedDoc
      });
      toast.success('Dokumen Prota & Promes berhasil disimpan!');
      loadSavedDocuments();
      setActiveTab('tersimpan');
    } catch (err: any) {
      toast.error('Gagal menyimpan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // FUNGSI EKSPOR MENGGUNAKAN DOCX PROFESSIONAL EXPORTER HOOK
  const handleExportWord = async (docItem: any) => {
    if (!docItem || !docItem.konten_ai) {
      toast.error('Konten dokumen kosong.');
      return;
    }

    try {
      const result = await exportAsDocx({
        title: docItem.title,
        school: docItem.school,
        headmaster: docItem.headmaster,
        headmasterNip: docItem.headmasterNip,
        teacher: docItem.teacher,
        teacherNip: docItem.teacherNip,
        subject: docItem.subject,
        grade: docItem.grade,
        fase: docItem.fase,
        academicYear: docItem.academicYear,
        city: docItem.city,
        date: docItem.date,
        konten_ai: docItem.konten_ai,
      });

      if (result.success) {
        toast.success('Dokumen Prota & Promes berhasil diunduh dalam format Word (.docx)!');
      } else {
        toast.error('Gagal export DOCX: ' + (result.error || 'Unknown error'));
        console.error('Export error:', result.error);
      }
    } catch (err: any) {
      toast.error('Gagal export: ' + err.message);
      console.error('Export exception:', err);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Hapus dokumen ini?')) return;
    try {
      await deleteDoc(doc(db, 'prota_promes_docs', id));
      setSavedDocs(savedDocs.filter(d => d.id !== id));
      toast.success('Berhasil dihapus');
    } catch (err) {
      toast.error('Gagal menghapus');
    }
  };

  const filteredDocs = savedDocs.filter(d => 
    d.title?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    d.subject?.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  return (
    <div className="w-full space-y-5 py-4 px-2 max-w-[1600px] mx-auto font-sans">
      
      {/* ── HEADER BARU ── */}
      <header className="relative rounded-[2rem] bg-[#0b3d33] text-white">
        <div
          className="absolute inset-0 overflow-hidden rounded-[2rem]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.5px), radial-gradient(700px 320px at 100% 0%, rgba(52,211,153,0.28), transparent 65%)',
            backgroundSize: '20px 20px, 100% 100%',
          }}
        />

        <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end z-10">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-white/25">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300"/>
                Material 3 AI Curriculum Workspace
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                <Calendar aria-hidden="true" className="h-3.5 w-3.5"/>
                Terhubung ke Database Kaldik
              </span>
            </div>
            
            <h1 className="kd-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Generator & Manajemen
              <span className="block text-emerald-300/90 mt-1">Prota & Promes Terintegrasi</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-emerald-50/75">
              Buat Program Tahunan dan Program Semester secara otomatis. Sistem akan langsung mencocokkan perhitungan Hari Belajar Efektif (HBE) dari Kalender Pendidikan Jawa Tengah yang tersimpan.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:w-80">
            <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
              <p className="text-xs text-emerald-200/80">Dokumen Tersimpan</p>
              <p className="mt-1.5 text-sm font-semibold leading-snug">{savedDocs.length} Dokumen Prota/Promes</p>
              <p className="mt-1 text-xs text-emerald-100/70">Siap untuk diunduh (.docx)</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── TAB NAVIGASI ── */}
      <nav aria-label="Tampilan" className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('generator')}
          className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
            activeTab === 'generator' ? 'bg-[#0b3d33] text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Sparkles aria-hidden="true" className="h-4 w-4"/>
          Buat Prota & Promes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tersimpan')}
          className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
            activeTab === 'tersimpan' ? 'bg-[#0b3d33] text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ListChecks aria-hidden="true" className="h-4 w-4"/>
          Dokumen Tersimpan ({savedDocs.length})
        </button>
      </nav>

      {/* ── ISI TAB ── */}
      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start mt-2">
          
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <h3 className="text-[11px] font-black text-[#0b3d33] uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px]">1</span> 
                PARAMETER IDENTITAS & KALDIK
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">NAMA SEKOLAH</label>
                  <input
                    type="text"
                    value={namaSekolah}
                    onChange={(e) => setNamaSekolah(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">KEPALA SEKOLAH</label>
                    <input
                      type="text"
                      value={namaKepalaSekolah}
                      onChange={(e) => setNamaKepalaSekolah(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">NIP KEPSEK</label>
                    <input
                      type="text"
                      value={nipKepalaSekolah}
                      onChange={(e) => setNipKepalaSekolah(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">NAMA GURU</label>
                    <input
                      type="text"
                      value={namaGuru}
                      onChange={(e) => setNamaGuru(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">NIP GURU</label>
                    <input
                      type="text"
                      value={nipGuru}
                      onChange={(e) => setNipGuru(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">MATA PELAJARAN</label>
                  <select
                    value={mataPelajaran}
                    onChange={(e) => setMataPelajaran(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-bold outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                  >
                    {sdSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">KELAS</label>
                    <input
                      type="text"
                      value={kelas}
                      onChange={(e) => setKelas(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">FASE</label>
                    <input
                      type="text"
                      value={fase}
                      onChange={(e) => setFase(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">TAHUN PELAJARAN (SINKRON DB)</label>
                  <input
                    type="text"
                    value={tahunPelajaran}
                    onChange={(e) => setTahunPelajaran(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    placeholder="Contoh: 2026/2027"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Pastikan format persis seperti di menu Kalender (misal: 2026/2027)</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">KOTA</label>
                    <input
                      type="text"
                      value={kota}
                      onChange={(e) => setKota(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">TANGGAL PEMBUATAN</label>
                    <input
                      type="text"
                      value={tanggalPembuatan}
                      onChange={(e) => setTanggalPembuatan(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                </div>
              </div>

              <Button className="w-full rounded-xl bg-[#0b3d33] hover:bg-[#0f5244] text-white font-bold py-3 mt-4" disabled={loading} onClick={handleGenerate}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
                Buat Prota & Promes (Sync DB)
              </Button>
            </div>
          </div>

          <div className="lg:col-span-8">
            {loading ? (
              <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-16 text-center flex flex-col items-center justify-center min-h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3"/>
                <p className="text-sm font-bold text-slate-700">{loadingMessage}</p>
              </div>
            ) : generatedDoc ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-sm space-y-6 relative"
              >
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase">PREVIEW PROTA & PROMES</h2>
                    <p className="text-xs text-slate-500">{generatedDoc.subject} &middot; Kelas {generatedDoc.grade} &middot; TP {generatedDoc.academicYear}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleExportWord(generatedDoc)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg h-9 px-3 text-xs font-bold">
                      <Download className="w-4 h-4 mr-1.5"/> Ekspor Word (.docx)
                    </Button>
                    <Button className="bg-[#0b3d33] hover:bg-[#0f5244] text-white rounded-lg h-9 px-3 text-xs font-bold" onClick={handleSaveDoc}>
                      Simpan Dokumen
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 text-sm text-slate-800 font-serif leading-relaxed whitespace-pre-wrap">
                  {generatedDoc.konten_ai}
                </div>
              </motion.div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-16 text-center flex flex-col items-center justify-center min-h-[500px]">
                <Calendar className="w-12 h-12 text-slate-300 mb-3"/>
                <h3 className="text-base font-bold text-slate-800">Dokumen Belum Dibuat</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Lengkapi parameter di sebelah kiri lalu klik tombol "Buat Prota & Promes". Sistem akan membaca jumlah HBE dari Database Kalender Pendidikan Anda secara otomatis.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === 'tersimpan' && (
        <div className="space-y-6 mt-2">
          <div className="bg-white p-4 rounded-[1.75rem] shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
              <input
                type="text"
                placeholder="Cari dokumen Prota..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-slate-50 transition"
              />
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
              <h3 className="text-base font-bold text-slate-800">Tidak ada dokumen tersimpan</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredDocs.map(docItem => (
                <div key={docItem.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                        {docItem.subject}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleExportWord(docItem)} className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition" title="Download Word (.docx)"><Download className="w-4 h-4"/></button>
                        <button onClick={() => handleDeleteDoc(docItem.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition" title="Hapus"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                    <h3 className="font-bold text-slate-900 text-lg leading-tight">{docItem.title}</h3>
                    <p className="text-[11px] text-slate-500">Penyusun: {docItem.teacher} <br/> Tahun Ajaran: {docItem.academicYear}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}