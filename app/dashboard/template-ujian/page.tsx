'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTemplate, LearningGoal } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

type Step = 0 | 1 | 2 | 3; // 0 for saved templates view

export default function TemplateUjianPage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [currentStep, setCurrentStep] = useState<Step>(0);
  
  // Saved templates
  const [savedTemplates, setSavedTemplates] = useState<ExamTemplate[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showSavedTemplates, setShowSavedTemplates] = useState(true);
  
  // Step 1: Exam Info
  const [examName, setExamName] = useState('');
  const [examType, setExamType] = useState<'PAS' | 'PTS' | 'PAT' | 'Ulangan' | 'Kuis'>('PAS');
  const [selectedGrade, setSelectedGrade] = useState('1');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(1);
  
  // Step 2: TP Selection
  const [availableTPs, setAvailableTPs] = useState<LearningGoal[]>([]);
  const [selectedTPs, setSelectedTPs] = useState<Set<string>>(new Set());
  const [loadingTPs, setLoadingTPs] = useState(false);
  
  // Step 3: Question Config
  const [pgCount, setPgCount] = useState(20);
  const [pgWeight, setPgWeight] = useState(1);
  const [pgAnswerKeys, setPgAnswerKeys] = useState<string[]>(Array(20).fill(''));
  const [pgTPMapping, setPgTPMapping] = useState<{ [key: number]: string }>({});
  
  const [essayCount, setEssayCount] = useState(5);
  const [essayWeight, setEssayWeight] = useState(4);
  const [essayTPMapping, setEssayTPMapping] = useState<{ [key: number]: string }>({});
  
  const [saving, setSaving] = useState(false);

  const subjects = [
    'Pendidikan Agama Islam',
    'Pendidikan Agama Kristen',
    'Pendidikan Agama Katolik',
    'Pendidikan Agama Hindu',
    'Pendidikan Agama Buddha',
    'Pendidikan Agama Khonghucu',
    'Pendidikan Pancasila',
    'Bahasa Indonesia',
    'Matematika',
    'IPAS (Ilmu Pengetahuan Alam dan Sosial)',
    'Pendidikan Jasmani Olahraga dan Kesehatan (PJOK)',
    'Seni dan Budaya',
    'Bahasa Inggris',
    'Bahasa Daerah',
    'Seni Rupa',
    'Seni Musik',
    'Seni Tari',
    'Seni Teater',
  ];

  const grades = ['1', '2', '3', '4', '5', '6'];

  // Load saved templates on mount
  useEffect(() => {
    if (user && showSavedTemplates) {
      loadSavedTemplates();
    }
  }, [user, showSavedTemplates]);

  // Load TPs when filters change
  useEffect(() => {
    if (currentStep === 2 && user && selectedGrade && selectedSubject && selectedSemester) {
      loadTPs();
    }
  }, [currentStep, user, selectedGrade, selectedSubject, selectedSemester]);

  const loadSavedTemplates = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'exam_templates'),
        where('user_id', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const templates: ExamTemplate[] = [];
      snapshot.forEach((doc) => {
        templates.push({ id: doc.id, ...doc.data() } as ExamTemplate);
      });
      // Sort by created_at descending
      templates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSavedTemplates(templates);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Gagal memuat template tersimpan');
    }
  };

  const handleEditTemplate = (template: ExamTemplate) => {
    // Load template data into state
    setEditingTemplateId(template.id);
    setExamName(template.exam_name);
    setExamType(template.exam_type);
    setSelectedGrade(template.grade);
    setSelectedSubject(template.subject);
    setSelectedSemester(template.semester);
    
    // Set TP selection
    const tpIds = new Set(template.tp_ids);
    setSelectedTPs(tpIds);
    
    // Set question config
    setPgCount(template.multiple_choice.count);
    setPgWeight(template.multiple_choice.weight);
    setPgAnswerKeys(template.multiple_choice.answer_keys);
    
    // tp_mapping is already an object { [questionNumber]: tpId }
    setPgTPMapping(template.multiple_choice.tp_mapping);
    
    setEssayCount(template.essay.count);
    setEssayWeight(template.essay.weight);
    
    // Essay mapping
    setEssayTPMapping(template.essay.tp_mapping);
    
    setShowSavedTemplates(false);
    setCurrentStep(1);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Yakin ingin menghapus template ini?')) return;
    
    try {
      await deleteDoc(doc(db, 'exam_templates', templateId));
      toast.success('Template berhasil dihapus');
      loadSavedTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Gagal menghapus template');
    }
  };

  const handleStartNewTemplate = () => {
    // Reset all states
    setEditingTemplateId(null);
    setExamName('');
    setExamType('PAS');
    setSelectedGrade('1');
    setSelectedSubject('');
    setSelectedSemester(1);
    setSelectedTPs(new Set());
    setPgCount(20);
    setPgWeight(1);
    setPgAnswerKeys(Array(20).fill(''));
    setPgTPMapping({});
    setEssayCount(5);
    setEssayWeight(4);
    setEssayTPMapping({});
    setShowSavedTemplates(false);
    setCurrentStep(1);
  };

  const loadTPs = async () => {
    if (!user) return;
    
    setLoadingTPs(true);
    try {
      const q = query(
        collection(db, 'learning_goals'),
        where('user_id', '==', user.uid),
        where('grade', '==', selectedGrade),
        where('subject', '==', selectedSubject),
        where('semester', '==', selectedSemester)
      );
      
      const snapshot = await getDocs(q);
      const tps: LearningGoal[] = [];
      snapshot.forEach((doc) => {
        tps.push({ id: doc.id, ...doc.data() } as LearningGoal);
      });
      
      setAvailableTPs(tps);
    } catch (error) {
      console.error('Error loading TPs:', error);
      toast.error('Gagal memuat TP');
    } finally {
      setLoadingTPs(false);
    }
  };

  const handleStep1Next = () => {
    if (!examName.trim()) {
      toast.error('Nama ujian harus diisi');
      return;
    }
    if (!selectedSubject) {
      toast.error('Mata pelajaran harus dipilih');
      return;
    }
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    if (selectedTPs.size === 0) {
      toast.error('Pilih minimal 1 TP');
      return;
    }
    setCurrentStep(3);
  };

  const toggleTPSelection = (tpId: string) => {
    const newSet = new Set(selectedTPs);
    if (newSet.has(tpId)) {
      newSet.delete(tpId);
    } else {
      newSet.add(tpId);
    }
    setSelectedTPs(newSet);
  };

  // Select/Deselect All Functions
  const handleSelectAllTPs = () => {
    const allIds = new Set(availableTPs.map(tp => tp.id));
    setSelectedTPs(allIds);
  };

  const handleClearTPs = () => {
    setSelectedTPs(new Set());
  };

  const handlePgCountChange = (newCount: number) => {
    setPgCount(newCount);
    
    // Pertahankan jawaban yang sudah ada saat mengubah ukuran array
    setPgAnswerKeys(prev => {
      const newKeys = [...prev];
      if (newCount > prev.length) {
        return [...newKeys, ...Array(newCount - prev.length).fill('')];
      }
      return newKeys.slice(0, newCount);
    });

    // Cleanup mapping TP
    setPgTPMapping(prev => {
      const newMapping = { ...prev };
      Object.keys(newMapping).forEach(key => {
        if (parseInt(key) > newCount) {
          delete newMapping[parseInt(key)];
        }
      });
      return newMapping;
    });
  };

  const handleEssayCountChange = (newCount: number) => {
    setEssayCount(newCount);
    
    // Cleanup mappings
    setEssayTPMapping(prev => {
      const newMapping = { ...prev };
      Object.keys(newMapping).forEach(key => {
        if (parseInt(key) > newCount) {
          delete newMapping[parseInt(key)];
        }
      });
      return newMapping;
    });
  };

  const autoDistributeTPs = () => {
    if (selectedTPs.size === 0) return;
    
    const tpArray = Array.from(selectedTPs);
    const totalQuestions = pgCount + essayCount;
    
    const newPgMapping: { [key: number]: string } = {};
    const newEssayMapping: { [key: number]: string } = {};
    
    for (let i = 1; i <= totalQuestions; i++) {
      const tpIndex = (i - 1) % tpArray.length;
      const tpId = tpArray[tpIndex];
      
      if (i <= pgCount) {
        newPgMapping[i] = tpId;
      } else {
        newEssayMapping[i - pgCount] = tpId;
      }
    }
    
    setPgTPMapping(newPgMapping);
    setEssayTPMapping(newEssayMapping);
    toast.success('Distribusi TP otomatis berhasil diterapkan');
  };

  const handleSaveTemplate = async () => {
    if (!user) return;
    
    // Validation
    const allPGAnswered = pgAnswerKeys.every((key, idx) => idx >= pgCount || key !== '');
    if (!allPGAnswered) {
      toast.error('Semua kunci jawaban PG harus diisi');
      return;
    }
    
    const allPGMapped = Object.keys(pgTPMapping).length === pgCount;
    if (!allPGMapped) {
      toast.error('Semua soal PG harus dipetakan ke TP');
      return;
    }
    
    const allEssayMapped = Object.keys(essayTPMapping).length === essayCount;
    if (!allEssayMapped) {
      toast.error('Semua soal Isian harus dipetakan ke TP');
      return;
    }
    
    setSaving(true);
    
    try {
      // Build tp_details with question_numbers
      const tpDetails = Array.from(selectedTPs).map(tpId => {
        const tp = availableTPs.find(t => t.id === tpId);
        const questionNumbers: number[] = [];
        
        // Add PG questions
        Object.entries(pgTPMapping).forEach(([qNum, mappedTpId]) => {
          if (mappedTpId === tpId) {
            questionNumbers.push(parseInt(qNum));
          }
        });
        
        // Add Essay questions (offset by pgCount)
        Object.entries(essayTPMapping).forEach(([qNum, mappedTpId]) => {
          if (mappedTpId === tpId) {
            questionNumbers.push(pgCount + parseInt(qNum));
          }
        });
        
        return {
          tp_id: tpId,
          chapter: tp?.chapter || '',
          tp_text: tp?.tp || '',
          question_numbers: questionNumbers.sort((a, b) => a - b)
        };
      });
      
      const totalQuestions = pgCount + essayCount;
      const maxScore = (pgCount * pgWeight) + (essayCount * essayWeight);
      
      const template: Omit<ExamTemplate, 'id'> = {
        user_id: user.uid,
        exam_name: examName.trim(),
        exam_type: examType,
        grade: selectedGrade,
        subject: selectedSubject,
        semester: selectedSemester,
        tp_ids: Array.from(selectedTPs),
        tp_details: tpDetails,
        multiple_choice: {
          count: pgCount,
          weight: pgWeight,
          answer_keys: pgAnswerKeys.slice(0, pgCount),
          tp_mapping: pgTPMapping
        },
        essay: {
          count: essayCount,
          weight: essayWeight,
          tp_mapping: essayTPMapping
        },
        total_questions: totalQuestions,
        max_score: maxScore,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (editingTemplateId) {
        // Update existing template - don't include created_at
        const { created_at, ...updateData } = template;
        await updateDoc(doc(db, 'exam_templates', editingTemplateId), updateData);
        toast.success('Template ujian berhasil diperbarui!');
      } else {
        // Create new template
        await addDoc(collection(db, 'exam_templates'), template);
        toast.success('Template ujian berhasil disimpan!');
      }
      
      // Reset form and go back to saved templates
      setEditingTemplateId(null);
      setCurrentStep(0);
      setShowSavedTemplates(true);
      setExamName('');
      setSelectedTPs(new Set());
      setPgAnswerKeys(Array(20).fill(''));
      setPgTPMapping({});
      setEssayTPMapping({});
      loadSavedTemplates();
      
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Gagal menyimpan template');
    } finally {
      setSaving(false);
    }
  };


  const selectedTPDetails = Array.from(selectedTPs)
    .map((id) => availableTPs.find((tp) => tp.id === id))
    .filter(Boolean) as LearningGoal[];

  const totalQuestions = pgCount + essayCount;
  const maxScore = pgCount * pgWeight + essayCount * essayWeight;
  const mappedPG = Object.keys(pgTPMapping).length;
  const mappedEssay = Object.keys(essayTPMapping).length;
  const answeredPG = pgAnswerKeys.slice(0, pgCount).filter(Boolean).length;

  const pageIn = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
      };

  const stepItems = [
    { id: 1, title: 'Info Ujian', subtitle: 'Identitas & konteks' },
    { id: 2, title: 'Pilih TP', subtitle: 'Kompetensi yang diukur' },
    { id: 3, title: 'Konfigurasi', subtitle: 'Jumlah, bobot & pemetaan' },
  ];

  return (
    <motion.div className="space-y-7" {...pageIn}>
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-60 w-60 rounded-full bg-violet-100/50 blur-3xl" />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                <span>✨</span>
                Exam Builder Workspace
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Template Ujian
                <span className="block bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
                  buat ujian lebih terstruktur
                </span>
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                Susun identitas ujian, pilih Tujuan Pembelajaran, lalu petakan setiap
                soal agar template siap digunakan dan dianalisis.
              </p>
            </div>

            {showSavedTemplates && currentStep === 0 && (
              <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
                <Button
                  onClick={handleStartNewTemplate}
                  size="lg"
                  className="rounded-2xl bg-slate-950 px-5 shadow-lg hover:bg-slate-800"
                >
                  + Buat Template Baru
                </Button>
              </motion.div>
            )}
          </div>

          {(!showSavedTemplates || currentStep > 0) && (
            <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
              {stepItems.map((step) => {
                const active = currentStep === step.id;
                const done = currentStep > step.id;
                return (
                  <motion.div
                    key={step.id}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                    className={`rounded-2xl border p-4 ${
                      active
                        ? 'border-blue-200 bg-blue-50'
                        : done
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-black ${
                          active
                            ? 'bg-blue-600 text-white'
                            : done
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white text-slate-400'
                        }`}
                      >
                        {done ? '✓' : step.id}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{step.title}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{step.subtitle}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* SAVED TEMPLATES */}
      <AnimatePresence mode="wait">
        {showSavedTemplates && currentStep === 0 && (
          <motion.section
            key="saved"
            {...(reduceMotion ? {} : {
              initial: { opacity: 0, y: 12 },
              animate: { opacity: 1, y: 0 },
              exit: { opacity: 0, y: -8 },
              transition: { duration: 0.35 }
            })}
          >
            <Card className="rounded-[30px] border-slate-200 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-100 p-6 sm:p-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Library</p>
                    <h2 className="mt-1 text-xl font-black text-slate-900">Template tersimpan</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {savedTemplates.length} template siap digunakan kembali.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                    {savedTemplates.length} Template
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-7">
                {savedTemplates.length === 0 ? (
                  <div className="rounded-[26px] border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                      ✦
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Belum ada template</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                      Buat template pertama untuk menyimpan struktur ujian dan pemetaan TP.
                    </p>
                    <Button onClick={handleStartNewTemplate} className="mt-5 rounded-xl">
                      + Buat Template Pertama
                    </Button>
                  </div>
                ) : (
                  <motion.div
                    className="grid grid-cols-1 gap-4 xl:grid-cols-2"
                    initial={reduceMotion ? false : 'hidden'}
                    animate={reduceMotion ? undefined : 'visible'}
                    variants={{
                      hidden: {},
                      visible: { transition: { staggerChildren: 0.06 } },
                    }}
                  >
                    {savedTemplates.map((template) => (
                      <motion.div
                        key={template.id}
                        variants={reduceMotion ? undefined : {
                          hidden: { opacity: 0, y: 12 },
                          visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
                        }}
                        whileHover={reduceMotion ? undefined : { y: -4 }}
                        className="group rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_6px_24px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_16px_38px_rgba(15,23,42,0.08)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-black text-slate-900">
                              {template.exam_name}
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                                {template.exam_type}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                                Kelas {template.grade}
                              </span>
                              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                                Semester {template.semester}
                              </span>
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-950 px-3 py-2 text-center text-white">
                            <div className="text-xl font-black">{template.max_score}</div>
                            <div className="text-[9px] uppercase tracking-wider text-slate-400">poin</div>
                          </div>
                        </div>

                        <p className="mt-4 text-sm font-semibold text-slate-700">{template.subject}</p>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-emerald-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">PG</p>
                            <p className="mt-1 text-sm font-black text-emerald-800">{template.multiple_choice.count}</p>
                          </div>
                          <div className="rounded-xl bg-violet-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Essay</p>
                            <p className="mt-1 text-sm font-black text-violet-800">{template.essay.count}</p>
                          </div>
                          <div className="rounded-xl bg-blue-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">TP</p>
                            <p className="mt-1 text-sm font-black text-blue-800">{template.tp_ids.length}</p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                          <Button onClick={() => handleEditTemplate(template)} variant="outline" className="rounded-xl">
                            ✏ Edit
                          </Button>
                          <Button
                            onClick={() => handleDeleteTemplate(template.id)}
                            variant="destructive"
                            className="rounded-xl"
                          >
                            🗑 Hapus
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </Card>
          </motion.section>
        )}

        {/* STEP 1 */}
        {!showSavedTemplates && currentStep === 1 && (
          <motion.section
            key="step1"
            {...(reduceMotion ? {} : {
              initial: { opacity: 0, x: 15 },
              animate: { opacity: 1, x: 0 },
              exit: { opacity: 0, x: -15 },
              transition: { duration: 0.35 }
            })}
          >
            <Card className="rounded-[30px] border-slate-200 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-100 p-6 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Langkah 1</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Informasi ujian</h2>
                <p className="mt-1 text-sm text-slate-500">Tentukan identitas dasar template yang akan dibuat.</p>
              </div>

              <div className="grid grid-cols-1 gap-5 p-6 sm:p-7 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-slate-700">Nama Ujian *</label>
                  <Input
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="Contoh: PAS Matematika Semester 1"
                    className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Jenis Ujian</label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    value={examType}
                    onChange={(e) => setExamType(e.target.value as any)}
                  >
                    <option value="PAS">PAS</option>
                    <option value="PTS">PTS</option>
                    <option value="PAT">PAT</option>
                    <option value="Ulangan">Ulangan Harian</option>
                    <option value="Kuis">Kuis</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Kelas</label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                  >
                    {grades.map((g) => (
                      <option key={g} value={g}>Kelas {g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Mata Pelajaran *</label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                  >
                    <option value="">Pilih mata pelajaran</option>
                    {subjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Semester</label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(parseInt(e.target.value) as 1 | 2)}
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 p-6 sm:flex-row sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentStep(0);
                    setShowSavedTemplates(true);
                  }}
                  className="rounded-xl"
                >
                  ← Daftar Template
                </Button>
                <Button onClick={handleStep1Next} className="rounded-xl bg-slate-950 hover:bg-slate-800">
                  Lanjut ke Pemilihan TP →
                </Button>
              </div>
            </Card>
          </motion.section>
        )}

        {/* STEP 2 */}
        {!showSavedTemplates && currentStep === 2 && (
          <motion.section
            key="step2"
            {...(reduceMotion ? {} : {
              initial: { opacity: 0, x: 15 },
              animate: { opacity: 1, x: 0 },
              exit: { opacity: 0, x: -15 },
              transition: { duration: 0.35 }
            })}
          >
            <Card className="rounded-[30px] border-slate-200 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-100 p-6 sm:p-7">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Langkah 2</p>
                    <h2 className="mt-1 text-xl font-black text-slate-900">Pilih Tujuan Pembelajaran</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Kelas {selectedGrade} · {selectedSubject} · Semester {selectedSemester}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                      {selectedTPs.size} dipilih
                    </span>
                    <Button size="sm" variant="outline" onClick={handleSelectAllTPs} className="rounded-xl">
                      Pilih Semua
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleClearTPs} className="rounded-xl text-red-600">
                      Kosongkan
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-7">
                {loadingTPs ? (
                  <div className="flex flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-slate-50 p-12">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
                    <p className="mt-4 text-sm font-semibold text-slate-500">Memuat TP...</p>
                  </div>
                ) : availableTPs.length === 0 ? (
                  <div className="rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                    <h3 className="font-bold text-slate-800">TP belum tersedia</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                      Tidak ada TP untuk kombinasi kelas, mapel, dan semester ini.
                      Buat terlebih dahulu melalui Generate TP.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                    {availableTPs.map((tp) => {
                      const selected = selectedTPs.has(tp.id);
                      return (
                        <motion.button
                          key={tp.id}
                          type="button"
                          onClick={() => toggleTPSelection(tp.id)}
                          whileHover={reduceMotion ? undefined : { y: -1 }}
                          whileTap={reduceMotion ? undefined : { scale: 0.995 }}
                          className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                            selected
                              ? 'border-blue-300 bg-blue-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              selected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {selected && '✓'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              {tp.chapter}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">{tp.tp}</p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 p-6 sm:flex-row sm:justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)} className="rounded-xl">
                  ← Kembali
                </Button>
                <Button
                  onClick={handleStep2Next}
                  disabled={selectedTPs.size === 0}
                  className="rounded-xl bg-slate-950 hover:bg-slate-800"
                >
                  Lanjut ke Konfigurasi ({selectedTPs.size} TP)
                </Button>
              </div>
            </Card>
          </motion.section>
        )}

        {/* STEP 3 */}
        {!showSavedTemplates && currentStep === 3 && (
          <motion.section
            key="step3"
            {...(reduceMotion ? {} : {
              initial: { opacity: 0, x: 15 },
              animate: { opacity: 1, x: 0 },
              transition: { duration: 0.35 }
            })}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-5">
                {/* SUMMARY */}
                <Card className="rounded-[30px] border-slate-200 p-6 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Ringkasan</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">Struktur ujian</h2>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-blue-50 p-3 text-center">
                      <p className="text-2xl font-black text-blue-700">{totalQuestions}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500">Soal</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                      <p className="text-2xl font-black text-emerald-700">{maxScore}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">Poin</p>
                    </div>
                    <div className="rounded-2xl bg-violet-50 p-3 text-center">
                      <p className="text-2xl font-black text-violet-700">{selectedTPs.size}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">TP</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Pilihan Ganda</span><span className="font-bold">{pgCount} × {pgWeight}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Isian</span><span className="font-bold">{essayCount} × {essayWeight}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Kunci PG</span><span className={`font-bold ${answeredPG === pgCount ? 'text-emerald-600' : 'text-amber-600'}`}>{answeredPG}/{pgCount}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Mapping PG</span><span className={`font-bold ${mappedPG === pgCount ? 'text-emerald-600' : 'text-amber-600'}`}>{mappedPG}/{pgCount}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Mapping Isian</span><span className={`font-bold ${mappedEssay === essayCount ? 'text-emerald-600' : 'text-amber-600'}`}>{mappedEssay}/{essayCount}</span></div>
                  </div>
                </Card>

                {/* SELECTED TPS */}
                <Card className="rounded-[30px] border-slate-200 p-6 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Kompetensi</p>
                      <h3 className="mt-1 text-lg font-black text-slate-900">TP terpilih</h3>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{selectedTPs.size}</span>
                  </div>

                  <div className="mt-4 max-h-[340px] space-y-2 overflow-y-auto">
                    {selectedTPDetails.map((tp) => (
                      <div key={tp.id} className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">{tp.chapter}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-700">{tp.tp}</p>
                      </div>
                    ))}
                  </div>

                  <Button onClick={autoDistributeTPs} variant="outline" className="mt-4 w-full rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50">
                    🔄 Distribusi TP Otomatis
                  </Button>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">
                    Membagi soal bergantian ke TP yang dipilih.
                  </p>
                </Card>
              </div>

              <Card className="rounded-[30px] border-slate-200 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
                <div className="border-b border-slate-100 p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Langkah 3</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">Konfigurasi soal</h2>
                  <p className="mt-1 text-sm text-slate-500">Tentukan jumlah, bobot, kunci, dan pemetaan TP.</p>
                </div>

                <div className="space-y-6 p-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-sm font-black text-emerald-900">Pilihan Ganda</p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-emerald-800">Jumlah</label>
                          <Input type="number" min="0" value={pgCount} onChange={(e) => handlePgCountChange(parseInt(e.target.value) || 0)} className="rounded-xl border-emerald-200 bg-white" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-emerald-800">Bobot</label>
                          <Input type="number" min="1" value={pgWeight} onChange={(e) => setPgWeight(parseInt(e.target.value) || 1)} className="rounded-xl border-emerald-200 bg-white" />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                      <p className="text-sm font-black text-violet-900">Isian / Essay</p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-violet-800">Jumlah</label>
                          <Input type="number" min="0" value={essayCount} onChange={(e) => handleEssayCountChange(parseInt(e.target.value) || 0)} className="rounded-xl border-violet-200 bg-white" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-violet-800">Bobot</label>
                          <Input type="number" min="1" value={essayWeight} onChange={(e) => setEssayWeight(parseInt(e.target.value) || 1)} className="rounded-xl border-violet-200 bg-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {pgCount > 0 && (
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-black text-slate-800">Kunci & pemetaan TP — PG</h3>
                          <p className="text-[11px] text-slate-400">Pastikan setiap soal memiliki kunci dan TP.</p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">{answeredPG}/{pgCount} kunci</span>
                      </div>

                      <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                        {Array.from({ length: pgCount }, (_, i) => i + 1).map((num) => {
                          const selectedTP = availableTPs.find((t) => t.id === pgTPMapping[num]);
                          return (
                            <motion.div
                              key={num}
                              whileHover={reduceMotion ? undefined : { y: -1 }}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-black text-slate-700">Soal {num}</span>
                                {selectedTP && (
                                  <span className="max-w-[55%] truncate rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                                    {selectedTP.chapter}
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <select
                                  value={pgAnswerKeys[num - 1] || ''}
                                  onChange={(e) => {
                                    const next = [...pgAnswerKeys];
                                    next[num - 1] = e.target.value;
                                    setPgAnswerKeys(next);
                                  }}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                >
                                  <option value="">Kunci jawaban</option>
                                  {['A', 'B', 'C', 'D', 'E'].map((key) => <option key={key} value={key}>{key}</option>)}
                                </select>

                                <select
                                  value={pgTPMapping[num] || ''}
                                  onChange={(e) => setPgTPMapping({ ...pgTPMapping, [num]: e.target.value })}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                >
                                  <option value="">Pilih TP...</option>
                                  {Array.from(selectedTPs).map((tpId) => {
                                    const tp = availableTPs.find((t) => t.id === tpId);
                                    return <option key={tpId} value={tpId}>{tp?.chapter}</option>;
                                  })}
                                </select>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {essayCount > 0 && (
                    <div className="border-t border-slate-100 pt-5">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-black text-slate-800">Pemetaan TP — Isian</h3>
                          <p className="text-[11px] text-slate-400">Setiap soal perlu memiliki TP.</p>
                        </div>
                        <span className="rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-700">{mappedEssay}/{essayCount} terpetakan</span>
                      </div>

                      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                        {Array.from({ length: essayCount }, (_, i) => i + 1).map((num) => (
                          <motion.div
                            key={num}
                            whileHover={reduceMotion ? undefined : { y: -1 }}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <span className="text-sm font-black text-slate-700">Soal Isian {num}</span>
                            <select
                              value={essayTPMapping[num] || ''}
                              onChange={(e) => setEssayTPMapping({ ...essayTPMapping, [num]: e.target.value })}
                              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                            >
                              <option value="">Pilih TP...</option>
                              {Array.from(selectedTPs).map((tpId) => {
                                const tp = availableTPs.find((t) => t.id === tpId);
                                return <option key={tpId} value={tpId}>{tp?.chapter}</option>;
                              })}
                            </select>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="sticky bottom-4 z-10 flex flex-col gap-3 border-t border-slate-100 bg-white/95 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(2)} className="rounded-xl">
                    ← Kembali
                  </Button>
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={saving}
                    className="rounded-xl bg-slate-950 px-6 hover:bg-slate-800"
                  >
                    {saving ? 'Menyimpan...' : editingTemplateId ? '💾 Update Template' : '💾 Simpan Template'}
                  </Button>
                </div>
              </Card>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
