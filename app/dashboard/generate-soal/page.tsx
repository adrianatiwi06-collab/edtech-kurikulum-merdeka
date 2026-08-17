'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, FileText, Save } from 'lucide-react';
import { generateQuestionsAction } from './actions';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Packer } from 'docx';
import { generateQuestionDocument, generateAnswerKeyDocument, QuestionData } from '@/lib/docx-utils';
import AIModelSelector from '@/components/AIModelSelector';
import { toast } from 'sonner';

interface LearningGoal {
  id: string;
  chapter: string;
  tp: string;
  semester: number;
  grade: string;
  subject?: string;
}

export default function GenerateSoalPage() {
  const { user } = useAuth();
  const [learningGoals, setLearningGoals] = useState<LearningGoal[]>([]);
  const [filteredLearningGoals, setFilteredLearningGoals] = useState<LearningGoal[]>([]);
  const [selectedTPs, setSelectedTPs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mcCount, setMcCount] = useState(10);
  const [mcWeight, setMcWeight] = useState(1);
  const [essayCount, setEssayCount] = useState(5);
  const [essayWeight, setEssayWeight] = useState(3);
  const [duration, setDuration] = useState(60);
  const [subject, setSubject] = useState('');
  const [kelas, setKelas] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [includeTP, setIncludeTP] = useState(false);
  const [includeImage, setIncludeImage] = useState(false);
  const [difficulty, setDifficulty] = useState<'mudah' | 'sedang' | 'sulit'>('sedang');
  const [optionsCount, setOptionsCount] = useState<3 | 4 | 5>(3);
  const [distractorQuality, setDistractorQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [useDistribution, setUseDistribution] = useState(false);
  // PG Distribution
  const [mudahCount, setMudahCount] = useState(10);
  const [sedangCount, setSedangCount] = useState(5);
  const [sulitCount, setSulitCount] = useState(0);
  // Isian Distribution
  const [mudahIsianCount, setMudahIsianCount] = useState(3);
  const [sedangIsianCount, setSedangIsianCount] = useState(2);
  const [sulitIsianCount, setSulitIsianCount] = useState(0);
  // Essay/Uraian state
  const [uraianCount, setUraianCount] = useState(0);
  const [uraianWeight, setUraianWeight] = useState(0);
  // Essay Distribution
  const [mudahUraianCount, setMudahUraianCount] = useState(1);
  const [sedangUraianCount, setSedangUraianCount] = useState(1);
  const [sulitUraianCount, setSulitUraianCount] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionData | null>(null);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');

  useEffect(() => {
    if (user) {
      loadLearningGoals();
    }
  }, [user]);

  useEffect(() => {
    // Filter TP based on selected subject and class
    let filtered = learningGoals;
    
    if (subject) {
      filtered = filtered.filter(lg => lg.subject === subject);
    }
    
    if (kelas) {
      filtered = filtered.filter(lg => lg.grade === kelas);
    }
    
    setFilteredLearningGoals(filtered);
    
    // Clear selected TPs if they're no longer in filtered list
    const filteredIds = filtered.map(lg => lg.id);
    setSelectedTPs(prev => prev.filter(id => filteredIds.includes(id)));
  }, [subject, kelas, learningGoals]);

  const loadLearningGoals = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'learning_goals'), where('user_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const goals: LearningGoal[] = [];
      const subjects = new Set<string>();
      const grades = new Set<string>();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        goals.push({ id: doc.id, ...data } as LearningGoal);
        if (data.subject) subjects.add(data.subject);
        if (data.grade) grades.add(data.grade);
      });
      
      setLearningGoals(goals);
      setFilteredLearningGoals(goals);
      setAvailableSubjects(Array.from(subjects).sort());
      setAvailableGrades(Array.from(grades).sort());
    } catch (error) {
      console.error('Error loading learning goals:', error);
      toast.error('Gagal memuat data Tujuan Pembelajaran', {
        description: 'Silakan refresh halaman untuk mencoba lagi'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTP = (id: string) => {
    setSelectedTPs((prev) =>
      prev.includes(id) ? prev.filter((tpId) => tpId !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!subject || !kelas || !examTitle) {
      setError('Mohon lengkapi mata pelajaran, kelas, dan judul ujian');
      return;
    }

    if (selectedTPs.length === 0) {
      setError('Mohon pilih minimal 1 Tujuan Pembelajaran');
      return;
    }

    if (mcCount < 0 || essayCount < 0 || mcWeight < 0 || essayWeight < 0 || duration <= 0) {
      setError('Konfigurasi soal harus berupa angka positif');
      return;
    }

    // Validasi distribusi tingkat kesukaran
    if (useDistribution) {
      const totalPGDistribution = mudahCount + sedangCount + sulitCount;
      const totalIsianDistribution = mudahIsianCount + sedangIsianCount + sulitIsianCount;
      
      if (totalPGDistribution !== mcCount) {
        setError(`Total distribusi PG (${totalPGDistribution}) harus sama dengan jumlah soal pilihan ganda (${mcCount})`);
        return;
      }
      
      if (totalIsianDistribution !== essayCount) {
        setError(`Total distribusi Isian (${totalIsianDistribution}) harus sama dengan jumlah soal isian (${essayCount})`);
        return;
      }
      
      const totalUraianDistribution = mudahUraianCount + sedangUraianCount + sulitUraianCount;
      if (totalUraianDistribution !== uraianCount) {
        setError(`Total distribusi Uraian (${totalUraianDistribution}) harus sama dengan jumlah soal uraian (${uraianCount})`);
        return;
      }
      
      if (mudahCount < 0 || sedangCount < 0 || sulitCount < 0 || 
          mudahIsianCount < 0 || sedangIsianCount < 0 || sulitIsianCount < 0 ||
          mudahUraianCount < 0 || sedangUraianCount < 0 || sulitUraianCount < 0) {
        setError('Jumlah soal per tingkat kesukaran tidak boleh negatif');
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const selectedGoals = filteredLearningGoals.filter((lg) => selectedTPs.includes(lg.id));
      const tpTexts = selectedGoals.map((lg) => lg.tp);

      const result = await generateQuestionsAction(tpTexts, subject, {
        multipleChoice: { count: mcCount, weight: mcWeight },
        essay: { count: essayCount, weight: essayWeight },
        difficulty,
        optionsCount,
        distractorQuality,
        includeImage,
        modelName: selectedModel,
        // Tambahkan distribusi jika diaktifkan
        useDistribution,
        difficultyDistribution: useDistribution ? {
          pg: {
            mudah: mudahCount,
            sedang: sedangCount,
            sulit: sulitCount,
          },
          isian: {
            mudah: mudahIsianCount,
            sedang: sedangIsianCount,
            sulit: sulitIsianCount,
          },
          uraian: {
            mudah: mudahUraianCount,
            sedang: sedangUraianCount,
            sulit: sulitUraianCount,
          },
        } : undefined,
        uraianCount,
        uraianWeight,
      });

      if (result.success) {
        setGeneratedQuestions(result.data);
        setSuccess('Soal berhasil di-generate! Anda dapat menyimpan ke Bank Soal atau langsung download.');
      } else {
        setError(result.error || 'Gagal generate soal');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToBankSoal = async () => {
    if (!generatedQuestions || !user) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const selectedGoals = filteredLearningGoals.filter((lg) => selectedTPs.includes(lg.id));
      
      // Build TP mapping for each question (for TP analysis feature)
      const questionTPMapping: Array<{
        question_number: number;
        question_type: 'PG' | 'Essay';
        tp_id: string;
        tp_text: string;
      }> = [];
      
      // Map PG questions to TPs
      generatedQuestions.multipleChoice.forEach((q) => {
        const matchedTP = selectedGoals.find(tp => tp.tp === q.relatedTP);
        if (matchedTP) {
          questionTPMapping.push({
            question_number: q.questionNumber,
            question_type: 'PG',
            tp_id: matchedTP.id,
            tp_text: matchedTP.tp
          });
        }
      });
      
      // Map Essay questions to TPs
      generatedQuestions.essay.forEach((q) => {
        const matchedTP = selectedGoals.find(tp => tp.tp === q.relatedTP);
        if (matchedTP) {
          questionTPMapping.push({
            question_number: q.questionNumber,
            question_type: 'Essay',
            tp_id: matchedTP.id,
            tp_text: matchedTP.tp
          });
        }
      });
      
      await addDoc(collection(db, 'question_banks'), {
        user_id: user.uid,
        subject,
        kelas,
        examTitle,
        duration,
        difficulty,
        optionsCount,
        distractorQuality,
        useDistribution,
        difficultyDistribution: useDistribution ? {
          pg: {
            mudah: mudahCount,
            sedang: sedangCount,
            sulit: sulitCount,
          },
          isian: {
            mudah: mudahIsianCount,
            sedang: sedangIsianCount,
            sulit: sulitIsianCount,
          },
          uraian: {
            mudah: mudahUraianCount,
            sedang: sedangUraianCount,
            sulit: sulitUraianCount,
          },
        } : null,
        uraianCount,
        uraianWeight,
        tp_ids: selectedTPs,
        tp_texts: selectedGoals.map(lg => ({ id: lg.id, tp: lg.tp, chapter: lg.chapter })),
        question_tp_mapping: questionTPMapping,  // Save TP mapping for analysis
        questions: generatedQuestions,
        includeTP,
        includeImage,
        created_at: new Date().toISOString(),
      });

      setSuccess('Soal berhasil disimpan ke Bank Soal dengan pemetaan TP!');
    } catch (err: any) {
      setError('Gagal menyimpan ke Bank Soal: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportWord = async (includeAnswerKey: boolean = false) => {
    if (!generatedQuestions) return;

    try {
      const doc = includeAnswerKey 
        ? generateAnswerKeyDocument(generatedQuestions)
        : generateQuestionDocument(generatedQuestions, {
            subject,
            examTitle,
            duration,
            includeTP,
          });

      const blob = await Packer.toBlob(doc);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = includeAnswerKey 
        ? `${examTitle}_KunciJawaban.docx` 
        : `${examTitle}_Soal.docx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Word:', error);
      toast.error('Gagal export ke Word', {
        description: 'Terjadi kesalahan saat membuat dokumen. Silakan coba lagi.'
      });
    }
  };


  /* =========================================================
     REDESIGNED UI HELPERS
  ========================================================= */

  const reduceMotion = useReducedMotion();

  const groupedByChapter = useMemo(() => {
    return filteredLearningGoals.reduce((acc, lg) => {
      if (!acc[lg.chapter]) {
        acc[lg.chapter] = [];
      }
      acc[lg.chapter].push(lg);
      return acc;
    }, {} as Record<string, LearningGoal[]>);
  }, [filteredLearningGoals]);

  const selectedGoalObjects = useMemo(() => {
    return filteredLearningGoals.filter((lg) =>
      selectedTPs.includes(lg.id)
    );
  }, [filteredLearningGoals, selectedTPs]);

  const totalQuestionCount =
    (mcCount || 0) +
    (essayCount || 0) +
    (uraianCount || 0);

  const totalConfiguredWeight =
    (mcCount || 0) * (mcWeight || 0) +
    (essayCount || 0) * (essayWeight || 0) +
    (uraianCount || 0) * (uraianWeight || 0);

  const distributionPGTotal =
    mudahCount + sedangCount + sulitCount;

  const distributionIsianTotal =
    mudahIsianCount + sedangIsianCount + sulitIsianCount;

  const distributionUraianTotal =
    mudahUraianCount + sedangUraianCount + sulitUraianCount;

  const distributionValid =
    !useDistribution ||
    (
      distributionPGTotal === mcCount &&
      distributionIsianTotal === essayCount &&
      distributionUraianTotal === uraianCount
    );

  const canGenerate =
    Boolean(subject) &&
    Boolean(kelas) &&
    Boolean(examTitle.trim()) &&
    selectedTPs.length > 0 &&
    totalQuestionCount > 0 &&
    distributionValid;

  const panelVariants = {
    hidden: {
      opacity: 0,
      y: 18,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const staggerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.045,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 10,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const renderConfigNumber = (
    label: string,
    value: number,
    setter: (value: number) => void,
    min = 0,
    help?: string
  ) => (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-600">
        {label}
      </label>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(e) => setter(Number(e.target.value))}
        className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus:bg-white"
      />
      {help && (
        <p className="text-[10px] leading-4 text-slate-400">
          {help}
        </p>
      )}
    </div>
  );

  const renderDistributionField = (
    label: string,
    value: number,
    setter: (value: number) => void,
    max: number
  ) => (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-slate-600">
        {label}
      </label>
      <Input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => setter(Number(e.target.value))}
        className="h-10 rounded-xl border-slate-200 bg-white"
      />
    </div>
  );

  const renderQuestionCard = (q: any, type: 'PG' | 'Essay', index: number) => {
    const wordCount = q.question?.split?.(' ').length || 0;
    const hasImageDesc =
      q.imageDescription &&
      q.imageDescription.trim() !== '';

    const isPG = type === 'PG';

    return (
      <motion.div
        key={`${type}-${q.questionNumber ?? index}`}
        variants={reduceMotion ? undefined : itemVariants}
        whileHover={
          reduceMotion
            ? undefined
            : {
                y: -2,
              }
        }
        className={`rounded-2xl border bg-white p-5 shadow-sm ${
          isPG
            ? 'border-blue-100'
            : 'border-violet-100'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                isPG
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-violet-50 text-violet-600'
              }`}
            >
              {isPG ? 'A' : 'B'}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                {isPG ? 'Pilihan Ganda' : 'Essay / Isian'}
              </p>
              <p className="text-sm font-bold text-slate-800">
                Soal {q.questionNumber}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {hasImageDesc && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                🖼️ Gambar
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                wordCount <= (isPG ? 10 : 15)
                  ? 'bg-emerald-50 text-emerald-700'
                  : wordCount <= (isPG ? 15 : 20)
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
              }`}
            >
              {wordCount} kata
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-7 text-slate-700">
          {q.question}
        </p>

        {hasImageDesc && (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Tempat gambar / ilustrasi
            </p>
            <p className="mt-2 text-sm italic leading-6 text-slate-600">
              {q.imageDescription}
            </p>
          </div>
        )}

        {isPG ? (
          <div className="mt-4 space-y-2">
            {Object.entries(q.options || {}).map(([key, value]) => {
              const isCorrect = key === q.correctAnswer;

              return (
                <div
                  key={key}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
                    isCorrect
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <span
                    className={`min-w-[24px] font-bold ${
                      isCorrect
                        ? 'text-emerald-700'
                        : 'text-slate-500'
                    }`}
                  >
                    {key}.
                  </span>
                  <span
                    className={`text-sm leading-6 ${
                      isCorrect
                        ? 'text-emerald-800'
                        : 'text-slate-700'
                    }`}
                  >
                    {String(value)}
                  </span>
                  {isCorrect && (
                    <span className="ml-auto font-bold text-emerald-600">
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {q.rubric && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                  Rubrik penilaian
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  {q.rubric}
                </p>
              </div>
            )}
          </>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-400">
          <span>
            🎯 {q.relatedTP ? `TP: ${q.relatedTP}` : 'TP terkait tersedia'}
          </span>
          <span className="font-semibold text-slate-500">
            Bobot {q.weight}
          </span>
          {isPG && (
            <span className="font-semibold text-emerald-600">
              Kunci: {q.correctAnswer}
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">
          Silakan login terlebih dahulu.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={reduceMotion ? undefined : { opacity: 1 }}
      className="space-y-7"
    >
      <motion.section
        variants={reduceMotion ? undefined : panelVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate={reduceMotion ? undefined : 'visible'}
        className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:p-8"
      >
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-violet-100/40 blur-3xl" />

        <div className="relative grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              <span>✨</span>
              AI Assessment Workspace
            </div>

            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Generate Soal
              <span className="block bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
                dari Tujuan Pembelajaran
              </span>
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
              Pilih TP, atur karakteristik soal, lalu biarkan AI menyusun
              assessment yang siap direview dan disimpan ke Bank Soal.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-2xl font-black text-slate-950">
                {selectedTPs.length}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                TP dipilih
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-2xl font-black text-blue-600">
                {totalQuestionCount}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Total soal
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-2xl font-black text-violet-600">
                {duration}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Menit
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {!generatedQuestions ? (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <motion.section
              variants={reduceMotion ? undefined : panelVariants}
              initial={reduceMotion ? false : 'hidden'}
              animate={reduceMotion ? undefined : 'visible'}
              className="rounded-[30px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.04)]"
            >
              <div className="border-b border-slate-100 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                      Step 01
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-900">
                      Pilih Tujuan Pembelajaran
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Pilih satu atau beberapa TP sebagai sumber soal.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                    {selectedTPs.length} dipilih
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                      Mata Pelajaran
                    </label>
                    <select
                      aria-label="Mata Pelajaran"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    >
                      <option value="">Pilih Mata Pelajaran</option>
                      {availableSubjects.map((subj) => (
                        <option key={subj} value={subj}>
                          {subj}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                      Kelas
                    </label>
                    <select
                      aria-label="Kelas"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                      value={kelas}
                      onChange={(e) => setKelas(e.target.value)}
                    >
                      <option value="">Pilih Kelas</option>
                      {availableGrades.map((grade) => (
                        <option key={grade} value={grade}>
                          Kelas {grade}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!subject || !kelas ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                      📚
                    </div>
                    <p className="mt-4 text-sm font-bold text-slate-700">
                      Pilih mapel dan kelas terlebih dahulu
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Setelah itu daftar TP yang sesuai akan tampil di sini.
                    </p>
                  </div>
                ) : filteredLearningGoals.length === 0 ? (
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-8 text-center">
                    <p className="text-sm font-bold text-amber-900">
                      Belum ada TP untuk {subject} · Kelas {kelas}
                    </p>
                    <p className="mt-1 text-xs text-amber-800/70">
                      Generate TP terlebih dahulu pada menu Generate TP.
                    </p>
                  </div>
                ) : (
                  <motion.div
                    variants={reduceMotion ? undefined : staggerVariants}
                    initial={reduceMotion ? false : 'hidden'}
                    animate={reduceMotion ? undefined : 'visible'}
                    className="max-h-[620px] space-y-4 overflow-y-auto pr-1"
                  >
                    {Object.entries(groupedByChapter).map(
                      ([chapter, goals]) => (
                        <motion.div
                          key={chapter}
                          variants={reduceMotion ? undefined : itemVariants}
                          className="overflow-hidden rounded-[24px] border border-slate-200"
                        >
                          <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {chapter}
                              </p>
                              <p className="mt-0.5 text-[10px] text-slate-400">
                                {goals.length} TP
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const ids = goals.map((g) => g.id);
                                const allSelected = ids.every((id) =>
                                  selectedTPs.includes(id)
                                );

                                setSelectedTPs((prev) =>
                                  allSelected
                                    ? prev.filter((id) => !ids.includes(id))
                                    : Array.from(new Set([...prev, ...ids]))
                                );
                              }}
                              className="rounded-xl bg-white px-3 py-2 text-[10px] font-bold text-blue-600 shadow-sm transition hover:bg-blue-50"
                            >
                              {goals.every((g) =>
                                selectedTPs.includes(g.id)
                              )
                                ? 'Batalkan Bab'
                                : 'Pilih Bab'}
                            </button>
                          </div>

                          <div className="divide-y divide-slate-100 bg-white">
                            {goals.map((goal) => {
                              const checked = selectedTPs.includes(goal.id);

                              return (
                                <motion.label
                                  key={goal.id}
                                  whileHover={
                                    reduceMotion
                                      ? undefined
                                      : { backgroundColor: '#F8FAFC' }
                                  }
                                  className="flex cursor-pointer items-start gap-3 p-4"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleTP(goal.id)}
                                    className="mt-1 h-4 w-4 accent-blue-600"
                                  />

                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm leading-6 text-slate-700">
                                      {goal.tp}
                                    </p>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                                        Semester {goal.semester}
                                      </span>

                                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                                        Kelas {goal.grade}
                                      </span>
                                    </div>
                                  </div>

                                  {checked && (
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                                      ✓ Dipilih
                                    </span>
                                  )}
                                </motion.label>
                              );
                            })}
                          </div>
                        </motion.div>
                      )
                    )}
                  </motion.div>
                )}
              </div>
            </motion.section>

            <motion.section
              variants={reduceMotion ? undefined : panelVariants}
              initial={reduceMotion ? false : 'hidden'}
              animate={reduceMotion ? undefined : 'visible'}
              transition={{ delay: 0.08 }}
              className="space-y-6"
            >
              <div className="rounded-[30px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
                <div className="border-b border-slate-100 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Step 02
                      </p>
                      <h2 className="mt-1 text-xl font-black text-slate-900">
                        Konfigurasi Soal
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Atur model AI, format, tingkat kesulitan, dan bobot.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">
                      {totalQuestionCount} soal
                    </div>
                  </div>
                </div>

                <div className="space-y-6 p-6">
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-violet-700">
                      AI Model
                    </div>
                    <div className="relative z-10">
                      <AIModelSelector
                        onModelChange={(model) => setSelectedModel(model)}
                        defaultModel={selectedModel}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                      Judul Ujian *
                    </label>
                    <Input
                      placeholder="Contoh: Ulangan Harian Bab 1"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                        Tingkat Kesulitan
                      </label>
                      <select
                        value={difficulty}
                        onChange={(e) =>
                          setDifficulty(
                            e.target.value as 'mudah' | 'sedang' | 'sulit'
                          )
                        }
                        disabled={useDistribution}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
                      >
                        <option value="mudah">Mudah</option>
                        <option value="sedang">Sedang</option>
                        <option value="sulit">Sulit</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                        Durasi
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          Pilihan Ganda
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Soal objektif dengan opsi jawaban
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                        {mcCount} soal
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {renderConfigNumber(
                        'Jumlah',
                        mcCount,
                        setMcCount,
                        0
                      )}
                      {renderConfigNumber(
                        'Bobot / soal',
                        mcWeight,
                        setMcWeight,
                        0
                      )}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Opsi jawaban
                        </label>
                        <select
                          value={optionsCount}
                          onChange={(e) =>
                            setOptionsCount(
                              Number(e.target.value) as 3 | 4 | 5
                            )
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                        >
                          <option value={3}>3 opsi</option>
                          <option value={4}>4 opsi</option>
                          <option value={5}>5 opsi</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="text-xs font-semibold text-slate-600">
                        Kualitas pengecoh
                      </label>
                      <select
                        value={distractorQuality}
                        onChange={(e) =>
                          setDistractorQuality(
                            e.target.value as 'low' | 'medium' | 'high'
                          )
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                      >
                        <option value="low">
                          Rendah — pengecoh cukup berbeda
                        </option>
                        <option value="medium">
                          Sedang — pengecoh mirip strukturnya
                        </option>
                        <option value="high">
                          Tinggi — pengecoh sangat plausible
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          Isian Singkat
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Jawaban pendek 1–3 kata
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        {essayCount} soal
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {renderConfigNumber(
                        'Jumlah',
                        essayCount,
                        setEssayCount,
                        0
                      )}
                      {renderConfigNumber(
                        'Bobot / soal',
                        essayWeight,
                        setEssayWeight,
                        0
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          Uraian / Essay
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Jawaban panjang dan mendalam
                        </p>
                      </div>
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                        {uraianCount} soal
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {renderConfigNumber(
                        'Jumlah',
                        uraianCount,
                        setUraianCount,
                        0
                      )}
                      {renderConfigNumber(
                        'Bobot / soal',
                        uraianWeight,
                        setUraianWeight,
                        0
                      )}
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                    <input
                      type="checkbox"
                      checked={includeImage}
                      onChange={(e) => setIncludeImage(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-bold text-blue-900">
                        Sertakan deskripsi gambar
                      </p>
                      <p className="mt-1 text-xs leading-5 text-blue-800/70">
                        AI akan menghasilkan deskripsi ilustrasi yang relevan
                        bila dibutuhkan.
                      </p>
                    </div>
                  </label>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          Distribusi tingkat kesukaran
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          Atur jumlah mudah, sedang, dan sulit.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={useDistribution}
                        onChange={(e) =>
                          setUseDistribution(e.target.checked)
                        }
                        className="h-5 w-5 accent-blue-600"
                      />
                    </div>

                    <AnimatePresence initial={false}>
                      {useDistribution && (
                        <motion.div
                          initial={
                            reduceMotion
                              ? false
                              : { opacity: 0, height: 0 }
                          }
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={
                            reduceMotion
                              ? undefined
                              : { opacity: 0, height: 0 }
                          }
                          className="overflow-hidden"
                        >
                          <div className="mt-4 space-y-4 rounded-2xl bg-slate-50 p-4">
                            <div>
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-700">
                                  Pilihan Ganda
                                </p>
                                <span
                                  className={`text-[10px] font-bold ${
                                    distributionPGTotal === mcCount
                                      ? 'text-emerald-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {distributionPGTotal} / {mcCount}
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                {renderDistributionField(
                                  'Mudah',
                                  mudahCount,
                                  setMudahCount,
                                  mcCount
                                )}
                                {renderDistributionField(
                                  'Sedang',
                                  sedangCount,
                                  setSedangCount,
                                  mcCount
                                )}
                                {renderDistributionField(
                                  'Sulit',
                                  sulitCount,
                                  setSulitCount,
                                  mcCount
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-700">
                                  Isian
                                </p>
                                <span
                                  className={`text-[10px] font-bold ${
                                    distributionIsianTotal === essayCount
                                      ? 'text-emerald-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {distributionIsianTotal} / {essayCount}
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                {renderDistributionField(
                                  'Mudah',
                                  mudahIsianCount,
                                  setMudahIsianCount,
                                  essayCount
                                )}
                                {renderDistributionField(
                                  'Sedang',
                                  sedangIsianCount,
                                  setSedangIsianCount,
                                  essayCount
                                )}
                                {renderDistributionField(
                                  'Sulit',
                                  sulitIsianCount,
                                  setSulitIsianCount,
                                  essayCount
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-700">
                                  Uraian
                                </p>
                                <span
                                  className={`text-[10px] font-bold ${
                                    distributionUraianTotal === uraianCount
                                      ? 'text-emerald-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {distributionUraianTotal} / {uraianCount}
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                {renderDistributionField(
                                  'Mudah',
                                  mudahUraianCount,
                                  setMudahUraianCount,
                                  uraianCount
                                )}
                                {renderDistributionField(
                                  'Sedang',
                                  sedangUraianCount,
                                  setSedangUraianCount,
                                  uraianCount
                                )}
                                {renderDistributionField(
                                  'Sulit',
                                  sulitUraianCount,
                                  setSulitUraianCount,
                                  uraianCount
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
                      {success}
                    </div>
                  )}

                  <div className="sticky bottom-4 z-20">
                    <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-xl">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-2">
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {selectedTPs.length} TP · {totalQuestionCount} soal
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Total bobot: {totalConfiguredWeight}
                          </p>
                        </div>

                        {!distributionValid && (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600">
                            Distribusi belum sesuai
                          </span>
                        )}
                      </div>

                      <motion.div whileTap={reduceMotion ? undefined : { scale: 0.985 }}>
                        <Button
                          onClick={handleGenerate}
                          disabled={loading || !canGenerate}
                          className="w-full rounded-2xl bg-slate-950 py-6 text-sm font-black hover:bg-slate-800 disabled:opacity-50"
                          size="lg"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              AI sedang menyusun soal...
                            </>
                          ) : (
                            <>
                              ✨ Generate Soal dengan AI
                            </>
                          )}
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          </div>
        </>
      ) : (
        <motion.div
          variants={reduceMotion ? undefined : panelVariants}
          initial={reduceMotion ? false : 'hidden'}
          animate={reduceMotion ? undefined : 'visible'}
          className="space-y-6"
        >
          {success && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
              {success}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              {error}
            </div>
          )}

          <section className="rounded-[30px] bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-6 text-white shadow-2xl sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-cyan-200 backdrop-blur">
                  <span>✓</span>
                  Generate selesai
                </div>

                <h2 className="mt-4 text-2xl font-black sm:text-3xl">
                  {examTitle}
                </h2>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
                    {subject}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
                    Kelas {kelas}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
                    {duration} menit
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur">
                  <p className="text-3xl font-black">
                    {generatedQuestions.multipleChoice?.length || 0}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                    PG
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur">
                  <p className="text-3xl font-black">
                    {generatedQuestions.essay?.length || 0}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Isian
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur">
                  <p className="text-3xl font-black">
                    {(generatedQuestions.multipleChoice?.length || 0) +
                      (generatedQuestions.essay?.length || 0)}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Total
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    Review
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">
                    Preview Soal
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Tinjau kualitas soal sebelum disimpan ke Bank Soal.
                  </p>
                </div>

                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                  {selectedTPs.length} TP sumber
                </span>
              </div>
            </div>

            <div className="space-y-7 p-6">
              {generatedQuestions.multipleChoice &&
                generatedQuestions.multipleChoice.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">
                          A. Pilihan Ganda
                        </h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {generatedQuestions.multipleChoice.length} soal
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                        PG
                      </span>
                    </div>

                    <motion.div
                      variants={reduceMotion ? undefined : staggerVariants}
                      initial={reduceMotion ? false : 'hidden'}
                      animate={reduceMotion ? undefined : 'visible'}
                      className="space-y-4"
                    >
                      {generatedQuestions.multipleChoice.map((q, idx) =>
                        renderQuestionCard(q, 'PG', idx)
                      )}
                    </motion.div>
                  </div>
                )}

              {generatedQuestions.essay &&
                generatedQuestions.essay.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">
                          B. Essay / Isian
                        </h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {generatedQuestions.essay.length} soal
                        </p>
                      </div>
                      <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                        Isian
                      </span>
                    </div>

                    <motion.div
                      variants={reduceMotion ? undefined : staggerVariants}
                      initial={reduceMotion ? false : 'hidden'}
                      animate={reduceMotion ? undefined : 'visible'}
                      className="space-y-4"
                    >
                      {generatedQuestions.essay.map((q, idx) =>
                        renderQuestionCard(q, 'Essay', idx)
                      )}
                    </motion.div>
                  </div>
                )}
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Finalize
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-900">
                Simpan & Export
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Simpan ke Bank Soal atau download dokumen Word.
              </p>
            </div>

            <div className="space-y-5 p-6">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <input
                  type="checkbox"
                  checked={includeTP}
                  onChange={(e) => setIncludeTP(e.target.checked)}
                  id="includeTPExport"
                  className="mt-1 h-4 w-4 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-bold text-blue-900">
                    Sertakan TP di dokumen Word
                  </p>
                  <p className="mt-1 text-xs leading-5 text-blue-800/70">
                    TP sumber akan ditampilkan di bawah soal saat export.
                  </p>
                </div>
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  onClick={handleSaveToBankSoal}
                  disabled={saving}
                  size="lg"
                  className="rounded-xl bg-slate-950 hover:bg-slate-800"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Simpan ke Bank Soal
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleExportWord(false)}
                  size="lg"
                  variant="outline"
                  className="rounded-xl"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Soal (.docx)
                </Button>

                <Button
                  onClick={() => handleExportWord(true)}
                  size="lg"
                  variant="outline"
                  className="rounded-xl"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Download Kunci (.docx)
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => {
                    setGeneratedQuestions(null);
                    setError('');
                    setSuccess('');
                  }}
                  size="lg"
                  className="rounded-xl"
                >
                  🔄 Buat Soal Baru
                </Button>
              </div>
            </div>
          </section>
        </motion.div>
      )}
    </motion.div>
  );
}
