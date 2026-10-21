'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

import * as XLSX from 'xlsx';

interface SavedGrade {
  id: string;
  exam_name: string;
  subject: string;
  class_name: string;
  semester?: number;
  exam_title: string;
  question_bank_id?: string;
  exam_template_id?: string;
  class_id: string;
  grades: any[];
}

interface AnalysisItem {
  questionNumber: number;
  correctCount: number;
  incorrectCount: number;
  difficulty: number;
  discriminationIndex: number;
  distractors: Record<string, number>;
}

// Fungsi pintar ekstrak TP
const extractTpText = (raw: any): string => {
  if (!raw) return '';
  try {
    let obj = raw;
    if (typeof raw === 'string') {
      if (raw.trim().startsWith('{')) {
        obj = JSON.parse(raw);
      } else {
        return raw;
      }
    }
    if (typeof obj === 'object' && obj !== null) {
      return obj.tp_text || obj.text || obj.desc || obj.label || obj.materi || JSON.stringify(obj);
    }
    return String(obj);
  } catch (e) {
    return String(raw);
  }
};

export default function AnalisisNilaiSiswaPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [savedGradesList, setSavedGradesList] = useState<SavedGrade[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState('');

  const [filterSemester, setFilterSemester] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterMapel, setFilterMapel] = useState('');

  const [showResult, setShowResult] = useState(false);
  const [examInfo, setExamInfo] = useState<SavedGrade | null>(null);
  const [summaryStats, setSummaryStats] = useState({ totalStudents: 0, averageScore: 0, highestScore: 0, lowestScore: 0 });
  const [analysisTable, setAnalysisTable] = useState<AnalysisItem[]>([]);
  const [tpProgress, setTpProgress] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [availableOptions, setAvailableOptions] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      loadSavedGrades();
    }
  }, [user]);

  const loadSavedGrades = async () => {
    try {
      const q = query(collection(db, 'grades'), where('user_id', '==', user?.uid));
      const querySnapshot = await getDocs(q);
      const data: SavedGrade[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as SavedGrade);
      });
      setSavedGradesList(data.sort((a, b) => b.exam_name.localeCompare(a.exam_name)));
    } catch (error) {
      console.error("Gagal memuat data koreksi:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const availableSemesters = [...new Set(savedGradesList.map(g => g.semester).filter(Boolean))].sort();
  const availableKelas = [...new Set(savedGradesList.map(g => g.class_name).filter(Boolean))].sort();
  const availableMapel = [...new Set(savedGradesList.map(g => g.subject).filter(Boolean))].sort();

  const filteredGrades = savedGradesList.filter(g => {
    return (filterSemester ? String(g.semester) === String(filterSemester) : true) &&
           (filterKelas ? g.class_name === filterKelas : true) &&
           (filterMapel ? g.subject === filterMapel : true);
  });

  const runAnalysis = async (gradeId: string) => {
    if (!gradeId) {
      setShowResult(false);
      setExamInfo(null);
      return;
    }

    setLoading(true);
    try {
      const selectedGrade = savedGradesList.find(g => g.id === gradeId);
      if (!selectedGrade || selectedGrade.grades.length === 0) {
        alert("Data nilai tidak ditemukan atau kosong.");
        return;
      }
      setExamInfo(selectedGrade);

      let answerKey: string[] = [];
      let tujuanPembelajaranMapping: any[] = [];

      if (selectedGrade.exam_template_id) {
        const tplDoc = await getDoc(doc(db, 'exam_templates', selectedGrade.exam_template_id));
        if (tplDoc.exists()) {
          const tplData = tplDoc.data();
          answerKey = tplData.multiple_choice?.answer_keys || [];
          tujuanPembelajaranMapping = tplData.multiple_choice?.tujuan_pembelajaran_mapping || [];
        }
      } else if (selectedGrade.question_bank_id) {
        const qbDoc = await getDoc(doc(db, 'question_banks', selectedGrade.question_bank_id));
        if (qbDoc.exists()) {
          const qbData = qbDoc.data();
          answerKey = qbData.questions?.multipleChoice?.map((q: any) => q.correctAnswer) || [];
          tujuanPembelajaranMapping = qbData.question_tp_mapping || [];
        }
      }

      const totalStudents = selectedGrade.grades.length;
      const mcqQuestionCount = answerKey.length;

      if (mcqQuestionCount === 0) {
        alert("Kunci jawaban acuan tidak ditemukan untuk melakukan analisis butir soal.");
        return;
      }

      // --- PERBAIKAN LOGIKA OPSI A, B, C, D ---
      let maxCharCode = 67; // Kode ASCII 67 = 'C'. Minimal selalu tampilkan A, B, C.
      
      // Cek dari kunci jawaban
      answerKey.forEach(ans => {
        if (ans && ans.length === 1) {
          maxCharCode = Math.max(maxCharCode, ans.toUpperCase().charCodeAt(0));
        }
      });
      
      // Cek dari seluruh jawaban siswa (siapa tahu ada yang jawab D atau E)
      selectedGrade.grades.forEach(student => {
        if (student.mcAnswers && Array.isArray(student.mcAnswers)) {
          student.mcAnswers.forEach((ans: string) => {
            if (ans && ans.length === 1) {
              maxCharCode = Math.max(maxCharCode, ans.toUpperCase().charCodeAt(0));
            }
          });
        }
      });

      // Bentuk array opsi secara berurutan (A, B, C, dst)
      const options = [];
      for (let i = 65; i <= maxCharCode; i++) {
        options.push(String.fromCharCode(i));
      }
      setAvailableOptions(options);
      // -----------------------------------------

      const analysis: AnalysisItem[] = Array.from({ length: mcqQuestionCount }, (_, i) => ({
        questionNumber: i + 1,
        correctCount: 0,
        incorrectCount: 0,
        difficulty: 0,
        discriminationIndex: 0,
        distractors: {}
      }));

      const tpMapAnalysis: Record<string, { totalQuestions: number, totalCorrect: number }> = {};

      selectedGrade.grades.forEach(student => {
        if (student.mcAnswers && Array.isArray(student.mcAnswers)) {
          student.mcAnswers.forEach((ans: string, idx: number) => {
            if (idx >= mcqQuestionCount) return;

            const isCorrect = ans === answerKey[idx];
            if (isCorrect) analysis[idx].correctCount++;
            
            if (ans) {
              analysis[idx].distractors[ans] = (analysis[idx].distractors[ans] || 0) + 1;
            }

            const tpText = extractTpText(tujuanPembelajaranMapping[idx]);

            if (tpText && tpText.trim() !== '') {
              if (!tpMapAnalysis[tpText]) {
                tpMapAnalysis[tpText] = { totalQuestions: 0, totalCorrect: 0 };
              }
              if (isCorrect) tpMapAnalysis[tpText].totalCorrect++;
            }
          });
        }
      });

      tujuanPembelajaranMapping.forEach(rawTp => {
        const tpText = extractTpText(rawTp);
        if (tpText && tpText.trim() !== '' && tpMapAnalysis[tpText]) {
          tpMapAnalysis[tpText].totalQuestions++;
        }
      });

      if (totalStudents >= 2) {
        const sortedStudents = [...selectedGrade.grades].sort((a, b) => (b.finalGrade || 0) - (a.finalGrade || 0));
        const groupSize = Math.floor(totalStudents / 2);
        
        if (groupSize > 0) {
          const highGroup = sortedStudents.slice(0, groupSize);
          const lowGroup = sortedStudents.slice(totalStudents - groupSize);

          analysis.forEach((item, idx) => {
            let highCorrect = 0;
            let lowCorrect = 0;
            highGroup.forEach(s => { if (s.mcAnswers?.[idx] === answerKey[idx]) highCorrect++; });
            lowGroup.forEach(s => { if (s.mcAnswers?.[idx] === answerKey[idx]) lowCorrect++; });
            item.discriminationIndex = (highCorrect - lowCorrect) / groupSize;
          });
        }
      }

      analysis.forEach(item => {
        item.difficulty = totalStudents > 0 ? (item.correctCount / totalStudents) * 100 : 0;
        item.incorrectCount = totalStudents - item.correctCount;
      });

      const scores = selectedGrade.grades.map(g => g.finalGrade || 0);
      const average = scores.reduce((a, b) => a + b, 0) / totalStudents;
      setSummaryStats({
        totalStudents,
        averageScore: Number(average.toFixed(1)),
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores)
      });

      const ranges = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
      scores.forEach(score => {
        if (score <= 20) ranges['0-20']++;
        else if (score <= 40) ranges['21-40']++;
        else if (score <= 60) ranges['41-60']++;
        else if (score <= 80) ranges['61-80']++;
        else ranges['81-100']++;
      });
      setChartData(Object.keys(ranges).map(key => ({ name: key, Siswa: (ranges as any)[key] })));

      const finalTpData = Object.keys(tpMapAnalysis).map(tp => {
        const target = tpMapAnalysis[tp];
        const maxPossibleCorrect = target.totalQuestions * totalStudents;
        const percentage = maxPossibleCorrect > 0 ? (target.totalCorrect / maxPossibleCorrect) * 100 : 0;
        return { tpName: tp, percentage: Math.round(percentage) };
      });
      
      setTpProgress(finalTpData);
      setAnalysisTable(analysis);
      setShowResult(true);

    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan sistem saat melakukan pemrosesan data.");
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyStyles = (val: number) => {
    if (val <= 30) return { text: 'Sulit', bg: 'bg-red-100 text-red-800', printColor: 'text-red-700' };
    if (val > 70) return { text: 'Mudah', bg: 'bg-blue-100 text-blue-800', printColor: 'text-blue-700' };
    return { text: 'Sedang', bg: 'bg-yellow-100 text-yellow-800', printColor: 'text-yellow-700' };
  };

  const getDiscriminationStyles = (val: number) => {
    if (val >= 0.4) return { text: 'Sangat Baik', bg: 'bg-green-100 text-green-800', printColor: 'text-green-700' };
    if (val >= 0.2) return { text: 'Cukup', bg: 'bg-orange-100 text-orange-800', printColor: 'text-orange-700' };
    return { text: 'Perlu Perbaikan', bg: 'bg-rose-100 text-rose-800', printColor: 'text-rose-700' };
  };

  const handleExportExcel = () => {
    if (analysisTable.length === 0) return;
    const exportData = analysisTable.map(item => {
      const row: any = {
        'No. Soal': item.questionNumber,
        'Jml Benar': item.correctCount,
        'Jml Salah': item.incorrectCount,
        'Tingkat Kesulitan': `${item.difficulty.toFixed(1)}%`,
        'Daya Pembeda': item.discriminationIndex.toFixed(2),
        'Kategori Kesulitan': getDifficultyStyles(item.difficulty).text,
        'Kategori Daya Pembeda': getDiscriminationStyles(item.discriminationIndex).text,
      };
      availableOptions.forEach(opt => {
        row[`Pilihan ${opt}`] = item.distractors[opt] || 0;
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Analisis Butir Soal");
    XLSX.writeFile(workbook, `Analisis_Soal_${examInfo?.exam_name || 'Ujian'}.xlsx`);
  };

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="container mx-auto pb-10 px-4 pt-6 bg-slate-50 min-h-screen animate-in fade-in print:bg-white print:min-h-0">
      
      {/* INJEKSI CSS KHUSUS PRINT SUPER KUAT */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: landscape; margin: 15mm; }
          html, body { 
            background-color: #ffffff !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          * {
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          aside, nav, header { display: none !important; }
          html, body, main, #dashboard-main, .container { 
            width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important;
            height: auto !important; min-height: auto !important;
            overflow: visible !important; 
          }
          .print\\:overflow-visible { overflow: visible !important; }
          .print\\:hidden { display: none !important; }
          
          table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
      `}} />

      {/* HEADER PRINT-ONLY */}
      <div className="hidden print:block text-center mb-6 border-b-2 border-slate-800 pb-4">
        <h1 className="text-2xl font-bold uppercase">Laporan Analisis Butir Soal & Ketercapaian TP</h1>
        <p className="text-lg mt-1 font-semibold">{examInfo?.exam_name} - {examInfo?.subject}</p>
        <p className="text-sm mt-1">Kelas: {examInfo?.class_name} {examInfo?.semester ? `| Semester: ${examInfo.semester}` : ''}</p>
      </div>

      <div className="mb-6 print:hidden">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Analisis Butir Soal</h1>
        <p className="mt-2 text-slate-600">Analisis tingkat ketercapaian kognitif siswa dan validitas instrumen ujian otomatis.</p>
      </div>

      <Card className="mb-6 border-slate-200 shadow-sm bg-white print:hidden">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-500">Filter Semester</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white" value={filterSemester} onChange={e => setFilterSemester(e.target.value)}>
                <option value="">Semua Semester</option>
                {availableSemesters.map(s => <option key={String(s)} value={String(s)}>Semester {s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-500">Filter Kelas</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white" value={filterKelas} onChange={e => setFilterKelas(e.target.value)}>
                <option value="">Semua Kelas</option>
                {availableKelas.map(k => <option key={k} value={k}>Kelas {k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-500">Filter Mapel</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white" value={filterMapel} onChange={e => setFilterMapel(e.target.value)}>
                <option value="">Semua Mapel</option>
                {availableMapel.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-end">
               <Button variant="outline" className="w-full text-slate-600" onClick={() => { setFilterSemester(''); setFilterKelas(''); setFilterMapel(''); }}>
                 Reset Filter
               </Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-end border-t border-slate-100 pt-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-2 text-slate-800">Pilih Dokumen Hasil Koreksi</label>
              <select 
                className="w-full border-2 border-blue-200 rounded-md px-3 py-2 bg-blue-50/30 text-sm h-11 focus:ring-2 focus:ring-blue-500"
                value={selectedGradeId}
                onChange={(e) => { setSelectedGradeId(e.target.value); runAnalysis(e.target.value); }}
                disabled={loadingData}
              >
                <option value="">-- Silakan Pilih Hasil Tes Ujian --</option>
                {filteredGrades.map(g => (
                  <option key={g.id} value={g.id}>{g.exam_name} - {g.subject} (Kelas {g.class_name})</option>
                ))}
              </select>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm pb-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
              </div>
            )}
            
            {showResult && !loading && (
              <div className="flex gap-2">
                <Button onClick={handlePrint} variant="outline" className="border-slate-300 hover:bg-slate-100 h-11">
                  <Printer className="w-4 h-4 mr-2" /> Cetak Laporan
                </Button>
                <Button onClick={handleExportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white h-11">
                  <Download className="w-4 h-4 mr-2" /> Export Excel
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showResult && (
        <div className="space-y-6 print:space-y-8 print:block">
          
          <Card className="border-slate-200 shadow-sm print:shadow-none print:border print:border-slate-300 print:break-inside-avoid print:bg-white">
            <CardHeader className="bg-slate-50 border-b py-4 print:bg-slate-100 print:border-b print:border-slate-300 print:py-3">
              <CardTitle className="text-base text-slate-800 font-bold print:text-black">Analisis Ketercapaian Tujuan Pembelajaran (TP)</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 print:p-4 print:space-y-3">
              {tpProgress.length === 0 ? (
                <p className="text-sm text-slate-500 italic print:text-black">Data pemetaan soal ke indikator TP tidak ditemukan.</p>
              ) : (
                tpProgress.map((tp, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-slate-700 print:text-black pr-4 leading-snug">{tp.tpName}</span>
                      <span className="font-bold text-slate-600 shrink-0 print:text-black">{tp.percentage}% Ketercapaian</span>
                    </div>
                    <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden shadow-inner print:border print:border-slate-300 print:h-4">
                      <div 
                        className={`h-full transition-all duration-500 print:border-r print:border-slate-300 ${
                          tp.percentage >= 75 ? 'bg-green-500' : tp.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${tp.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3 print:gap-6 print:break-inside-avoid">
            
            <Card className="md:col-span-1 print:col-span-1 border-slate-200 shadow-sm flex flex-col justify-between print:shadow-none print:border print:border-slate-300 print:bg-white">
              <CardHeader className="bg-slate-50 border-b py-3 text-center print:bg-slate-100 print:border-b print:border-slate-300">
                <CardTitle className="text-sm font-bold text-slate-700 print:text-black">Ringkasan Statistik</CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-2 gap-4 flex-1 items-center print:p-4 print:gap-3">
                <div className="text-center p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 print:bg-white print:border print:border-slate-300 print:border-solid">
                  <div className="text-2xl font-extrabold text-indigo-600 print:text-black">{summaryStats.totalStudents}</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1 print:text-black">Jumlah Siswa</div>
                </div>
                <div className="text-center p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 print:bg-white print:border print:border-slate-300 print:border-solid">
                  <div className="text-2xl font-extrabold text-emerald-600 print:text-black">{summaryStats.averageScore}</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1 print:text-black">Nilai Rata-rata</div>
                </div>
                <div className="text-center p-3 bg-blue-50/50 rounded-xl border border-blue-100 print:bg-white print:border print:border-slate-300 print:border-solid">
                  <div className="text-2xl font-extrabold text-blue-600 print:text-black">{summaryStats.highestScore}</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1 print:text-black">Nilai Tertinggi</div>
                </div>
                <div className="text-center p-3 bg-rose-50/50 rounded-xl border border-rose-100 print:bg-white print:border print:border-slate-300 print:border-solid">
                  <div className="text-2xl font-extrabold text-rose-600 print:text-black">{summaryStats.lowestScore}</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1 print:text-black">Nilai Terendah</div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 print:col-span-2 border-slate-200 shadow-sm print:shadow-none print:border print:border-slate-300 min-w-0 print:bg-white">
              <CardHeader className="bg-slate-50 border-b py-3 text-center print:bg-slate-100 print:border-b print:border-slate-300">
                <CardTitle className="text-sm font-bold text-slate-700 print:text-black">Grafik Distribusi Capaian Nilai</CardTitle>
              </CardHeader>
              <CardContent className="p-4 h-[250px] print:h-[220px] w-full min-w-0 overflow-hidden print:overflow-hidden">
                <ResponsiveContainer width="99%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 30, left: -30, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#334155' }} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#334155' }} allowDecimals={false} axisLine={false} />
                    <RechartsTooltip />
                    <Bar dataKey="Siswa" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm print:overflow-visible print:shadow-none print:border-0 print:mt-8 print:bg-white">
            <CardHeader className="bg-slate-50 border-b py-4 print:bg-slate-100 print:border print:border-slate-300 print:mb-2">
              <CardTitle className="text-base text-slate-800 font-bold print:text-black">Detail Analisis Butir Soal (Klasik)</CardTitle>
            </CardHeader>
            <CardContent className="p-0 print:p-0">
              <div className="overflow-x-auto print:overflow-visible">
                <Table className="print:w-full print:table-fixed print:bg-white">
                  <TableHeader className="bg-slate-50 print:bg-slate-100">
                    <TableRow className="print:border print:border-slate-300">
                      <TableHead className="w-16 font-bold text-center print:border print:border-slate-300 print:text-black">No.</TableHead>
                      <TableHead className="font-bold text-center text-green-700 bg-green-50/50 print:bg-transparent print:border print:border-slate-300 print:text-black">Benar</TableHead>
                      <TableHead className="font-bold text-center text-red-700 bg-red-50/50 print:bg-transparent print:border print:border-slate-300 print:text-black">Salah</TableHead>
                      <TableHead className="font-bold text-center print:border print:border-slate-300 print:text-black">Tk. Kesulitan</TableHead>
                      <TableHead className="font-bold text-center print:border print:border-slate-300 print:text-black">Daya Pembeda</TableHead>
                      <TableHead className="font-bold text-left min-w-[140px] print:border print:border-slate-300 print:text-black">Rekomendasi</TableHead>
                      {availableOptions.map(opt => (
                        <TableHead key={opt} className="font-bold text-center print:border print:border-slate-300 print:text-black">Opsi {opt}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysisTable.map((item) => {
                      const diff = getDifficultyStyles(item.difficulty);
                      const disc = getDiscriminationStyles(item.discriminationIndex);
                      return (
                        <TableRow key={item.questionNumber} className="hover:bg-slate-50/50 transition-colors print:border print:border-slate-300">
                          <TableCell className="text-center font-bold text-slate-700 print:border print:border-slate-300 print:text-black">{item.questionNumber}</TableCell>
                          <TableCell className="text-center font-bold text-green-600 bg-green-50/20 print:bg-transparent print:border print:border-slate-300 print:text-black">{item.correctCount}</TableCell>
                          <TableCell className="text-center font-bold text-red-600 bg-red-50/20 print:bg-transparent print:border print:border-slate-300 print:text-black">{item.incorrectCount}</TableCell>
                          <TableCell className="text-center font-medium print:border print:border-slate-300 print:text-black">{item.difficulty.toFixed(1)}%</TableCell>
                          <TableCell className="text-center font-medium print:border print:border-slate-300 print:text-black">{item.discriminationIndex.toFixed(2)}</TableCell>
                          <TableCell className="py-2 print:border print:border-slate-300">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold print:bg-transparent ${diff.bg} print:${diff.printColor}`}>{diff.text}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold print:bg-transparent ${disc.bg} print:${disc.printColor}`}>{disc.text}</span>
                            </div>
                          </TableCell>
                          {availableOptions.map(opt => {
                            const count = item.distractors[opt] || 0;
                            return (
                              <TableCell key={opt} className="text-center font-medium text-slate-600 print:border print:border-slate-300 print:text-black">
                                {count}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}