

'use client';

// Force rebuild for Vercel deployment
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
  question_tp_mapping?: any[]; // Optional TP mapping
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
  exam_template_id?: string; // New field for template-based grading
  class_id: string;
  grades: StudentGrade[];
  created_at: string;
  updated_at: string;
  }

  export default function KoreksiPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(0); // Start at 0 to choose mode
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

  // Calculate content width

  // Delete a saved grade
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
          const actualWidth = contentWrapper.scrollWidth;
          console.log('Content scroll width:', actualWidth);
          setTableScrollWidth(actualWidth);
        }
      };
      
      // Initial calculation with multiple delays to ensure render
      setTimeout(updateWidth, 100);
      setTimeout(updateWidth, 500);
      setTimeout(updateWidth, 1000);
      
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, [step, selectedQB, grades.length]);

  // Sync custom scrollbar with content scroll
  useEffect(() => {
    if (step === 3 && tableScrollWidth > 0) {
      const contentWrapper = document.getElementById('content-wrapper');
      const customScrollbar = document.getElementById('custom-scrollbar');
      
      if (contentWrapper && customScrollbar) {
        const syncScroll = () => {
          if (customScrollbar.scrollLeft !== contentWrapper.scrollLeft) {
             customScrollbar.scrollLeft = contentWrapper.scrollLeft;
          }
        };
        
        const syncScrollReverse = () => {
          if (contentWrapper.scrollLeft !== customScrollbar.scrollLeft) {
            contentWrapper.scrollLeft = customScrollbar.scrollLeft;
          }
        };
        
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
      
      querySnapshot.forEach((doc) => {
        templates.push({ id: doc.id, ...doc.data() } as ExamTemplate);
      });
      
      setExamTemplates(templates.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (error) {
      console.error('Error loading exam templates:', error);
    }
  };

  const loadQuestionBanks = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'question_banks'), where('user_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const qbs: QuestionBank[] = [];
      const subjectSet = new Set<string>();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        qbs.push({ id: doc.id, ...data } as QuestionBank);
        subjectSet.add(data.subject);
      });
      
      setQuestionBanks(qbs);
      setSubjects(Array.from(subjectSet));
    } catch (error) {
      console.error('Error loading question banks:', error);
    }
  };

  const loadClasses = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'classes'), where('user_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const classesData: Class[] = [];
      
      querySnapshot.forEach((doc) => {
        classesData.push({ id: doc.id, ...doc.data() } as Class);
      });
      
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadSavedGrades = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'grades'),
        where('user_id', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const savedGradesData: SavedGrade[] = [];
      
      querySnapshot.forEach((doc) => {
        savedGradesData.push({ id: doc.id, ...doc.data() } as SavedGrade);
      });
      
      // Sort by updated_at descending
      savedGradesData.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      
      setSavedGrades(savedGradesData);
    } catch (error) {
      console.error('Error loading saved grades:', error);
      alert('Gagal memuat data koreksi tersimpan');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSavedGrade = async (savedGrade: SavedGrade) => {
    setLoading(true);
    try {
      // Check if this grade is from template or question bank
      if (savedGrade.exam_template_id) {
        // Load from template
        const templateQuery = query(
          collection(db, 'exam_templates'),
          where('user_id', '==', user?.uid)
        );
        const templateSnapshot = await getDocs(templateQuery);
        let foundTemplate: ExamTemplate | null = null;
        
        templateSnapshot.forEach((doc) => {
          if (doc.id === savedGrade.exam_template_id) {
            foundTemplate = { id: doc.id, ...doc.data() } as ExamTemplate;
          }
        });
        
        if (!foundTemplate) {
          alert('Template ujian tidak ditemukan');
          return;
        }
        
        // Load class
        const classQuery = query(
          collection(db, 'classes'),
          where('user_id', '==', user?.uid)
        );
        const classSnapshot = await getDocs(classQuery);
        let foundClass: Class | null = null;
        
        classSnapshot.forEach((doc) => {
          if (doc.id === savedGrade.class_id) {
            foundClass = { id: doc.id, name: doc.data().name } as Class;
          }
        });
        
        if (!foundClass) {
          alert('Kelas tidak ditemukan');
          return;
        }
        
        // Set states for template mode
        setUseTemplate(true);
        setSelectedTemplate(foundTemplate);
        setSelectedQB(null);
        setSelectedClass(foundClass);
        setExamName(savedGrade.exam_name);
        setGrades(savedGrade.grades);
        setSavedGradeId(savedGrade.id);
        setStep(3);
        setShowSavedGrades(false);
        
      } else {
        // Load from question bank (existing logic)
        const qbQuery = query(
          collection(db, 'question_banks'),
          where('user_id', '==', user?.uid)
        );
        const qbSnapshot = await getDocs(qbQuery);
        let foundQB: QuestionBank | null = null;
        
        qbSnapshot.forEach((doc) => {
          if (doc.id === savedGrade.question_bank_id) {
            foundQB = { id: doc.id, ...doc.data() } as QuestionBank;
          }
        });
        
        if (!foundQB) {
          alert('Soal tidak ditemukan');
          return;
        }
        
        // Load class
        const classQuery = query(
          collection(db, 'classes'),
          where('user_id', '==', user?.uid)
        );
        const classSnapshot = await getDocs(classQuery);
        let foundClass: Class | null = null;
        
        classSnapshot.forEach((doc) => {
          if (doc.id === savedGrade.class_id) {
            foundClass = { id: doc.id, name: doc.data().name } as Class;
          }
        });
        
        if (!foundClass) {
          alert('Kelas tidak ditemukan');
          return;
        }
        
        // Set states for question bank mode
        setUseTemplate(false);
        setSelectedQB(foundQB);
        setSelectedTemplate(null);
        setSelectedClass(foundClass);
        setExamName(savedGrade.exam_name);
        setGrades(savedGrade.grades);
        setSavedGradeId(savedGrade.id);
        setStep(3);
        setShowSavedGrades(false);
      }
    } catch (error) {
      console.error('Error loading saved grade:', error);
      alert('Gagal memuat data koreksi');
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async (classId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const studentsRef = collection(db, 'classes', classId, 'students');
      const querySnapshot = await getDocs(studentsRef);
      const studentsData: Student[] = [];
      
      querySnapshot.forEach((doc) => {
        studentsData.push({ id: doc.id, ...doc.data() } as Student);
      });
      
      // Sort students by name alphabetically
      studentsData.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      
      setStudents(studentsData);
      
      // Initialize grades based on mode
      if (useTemplate && selectedTemplate) {
        const mcLength = selectedTemplate.multiple_choice.count;
        const essayLength = selectedTemplate.essay.count;
        
        const initialGrades: StudentGrade[] = studentsData.map((student) => ({
          studentId: student.id,
          studentName: student.name,
          mcAnswers: new Array(mcLength).fill(''),
          essayScores: new Array(essayLength).fill(0),
          totalScore: 0,
          finalGrade: 0,
          isCalculated: false,
        }));
        
        setGrades(initialGrades);
      } else if (selectedQB) {
        const mcLength = selectedQB.questions.multipleChoice?.length || 0;
        const essayLength = selectedQB.questions.essay?.length || 0;
        
        const initialGrades: StudentGrade[] = studentsData.map((student) => ({
          studentId: student.id,
          studentName: student.name,
          mcAnswers: new Array(mcLength).fill(''),
          essayScores: new Array(essayLength).fill(0),
          totalScore: 0,
          finalGrade: 0,
          isCalculated: false,
        }));
        
        setGrades(initialGrades);
      }
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubject = (subject: string) => {
    setSelectedSubject(subject);
  };

  const handleSelectTemplate = (template: ExamTemplate) => {
    setSelectedTemplate(template);
    setExamName(template.exam_name);
    setStep(2);
  };

  const handleSelectQB = (qb: QuestionBank) => {
    setSelectedQB(qb);
    setStep(2);
  };

  const handleSelectClass = (cls: Class) => {
    setSelectedClass(cls);
    loadStudents(cls.id);
  };

  const handleStartGrading = () => {
    if (!examName) {
      alert('Mohon masukkan nama ulangan');
      return;
    }
    if (!selectedSemester) {
      alert('Mohon pilih semester');
      return;
    }
    setStep(3);
  };

  const updateMCAnswer = (studentIdx: number, questionIdx: number, answer: string, autoTab?: boolean) => {
    // Validate answer (A-E)
    const validAnswers = ['A', 'B', 'C', 'D', 'E', ''];
    if (!validAnswers.includes(answer.toUpperCase())) return;
    
    const updated = [...grades];
    updated[studentIdx].mcAnswers[questionIdx] = answer.toUpperCase();
    updated[studentIdx].isCalculated = false;
    
    setGrades(updated);
    
    // Auto tab to next input
    if (autoTab && answer) {
      const nextInput = document.querySelector(
        `input[data-student="${studentIdx}"][data-question="${questionIdx + 1}"]`
      ) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  const updateEssayScore = (studentIdx: number, questionIdx: number, score: string) => {
    const numScore = score === '' ? 0 : Number(score);
    if (isNaN(numScore) || numScore < 0) return;
    
    // Validate max score - support both template and QB
    const maxScore = useTemplate && selectedTemplate
      ? selectedTemplate.essay.weight
      : selectedQB?.questions.essay[questionIdx]?.weight || 0;
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
    let correctAnswers: string[];
    let mcWeight: number;
    let mcCount: number;
    let essayWeights: number[];
    let maxScore: number;
    
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
    } else {
      return;
    }
    
    updated.forEach((grade) => {
      // Calculate raw total score
      const rawScore = calculateTotalScore(
        grade.mcAnswers,
        correctAnswers,
        mcWeight,
        grade.essayScores
      );
      
      grade.totalScore = rawScore;
      // Calculate final grade: (Total Score / Max Score) * 100
      grade.finalGrade = maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;
      grade.isCalculated = true;
    });
    
    setGrades(updated);
  };

  const handleSaveGrades = async () => {
    if (!user || !selectedClass) return;
    if (!useTemplate && !selectedQB) return;
    if (useTemplate && !selectedTemplate) return;
    if (!selectedSemester) {
      alert('Mohon pilih semester');
      return;
    }
    setLoading(true);
    try {
      if (savedGradeId) {
        // Update existing grade
        await updateDoc(doc(db, 'grades', savedGradeId), {
          grades: grades,
          updated_at: new Date().toISOString(),
          semester: selectedSemester
        });
      } else {
        // Create new grade
        const gradeData: any = {
          user_id: user.uid,
          exam_name: examName,
          class_id: selectedClass.id,
          class_name: selectedClass.name,
          grades: grades,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          semester: selectedSemester
        };
        if (useTemplate && selectedTemplate) {
          gradeData.subject = selectedTemplate.subject;
          gradeData.exam_title = selectedTemplate.exam_name;
          gradeData.exam_template_id = selectedTemplate.id;
          // Add TP mapping from template for analysis
          gradeData.tp_mapping = selectedTemplate.tp_details.flatMap((tpDetail) => 
            tpDetail.question_numbers.map(qNum => ({
              question_number: qNum,
              question_type: (qNum <= selectedTemplate.multiple_choice.count ? 'PG' : 'Essay') as 'PG' | 'Essay',
              tp_id: tpDetail.tp_id,
              tp_text: tpDetail.tp_text
            }))
          );
        } else if (selectedQB) {
          gradeData.subject = selectedQB.subject;
          gradeData.exam_title = selectedQB.examTitle;
          gradeData.question_bank_id = selectedQB.id;
          // Add TP mapping from question bank for analysis (if available)
          if (selectedQB.question_tp_mapping && Array.isArray(selectedQB.question_tp_mapping) && selectedQB.question_tp_mapping.length > 0) {
            gradeData.tp_mapping = selectedQB.question_tp_mapping;
          }
        }
        const docRef = await addDoc(collection(db, 'grades'), gradeData);
        setSavedGradeId(docRef.id);
      }
      alert('✅ Nilai berhasil disimpan!\n\n💡 Anda dapat melanjutkan koreksi kapan saja dengan klik tombol "Muat Koreksi Tersimpan" di halaman awal.');
    } catch (error) {
      console.error('Error saving grades:', error);
      alert('Gagal menyimpan nilai');
    } finally {
      setLoading(false);
    }
  };



  const getCellColor = (answer: string, correctAnswer: string) => {
    if (!answer) return '';
    return answer === correctAnswer ? 'bg-green-100' : 'bg-red-100';
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Koreksi Digital</h1>
        <p className="mt-2 text-gray-600">Koreksi jawaban siswa secara digital</p>
      </div>

      {/* Info Banner */}
      {step === 3 && (
        <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>💡 Tips:</strong> Klik tombol <strong>"Simpan"</strong> secara berkala untuk menyimpan progress koreksi. 
                Anda dapat melanjutkan koreksi kapan saja dengan klik <strong>"Muat Koreksi Tersimpan"</strong> di halaman awal.
              </p>
            </div>
          </div>
        </div>
      )}

      return (
        <div className="container mx-auto p-6">
          {/* ...existing code... */}
          {step === 1 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Pilih Ulangan & Kelas</CardTitle>
                <CardDescription>
                  Pilih ulangan, kelas, dan semester yang akan dikoreksi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Mata Pelajaran</label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={selectedSubject}
                      onChange={e => setSelectedSubject(e.target.value)}
                      title="Pilih Mata Pelajaran"
                    >
                      <option value="">Pilih Mapel</option>
                      {subjects.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Kelas</label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={selectedClass?.id || ''}
                      onChange={e => {
                        const cls = classes.find(c => c.id === e.target.value);
                        setSelectedClass(cls || null);
                      }}
                      title="Pilih Kelas"
                    >
                      <option value="">Pilih Kelas</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Semester</label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={selectedSemester}
                      onChange={e => setSelectedSemester(e.target.value ? Number(e.target.value) : '')}
                      title="Pilih Semester"
                    >
                      <option value="">Pilih Semester</option>
                      <option value="1">Semester 1</option>
                      <option value="2">Semester 2</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex gap-4">
                  <Input
                    className="w-full"
                    placeholder="Nama Ulangan (misal: UH 1, PTS, PAS)"
                    value={examName}
                    onChange={e => setExamName(e.target.value)}
                  />
                  <Button onClick={handleStartGrading} disabled={!selectedSubject || !selectedClass || !selectedSemester || !examName}>
                    Mulai Koreksi
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {/* ...existing code... */}
        </div>
      );
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {examTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Belum ada template ujian.</p>
                <p className="text-sm mt-2">Buat template baru di menu Template Ujian.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {examTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{template.exam_name}</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {template.exam_type} - Kelas {template.grade} - {template.subject}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          PG: {template.multiple_choice.count} soal ({template.multiple_choice.weight} poin) | 
                          Isian: {template.essay.count} soal ({template.essay.weight} poin) | 
                          Max: {template.max_score} poin
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {template.tp_ids.length} TP
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && !showSavedGrades && !useTemplate && (
        <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-teal-900">Pilih Sumber Soal</CardTitle>
                <CardDescription>Pilih mata pelajaran dan bank soal, atau lanjutkan koreksi tersimpan</CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowSavedGrades(true)}
                className="gap-2 bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300 hover:from-blue-200 hover:to-indigo-200"
              >
                📂 Muat Koreksi Tersimpan
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">Mata Pelajaran</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {subjects.map((subject) => (
                  <Button
                    key={subject}
                    variant={selectedSubject === subject ? 'default' : 'outline'}
                    onClick={() => handleSelectSubject(subject)}
                  >
                    {subject}
                  </Button>
                ))}
              </div>
            </div>

            {selectedSubject && (
              <div>
                <label className="block text-sm font-medium mb-3">Pilih Bank Soal</label>
                <div className="space-y-2">
                  {questionBanks
                    .filter((qb) => qb.subject === selectedSubject)
                    .map((qb) => (
                      <div
                        key={qb.id}
                        className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleSelectQB(qb)}
                      >
                        <h4 className="font-medium">{qb.examTitle}</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          PG: {qb.questions.multipleChoice?.length || 0} soal | 
                          Essay: {qb.questions.essay?.length || 0} soal
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Saved Grades List */}
      {showSavedGrades && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Koreksi Tersimpan</CardTitle>
                <CardDescription>Pilih koreksi yang ingin dilanjutkan</CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowSavedGrades(false)}
              >
                ← Kembali
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : savedGrades.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Belum ada koreksi tersimpan</p>
              </div>
            ) : (
              <div className="space-y-4">
                {savedGrades.map((savedGrade) => {
                  const totalStudents = savedGrade.grades.length;
                  const completedStudents = savedGrade.grades.filter(
                    g => g.mcAnswers.some(a => a !== '') || g.essayScores.some(s => s > 0)
                  ).length;
                  const progress = totalStudents > 0 ? Math.round((completedStudents / totalStudents) * 100) : 0;
                  return (
                    <Card key={savedGrade.id} className="border-2 border-purple-200 hover:border-purple-400 hover:shadow-lg transition-all bg-gradient-to-br from-purple-50 to-pink-50">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-2 text-purple-900">{savedGrade.exam_name}</h3>
                            <div className="space-y-1 text-sm text-gray-700">
                              <p><span className="font-medium text-purple-800">Mata Pelajaran:</span> {savedGrade.subject}</p>
                              <p><span className="font-medium text-purple-800">Kelas:</span> {savedGrade.class_name}</p>
                              <p><span className="font-medium text-purple-800">Bank Soal:</span> {savedGrade.exam_title}</p>
                              <p><span className="font-medium text-purple-800">Terakhir diubah:</span> {new Date(savedGrade.updated_at).toLocaleString('id-ID')}</p>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-purple-200 rounded-full h-2.5">
                                  <div 
                                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-2.5 rounded-full transition-all" 
                                    style={{ width: `${progress}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-purple-900">
                                  {completedStudents}/{totalStudents} siswa
                                </span>
                              </div>
                              <p className="text-xs text-purple-700 mt-1">
                                Progress: {progress}%
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <Button 
                              onClick={() => handleLoadSavedGrade(savedGrade)}
                              disabled={loading}
                            >
                              Lanjutkan Koreksi
                            </Button>
                            <Button 
                              onClick={() => handleDeleteSavedGrade(savedGrade.id)}
                              disabled={loading}
                              variant="destructive"
                            >
                              Hapus
                            </Button>
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

      {/* Step 2: Select Class */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Pilih Kelas</CardTitle>
            <CardDescription>
              Soal: {selectedQB?.examTitle}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">Nama Ulangan</label>
              <Input
                placeholder="Contoh: Ulangan Harian 1"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Pilih Kelas</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {classes.map((cls) => (
                  <Button
                    key={cls.id}
                    variant={selectedClass?.id === cls.id ? 'default' : 'outline'}
                    onClick={() => handleSelectClass(cls)}
                  >
                    {cls.name}
                  </Button>
                ))}
              </div>
            </div>

            {students.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  {students.length} siswa akan dimuat di tabel koreksi
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={handleStartGrading} disabled={!selectedClass || !examName}>
                Mulai Koreksi
              </Button>
              <Button variant="outline" onClick={() => setStep(1)}>
                Kembali
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Grading Table */}
      {step === 3 && (selectedQB || selectedTemplate) && (() => {
        // Get counts and weights from either QB or Template
        const mcCount = useTemplate && selectedTemplate 
          ? selectedTemplate.multiple_choice.count
          : selectedQB?.questions.multipleChoice?.length || 0;
        
        const mcWeight = useTemplate && selectedTemplate
          ? selectedTemplate.multiple_choice.weight
          : selectedQB?.questions.multipleChoice[0]?.weight || 1;
        
        const essayCount = useTemplate && selectedTemplate
          ? selectedTemplate.essay.count
          : selectedQB?.questions.essay?.length || 0;
        
        const essayWeight = useTemplate && selectedTemplate
          ? selectedTemplate.essay.weight
          : 0;
        
        const essayWeights = useTemplate && selectedTemplate
          ? new Array(essayCount).fill(essayWeight)
          : selectedQB?.questions.essay?.map((q: any) => q.weight) || [];
        
        const totalEssayWeight = essayWeights.reduce((sum: number, w: number) => sum + w, 0);
        const maxScore = (mcCount * mcWeight) + totalEssayWeight;
        
        const examTitle = useTemplate && selectedTemplate
          ? selectedTemplate.exam_name
          : selectedQB?.examTitle || '';
        
        return (
          <div id="content-wrapper" className="overflow-x-auto overflow-y-visible" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="space-y-6" style={{ minWidth: 'max-content', paddingRight: '300px', paddingBottom: '80px' }}>
              <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{examName}</CardTitle>
                    <CardDescription>
                      {selectedClass?.name} - {examTitle}
                    </CardDescription>
                    <div className="mt-2 flex gap-4 text-sm">
                      <span className="text-green-700 font-medium">
                        PG: {mcCount} soal × {mcWeight} = {mcCount * mcWeight} poin
                      </span>
                      <span className="text-purple-700 font-medium">
                        Essay: {totalEssayWeight} poin
                      </span>
                      <span className="text-blue-700 font-bold">
                        Total Skor Maksimum: {maxScore} poin
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
            <CardContent>
              {/* Action Buttons - Prominent position above table */}
              <div className="flex gap-3 mb-4 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                <Button onClick={() => setStep(2)} variant="outline" size="lg">
                  ← Kembali
                </Button>
                <Button 
                  onClick={calculateAllScores} 
                  disabled={loading} 
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                >
                  🧮 Hitung Nilai
                </Button>
                <Button 
                  onClick={handleSaveGrades} 
                  disabled={loading}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  💾 Simpan
                </Button>
              </div>
              
              <div className="relative">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 z-30">
                      <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50">
                      <TableHead className="sticky left-0 bg-gradient-to-r from-blue-50 to-blue-50 z-20 border-r-2 border-blue-200 font-semibold w-12">No</TableHead>
                      <TableHead className="sticky left-12 bg-gradient-to-r from-blue-50 to-blue-50 z-20 border-r-2 border-blue-200 font-semibold min-w-[160px]">Nama Siswa</TableHead>
                      {Array.from({ length: mcCount }, (_, idx) => {
                        const weight = useTemplate && selectedTemplate 
                          ? selectedTemplate.multiple_choice.weight 
                          : selectedQB?.questions.multipleChoice[idx]?.weight || 1;
                        return (
                          <TableHead key={`mc-${idx}`} className="text-center bg-green-50 font-semibold border-x">
                            PG {idx + 1}<br />
                            <span className="text-xs font-normal text-gray-500">({weight})</span>
                          </TableHead>
                        );
                      })}
                      {Array.from({ length: essayCount }, (_, idx) => {
                        const weight = useTemplate && selectedTemplate
                          ? selectedTemplate.essay.weight
                          : selectedQB?.questions.essay[idx]?.weight || 0;
                        return (
                          <TableHead key={`essay-${idx}`} className="text-center bg-purple-50 font-semibold border-x">
                            Essay {idx + 1}<br />
                            <span className="text-xs font-normal text-gray-500">(max {weight})</span>
                          </TableHead>
                        );
                      })}
                      <TableHead className="text-center font-bold bg-blue-100 border-l-2 border-blue-300 w-24">Total Skor</TableHead>
                      <TableHead className="text-center font-bold bg-indigo-100 border-x-2 border-indigo-300 w-20">Nilai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grades.map((grade, studentIdx) => (
                      <TableRow key={grade.studentId} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="sticky left-0 bg-white z-10 border-r-2 border-blue-200 font-medium">{studentIdx + 1}</TableCell>
                        <TableCell className="sticky left-12 bg-white z-10 border-r-2 border-blue-200 font-medium">
                          {grade.studentName}
                        </TableCell>
                        
                        {/* Multiple Choice Answers */}
                        {grade.mcAnswers.map((answer, qIdx) => {
                          const correctAnswer = useTemplate && selectedTemplate
                            ? selectedTemplate.multiple_choice.answer_keys[qIdx]
                            : selectedQB?.questions.multipleChoice[qIdx]?.correctAnswer;
                          const isCorrect = answer && answer === correctAnswer;
                          const isWrong = answer && answer !== correctAnswer;
                          return (
                            <TableCell key={`mc-${studentIdx}-${qIdx}`} className="border-x p-1">
                              <Input
                                data-student={studentIdx}
                                data-question={qIdx}
                                className={`w-12 text-center font-semibold uppercase transition-colors ${
                                  isCorrect ? 'bg-green-100 border-green-400 text-green-800' : 
                                  isWrong ? 'bg-red-100 border-red-400 text-red-800' : 
                                  'border-gray-300'
                                }`}
                                value={answer}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  if (val.length <= 1) {
                                    updateMCAnswer(studentIdx, qIdx, val, true);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const nextInput = document.querySelector(
                                      `input[data-student="${studentIdx}"][data-question="${qIdx + 1}"]`
                                    ) as HTMLInputElement;
                                    if (nextInput) {
                                      nextInput.focus();
                                      nextInput.select();
                                    }
                                  }
                                }}
                                maxLength={1}
                                placeholder="-"
                              />
                            </TableCell>
                          );
                        })}
                        
                        {/* Essay Scores */}
                        {grade.essayScores.map((score, qIdx) => {
                          const maxScore = useTemplate && selectedTemplate
                            ? selectedTemplate.essay.weight
                            : selectedQB?.questions.essay[qIdx]?.weight || 0;
                          return (
                            <TableCell key={`essay-${studentIdx}-${qIdx}`} className="border-x p-1">
                              <Input
                                className="w-16 text-center font-medium border-gray-300"
                                type="number"
                                value={score || ''}
                                onChange={(e) => updateEssayScore(studentIdx, qIdx, e.target.value)}
                                max={maxScore}
                                min={0}
                                placeholder="0"
                              />
                            </TableCell>
                          );
                        })}
                        
                        {/* Total Score */}
                        <TableCell className="text-center font-bold bg-blue-50 border-l-2 border-blue-300 text-blue-900">
                          {grade.isCalculated ? grade.totalScore : '-'}
                        </TableCell>
                        
                        {/* Final Grade (Nilai Ulangan) */}
                        <TableCell className="text-center font-bold bg-indigo-50 border-x-2 border-indigo-300">
                          <span className={`text-lg ${
                            grade.isCalculated 
                              ? grade.finalGrade >= 75 ? 'text-green-600' : 'text-red-600'
                              : 'text-gray-400'
                          }`}>
                            {grade.isCalculated ? grade.finalGrade : '-'}
                          </span>
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
        );
      })()}

      {/* Horizontal Scrollbar - Fixed at bottom like image 2 */}
      {step === 3 && (
        <div className="sticky bottom-0 left-0 right-0 bg-gray-100 border-t-2 border-gray-300 z-50 py-2 mt-4">
          <div 
            id="custom-scrollbar"
            className="overflow-x-auto overflow-y-hidden px-2"
          >
            <div 
              style={{ 
                width: `${tableScrollWidth || 2000}px`,
                height: '1px'
              }}
            />
          </div>
        </div>
      )}
      
      <style jsx global>{`
        /* Hide default scrollbar in content wrapper */
        #content-wrapper {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        #content-wrapper::-webkit-scrollbar {
          display: none;
        }
        
        /* Native scrollbar styling for custom-scrollbar - Simple and clear like image 2 */
        #custom-scrollbar {
          scrollbar-width: auto;
          scrollbar-color: #3b82f6 #e5e7eb;
        }
        
        /* WebKit scrollbar styling - Make it prominent like in image 2 */
        #custom-scrollbar::-webkit-scrollbar {
          height: 16px;
        }
        
        #custom-scrollbar::-webkit-scrollbar-track {
          background: #d1d5db;
          border-radius: 0;
        }
        
        #custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3b82f6;
          border-radius: 0;
          border: 1px solid #9ca3af;
        }
        
        #custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2563eb;
        }
        
        #custom-scrollbar::-webkit-scrollbar-thumb:active {
          background: #1d4ed8;
        }
        
        /* Firefox scrollbar */
        #custom-scrollbar {
          scrollbar-width: auto !important;
          scrollbar-color: #3b82f6 #d1d5db !important;
        }
      `}</style>
    </div>
  );
}
