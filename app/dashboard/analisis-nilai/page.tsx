"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, XCircle, TrendingUp } from "lucide-react";

interface ExamResult {
  id: string;
  studentId: string;
  studentName: string;
  examTitle: string;
  subject: string;
  totalScore: number;
  maxScore: number;
  tpBreakdown: TPScore[];
  createdAt: Date;
}

interface TPScore {
  tpId: string;
  tpText: string;
  correctAnswers: number;
  totalQuestions: number;
  score: number;
  percentage: number;
  status: "dikuasai" | "cukup" | "belum-dikuasai";
}

interface ClassTPAnalysis {
  tpId: string;
  tpText: string;
  totalStudents: number;
  studentsWhoPassed: number;
  percentage: number;
  status: "sangat-baik" | "baik" | "cukup" | "perlu-perbaikan";
  averageScore: number;
}

export default function AnalisisNilaiPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Data
  const [subjects, setSubjects] = useState<string[]>([]);
  const [exams, setExams] = useState<Map<string, string[]>>(new Map());
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [classAnalysis, setClassAnalysis] = useState<ClassTPAnalysis[]>([]);
  
  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<number|''>('');
  const [selectedClass, setSelectedClass] = useState<string>("");
  
  // Stats
  const [className, setClassName] = useState<string>("");
  const [totalStudents, setTotalStudents] = useState<number>(0);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedSubject && selectedExam && selectedSemester && selectedClass) {
      analyzeClassTP();
    } else {
      setClassAnalysis([]);
    }
  }, [selectedSubject, selectedExam, selectedSemester, selectedClass]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (!user) return;

      const uniqueClasses = new Set<string>();

      // 1. Ambil daftar kelas resmi dari collection 'classes'
      const classesQuery = query(
        collection(db, "classes"),
        where("user_id", "==", user.uid)
      );
      const classesSnapshot = await getDocs(classesQuery);
      classesSnapshot.forEach((doc) => {
        const data = doc.data();
        const classNameStr = data.name || data.nama;
        if (classNameStr) uniqueClasses.add(String(classNameStr));
      });

      // 2. Ambil data nilai, mata pelajaran, dan ulangan dari collection 'grades'
      const gradesQuery = query(
        collection(db, "grades"),
        where("user_id", "==", user.uid)
      );
      const gradesSnapshot = await getDocs(gradesQuery);
      
      const uniqueSubjects = new Set<string>();
      const examsBySubject = new Map<string, Set<string>>();

      gradesSnapshot.forEach((doc) => {
        const data = doc.data();
        const subject = data.subject || "Unknown";
        const examTitle = data.exam_title || data.exam_name || "Unknown";
        const classNameStr = data.class_name;
        
        uniqueSubjects.add(subject);
        if (classNameStr) uniqueClasses.add(classNameStr);
        
        if (!examsBySubject.has(subject)) {
          examsBySubject.set(subject, new Set());
        }
        examsBySubject.get(subject)!.add(examTitle);
      });

      const subjectsArray = Array.from(uniqueSubjects).sort();
      const classesArray = Array.from(uniqueClasses).sort((a, b) =>
        a.localeCompare(b, 'id', { numeric: true })
      );
      const examsMap = new Map<string, string[]>();
      
      examsBySubject.forEach((exams, subject) => {
        examsMap.set(subject, Array.from(exams).sort());
      });

      setSubjects(subjectsArray);
      setAvailableClasses(classesArray);
      setExams(examsMap);

    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Gagal memuat data analisis");
    } finally {
      setLoading(false);
    }
  };

  const analyzeClassTP = async () => {
    if (!user || !selectedSubject || !selectedExam || !selectedSemester || !selectedClass) return;
    try {
      setLoading(true);
      
      const gradesQuery = query(
        collection(db, "grades"),
        where("user_id", "==", user.uid),
        where("subject", "==", selectedSubject),
        where("exam_title", "==", selectedExam),
        where("semester", "==", selectedSemester),
        where("class_name", "==", selectedClass)
      );

      const gradesSnapshot = await getDocs(gradesQuery);
      
      if (gradesSnapshot.empty) {
        setClassAnalysis([]);
        setTotalStudents(0);
        return;
      }

      const firstDoc = gradesSnapshot.docs[0];
      const firstData = firstDoc.data();
      const tpMapping = firstData.tp_mapping || [];
      setClassName(firstData.class_name || "Kelas");

      if (tpMapping.length === 0) {
        alert("Data pemetaan TP tidak tersedia untuk ujian ini");
        setClassAnalysis([]);
        return;
      }

      const allStudentResults: Map<string, ExamResult> = new Map();

      for (const docSnapshot of gradesSnapshot.docs) {
        const data = docSnapshot.data();
        const gradesList = data.grades || [];

        let correctAnswers: string[] = [];
        if (data.question_bank_id) {
          const qbDoc = await getDoc(doc(db, "question_banks", data.question_bank_id));
          if (qbDoc.exists()) {
            const qbData = qbDoc.data();
            if (qbData.questions?.multipleChoice) {
              correctAnswers = qbData.questions.multipleChoice.map((q: any) => q.correctAnswer);
            }
          }
        } else if (data.exam_template_id) {
          const templateDoc = await getDoc(doc(db, "exam_templates", data.exam_template_id));
          if (templateDoc.exists()) {
            const templateData = templateDoc.data();
            if (templateData.multiple_choice?.answer_keys) {
              correctAnswers = templateData.multiple_choice.answer_keys;
            } else if (templateData.multiple_choice?.answer_key) {
              correctAnswers = templateData.multiple_choice.answer_key;
            }
          }
        }

        gradesList.forEach((studentGrade: any) => {
          const studentId = studentGrade.studentId;
          
          const tpGroups = new Map<string, {
            tpText: string;
            correctCount: number;
            totalCount: number;
          }>();

          tpMapping.forEach((mapping: any) => {
            const questionNum = mapping.question_number;
            const tpId = mapping.tp_id;
            const tpText = mapping.tp_text;
            const questionType = mapping.question_type;

            if (!tpGroups.has(tpId)) {
              tpGroups.set(tpId, {
                tpText: tpText,
                correctCount: 0,
                totalCount: 0,
              });
            }

            const tpGroup = tpGroups.get(tpId)!;
            tpGroup.totalCount++;

            let isCorrect = false;
            if (questionType === 'PG' && studentGrade.mcAnswers) {
              const answerIndex = questionNum - 1;
              const studentAnswer = studentGrade.mcAnswers[answerIndex];
              const correctAnswer = correctAnswers[answerIndex];
              isCorrect = studentAnswer && correctAnswer && studentAnswer.toUpperCase() === correctAnswer.toUpperCase();
            } else if (questionType === 'Essay' && studentGrade.essayScores) {
              const mcCount = correctAnswers.length;
              const essayIndex = questionNum - mcCount - 1;
              const score = studentGrade.essayScores[essayIndex] || 0;
              isCorrect = score >= 5;
            }

            if (isCorrect) {
              tpGroup.correctCount++;
            }
          });

          const tpBreakdown: TPScore[] = Array.from(tpGroups.entries()).map(([tpId, tpData]) => {
            const percentage = tpData.totalCount > 0 
              ? (tpData.correctCount / tpData.totalCount) * 100 
              : 0;
            const score = Math.round(percentage);
            
            let status: TPScore["status"];
            if (percentage >= 75) status = "dikuasai";
            else if (percentage >= 60) status = "cukup";
            else status = "belum-dikuasai";

            return {
              tpId,
              tpText: tpData.tpText,
              correctAnswers: tpData.correctCount,
              totalQuestions: tpData.totalCount,
              score,
              percentage: Math.round(percentage),
              status,
            };
          });

          allStudentResults.set(studentId, {
            id: studentId,
            studentId,
            studentName: studentGrade.studentName,
            examTitle: selectedExam,
            subject: selectedSubject,
            totalScore: studentGrade.finalGrade || studentGrade.totalScore || 0,
            maxScore: 100,
            tpBreakdown,
            createdAt: new Date(),
          });
        });
      }

      const tpAnalysisMap = new Map<string, {
        tpText: string;
        totalStudents: number;
        studentsWhoPassed: number;
        totalScoreSum: number;
      }>();

      allStudentResults.forEach((studentResult) => {
        studentResult.tpBreakdown.forEach((tpScore) => {
          if (!tpAnalysisMap.has(tpScore.tpId)) {
            tpAnalysisMap.set(tpScore.tpId, {
              tpText: tpScore.tpText,
              totalStudents: 0,
              studentsWhoPassed: 0,
              totalScoreSum: 0,
            });
          }

          const analysis = tpAnalysisMap.get(tpScore.tpId)!;
          analysis.totalStudents++;
          analysis.totalScoreSum += tpScore.percentage;
          
          if (tpScore.percentage >= 75) {
            analysis.studentsWhoPassed++;
          }
        });
      });

      const classAnalysisArray: ClassTPAnalysis[] = Array.from(tpAnalysisMap.entries()).map(([tpId, data]) => {
        const percentage = data.totalStudents > 0 
          ? (data.studentsWhoPassed / data.totalStudents) * 100 
          : 0;
        const averageScore = data.totalStudents > 0
          ? data.totalScoreSum / data.totalStudents
          : 0;

        let status: ClassTPAnalysis["status"];
        if (percentage >= 80) status = "sangat-baik";
        else if (percentage >= 65) status = "baik";
        else if (percentage >= 50) status = "cukup";
        else status = "perlu-perbaikan";

        return {
          tpId,
          tpText: data.tpText,
          totalStudents: data.totalStudents,
          studentsWhoPassed: data.studentsWhoPassed,
          percentage: Math.round(percentage),
          averageScore: Math.round(averageScore),
          status,
        };
      });

      setClassAnalysis(classAnalysisArray);
      setTotalStudents(allStudentResults.size);

    } catch (error) {
      console.error("Error analyzing class TP:", error);
      alert("Gagal menganalisis data kelas");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ClassTPAnalysis["status"]) => {
    switch (status) {
      case "sangat-baik":
        return (
          <Badge className="bg-green-600 hover:bg-green-700 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Sangat Baik (≥80%)
          </Badge>
        );
      case "baik":
        return (
          <Badge className="bg-green-500 hover:bg-green-600 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Baik (≥65%)
          </Badge>
        );
      case "cukup":
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 gap-1">
            <AlertCircle className="w-3 h-3" />
            Cukup (≥50%)
          </Badge>
        );
      case "perlu-perbaikan":
        return (
          <Badge className="bg-red-500 hover:bg-red-600 gap-1">
            <XCircle className="w-3 h-3" />
            Perlu Perbaikan
          </Badge>
        );
    }
  };

  if (loading && subjects.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analisis Penguasaan TP per Kelas</h1>
        <p className="text-muted-foreground">
          Pantau persentase penguasaan Tujuan Pembelajaran (TP) di tingkat kelas untuk setiap ujian
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Data</CardTitle>
          <CardDescription>
            Pilih mata pelajaran, semester, kelas, dan ujian untuk melihat analisis penguasaan TP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mata Pelajaran</label>
              <select 
                value={selectedSubject} 
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedExam("");
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pilih mata pelajaran...</option>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Semester</label>
              <select
                value={selectedSemester}
                onChange={e => setSelectedSemester(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pilih semester...</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Kelas</label>
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pilih kelas...</option>
                {availableClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Ulangan</label>
              <select 
                value={selectedExam} 
                onChange={(e) => setSelectedExam(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!selectedSubject}
              >
                <option value="">Pilih ulangan...</option>
                {selectedSubject && exams.get(selectedSubject)?.map(exam => (
                  <option key={exam} value={exam}>{exam}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedSubject || !selectedExam || !selectedSemester || !selectedClass ? (
        <Alert>
          <AlertDescription>
            Silakan lengkapi semua filter (Mata Pelajaran, Semester, Kelas, dan Nama Ulangan) untuk melihat hasil analisis.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Class TP Analysis Results */}
      {selectedSubject && selectedExam && selectedSemester && selectedClass && classAnalysis.length > 0 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Ringkasan Kelas</span>
                <Badge variant="outline" className="text-lg px-4 py-2">
                  {totalStudents} Siswa
                </Badge>
              </CardTitle>
              <CardDescription>
                Kelas {className} • {selectedSubject} • {selectedExam}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Siswa</p>
                  <p className="text-3xl font-bold text-blue-600">{totalStudents}</p>
                </div>
                <div className="space-y-1 text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total TP</p>
                  <p className="text-3xl font-bold text-green-600">{classAnalysis.length}</p>
                </div>
                <div className="space-y-1 text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Rata-rata Penguasaan</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {Math.round(classAnalysis.reduce((acc, tp) => acc + tp.percentage, 0) / classAnalysis.length)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analisis Penguasaan per Tujuan Pembelajaran (TP)</CardTitle>
              <CardDescription>
                Persentase siswa yang menguasai (≥75%) setiap TP di kelas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {classAnalysis.map((tp, index) => (
                  <div key={tp.tpId} className="space-y-3 p-5 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="text-sm px-3 py-1">
                            TP {index + 1}
                          </Badge>
                          {getStatusBadge(tp.status)}
                        </div>
                        <p className="text-sm leading-relaxed text-gray-700">{tp.tpText}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-lg p-4">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Siswa Menguasai</p>
                        <p className="text-xl font-bold text-green-600">
                          {tp.studentsWhoPassed}/{tp.totalStudents}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Persentase</p>
                        <p className="text-xl font-bold text-blue-600">
                          {tp.percentage}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Rata-rata Nilai</p>
                        <p className="text-xl font-bold text-purple-600">
                          {tp.averageScore}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-gray-700">Tingkat Penguasaan Kelas</span>
                        <span className="font-bold text-lg">{tp.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-6 shadow-inner">
                        <div 
                          className={`h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-3 ${
                            tp.percentage >= 80 ? "bg-green-600" : 
                            tp.percentage >= 65 ? "bg-green-500" : 
                            tp.percentage >= 50 ? "bg-yellow-500" : "bg-red-500"
                          }`}
                          style={{ width: `${tp.percentage}%` }}
                        >
                          {tp.percentage > 10 && (
                            <span className="text-white text-xs font-bold">{tp.percentage}%</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {tp.status === "perlu-perbaikan" && (
                      <Alert className="bg-red-50 border-red-200">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-sm text-red-800">
                          <strong>Perlu Perhatian Khusus:</strong> Hanya {tp.percentage}% siswa yang menguasai TP ini.
                          Disarankan untuk mengulang materi dan remedial.
                        </AlertDescription>
                      </Alert>
                    )}
                    {tp.status === "cukup" && (
                      <Alert className="bg-yellow-50 border-yellow-200">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-sm text-yellow-800">
                          <strong>Perlu Peningkatan:</strong> {tp.percentage}% siswa menguasai TP ini.
                          Berikan latihan soal tambahan untuk meningkatkan pemahaman.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Rekomendasi untuk Kelas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {classAnalysis.filter(tp => tp.status === "perlu-perbaikan").length > 0 && (
                  <Alert className="bg-red-50 border-red-200">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <strong>Perlu Perhatian Khusus:</strong> Ada{" "}
                      <span className="font-bold">{classAnalysis.filter(tp => tp.status === "perlu-perbaikan").length} TP</span>{" "}
                      yang dikuasai oleh &lt;50% siswa. Perlu pengulangan materi dan remedial kelas.
                    </AlertDescription>
                  </Alert>
                )}
                
                {classAnalysis.filter(tp => tp.status === "cukup").length > 0 && (
                  <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      <strong>Perlu Peningkatan:</strong> Ada{" "}
                      <span className="font-bold">{classAnalysis.filter(tp => tp.status === "cukup").length} TP</span>{" "}
                      yang dikuasai oleh 50-64% siswa. Berikan latihan soal tambahan.
                    </AlertDescription>
                  </Alert>
                )}

                {classAnalysis.filter(tp => tp.percentage >= 65).length === classAnalysis.length && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Sangat Baik!</strong> Minimal 65% siswa menguasai semua TP. 
                      Kelas siap melanjutkan ke materi berikutnya.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedSubject && selectedExam && selectedSemester && selectedClass && classAnalysis.length === 0 && !loading && (
        <Alert>
          <AlertDescription>
            Tidak ada data analisis untuk kombinasi yang dipilih.
            Pastikan data koreksi sudah tersimpan untuk kelas dan ulangan ini.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}