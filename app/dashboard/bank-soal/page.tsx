'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
  addDoc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2,
  Download,
  FileText,
  Trash2,
  Eye,
  Pencil,
  Search,
  UploadCloud,
  Sparkles,
  BookOpen,
  ClipboardList,
  Clock3,
  Layers3,
  Filter,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Save,
  X,
  CheckCircle2,
  WandSparkles,
} from 'lucide-react';
import { Packer } from 'docx';
import {
  generateQuestionDocument,
  generateAnswerKeyDocument,
  QuestionData,
} from '@/lib/docx-utils';
import { toast } from 'sonner';
import { LoadingCard } from '@/components/ui/loading';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface BankSoalItem {
  id: string;
  user_id: string;
  subject: string;
  kelas: string;
  examTitle: string;
  duration: number;
  difficulty: string;
  optionsCount: number;
  questions: QuestionData;
  includeTP: boolean;
  includeImage?: boolean;
  created_at: string;
  tp_texts?: Array<{ id: string; tp: string; chapter: string }>;
}

const ITEMS_PER_PAGE = 10;

const sectionVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function BankSoalPage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();

  const [bankSoal, setBankSoal] = useState<BankSoalItem[]>([]);
  const [filteredSoal, setFilteredSoal] = useState<BankSoalItem[]>([]);
  const [masterTPs, setMasterTPs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedKelas, setSelectedKelas] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSoal, setSelectedSoal] = useState<BankSoalItem | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [availableKelas, setAvailableKelas] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showTPInDownload, setShowTPInDownload] = useState(true);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSoal, setEditSoal] = useState<BankSoalItem | null>(null);
  const [editMC, setEditMC] = useState<any[]>([]);
  const [editEssay, setEditEssay] = useState<any[]>([]);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [metaKelas, setMetaKelas] = useState('');
  const [metaSubject, setMetaSubject] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDuration, setMetaDuration] = useState(60);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDefaultTP, setUploadDefaultTP] = useState('');

  useEffect(() => {
    if (user) {
      loadBankSoal();
      loadMasterTPs();
    }
  }, [user]);

  useEffect(() => {
    const normalized = searchTerm.trim().toLowerCase();
    let filtered = bankSoal;

    if (selectedKelas) {
      filtered = filtered.filter((item) => String(item.kelas) === String(selectedKelas));
    }

    if (selectedSubject) {
      filtered = filtered.filter((item) => item.subject === selectedSubject);
    }

    if (normalized) {
      filtered = filtered.filter((item) => {
        const tpText = (item.tp_texts || []).map((tp) => tp.tp).join(' ').toLowerCase();
        const questionsText = [
          ...(item.questions.multipleChoice || []),
          ...(item.questions.essay || []),
        ]
          .map((q: any) => `${q.question || ''} ${q.relatedTP || q.tp || q.tp_text || ''}`)
          .join(' ')
          .toLowerCase();

        return (
          item.examTitle.toLowerCase().includes(normalized) ||
          item.subject.toLowerCase().includes(normalized) ||
          String(item.kelas).toLowerCase().includes(normalized) ||
          tpText.includes(normalized) ||
          questionsText.includes(normalized)
        );
      });
    }

    setFilteredSoal(filtered);
    setCurrentPage(1);
  }, [selectedKelas, selectedSubject, searchTerm, bankSoal]);

  const loadMasterTPs = async () => {
    if (!user) return;

    try {
      const q = query(
        collection(db, 'learning_goals'),
        where('user_id', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const tpData: any[] = [];
      snapshot.forEach((docSnap) => tpData.push({ id: docSnap.id, ...docSnap.data() }));
      setMasterTPs(tpData);
    } catch (e) {
      console.error('EROR MEMUAT DATABASE TP:', e);
    }
  };

  const loadBankSoal = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const q = query(
        collection(db, 'question_banks'),
        where('user_id', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const soal: BankSoalItem[] = [];
      const kelasSet = new Set<string>();
      const subjectSet = new Set<string>();

      querySnapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() } as BankSoalItem;
        soal.push(data);
        if (data.kelas) kelasSet.add(String(data.kelas));
        if (data.subject) subjectSet.add(data.subject);
      });

      soal.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setBankSoal(soal);
      setFilteredSoal(soal);
      setAvailableKelas(Array.from(kelasSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
      setAvailableSubjects(Array.from(subjectSet).sort());
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat Bank Soal');
    } finally {
      setLoading(false);
    }
  };

  const extractBab = (text: string) => {
    if (!text) return null;
    const match = text.toLowerCase().match(/bab\s*(\d+|[ivxlcdm]+)/);
    return match ? match[0] : null;
  };

  const getFilteredTPs = () => {
    const activeSubject = uploadModalOpen ? metaSubject : editSoal?.subject;
    const activeKelas = uploadModalOpen ? metaKelas : editSoal?.kelas;
    const activeTitle = uploadModalOpen ? metaTitle : editSoal?.examTitle;

    if (!activeSubject || !activeKelas) return [];

    const currentBab = extractBab(activeTitle || '');
    const extractedTPs: string[] = [];

    masterTPs.forEach((tpItem) => {
      const tpSubject = tpItem.subject || tpItem.mapel || tpItem.mata_pelajaran || '';
      const tpKelas = tpItem.grade || tpItem.kelas || tpItem.class || tpItem.tingkat || '';
      const tpText = tpItem.tp || tpItem.tp_text || tpItem.text || tpItem.name || '';
      const tpChapter = (tpItem.chapter || tpItem.bab || tpItem.materi || tpItem.judul || '').toLowerCase();
      const dbBab = extractBab(tpChapter);

      if (
        String(tpSubject).toLowerCase() === activeSubject.toLowerCase() &&
        String(tpKelas) === String(activeKelas) &&
        tpText
      ) {
        if (!currentBab || dbBab === currentBab || String(tpText).toLowerCase().includes(currentBab)) {
          extractedTPs.push(tpText);
        }
      }
    });

    const filteredBank = bankSoal.filter(
      (s) =>
        s.subject.toLowerCase() === activeSubject.toLowerCase() &&
        String(s.kelas) === String(activeKelas)
    );

    filteredBank.forEach((soal) => {
      const soalBab = extractBab(soal.examTitle || '');
      const mcTps = (soal.questions.multipleChoice || []).map(
        (q: any) => q.relatedTP || q.tp || q.tp_text
      );
      const essayTps = (soal.questions.essay || []).map(
        (q: any) => q.relatedTP || q.tp || q.tp_text
      );
      const allSoalTps = [...mcTps, ...essayTps].filter(Boolean) as string[];

      allSoalTps.forEach((tp) => {
        if (!currentBab || soalBab === currentBab || tp.toLowerCase().includes(currentBab)) {
          extractedTPs.push(tp);
        }
      });
    });

    return Array.from(new Set(extractedTPs));
  };

  const dynamicTPs = getFilteredTPs();

  const stats = useMemo(() => {
    const totalQuestions = filteredSoal.reduce(
      (sum, item) =>
        sum +
        (item.questions.multipleChoice?.length || 0) +
        (item.questions.essay?.length || 0),
      0
    );

    const totalTPLinks = filteredSoal.reduce(
      (sum, item) => sum + (item.tp_texts?.length || 0),
      0
    );

    return {
      banks: filteredSoal.length,
      questions: totalQuestions,
      tpLinks: totalTPLinks,
    };
  }, [filteredSoal]);

  const totalPages = Math.max(1, Math.ceil(filteredSoal.length / ITEMS_PER_PAGE));
  const paginatedSoal = filteredSoal.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const resetFilters = () => {
    setSelectedKelas('');
    setSelectedSubject('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const startEdit = (soal: BankSoalItem) => {
    setEditSoal(soal);
    setEditMC(soal.questions.multipleChoice ? JSON.parse(JSON.stringify(soal.questions.multipleChoice)) : []);
    setEditEssay(soal.questions.essay ? JSON.parse(JSON.stringify(soal.questions.essay)) : []);
    setEditModalOpen(true);
  };

  const handleUploadManualSoal = async () => {
    if (!selectedFile || !metaKelas || !metaSubject || !metaTitle) {
      toast.error('Lengkapi semua form dan pilih file PDF');
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/bank-soal/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      if (uploadDefaultTP.trim() !== '') {
        if (result.questions.multipleChoice) {
          result.questions.multipleChoice.forEach((q: any) => (q.relatedTP = uploadDefaultTP));
        }
        if (result.questions.essay) {
          result.questions.essay.forEach((q: any) => (q.relatedTP = uploadDefaultTP));
        }
      }

      const newBankSoalItem = {
        user_id: user?.uid,
        subject: metaSubject,
        kelas: metaKelas,
        examTitle: metaTitle,
        duration: Number(metaDuration),
        difficulty: 'sedang',
        optionsCount: result.questions.multipleChoice?.[0]
          ? Object.keys(result.questions.multipleChoice[0].options).length
          : 3,
        questions: result.questions,
        includeTP: false,
        created_at: new Date().toISOString(),
      };

      await addDoc(collection(db, 'question_banks'), newBankSoalItem);
      toast.success('Soal PDF berhasil diekstrak!');

      setUploadModalOpen(false);
      setSelectedFile(null);
      setMetaTitle('');
      setMetaKelas('');
      setMetaSubject('');
      setMetaDuration(60);
      setUploadDefaultTP('');
      loadBankSoal();
    } catch (error: any) {
      toast.error(error.message || 'Gagal mengekstrak soal');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSaveEditSoal = async () => {
    if (!editSoal) return;

    try {
      setLoading(true);
      await updateDoc(doc(db, 'question_banks', editSoal.id), {
        'questions.multipleChoice': editMC,
        'questions.essay': editEssay,
        examTitle: editSoal.examTitle,
      });

      const updatedQuestions = {
        ...editSoal.questions,
        multipleChoice: editMC,
        essay: editEssay,
      };

      setBankSoal((prev) =>
        prev.map((item) =>
          item.id === editSoal.id
            ? { ...item, examTitle: editSoal.examTitle, questions: updatedQuestions }
            : item
        )
      );

      setFilteredSoal((prev) =>
        prev.map((item) =>
          item.id === editSoal.id
            ? { ...item, examTitle: editSoal.examTitle, questions: updatedQuestions }
            : item
        )
      );

      if (selectedSoal?.id === editSoal.id) {
        setSelectedSoal({
          ...selectedSoal,
          examTitle: editSoal.examTitle,
          questions: updatedQuestions,
        });
      }

      setEditModalOpen(false);
      toast.success('Perubahan soal, TP, dan bobot berhasil disimpan!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan perubahan');
    } finally {
      setLoading(false);
    }
  };

  const handleExportWord = async (includeAnswerKey = false) => {
    if (!selectedSoal) return;

    try {
      const document = includeAnswerKey
        ? generateAnswerKeyDocument(selectedSoal.questions)
        : generateQuestionDocument(selectedSoal.questions, {
            subject: selectedSoal.subject,
            examTitle: selectedSoal.examTitle,
            duration: selectedSoal.duration,
            includeTP: showTPInDownload,
          });

      const blob = await Packer.toBlob(document);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = includeAnswerKey
        ? `${selectedSoal.examTitle}_KunciJawaban.docx`
        : `${selectedSoal.examTitle}_Soal.docx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error('Gagal export ke Word');
    }
  };

  const handleDeleteSoal = async (soalId: string) => {
    if (!confirm('Yakin ingin menghapus soal ini?')) return;

    try {
      await deleteDoc(doc(db, 'question_banks', soalId));
      setBankSoal((prev) => prev.filter((item) => item.id !== soalId));
      if (selectedSoal?.id === soalId) {
        setSelectedSoal(null);
        setViewMode(false);
      }
      toast.success('Soal berhasil dihapus');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus soal');
    }
  };

  const openViewer = (soal: BankSoalItem) => {
    setSelectedSoal(soal);
    setViewMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    Math.max(0, currentPage - 3),
    Math.min(totalPages, currentPage + 2)
  );

  if (viewMode && selectedSoal) {
    return (
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 15 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-6 text-white sm:p-8">
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
                  <FileText className="h-3.5 w-3.5" />
                  Question Workspace
                </div>
                <h1 className="max-w-4xl text-2xl font-black sm:text-3xl">{selectedSoal.examTitle}</h1>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white/10 px-3 py-1.5">Kelas {selectedSoal.kelas}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5">{selectedSoal.subject}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5">{selectedSoal.duration} menit</span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5">{formatDate(selectedSoal.created_at)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { setSelectedSoal(null); setViewMode(false); }} className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                  ← Kembali
                </Button>
                <Button onClick={() => startEdit(selectedSoal)} className="rounded-xl bg-white text-slate-900 hover:bg-slate-100">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Soal
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-black text-blue-600">{selectedSoal.questions.multipleChoice?.length || 0}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Pilihan Ganda</p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-black text-violet-600">{selectedSoal.questions.essay?.length || 0}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Essay / Isian</p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-black text-emerald-600">
                {(selectedSoal.questions.multipleChoice?.length || 0) + (selectedSoal.questions.essay?.length || 0)}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Total Soal</p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="space-y-8">
              {!!selectedSoal.questions.multipleChoice?.length && (
                <section>
                  <div className="mb-4 flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-3 text-blue-700">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      <h2 className="font-black">A. PILIHAN GANDA</h2>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold">{selectedSoal.questions.multipleChoice.length} soal</span>
                  </div>

                  <motion.div
                    variants={reduceMotion ? undefined : { visible: { transition: { staggerChildren: 0.04 } } }}
                    initial={reduceMotion ? false : 'hidden'}
                    animate={reduceMotion ? undefined : 'visible'}
                    className="space-y-4"
                  >
                    {selectedSoal.questions.multipleChoice.map((q: any, idx: number) => (
                      <motion.div
                        key={`${selectedSoal.id}-mc-${q.questionNumber ?? idx}`}
                        variants={reduceMotion ? undefined : itemVariants}
                        whileHover={reduceMotion ? undefined : { y: -2 }}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_20px_rgba(15,23,42,0.03)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-black text-blue-600">{idx + 1}</div>
                            <p className="text-sm font-semibold leading-6 text-slate-800">{q.question}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">Bobot {q.weight || 1}</span>
                        </div>

                        <div className="mt-4 space-y-2">
                          {Object.entries(q.options || {})
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([key, value]) => {
                              const isCorrect = key === q.correctAnswer;
                              return (
                                <div key={key} className={`rounded-xl border p-3 text-sm ${isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                                  <div className="flex items-start gap-3">
                                    <span className="font-black">{key}.</span>
                                    <span className="flex-1">{value as React.ReactNode}</span>
                                    {isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                                  </div>
                                </div>
                              );
                            })}
                        </div>

                        {(q.relatedTP || q.tp || q.tp_text) && (
                          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                            <span className="font-bold text-slate-600">TP:</span> {q.relatedTP || q.tp || q.tp_text}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                </section>
              )}

              {!!selectedSoal.questions.essay?.length && (
                <section>
                  <div className="mb-4 flex items-center justify-between rounded-2xl bg-violet-50 px-4 py-3 text-violet-700">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      <h2 className="font-black">B. ESSAY / ISIAN</h2>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold">{selectedSoal.questions.essay.length} soal</span>
                  </div>

                  <div className="space-y-4">
                    {selectedSoal.questions.essay.map((q: any, idx: number) => (
                      <motion.div
                        key={`${selectedSoal.id}-essay-${q.questionNumber ?? idx}`}
                        whileHover={reduceMotion ? undefined : { y: -2 }}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_20px_rgba(15,23,42,0.03)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-xs font-black text-violet-600">{idx + 1}</div>
                            <p className="text-sm font-semibold leading-6 text-slate-800">{q.question}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">Bobot {q.weight || 10}</span>
                        </div>

                        {(q.relatedTP || q.tp || q.tp_text) && (
                          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                            <span className="font-bold text-slate-600">TP:</span> {q.relatedTP || q.tp || q.tp_text}
                          </div>
                        )}

                        {q.rubric && (
                          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                            <p className="font-bold">Rubrik Penilaian</p>
                            <p className="mt-1">{q.rubric}</p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </section>

        <section className="sticky bottom-4 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900">
              <input
                type="checkbox"
                checked={showTPInDownload}
                onChange={(e) => setShowTPInDownload(e.target.checked)}
                className="h-4 w-4"
              />
              Tampilkan TP di file download
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => handleExportWord(false)} className="rounded-xl bg-violet-600 hover:bg-violet-700">
                <Download className="mr-2 h-4 w-4" /> Download Soal
              </Button>
              <Button onClick={() => handleExportWord(true)} variant="outline" className="rounded-xl">
                <FileText className="mr-2 h-4 w-4" /> Kunci Jawaban
              </Button>
            </div>
          </div>
        </section>

        {editModalOpen && renderEditModal({
          editSoal,
          setEditSoal,
          editMC,
          setEditMC,
          editEssay,
          setEditEssay,
          dynamicTPs,
          onClose: () => setEditModalOpen(false),
          onSave: handleSaveEditSoal,
          loading,
        })}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={reduceMotion ? undefined : { opacity: 1 }}
      className="space-y-7"
    >
      <datalist id="tp-list">
        {dynamicTPs.map((tp) => (
          <option key={tp} value={tp} />
        ))}
      </datalist>

      <motion.section
        variants={reduceMotion ? undefined : sectionVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate={reduceMotion ? undefined : 'visible'}
        className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:p-8"
      >
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-60 w-60 rounded-full bg-violet-100/40 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              Question Workspace
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Bank Soal
              <span className="block bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
                terpusat untuk semua kebutuhan evaluasi
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Kelola soal hasil generate AI maupun soal dari PDF dalam satu workspace yang terstruktur dan mudah digunakan kembali.
            </p>
          </div>

          <Button onClick={() => setUploadModalOpen(true)} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold shadow-lg shadow-slate-200 hover:bg-slate-800">
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload Soal PDF
          </Button>
        </div>
      </motion.section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Bank Ujian', value: stats.banks, icon: Layers3, tone: 'bg-blue-50 text-blue-600' },
          { label: 'Total Soal', value: stats.questions, icon: ClipboardList, tone: 'bg-violet-50 text-violet-600' },
          { label: 'Relasi TP', value: stats.tpLinks, icon: BookOpen, tone: 'bg-emerald-50 text-emerald-600' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              whileHover={reduceMotion ? undefined : { y: -4 }}
              className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </div>
              <p className="mt-6 text-sm font-semibold text-slate-500">{stat.label}</p>
              <p className="mt-1 text-3xl font-black text-slate-950">{stat.value}</p>
            </motion.div>
          );
        })}
      </section>

      <motion.section
        variants={reduceMotion ? undefined : sectionVariants}
        initial={reduceMotion ? false : 'hidden'}
        whileInView={reduceMotion ? undefined : 'visible'}
        viewport={{ once: true, amount: 0.1 }}
        className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Cari soal</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari judul ujian, mapel, TP, atau isi soal..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>
          </div>

          <div className="w-full lg:w-48">
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Kelas</label>
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
            >
              <option value="">Semua Kelas</option>
              {availableKelas.map((kelas) => (
                <option key={kelas} value={kelas}>Kelas {kelas}</option>
              ))}
            </select>
          </div>

          <div className="w-full lg:w-64">
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Mata Pelajaran</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
            >
              <option value="">Semua Mata Pelajaran</option>
              {availableSubjects.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>

          <Button variant="outline" onClick={resetFilters} className="h-11 rounded-xl">
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
        </div>

        {(selectedKelas || selectedSubject || searchTerm) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {searchTerm && <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">Cari: {searchTerm}</span>}
            {selectedKelas && <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Kelas {selectedKelas}</span>}
            {selectedSubject && <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">{selectedSubject}</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <Filter className="h-3.5 w-3.5" /> {filteredSoal.length} hasil
            </span>
          </div>
        )}
      </motion.section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Library</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Daftar soal tersimpan</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
            {filteredSoal.length} bank soal
          </span>
        </div>

        {loading ? (
          <LoadingCard count={3} />
        ) : filteredSoal.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-slate-700">Belum ada soal tersimpan</h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-400">
              Generate soal dari halaman Generate Soal atau upload berkas PDF untuk menambahkan bank soal baru.
            </p>
            <Button onClick={() => setUploadModalOpen(true)} className="mt-5 rounded-xl">
              <UploadCloud className="mr-2 h-4 w-4" /> Upload PDF
            </Button>
          </div>
        ) : (
          <motion.div
            variants={reduceMotion ? undefined : { visible: { transition: { staggerChildren: 0.04 } } }}
            initial={reduceMotion ? false : 'hidden'}
            animate={reduceMotion ? undefined : 'visible'}
            className="space-y-3"
          >
            {paginatedSoal.map((soal) => {
              const mcCount = soal.questions.multipleChoice?.length || 0;
              const essayCount = soal.questions.essay?.length || 0;

              return (
                <motion.div
                  key={soal.id}
                  variants={reduceMotion ? undefined : itemVariants}
                  whileHover={reduceMotion ? undefined : { y: -3 }}
                  className="group rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_5px_20px_rgba(15,23,42,0.025)] transition-shadow hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Kelas {soal.kelas}</span>
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">{soal.subject}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{formatDate(soal.created_at)}</span>
                      </div>

                      <h3 className="mt-3 truncate text-base font-black text-slate-900">{soal.examTitle}</h3>

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> PG {mcCount}</span>
                        <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Essay {essayCount}</span>
                        <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {soal.duration} menit</span>
                      </div>

                      {!!soal.tp_texts?.length && (
                        <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                          <span className="font-bold text-slate-600">TP:</span> {soal.tp_texts.map((tp) => tp.tp).join(' • ')}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button onClick={() => openViewer(soal)} size="sm" className="rounded-xl">
                        <Eye className="mr-1.5 h-4 w-4" /> Preview
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => startEdit(soal)} className="rounded-xl">
                        <Pencil className="mr-1.5 h-4 w-4" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteSoal(soal.id)} className="rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {filteredSoal.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredSoal.length)} dari {filteredSoal.length}
            </p>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="rounded-xl" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {pageNumbers.map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  className="h-9 min-w-9 rounded-xl px-2"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}

              <Button variant="outline" size="icon" className="rounded-xl" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>

      <AnimatePresence>
        {editModalOpen && renderEditModal({
          editSoal,
          setEditSoal,
          editMC,
          setEditMC,
          editEssay,
          setEditEssay,
          dynamicTPs,
          onClose: () => setEditModalOpen(false),
          onSave: handleSaveEditSoal,
          loading,
        })}

        {uploadModalOpen && (
          <motion.div
            key="upload-modal"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
              className="w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
            >
              <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                      <UploadCloud className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900">Upload Berkas Soal Baru</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Ekstrak soal PDF dan simpan langsung ke Bank Soal.</p>
                  </div>
                  <button onClick={() => { setUploadModalOpen(false); setUploadDefaultTP(''); }} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Judul Ujian</label>
                  <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" placeholder="Contoh: Ulangan Harian Bab 6" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
                  <p className="mt-1 text-[10px] text-slate-400">Ketik “Bab 6” agar daftar TP dapat tersaring otomatis.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Kelas</label>
                    <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" value={metaKelas} onChange={(e) => setMetaKelas(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Mata Pelajaran</label>
                    <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" value={metaSubject} onChange={(e) => setMetaSubject(e.target.value)} />
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-blue-700">Tujuan Pembelajaran · Opsional</label>
                  <input
                    list="tp-list"
                    className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                    placeholder="TP ini akan diterapkan ke semua soal"
                    value={uploadDefaultTP}
                    onChange={(e) => setUploadDefaultTP(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Durasi (Menit)</label>
                  <input type="number" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" value={metaDuration} onChange={(e) => setMetaDuration(Number(e.target.value))} />
                </div>

                <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center transition hover:border-blue-300 hover:bg-blue-50">
                  <UploadCloud className="h-8 w-8 text-blue-600 transition group-hover:-translate-y-1" />
                  <p className="mt-3 text-sm font-bold text-slate-700">{selectedFile ? selectedFile.name : 'Klik untuk memilih berkas PDF soal'}</p>
                  <p className="mt-1 text-xs text-slate-400">File akan diproses oleh endpoint upload yang sudah digunakan aplikasi.</p>
                  <input type="file" accept=".pdf" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4">
                <Button onClick={() => { setUploadModalOpen(false); setUploadDefaultTP(''); }} variant="outline" className="rounded-xl">Batal</Button>
                <Button onClick={handleUploadManualSoal} disabled={uploadLoading} className="rounded-xl bg-blue-600 hover:bg-blue-700">
                  {uploadLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Proses & Simpan
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function renderEditModal({
  editSoal,
  setEditSoal,
  editMC,
  setEditMC,
  editEssay,
  setEditEssay,
  dynamicTPs,
  onClose,
  onSave,
  loading,
}: {
  editSoal: BankSoalItem | null;
  setEditSoal: React.Dispatch<React.SetStateAction<BankSoalItem | null>>;
  editMC: any[];
  setEditMC: React.Dispatch<React.SetStateAction<any[]>>;
  editEssay: any[];
  setEditEssay: React.Dispatch<React.SetStateAction<any[]>>;
  dynamicTPs: string[];
  onClose: () => void;
  onSave: () => void;
  loading: boolean;
}) {
  return (
    <motion.div
      key="edit-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm"><Pencil className="h-5 w-5" /></div>
              <h2 className="text-2xl font-black text-slate-900">Edit Soal, Kunci & Pembobotan</h2>
              <p className="mt-1 text-sm text-slate-500">Sesuaikan teks soal, kunci jawaban, bobot nilai, dan TP.</p>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-700"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Judul Dokumen Soal</label>
            <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" value={editSoal?.examTitle || ''} onChange={(e) => { if (editSoal) setEditSoal({ ...editSoal, examTitle: e.target.value }); }} />
          </div>

          {editMC.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-blue-200">
              <div className="flex items-center gap-2 bg-blue-50 px-4 py-3 text-blue-800"><ClipboardList className="h-4 w-4" /><h3 className="font-black">A. Pilihan Ganda</h3></div>
              <div className="space-y-6 p-4">
                {editMC.map((q, idx) => (
                  <div key={`edit-mc-${idx}`} className="border-b border-slate-200 pb-6 last:border-0 last:pb-0">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="text-sm font-bold text-slate-700">Pertanyaan {idx + 1}</label>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Yakin ingin menghapus soal Pilihan Ganda ini?')) {
                            setEditMC((current) => current.filter((_, i) => i !== idx));
                          }
                        }}
                        className="inline-flex items-center rounded-xl px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Hapus Soal
                      </button>
                    </div>
                    <textarea className="mb-3 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" value={q.question} onChange={(e) => { setEditMC((current) => current.map((item, i) => i === idx ? { ...item, question: e.target.value } : item)); }} />

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {Object.keys(q.options || {}).sort((a, b) => a.localeCompare(b)).map((key) => (
                        <div key={key} className={`rounded-xl border p-3 ${q.correctAnswer === key ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                          <div className="flex items-start gap-3">
                            <input type="radio" name={`correct-${idx}`} checked={q.correctAnswer === key} onChange={() => { setEditMC((current) => current.map((item, i) => i === idx ? { ...item, correctAnswer: key } : item)); }} className="mt-2 h-4 w-4" />
                            <div className="min-w-0 flex-1">
                              <p className="mb-1 text-xs font-bold text-slate-500">{key}{q.correctAnswer === key ? ' · Kunci' : ''}</p>
                              <input className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" value={q.options[key]} onChange={(e) => { setEditMC((current) => current.map((item, i) => i === idx ? { ...item, options: { ...item.options, [key]: e.target.value } } : item)); }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px] rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Tujuan Pembelajaran (TP)</label>
                        <input list="tp-list" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={q.relatedTP || q.tp || q.tp_text || ''} onChange={(e) => { setEditMC((current) => current.map((item, i) => i === idx ? { ...item, relatedTP: e.target.value } : item)); }} />
                        {dynamicTPs.length === 0 && <p className="mt-1 text-[10px] text-orange-600">Belum ada daftar TP yang cocok untuk konteks ini.</p>}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Bobot</label>
                        <input type="number" min={1} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-blue-700" value={q.weight || 1} onChange={(e) => { setEditMC((current) => current.map((item, i) => i === idx ? { ...item, weight: Number(e.target.value) } : item)); }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {editEssay.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-violet-200">
              <div className="flex items-center gap-2 bg-violet-50 px-4 py-3 text-violet-800"><FileText className="h-4 w-4" /><h3 className="font-black">B. Essay / Isian</h3></div>
              <div className="space-y-5 p-4">
                {editEssay.map((q, idx) => (
                  <div key={`edit-essay-${idx}`} className="border-b border-slate-200 pb-5 last:border-0 last:pb-0">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="text-sm font-bold text-slate-700">Pertanyaan {idx + 1}</label>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Yakin ingin menghapus soal Essay ini?')) {
                            setEditEssay((current) => current.filter((_, i) => i !== idx));
                          }
                        }}
                        className="inline-flex items-center rounded-xl px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Hapus Soal
                      </button>
                    </div>
                    <textarea className="min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50" value={q.question} onChange={(e) => { setEditEssay((current) => current.map((item, i) => i === idx ? { ...item, question: e.target.value } : item)); }} />

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px] rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Tujuan Pembelajaran (TP)</label>
                        <input list="tp-list" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={q.relatedTP || q.tp || q.tp_text || ''} onChange={(e) => { setEditEssay((current) => current.map((item, i) => i === idx ? { ...item, relatedTP: e.target.value } : item)); }} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Bobot</label>
                        <input type="number" min={1} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-violet-700" value={q.weight || 10} onChange={(e) => { setEditEssay((current) => current.map((item, i) => i === idx ? { ...item, weight: Number(e.target.value) } : item)); }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4">
          <Button onClick={onClose} variant="outline" className="rounded-xl">Batal</Button>
          <Button onClick={onSave} disabled={loading} className="rounded-xl bg-blue-600 hover:bg-blue-700">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan Perubahan
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
