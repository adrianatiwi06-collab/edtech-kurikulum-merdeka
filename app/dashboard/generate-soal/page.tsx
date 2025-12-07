'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, FileText, Save } from 'lucide-react';
import { generateQuestionsAction } from './actions';
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

      const result = await generateQuestionsAction(tpTexts, {
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

  const groupedByChapter = filteredLearningGoals.reduce((acc, lg) => {
    if (!acc[lg.chapter]) {
      acc[lg.chapter] = [];
    }
    acc[lg.chapter].push(lg);
    return acc;
  }, {} as Record<string, LearningGoal[]>);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Generate Soal</h1>
        <p className="mt-2 text-gray-600">Buat soal otomatis dari Tujuan Pembelajaran</p>
      </div>

      {!generatedQuestions ? (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
          {/* TP Selection */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Pilih Tujuan Pembelajaran</CardTitle>
                <CardDescription>Pilih TP yang akan dijadikan dasar pembuatan soal</CardDescription>
              </CardHeader>
              <CardContent>
                {!subject || !kelas ? (
                  <p className="text-center text-gray-500 py-8">
                    Pilih Mata Pelajaran dan Kelas terlebih dahulu untuk melihat TP yang tersedia.
                  </p>
                ) : filteredLearningGoals.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    Tidak ada Tujuan Pembelajaran untuk {subject} Kelas {kelas}. Silakan generate TP terlebih dahulu.
                  </p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {Object.entries(groupedByChapter).map(([chapter, goals]) => (
                      <div key={chapter} className="border rounded-lg p-4">
                        <h4 className="font-semibold mb-3">{chapter}</h4>
                        <div className="space-y-2">
                          {goals.map((goal) => (
                            <div key={goal.id} className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selectedTPs.includes(goal.id)}
                                onChange={() => toggleTP(goal.id)}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <p className="text-sm">{goal.tp}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Semester {goal.semester} - Kelas {goal.grade}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Configuration */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Konfigurasi Soal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* AI Model Selector */}
                <div className="relative z-10">
                  <AIModelSelector
                    onModelChange={(model) => setSelectedModel(model)}
                    defaultModel={selectedModel}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Mata Pelajaran *</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium mb-2">Kelas *</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                <div>
                  <label className="block text-sm font-medium mb-2">Judul Ujian *</label>
                  <Input
                    placeholder="Contoh: Ulangan Harian Bab 1"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tingkat Kesulitan</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as 'mudah' | 'sedang' | 'sulit')}
                    disabled={useDistribution}
                  >
                    <option value="mudah">Mudah</option>
                    <option value="sedang">Sedang</option>
                    <option value="sulit">Sulit</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {useDistribution ? 'Nonaktif saat menggunakan distribusi tingkat kesukaran' : 'Semua soal akan menggunakan tingkat kesukaran ini'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Waktu Pengerjaan (menit)</label>
                  <Input
                    type="number"
                    min={1}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Pilihan Ganda</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm mb-1">Jumlah Soal</label>
                      <Input
                        type="number"
                        min={0}
                        value={mcCount}
                        onChange={(e) => setMcCount(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Bobot per Soal</label>
                      <Input
                        type="number"
                        min={0}
                        value={mcWeight}
                        onChange={(e) => setMcWeight(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Jumlah Opsi Jawaban</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={optionsCount}
                        onChange={(e) => setOptionsCount(Number(e.target.value) as 3 | 4 | 5)}
                      >
                        <option value={3}>3 Opsi (A, B, C)</option>
                        <option value={4}>4 Opsi (A, B, C, D)</option>
                        <option value={5}>5 Opsi (A, B, C, D, E)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Kualitas Pengecoh (Distractor)</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={distractorQuality}
                        onChange={(e) => setDistractorQuality(e.target.value as 'low' | 'medium' | 'high')}
                      >
                        <option value="low">Rendah - Pengecoh cukup berbeda</option>
                        <option value="medium">Sedang - Pengecoh mirip strukturnya</option>
                        <option value="high">Tinggi - Pengecoh sangat plausible (HOTS)</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Kualitas tinggi cocok untuk soal sulit, membuat pengecoh lebih menantang
                      </p>
                    </div>
                    
                    <div className="border-t pt-3 mt-3">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          checked={useDistribution}
                          onChange={(e) => setUseDistribution(e.target.checked)}
                          id="useDistribution"
                          className="w-4 h-4"
                        />
                        <label htmlFor="useDistribution" className="text-sm font-medium">
                          Gunakan Distribusi Tingkat Kesukaran
                        </label>
                      </div>
                      
                      {useDistribution && (
                        <div className="space-y-3 bg-blue-50 p-3 rounded-md">
                          <p className="text-xs text-blue-700 mb-2">
                            Atur distribusi tingkat kesukaran untuk Pilihan Ganda dan Isian
                          </p>
                          
                          {/* PG Distribution */}
                          <div className="bg-white p-3 rounded border">
                            <h5 className="font-medium text-sm mb-2">📝 Distribusi Pilihan Ganda</h5>
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs mb-1">
                                  Mudah (C1-C2: Hafalan/Faktual)
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={mcCount}
                                  value={mudahCount}
                                  onChange={(e) => setMudahCount(Number(e.target.value))}
                                  className="bg-white"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs mb-1">
                                  Sedang (C3: Aplikasi Prosedural)
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={mcCount}
                                  value={sedangCount}
                                  onChange={(e) => setSedangCount(Number(e.target.value))}
                                  className="bg-white"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs mb-1">
                                  Sulit (C4-C6: HOTS/Analisis)
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={mcCount}
                                  value={sulitCount}
                                  onChange={(e) => setSulitCount(Number(e.target.value))}
                                  className="bg-white"
                                />
                              </div>
                              
                              <div className="flex items-center justify-between text-xs pt-2 border-t">
                                <span className="font-medium">Total PG:</span>
                                <span className={
                                  mudahCount + sedangCount + sulitCount === mcCount
                                    ? "text-green-600 font-bold"
                                    : "text-red-600 font-bold"
                                }>
                                  {mudahCount + sedangCount + sulitCount} / {mcCount}
                                </span>
                              </div>
                              
                              {mudahCount + sedangCount + sulitCount !== mcCount && (
                                <p className="text-xs text-red-600">
                                  ⚠️ Total harus sama dengan jumlah soal PG ({mcCount})
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* Isian Distribution */}
                          <div className="bg-white p-3 rounded border">
                            <h5 className="font-medium text-sm mb-2">✏️ Distribusi Isian Singkat</h5>
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs mb-1">
                                  Mudah (C1-C2: Hafalan/Faktual)
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={essayCount}
                                  value={mudahIsianCount}
                                  onChange={(e) => setMudahIsianCount(Number(e.target.value))}
                                  className="bg-white"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs mb-1">
                                  Sedang (C3: Aplikasi Prosedural)
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={essayCount}
                                  value={sedangIsianCount}
                                  onChange={(e) => setSedangIsianCount(Number(e.target.value))}
                                  className="bg-white"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs mb-1">
                                  Sulit (C4-C6: HOTS/Analisis)
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={essayCount}
                                  value={sulitIsianCount}
                                  onChange={(e) => setSulitIsianCount(Number(e.target.value))}
                                  className="bg-white"
                                />
                              </div>
                              
                              <div className="flex items-center justify-between text-xs pt-2 border-t">
                                <span className="font-medium">Total Isian:</span>
                                <span className={
                                  mudahIsianCount + sedangIsianCount + sulitIsianCount === essayCount
                                    ? "text-green-600 font-bold"
                                    : "text-red-600 font-bold"
                                }>
                                  {mudahIsianCount + sedangIsianCount + sulitIsianCount} / {essayCount}
                                </span>
                              </div>
                              
                              {mudahIsianCount + sedangIsianCount + sulitIsianCount !== essayCount && (
                                <p className="text-xs text-red-600">
                                  ⚠️ Total harus sama dengan jumlah soal Isian ({essayCount})
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* Uraian Distribution */}
                          <div className="bg-white p-3 rounded border">
                            <h5 className="font-medium text-sm mb-2">📝 Distribusi Uraian/Essay</h5>
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs mb-1">
                                  Mudah (C1-C2: Hafalan/Faktual)
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={uraianCount}
                                  value={mudahUraianCount}
                                  onChange={(e) => setMudahUraianCount(Number(e.target.value))}
                                  className="bg-white"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs mb-1">
                                  Sedang (C3: Aplikasi Prosedural)
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={uraianCount}
                                  value={sedangUraianCount}
                                  onChange={(e) => setSedangUraianCount(Number(e.target.value))}
                                  className="bg-white"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs mb-1">
                                  Sulit (C4-C6: HOTS/Analisis)
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={uraianCount}
                                  value={sulitUraianCount}
                                  onChange={(e) => setSulitUraianCount(Number(e.target.value))}
                                  className="bg-white"
                                />
                              </div>
                              
                              <div className="flex items-center justify-between text-xs pt-2 border-t">
                                <span className="font-medium">Total Uraian:</span>
                                <span className={
                                  mudahUraianCount + sedangUraianCount + sulitUraianCount === uraianCount
                                    ? "text-green-600 font-bold"
                                    : "text-red-600 font-bold"
                                }>
                                  {mudahUraianCount + sedangUraianCount + sulitUraianCount} / {uraianCount}
                                </span>
                              </div>
                              
                              {mudahUraianCount + sedangUraianCount + sulitUraianCount !== uraianCount && (
                                <p className="text-xs text-red-600">
                                  ⚠️ Total harus sama dengan jumlah soal Uraian ({uraianCount})
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* Grand Total */}
                          <div className="bg-green-50 p-2 rounded text-center">
                            <p className="text-sm font-bold text-green-800">
                              Total Keseluruhan: {mudahCount + sedangCount + sulitCount + mudahIsianCount + sedangIsianCount + sulitIsianCount + mudahUraianCount + sedangUraianCount + sulitUraianCount} soal
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              PG: {mudahCount + sedangCount + sulitCount} | Isian: {mudahIsianCount + sedangIsianCount + sulitIsianCount} | Uraian: {mudahUraianCount + sedangUraianCount + sulitUraianCount}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Isian Singkat</h4>
                  <p className="text-xs text-gray-600 mb-2">
                    Soal jawaban singkat (1-3 kata), bukan uraian panjang. Contoh: "Berapa hasil 5 + 3?" → "8"
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm mb-1">Jumlah Soal</label>
                      <Input
                        type="number"
                        min={0}
                        value={essayCount}
                        onChange={(e) => setEssayCount(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Bobot per Soal</label>
                      <Input
                        type="number"
                        min={0}
                        value={essayWeight}
                        onChange={(e) => setEssayWeight(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">📝 Soal Uraian/Essay</h4>
                  <p className="text-xs text-gray-600 mb-3">
                    Soal yang membutuhkan jawaban panjang dan mendalam. 
                    <br />
                    <span className="text-blue-600 font-medium">
                      • Kelas 1-2: Uraian sangat sederhana (1 kalimat)
                      <br />
                      • Kelas 3-6: Uraian bebas dengan analisis
                    </span>
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm mb-1">Jumlah Soal</label>
                      <Input
                        type="number"
                        min={0}
                        value={uraianCount}
                        onChange={(e) => setUraianCount(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Bobot per Soal</label>
                      <Input
                        type="number"
                        min={0}
                        value={uraianWeight}
                        onChange={(e) => setUraianWeight(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeImage}
                      onChange={(e) => setIncludeImage(e.target.checked)}
                      id="includeImage"
                    />
                    <label htmlFor="includeImage" className="text-sm">
                      Sertakan deskripsi gambar pada soal (AI akan generate deskripsi gambar yang relevan)
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                    {success}
                  </div>
                )}

                <Button onClick={handleGenerate} disabled={loading || !subject || !kelas} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Soal'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {success && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-green-900">{success}</p>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-red-900">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Summary Card */}
          <Card className="bg-gradient-to-r from-green-500 to-emerald-300 text-white">
            <CardContent className="pt-6">
              <div className="flex justify-around text-center">
                <div>
                  <div className="text-4xl font-bold">{generatedQuestions.multipleChoice?.length || 0}</div>
                  <div className="text-sm opacity-90">Soal PG</div>
                </div>
                <div className="w-px bg-white/30"></div>
                <div>
                  <div className="text-4xl font-bold">{generatedQuestions.essay?.length || 0}</div>
                  <div className="text-sm opacity-90">Soal Essay</div>
                </div>
                <div className="w-px bg-white/30"></div>
                <div>
                  <div className="text-4xl font-bold">
                    {(generatedQuestions.multipleChoice?.length || 0) + (generatedQuestions.essay?.length || 0)}
                  </div>
                  <div className="text-sm opacity-90">Total Soal</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview Questions */}
          <Card>
            <CardHeader>
              <CardTitle>Preview Soal</CardTitle>
              <CardDescription>Scroll ke bawah untuk melihat semua soal yang telah dibuat</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-h-[600px] overflow-y-auto">
              {/* Multiple Choice */}
              {generatedQuestions.multipleChoice && generatedQuestions.multipleChoice.length > 0 && (
                <div>
                  <div className="bg-blue-500 text-white px-4 py-3 rounded-t-lg flex items-center gap-2">
                    <span className="text-lg">📝</span>
                    <h3 className="font-bold text-lg">A. PILIHAN GANDA</h3>
                    <span className="ml-auto bg-white/20 px-3 py-1 rounded-full text-sm">
                      {generatedQuestions.multipleChoice.length} soal
                    </span>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-b-lg space-y-4">
                    {generatedQuestions.multipleChoice.map((q, idx) => {
                      const wordCount = q.question.split(' ').length;
                      const wordBadgeColor = wordCount <= 10 ? 'bg-green-500' : wordCount <= 15 ? 'bg-yellow-500' : 'bg-red-500';
                      const hasImageDesc = q.imageDescription && q.imageDescription.trim() !== '';
                      
                      return (
                        <div key={idx} className="bg-white rounded-lg shadow-sm border-l-4 border-blue-500 p-4">
                          {/* Question Header */}
                          <div className="flex justify-between items-center mb-3">
                            <div className="font-bold text-blue-900 flex items-center gap-2">
                              <span className="text-blue-600">❓</span>
                              Soal {q.questionNumber}
                            </div>
                            <div className="flex gap-2">
                              {hasImageDesc && (
                                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                  <span>🖼️</span> Gambar
                                </span>
                              )}
                              <span className={`${wordBadgeColor} text-white px-2 py-1 rounded text-xs font-bold`}>
                                {wordCount} kata
                              </span>
                            </div>
                          </div>
                          
                          {/* Question Text */}
                          <p className="text-gray-800 mb-3 leading-relaxed">{q.question}</p>
                          
                          {/* Image Placeholder Box */}
                          {hasImageDesc && (
                            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 mb-3">
                              <div className="flex items-start gap-3">
                                <div className="bg-yellow-100 p-2 rounded">
                                  <span className="text-2xl">🖼️</span>
                                </div>
                                <div className="flex-1">
                                  <div className="text-xs font-bold text-gray-600 mb-1">TEMPAT GAMBAR/ILUSTRASI:</div>
                                  <p className="text-sm text-gray-700 italic">{q.imageDescription}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Options */}
                          <div className="space-y-2 mb-3">
                            {Object.entries(q.options).map(([key, value]) => {
                              const isCorrect = key === q.correctAnswer;
                              return (
                                <div
                                  key={key}
                                  className={`flex items-start gap-3 p-2 rounded-lg border-l-3 ${
                                    isCorrect
                                      ? 'bg-green-50 border-green-500 border-l-4'
                                      : 'bg-gray-50 border-gray-200 border-l-2'
                                  }`}
                                >
                                  <span className={`font-bold min-w-[24px] ${
                                    isCorrect ? 'text-green-700' : 'text-gray-600'
                                  }`}>
                                    {key}.
                                  </span>
                                  <span className={isCorrect ? 'text-green-700' : 'text-gray-700'}>
                                    {value}
                                  </span>
                                  {isCorrect && <span className="ml-auto text-green-500">✓</span>}
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Footer */}
                          <div className="flex justify-between items-center pt-3 border-t text-xs text-gray-500">
                            <div>
                              <span className="font-bold">🎯 Kunci:</span>{' '}
                              <span className="text-green-600 font-bold text-sm">{q.correctAnswer}</span>
                            </div>
                            <div>
                              <span className="font-bold">⚖️ Bobot:</span> {q.weight}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Essay */}
              {generatedQuestions.essay && generatedQuestions.essay.length > 0 && (
                <div>
                  <div className="bg-purple-500 text-white px-4 py-3 rounded-t-lg flex items-center gap-2">
                    <span className="text-lg">✍️</span>
                    <h3 className="font-bold text-lg">B. ESSAY/ISIAN</h3>
                    <span className="ml-auto bg-white/20 px-3 py-1 rounded-full text-sm">
                      {generatedQuestions.essay.length} soal
                    </span>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-b-lg space-y-4">
                    {generatedQuestions.essay.map((q, idx) => {
                      const wordCount = q.question.split(' ').length;
                      const wordBadgeColor = wordCount <= 15 ? 'bg-green-500' : wordCount <= 20 ? 'bg-yellow-500' : 'bg-red-500';
                      const hasImageDesc = q.imageDescription && q.imageDescription.trim() !== '';
                      
                      return (
                        <div key={idx} className="bg-white rounded-lg shadow-sm border-l-4 border-purple-500 p-4">
                          {/* Question Header */}
                          <div className="flex justify-between items-center mb-3">
                            <div className="font-bold text-purple-900 flex items-center gap-2">
                              <span className="text-purple-600">✏️</span>
                              Soal {q.questionNumber}
                            </div>
                            <div className="flex gap-2">
                              {hasImageDesc && (
                                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                  <span>🖼️</span> Gambar
                                </span>
                              )}
                              <span className={`${wordBadgeColor} text-white px-2 py-1 rounded text-xs font-bold`}>
                                {wordCount} kata
                              </span>
                            </div>
                          </div>
                          
                          {/* Question Text */}
                          <p className="text-gray-800 mb-3 leading-relaxed">{q.question}</p>
                          
                          {/* Image Placeholder Box */}
                          {hasImageDesc && (
                            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 mb-3">
                              <div className="flex items-start gap-3">
                                <div className="bg-yellow-100 p-2 rounded">
                                  <span className="text-2xl">🖼️</span>
                                </div>
                                <div className="flex-1">
                                  <div className="text-xs font-bold text-gray-600 mb-1">TEMPAT GAMBAR/ILUSTRASI:</div>
                                  <p className="text-sm text-gray-700 italic">{q.imageDescription}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Rubric */}
                          {q.rubric && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded mt-3">
                              <div className="text-xs font-bold text-yellow-800 mb-1">💡 RUBRIK PENILAIAN:</div>
                              <p className="text-sm text-yellow-900">{q.rubric}</p>
                            </div>
                          )}
                          
                          {/* Footer */}
                          <div className="flex justify-between items-center pt-3 border-t text-xs text-gray-500 mt-3">
                            <div>
                              <span className="font-bold">⚖️ Bobot:</span> {q.weight}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle>Export & Download</CardTitle>
              <CardDescription>Simpan atau download soal yang telah dibuat</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Checkbox for includeTP - only affects Word export */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={includeTP}
                    onChange={(e) => setIncludeTP(e.target.checked)}
                    id="includeTPExport"
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="includeTPExport" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Sertakan Tujuan Pembelajaran (TP) di dokumen Word
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      ✓ Jika dicentang, teks TP akan ditampilkan di bawah setiap soal saat download ke Word
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleSaveToBankSoal} disabled={saving} size="lg" variant="default">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Simpan ke Bank Soal
                    </>
                  )}
                </Button>
                <Button onClick={() => handleExportWord(false)} size="lg" variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download Soal (.docx)
                </Button>
                <Button onClick={() => handleExportWord(true)} size="lg" variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  Download Kunci Jawaban (.docx)
                </Button>
                <Button variant="ghost" onClick={() => { setGeneratedQuestions(null); setError(''); setSuccess(''); }} size="lg">
                  🔄 Buat Soal Baru
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
