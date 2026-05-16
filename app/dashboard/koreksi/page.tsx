'use client';
import "./koreksi-scrollbar.css";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save } from 'lucide-react';
import { calculateTotalScore } from '@/lib/utils';
import { ExamTemplate } from '@/types';

interface QuestionBank {
  id: string;
  examTitle: string;
  subject: string;
  questions: any;
  kelas: string;
  question_tp_mapping?: any[];
}

interface Class {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  nisn: string;
}

interface StudentGrade {
  studentId: string;
  studentName: string;
  mcAnswers: string[];
  essayScores: number[];
  totalScore: number;
  finalGrade: number;
  isCalculated: boolean;
}

interface SavedGrade {
  id: string;
  exam_name: string;
  subject: string;
  class_name: string;
  exam_title: string;
  question_bank_id?: string;
  exam_template_id?: string;
  class_id: string;
  grades: StudentGrade[];
  created_at: string;
  updated_at: string;
}

export default function KoreksiPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [showSavedGrades, setShowSavedGrades] = useState(false);
  
  // Mode selection
  const [useTemplate, setUseTemplate] = useState(false);
  const [examTemplates, setExamTemplates] = useState<ExamTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ExamTemplate | null>(null);
  
  // Step 1: Select exam
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<number|''>('');
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [selectedQB, setSelectedQB] = useState<QuestionBank | null>(null);
  const [savedGrades, setSavedGrades] = useState<SavedGrade[]>([]);
  
  // FILTER STATE BARU
  const [filterKelas, setFilterKelas] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  
  // Step 2: Select class
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Step 3: Grading
  const [examName, setExamName] = useState('');
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [savedGradeId, setSavedGradeId] = useState<string | null>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  useEffect(() => {
    if (user) {
      loadQuestionBanks();
      loadExamTemplates();
      loadClasses();
      if (showSavedGrades) {
        loadSavedGrades();
      }
    }
  }, [user, showSavedGrades]);

  const handleDeleteSavedGrade = async (gradeId: string) => {
    if (!window.confirm('Yakin ingin menghapus data koreksi ini?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'grades', gradeId));
      setSavedGrades((prev) => prev.filter((g) => g.id !== gradeId));
    } catch (error) {
      console.error('Gagal menghapus data koreksi:', error);
      alert('Gagal menghapus data koreksi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 3) {
      const updateWidth = () => {
        const contentWrapper = document.getElementById('content-wrapper');
        if (contentWrapper) {
          setTableScrollWidth(contentWrapper.scrollWidth);
        }
      };
      setTimeout(updateWidth, 100);
      setTimeout(updateWidth, 500);
      setTimeout(updateWidth, 1000);
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, [step, selectedQB, grades.length]);

  useEffect(() => {
    if (step === 3 && tableScrollWidth > 0) {
      const contentWrapper = document.getElementById('content-wrapper');
      const customScrollbar = document.getElementById('custom-scrollbar');
      if (contentWrapper && customScrollbar) {
        const syncScroll = () => { if (customScrollbar.scrollLeft !== contentWrapper.scrollLeft) customScrollbar.scrollLeft = contentWrapper.scrollLeft; };
        const syncScrollReverse = () => { if (contentWrapper.scrollLeft !== customScrollbar.scrollLeft) contentWrapper.scrollLeft = customScrollbar.scrollLeft; };
        contentWrapper.addEventListener('scroll', syncScroll);
        customScrollbar.addEventListener('scroll', syncScrollReverse);
        return () => {
          contentWrapper.removeEventListener('scroll', syncScroll);
          customScrollbar.removeEventListener('scroll', syncScrollReverse);
        };
      }
    }
  }, [step, tableScrollWidth]);

  const loadExamTemplates = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'exam_templates'), where('user_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const templates: ExamTemplate[] = [];
      querySnapshot.forEach((doc) => templates.push({ id: doc.id, ...doc.data() } as ExamTemplate));
      setExamTemplates(templates.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (error) { console.error(error); }
  };

  const loadQuestionBanks = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'question_banks'), where('user_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const qbs: QuestionBank[] = [];
      querySnapshot.forEach((doc) => qbs.push({ id: doc.id, ...doc.data() } as QuestionBank));
      setQuestionBanks(qbs);
    } catch (error) { console.error(error); }
  };

  const loadClasses = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'classes'), where('user_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const classesData: Class[] = [];
      querySnapshot.forEach((doc) => classesData.push({ id: doc.id, ...doc.data() } as Class));
      setClasses(classesData);
    } catch (error) { console.error(error); }
  };

  const loadSavedGrades = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'grades'), where('user_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const savedGradesData: SavedGrade[] = [];
      querySnapshot.forEach((doc) => savedGradesData.push({ id: doc.id, ...doc.data() } as SavedGrade));
      savedGradesData.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setSavedGrades(savedGradesData);
    } catch (error) { alert('Gagal memuat data koreksi tersimpan'); } 
    finally { setLoading(false); }
  };

  const handleLoadSavedGrade = async (savedGrade: SavedGrade) => {
    setLoading(true);
    try {
      if (savedGrade.exam_template_id) {
        const foundTemplate = examTemplates.find(t => t.id === savedGrade.exam_template_id);
        const foundClass = classes.find(c => c.id === savedGrade.class_id);
        if (!foundTemplate || !foundClass) return alert('Data template atau kelas tidak ditemukan');
        setUseTemplate(true); setSelectedTemplate(foundTemplate); setSelectedQB(null);
        setSelectedClass(foundClass); setExamName(savedGrade.exam_name); setGrades(savedGrade.grades);
      } else {
        const foundQB = questionBanks.find(q => q.id === savedGrade.question_bank_id);
        const foundClass = classes.find(c => c.id === savedGrade.class_id);
        if (!foundQB || !foundClass) return alert('Data soal atau kelas tidak ditemukan');
        setUseTemplate(false); setSelectedQB(foundQB); setSelectedTemplate(null);
        setSelectedClass(foundClass); setExamName(savedGrade.exam_name); setGrades(savedGrade.grades);
      }
      setSavedGradeId(savedGrade.id);
      setStep(3); setShowSavedGrades(false);
    } catch (error) { alert('Gagal memuat data koreksi'); } 
    finally { setLoading(false); }
  };

  const loadStudents = async (classId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const studentsRef = collection(db, 'classes', classId, 'students');
      const querySnapshot = await getDocs(studentsRef);
      const studentsData: Student[] = [];
      querySnapshot.forEach((doc) => studentsData.push({ id: doc.id, ...doc.data() } as Student));
      studentsData.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      setStudents(studentsData);
      
      let mcLength = 0, essayLength = 0;
      if (useTemplate && selectedTemplate) {
        mcLength = selectedTemplate.multiple_choice.count;
        essayLength = selectedTemplate.essay.count;
      } else if (selectedQB) {
        mcLength = selectedQB.questions.multipleChoice?.length || 0;
        essayLength = selectedQB.questions.essay?.length || 0;
      }
      
      const initialGrades: StudentGrade[] = studentsData.map((student) => ({
        studentId: student.id, studentName: student.name,
        mcAnswers: new Array(mcLength).fill(''),
        essayScores: new Array(essayLength).fill(0),
        totalScore: 0, finalGrade: 0, isCalculated: false,
      }));
      setGrades(initialGrades);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  const handleSelectTemplate = (template: ExamTemplate) => { setSelectedTemplate(template); setExamName(template.exam_name); setStep(2); };
  const handleSelectQB = (qb: QuestionBank) => { setSelectedQB(qb); setStep(2); };
  const handleSelectClass = (cls: Class) => { setSelectedClass(cls); loadStudents(cls.id); };

  const handleStartGrading = () => {
    if (!examName) return alert('Mohon masukkan nama ulangan');
    if (!selectedSemester) return alert('Mohon pilih semester');
    setStep(3);
  };

  const updateMCAnswer = (studentIdx: number, questionIdx: number, answer: string, autoTab?: boolean) => {
    const validAnswers = ['A', 'B', 'C', 'D', 'E', ''];
    if (!validAnswers.includes(answer.toUpperCase())) return;
    const updated = [...grades];
    updated[studentIdx].mcAnswers[questionIdx] = answer.toUpperCase();
    updated[studentIdx].isCalculated = false;
    setGrades(updated);
    
    if (autoTab && answer) {
      const nextInput = document.querySelector(`input[data-student="${studentIdx}"][data-question="${questionIdx + 1}"]`) as HTMLInputElement;
      if (nextInput) { nextInput.focus(); nextInput.select(); }
    }
  };

  const updateEssayScore = (studentIdx: number, questionIdx: number, score: string) => {
    const numScore = score === '' ? 0 : Number(score);
    if (isNaN(numScore) || numScore < 0) return;
    const maxScore = useTemplate && selectedTemplate ? selectedTemplate.essay.weight : selectedQB?.questions.essay[questionIdx]?.weight || 0;
    if (numScore > maxScore) return;
    
    const updated = [...grades];
    updated[studentIdx].essayScores[questionIdx] = numScore;
    updated[studentIdx].isCalculated = false;
    setGrades(updated);
  };

  const calculateAllScores = () => {
    if (!useTemplate && !selectedQB) return;
    if (useTemplate && !selectedTemplate) return;
    
    const updated = [...grades];
    let correctAnswers: string[], mcWeight: number, mcCount: number, essayWeights: number[], maxScore: number;
    
    if (useTemplate && selectedTemplate) {
      correctAnswers = selectedTemplate.multiple_choice.answer_keys;
      mcWeight = selectedTemplate.multiple_choice.weight;
      mcCount = selectedTemplate.multiple_choice.count;
      essayWeights = new Array(selectedTemplate.essay.count).fill(selectedTemplate.essay.weight);
      maxScore = selectedTemplate.max_score;
    } else if (selectedQB) {
      correctAnswers = selectedQB.questions.multipleChoice.map((q: any) => q.correctAnswer);
      mcWeight = selectedQB.questions.multipleChoice[0]?.weight || 1;
      mcCount = selectedQB.questions.multipleChoice?.length || 0;
      essayWeights = selectedQB.questions.essay?.map((q: any) => q.weight) || [];
      maxScore = (mcCount * mcWeight) + essayWeights.reduce((sum: number, w: number) => sum + w, 0);
    } else return;
    
    updated.forEach((grade) => {
      const rawScore = calculateTotalScore(grade.mcAnswers, correctAnswers, mcWeight, grade.essayScores);
      grade.totalScore = rawScore;
      grade.finalGrade = maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;
      grade.isCalculated = true;
    });
    setGrades(updated);
  };

  const handleSaveGrades = async () => {
    if (!user || !selectedClass) return;
    if (!selectedSemester) return alert('Mohon pilih semester');
    setLoading(true);
    try {
      if (savedGradeId) {
        await updateDoc(doc(db, 'grades', savedGradeId), { grades: grades, updated_at: new Date().toISOString(), semester: selectedSemester });
      } else {
        const gradeData: any = {
          user_id: user.uid, exam_name: examName, class_id: selectedClass.id, class_name: selectedClass.name,
          grades: grades, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), semester: selectedSemester
        };
        if (useTemplate && selectedTemplate) {
          gradeData.subject = selectedTemplate.subject; gradeData.exam_title = selectedTemplate.exam_name; gradeData.exam_template_id = selectedTemplate.id;
        } else if (selectedQB) {
          gradeData.subject = selectedQB.subject; gradeData.exam_title = selectedQB.examTitle; gradeData.question_bank_id = selectedQB.id;
        }
        const docRef = await addDoc(collection(db, 'grades'), gradeData);
        setSavedGradeId(docRef.id);
      }
      alert('✅ Nilai berhasil disimpan!');
    } catch (error) { alert('Gagal menyimpan nilai'); } 
    finally { setLoading(false); }
  };

  // LOGIKA PEMBUATAN DAFTAR OPSI FILTER DAN PENYARINGAN DATA
  const activeData = useTemplate ? examTemplates : questionBanks;
  const availableFilterKelas = Array.from(new Set(activeData.map((item: any) => useTemplate ? item.grade : item.kelas))).filter(Boolean).sort();
  const availableFilterSubjects = Array.from(new Set(activeData.map((item: any) => item.subject))).filter(Boolean).sort();

  const displayedQBs = questionBanks.filter(qb => {
    return (filterKelas ? String(qb.kelas) === String(filterKelas) : true) && 
           (filterSubject ? qb.subject === filterSubject : true);
  });

  const displayedTemplates = examTemplates.filter((tpl: any) => {
    const tplKelas = tpl.grade || tpl.kelas;
    return (filterKelas ? String(tplKelas) === String(filterKelas) : true) && 
           (filterSubject ? tpl.subject === filterSubject : true);
  });

  const mcCount = useTemplate && selectedTemplate ? selectedTemplate.multiple_choice.count : selectedQB?.questions.multipleChoice?.length || 0;
  const mcWeight = useTemplate && selectedTemplate ? selectedTemplate.multiple_choice.weight : selectedQB?.questions.multipleChoice?.[0]?.weight || 1;
  const essayCount = useTemplate && selectedTemplate ? selectedTemplate.essay.count : selectedQB?.questions.essay?.length || 0;
  const essayWeights = useTemplate && selectedTemplate ? new Array(essayCount).fill(selectedTemplate.essay.weight) : selectedQB?.questions.essay?.map((q: any) => q.weight) || [];
  const totalEssayWeight = essayWeights.reduce((sum: number, w: number) => sum + w, 0);
  const maxScore = (mcCount * mcWeight) + totalEssayWeight;
  const examTitleText = useTemplate && selectedTemplate ? selectedTemplate.exam_name : selectedQB?.examTitle || '';

  return (
    <div className="container mx-auto pb-10 px-4 pt-6">
      
      {/* STEP 0: Tampilan Awal Pemilihan Mode */}
      {!showSavedGrades && step === 0 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Koreksi Otomatis</h1>
              <p className="mt-2 text-gray-600">Sistem penilaian otomatis dan pencatatan nilai terpusat</p>
            </div>
            <Button onClick={() => setShowSavedGrades(true)} variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50">
              📂 Muat Koreksi Tersimpan
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="hover:shadow-md cursor-pointer border-blue-200 hover:border-blue-500 transition-all" onClick={() => { setUseTemplate(false); setStep(1); setFilterKelas(''); setFilterSubject(''); }}>
              <CardHeader>
                <CardTitle className="text-blue-700">Koreksi dari Bank Soal</CardTitle>
                <CardDescription>Koreksi jawaban berdasarkan bank soal PDF yang telah Anda ekstrak sebelumnya.</CardDescription>
              </CardHeader>
            </Card>
            <Card className="hover:shadow-md cursor-pointer border-green-200 hover:border-green-500 transition-all" onClick={() => { setUseTemplate(true); setStep(1); setFilterKelas(''); setFilterSubject(''); }}>
              <CardHeader>
                <CardTitle className="text-green-700">Koreksi dari Template</CardTitle>
                <CardDescription>Koreksi menggunakan kerangka/template soal buatan sendiri secara manual.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      )}

      {/* STEP 1: Pilih Berkas Soal / Template Beserta Filternya */}
      {!showSavedGrades && step === 1 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <Button variant="outline" onClick={() => setStep(0)}>← Kembali ke Awal</Button>

          {/* KOTAK FILTER PENCARIAN BARU */}
          <Card>
            <CardHeader><CardTitle>Filter Soal</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Kelas</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={filterKelas} onChange={e => setFilterKelas(e.target.value)}>
                    <option value="">Semua Kelas</option>
                    {availableFilterKelas.map(k => <option key={String(k)} value={String(k)}>Kelas {k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Mata Pelajaran</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
                    <option value="">Semua Mata Pelajaran</option>
                    {availableFilterSubjects.map(s => <option key={String(s)} value={String(s)}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button onClick={() => { setFilterKelas(''); setFilterSubject(''); }} variant="outline" className="w-full">Reset Filter</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pilih Dokumen {useTemplate ? 'Template Ujian' : 'Bank Soal'}</CardTitle>
              <CardDescription>Klik salah satu dokumen yang akan Anda koreksi nilainya.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {!useTemplate ? (
                  displayedQBs.length > 0 ? displayedQBs.map(qb => (
                    <Card key={qb.id} className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => handleSelectQB(qb)}>
                      <CardHeader className="p-4">
                        <CardTitle className="text-lg">{qb.examTitle}</CardTitle>
                        <CardDescription>Kelas {qb.kelas} - {qb.subject}</CardDescription>
                      </CardHeader>
                    </Card>
                  )) : <p className="text-gray-500 italic col-span-full">Tidak ada soal yang cocok dengan filter pencarian Anda.</p>
                ) : (
                  displayedTemplates.length > 0 ? displayedTemplates.map(tpl => (
                    <Card key={tpl.id} className="cursor-pointer hover:border-green-500 transition-colors" onClick={() => handleSelectTemplate(tpl)}>
                      <CardHeader className="p-4">
                        <CardTitle className="text-lg">{tpl.exam_name}</CardTitle>
                        <CardDescription>Kelas {tpl.grade} - {tpl.subject}</CardDescription>
                      </CardHeader>
                    </Card>
                  )) : <p className="text-gray-500 italic col-span-full">Tidak ada template yang cocok dengan filter pencarian Anda.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MENAMPILKAN DAFTAR KOREKSI TERSIMPAN */}
      {showSavedGrades && (
        <Card className="animate-in fade-in duration-300">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daftar Koreksi Tersimpan</CardTitle>
                <CardDescription>Lanjutkan proses koreksi nilai yang sempat tertunda.</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setShowSavedGrades(false)}>← Batal</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
            ) : savedGrades.length === 0 ? (
              <div className="text-center py-12 text-gray-500"><p>Belum ada data koreksi tersimpan saat ini.</p></div>
            ) : (
              <div className="space-y-4">
                {savedGrades.map((savedGrade) => {
                  const totalStudents = savedGrade.grades.length;
                  const completedStudents = savedGrade.grades.filter(g => g.mcAnswers.some(a => a !== '') || g.essayScores.some(s => s > 0)).length;
                  const progress = totalStudents > 0 ? Math.round((completedStudents / totalStudents) * 100) : 0;
                  return (
                    <Card key={savedGrade.id} className="border-2 border-purple-100 hover:border-purple-300 transition-all bg-gradient-to-br from-purple-50 to-pink-50">
                      <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-2 text-purple-900">{savedGrade.exam_name}</h3>
                            <div className="space-y-1 text-sm text-gray-700">
                              <p><span className="font-medium text-purple-800">Mapel:</span> {savedGrade.subject}</p>
                              <p><span className="font-medium text-purple-800">Kelas:</span> {savedGrade.class_name}</p>
                              <p><span className="font-medium text-purple-800">Tautan Soal:</span> {savedGrade.exam_title}</p>
                              <p><span className="font-medium text-purple-800">Tersimpan Pada:</span> {new Date(savedGrade.updated_at).toLocaleString('id-ID')}</p>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-purple-200 rounded-full h-2.5">
                                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                </div>
                                <span className="text-sm font-medium text-purple-900">{completedStudents}/{totalStudents} siswa</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-row md:flex-col gap-2">
                            <Button onClick={() => handleLoadSavedGrade(savedGrade)} disabled={loading} className="bg-purple-600 hover:bg-purple-700">Lanjutkan</Button>
                            <Button onClick={() => handleDeleteSavedGrade(savedGrade.id)} disabled={loading} variant="destructive">Hapus</Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Pilih Kelas & Semester */}
      {!showSavedGrades && step === 2 && (
        <Card className="animate-in fade-in duration-300">
          <CardHeader>
            <CardTitle>Persiapan Koreksi</CardTitle>
            <CardDescription>Dokumen Acuan: <strong className="text-blue-700">{selectedQB?.examTitle || selectedTemplate?.exam_name}</strong></CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Kelas</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {classes.map((cls) => (
                  <Button key={cls.id} variant={selectedClass?.id === cls.id ? 'default' : 'outline'} onClick={() => handleSelectClass(cls)}>
                    Kelas {cls.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nama Kegiatan Ulangan</label>
                <Input placeholder="Contoh: Ulangan Harian Bab 1" value={examName} onChange={(e) => setExamName(e.target.value)} className="focus:ring-2 focus:ring-blue-500" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Semester</label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={selectedSemester} onChange={(e) => setSelectedSemester(Number(e.target.value))}>
                  <option value="">-- Tentukan Semester --</option>
                  <option value={1}>Semester 1 (Ganjil)</option>
                  <option value={2}>Semester 2 (Genap)</option>
                </select>
              </div>
            </div>

            {students.length > 0 && (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-sm text-blue-800">
                Data siap! Terdapat <strong>{students.length} siswa</strong> dari Kelas {selectedClass?.name} yang akan dimuat ke tabel koreksi.
              </div>
            )}

            <div className="flex justify-between mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(1)}>← Ganti Soal</Button>
              <Button onClick={handleStartGrading} disabled={!selectedClass || !examName || !selectedSemester} className="bg-blue-600 hover:bg-blue-700 px-8">
                Mulai Masukkan Nilai →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Tabel Grading */}
      {!showSavedGrades && step === 3 && (selectedQB || selectedTemplate) && (
        <div id="content-wrapper" className="overflow-x-auto overflow-y-visible animate-in fade-in duration-300" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="space-y-6" style={{ minWidth: 'max-content', paddingRight: '300px', paddingBottom: '80px' }}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{examName}</CardTitle>
                    <CardDescription>Kelas {selectedClass?.name} - {examTitleText}</CardDescription>
                    <div className="mt-2 flex gap-4 text-sm bg-gray-100 p-2 rounded-lg border">
                      <span className="text-green-700 font-medium">PG: {mcCount} soal × {mcWeight} = {mcCount * mcWeight} poin</span>
                      <span className="text-purple-700 font-medium">Essay: {totalEssayWeight} poin</span>
                      <span className="text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded">Skor Maksimum: {maxScore}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 mb-4 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                  <Button onClick={() => setStep(2)} variant="outline" size="lg">← Kembali</Button>
                  <Button onClick={calculateAllScores} disabled={loading} size="lg" className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm">🧮 Hitung Nilai Akhir</Button>
                  <Button onClick={handleSaveGrades} disabled={loading} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm">
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} 💾 Simpan Hasil Koreksi
                  </Button>
                </div>

                <div className="relative">
                  <div className="border rounded-lg shadow-sm">
                    <Table>
                      <TableHeader className="sticky top-0 z-30 shadow-sm">
                        <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50">
                          <TableHead className="sticky left-0 bg-blue-50 z-20 border-r-2 border-blue-200 font-bold w-12 text-center text-blue-900">No</TableHead>
                          <TableHead className="sticky left-12 bg-blue-50 z-20 border-r-2 border-blue-200 font-bold min-w-[200px] text-blue-900">Nama Lengkap Siswa</TableHead>
                          {Array.from({ length: mcCount }, (_, idx) => {
                            const weight = useTemplate && selectedTemplate ? selectedTemplate.multiple_choice.weight : selectedQB?.questions.multipleChoice[idx]?.weight || 1;
                            return (<TableHead key={`mc-${idx}`} className="text-center bg-green-50 font-bold text-green-900 border-x border-green-200">PG {idx + 1}<br /><span className="text-xs font-normal text-green-700">({weight} pt)</span></TableHead>);
                          })}
                          {Array.from({ length: essayCount }, (_, idx) => {
                            const weight = useTemplate && selectedTemplate ? selectedTemplate.essay.weight : selectedQB?.questions.essay[idx]?.weight || 0;
                            return (<TableHead key={`essay-${idx}`} className="text-center bg-purple-50 font-bold text-purple-900 border-x border-purple-200">Esai {idx + 1}<br /><span className="text-xs font-normal text-purple-700">(Max {weight})</span></TableHead>);
                          })}
                          <TableHead className="text-center font-bold bg-blue-100 border-l-2 border-blue-300 w-24 text-blue-900">Total Skor</TableHead>
                          <TableHead className="text-center font-black bg-indigo-200 border-x-2 border-indigo-300 w-24 text-indigo-900">NILAI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grades.map((grade, studentIdx) => (
                          <TableRow key={grade.studentId} className="hover:bg-blue-50/50 transition-colors">
                            <TableCell className="sticky left-0 bg-white z-10 border-r-2 border-blue-200 font-medium text-center">{studentIdx + 1}</TableCell>
                            <TableCell className="sticky left-12 bg-white z-10 border-r-2 border-blue-200 font-semibold text-gray-800">{grade.studentName}</TableCell>
                            {grade.mcAnswers.map((answer, qIdx) => {
                              const correctAnswer = useTemplate && selectedTemplate ? selectedTemplate.multiple_choice.answer_keys[qIdx] : selectedQB?.questions.multipleChoice[qIdx]?.correctAnswer;
                              const isCorrect = answer && answer === correctAnswer;
                              const isWrong = answer && answer !== correctAnswer;
                              return (
                                <TableCell key={`mc-${studentIdx}-${qIdx}`} className="border-x p-1 border-gray-200">
                                  <Input data-student={studentIdx} data-question={qIdx} className={`w-14 h-10 mx-auto text-center font-bold text-lg uppercase transition-colors shadow-inner ${isCorrect ? 'bg-green-100 border-green-500 text-green-800' : isWrong ? 'bg-red-100 border-red-500 text-red-800' : 'bg-gray-50 border-gray-300 focus:bg-white focus:border-blue-500'}`} value={answer} onChange={(e) => { const val = e.target.value.toUpperCase(); if (val.length <= 1) updateMCAnswer(studentIdx, qIdx, val, true); }} onKeyDown={(e) => { if (e.key === 'Enter') { const nextInput = document.querySelector(`input[data-student="${studentIdx}"][data-question="${qIdx + 1}"]`) as HTMLInputElement; if (nextInput) { nextInput.focus(); nextInput.select(); } } }} maxLength={1} />
                                </TableCell>
                              );
                            })}
                            {grade.essayScores.map((score, qIdx) => {
                              const maxScore = useTemplate && selectedTemplate ? selectedTemplate.essay.weight : selectedQB?.questions.essay[qIdx]?.weight || 0;
                              return (
                                <TableCell key={`essay-${studentIdx}-${qIdx}`} className="border-x p-1 border-gray-200">
                                  <Input className="w-16 h-10 mx-auto text-center font-bold bg-gray-50 border-gray-300 focus:bg-white focus:border-purple-500 shadow-inner" type="number" value={score || ''} onChange={(e) => updateEssayScore(studentIdx, qIdx, e.target.value)} max={maxScore} min={0} />
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold text-lg bg-blue-50 border-l-2 border-blue-300 text-blue-800">{grade.isCalculated ? grade.totalScore : '-'}</TableCell>
                            <TableCell className="text-center bg-indigo-50 border-x-2 border-indigo-300">
                              <span className={`text-2xl font-black ${grade.isCalculated ? (grade.finalGrade >= 75 ? 'text-green-600' : 'text-red-600') : 'text-gray-400'}`}>{grade.isCalculated ? grade.finalGrade : '-'}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Horizontal Scrollbar Ekstra Bawah */}
      {!showSavedGrades && step === 3 && (
        <div className="sticky bottom-0 left-0 right-0 bg-gray-100 border-t-2 border-gray-300 z-50 py-2 mt-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div id="custom-scrollbar" className="overflow-x-auto overflow-y-hidden px-2">
            <div style={{ width: `${tableScrollWidth || 2000}px`, height: '1px' }} />
          </div>
        </div>
      )}
      
    </div>
  );
}