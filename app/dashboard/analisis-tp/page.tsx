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
  
  const [sourceType, setSourceType] = useState<SourceType>('template');
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState('');
  
  const [analysis, setAnalysis] = useState<TPAchievementAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  
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
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analisis Ketercapaian TP</h1>
        <p className="text-muted-foreground">
          Analisis pencapaian Tujuan Pembelajaran per siswa berdasarkan hasil ujian
        </p>
      </div>
      
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
    </div>
  );
}
