'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, Loader2, CheckCircle2, 
  Trash2, Search, Filter, FileText, Download, Check 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface SavedTP {
  id: string;
  chapter: string;
  tp: string;
  semester: number;
  grade: string;
  subject: string;
}

export default function ModulAjarPage() {
  const { user } = useAuth();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'generator' | 'tersimpan'>('generator');
  
  // State Sumber TP dari Database
  const [savedTPs, setSavedTPs] = useState<SavedTP[]>([]);
  const [selectedTPIds, setSelectedTPIds] = useState<string[]>([]);

  // Form State sesuai Gambar UI
  const [namaSekolah, setNamaSekolah] = useState('SD Negeri Nusawangkal 02');
  const [namaKepalaSekolah, setNamaKepalaSekolah] = useState('..............................');
  const [nipKepalaSekolah, setNipKepalaSekolah] = useState('..............................');
  const [namaGuru, setNamaGuru] = useState('Gara Nuradin, S.Pd.SD.');
  const [nipGuru, setNipGuru] = useState('198207142022211006');
  
  const [mataPelajaran, setMataPelajaran] = useState('Matematika');
  const [kelas, setKelas] = useState('2');
  const [fase, setFase] = useState('A');
  const [semester, setSemester] = useState('1 (Ganjil)');
  const [tahunPelajaran, setTahunPelajaran] = useState('2026/2027');
  const [alokasiWaktu, setAlokasiWaktu] = useState('8 JP (4 kali pertemuan)');
  const [kota, setKota] = useState('Nusawangkal');
  const [tanggalPembuatan, setTanggalPembuatan] = useState('20 Oktober 2026');

  // Detail RPP
  const [materiPokok, setMateriPokok] = useState('Ayo Membilang Sampai Dengan 50');
  const [modelPembelajaran, setModelPembelajaran] = useState('Problem Based Learning');

  // Dimensi Profil Lulusan
  const [dimensi, setDimensi] = useState({
    keimanan: true,
    kewargaan: true,
    penalaranKritis: true,
    kreativitas: true,
    kolaborasi: true,
    kemandirian: true,
    kesehatan: true,
    komunikasi: true
  });

  // Generator & Database Tersimpan
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedModul, setGeneratedModul] = useState<any | null>(null);
  const [savedModules, setSavedModules] = useState<any[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [tabFilterSubject, setTabFilterSubject] = useState('Semua');

  const sdSubjects = [
    'Pendidikan Agama Islam', 'Pendidikan Pancasila', 'Bahasa Indonesia', 'Matematika',
    'Ilmu Pengetahuan Alam', 'IPAS (Ilmu Pengetahuan Alam dan Sosial)', 
    'Pendidikan Jasmani Olahraga dan Kesehatan (PJOK)', 'Seni Rupa', 'Bahasa Inggris', 'Bahasa Daerah'
  ];

  useEffect(() => {
    if (user) {
      loadSourceData();
      loadSavedModules();
    }
  }, [user]);

  const loadSourceData = async () => {
    if (!user) return;
    try {
      const qTP = query(collection(db, 'learning_goals'), where('user_id', '==', user.uid));
      const snapTP = await getDocs(qTP);
      const tps: SavedTP[] = [];
      snapTP.forEach(d => tps.push({ id: d.id, ...d.data() } as SavedTP));
      setSavedTPs(tps);
    } catch (err) {
      console.error('Gagal memuat sumber data TP:', err);
    }
  };

  const loadSavedModules = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'learning_modules'), where('user_id', '==', user.uid));
      const snapshot = await getDocs(q);
      const mods: any[] = [];
      snapshot.forEach(d => mods.push({ id: d.id, ...d.data() }));
      mods.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSavedModules(mods);
    } catch (err) {
      console.error('Gagal memuat Modul Ajar:', err);
    }
  };

  // Filter TP berdasarkan Mata Pelajaran yang dipilih di dropdown form
  const filteredTPs = savedTPs.filter(tp => 
    !mataPelajaran || tp.subject?.toLowerCase().trim() === mataPelajaran.toLowerCase().trim()
  );

  const toggleCheckboxTP = (id: string) => {
    setSelectedTPIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleDimensi = (key: keyof typeof dimensi) => {
    setDimensi(prev => ({ ...prev, [key]: !prev[key] }));
  };

const handleGenerate = async () => {
    if (selectedTPIds.length === 0) {
      toast.error('Pilih/centang minimal satu Tujuan Pembelajaran (TP) terlebih dahulu!');
      return;
    }
    if (!materiPokok.trim()) {
      toast.error('Materi pokok tidak boleh kosong!');
      return;
    }

    setLoading(true);
    setLoadingMessage('AI sedang menyusun Modul Ajar Kurikulum Merdeka (Deep Learning) sesuai prompt standar...');

    try {
      // 1. Kumpulkan semua TP yang dicentang
      const selectedTPTexts = filteredTPs
        .filter(tp => selectedTPIds.includes(tp.id))
        .map(tp => tp.tp)
        .join('; ');

      // 2. Kumpulkan Dimensi Profil Pelajar Pancasila yang diaktifkan (true)
      const selectedDimensiList = Object.entries(dimensi)
        .filter(([_, value]) => value)
        .map(([key, _]) => {
          const labelMap: Record<string, string> = {
            keimanan: 'Keimanan & Ketakwaan',
            kewargaan: 'Kewargaan',
            penalaranKritis: 'Penalaran Kritis',
            kreativitas: 'Kreativitas',
            kolaborasi: 'Kolaborasi',
            kemandirian: 'Kemandirian',
            kesehatan: 'Kesehatan',
            komunikasi: 'Komunikasi'
          };
          return labelMap[key];
        })
        .join(', ');

      // ====================================================================
      // 3. KONSTRUKSI PROMPT INDUK (Dikirimkan ke LLM/AI Engine Anda di backend)
      // ====================================================================
      const aiPrompt = `
      # PROMPT INDUK PEMBUATAN MODUL AJAR PEMBELAJARAN MENDALAM (DEEP LEARNING) 2026
      
      Bertindaklah sebagai ahli pengembangan kurikulum pendidikan Indonesia dan perancang pembelajaran.
      
      Gunakan data berikut sebagai dasar penyusunan modul:
      - Nama satuan pendidikan: ${namaSekolah}
      - Nama guru/penyusun: ${namaGuru}
      - NIP: ${nipGuru}
      - Mata pelajaran: ${mataPelajaran}
      - Fase: ${fase}
      - Kelas: ${kelas}
      - Semester: ${semester}
      - Tahun pelajaran: ${tahunPelajaran}
      - Materi pokok/bab: ${materiPokok}
      - Alokasi waktu: ${alokasiWaktu}
      - Model Pembelajaran: ${modelPembelajaran}
      - Tujuan Pembelajaran (TP) Acuan: ${selectedTPTexts}
      - Dimensi Profil Lulusan Prioritas: ${selectedDimensiList}
      
      Tugasmu adalah menyusun **Modul Ajar/Rencana Pembelajaran Mendalam** secara lengkap, akurat, kontekstual, berdiferensiasi, dan mengacu pada standar Kurikulum Merdeka (Deep Learning).

      Struktur Modul Ajar yang harus dihasilkan WAJIB mengikuti urutan berikut:
      A. IDENTITAS MODUL
      B. IDENTIFIKASI KESIAPAN PESERTA DIDIK
      C. KARAKTERISTIK MATERI PELAJARAN
      D. DIMENSI PROFIL LULUSAN
      E. DESAIN PEMBELAJARAN (Tujuan Pembelajaran, Praktik Pedagogik, Pendekatan Deep Learning)
      F. LANGKAH-LANGKAH PEMBELAJARAN BERDIFERENSIASI (Pendahuluan, Inti, Penutup)
      G. ASESMEN PEMBELAJARAN (Diagnostik, Formatif, Sumatif)
      
      Pastikan prinsip Mindful, Meaningful, dan Joyful Learning terlihat jelas pada langkah-langkah pembelajaran.
      `;

      // 4. Simulasi proses AI/LLM berjalan (Di sinilah seharusnya fetch ke API AI Anda)
      // await fetch('/api/generate-modul', { method: 'POST', body: JSON.stringify({ prompt: aiPrompt }) });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 5. Data Struktur Hasil dari AI (Digunakan untuk Preview dan Cetak Word)
      const modulData = {
        title: `Modul Ajar ${mataPelajaran} - ${materiPokok}`,
        school: namaSekolah,
        headmaster: namaKepalaSekolah,
        headmasterNip: nipKepalaSekolah,
        teacher: namaGuru,
        teacherNip: nipGuru,
        subject: mataPelajaran,
        grade: kelas,
        fase: fase,
        semester: semester,
        academicYear: tahunPelajaran,
        alokasi: alokasiWaktu,
        city: kota,
        date: tanggalPembuatan,
        materi: materiPokok,
        model: modelPembelajaran,
        tujuan: selectedTPTexts,
        dimensi: dimensi, // State boolean asli disimpan
        dimensiList: selectedDimensiList, // Teks list hasil filter
        created_at: Timestamp.now().toDate().toISOString()
      };

      setGeneratedModul(modulData);
      toast.success('Modul Ajar Deep Learning berhasil digenerate berdasarkan Parameter Form!');
    } catch (err: any) {
      toast.error('Gagal generate: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSaveModule = async () => {
    if (!user || !generatedModul) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'learning_modules'), {
        user_id: user.uid,
        ...generatedModul
      });
      toast.success('Modul Ajar berhasil disimpan!');
      loadSavedModules();
      setActiveTab('tersimpan');
    } catch (err: any) {
      toast.error('Gagal menyimpan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportWord = (modul: any) => {
    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${modul.title}</title>
      <style>
        body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; margin: 2cm; }
        h1 { text-align: center; font-size: 14pt; font-weight: bold; }
        h2 { font-size: 12pt; text-transform: uppercase; margin-top: 20px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        td { padding: 4px; vertical-align: top; }
        ul { margin-top: 0; padding-left: 20px; }
      </style>
      </head>
      <body>
        <h1 style="margin-top: 40px;">MODUL AJAR<br/>KURIKULUM MERDEKA (Deep Learning)</h1>
        <br/><br/>
        <table>
          <tr><td width="30%">Nama Sekolah</td><td>: ${modul.school}</td></tr>
          <tr><td>Nama Penyusun</td><td>: ${modul.teacher}</td></tr>
          <tr><td>NIP</td><td>: ${modul.teacherNip}</td></tr>
          <tr><td>Mata pelajaran</td><td>: ${modul.subject}</td></tr>
          <tr><td>Fase, Kelas / Semester</td><td>: Fase ${modul.fase}, Kelas ${modul.grade} / ${modul.semester}</td></tr>
        </table>
        
        <div style="page-break-before: always;"></div>

        <h2 style="text-align: center;">MODUL AJAR DEEP LEARNING<br/>MATA PELAJARAN : ${modul.subject.toUpperCase()}<br/>BAB : ${modul.materi.toUpperCase()}</h2>

        <h2>A. IDENTITAS MODUL</h2>
        <table>
          <tr><td width="30%">Nama Sekolah</td><td>: ${modul.school}</td></tr>
          <tr><td>Nama Penyusun</td><td>: ${modul.teacher}</td></tr>
          <tr><td>Mata Pelajaran</td><td>: ${modul.subject}</td></tr>
          <tr><td>Kelas / Fase / Semester</td><td>: ${modul.grade} / ${modul.fase} / ${modul.semester}</td></tr>
          <tr><td>Alokasi Waktu</td><td>: ${modul.alokasi}</td></tr>
          <tr><td>Tahun Pelajaran</td><td>: ${modul.academicYear}</td></tr>
        </table>

        <h2>B. IDENTIFIKASI KESIAPAN PESERTA DIDIK</h2>
        <p><b>Pengetahuan Awal :</b> Peserta didik umumnya sudah mampu memahami konsep dasar terkait secara lisan dan mengenali materi.</p>
        <p><b>Minat :</b> Peserta didik memiliki minat yang tinggi terhadap kegiatan belajar yang melibatkan permainan, lagu, gambar berwarna, dan benda-benda konkret.</p>
        <p><b>Kebutuhan Belajar :</b></p>
        <ul>
          <li>Visual: Membutuhkan media gambar, video pembelajaran, dan peragaan langsung.</li>
          <li>Auditori: Merespon baik terhadap penjelasan lisan, cerita, dan diskusi kelompok.</li>
          <li>Kinestetik: Perlu terlibat aktif dalam kegiatan fisik.</li>
        </ul>

        <h2>C. KARAKTERISTIK MATERI PELAJARAN</h2>
        <p><b>Jenis Pengetahuan yang Akan Dicapai:</b> Konseptual dan Prosedural dalam memahami materi ${modul.materi}.</p>
        <p><b>Relevansi dengan Kehidupan Nyata:</b> Sangat relevan dan sering digunakan dalam aktivitas sehari-hari.</p>
        <p><b>Integrasi Nilai dan Karakter:</b> Menanamkan nilai ketelitian, kejujuran saat bermain, kerja sama dalam kelompok, dan rasa syukur.</p>

        <h2>D. DIMENSI PROFIL LULUSAN</h2>
        <ul>
          ${modul.dimensi.keimanan ? '<li>Keimanan dan Ketakwaan terhadap Tuhan Yang Maha Esa, dan Berakhlak Mulia.</li>' : ''}
          ${modul.dimensi.kewargaan ? '<li>Kewargaan: Belajar antre dan mengikuti aturan.</li>' : ''}
          ${modul.dimensi.penalaranKritis ? '<li>Penalaran Kritis: Mengidentifikasi dan memecahkan masalah.</li>' : ''}
          ${modul.dimensi.kreativitas ? '<li>Kreativitas: Menghasilkan karya (produk).</li>' : ''}
          ${modul.dimensi.kolaborasi ? '<li>Kolaborasi: Bekerja sama dalam kelompok.</li>' : ''}
          ${modul.dimensi.kemandirian ? '<li>Kemandirian: Mengerjakan latihan secara mandiri.</li>' : ''}
          ${modul.dimensi.kesehatan ? '<li>Kesehatan: Menjaga kebersihan diri dan lingkungan.</li>' : ''}
          ${modul.dimensi.komunikasi ? '<li>Komunikasi: Mampu menyampaikan pendapat dengan tepat.</li>' : ''}
        </ul>

        <div style="page-break-before: always;"></div>

        <h2 style="text-align: center;">DESAIN PEMBELAJARAN</h2>

        <h2>A. TUJUAN PEMBELAJARAN</h2>
        <p>${modul.tujuan.replace(/\n/g, '<br/>')}</p>

        <h2>B. KERANGKA PEMBELAJARAN (PRAKTIK PEDAGOGIK)</h2>
        <p><b>Model Pembelajaran:</b> ${modul.model}</p>
        <p><b>Pendekatan:</b> Deep Learning</p>
        <ul>
          <li><b>Mindful Learning:</b> Peserta didik diajak untuk fokus dan menyadari proses belajar dengan cermat.</li>
          <li><b>Meaningful Learning:</b> Peserta didik menghubungkan konsep dengan kehidupan nyata.</li>
          <li><b>Joyful Learning:</b> Pembelajaran dikemas melalui permainan dan aktivitas menyenangkan.</li>
        </ul>

        <h2>C. LANGKAH-LANGKAH PEMBELAJARAN BERDIFERENSIASI</h2>
        <p><b>KEGIATAN PENDAHULUAN (10 MENIT)</b><br/>
        Guru menyapa, mengajak berdoa, dan melakukan apersepsi (Joyful & Meaningful Learning) dengan mengaitkan materi ${modul.materi}.</p>
        
        <p><b>KEGIATAN INTI (50 MENIT)</b><br/>
        Eksplorasi mendalam secara Mindful. Peserta didik berdiskusi dan berlatih secara berkelompok. Guru melakukan Diferensiasi Proses (mendampingi yang kesulitan) dan Diferensiasi Produk (hasil karya).</p>

        <p><b>KEGIATAN PENUTUP (10 MENIT)</b><br/>
        Refleksi pembelajaran, merangkum materi, dan menutup kegiatan dengan doa.</p>

        <h2>D. ASESMEN PEMBELAJARAN</h2>
        <p><b>Asesmen Diagnostik:</b> Tanya jawab awal.</p>
        <p><b>Asesmen Formatif:</b> Observasi keaktifan diskusi kelompok dan LKPD.</p>
        <p><b>Asesmen Sumatif:</b> Praktik kinerja dan Tes Tertulis (soal isian & pilihan ganda).</p>

        <br/><br/><br/>
        <table style="width: 100%; border: none;">
          <tr>
            <td style="width: 50%; text-align: center; border: none;">
              Mengetahui,<br/>Kepala Sekolah<br/><br/><br/><br/>
              <b>${modul.headmaster}</b><br/>
              NIP. ${modul.headmasterNip}
            </td>
            <td style="width: 50%; text-align: center; border: none;">
              ${modul.city}, ${modul.date}<br/>Guru Mata Pelajaran<br/><br/><br/><br/>
              <b>${modul.teacher}</b><br/>
              NIP. ${modul.teacherNip}
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${modul.title.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Dokumen Word Modul Ajar Deep Learning berhasil diunduh!');
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm('Hapus Modul Ajar ini?')) return;
    try {
      await deleteDoc(doc(db, 'learning_modules', id));
      setSavedModules(savedModules.filter(m => m.id !== id));
      toast.success('Berhasil dihapus');
    } catch (err) {
      toast.error('Gagal menghapus');
    }
  };

  const filteredModules = savedModules.filter(mod => {
    const matchKey = mod.title?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                     mod.subject?.toLowerCase().includes(searchKeyword.toLowerCase());
    const matchSub = tabFilterSubject === 'Semua' || mod.subject === tabFilterSubject;
    return matchKey && matchSub;
  });

  return (
    <div className="w-full space-y-8 py-4 px-2 max-w-[1600px] mx-auto font-sans">
      
      {/* HEADER UTAMA */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white p-6 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.04)]"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700">
              <FileText className="h-4 w-4" />
              Generator Modul Ajar Workspace
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Generator <span className="text-indigo-600">Modul Ajar Deep Learning</span>
            </h1>
          </div>

          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('generator')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'generator' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Buat RPP
            </button>
            <button
              onClick={() => setActiveTab('tersimpan')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'tersimpan' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Modul Tersimpan ({savedModules.length})
            </button>
          </div>
        </div>
      </motion.section>

      {/* TAB GENERATOR */}
      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* KOLOM KIRI: FORMULIR INPUT PERSIS GAMBAR UI */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              
              {/* 1. INFORMASI UMUM */}
              <div>
                <h3 className="text-[11px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">1</span> 
                  INFORMASI UMUM
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">JENIS KURIKULUM</label>
                    <button className="w-full py-2.5 px-3 rounded-lg text-xs font-bold border border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm">
                      Kurikulum Merdeka (Deep Learning)
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">NAMA SEKOLAH</label>
                    <input
                      type="text"
                      value={namaSekolah}
                      onChange={(e) => setNamaSekolah(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">NAMA KEPALA SEKOLAH</label>
                      <input
                        type="text"
                        value={namaKepalaSekolah}
                        onChange={(e) => setNamaKepalaSekolah(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">NIP KEPALA SEKOLAH</label>
                      <input
                        type="text"
                        value={nipKepalaSekolah}
                        onChange={(e) => setNipKepalaSekolah(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
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
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">NIP GURU</label>
                      <input
                        type="text"
                        value={nipGuru}
                        onChange={(e) => setNipGuru(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">MATA PELAJARAN</label>
                    <select
                      value={mataPelajaran}
                      onChange={(e) => {
                        setMataPelajaran(e.target.value);
                        setSelectedTPIds([]); 
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 font-bold outline-none"
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
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">FASE</label>
                      <input
                        type="text"
                        value={fase}
                        onChange={(e) => setFase(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">SEMESTER</label>
                      <input
                        type="text"
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">TAHUN PELAJARAN</label>
                      <input
                        type="text"
                        value={tahunPelajaran}
                        onChange={(e) => setTahunPelajaran(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">ALOKASI WAKTU</label>
                    <input
                      type="text"
                      value={alokasiWaktu}
                      onChange={(e) => setAlokasiWaktu(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">KOTA</label>
                      <input
                        type="text"
                        value={kota}
                        onChange={(e) => setKota(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">TANGGAL PEMBUATAN</label>
                      <input
                        type="text"
                        value={tanggalPembuatan}
                        onChange={(e) => setTanggalPembuatan(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. DETAIL RPP */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-[11px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">2</span> 
                  DETAIL RPP
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">MATERI POKOK</label>
                    <input
                      type="text"
                      value={materiPokok}
                      onChange={(e) => setMateriPokok(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">MODEL PEMBELAJARAN</label>
                    <select
                      value={modelPembelajaran}
                      onChange={(e) => setModelPembelajaran(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    >
                      <option value="Problem Based Learning">Problem Based Learning</option>
                      <option value="Project Based Learning">Project Based Learning</option>
                      <option value="Discovery Learning">Discovery Learning</option>
                    </select>
                  </div>

                  {/* KONEKSI TP TERSIMPAN (Sesuai Mapel Terpilih) */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-bold text-slate-700">PILIH TUJUAN PEMBELAJARAN (TP) DARI BANK DATA</label>
                      <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">{filteredTPs.length} TP Tersedia</span>
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                      {filteredTPs.length === 0 ? (
                        <p className="text-[10px] text-red-500 italic">Belum ada TP tersimpan untuk mapel {mataPelajaran}.</p>
                      ) : (
                        filteredTPs.map(tp => (
                          <label key={tp.id} className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedTPIds.includes(tp.id)}
                              onChange={() => toggleCheckboxTP(tp.id)}
                              className="mt-0.5 text-indigo-600 rounded"
                            />
                            <span className="text-[11px] text-slate-700 leading-tight">
                              <b>{tp.chapter}</b>: {tp.tp}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* DIMENSI PROFIL LULUSAN */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-2">DIMENSI PROFIL LULUSAN</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { key: 'keimanan', label: 'Keimanan & Ketakwaan' },
                        { key: 'kewargaan', label: 'Kewargaan' },
                        { key: 'penalaranKritis', label: 'Penalaran Kritis' },
                        { key: 'kreativitas', label: 'Kreativitas' },
                        { key: 'kolaborasi', label: 'Kolaborasi' },
                        { key: 'kemandirian', label: 'Kemandirian' },
                        { key: 'kesehatan', label: 'Kesehatan' },
                        { key: 'komunikasi', label: 'Komunikasi' },
                      ].map(item => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleDimensi(item.key as any)}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border text-left transition-all ${
                            dimensi[item.key as keyof typeof dimensi]
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-200 bg-white text-slate-500'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 mt-4"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Buat Modul Ajar Deep Learning
              </Button>

            </div>
          </div>

          {/* KOLOM KANAN: PREVIEW HASIL */}
          <div className="lg:col-span-8">
            {loading ? (
              <div className="rounded-[30px] border border-dashed border-slate-300 bg-slate-50 p-16 text-center flex flex-col items-center justify-center min-h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                <p className="text-sm font-bold text-slate-700">{loadingMessage}</p>
              </div>
            ) : generatedModul ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm space-y-6 relative"
              >
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase">PREVIEW MODUL AJAR (DEEP LEARNING)</h2>
                    <p className="text-xs text-slate-500">{generatedModul.subject} &middot; Kelas {generatedModul.grade} &middot; {generatedModul.materi}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleExportWord(generatedModul)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-9 px-3 text-xs font-bold">
                      <Download className="w-4 h-4 mr-1.5" /> Word (.doc)
                    </Button>
                    <Button onClick={handleSaveModule} className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-9 px-3 text-xs font-bold">
                      Simpan
                    </Button>
                  </div>
                </div>

                <div className="space-y-5 text-sm text-slate-800 font-serif leading-relaxed">
                  
                  {/* PREVIEW KONTEN SESUAI CONTOH */}
                  <div className="text-center pb-4 border-b border-slate-300">
                    <h3 className="font-bold text-base uppercase">MODUL AJAR KURIKULUM MERDEKA (DEEP LEARNING)</h3>
                    <p className="font-bold text-sm uppercase mt-2">Mata Pelajaran: {generatedModul.subject}</p>
                    <p className="font-bold text-sm uppercase">BAB: {generatedModul.materi}</p>
                  </div>

                  <div>
                    <h4 className="font-bold bg-slate-100 px-2 py-1 mb-2 border-l-4 border-slate-800 uppercase">A. Identitas Modul</h4>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr><td className="w-48 py-1">Nama Sekolah</td><td>: {generatedModul.school}</td></tr>
                        <tr><td className="py-1">Nama Penyusun</td><td>: {generatedModul.teacher}</td></tr>
                        <tr><td className="py-1">Kelas / Fase / Semester</td><td>: {generatedModul.grade} / {generatedModul.fase} / {generatedModul.semester}</td></tr>
                        <tr><td className="py-1">Alokasi Waktu</td><td>: {generatedModul.alokasi}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h4 className="font-bold bg-slate-100 px-2 py-1 mb-2 border-l-4 border-slate-800 uppercase">B. Identifikasi Kesiapan Peserta Didik</h4>
                    <p><b>Pengetahuan Awal:</b> Peserta didik sudah mampu memahami dasar konsep {generatedModul.subject} secara sederhana.</p>
                    <p><b>Minat:</b> Peserta didik tertarik pada pembelajaran interaktif (permainan, lagu, dan benda konkret).</p>
                    <p><b>Kebutuhan Belajar:</b> Memerlukan diferensiasi visual (gambar), auditori (diskusi), dan kinestetik (gerakan/praktik).</p>
                  </div>

                  <div>
                    <h4 className="font-bold bg-slate-100 px-2 py-1 mb-2 border-l-4 border-slate-800 uppercase">C. Karakteristik Materi Pelajaran</h4>
                    <p><b>Konseptual & Prosedural:</b> Memahami konsep dan mampu mempraktekkan pemecahan masalah terkait {generatedModul.materi}.</p>
                    <p><b>Integrasi Nilai:</b> Menanamkan ketelitian, kejujuran, kerja sama kelompok, dan kemandirian.</p>
                  </div>

                  <div>
                    <h4 className="font-bold bg-slate-100 px-2 py-1 mb-2 border-l-4 border-slate-800 uppercase">D. Desain Pembelajaran</h4>
                    <p><b>Tujuan Pembelajaran:</b><br/>
                      <span className="whitespace-pre-line ml-4">{generatedModul.tujuan}</span>
                    </p>
                    <p className="mt-2"><b>Kerangka Pedagogik:</b> Model {generatedModul.model} dengan pendekatan <i>Deep Learning (Mindful, Meaningful, Joyful Learning)</i>.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-bold bg-slate-100 px-2 py-1 mb-2 border-l-4 border-slate-800 uppercase">E. Asesmen Pembelajaran</h4>
                    <p><b>Asesmen Diagnostik:</b> Tanya jawab lisan awal kelas.<br/>
                    <b>Asesmen Formatif:</b> Observasi selama proses belajar (diskusi/LKPD).<br/>
                    <b>Asesmen Sumatif:</b> Praktik kinerja atau tes tertulis (pilihan ganda/isian) di akhir materi.</p>
                  </div>

                </div>
              </motion.div>
            ) : (
              <div className="rounded-[30px] border border-dashed border-slate-300 bg-slate-50 p-16 text-center flex flex-col items-center justify-center min-h-[500px]">
                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-800">RPP belum dibuat.</h3>
                <p className="text-xs text-slate-500 mt-1">Isi formulir di sebelah kiri, centang TP, dan klik "Buat Modul Ajar Deep Learning".</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB TERSIMPAN */}
      {activeTab === 'tersimpan' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari judul materi pokok..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              />
            </div>
          </div>

          {filteredModules.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Tidak ada Modul Ajar tersimpan</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredModules.map(mod => (
                <div key={mod.id} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                        {mod.subject}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleExportWord(mod)} className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50" title="Download Word"><Download className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteModule(mod.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <h3 className="font-black text-slate-900 text-lg">{mod.materi}</h3>
                    <p className="text-xs text-slate-500">Penyusun: {mod.teacher} | {mod.model}</p>
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