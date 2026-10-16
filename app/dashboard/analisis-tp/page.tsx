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
  
  // Master Filter Options
  const [classList, setClassList] = useState<Array<{ id: string; name: string }>>([]);
  const [subjectList, setSubjectList] = useState<string[]>([]);

  // Tab 1: Analisis Per Ujian
  const [sourceType, setSourceType] = useState<SourceType>('bank_soal');
  const [selectedClassTab1, setSelectedClassTab1] = useState('');
  const [selectedSubjectTab1, setSelectedSubjectTab1] = useState('');
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [analysis, setAnalysis] = useState<TPAchievementAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Tab 2: Rekap Siswa
  const [rekapSelectedClass, setRekapSelectedClass] = useState('');
  const [rekapStudents, setRekapStudents] = useState<Array<{ id: string; name: string; className: string }>>([]);
  const [rekapSelectedStudent, setRekapSelectedStudent] = useState('');
  const [rekapSelectedSubject, setRekapSelectedSubject] = useState('');
  const [rekapData, setRekapData] = useState<any>(null);
  const [rekapLoading, setRekapLoading] = useState(false);
  
  // Tab 3: Rekap Kelas
  const [rekapKelasSelectedClass, setRekapKelasSelectedClass] = useState('');
  const [rekapKelasSelectedSubject, setRekapKelasSelectedSubject] = useState('');
  const [rekapKelasData, setRekapKelasData] = useState<any>(null);
  const [rekapKelasLoading, setRekapKelasLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadMasterData();
      loadTemplates();
      loadQuestionBanks();
    }
  }, [user]);

  useEffect(() => {
    if (selectedSourceId) {
      loadGrades();
    }
  }, [selectedSourceId, sourceType, selectedClassTab1]);

  // Load Master Classes and Subjects
  const loadMasterData = async () => {
    if (!user) return;
    try {
      const classesQuery = query(collection(db, 'classes'), where('user_id', '==', user.uid));
      const classesSnap = await getDocs(classesQuery);
      const classesMap = new Map<string, string>();
      
      classesSnap.forEach(doc => {
        const data = doc.data();
        const name = data.name || data.nama;
        if (name) classesMap.set(doc.id, String(name));
      });

      const gradesQuery = query(collection(db, 'grades'), where('user_id', '==', user.uid));
      const gradesSnap = await getDocs(gradesQuery);
      const subjectsSet = new Set<string>();

      gradesSnap.forEach(doc => {
        const data = doc.data();
        if (data.class_id && data.class_name) {
          classesMap.set(data.class_id, data.class_name);
        }
        if (data.subject) {
          subjectsSet.add(data.subject);
        }
      });

      const sortedClasses = Array.from(classesMap.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }));

      setClassList(sortedClasses);
      setSubjectList(Array.from(subjectsSet).sort());
    } catch (error) {
      console.error('Error loading master data:', error);
    }
  };

  const loadTemplates = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'exam_templates'), where('user_id', '==', user.uid));
      const snapshot = await getDocs(q);
      const data: ExamTemplate[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as ExamTemplate);
      });
      setTemplates(data.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))));
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadQuestionBanks = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'question_banks'), where('user_id', '==', user.uid));
      const snapshot = await getDocs(q);
      const data: QuestionBank[] = [];
      snapshot.forEach(doc => {
        const qb = { id: doc.id, ...doc.data() } as QuestionBank;
        data.push(qb);
      });
      setQuestionBanks(data.sort((a, b) => {
        const dateA = String((a as any).created_at || (a as any).createdAt || '');
        const dateB = String((b as any).created_at || (b as any).createdAt || '');
        return dateB.localeCompare(dateA);
      }));
    } catch (error) {
      console.error('Error loading question banks:', error);
    }
  };

  // --- FUNGSI INTI UNTUK MENDETEKSI & MEMBONGKAR TEKS TP ---

  // 1. Validator: Menolak teks TP palsu/bawaan dari sistem
  const isValidTpText = (t: any): boolean => {
    if (!t) return false;
    const text = String(t).toLowerCase().trim();
    if (text.length < 5) return false;
    if (text.includes('tujuan pembelajaran soal') || text.includes('materi ujian soal') || text.includes('soal nomor')) return false;
    if (/^(tujuan pembelajaran|tp)\s*\d+$/.test(text)) return false; // Tolak jika cuma "Tujuan Pembelajaran 1"
    return true;
  };

  // 2. Cek apakah di dalam array mapping ada minimal 1 teks TP asli
  const hasValidTp = (list: any[]) => {
    if (!list || !Array.isArray(list) || list.length === 0) return false;
    return list.some(m => isValidTpText(m.tp_text || m.tpText || m.text || m.tp || m.deskripsi || ''));
  };

  // 3. Pembersih dan pembongkar teks TP dari objek soal AI
  const getCleanTpText = (q: any): string => {
    if (!q) return '';
    let text = '';
    
    if (typeof q === 'string') text = q;
    else {
      const keys = ['tp', 'tpText', 'tp_text', 'tujuanPembelajaran', 'tujuan_pembelajaran', 'learningObjective', 'learning_objective', 'indikator', 'indikatorSoal', 'materi', 'kompetensi', 'capaian', 'cp', 'kd', 'tujuan', 'deskripsi', 'iktp'];
      
      for (const k of keys) {
        if (q[k] && typeof q[k] === 'string' && q[k].trim().length > 3) { text = q[k]; break; }
        if (q[k] && typeof q[k] === 'object' && q[k].text && typeof q[k].text === 'string') { text = q[k].text; break; }
      }
      if (!text && q.metadata && typeof q.metadata === 'object') {
        for (const k of keys) {
          if (q.metadata[k] && typeof q.metadata[k] === 'string' && q.metadata[k].trim().length > 3) { text = q.metadata[k]; break; }
        }
      }
      // Mode paksa: cari string panjang apapun yang bukan opsi/soal
      if (!text && typeof q === 'object') {
        for (const key in q) {
          if (typeof q[key] === 'string' && q[key].length > 15 && !['type', 'id', 'question', 'pertanyaan', 'soal', 'pembahasan', 'jawaban', 'explanation', 'correctanswer', 'options', 'pilihan', 'jawabanbenar', 'kuncijawaban'].includes(key.toLowerCase())) {
            text = q[key]; break;
          }
        }
      }
    }
    
    return text ? text.replace(/^(TP\s*\d+[\:\-\.\s]*|\d+[\.\)\-\s]+|Bab\s\d+\s)/i, '').trim() : '';
  };

  // 4. Master Extraction Function
  const extractTpMappingFromGrade = (gradeData: any, currentSourceId?: string) => {
    let source: any = null;

    // A. Cari Referensi Sumber (Bank Soal / Template)
    const targetIds = [
      gradeData.question_bank_id, gradeData.questionBankId, gradeData.bank_soal_id,
      gradeData.exam_template_id, gradeData.examTemplateId, gradeData.template_id, currentSourceId
    ].filter(Boolean).map(String);

    for (const id of targetIds) {
      source = questionBanks.find(q => String(q.id) === id) || templates.find(t => String(t.id) === id);
      if (source) break;
    }
    
    // Pencarian cadangan menggunakan judul ujian
    if (!source) {
      const normalize = (s: string) => String(s || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const gradeTitle = normalize(gradeData.exam_title || gradeData.examTitle || gradeData.exam_name);
      if (gradeTitle) {
        source = questionBanks.find(q => normalize(q.examTitle || q.exam_title || q.title) === gradeTitle) ||
                 templates.find(t => normalize(t.exam_name || t.examName || t.title) === gradeTitle);
      }
    }

    // B. Coba ekstrak dari mapping nilai (Grade Data) - Abaikan jika isinya palsu
    const gradeMappings = gradeData.tp_mapping || gradeData.question_tp_mapping || gradeData.tp_details;
    if (hasValidTp(gradeMappings)) {
      return gradeMappings.map((m: any, idx: number) => ({
        question_number: m.question_number || m.questionNumber || idx + 1,
        tp_id: m.tp_id || m.tpId || `tp_${idx}`,
        tp_text: getCleanTpText(m.tp_text || m.tpText || m.text) || m.tp_text,
        question_type: m.question_type || m.questionType || 'PG'
      }));
    }

    // C. Bongkar Bank Soal jika ditemukan
    if (source) {
      // Cek top-level mapping di Bank Soal
      const sourceMappings = source.question_tp_mapping || source.tp_mapping || source.tp_details || source.tp_list;
      if (hasValidTp(sourceMappings)) {
        return sourceMappings.map((m: any, idx: number) => ({
          question_number: m.question_number || m.questionNumber || idx + 1,
          tp_id: m.tp_id || m.tpId || `tp_${idx}`,
          tp_text: getCleanTpText(m.tp_text || m.tpText || m.text) || m.tp_text,
          question_type: m.question_type || m.questionType || 'PG'
        }));
      }

      // Jika kosong, bongkar paksa ke dalam objek butir soal per soal (Paling sering terjadi di Kelas 2 Baru)
      const extractedQuestions: any[] = [];
      let mcList: any[] = [];
      let essayList: any[] = [];
      let sq = source.questions;
      
      if (typeof sq === 'string') { try { sq = JSON.parse(sq); } catch(e){} }

      if (Array.isArray(sq)) {
        mcList = sq.filter((q:any) => q.type !== 'essay' && q.type !== 'isian');
        essayList = sq.filter((q:any) => q.type === 'essay' || q.type === 'isian');
        if (mcList.length === 0 && essayList.length === 0) mcList = sq;
      } else if (sq && typeof sq === 'object') {
        mcList = sq.multipleChoice || sq.multiple_choice || sq.pilihanGanda || sq.pg || [];
        essayList = sq.essay || sq.isian || sq.uraian || [];
      } else {
        mcList = source.multipleChoice || source.multiple_choice || source.pilihanGanda || [];
        essayList = source.essay || source.isian || [];
      }

      mcList.forEach((q: any, idx: number) => {
        const t = getCleanTpText(q);
        extractedQuestions.push({
          question_number: idx + 1,
          tp_id: t ? `tp_pg_${idx}` : `tp_fallback_pg_${idx}`,
          tp_text: t || `Tujuan Pembelajaran Soal ${idx + 1}`,
          question_type: 'PG'
        });
      });

      const pgCount = mcList.length;
      essayList.forEach((q: any, idx: number) => {
        const t = getCleanTpText(q);
        extractedQuestions.push({
          question_number: pgCount + idx + 1,
          tp_id: t ? `tp_es_${idx}` : `tp_fallback_es_${idx}`,
          tp_text: t || `Tujuan Pembelajaran Soal ${pgCount + idx + 1}`,
          question_type: 'Essay'
        });
      });

      if (hasValidTp(extractedQuestions)) {
        // Jika ada minimal 1 TP asli, kembalikan data, berikan label untuk soal yg TP-nya bolong
        return extractedQuestions.map((q:any, idx:number) => ({
          ...q,
          tp_text: isValidTpText(q.tp_text) ? q.tp_text : `Materi Pokok Soal ${idx + 1}`
        }));
      }
    }

    // D. Darurat: Cek apakah soal tersimpan di GradeData
    if (gradeData.questions && Array.isArray(gradeData.questions)) {
      const extractedFromGradeQs = gradeData.questions.map((q:any, idx:number) => ({
        question_number: idx + 1,
        tp_id: `tp_gq_${idx}`,
        tp_text: getCleanTpText(q) || `Tujuan Pembelajaran Soal ${idx + 1}`,
        question_type: q.type === 'essay' ? 'Essay' : 'PG'
      }));
      if (hasValidTp(extractedFromGradeQs)) {
        return extractedFromGradeQs.map((q:any, idx:number) => ({
          ...q,
          tp_text: isValidTpText(q.tp_text) ? q.tp_text : `Materi Pokok Soal ${idx + 1}`
        }));
      }
    }

    // E. Fallback Mutlak jika memang tidak ada data TP sama sekali di manapun
    const sampleGrade = gradeData.grades?.[0];
    const mcCount = sampleGrade?.mcAnswers?.length || gradeData.mc_count || 0;
    const essayCount = sampleGrade?.essayScores?.length || gradeData.essay_count || 0;
    const fallbackList: any[] = [];
    
    for (let i = 1; i <= mcCount; i++) {
      fallbackList.push({ question_number: i, tp_id: `tp_fallback_${i}`, tp_text: `Tujuan Pembelajaran Soal ${i}`, question_type: 'PG' });
    }
    for (let j = 1; j <= essayCount; j++) {
      fallbackList.push({ question_number: mcCount + j, tp_id: `tp_fallback_${mcCount + j}`, tp_text: `Tujuan Pembelajaran Soal ${mcCount + j}`, question_type: 'Essay' });
    }
    
    return fallbackList.length > 0 ? fallbackList : [{ question_number: 1, tp_id: 'tp_1', tp_text: 'Tujuan Pembelajaran', question_type: 'PG' }];
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
        if (!selectedClassTab1 || gradeData.class_id === selectedClassTab1 || gradeData.class_name === selectedClassTab1) {
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
      alert('Pilih sumber dan data koreksi terlebih dahulu');
      return;
    }

    const gradeData = grades.find(g => g.id === selectedGradeId);
    if (!gradeData) return;

    const tpMappingList = extractTpMappingFromGrade(gradeData, selectedSourceId);

    setLoading(true);

    try {
      // Pengelompokan soal berdasarkan Teks TP yang sama
      const tpGroups: { [tpKey: string]: {
        tp_id: string;
        tp_text: string;
        questions: Array<{ question_number: number; question_type: 'PG' | 'Essay' }>;
      }} = {};

      tpMappingList.forEach((mapping: any) => {
        const rawText = mapping.tp_text || mapping.tpText || `Soal Nomor ${mapping.question_number}`;
        const tpText = rawText.trim();
        const tpKey = tpText.toLowerCase();
        const qNum = mapping.question_number || mapping.questionNumber;
        const qType = mapping.question_type || mapping.questionType || 'PG';

        if (!tpGroups[tpKey]) {
          tpGroups[tpKey] = {
            tp_id: mapping.tp_id || tpKey,
            tp_text: tpText,
            questions: []
          };
        }
        tpGroups[tpKey].questions.push({
          question_number: Number(qNum),
          question_type: qType === 'Essay' || qType === 'Isian' ? 'Essay' : 'PG'
        });
      });

      let pgWeight = 1;
      let essayWeight = 1;
      let pgCount = 0;
      let maxScore = 100;
      let examName = gradeData.exam_title;

      if (sourceType === 'template') {
        const template = templates.find(t => t.id === selectedSourceId);
        if (template) {
          pgWeight = template.multiple_choice?.weight || 1;
          essayWeight = template.essay?.weight || 1;
          pgCount = template.multiple_choice?.count || 0;
          maxScore = template.max_score || 100;
          examName = template.exam_name;
        }
      } else {
        const qb = questionBanks.find(q => q.id === selectedSourceId);
        if (qb) {
          pgWeight = qb.questions?.multipleChoice?.[0]?.weight || 1;
          essayWeight = qb.questions?.essay?.[0]?.weight || 1;
          pgCount = qb.questions?.multipleChoice?.length || 0;
          examName = qb.examTitle;
        }
      }

      const results: TPAchievementAnalysis[] = [];

      gradeData.grades?.forEach((studentGrade) => {
        const tpAnalysis = Object.values(tpGroups).map((tpGroup) => {
          const questions: any[] = [];
          let totalScore = 0;
          let maxPossibleScore = 0;

          tpGroup.questions.forEach(({ question_number, question_type }) => {
            if (question_type === 'PG') {
              const answerIndex = question_number - 1;
              const studentAnswer = studentGrade.mcAnswers?.[answerIndex];

              let correctAnswer = '';
              let weight = pgWeight;

              if (sourceType === 'template') {
                const template = templates.find(t => t.id === selectedSourceId);
                if (template) {
                  correctAnswer = template.multiple_choice?.answer_keys?.[answerIndex] || '';
                  weight = template.multiple_choice?.weight || pgWeight;
                }
              } else {
                const qb = questionBanks.find(q => q.id === selectedSourceId);
                if (qb) {
                  correctAnswer = qb.questions?.multipleChoice?.[answerIndex]?.correctAnswer || '';
                  weight = qb.questions?.multipleChoice?.[answerIndex]?.weight || pgWeight;
                }
              }

              const isCorrect = studentAnswer && correctAnswer && String(studentAnswer).toUpperCase() === String(correctAnswer).toUpperCase();
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
              const essayIndex = question_number - pgCount - 1;
              const score = studentGrade.essayScores?.[essayIndex] || 0;
              let weight = essayWeight;

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

          let achievementLevel: 'Belum Berkembang' | 'Mulai Berkembang' | 'Berkembang Sesuai Harapan' | 'Sangat Berkembang';
          if (percentage < 50) achievementLevel = 'Belum Berkembang';
          else if (percentage < 70) achievementLevel = 'Mulai Berkembang';
          else if (percentage < 85) achievementLevel = 'Berkembang Sesuai Harapan';
          else achievementLevel = 'Sangat Berkembang';

          return {
            tp_id: tpGroup.tp_id,
            tp_text: tpGroup.tp_text,
            chapter: 'Tujuan Pembelajaran',
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
      case 'Sangat Berkembang': return 'bg-green-100 text-green-800 border-green-300';
      case 'Berkembang Sesuai Harapan': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Mulai Berkembang': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Belum Berkembang': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (selectedSubjectTab1 && t.subject !== selectedSubjectTab1) return false;
    return true;
  });

  const filteredQuestionBanks = questionBanks.filter(qb => {
    if (selectedSubjectTab1 && qb.subject !== selectedSubjectTab1) return false;
    return true;
  });

  // Load Rekap Data per Siswa (Tab 2)
  const loadRekapData = async () => {
    if (!user) return;
    try {
      const gradesQuery = query(collection(db, 'grades'), where('user_id', '==', user.uid));
      const gradesSnapshot = await getDocs(gradesQuery);

      const studentsMap = new Map<string, { id: string; name: string; className: string }>();

      gradesSnapshot.forEach(doc => {
        const grade = doc.data() as Grade;
        if (!rekapSelectedClass || grade.class_id === rekapSelectedClass || grade.class_name === rekapSelectedClass) {
          grade.grades?.forEach(g => {
            studentsMap.set(g.studentId, {
              id: g.studentId,
              name: g.studentName,
              className: grade.class_name
            });
          });
        }
      });

      setRekapStudents(Array.from(studentsMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading rekap students:', error);
    }
  };

  useEffect(() => {
    if (user && activeTab === 'rekap') {
      loadRekapData();
    }
  }, [user, activeTab, rekapSelectedClass]);

  const loadStudentRekapBySubject = async () => {
    if (!user || !rekapSelectedStudent || !rekapSelectedSubject) return;
    setRekapLoading(true);

    try {
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
        const studentData = grade.grades?.find(g => g.studentId === rekapSelectedStudent);
        if (!studentData) return;

        totalExams++;

        let answerKeys: string[] = [];
        if (grade.exam_template_id) {
          const template = templates.find(t => t.id === grade.exam_template_id);
          if (template) answerKeys = template.multiple_choice?.answer_keys || [];
        } else if (grade.question_bank_id) {
          const qb = questionBanks.find(q => q.id === grade.question_bank_id);
          if (qb) answerKeys = qb.questions?.multipleChoice?.map(q => q.correctAnswer) || [];
        }

        const tpMappingList = extractTpMappingFromGrade(grade, grade.question_bank_id || grade.exam_template_id);

        const tpGroups: any = {};
        tpMappingList.forEach((mapping: any) => {
          const tpText = mapping.tp_text || mapping.tpText || `Soal Nomor ${mapping.question_number}`;
          const tpKey = tpText.trim().toLowerCase();
          if (!tpGroups[tpKey]) {
            tpGroups[tpKey] = { tp_text: tpText.trim(), questions: [] };
          }
          tpGroups[tpKey].questions.push({
            number: mapping.question_number || mapping.questionNumber,
            type: mapping.question_type || mapping.questionType || 'PG'
          });
        });

        Object.entries(tpGroups).forEach(([tpKey, tpData]: [string, any]) => {
          let totalScore = 0;
          let maxScore = 0;

          tpData.questions.forEach((q: any) => {
            if (q.type === 'PG') {
              const answerIndex = q.number - 1;
              if (studentData.mcAnswers?.[answerIndex] && answerKeys[answerIndex] && 
                  String(studentData.mcAnswers[answerIndex]).toUpperCase() === String(answerKeys[answerIndex]).toUpperCase()) {
                totalScore += 1;
              }
              maxScore += 1;
            } else {
              const essayScore = studentData.essayScores?.[q.number - 1] || 0;
              totalScore += essayScore;
              maxScore += 10;
            }
          });

          const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

          if (!tpAchievements[tpKey]) {
            tpAchievements[tpKey] = {
              tp_id: tpKey,
              tp_text: tpData.tp_text,
              achievements: [],
              average: 0
            };
          }

          tpAchievements[tpKey].achievements.push({
            exam_name: grade.exam_title,
            percentage: Math.round(percentage)
          });
        });
      });

      Object.values(tpAchievements).forEach((tp: any) => {
        const sum = tp.achievements.reduce((acc: number, a: any) => acc + a.percentage, 0);
        tp.average = Math.round(sum / (tp.achievements.length || 1));
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

  // Load Rekap Kelas Data (Tab 3)
  const loadClassRekapBySubject = async () => {
    if (!user || !rekapKelasSelectedClass || !rekapKelasSelectedSubject) return;
    setRekapKelasLoading(true);

    try {
      const gradesQuery = query(
        collection(db, 'grades'),
        where('user_id', '==', user.uid),
        where('subject', '==', rekapKelasSelectedSubject)
      );
      const gradesSnapshot = await getDocs(gradesQuery);

      const tpAchievements: any = {};
      let totalExams = 0;
      let totalStudents = new Set<string>();

      gradesSnapshot.forEach(doc => {
        const grade = doc.data() as Grade;
        if (grade.class_id !== rekapKelasSelectedClass && grade.class_name !== rekapKelasSelectedClass) return;

        totalExams++;

        let answerKeys: string[] = [];
        if (grade.exam_template_id) {
          const template = templates.find(t => t.id === grade.exam_template_id);
          if (template) answerKeys = template.multiple_choice?.answer_keys || [];
        } else if (grade.question_bank_id) {
          const qb = questionBanks.find(q => q.id === grade.question_bank_id);
          if (qb) answerKeys = qb.questions?.multipleChoice?.map(q => q.correctAnswer) || [];
        }

        const tpMappingList = extractTpMappingFromGrade(grade, grade.question_bank_id || grade.exam_template_id);

        grade.grades?.forEach(studentData => {
          totalStudents.add(studentData.studentId);

          const tpGroups: any = {};
          tpMappingList.forEach((mapping: any) => {
            const tpText = mapping.tp_text || mapping.tpText || `Soal Nomor ${mapping.question_number}`;
            const tpKey = tpText.trim().toLowerCase();
            if (!tpGroups[tpKey]) {
              tpGroups[tpKey] = { tp_text: tpText.trim(), questions: [] };
            }
            tpGroups[tpKey].questions.push({
              number: mapping.question_number || mapping.questionNumber,
              type: mapping.question_type || mapping.questionType || 'PG'
            });
          });

          Object.entries(tpGroups).forEach(([tpKey, tpData]: [string, any]) => {
            let totalScore = 0;
            let maxScore = 0;

            tpData.questions.forEach((q: any) => {
              if (q.type === 'PG') {
                const answerIndex = q.number - 1;
                if (studentData.mcAnswers?.[answerIndex] && answerKeys[answerIndex] &&
                    String(studentData.mcAnswers[answerIndex]).toUpperCase() === String(answerKeys[answerIndex]).toUpperCase()) {
                  totalScore += 1;
                }
                maxScore += 1;
              } else {
                const essayScore = studentData.essayScores?.[q.number - 1] || 0;
                totalScore += essayScore;
                maxScore += 10;
              }
            });

            const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

            if (!tpAchievements[tpKey]) {
              tpAchievements[tpKey] = {
                tp_id: tpKey,
                tp_text: tpData.tp_text,
                achievements: []
              };
            }
            tpAchievements[tpKey].achievements.push(percentage);
          });
        });
      });

      Object.values(tpAchievements).forEach((tp: any) => {
        const sum = tp.achievements.reduce((acc: number, val: number) => acc + val, 0);
        tp.average = Math.round(sum / (tp.achievements.length || 1));
        tp.distribution = {
          sangatBerkembang: tp.achievements.filter((p: number) => p >= 85).length,
          berkembangSesuai: tp.achievements.filter((p: number) => p >= 70 && p < 85).length,
          mulaiBerkembang: tp.achievements.filter((p: number) => p >= 50 && p < 70).length,
          belumBerkembang: tp.achievements.filter((p: number) => p < 50).length
        };
      });

      const selectedClassName = classList.find(c => c.id === rekapKelasSelectedClass || c.name === rekapKelasSelectedClass)?.name || rekapKelasSelectedClass;

      setRekapKelasData({
        className: selectedClassName,
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

      {/* Tab 1: Analisis Per Ujian */}
      {activeTab === 'analisis' && (
        <div className="space-y-4">
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
          </Card>

          {/* Filters Tab 1 */}
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Mata Pelajaran</label>
                <select
                  className="w-full p-2 border rounded"
                  value={selectedSubjectTab1}
                  onChange={(e) => {
                    setSelectedSubjectTab1(e.target.value);
                    setSelectedSourceId('');
                    setSelectedGradeId('');
                    setAnalysis([]);
                  }}
                >
                  <option value="">Semua Mapel...</option>
                  {subjectList.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Kelas</label>
                <select
                  className="w-full p-2 border rounded"
                  value={selectedClassTab1}
                  onChange={(e) => {
                    setSelectedClassTab1(e.target.value);
                    setSelectedGradeId('');
                    setAnalysis([]);
                  }}
                >
                  <option value="">Semua Kelas...</option>
                  {classList.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {sourceType === 'template' ? 'Template Ujian' : 'Bank Soal'}
                </label>
                <select
                  className="w-full p-2 border rounded"
                  value={selectedSourceId}
                  onChange={(e) => {
                    setSelectedSourceId(e.target.value);
                    setSelectedGradeId('');
                    setAnalysis([]);
                  }}
                >
                  <option value="">Pilih...</option>
                  {sourceType === 'template' ? (
                    filteredTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.exam_name} ({t.subject || 'Umum'})
                      </option>
                    ))
                  ) : (
                    filteredQuestionBanks.map((qb) => (
                      <option key={qb.id} value={qb.id}>
                        {qb.examTitle} ({qb.subject || 'Umum'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Pilih Data Koreksi</label>
                <select
                  className="w-full p-2 border rounded"
                  value={selectedGradeId}
                  onChange={(e) => {
                    setSelectedGradeId(e.target.value);
                    setAnalysis([]);
                  }}
                  disabled={!selectedSourceId}
                >
                  <option value="">Pilih Data Koreksi...</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.class_name} - {g.exam_title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                onClick={calculateTPAchievement}
                disabled={!selectedSourceId || !selectedGradeId || loading}
                className="w-full md:w-auto px-8"
              >
                {loading ? 'Menghitung...' : '🔍 Analisis TP'}
              </Button>
            </div>
          </Card>

          {/* Results */}
          {analysis.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Hasil Analisis ({analysis.length} Siswa)</h2>
              {analysis.map((student) => (
                <Card key={student.id} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{student.student_name}</h3>
                      <p className="text-sm text-muted-foreground">{student.class_name} - {student.exam_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{student.overall_score}</p>
                      <p className="text-sm text-muted-foreground">{student.overall_percentage}%</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {student.tp_analysis.map((tp) => (
                      <div key={tp.tp_id} className="border rounded-lg p-4 bg-slate-50 space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tujuan Pembelajaran</p>
                            <p className="text-sm font-medium text-gray-800 mt-1">{tp.tp_text}</p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-bold text-base">{tp.total_score}/{tp.max_possible_score}</p>
                            <p className="text-xs text-muted-foreground">{tp.percentage}%</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getAchievementColor(tp.achievement_level)}`}>
                            {tp.achievement_level}
                          </span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                tp.percentage >= 85 ? 'bg-green-500' :
                                tp.percentage >= 70 ? 'bg-blue-500' :
                                tp.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${tp.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Rekap Ketercapaian TP (Per Siswa) */}
      {activeTab === 'rekap' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Rekap Ketercapaian TP Per Siswa</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Filter Kelas</label>
              <select
                className="w-full p-2 border rounded"
                value={rekapSelectedClass}
                onChange={(e) => {
                  setRekapSelectedClass(e.target.value);
                  setRekapSelectedStudent('');
                  setRekapData(null);
                }}
              >
                <option value="">Semua Kelas...</option>
                {classList.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Pilih Siswa</label>
              <select
                className="w-full p-2 border rounded"
                value={rekapSelectedStudent}
                onChange={(e) => {
                  setRekapSelectedStudent(e.target.value);
                  setRekapData(null);
                }}
              >
                <option value="">Pilih Siswa...</option>
                {rekapStudents.map((student) => (
                  <option key={student.id} value={student.id}>{student.name} ({student.className})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Pilih Mata Pelajaran</label>
              <select
                className="w-full p-2 border rounded"
                value={rekapSelectedSubject}
                onChange={(e) => {
                  setRekapSelectedSubject(e.target.value);
                  setRekapData(null);
                }}
              >
                <option value="">Pilih Mapel...</option>
                {subjectList.map((subject) => (
                  <option key={subject} value={subject}>{subject}</option>
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

          {rekapData && (
            <div className="mt-6 space-y-4">
              <div className="border-b pb-3">
                <h3 className="text-2xl font-bold">{rekapData.student?.name}</h3>
                <p className="text-muted-foreground">
                  Mata Pelajaran: <strong>{rekapData.subject}</strong> • Total Ujian: <strong>{rekapData.totalExams}</strong>
                </p>
              </div>

              {rekapData.tpAchievements && rekapData.tpAchievements.length > 0 ? (
                rekapData.tpAchievements.map((tp: any, index: number) => (
                  <div key={tp.tp_id || index} className="border rounded-lg p-5 bg-slate-50 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-lg text-gray-800">Tujuan Pembelajaran</p>
                        <p className="text-sm text-gray-600 mt-1">{tp.tp_text}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-primary">{tp.average}%</span>
                        <p className="text-xs text-gray-500">Rata-rata Pencapaian</p>
                      </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          tp.average >= 85 ? 'bg-green-500' :
                          tp.average >= 70 ? 'bg-blue-500' :
                          tp.average >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${tp.average}%` }}
                      />
                    </div>

                    {tp.achievements && tp.achievements.length > 0 && (
                      <div className="pt-2 border-t text-xs space-y-1">
                        <p className="font-medium text-gray-700">Detail Per Ujian:</p>
                        <div className="flex flex-wrap gap-2">
                          {tp.achievements.map((ach: any, idx: number) => (
                            <span key={idx} className="bg-white px-3 py-1 rounded border shadow-sm">
                              {ach.exam_name}: <strong>{ach.percentage}%</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500 border rounded">
                  Belum ada data nilai tersimpan untuk siswa dan mata pelajaran ini.
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Rekap Kelas */}
      {activeTab === 'rekap-kelas' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Rekap Ketercapaian TP Per Kelas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Pilih Kelas</label>
              <select
                value={rekapKelasSelectedClass}
                onChange={(e) => setRekapKelasSelectedClass(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">-- Pilih Kelas --</option>
                {classList.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Pilih Mata Pelajaran</label>
              <select
                value={rekapKelasSelectedSubject}
                onChange={(e) => setRekapKelasSelectedSubject(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">-- Pilih Mapel --</option>
                {subjectList.map((subject) => (
                  <option key={subject} value={subject}>{subject}</option>
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

          {rekapKelasData && (
            <div className="mt-6 space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-xl text-blue-900">📊 Kelas {rekapKelasData.className}</h4>
                  <p className="text-sm text-blue-700">Mata Pelajaran: {rekapKelasData.subject}</p>
                </div>
                <div className="text-right text-sm text-blue-800">
                  <p>Total Siswa: <strong>{rekapKelasData.totalStudents}</strong></p>
                  <p>Total Ujian: <strong>{rekapKelasData.totalExams}</strong></p>
                </div>
              </div>

              {rekapKelasData.tpAchievements && rekapKelasData.tpAchievements.length > 0 ? (
                rekapKelasData.tpAchievements.map((tp: any, idx: number) => (
                  <div key={idx} className="border rounded-lg p-5 bg-slate-50 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-800">Tujuan Pembelajaran</p>
                        <p className="text-sm text-gray-600 mt-1">{tp.tp_text}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-blue-700">{tp.average}%</span>
                        <p className="text-xs text-gray-500">Rata-rata Kelas</p>
                      </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          tp.average >= 85 ? 'bg-green-500' :
                          tp.average >= 70 ? 'bg-blue-500' :
                          tp.average >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${tp.average}%` }}
                      />
                    </div>

                    {tp.distribution && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 text-xs">
                        <div className="bg-white p-2 border rounded text-center">
                          <span className="text-gray-500">Sangat Berkembang</span>
                          <p className="font-bold text-green-600">{tp.distribution.sangatBerkembang} siswa</p>
                        </div>
                        <div className="bg-white p-2 border rounded text-center">
                          <span className="text-gray-500">Berkembang Sesuai</span>
                          <p className="font-bold text-blue-600">{tp.distribution.berkembangSesuai} siswa</p>
                        </div>
                        <div className="bg-white p-2 border rounded text-center">
                          <span className="text-gray-500">Mulai Berkembang</span>
                          <p className="font-bold text-yellow-600">{tp.distribution.mulaiBerkembang} siswa</p>
                        </div>
                        <div className="bg-white p-2 border rounded text-center">
                          <span className="text-gray-500">Belum Berkembang</span>
                          <p className="font-bold text-red-600">{tp.distribution.belumBerkembang} siswa</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500 border rounded">
                  Belum ada data nilai tersimpan untuk kelas dan mata pelajaran ini.
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}