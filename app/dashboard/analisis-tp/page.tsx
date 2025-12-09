'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTemplate, Grade, TPAchievementAnalysis, QuestionBank } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type SourceType = 'template' | 'bank_soal';

export default function AnalisisTPPage() {
  const { user } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'analisis' | 'rekap' | 'rekap-kelas'>('analisis');
  
  const [sourceType, setSourceType] = useState<SourceType>('template');
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState('');
  
  const [analysis, setAnalysis] = useState<TPAchievementAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Rekap Siswa tab states
  const [rekapStudents, setRekapStudents] = useState<string[]>([]);
  const [rekapSelectedStudent, setRekapSelectedStudent] = useState('');
  const [rekapSubjects, setRekapSubjects] = useState<string[]>([]);
  const [rekapSelectedSubject, setRekapSelectedSubject] = useState('');
  const [rekapData, setRekapData] = useState<any>(null);
  const [rekapLoading, setRekapLoading] = useState(false);
  
  // Rekap Kelas tab states
  const [rekapKelasClasses, setRekapKelasClasses] = useState<Array<{id: string, name: string}>>([]);
  const [rekapKelasSelectedClass, setRekapKelasSelectedClass] = useState('');
  const [rekapKelasSubjects, setRekapKelasSubjects] = useState<string[]>([]);
  const [rekapKelasSelectedSubject, setRekapKelasSelectedSubject] = useState('');
  const [rekapKelasData, setRekapKelasData] = useState<any>(null);
  const [rekapKelasLoading, setRekapKelasLoading] = useState(false);
  
  useEffect(() => {
    if (user) {
      loadTemplates();
      loadQuestionBanks();
    }
  }, [user]);
  
  useEffect(() => {
    if (selectedSourceId) {
      loadGrades();
    }
  }, [selectedSourceId, sourceType]);
  
  const loadTemplates = async () => {
    if (!user) return;
    
    try {
      const q = query(
        collection(db, 'exam_templates'),
        where('user_id', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const data: ExamTemplate[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as ExamTemplate);
      });
      setTemplates(data.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };
  
  const loadQuestionBanks = async () => {
    if (!user) return;
    
    try {
      const q = query(
        collection(db, 'question_banks'),
        where('user_id', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const data: QuestionBank[] = [];
      snapshot.forEach(doc => {
        const qb = { id: doc.id, ...doc.data() } as QuestionBank;
        // Only include question banks with TP mapping
        if (qb.question_tp_mapping && qb.question_tp_mapping.length > 0) {
          data.push(qb);
        }
      });
      setQuestionBanks(data.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (error) {
      console.error('Error loading question banks:', error);
    }
  };
  
  const loadGrades = async () => {
    if (!user || !selectedSourceId) return;
    
    try {
      let q;
      
      if (sourceType === 'template') {
        q = query(
          collection(db, 'grades'),
          where('user_id', '==', user.uid),
          where('exam_template_id', '==', selectedSourceId)
        );
      } else {
        q = query(
          collection(db, 'grades'),
          where('user_id', '==', user.uid),
          where('question_bank_id', '==', selectedSourceId)
        );
      }
      
      const snapshot = await getDocs(q);
      const data: Grade[] = [];
      snapshot.forEach(doc => {
        const gradeData = { id: doc.id, ...doc.data() } as Grade;
        // Only include grades with TP mapping
        if (gradeData.tp_mapping && gradeData.tp_mapping.length > 0) {
          data.push(gradeData);
        }
      });
      setGrades(data);
    } catch (error) {
      console.error('Error loading grades:', error);
    }
  };
  
  const calculateTPAchievement = () => {
    if (!selectedSourceId || !selectedGradeId) {
      alert('Pilih sumber dan kelas terlebih dahulu');
      return;
    }
    
    const gradeData = grades.find(g => g.id === selectedGradeId);
    if (!gradeData || !gradeData.tp_mapping) return;
    
    setLoading(true);
    
    try {
      // Group questions by TP
      const tpGroups: { [tpId: string]: {
        tp_id: string;
        tp_text: string;
        chapter: string;
        questions: Array<{ question_number: number; question_type: 'PG' | 'Essay' }>;
      }} = {};
      
      gradeData.tp_mapping.forEach((mapping) => {
        if (!tpGroups[mapping.tp_id]) {
          tpGroups[mapping.tp_id] = {
            tp_id: mapping.tp_id,
            tp_text: mapping.tp_text,
            chapter: '', // Will be filled if available
            questions: []
          };
        }
        tpGroups[mapping.tp_id].questions.push({
          question_number: mapping.question_number,
          question_type: mapping.question_type
        });
      });
      
      // Get question config (weights and counts) from source
      let pgWeight = 1;
      let essayWeight = 1;
      let pgCount = 0;
      let maxScore = 100;
      let examName = gradeData.exam_title;
      
      if (sourceType === 'template') {
        const template = templates.find(t => t.id === selectedSourceId);
        if (template) {
          pgWeight = template.multiple_choice.weight;
          essayWeight = template.essay.weight;
          pgCount = template.multiple_choice.count;
          maxScore = template.max_score;
          examName = template.exam_name;
          
          // Fill chapter info from template
          template.tp_details.forEach((tpDetail) => {
            if (tpGroups[tpDetail.tp_id]) {
              tpGroups[tpDetail.tp_id].chapter = tpDetail.chapter;
            }
          });
        }
      } else {
        const qb = questionBanks.find(q => q.id === selectedSourceId);
        if (qb) {
          pgWeight = qb.questions.multipleChoice[0]?.weight || 1;
          essayWeight = qb.questions.essay[0]?.weight || 1;
          pgCount = qb.questions.multipleChoice.length;
          
          const pgMaxScore = pgCount * pgWeight;
          const essayMaxScore = qb.questions.essay.reduce((sum, q) => sum + q.weight, 0);
          maxScore = pgMaxScore + essayMaxScore;
          examName = qb.examTitle;
        }
      }
      
      const results: TPAchievementAnalysis[] = [];
      
      // Calculate for each student
      gradeData.grades.forEach((studentGrade) => {
        const tpAnalysis = Object.values(tpGroups).map((tpGroup) => {
          const questions: any[] = [];
          let totalScore = 0;
          let maxPossibleScore = 0;
          
          // Process each question for this TP
          tpGroup.questions.forEach(({ question_number, question_type }) => {
            if (question_type === 'PG') {
              const answerIndex = question_number - 1;
              const studentAnswer = studentGrade.mcAnswers[answerIndex];
              
              // Get correct answer
              let correctAnswer = '';
              let weight = pgWeight;
              
              if (sourceType === 'template') {
                const template = templates.find(t => t.id === selectedSourceId);
                if (template) {
                  correctAnswer = template.multiple_choice.answer_keys[answerIndex];
                  weight = template.multiple_choice.weight;
                }
              } else {
                const qb = questionBanks.find(q => q.id === selectedSourceId);
                if (qb) {
                  correctAnswer = qb.questions.multipleChoice[answerIndex]?.correctAnswer || '';
                  weight = qb.questions.multipleChoice[answerIndex]?.weight || pgWeight;
                }
              }
              
              const isCorrect = studentAnswer === correctAnswer;
              const score = isCorrect ? weight : 0;
              
              questions.push({
                number: question_number,
                type: 'PG' as const,
                max_score: weight,
                student_score: score,
                is_correct: isCorrect
              });
              
              totalScore += score;
              maxPossibleScore += weight;
            } else {
              // Essay question
              const essayIndex = question_number - pgCount - 1;
              const score = studentGrade.essayScores[essayIndex] || 0;
              
              let weight = essayWeight;
              if (sourceType === 'bank_soal') {
                const qb = questionBanks.find(q => q.id === selectedSourceId);
                if (qb && qb.questions.essay[essayIndex]) {
                  weight = qb.questions.essay[essayIndex].weight;
                }
              } else {
                const template = templates.find(t => t.id === selectedSourceId);
                if (template) {
                  weight = template.essay.weight;
                }
              }
              
              questions.push({
                number: question_number,
                type: 'Isian' as const,
                max_score: weight,
                student_score: score
              });
              
              totalScore += score;
              maxPossibleScore += weight;
            }
          });
          
          const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
          
          // Determine achievement level
          let achievementLevel: 'Belum Berkembang' | 'Mulai Berkembang' | 'Berkembang Sesuai Harapan' | 'Sangat Berkembang';
          if (percentage < 50) {
            achievementLevel = 'Belum Berkembang';
          } else if (percentage < 70) {
            achievementLevel = 'Mulai Berkembang';
          } else if (percentage < 85) {
            achievementLevel = 'Berkembang Sesuai Harapan';
          } else {
            achievementLevel = 'Sangat Berkembang';
          }
          
          return {
            tp_id: tpGroup.tp_id,
            tp_text: tpGroup.tp_text,
            chapter: tpGroup.chapter || 'N/A',
            questions,
            total_score: totalScore,
            max_possible_score: maxPossibleScore,
            percentage: Math.round(percentage),
            achievement_level: achievementLevel
          };
        });
        
        results.push({
          id: `${selectedGradeId}_${studentGrade.studentId}`,
          user_id: user!.uid,
          exam_template_id: sourceType === 'template' ? selectedSourceId : '',
          exam_name: examName,
          class_id: gradeData.class_id,
          class_name: gradeData.class_name,
          student_id: studentGrade.studentId,
          student_name: studentGrade.studentName,
          tp_analysis: tpAnalysis,
          overall_score: studentGrade.totalScore,
          overall_percentage: Math.round((studentGrade.totalScore / maxScore) * 100),
          created_at: new Date().toISOString()
        });
      });
      
      setAnalysis(results);
    } catch (error) {
      console.error('Error calculating TP achievement:', error);
      alert('Gagal menghitung analisis TP');
    } finally {
      setLoading(false);
    }
  };
  
  const getAchievementColor = (level: string) => {
    switch (level) {
      case 'Sangat Berkembang':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Berkembang Sesuai Harapan':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Mulai Berkembang':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Belum Berkembang':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };
  
  const exportToCSV = () => {
    if (analysis.length === 0) return;
    
    // CSV Header
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'Nama Siswa,';
    
    // Get unique TPs from first student
    const firstStudent = analysis[0];
    firstStudent.tp_analysis.forEach((tp, idx) => {
      csv += `TP ${idx + 1} - ${tp.chapter},Persentase,Level Ketercapaian,`;
    });
    csv += 'Nilai Total,Persentase Total\n';
    
    // Data rows
    analysis.forEach((student) => {
      csv += `${student.student_name},`;
      
      student.tp_analysis.forEach((tp) => {
        csv += `${tp.total_score}/${tp.max_possible_score},${tp.percentage}%,${tp.achievement_level},`;
      });
      
      csv += `${student.overall_score},${student.overall_percentage}%\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const sourceName = sourceType === 'template' 
      ? (templates.find(t => t.id === selectedSourceId)?.exam_name || 'Ujian')
      : (questionBanks.find(q => q.id === selectedSourceId)?.examTitle || 'Ujian');
    link.download = `Analisis_TP_${sourceName}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };
  
  // Load students and subjects for Rekap tab
  useEffect(() => {
    if (user && activeTab === 'rekap') {
      loadRekapData();
    }
  }, [user, activeTab]);
  
  // Load classes and subjects for Rekap Kelas tab
  useEffect(() => {
    if (user && activeTab === 'rekap-kelas') {
      loadRekapKelasData();
    }
  }, [user, activeTab]);
  
  const loadRekapData = async () => {
    if (!user) return;
    
    try {
      // Get all grades with TP mapping
      const gradesQuery = query(
        collection(db, 'grades'),
        where('user_id', '==', user.uid)
      );
      const gradesSnapshot = await getDocs(gradesQuery);
      
      const studentsSet = new Set<string>();
      const subjectsSet = new Set<string>();
      
      gradesSnapshot.forEach(doc => {
        const grade = doc.data() as Grade;
        if (grade.tp_mapping && grade.tp_mapping.length > 0) {
          // Collect students
          grade.grades.forEach(g => {
            studentsSet.add(JSON.stringify({ id: g.studentId, name: g.studentName }));
          });
          
          // Collect subjects
          if (grade.subject) {
            subjectsSet.add(grade.subject);
          }
        }
      });
      
      const students = Array.from(studentsSet).map(s => JSON.parse(s));
      setRekapStudents(students.sort((a, b) => a.name.localeCompare(b.name)));
      setRekapSubjects(Array.from(subjectsSet).sort());
    } catch (error) {
      console.error('Error loading rekap data:', error);
    }
  };
  
  const loadStudentRekapBySubject = async () => {
    if (!user || !rekapSelectedStudent || !rekapSelectedSubject) return;
    
    setRekapLoading(true);
    
    try {
      // Get all grades for this student and subject
      const gradesQuery = query(
        collection(db, 'grades'),
        where('user_id', '==', user.uid),
        where('subject', '==', rekapSelectedSubject)
      );
      const gradesSnapshot = await getDocs(gradesQuery);
      
      const tpAchievements: any = {};
      let totalExams = 0;
      
      gradesSnapshot.forEach(doc => {
        const grade = doc.data() as Grade;
        if (!grade.tp_mapping || grade.tp_mapping.length === 0) return;
        
        const studentData = grade.grades.find(g => g.studentId === rekapSelectedStudent);
        if (!studentData) return;
        
        totalExams++;
        
        // Get answer keys from template or question bank
        let answerKeys: string[] = [];
        if (grade.exam_template_id) {
          const template = templates.find(t => t.id === grade.exam_template_id);
          if (template) {
            answerKeys = template.multiple_choice.answer_keys;
          }
        } else if (grade.question_bank_id) {
          const qb = questionBanks.find(q => q.id === grade.question_bank_id);
          if (qb) {
            answerKeys = qb.questions.multipleChoice.map(q => q.correctAnswer);
          }
        }
        
        // Process TP achievements for this exam
        const tpGroups: any = {};
        grade.tp_mapping.forEach(mapping => {
          if (!tpGroups[mapping.tp_id]) {
            tpGroups[mapping.tp_id] = {
              tp_text: mapping.tp_text,
              questions: []
            };
          }
          tpGroups[mapping.tp_id].questions.push({
            number: mapping.question_number,
            type: mapping.question_type
          });
        });
        
        // Calculate achievement for each TP
        Object.entries(tpGroups).forEach(([tpId, tpData]: [string, any]) => {
          let totalScore = 0;
          let maxScore = 0;
          
          tpData.questions.forEach((q: any) => {
            if (q.type === 'PG') {
              const answerIndex = q.number - 1;
              if (studentData.mcAnswers && answerKeys[answerIndex] && 
                  studentData.mcAnswers[answerIndex] === answerKeys[answerIndex]) {
                totalScore += 1;
              }
              maxScore += 1;
            } else {
              const essayScore = studentData.essayScores?.[q.number - 1];
              if (essayScore !== undefined) {
                totalScore += essayScore;
                // Assume max score for essay is from template/qb, default to 10
                maxScore += 10;
              }
            }
          });
          
          const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
          
          if (!tpAchievements[tpId]) {
            tpAchievements[tpId] = {
              tp_id: tpId,
              tp_text: tpData.tp_text,
              achievements: [],
              average: 0
            };
          }
          
          tpAchievements[tpId].achievements.push({
            exam_name: grade.exam_title,
            percentage: Math.round(percentage)
          });
        });
      });
      
      // Calculate averages
      Object.values(tpAchievements).forEach((tp: any) => {
        const sum = tp.achievements.reduce((acc: number, a: any) => acc + a.percentage, 0);
        tp.average = Math.round(sum / tp.achievements.length);
      });
      
      setRekapData({
        student: rekapStudents.find((s: any) => s.id === rekapSelectedStudent),
        subject: rekapSelectedSubject,
        totalExams,
        tpAchievements: Object.values(tpAchievements)
      });
    } catch (error) {
      console.error('Error loading student rekap:', error);
      alert('Gagal memuat data rekap');
    } finally {
      setRekapLoading(false);
    }
  };
  
  const loadRekapKelasData = async () => {
    if (!user) return;
    
    try {
      // Get all grades with TP mapping
      const gradesQuery = query(
        collection(db, 'grades'),
        where('user_id', '==', user.uid)
      );
      const gradesSnapshot = await getDocs(gradesQuery);
      
      const classesSet = new Set<string>();
      const subjectsSet = new Set<string>();
      
      gradesSnapshot.forEach(doc => {
        const grade = doc.data() as Grade;
        if (grade.tp_mapping && grade.tp_mapping.length > 0) {
          // Collect classes
          classesSet.add(JSON.stringify({ id: grade.class_id, name: grade.class_name }));
          
          // Collect subjects
          if (grade.subject) {
            subjectsSet.add(grade.subject);
          }
        }
      });
      
      const classes = Array.from(classesSet).map(c => JSON.parse(c));
      setRekapKelasClasses(classes.sort((a, b) => a.name.localeCompare(b.name)));
      setRekapKelasSubjects(Array.from(subjectsSet).sort());
    } catch (error) {
      console.error('Error loading rekap kelas data:', error);
    }
  };
  
  const loadClassRekapBySubject = async () => {
    if (!user || !rekapKelasSelectedClass || !rekapKelasSelectedSubject) return;
    
    setRekapKelasLoading(true);
    
    try {
      // Get all grades for this class and subject
      const gradesQuery = query(
        collection(db, 'grades'),
        where('user_id', '==', user.uid),
        where('class_id', '==', rekapKelasSelectedClass),
        where('subject', '==', rekapKelasSelectedSubject)
      );
      const gradesSnapshot = await getDocs(gradesQuery);
      
      const tpAchievements: any = {};
      let totalExams = 0;
      let totalStudents = new Set<string>();
      
      gradesSnapshot.forEach(doc => {
        const grade = doc.data() as Grade;
        if (!grade.tp_mapping || grade.tp_mapping.length === 0) return;
        
        totalExams++;
        
        // Get answer keys
        let answerKeys: string[] = [];
        if (grade.exam_template_id) {
          const template = templates.find(t => t.id === grade.exam_template_id);
          if (template) {
            answerKeys = template.multiple_choice.answer_keys;
          }
        } else if (grade.question_bank_id) {
          const qb = questionBanks.find(q => q.id === grade.question_bank_id);
          if (qb) {
            answerKeys = qb.questions.multipleChoice.map(q => q.correctAnswer);
          }
        }
        
        // Process TP achievements for each student
        grade.grades.forEach(studentData => {
          totalStudents.add(studentData.studentId);
          
          // Process TP groups
          const tpGroups: any = {};
          grade.tp_mapping.forEach(mapping => {
            if (!tpGroups[mapping.tp_id]) {
              tpGroups[mapping.tp_id] = {
                tp_text: mapping.tp_text,
                questions: []
              };
            }
            tpGroups[mapping.tp_id].questions.push({
              number: mapping.question_number,
              type: mapping.question_type
            });
          });
          
          // Calculate achievement for each TP
          Object.entries(tpGroups).forEach(([tpId, tpData]: [string, any]) => {
            let totalScore = 0;
            let maxScore = 0;
            
            tpData.questions.forEach((q: any) => {
              if (q.type === 'PG') {
                const answerIndex = q.number - 1;
                if (studentData.mcAnswers && answerKeys[answerIndex] && 
                    studentData.mcAnswers[answerIndex] === answerKeys[answerIndex]) {
                  totalScore += 1;
                }
                maxScore += 1;
              } else {
                const essayScore = studentData.essayScores?.[q.number - 1];
                if (essayScore !== undefined) {
                  totalScore += essayScore;
                  maxScore += 10;
                }
              }
            });
            
            const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
            
            if (!tpAchievements[tpId]) {
              tpAchievements[tpId] = {
                tp_id: tpId,
                tp_text: tpData.tp_text,
                achievements: [],
                studentCount: 0
              };
            }
            
            tpAchievements[tpId].achievements.push(percentage);
          });
        });
      });
      
      // Calculate class averages and distribution
      Object.values(tpAchievements).forEach((tp: any) => {
        const sum = tp.achievements.reduce((acc: number, val: number) => acc + val, 0);
        tp.average = Math.round(sum / tp.achievements.length);
        tp.studentCount = tp.achievements.length;
        
        // Calculate distribution
        tp.distribution = {
          sangatBerkembang: tp.achievements.filter((p: number) => p >= 85).length,
          berkembangSesuai: tp.achievements.filter((p: number) => p >= 70 && p < 85).length,
          mulaiBerkembang: tp.achievements.filter((p: number) => p >= 50 && p < 70).length,
          belumBerkembang: tp.achievements.filter((p: number) => p < 50).length
        };
      });
      
      const classData = rekapKelasClasses.find(c => c.id === rekapKelasSelectedClass);
      
      setRekapKelasData({
        class: classData,
        subject: rekapKelasSelectedSubject,
        totalExams,
        totalStudents: totalStudents.size,
        tpAchievements: Object.values(tpAchievements)
      });
    } catch (error) {
      console.error('Error loading class rekap:', error);
      alert('Gagal memuat data rekap kelas');
    } finally {
      setRekapKelasLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analisis Ketercapaian TP</h1>
        <p className="text-muted-foreground">
          Analisis pencapaian Tujuan Pembelajaran per siswa berdasarkan hasil ujian
        </p>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('analisis')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'analisis'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          📊 Analisis Per Ujian
        </button>
        <button
          onClick={() => setActiveTab('rekap')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'rekap'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          📈 Rekap Ketercapaian TP
        </button>
        <button
          onClick={() => setActiveTab('rekap-kelas')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'rekap-kelas'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          🏫 Rekap Kelas
        </button>
      </div>
      
      {/* Tab Content: Analisis Per Ujian */}
      {activeTab === 'analisis' && (
        <>
          {/* Source Type Selection */}
          <Card className="p-6">
        <label className="block text-sm font-medium mb-3">Sumber Soal</label>
        <div className="flex gap-4">
          <Button
            variant={sourceType === 'template' ? 'default' : 'outline'}
            onClick={() => {
              setSourceType('template');
              setSelectedSourceId('');
              setSelectedGradeId('');
              setAnalysis([]);
            }}
          >
            📝 Template Ujian
          </Button>
          <Button
            variant={sourceType === 'bank_soal' ? 'default' : 'outline'}
            onClick={() => {
              setSourceType('bank_soal');
              setSelectedSourceId('');
              setSelectedGradeId('');
              setAnalysis([]);
            }}
          >
            📚 Bank Soal (Generate AI)
          </Button>
        </div>
        {sourceType === 'bank_soal' && questionBanks.length === 0 && (
          <p className="text-sm text-yellow-600 mt-2">
            ⚠️ Tidak ada Bank Soal dengan pemetaan TP. Generate soal baru atau gunakan Template Ujian.
          </p>
        )}
      </Card>
      
      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {sourceType === 'template' ? 'Template Ujian' : 'Bank Soal'}
            </label>
            <select
              className="w-full p-2 border rounded"
              value={selectedSourceId}
              aria-label="Pilih Template atau Bank Soal"
              onChange={(e) => {
                setSelectedSourceId(e.target.value);
                setSelectedGradeId('');
                setAnalysis([]);
              }}
            >
              <option value="">Pilih...</option>
              {sourceType === 'template' ? (
                templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.exam_name} ({t.exam_type} - Kelas {t.grade})
                  </option>
                ))
              ) : (
                questionBanks.map((qb) => (
                  <option key={qb.id} value={qb.id}>
                    {qb.examTitle} ({qb.subject}{qb.grade || qb.kelas ? ` - Kelas ${qb.grade || qb.kelas}` : ''})
                  </option>
                ))
              )}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Kelas</label>
            <select
              className="w-full p-2 border rounded"
              value={selectedGradeId}
              aria-label="Pilih Kelas"
              onChange={(e) => {
                setSelectedGradeId(e.target.value);
                setAnalysis([]);
              }}
              disabled={!selectedSourceId}
            >
              <option value="">Pilih Kelas...</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.class_name} - {g.exam_title}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end gap-2">
            <Button
              onClick={calculateTPAchievement}
              disabled={!selectedSourceId || !selectedGradeId || loading}
              className="flex-1"
            >
              {loading ? 'Menghitung...' : 'Analisis'}
            </Button>
            {analysis.length > 0 && (
              <Button variant="outline" onClick={exportToCSV}>
                Export CSV
              </Button>
            )}
          </div>
        </div>
      </Card>
      
      {/* Results */}
      {analysis.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            Hasil Analisis ({analysis.length} Siswa)
          </h2>
          
          {analysis.map((student) => (
            <Card key={student.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{student.student_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {student.class_name} - {student.exam_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{student.overall_score}</p>
                  <p className="text-sm text-muted-foreground">
                    {student.overall_percentage}%
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                {student.tp_analysis.map((tp) => (
                  <div key={tp.tp_id} className="border rounded p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          {tp.chapter}
                        </p>
                        <p className="text-sm">{tp.tp_text}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold">
                          {tp.total_score}/{tp.max_possible_score}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {tp.percentage}%
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getAchievementColor(tp.achievement_level)}`}>
                        {tp.achievement_level}
                      </span>
                      
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            tp.percentage >= 85 ? 'bg-green-500' :
                            tp.percentage >= 70 ? 'bg-blue-500' :
                            tp.percentage >= 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${tp.percentage}%` }}
                        />
                      </div>
                      
                      <span className="text-xs text-muted-foreground">
                        Soal: {tp.questions.map(q => q.number).join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      
      {analysis.length === 0 && selectedSourceId && selectedGradeId && !loading && (
        <Card className="p-8 text-center text-muted-foreground">
          <p>Klik tombol "Analisis" untuk melihat hasil ketercapaian TP</p>
        </Card>
      )}
      
      {/* Legend */}
      {analysis.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-3">Kriteria Ketercapaian</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getAchievementColor('Sangat Berkembang')}`}>
                Sangat Berkembang
              </span>
              <p className="text-xs text-muted-foreground mt-1">≥ 85%</p>
            </div>
            <div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getAchievementColor('Berkembang Sesuai Harapan')}`}>
                Berkembang Sesuai Harapan
              </span>
              <p className="text-xs text-muted-foreground mt-1">70% - 84%</p>
            </div>
            <div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getAchievementColor('Mulai Berkembang')}`}>
                Mulai Berkembang
              </span>
              <p className="text-xs text-muted-foreground mt-1">50% - 69%</p>
            </div>
            <div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getAchievementColor('Belum Berkembang')}`}>
                Belum Berkembang
              </span>
              <p className="text-xs text-muted-foreground mt-1">&lt; 50%</p>
            </div>
          </div>
        </Card>
      )}
        </>
      )}
      
      {/* Tab Content: Rekap Ketercapaian TP */}
      {activeTab === 'rekap' && (
        <>
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Rekap Ketercapaian TP Per Siswa</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Lihat rekap pencapaian semua TP untuk satu siswa di mata pelajaran tertentu
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Pilih Siswa</label>
                <select
                  className="w-full p-2 border rounded"
                  value={rekapSelectedStudent}
                  aria-label="Pilih Siswa"
                  onChange={(e) => {
                    setRekapSelectedStudent(e.target.value);
                    setRekapData(null);
                  }}
                >
                  <option value="">Pilih Siswa...</option>
                  {rekapStudents.map((student: any) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Pilih Mata Pelajaran</label>
                <select
                  className="w-full p-2 border rounded"
                  value={rekapSelectedSubject}
                  aria-label="Pilih Mata Pelajaran"
                  onChange={(e) => {
                    setRekapSelectedSubject(e.target.value);
                    setRekapData(null);
                  }}
                >
                  <option value="">Pilih Mapel...</option>
                  {rekapSubjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <Button
              onClick={loadStudentRekapBySubject}
              disabled={!rekapSelectedStudent || !rekapSelectedSubject || rekapLoading}
              className="w-full"
            >
              {rekapLoading ? 'Memuat Data...' : '🔍 Tampilkan Rekap'}
            </Button>
          </Card>
          
          {/* Display Rekap Data */}
          {rekapData && (
            <Card className="p-6">
              <div className="mb-6">
                <h3 className="text-2xl font-bold">{rekapData.student?.name}</h3>
                <p className="text-muted-foreground">
                  Mata Pelajaran: <span className="font-semibold">{rekapData.subject}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Berdasarkan {rekapData.totalExams} ujian
                </p>
              </div>
              
              <div className="space-y-6">
                {rekapData.tpAchievements.map((tp: any, index: number) => (
                  <div key={tp.tp_id} className="border rounded-lg p-6 bg-muted/30">
                    <div className="mb-4">
                      <h4 className="font-semibold text-lg mb-2">
                        TP {index + 1}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {tp.tp_text}
                      </p>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Rata-rata Pencapaian</span>
                        <span className="text-2xl font-bold text-primary">
                          {tp.average}%
                        </span>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-8">
                        <div
                          className={`h-8 rounded-full flex items-center justify-center text-white text-sm font-medium transition-all ${
                            tp.average >= 85
                              ? 'bg-green-500'
                              : tp.average >= 70
                              ? 'bg-blue-500'
                              : tp.average >= 50
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${tp.average}%` }}
                        >
                          {tp.average >= 15 && `${tp.average}%`}
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            tp.average >= 85
                              ? 'bg-green-100 text-green-800 border border-green-300'
                              : tp.average >= 70
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : tp.average >= 50
                              ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                              : 'bg-red-100 text-red-800 border border-red-300'
                          }`}
                        >
                          {tp.average >= 85
                            ? '🌟 Sangat Berkembang'
                            : tp.average >= 70
                            ? '✅ Berkembang Sesuai Harapan'
                            : tp.average >= 50
                            ? '⚠️ Mulai Berkembang'
                            : '❌ Belum Berkembang'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Detail Per Ujian */}
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">Detail Per Ujian:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {tp.achievements.map((achievement: any, idx: number) => (
                          <div
                            key={idx}
                            className="border rounded p-2 bg-white text-xs"
                          >
                            <p className="font-medium truncate" title={achievement.exam_name}>
                              {achievement.exam_name}
                            </p>
                            <p className="text-muted-foreground">
                              {achievement.percentage}%
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Rekomendasi Tindak Lanjut */}
              <Card className="p-6 mt-6 bg-blue-50 border-blue-200">
                <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  💡 Rekomendasi Tindak Lanjut
                </h4>
                
                <div className="space-y-4">
                  {rekapData.tpAchievements
                    .filter((tp: any) => tp.average < 70)
                    .map((tp: any, index: number) => (
                      <div key={tp.tp_id} className="bg-white rounded-lg p-4 border">
                        <p className="font-medium mb-2">
                          TP: {tp.tp_text.substring(0, 100)}...
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          Pencapaian: {tp.average}%
                        </p>
                        <div className="text-sm space-y-1">
                          {tp.average < 50 && (
                            <>
                              <p className="text-red-700 font-medium">
                                ⚠️ Perlu Intervensi Intensif:
                              </p>
                              <ul className="list-disc list-inside text-red-600 space-y-1 ml-2">
                                <li>Remedial individual dengan pendekatan pembelajaran khusus</li>
                                <li>Identifikasi kesulitan belajar spesifik siswa</li>
                                <li>Konsultasi dengan orang tua untuk dukungan belajar di rumah</li>
                                <li>Latihan soal bertahap dari tingkat mudah ke sulit</li>
                              </ul>
                            </>
                          )}
                          {tp.average >= 50 && tp.average < 70 && (
                            <>
                              <p className="text-yellow-700 font-medium">
                                📚 Perlu Pengayaan:
                              </p>
                              <ul className="list-disc list-inside text-yellow-600 space-y-1 ml-2">
                                <li>Latihan soal tambahan dengan tingkat kesulitan bertahap</li>
                                <li>Peer tutoring dengan siswa yang sudah menguasai</li>
                                <li>Pemberian materi pengayaan dan contoh soal beragam</li>
                                <li>Monitoring berkala untuk memastikan peningkatan</li>
                              </ul>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  
                  {rekapData.tpAchievements.every((tp: any) => tp.average >= 70) && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <p className="text-green-800 font-medium">
                        ✅ Semua TP sudah tercapai dengan baik! Siswa dapat melanjutkan ke materi berikutnya.
                      </p>
                      <p className="text-sm text-green-700 mt-2">
                        Pertahankan prestasi dengan memberikan tantangan soal yang lebih kompleks untuk pengembangan lebih lanjut.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </Card>
          )}
        </>
      )}
      
      {/* Tab Content: Rekap Kelas */}
      {activeTab === 'rekap-kelas' && (
        <>
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-4">Rekap Ketercapaian TP Per Kelas</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Analisis pencapaian rata-rata kelas untuk setiap Tujuan Pembelajaran
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Pilih Kelas</label>
                  <select
                    value={rekapKelasSelectedClass || ''}
                    onChange={(e) => setRekapKelasSelectedClass(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {rekapKelasClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Pilih Mata Pelajaran</label>
                  <select
                    value={rekapKelasSelectedSubject || ''}
                    onChange={(e) => setRekapKelasSelectedSubject(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">-- Pilih Mapel --</option>
                    {rekapKelasSubjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <Button
                onClick={loadClassRekapBySubject}
                disabled={!rekapKelasSelectedClass || !rekapKelasSelectedSubject || rekapKelasLoading}
                className="w-full"
              >
                {rekapKelasLoading ? 'Memuat...' : '🔍 Tampilkan Rekap Kelas'}
              </Button>
            </div>
          </Card>
          
          {rekapKelasData && (
            <Card className="p-6">
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">
                    📊 {rekapKelasData.class?.name} - {rekapKelasData.subject}
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-blue-700">Total Ujian</p>
                      <p className="font-bold text-blue-900">{rekapKelasData.totalExams}</p>
                    </div>
                    <div>
                      <p className="text-blue-700">Total Siswa</p>
                      <p className="font-bold text-blue-900">{rekapKelasData.totalStudents}</p>
                    </div>
                    <div>
                      <p className="text-blue-700">Total TP Diajarkan</p>
                      <p className="font-bold text-blue-900">{rekapKelasData.tpAchievements.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-lg">Ketercapaian Rata-Rata Kelas per TP</h4>
                  {rekapKelasData.tpAchievements.map((tp: any, idx: number) => {
                    let color = 'bg-red-500';
                    let bgColor = 'bg-red-50';
                    let borderColor = 'border-red-200';
                    let textColor = 'text-red-800';
                    
                    if (tp.average >= 85) {
                      color = 'bg-green-500';
                      bgColor = 'bg-green-50';
                      borderColor = 'border-green-200';
                      textColor = 'text-green-800';
                    } else if (tp.average >= 70) {
                      color = 'bg-blue-500';
                      bgColor = 'bg-blue-50';
                      borderColor = 'border-blue-200';
                      textColor = 'text-blue-800';
                    } else if (tp.average >= 50) {
                      color = 'bg-yellow-500';
                      bgColor = 'bg-yellow-50';
                      borderColor = 'border-yellow-200';
                      textColor = 'text-yellow-800';
                    }
                    
                    return (
                      <div key={idx} className={`${bgColor} rounded-lg p-4 border ${borderColor}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-700">TP {idx + 1}</p>
                            <p className="text-sm mt-1">{tp.tp_text}</p>
                          </div>
                          <div className="text-right ml-4">
                            <p className={`text-2xl font-bold ${textColor}`}>{tp.average}%</p>
                            <p className="text-xs text-gray-600">Rata-rata Kelas</p>
                          </div>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                          <div
                            className={`${color} h-3 rounded-full transition-all duration-500`}
                            style={{ width: `${tp.average}%` }}
                          />
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div className="bg-white rounded p-2 border">
                            <p className="text-gray-600">Sangat Berkembang</p>
                            <p className="font-bold text-green-700">{tp.distribution.sangatBerkembang} siswa</p>
                            <p className="text-gray-500">≥ 85%</p>
                          </div>
                          <div className="bg-white rounded p-2 border">
                            <p className="text-gray-600">Berkembang Sesuai</p>
                            <p className="font-bold text-blue-700">{tp.distribution.berkembangSesuai} siswa</p>
                            <p className="text-gray-500">70-84%</p>
                          </div>
                          <div className="bg-white rounded p-2 border">
                            <p className="text-gray-600">Mulai Berkembang</p>
                            <p className="font-bold text-yellow-700">{tp.distribution.mulaiBerkembang} siswa</p>
                            <p className="text-gray-500">50-69%</p>
                          </div>
                          <div className="bg-white rounded p-2 border">
                            <p className="text-gray-600">Belum Berkembang</p>
                            <p className="font-bold text-red-700">{tp.distribution.belumBerkembang} siswa</p>
                            <p className="text-gray-500">&lt; 50%</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <Card className="bg-purple-50 border-purple-200">
                  <div className="p-4">
                    <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                      💡 Rekomendasi Tindak Lanjut Kelas
                    </h4>
                    
                    {rekapKelasData.tpAchievements.filter((tp: any) => tp.average < 70).length > 0 && (
                      <div className="mb-4 bg-red-50 rounded-lg p-3 border border-red-200">
                        <p className="font-medium text-red-800 mb-2">🚨 Perlu Perhatian Khusus:</p>
                        <ul className="text-sm text-red-700 space-y-1">
                          {rekapKelasData.tpAchievements
                            .filter((tp: any) => tp.average < 70)
                            .map((tp: any, idx: number) => (
                              <li key={idx}>
                                • <strong>TP {rekapKelasData.tpAchievements.indexOf(tp) + 1}</strong>: 
                                Rata-rata kelas {tp.average}% - {tp.distribution.belumBerkembang + tp.distribution.mulaiBerkembang} siswa perlu remedial
                              </li>
                            ))}
                        </ul>
                        <p className="text-sm text-red-700 mt-3 font-medium">
                          💬 Saran: Lakukan pembelajaran ulang dengan metode berbeda (diskusi kelompok, praktik langsung, atau media visual)
                        </p>
                      </div>
                    )}
                    
                    {rekapKelasData.tpAchievements.filter((tp: any) => tp.average >= 70 && tp.average < 85).length > 0 && (
                      <div className="mb-4 bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <p className="font-medium text-blue-800 mb-2">📈 Cukup Baik - Perlu Penguatan:</p>
                        <ul className="text-sm text-blue-700 space-y-1">
                          {rekapKelasData.tpAchievements
                            .filter((tp: any) => tp.average >= 70 && tp.average < 85)
                            .map((tp: any, idx: number) => (
                              <li key={idx}>
                                • <strong>TP {rekapKelasData.tpAchievements.indexOf(tp) + 1}</strong>: 
                                Rata-rata kelas {tp.average}% - {tp.distribution.mulaiBerkembang + tp.distribution.belumBerkembang} siswa perlu pendampingan
                              </li>
                            ))}
                        </ul>
                        <p className="text-sm text-blue-700 mt-3 font-medium">
                          💬 Saran: Berikan latihan tambahan dan bentuk kelompok belajar peer tutoring
                        </p>
                      </div>
                    )}
                    
                    {rekapKelasData.tpAchievements.filter((tp: any) => tp.average >= 85).length > 0 && (
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <p className="font-medium text-green-800 mb-2">✅ Sangat Baik - Siap Pengayaan:</p>
                        <ul className="text-sm text-green-700 space-y-1">
                          {rekapKelasData.tpAchievements
                            .filter((tp: any) => tp.average >= 85)
                            .map((tp: any, idx: number) => (
                              <li key={idx}>
                                • <strong>TP {rekapKelasData.tpAchievements.indexOf(tp) + 1}</strong>: 
                                Rata-rata kelas {tp.average}% - {tp.distribution.sangatBerkembang} siswa sudah sangat baik
                              </li>
                            ))}
                        </ul>
                        <p className="text-sm text-green-700 mt-3 font-medium">
                          💬 Saran: Berikan tantangan soal HOTS, proyek kolaboratif, atau tugas pengembangan lebih lanjut
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
