"use client";

import { doc, deleteDoc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, X } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';

interface StudentGrade {
  studentId?: string;
  studentName: string;
  totalScore: number;
  finalGrade?: number;
  pas?: number;
  semester?: number;
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
  semester?: number;
}

interface ConsolidatedStudentGrade {
  studentName: string;
  uh: number[];
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
  const [selectedSemester, setSelectedSemester] = useState<number | ''>('');

  // Manual Input States
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualStudent, setManualStudent] = useState('');
  const [manualUH, setManualUH] = useState<string[]>(['']);
  const [manualPTS, setManualPTS] = useState('');
  const [manualPAS, setManualPAS] = useState('');
  const [manualSemester, setManualSemester] = useState<number | ''>('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState('');

  // Effect 1: Menarik data mentah setiap kali filter berubah
  useEffect(() => {
    if (user) {
      loadMetadata();
      loadGrades();
    }
  }, [user, selectedSubject, selectedClass, sortBy, sortOrder, currentPage, selectedSemester]);

  // Effect 2: "ALARM OTOMATIS" merender ulang tabel konsolidasi jika data/filter berubah
  useEffect(() => {
    if (viewMode === 'consolidated') {
      consolidateGradesByStudent();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grades, viewMode, selectedSemester, selectedSubject, selectedClass]);

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

  const loadGrades = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'grades'), where('user_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      let gradesData: Grade[] = [];
      
      querySnapshot.forEach((doc) => {
        gradesData.push({ id: doc.id, ...doc.data() } as Grade);
      });

      if (selectedSubject) gradesData = gradesData.filter(g => g.subject === selectedSubject);
      if (selectedClass) gradesData = gradesData.filter(g => g.class_name === selectedClass);
      
      if (selectedSemester) {
        gradesData = gradesData.filter(g => g.semester === selectedSemester || g.grades.some(sg => sg.semester === selectedSemester));
        gradesData = gradesData.map(g => ({
          ...g,
          grades: g.grades.filter(sg => sg.semester === selectedSemester || g.semester === selectedSemester)
        }));
      }

      gradesData.sort((a, b) => {
        let aVal = sortBy === 'created_at' ? new Date(a.created_at).getTime() : a.exam_name.toLowerCase();
        let bVal = sortBy === 'created_at' ? new Date(b.created_at).getTime() : b.exam_name.toLowerCase();
        
        if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });

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

  const handleDeleteGrade = async (gradeId: string) => {
    if (!window.confirm('Yakin ingin menghapus data nilai ini?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'grades', gradeId));
      setGrades((prev) => prev.filter((g) => g.id !== gradeId));
    } catch (error) {
      alert('Gagal menghapus data nilai');
    } finally {
      setLoading(false);
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
    ].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${grade.exam_name}_${grade.class_name}.csv`;
    link.click();
  };

  const consolidateGradesByStudent = () => {
    // Pengaman: Jika filter dikosongkan ("Semua"), bersihkan tabel agar tidak bingung.
    if (!selectedSubject || !selectedClass) {
      setConsolidatedGrades([]);
      return;
    }
    
    const studentMap = new Map<string, { uh: number[]; pts: number; pas: number; }>();

    grades.forEach(grade => {
      const combinedTitle = `${grade.exam_name || ''} ${grade.exam_title || ''}`.toLowerCase();
      let examType = 'uh';

      if (combinedTitle.match(/(pas|uas|pat|sas|asat|akhir semester|akhir tahun)/)) {
        examType = 'pas';
      } else if (combinedTitle.match(/(pts|uts|sts|mid|tengah semester)/)) {
        examType = 'pts';
      }

      grade.grades.forEach(studentGrade => {
        if (selectedSemester && studentGrade.semester && studentGrade.semester !== selectedSemester && grade.semester !== selectedSemester) {
          return;
        }

        const student = studentMap.get(studentGrade.studentName) || { uh: [], pts: 0, pas: 0 };
        const score = studentGrade.finalGrade !== undefined ? studentGrade.finalGrade : studentGrade.totalScore;

        if (examType === 'pas') {
          student.pas = score;
        } else if (examType === 'pts') {
          student.pts = score;
        } else {
          if (typeof studentGrade.pas === 'number' && studentGrade.pas > 0) {
            student.pas = studentGrade.pas;
          } else {
            student.uh.push(score);
          }
        }
        studentMap.set(studentGrade.studentName, student);
      });
    });

    const consolidated: ConsolidatedStudentGrade[] = Array.from(studentMap.entries()).map(([name, data]) => {
      const rataUH = data.uh.length > 0 ? data.uh.reduce((a, b) => a + b, 0) / data.uh.length : 0;
      
      let totalWeight = 0;
      let totalScore = 0;

      if (rataUH > 0) { totalScore += rataUH; totalWeight += 1; }
      if (data.pts > 0) { totalScore += data.pts; totalWeight += 1; }
      if (data.pas > 0) { totalScore += (data.pas / 2); totalWeight += 0.5; }

      const nilaiRapor = totalWeight > 0 ? (totalScore / totalWeight) : 0;

      return {
        studentName: name,
        uh: data.uh,
        rataUH: Math.round(rataUH * 100) / 100,
        pts: data.pts,
        pas: data.pas,
        nilaiRapor: Math.round(nilaiRapor * 100) / 100
      };
    });

    consolidated.sort((a, b) => a.studentName.localeCompare(b.studentName));
    setConsolidatedGrades(consolidated);
  };

  const calculateStats = (gradeData: Grade) => {
    const scores = gradeData.grades.map((g) => g.finalGrade !== undefined ? g.finalGrade : g.totalScore);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { avg: avg.toFixed(2), max: Math.max(...scores), min: Math.min(...scores) };
  };

  const handleViewConsolidated = () => {
    if (!selectedSubject || !selectedClass) {
      alert('Pilih Mata Pelajaran dan Kelas terlebih dahulu');
      return;
    }
    // Cukup ubah state view mode, useEffect akan otomatis memanggil konsolidator
    setViewMode('consolidated');
  };

  const exportConsolidatedToExcel = () => {
    const maxUH = Math.max(...consolidatedGrades.map(g => g.uh.length), 5);
    const headers = ['No', 'Nama Siswa'];
    for (let i = 1; i <= maxUH; i++) headers.push(`UH ${i}`);
    headers.push('Rata-rata UH', 'PTS/STS', 'PAS/ASAT', 'Nilai Rapor');

    const rows = consolidatedGrades.map((grade, idx) => {
      const row = [idx + 1, grade.studentName];
      for (let i = 0; i < maxUH; i++) row.push(grade.uh[i] !== undefined ? grade.uh[i] : '');
      row.push(grade.rataUH, grade.pts || '', grade.pas || '', grade.nilaiRapor);
      return row;
    });

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Daftar_Nilai_${selectedSubject}_${selectedClass}.csv`;
    link.click();
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Rekap Nilai</h1>
        <p className="mt-2 text-gray-600">Lihat rekapitulasi nilai siswa</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filter & Sorting</CardTitle>
            {selectedSubject && selectedClass && (
              <div className="flex gap-2">
                <Button variant={viewMode === 'list' ? 'default' : 'outline'} onClick={() => setViewMode('list')} size="sm">
                  Daftar Nilai Mentah
                </Button>
                <Button variant={viewMode === 'consolidated' ? 'default' : 'outline'} onClick={handleViewConsolidated} size="sm" className="bg-purple-600 hover:bg-purple-700 text-white border-0">
                  Tabel Kurikulum Merdeka
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Mata Pelajaran</label>
              <select className="w-full p-2 border rounded-md" value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setCurrentPage(1); }}>
                <option value="">Semua</option>
                {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Kelas</label>
              <select className="w-full p-2 border rounded-md" value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setCurrentPage(1); }}>
                <option value="">Semua</option>
                {classes.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Semester</label>
              <select className="w-full p-2 border rounded-md" value={selectedSemester} onChange={(e) => { setSelectedSemester(e.target.value ? Number(e.target.value) : ''); setCurrentPage(1); }}>
                <option value="">Semua</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Urutkan Berdasarkan</label>
              <select className="w-full p-2 border rounded-md" value={sortBy} onChange={(e) => { setSortBy(e.target.value as 'created_at' | 'exam_name'); setCurrentPage(1); }}>
                <option value="created_at">Tanggal</option>
                <option value="exam_name">Nama Ujian</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Urutan</label>
              <select className="w-full p-2 border rounded-md" value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as 'asc' | 'desc'); setCurrentPage(1); }}>
                <option value="desc">Terbaru</option>
                <option value="asc">Terlama</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === 'consolidated' && consolidatedGrades.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daftar Nilai Siswa - Kurikulum Merdeka</CardTitle>
                <CardDescription>{selectedSubject} - Kelas {selectedClass}</CardDescription>
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
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Rumus Perhitungan Otomatis:</h4>
              <div className="space-y-1 text-sm text-blue-800">
                <p><strong>Nilai Rapor (NA):</strong> Dihitung rata-rata secara proporsional berdasarkan ujian yang <span className="font-bold underline">sudah dilaksanakan</span> saja.</p>
                <p className="text-xs mt-2 text-blue-700 bg-blue-100/50 inline-block px-2 py-1 rounded">Bobot Sistem: Formatif/UH (1.0) + Sumatif Tengah/STS (1.0) + Sumatif Akhir/ASAT (0.5)</p>
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
                    <TableHead className="text-white font-bold text-center border-r border-blue-400 bg-yellow-600">Rata UH</TableHead>
                    <TableHead className="text-white font-bold text-center border-r border-blue-400 bg-purple-600">PTS/STS</TableHead>
                    <TableHead className="text-white font-bold text-center border-r border-blue-400 bg-orange-600">PAS/ASAT</TableHead>
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
                              <span className={student.uh[i] >= 75 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{student.uh[i]}</span>
                            ) : (<span className="text-gray-400">-</span>)}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold bg-yellow-50 border-r">
                          <span className={student.rataUH >= 75 ? 'text-green-700' : 'text-red-700'}>{student.rataUH.toFixed(1)}</span>
                        </TableCell>
                        <TableCell className="text-center font-bold bg-purple-50 border-r">
                          {student.pts > 0 ? (
                            <span className={student.pts >= 75 ? 'text-green-700' : 'text-red-700'}>{student.pts}</span>
                          ) : (<span className="text-gray-400">-</span>)}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-orange-50 border-r">
                          {student.pas > 0 ? (
                            <span className={student.pas >= 75 ? 'text-green-700' : 'text-red-700'}>{student.pas}</span>
                          ) : (<span className="text-gray-400">-</span>)}
                        </TableCell>
                        <TableCell className="text-center font-bold text-lg bg-red-50">
                          <span className={student.nilaiRapor >= 75 ? 'text-green-700' : 'text-red-700'}>{student.nilaiRapor.toFixed(1)}</span>
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

      {viewMode === 'list' && (
        <div className="space-y-6">
          {loading ? (
            <Card><CardContent className="py-12 text-center"><p className="text-gray-500">Memuat data...</p></CardContent></Card>
          ) : grades.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><p className="text-gray-500">Belum ada riwayat data nilai tersimpan.</p></CardContent></Card>
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
                      </CardTitle>
                      <CardDescription>
                        {grade.subject} - {grade.class_name} - {grade.exam_title}<br />
                        Tersimpan: {formatTimestamp(grade.created_at)}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleExportCSV(grade)}><Download className="w-4 h-4 mr-2" /> Export CSV</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteGrade(grade.id)} disabled={loading}>Hapus</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div><p className="text-sm text-gray-600">Rata-rata</p><p className="text-2xl font-bold text-blue-600">{stats.avg}</p></div>
                    <div><p className="text-sm text-gray-600">Nilai Tertinggi</p><p className="text-2xl font-bold text-green-600">{stats.max}</p></div>
                    <div><p className="text-sm text-gray-600">Nilai Terendah</p><p className="text-2xl font-bold text-red-600">{stats.min}</p></div>
                  </div>
                  <div className="overflow-x-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50">
                          <TableHead className="font-semibold w-16 text-center">No</TableHead>
                          <TableHead className="font-semibold">Nama Siswa</TableHead>
                          <TableHead className="text-center font-semibold">Total Skor</TableHead>
                          <TableHead className="text-center font-semibold">Nilai Akhir</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grade.grades.map((g, idx) => (
                          <TableRow key={idx} className="hover:bg-gray-50">
                            <TableCell className="font-medium text-center">{idx + 1}</TableCell>
                            <TableCell className="font-semibold text-gray-700">{g.studentName}</TableCell>
                            <TableCell className="text-center font-medium text-blue-600">{g.totalScore}</TableCell>
                            <TableCell className="text-center">
                              <span className={`font-bold text-lg ${g.finalGrade !== undefined ? (g.finalGrade >= 75 ? 'text-green-600' : 'text-red-600') : 'text-gray-700'}`}>
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

      {manualModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
            <h2 className="text-xl font-bold mb-4 text-emerald-700">Input Manual Nilai Siswa</h2>
            <button className="absolute top-4 right-4 text-gray-400 hover:text-red-500" onClick={() => setManualModalOpen(false)}><X className="w-5 h-5"/></button>
            {manualError && <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm border border-red-200 rounded">{manualError}</div>}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Nama Lengkap Siswa</label>
                <input className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500" value={manualStudent} onChange={e => setManualStudent(e.target.value)} placeholder="Contoh: Budi Santoso" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Semester</label>
                <select className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white" value={manualSemester} onChange={e => setManualSemester(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">-- Pilih Semester --</option>
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Nilai Formatif / UH <span className="text-xs font-normal text-gray-500">(Pisahkan dengan koma jika lebih dari satu)</span></label>
                <input className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white" value={manualUH.join(',')} onChange={e => setManualUH(e.target.value.split(',').map(v => v.trim()))} placeholder="Contoh: 80, 85, 90" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">Sumatif Tengah (PTS/STS)</label>
                  <input className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white" type="number" value={manualPTS} onChange={e => setManualPTS(e.target.value)} placeholder="0 - 100" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">Sumatif Akhir (PAS/ASAT)</label>
                  <input className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white" type="number" value={manualPAS} onChange={e => setManualPAS(e.target.value)} placeholder="0 - 100" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold py-2.5 rounded-lg shadow-sm hover:from-emerald-700 hover:to-green-700 disabled:opacity-60 transition-all"
                disabled={manualLoading}
                onClick={async () => {
                  setManualError('');
                  if (!manualStudent.trim()) return setManualError('Nama siswa wajib diisi!');
                  if (!manualSemester) return setManualError('Semester wajib dipilih!');
                  
                  setManualLoading(true);
                  try {
                    if (!user) throw new Error('Sesi habis, silakan login ulang.');
                    
                    const q = query(collection(db, 'grades'), where('user_id', '==', user.uid), where('subject', '==', selectedSubject), where('class_name', '==', selectedClass), where('exam_name', '==', 'Manual Input'));
                    const snap = await getDocs(q);
                    
                    let docId = '';
                    let gradesArr = [];
                    if (!snap.empty) { docId = snap.docs[0].id; gradesArr = snap.docs[0].data().grades || []; }
                    
                    const idx = gradesArr.findIndex((g: any) => g.studentName === manualStudent.trim());
                    const newGrade = {
                      studentName: manualStudent.trim(), totalScore: 0, finalGrade: 0, manualInput: true,
                      uh: manualUH.filter(u => u && !isNaN(Number(u))).map(u => Number(u)),
                      pts: manualPTS ? Number(manualPTS) : 0, pas: manualPAS ? Number(manualPAS) : 0,
                      semester: manualSemester
                    };

                    const rataUH = newGrade.uh.length > 0 ? newGrade.uh.reduce((a, b) => a + b, 0) / newGrade.uh.length : 0;
                    let tWeight = 0; let tScore = 0;
                    if(rataUH > 0) { tScore += rataUH; tWeight += 1; }
                    if(newGrade.pts > 0) { tScore += newGrade.pts; tWeight += 1; }
                    if(newGrade.pas > 0) { tScore += (newGrade.pas / 2); tWeight += 0.5; }
                    
                    newGrade.finalGrade = tWeight > 0 ? Math.round((tScore / tWeight) * 100) / 100 : 0;
                    newGrade.totalScore = newGrade.finalGrade;
                    
                    if (idx >= 0) gradesArr[idx] = newGrade; else gradesArr.push(newGrade);
                    
                    if (docId) {
                      const { updateDoc } = await import('firebase/firestore');
                      await updateDoc(doc(db, 'grades', docId), { grades: gradesArr });
                    } else {
                      const { addDoc } = await import('firebase/firestore');
                      await addDoc(collection(db, 'grades'), {
                        user_id: user.uid, subject: selectedSubject, class_name: selectedClass, class_id: '',
                        exam_name: 'Manual Input', exam_title: 'Nilai Titipan Guru', grades: gradesArr,
                        created_at: new Date().toISOString(), is_finalized: false, semester: manualSemester
                      });
                    }
                    
                    setManualModalOpen(false); setManualStudent(''); setManualUH(['']); setManualPTS(''); setManualPAS('');
                    loadGrades();
                  } catch (err: any) {
                    setManualError(err.message);
                  } finally {
                    setManualLoading(false);
                  }
                }}
              >
                {manualLoading ? 'Menyimpan...' : 'Simpan Nilai'}
              </button>
              <button className="flex-1 border-2 border-gray-200 py-2.5 rounded-lg font-semibold text-gray-600 hover:bg-gray-50" onClick={() => setManualModalOpen(false)} disabled={manualLoading}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}