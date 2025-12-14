
"use client";

// State untuk input manual nilai
const [manualModalOpen, setManualModalOpen] = useState(false);
const [manualStudent, setManualStudent] = useState('');
const [manualUH, setManualUH] = useState<string[]>(['']);
const [manualPTS, setManualPTS] = useState('');
const [manualPAS, setManualPAS] = useState('');
const [manualLoading, setManualLoading] = useState(false);
const [manualError, setManualError] = useState('');

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';

interface StudentGrade {
  studentId?: string;
  studentName: string;
  totalScore: number;
  finalGrade?: number;
}

interface Grade {
  id: string;
  subject: string;
  exam_title: string;
  exam_name: string;
  class_name: string;
  class_id: string;
  grades: StudentGrade[];
  created_at: string;
  is_finalized?: boolean;
}

interface ConsolidatedStudentGrade {
  studentName: string;
  uh: number[];  // Array of UH scores
  rataUH: number;
  pts: number;
  pas: number;
  nilaiRapor: number;
}

const ITEMS_PER_PAGE = 10;

export default function RekapNilaiPage() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'consolidated'>('list');
  const [consolidatedGrades, setConsolidatedGrades] = useState<ConsolidatedStudentGrade[]>([]);
  const [sortBy, setSortBy] = useState<'created_at' | 'exam_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (user) {
      loadMetadata();
      loadGrades();
    }
  }, [user, selectedSubject, selectedClass, sortBy, sortOrder, currentPage]);

  const loadMetadata = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'grades'), where('user_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      const subjectSet = new Set<string>();
      const classSet = new Set<string>();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        subjectSet.add(data.subject);
        classSet.add(data.class_name);
      });
      
      setSubjects(Array.from(subjectSet));
      setClasses(Array.from(classSet));
    } catch (error) {
      console.error('Error loading metadata:', error);
    }
  };

  const loadGrades = async (loadMore: boolean = false) => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Load all grades for the user (client-side filtering for better compatibility)
      const q = query(
        collection(db, 'grades'),
        where('user_id', '==', user.uid)
      );

      const querySnapshot = await getDocs(q);
      let gradesData: Grade[] = [];

      querySnapshot.forEach((doc) => {
        gradesData.push({ id: doc.id, ...doc.data() } as Grade);
      });

      // Apply filters on client-side
      if (selectedSubject) {
        gradesData = gradesData.filter(g => g.subject === selectedSubject);
      }

      if (selectedClass) {
        gradesData = gradesData.filter(g => g.class_name === selectedClass);
      }

      // Sort on client-side
      gradesData.sort((a, b) => {
        let aVal: any, bVal: any;
        
        if (sortBy === 'created_at') {
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
        } else {
          aVal = a.exam_name.toLowerCase();
          bVal = b.exam_name.toLowerCase();
        }
        
        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      // Implement pagination on client-side
      const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
      const endIdx = startIdx + ITEMS_PER_PAGE;
      const paginatedData = gradesData.slice(startIdx, endIdx);

      setGrades(paginatedData);
      setHasMore(endIdx < gradesData.length);
    } catch (error) {
      console.error('Error loading grades:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleExportCSV = (grade: Grade) => {
    const csvContent = [
      ['No', 'Nama Siswa', 'Nilai'],
      ...grade.grades.map((g, idx) => [
        (idx + 1).toString(),
        g.studentName,
        g.totalScore.toString(),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${grade.exam_name}_${grade.class_name}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const consolidateGradesByStudent = () => {
    if (!selectedSubject || !selectedClass) return;


    // Group grades by student
    const studentMap = new Map<string, {
      uh: number[];
      pts: number;
      pas: number;
    }>();

    grades.forEach(grade => {
      // Gabungkan exam_name dan exam_title untuk deteksi jenis ulangan
      const examNameLower = (grade.exam_name || '').toLowerCase();
      const examTitleLower = (grade.exam_title || '').toLowerCase();
      // Cek kata kunci umum
      let examType = 'uh';
      if (examNameLower.includes('pts') || examTitleLower.includes('pts') || examNameLower.includes('uts') || examTitleLower.includes('uts')) {
        examType = 'pts';
      } else if (
        examNameLower.includes('pas') || examTitleLower.includes('pas') ||
        examNameLower.includes('uas') || examTitleLower.includes('uas') ||
        examNameLower.includes('pat') || examTitleLower.includes('pat')
      ) {
        examType = 'pas';
      } else if (
        examNameLower.includes('uh') || examTitleLower.includes('uh') ||
        examNameLower.includes('ulangan harian') || examTitleLower.includes('ulangan harian') ||
        examNameLower.includes('formatif') || examTitleLower.includes('formatif')
      ) {
        examType = 'uh';
      } else if (
        examNameLower.includes('sumatif') || examTitleLower.includes('sumatif')
      ) {
        // Sumatif: jika ada PAS/PTS di title, tetap prioritas PAS/PTS
        if (examNameLower.includes('akhir') || examTitleLower.includes('akhir')) {
          examType = 'pas';
        } else if (examNameLower.includes('tengah') || examTitleLower.includes('tengah')) {
          examType = 'pts';
        } else {
          examType = 'uh';
        }
      }

      grade.grades.forEach(studentGrade => {
        const student = studentMap.get(studentGrade.studentName) || {
          uh: [],
          pts: 0,
          pas: 0
        };

        const score = studentGrade.finalGrade !== undefined ? studentGrade.finalGrade : studentGrade.totalScore;

        if (examType === 'uh') {
          student.uh.push(score);
        } else if (examType === 'pts') {
          student.pts = score;
        } else if (examType === 'pas') {
          student.pas = score;
        }

        studentMap.set(studentGrade.studentName, student);
      });
    });

    // Calculate consolidated grades
    const consolidated: ConsolidatedStudentGrade[] = Array.from(studentMap.entries()).map(([name, data]) => {
      const rataUH = data.uh.length > 0 ? data.uh.reduce((a, b) => a + b, 0) / data.uh.length : 0;
      // Formula: NA = (Rata UH + PTS + (PAS/2)) / 2.5
      const nilaiRapor = ((rataUH + data.pts + (data.pas / 2)) / 2.5);
      
      return {
        studentName: name,
        uh: data.uh,
        rataUH: Math.round(rataUH * 100) / 100,
        pts: data.pts,
        pas: data.pas,
        nilaiRapor: Math.round(nilaiRapor * 100) / 100
      };
    });

    // Sort by student name
    consolidated.sort((a, b) => a.studentName.localeCompare(b.studentName));
    setConsolidatedGrades(consolidated);
  };

  const calculateStats = (gradeData: Grade) => {
    // Use finalGrade if available, otherwise use totalScore
    const scores = gradeData.grades.map((g) => g.finalGrade !== undefined ? g.finalGrade : g.totalScore);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    return { avg: avg.toFixed(2), max, min };
  };

  const handleViewConsolidated = () => {
    if (!selectedSubject || !selectedClass) {
      alert('Pilih Mata Pelajaran dan Kelas terlebih dahulu');
      return;
    }
    consolidateGradesByStudent();
    setViewMode('consolidated');
  };

  const exportConsolidatedToExcel = () => {
    // Create CSV content
    const maxUH = Math.max(...consolidatedGrades.map(g => g.uh.length), 5);
    const headers = ['No', 'Nama Siswa'];
    
    for (let i = 1; i <= maxUH; i++) {
      headers.push(`UH ${i}`);
    }
    headers.push('Rata-rata UH', 'PTS', 'PAS', 'Nilai Rapor');

    const rows = consolidatedGrades.map((grade, idx) => {
      const row = [idx + 1, grade.studentName];
      
      // Add UH scores
      for (let i = 0; i < maxUH; i++) {
        row.push(grade.uh[i] !== undefined ? grade.uh[i] : '');
      }
      
      row.push(
        grade.rataUH,
        grade.pts || '',
        grade.pas || '',
        grade.nilaiRapor
      );
      
      return row;
    });

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    // Add BOM for UTF-8
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Daftar_Nilai_${selectedSubject}_${selectedClass}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Rekap Nilai</h1>
        <p className="mt-2 text-gray-600">Lihat rekapitulasi nilai siswa</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filter & Sorting</CardTitle>
            {selectedSubject && selectedClass && (
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  onClick={() => setViewMode('list')}
                  size="sm"
                >
                  📋 Daftar Nilai
                </Button>
                <Button
                  variant={viewMode === 'consolidated' ? 'default' : 'outline'}
                  onClick={handleViewConsolidated}
                  size="sm"
                >
                  📊 Tabel Kurikulum Merdeka
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Mata Pelajaran</label>
              <select
                className="w-full p-2 border rounded-md"
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">Semua</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Kelas</label>
              <select
                className="w-full p-2 border rounded-md"
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">Semua</option>
                {classes.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Urutkan Berdasarkan</label>
              <select
                className="w-full p-2 border rounded-md"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as 'created_at' | 'exam_name');
                  setCurrentPage(1);
                }}
              >
                <option value="created_at">Tanggal</option>
                <option value="exam_name">Nama Ujian</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Urutan</label>
              <select
                className="w-full p-2 border rounded-md"
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value as 'asc' | 'desc');
                  setCurrentPage(1);
                }}
              >
                <option value="desc">Terbaru</option>
                <option value="asc">Terlama</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consolidated Grade Table (Kurikulum Merdeka) */}
      {viewMode === 'consolidated' && consolidatedGrades.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daftar Nilai Siswa - Kurikulum Merdeka</CardTitle>
                <CardDescription>
                  {selectedSubject} - Kelas {selectedClass}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setManualModalOpen(true)} variant="default" size="sm" className="bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold">
                  + Input Manual Nilai
                </Button>
                <Button onClick={exportConsolidatedToExcel} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel (CSV)
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Formula Info */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">📐 Rumus Perhitungan:</h4>
              <div className="space-y-1 text-sm text-blue-800">
                <p><strong>Rata-rata UH:</strong> <code className="bg-blue-100 px-2 py-0.5 rounded">= AVERAGE(UH1:UH5)</code></p>
                <p><strong>Nilai Rapor (NA):</strong> <code className="bg-blue-100 px-2 py-0.5 rounded">= (Rata_UH + PTS + (PAS/2)) / 2.5</code></p>
                <p className="text-xs mt-2 text-blue-700">Pembobotan: Sumatif Lingkup Materi + PTS + (PAS ÷ 2) dibagi 2.5</p>
              </div>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-600 to-indigo-600">
                    <TableHead className="text-white font-bold text-center border-r border-blue-400">No</TableHead>
                    <TableHead className="text-white font-bold border-r border-blue-400 min-w-[200px]">Nama Siswa</TableHead>
                    {(() => {
                      const maxUH = Math.max(...consolidatedGrades.map(g => g.uh.length), 5);
                      return Array.from({ length: maxUH }, (_, i) => (
                        <TableHead key={`uh-${i}`} className="text-white font-bold text-center border-r border-blue-400 bg-green-600">
                          UH {i + 1}
                        </TableHead>
                      ));
                    })()}
                    <TableHead className="text-white font-bold text-center border-r border-blue-400 bg-yellow-600">Rata-rata UH</TableHead>
                    <TableHead className="text-white font-bold text-center border-r border-blue-400 bg-purple-600">PTS</TableHead>
                    <TableHead className="text-white font-bold text-center border-r border-blue-400 bg-orange-600">PAS</TableHead>
                    <TableHead className="text-white font-bold text-center bg-red-600">Nilai Rapor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidatedGrades.map((student, idx) => {
                    const maxUH = Math.max(...consolidatedGrades.map(g => g.uh.length), 5);
                    return (
                      <TableRow key={idx} className="hover:bg-gray-50">
                        <TableCell className="text-center font-medium border-r">{idx + 1}</TableCell>
                        <TableCell className="font-medium border-r">{student.studentName}</TableCell>
                        {Array.from({ length: maxUH }, (_, i) => (
                          <TableCell key={`uh-${i}`} className="text-center border-r">
                            {student.uh[i] !== undefined ? (
                              <span className={student.uh[i] >= 75 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                {student.uh[i]}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold bg-yellow-50 border-r">
                          <span className={student.rataUH >= 75 ? 'text-green-700' : 'text-red-700'}>
                            {student.rataUH.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-bold bg-purple-50 border-r">
                          {student.pts > 0 ? (
                            <span className={student.pts >= 75 ? 'text-green-700' : 'text-red-700'}>
                              {student.pts}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-orange-50 border-r">
                          {student.pas > 0 ? (
                            <span className={student.pas >= 75 ? 'text-green-700' : 'text-red-700'}>
                              {student.pas}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold text-lg bg-red-50">
                          <span className={student.nilaiRapor >= 75 ? 'text-green-700' : 'text-red-700'}>
                            {student.nilaiRapor.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grades List */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">Loading...</p>
              </CardContent>
            </Card>
          ) : grades.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">Belum ada data nilai</p>
              </CardContent>
            </Card>
          ) : (
          grades.map((grade) => {
            const stats = calculateStats(grade);
            return (
              <Card key={grade.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {grade.exam_name}
                        {grade.is_finalized && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Finalized
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {grade.subject} - {grade.class_name} - {grade.exam_title}
                        <br />
                        Dibuat: {formatTimestamp(grade.created_at)}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportCSV(grade)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Statistics */}
                  <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">Rata-rata</p>
                      <p className="text-2xl font-bold text-blue-600">{stats.avg}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Nilai Tertinggi</p>
                      <p className="text-2xl font-bold text-green-600">{stats.max}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Nilai Terendah</p>
                      <p className="text-2xl font-bold text-red-600">{stats.min}</p>
                    </div>
                  </div>

                  {/* Student Grades Table */}
                  <div className="overflow-x-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50">
                          <TableHead className="font-semibold">No</TableHead>
                          <TableHead className="font-semibold">Nama Siswa</TableHead>
                          <TableHead className="text-right font-semibold">Total Skor</TableHead>
                          <TableHead className="text-right font-semibold">Nilai</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grade.grades.map((g, idx) => (
                          <TableRow key={idx} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell>{g.studentName}</TableCell>
                            <TableCell className="text-right font-medium text-blue-600">
                              {g.totalScore}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-bold text-lg ${
                                g.finalGrade !== undefined
                                  ? g.finalGrade >= 75 ? 'text-green-600' : 'text-red-600'
                                  : 'text-gray-700'
                              }`}>
                                {g.finalGrade !== undefined ? g.finalGrade : g.totalScore}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })
          )}
        </div>
      )}
    {/* Modal Input Manual Nilai */}
    {manualModalOpen && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
          <h2 className="text-xl font-bold mb-4 text-green-700">Input Manual Nilai Siswa</h2>
          <button className="absolute top-3 right-3 text-gray-400 hover:text-red-500" onClick={() => setManualModalOpen(false)}>
            ×
          </button>
          {manualError && <div className="mb-2 text-red-600 text-sm">{manualError}</div>}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Nama Siswa</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={manualStudent}
              onChange={e => setManualStudent(e.target.value)}
              placeholder="Masukkan nama siswa"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Nilai UH (bisa lebih dari 1, pisahkan dengan koma)</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={manualUH.join(',')}
              onChange={e => setManualUH(e.target.value.split(',').map(v => v.trim()))}
              placeholder="Contoh: 80,85,90"
            />
          </div>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">PTS</label>
              <input
                className="w-full border rounded px-3 py-2"
                type="number"
                value={manualPTS}
                onChange={e => setManualPTS(e.target.value)}
                placeholder="Contoh: 85"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">PAS</label>
              <input
                className="w-full border rounded px-3 py-2"
                type="number"
                value={manualPAS}
                onChange={e => setManualPAS(e.target.value)}
                placeholder="Contoh: 90"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-2 rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-60"
              disabled={manualLoading}
              onClick={async () => {
                setManualError('');
                if (!manualStudent.trim()) {
                  setManualError('Nama siswa wajib diisi');
                  return;
                }
                if (!manualUH.some(u => u && !isNaN(Number(u)))) {
                  setManualError('Minimal 1 nilai UH harus diisi');
                  return;
                }
                setManualLoading(true);
                try {
                  // Simpan ke Firestore: update/replace dokumen grades (per subject, class, exam_name: "Manual Input")
                  if (!user) {
                    setManualError('User tidak ditemukan. Silakan login ulang.');
                    setManualLoading(false);
                    return;
                  }
                  const q = query(collection(db, 'grades'), where('user_id', '==', user.uid), where('subject', '==', selectedSubject), where('class_name', '==', selectedClass), where('exam_name', '==', 'Manual Input'));
                  const snap = await getDocs(q);
                  let docId = '';
                  let gradesArr = [];
                  if (!snap.empty) {
                    docId = snap.docs[0].id;
                    gradesArr = snap.docs[0].data().grades || [];
                  }
                  // Cek jika siswa sudah ada, replace
                  const idx = gradesArr.findIndex((g: any) => g.studentName === manualStudent.trim());
                  const newGrade = {
                    studentName: manualStudent.trim(),
                    totalScore: 0,
                    finalGrade: 0,
                    manualInput: true,
                    uh: manualUH.filter(u => u && !isNaN(Number(u))).map(u => Number(u)),
                    pts: manualPTS ? Number(manualPTS) : 0,
                    pas: manualPAS ? Number(manualPAS) : 0
                  };
                  // Hitung nilai rapor (mengikuti rumus di consolidateGradesByStudent)
                  const rataUH = newGrade.uh.length > 0 ? newGrade.uh.reduce((a, b) => a + b, 0) / newGrade.uh.length : 0;
                  newGrade.finalGrade = Math.round(((rataUH + newGrade.pts + (newGrade.pas / 2)) / 2.5) * 100) / 100;
                  newGrade.totalScore = newGrade.finalGrade;
                  if (idx >= 0) {
                    gradesArr[idx] = newGrade;
                  } else {
                    gradesArr.push(newGrade);
                  }
                  if (docId) {
                    await import('firebase/firestore').then(({ doc, updateDoc }) => updateDoc(doc(db, 'grades', docId), { grades: gradesArr }));
                  } else {
                    await import('firebase/firestore').then(({ addDoc, Timestamp }) => addDoc(collection(db, 'grades'), {
                      user_id: user.uid,
                      subject: selectedSubject,
                      class_name: selectedClass,
                      class_id: '',
                      exam_name: 'Manual Input',
                      exam_title: 'Manual Input',
                      grades: gradesArr,
                      created_at: new Date().toISOString(),
                      is_finalized: false
                    }));
                  }
                  setManualModalOpen(false);
                  setManualStudent('');
                  setManualUH(['']);
                  setManualPTS('');
                  setManualPAS('');
                  setTimeout(() => loadGrades(), 500);
                } catch (err: any) {
                  setManualError('Gagal menyimpan nilai: ' + (err.message || err));
                } finally {
                  setManualLoading(false);
                }
              }}
            >
              Simpan Nilai
            </button>
            <button
              className="flex-1 border border-gray-300 py-2 rounded-lg"
              onClick={() => setManualModalOpen(false)}
              disabled={manualLoading}
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
}
