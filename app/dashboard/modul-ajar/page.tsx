'use client';
import { generateModulAjarAction } from './actions';
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

  // 1. HANDLE GENERATE DENGAN PROMPT INDUK
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
    setLoadingMessage('AI sedang menyusun Modul Ajar Pembelajaran Mendalam (Deep Learning)...');

    try {
      const selectedTPTexts = filteredTPs
        .filter(tp => selectedTPIds.includes(tp.id))
        .map(tp => `- ${tp.tp}`)
        .join('\n');

      const selectedDimensiList = Object.entries(dimensi)
        .filter(([_, value]) => value)
        .map(([key, _]) => key)
        .join(', ');

      // PROMPT INDUK PEMBUATAN MODUL AJAR PEMBELAJARAN MENDALAM (DEEP LEARNING)
      const aiPrompt = `
Bertindaklah sebagai ahli pengembangan kurikulum pendidikan Indonesia, perancang pembelajaran, praktisi Pembelajaran Mendalam (Deep Learning), ahli asesmen pendidikan, dan penyusun perangkat ajar profesional.

Tugasmu adalah menyusun **Modul Ajar/Rencana Pembelajaran Mendalam yang lengkap, akurat, kontekstual, berdiferensiasi, sesuai regulasi yang berlaku pada tahun 2026, dan siap digunakan guru dalam pembelajaran nyata**.

Gunakan data berikut sebagai dasar penyusunan modul:
- Nama satuan pendidikan: ${namaSekolah}
- Nama guru/penyusun: ${namaGuru}
- NIP/NUPTK: ${nipGuru || '[PERLU DIISI GURU]'}
- Jenjang pendidikan: SD
- Mata pelajaran: ${mataPelajaran}
- Fase: ${fase}
- Kelas: ${kelas}
- Semester: ${semester}
- Tahun pelajaran: ${tahunPelajaran}
- Materi pokok/bab: ${materiPokok}
- Alokasi waktu: ${alokasiWaktu}
- Model Pembelajaran: ${modelPembelajaran}
- Tujuan Pembelajaran (TP): 
${selectedTPTexts}
- Dimensi Profil Lulusan: ${selectedDimensiList}

Susunlah modul ajar secara lengkap mencakup:
1. Hasil Verifikasi Acuan dan Regulasi
2. Identitas Modul
3. Identifikasi Kesiapan Peserta Didik
4. Karakteristik Materi
5. Dimensi Profil Lulusan
6. Desain Pembelajaran Mendalam (Mindful, Meaningful, Joyful)
7. Matriks Keterlacakan CP–TP–Asesmen
8. Rencana Pembelajaran per Pertemuan (Lengkap dengan Tabel Tahap, Aktivitas Guru, Siswa, dan Asesmen)
9. Diferensiasi dan Dukungan Inklusif
10. Asesmen Diagnostik, Formatif, dan Sumatif
11. Kisi-kisi, Kunci Jawaban, dan Rubrik
12. LKPD Siap Cetak
13. Bahan Ajar dan Media
14. Refleksi dan Tindak Lanjut
15. Lampiran dan Daftar Pustaka
16. Daftar Periksa Kualitas Modul

Gunakan bahasa Indonesia baku, terstruktur rapi dengan markdown, dan uraian yang mendalam agar langsung dapat diterapkan.
      `;

      const result = await generateModulAjarAction(aiPrompt);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Server AI tidak memberikan respons.');
      }

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
        dimensi: dimensi,
        konten_ai: result.data, // Menyimpan teks utuh hasil Prompt Induk AI
        created_at: new Date().toISOString()
      };

      setGeneratedModul(modulData);
      toast.success('Modul Ajar Deep Learning berhasil dibuat!');
    } catch (err: any) {
      toast.error('Gagal generate: ' + err.message);
      console.error("AI Generation Error:", err);
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

  // 2. HANDLE EXPORT WORD MERENDER MODUL.KONTEN_AI SECARA DINAMIS
  const handleExportWord = (modul: any) => {
    if (!modul || !modul.konten_ai) {
      toast.error('Konten modul kosong.');
      return;
    }

    const contentLines = modul.konten_ai.split('\n');
    let dynamicHtmlBody = '';

    contentLines.forEach((line: string) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        dynamicHtmlBody += `<h1>${trimmed.replace('# ', '')}</h1>`;
      } else if (trimmed.startsWith('## ')) {
        dynamicHtmlBody += `<h2>${trimmed.replace('## ', '')}</h2>`;
      } else if (trimmed.startsWith('### ')) {
        dynamicHtmlBody += `<h3>${trimmed.replace('### ', '')}</h3>`;
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        dynamicHtmlBody += `<ul><li>${trimmed.substring(2)}</li></ul>`;
      } else if (trimmed.length > 0) {
        dynamicHtmlBody += `<p>${trimmed}</p>`;
      }
    });

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${modul.title}</title>
      <style>
        body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; margin: 2cm; color: #000; }
        h1 { text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 20px; }
        h2 { font-size: 13pt; font-weight: bold; margin-top: 25px; border-bottom: 1px solid #000; padding-bottom: 3px; }
        h3 { font-size: 12pt; font-weight: bold; margin-top: 15px; }
        p { margin-bottom: 10px; text-align: justify; }
        ul, ol { margin-top: 5px; margin-bottom: 10px; padding-left: 20px; }
        li { margin-bottom: 4px; }
      </style>
      </head>
      <body>
        <h1>MODUL AJAR KURIKULUM MERDEKA<br/>(PEMBELAJARAN MENDALAM / DEEP LEARNING)</h1>
        <p style="text-align: center; font-weight: bold;">Mata Pelajaran: ${modul.subject} | Kelas: ${modul.grade} (${modul.school})</p>
        <hr style="margin-bottom: 30px;" />
        
        ${dynamicHtmlBody}

        <br/><br/><br/>
        <table style="width: 100%; border: none; margin-top: 40px;">
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
          
          {/* KOLOM KIRI: FORMULIR INPUT */}
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

                  {/* KONEKSI TP TERSIMPAN */}
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

                <div className="space-y-4 text-sm text-slate-800 font-serif leading-relaxed whitespace-pre-wrap">
                  {generatedModul.konten_ai}
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
                    <p className="text-xs text-slate-500">Penyusun: {mod.teacher} | Model: {mod.model}</p>
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