'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Download, Calendar, BookOpen, X, FileText } from 'lucide-react';

// Import Recharts untuk Grafik
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend, CartesianGrid } from 'recharts';

// Import Library Export
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Class {
  id: string;
  name: string;
}

interface AbsenceRecord {
  tanggal: string;
  mapel: string;
  status: string;
}

interface StudentStat {
  id: string;
  nis: string;
  name: string;
  className: string;
  hadir: number;
  sakit: number;
  izin: number;
  alfa: number;
  total: number;
  history: AbsenceRecord[];
}

const COLORS = ['#22c55e', '#eab308', '#3b82f6', '#ef4444'];

export default function RekapKehadiranPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [studentData, setStudentData] = useState<StudentStat[]>([]);

  const [pieData, setPieData] = useState<any[]>([]);
  const [barData, setBarData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentStat | null>(null);

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    if (user) {
      loadClasses();
    }
  }, [user]);

  const loadClasses = async () => {
    try {
      const q = query(collection(db, 'classes'), where('user_id', '==', user?.uid));
      const querySnapshot = await getDocs(q);
      const classesData: Class[] = [];
      querySnapshot.forEach((doc) => classesData.push({ id: doc.id, ...doc.data() } as Class));
      setClasses(classesData);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert("Mohon isi rentang tanggal terlebih dahulu!");
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'jurnal_mengajar'), where('user_id', '==', user?.uid));
      const querySnapshot = await getDocs(q);
      
      const stats: Record<string, StudentStat> = {};
      
      let tHadir = 0, tSakit = 0, tIzin = 0, tAlfa = 0;
      const trendMap: Record<string, { tanggal: string, Hadir: number, TidakHadir: number }> = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        if (data.tanggal >= startDate && data.tanggal <= endDate) {
          if (!selectedClass || data.class_id === selectedClass) {
            
            if (!trendMap[data.tanggal]) {
              trendMap[data.tanggal] = { tanggal: data.tanggal, Hadir: 0, TidakHadir: 0 };
            }

            if (data.detail_absensi && Array.isArray(data.detail_absensi)) {
              data.detail_absensi.forEach((record: any) => {
                if (!stats[record.studentId]) {
                  stats[record.studentId] = {
                    id: record.studentId,
                    nis: '---',
                    name: record.studentName,
                    className: data.class_name,
                    hadir: 0, sakit: 0, izin: 0, alfa: 0, total: 0,
                    history: []
                  };
                }

                const status = record.status.toLowerCase();
                if (status === 'hadir') {
                  stats[record.studentId].hadir++;
                  tHadir++;
                  trendMap[data.tanggal].Hadir++;
                } else {
                  if (status === 'sakit') { stats[record.studentId].sakit++; tSakit++; }
                  if (status === 'izin') { stats[record.studentId].izin++; tIzin++; }
                  if (status === 'alfa') { stats[record.studentId].alfa++; tAlfa++; }
                  
                  trendMap[data.tanggal].TidakHadir++;
                  stats[record.studentId].history.push({
                    tanggal: data.tanggal,
                    mapel: data.mata_pelajaran,
                    status: record.status
                  });
                }
                stats[record.studentId].total++;
              });
            }
          }
        }
      });

      const finalData = Object.values(stats).sort((a, b) => a.name.localeCompare(b.name, 'id'));
      setStudentData(finalData);

      setPieData([
        { name: 'Hadir', value: tHadir },
        { name: 'Sakit', value: tSakit },
        { name: 'Izin', value: tIzin },
        { name: 'Alfa', value: tAlfa },
      ]);

      setBarData([
        { name: 'Sakit', Jumlah: tSakit, fill: '#eab308' },
        { name: 'Izin', Jumlah: tIzin, fill: '#3b82f6' },
        { name: 'Alfa', Jumlah: tAlfa, fill: '#ef4444' },
      ]);

      const sortedTrend = Object.values(trendMap).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
      const formattedTrend = sortedTrend.map(t => {
        const d = new Date(t.tanggal);
        return { ...t, tanggal: `${d.getDate()}/${d.getMonth()+1}` };
      });
      setTrendData(formattedTrend);

    } catch (error) {
      console.error("Gagal memuat rekap:", error);
      alert("Gagal memuat data rekapitulasi.");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (student: StudentStat) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  // --- FUNGSI EXPORT EXCEL ---
  const exportToExcel = () => {
    if (studentData.length === 0) {
      alert("Tidak ada data untuk diexport!");
      return;
    }

    const exportData = studentData.map((s, idx) => {
      const percentage = s.total > 0 ? ((s.hadir / s.total) * 100).toFixed(1) : '0.0';
      return {
        'No': idx + 1,
        'NIS': s.nis,
        'Nama Lengkap': s.name,
        'Kelas': s.className,
        'Hadir': s.hadir,
        'Sakit': s.sakit,
        'Izin': s.izin,
        'Alfa': s.alfa,
        'Persentase Kehadiran': `${percentage}%`
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Kehadiran");
    XLSX.writeFile(workbook, `Rekap_Kehadiran_${startDate}_sd_${endDate}.xlsx`);
  };

  // --- FUNGSI EXPORT PDF ---
  const exportToPDF = () => {
    if (studentData.length === 0) {
      alert("Tidak ada data untuk diexport!");
      return;
    }

    const doc = new jsPDF('portrait');
    
    doc.setFontSize(16);
    doc.text('Laporan Rekapitulasi Kehadiran Siswa', 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 22);

    const tableData = studentData.map((s, idx) => {
      const percentage = s.total > 0 ? ((s.hadir / s.total) * 100).toFixed(1) : '0.0';
      return [
        idx + 1,
        s.nis,
        s.name,
        s.className,
        s.hadir,
        s.sakit,
        s.izin,
        s.alfa,
        `${percentage}%`
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Hadir', 'Sakit', 'Izin', 'Alfa', '%']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' }, // No
        1: { cellWidth: 15, halign: 'center' }, // NIS
        2: { cellWidth: 55 }, // Nama
        3: { cellWidth: 25 }, // Kelas
        4: { cellWidth: 15, halign: 'center' }, // H
        5: { cellWidth: 15, halign: 'center' }, // S
        6: { cellWidth: 15, halign: 'center' }, // I
        7: { cellWidth: 15, halign: 'center' }, // A
        8: { cellWidth: 15, halign: 'center' }, // %
      }
    });

    doc.save(`Rekap_Kehadiran_${startDate}_sd_${endDate}.pdf`);
  };

  return (
    <div className="container mx-auto pb-10 px-4 pt-6 animate-in fade-in duration-300 bg-slate-50 min-h-screen relative">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Rekap Kehadiran</h1>
        <p className="mt-2 text-slate-600">Pantau akumulasi kehadiran siswa berdasarkan rentang tanggal tertentu.</p>
      </div>

      <Card className="mb-6 border-slate-200 shadow-sm bg-white">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-700">Tanggal Mulai</label>
              <div className="relative">
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="pl-10" />
                <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-700">Tanggal Selesai</label>
              <div className="relative">
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="pl-10" />
                <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-700">Kelas (Opsional)</label>
              <div className="relative">
                <select 
                  className="w-full border border-slate-300 rounded-md pl-10 pr-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 text-sm h-10"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="">Semua Kelas</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <BookOpen className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              </div>
            </div>
            <div>
              <Button onClick={handleSearch} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 shadow-sm">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Tampilkan Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {studentData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-sm font-bold text-slate-700">Persentase Kehadiran</CardTitle>
            </CardHeader>
            <CardContent className="h-60 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                 <RechartsTooltip formatter={(value: number | string | undefined) => [`${value} Anak`, 'Total']} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-sm font-bold text-slate-700">Tren Kehadiran Harian</CardTitle>
            </CardHeader>
            <CardContent className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="Hadir" stroke="#22c55e" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="TidakHadir" stroke="#ef4444" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Tidak Hadir" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-sm font-bold text-slate-700">Alasan Ketidakhadiran</CardTitle>
            </CardHeader>
            <CardContent className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RechartsTooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="Jumlah" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
          <CardTitle className="text-slate-800 text-lg">Detail Rekap Kehadiran</CardTitle>
          <div className="flex gap-2">
            <Button onClick={exportToExcel} variant="outline" size="sm" className="border-green-500 text-green-700 hover:bg-green-50">
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button onClick={exportToPDF} variant="outline" size="sm" className="border-red-500 text-red-700 hover:bg-red-50">
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-16 text-center text-xs font-bold text-slate-500">NIS</TableHead>
                  <TableHead className="text-xs font-bold text-slate-500">NAMA</TableHead>
                  <TableHead className="text-xs font-bold text-slate-500">KELAS</TableHead>
                  <TableHead className="text-center text-xs font-bold text-slate-500">HADIR</TableHead>
                  <TableHead className="text-center text-xs font-bold text-slate-500">SAKIT</TableHead>
                  <TableHead className="text-center text-xs font-bold text-slate-500">IZIN</TableHead>
                  <TableHead className="text-center text-xs font-bold text-slate-500">ALPHA</TableHead>
                  <TableHead className="text-center text-xs font-bold text-slate-500">PERSENTASE</TableHead>
                  <TableHead className="text-center text-xs font-bold text-slate-500">DETAIL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-slate-500">
                      Silakan tekan tombol <b>Tampilkan Data</b> untuk melihat rekapitulasi.
                    </TableCell>
                  </TableRow>
                ) : (
                  studentData.map((student) => {
                    const percentage = student.total > 0 ? ((student.hadir / student.total) * 100).toFixed(1) : '0.0';
                    return (
                      <TableRow key={student.id} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="text-center text-slate-500">{student.nis}</TableCell>
                        <TableCell className="font-semibold text-slate-700 uppercase text-sm">{student.name}</TableCell>
                        <TableCell className="text-slate-600 text-sm">Kelas {student.className}</TableCell>
                        <TableCell className="text-center font-medium text-slate-700">{student.hadir}</TableCell>
                        <TableCell className="text-center font-medium text-slate-700">{student.sakit}</TableCell>
                        <TableCell className="text-center font-medium text-slate-700">{student.izin}</TableCell>
                        <TableCell className="text-center font-medium text-slate-700">{student.alfa}</TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            Number(percentage) >= 80 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {percentage}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <button 
                            onClick={() => openModal(student)}
                            className="text-blue-600 font-semibold text-xs hover:text-blue-800 hover:underline bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
                          >
                            Detail
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">{selectedStudent.name}</h2>
                <p className="text-sm font-medium text-slate-500 mt-1">Laporan Kehadiran Siswa • Kelas {selectedStudent.className}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 p-2 rounded-full transition-colors shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-white flex-1">
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center shadow-sm">
                  <div className="text-2xl font-bold text-green-600">{selectedStudent.hadir}</div>
                  <div className="text-xs font-semibold text-green-700 uppercase mt-1">Hadir</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-center shadow-sm">
                  <div className="text-2xl font-bold text-yellow-600">{selectedStudent.sakit}</div>
                  <div className="text-xs font-semibold text-yellow-700 uppercase mt-1">Sakit</div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">{selectedStudent.izin}</div>
                  <div className="text-xs font-semibold text-blue-700 uppercase mt-1">Izin</div>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center shadow-sm">
                  <div className="text-2xl font-bold text-red-600">{selectedStudent.alfa}</div>
                  <div className="text-xs font-semibold text-red-700 uppercase mt-1">Alpha</div>
                </div>
              </div>

              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Daftar Ketidakhadiran
              </h3>
              
              {selectedStudent.history.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                  <div className="text-4xl mb-3">🌟</div>
                  <p className="text-slate-600 font-medium">Luar biasa! Siswa ini tidak pernah absen<br/>pada rentang waktu yang dipilih.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-semibold text-slate-600">Tanggal</TableHead>
                        <TableHead className="font-semibold text-slate-600">Mata Pelajaran</TableHead>
                        <TableHead className="font-semibold text-slate-600">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedStudent.history.map((record, index) => (
                        <TableRow key={index} className="hover:bg-slate-50/50">
                          <TableCell className="font-medium text-slate-700">{record.tanggal}</TableCell>
                          <TableCell className="text-slate-600">{record.mapel}</TableCell>
                          <TableCell>
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${
                              record.status.toLowerCase() === 'sakit' ? 'bg-yellow-100 text-yellow-800' :
                              record.status.toLowerCase() === 'izin' ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {record.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}