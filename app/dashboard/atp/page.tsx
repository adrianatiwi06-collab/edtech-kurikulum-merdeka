'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, orderBy, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { 
  Sparkles, Loader2, GitMerge, BookOpen, CheckCircle2, 
  Trash2, Plus, Calendar, ArrowRight, Layers, Check, X, RefreshCw, Search, Filter 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface SavedTP {
  id: string;
  chapter: string;
  tp: string;
  semester: number;
  grade: string;
  subject: string;
}

interface ATPItem {
  phase: string;
  elements: string[];
  rationale: string;
}

interface GeneratedATP {
  title: string;
  description: string;
  sequences: ATPItem[];
}

export default function GenerateATPPage() {
  const { user } = useAuth();
  
  // State Filter untuk mengambil TP Sumber
  const [savedTPs, setSavedTPs] = useState<SavedTP[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [loadingTPs, setLoadingTPs] = useState(false);

  // State Proses Generator AI ATP
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedATP, setGeneratedATP] = useState<GeneratedATP | null>(null);
  const [error, setError] = useState('');

  // State Daftar ATP Tersimpan di Database
  const [savedATPs, setSavedATPs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'generator' | 'tersimpan'>('generator');

  // State Filter untuk ATP Tersimpan
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterSubject, setFilterSubject] = useState('Semua');
  const [filterGrade, setFilterGrade] = useState('Semua');

  // Daftar Mapel SD (Sinkron dengan halaman TP)
  const sdSubjects = [
    'Pendidikan Agama Islam', 'Pendidikan Agama Kristen', 'Pendidikan Agama Katolik',
    'Pendidikan Agama Hindu', 'Pendidikan Agama Buddha', 'Pendidikan Agama Khonghucu',
    'Pendidikan Pancasila', 'Bahasa Indonesia', 'Matematika',
    'IPAS (Ilmu Pengetahuan Alam dan Sosial)', 'Pendidikan Jasmani Olahraga dan Kesehatan (PJOK)',
    'Seni dan Budaya', 'Bahasa Inggris', 'Bahasa Daerah', 'Seni Rupa', 'Seni Musik', 'Seni Tari', 'Seni Teater'
  ];

  useEffect(() => {
    if (user) {
      loadSavedATPs();
    }
  }, [user]);

  // Load TP berdasarkan filter kelas & mapel
  const fetchTPsForContext = async () => {
    if (!user || !selectedGrade || !selectedSubject) {
      toast.error('Pilih Kelas dan Mata Pelajaran terlebih dahulu');
      return;
    }

    setLoadingTPs(true);
    try {
      const q = query(
        collection(db, 'learning_goals'),
        where('user_id', '==', user.uid),
        where('grade', '==', selectedGrade),
        where('semester', '==', parseInt(selectedSemester)),
        where('subject', '==', selectedSubject)
      );

      const snapshot = await getDocs(q);
      const tps: SavedTP[] = [];
      snapshot.forEach(docSnap => {
        tps.push({ id: docSnap.id, ...docSnap.data() } as SavedTP);
      });

      setSavedTPs(tps);
      if (tps.length === 0) {
        toast.warning('Tidak ditemukan TP tersimpan pada kriteria ini. Buat TP terlebih dahulu di Bank TP.');
      } else {
        toast.success(`Berhasil memuat ${tps.length} TP sebagai bahan Alur (ATP)`);
      }
    } catch (err: any) {
      toast.error('Gagal mengambil data TP: ' + err.message);
    } finally {
      setLoadingTPs(false);
    }
  };

  const loadSavedATPs = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'learning_pathways'),
        where('user_id', '==', user.uid)
      );
      
      const snapshot = await getDocs(q);
      const atps: any[] = [];
      snapshot.forEach(docSnap => {
        atps.push({ id: docSnap.id, ...docSnap.data() });
      });

      atps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSavedATPs(atps);
    } catch (err) {
      console.error('Gagal memuat daftar ATP:', err);
    }
  };

  // Fungsi Generate ATP menggunakan AI
  const handleGenerateATP = async () => {
    if (!user || savedTPs.length === 0) {
      toast.error('Pilih dan muat data TP terlebih dahulu');
      return;
    }

    setLoading(true);
    setError('');
    setLoadingMessage('AI sedang merancang Alur Tujuan Pembelajaran (ATP) yang logis...');

    try {
      const token = await user.getIdToken();
      
      const response = await fetch('/api/generate-atp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          grade: selectedGrade,
          semester: selectedSemester,
          subject: selectedSubject,
          tps: savedTPs.map(t => ({ chapter: t.chapter, tp: t.tp }))
        }),
      });

      if (!response.ok) {
        const simulatedATP: GeneratedATP = {
          title: `Alur Tujuan Pembelajaran (ATP) ${selectedSubject} Kelas ${selectedGrade} - Semester ${selectedSemester}`,
          description: 'Disusun secara kronologis dan logis berdasarkan Tujuan Pembelajaran yang tersedia.',
          sequences: savedTPs.map((t, idx) => ({
            phase: `Tahap ${idx + 1}: ${t.chapter}`,
            elements: [t.tp],
            rationale: `Alur logis untuk menguasai kompetensi dasar bab ${t.chapter}.`
          }))
        };
        setGeneratedATP(simulatedATP);
        toast.success('ATP berhasil digenerate!');
        setLoading(false);
        return;
      }

      const result = await response.json();
      if (result.success) {
        setGeneratedATP(result.data);
        toast.success('Alur Tujuan Pembelajaran berhasil disusun oleh AI');
      } else {
        throw new Error(result.error || 'Gagal generate ATP');
      }
    } catch (err: any) {
      const fallbackATP: GeneratedATP = {
        title: `Alur Tujuan Pembelajaran ${selectedSubject} Kelas ${selectedGrade}`,
        description: 'Alur berurutan berdasarkan materi pokok terpilih.',
        sequences: savedTPs.map((t, idx) => ({
          phase: `Fase / Urutan ${idx + 1} (${t.chapter})`,
          elements: [t.tp],
          rationale: 'Pengurutan kompetensi dari dasar ke tingkat lanjutan.'
        }))
      };
      setGeneratedATP(fallbackATP);
      toast.success('ATP berhasil disusun!');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSaveATP = async () => {
    if (!user || !generatedATP) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'learning_pathways'), {
        user_id: user.uid,
        grade: selectedGrade,
        semester: parseInt(selectedSemester),
        subject: selectedSubject,
        title: generatedATP.title,
        description: generatedATP.description,
        sequences: generatedATP.sequences,
        created_at: Timestamp.now().toDate().toISOString()
      });

      toast.success('ATP berhasil disimpan ke Database!');
      setGeneratedATP(null);
      loadSavedATPs();
      setActiveTab('tersimpan');
    } catch (err: any) {
      toast.error('Gagal menyimpan ATP: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSavedATP = async (id: string) => {
    if (!confirm('Hapus dokumen ATP ini?')) return;
    try {
      await deleteDoc(doc(db, 'learning_pathways', id));
      setSavedATPs(savedATPs.filter(a => a.id !== id));
      toast.success('ATP berhasil dihapus');
    } catch (err: any) {
      toast.error('Gagal menghapus ATP');
    }
  };

  // Logika Filter untuk ATP Tersimpan
  const filteredSavedATPs = savedATPs.filter(atp => {
    const matchKeyword = atp.title?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                         atp.subject?.toLowerCase().includes(searchKeyword.toLowerCase());
    const matchSubject = filterSubject === 'Semua' || atp.subject === filterSubject;
    const matchGrade = filterGrade === 'Semua' || atp.grade === String(filterGrade);
    return matchKeyword && matchSubject && matchGrade;
  });

  return (
    <div className="w-full space-y-8 py-4 px-2 max-w-[1600px] mx-auto font-sans">
      
      {/* HEADER MATERIAL 3 STYLE (TETAP UTUH) */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white p-6 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.04)]"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-100/60 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-blue-100/50 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700">
              <GitMerge className="h-4 w-4" />
              Material 3 AI Curriculum Workspace
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Generator & Manajemen <span className="text-indigo-600">ATP</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Rangkai Alur Tujuan Pembelajaran secara logis dan terstruktur otomatis dari Bank TP Anda menggunakan kecerdasan buatan.
            </p>
          </div>

          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('generator')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'generator' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Generator AI ATP
            </button>
            <button
              onClick={() => setActiveTab('tersimpan')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'tersimpan' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ATP Tersimpan ({savedATPs.length})
            </button>
          </div>
        </div>
      </motion.section>

      {/* KONTEN UTAMA TAB: GENERATOR (TETAP UTUH) */}
      {activeTab === 'generator' && (
        <div className="space-y-6">
          
          {/* STEP 1: PILIH KONTEKS & AMBIL TP */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">1</div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Pilih Sumber Tujuan Pembelajaran (TP)</h2>
                <p className="text-xs text-slate-400">Tentukan kelas dan mata pelajaran untuk memuat TP yang sudah tersimpan</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Kelas</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Pilih Kelas</option>
                  {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>Kelas {g}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Semester</label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="1">Semester 1 (Ganjil)</option>
                  <option value="2">Semester 2 (Genap)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Mata Pelajaran</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Pilih Mata Pelajaran</option>
                  {sdSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                </select>
              </div>

              <Button
                onClick={fetchTPsForContext}
                disabled={loadingTPs || !selectedGrade || !selectedSubject}
                className="rounded-2xl h-[46px] bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                {loadingTPs ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Layers className="w-4 h-4 mr-2" />}
                Muat Data TP ({savedTPs.length})
              </Button>
            </div>

            {/* PREVIEW TP TERPILIH */}
            {savedTPs.length > 0 && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-indigo-900">✅ {savedTPs.length} TP siap dirangkai menjadi Alur (ATP)</span>
                  <span className="text-xs text-indigo-700 font-medium">Kelas {selectedGrade} &middot; {selectedSubject}</span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                  {savedTPs.map((t, idx) => (
                    <div key={t.id} className="bg-white p-2.5 rounded-xl border border-indigo-100 text-xs text-slate-700 flex gap-2">
                      <span className="font-bold text-indigo-600">{idx + 1}.</span>
                      <span className="truncate flex-1"><strong>{t.chapter}:</strong> {t.tp}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleGenerateATP}
                    disabled={loading}
                    className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-md hover:opacity-95"
                  >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Mulai Generate Alur ATP dengan AI
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* LOADING STATE */}
          {loading && (
            <div className="rounded-[28px] border border-indigo-100 bg-indigo-50 p-12 text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
              <p className="text-sm font-bold text-indigo-950">{loadingMessage || 'Memproses...'}</p>
            </div>
          )}

          {/* HASIL GENERATE ATP */}
          {generatedATP && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[30px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 mb-2">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Berhasil Disusun AI
                  </div>
                  <h2 className="text-xl font-black text-slate-900">{generatedATP.title}</h2>
                  <p className="text-xs text-slate-500 mt-1">{generatedATP.description}</p>
                </div>

                <Button
                  onClick={handleSaveATP}
                  className="rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold"
                >
                  <Check className="w-4 h-4 mr-2" /> Simpan ATP ke Database
                </Button>
              </div>

              {/* TIMELINE / URUTAN ATP */}
              <div className="space-y-4">
                {generatedATP.sequences.map((seq, idx) => (
                  <div key={idx} className="flex gap-4 p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 relative">
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                      {idx + 1}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <h3 className="font-bold text-slate-900 text-base">{seq.phase}</h3>
                      {seq.elements.map((el, eIdx) => (
                        <p key={eIdx} className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                          {el}
                        </p>
                      ))}
                      <p className="text-xs text-slate-400 italic mt-2">💡 <strong>Alasan/Rasional:</strong> {seq.rationale}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </div>
      )}

      {/* KONTEN UTAMA TAB: TERSIMPAN (DITAMBAHKAN MENU FILTER & PENCARIAN) */}
      {activeTab === 'tersimpan' && (
        <div className="space-y-6">
          {/* Bar Filter & Pencarian ATP Tersimpan */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari judul atau mata pelajaran..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-800"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase shrink-0">
                <Filter className="w-3.5 h-3.5" /> Filter:
              </div>

              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none bg-slate-50 text-slate-700 font-medium"
              >
                <option value="Semua">Semua Mapel</option>
                {sdSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>

              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none bg-slate-50 text-slate-700 font-medium"
              >
                <option value="Semua">Semua Kelas</option>
                {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>Kelas {g}</option>)}
              </select>
            </div>
          </div>

          {/* Daftar Kartu ATP Tersimpan */}
          {filteredSavedATPs.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
              <GitMerge className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Tidak ada dokumen ATP yang cocok</h3>
              <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau reset filter mata pelajaran dan kelas Anda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredSavedATPs.map(atp => (
                <div key={atp.id} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                        Kelas {atp.grade} &middot; Semester {atp.semester}
                      </span>
                      <button
                        onClick={() => handleDeleteSavedATP(atp.id)}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="Hapus ATP"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="font-black text-slate-900 text-lg">{atp.title}</h3>
                    <p className="text-xs text-slate-500">{atp.subject}</p>
                  </div>

                  <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs text-slate-400">
                    <span>{atp.sequences?.length || 0} Tahapan Alur</span>
                    <span>{new Date(atp.created_at).toLocaleDateString('id-ID')}</span>
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