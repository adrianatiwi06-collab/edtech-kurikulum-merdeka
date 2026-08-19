'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Search,
  Download,
  Calendar,
  BookOpen,
  X,
  FileText,
  Users,
  UserCheck,
  UserX,
  Clock3,
  Activity,
} from 'lucide-react';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
} from 'recharts';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Class {
  id: string;
  name: string;
}

type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alfa';

interface AttendanceDetail {
  studentId: string;
  studentName: string;
  studentNisn?: string;
  status: AttendanceStatus | string;
}

interface AttendanceDocument {
  id: string;
  user_id?: string;
  tanggal?: string;
  class_id?: string;
  class_name?: string;
  detail_absensi?: AttendanceDetail[];
  rekap_absensi?: {
    hadir?: number;
    sakit?: number;
    izin?: number;
    alfa?: number;
  };
}

interface AbsenceRecord {
  tanggal: string;
  status: AttendanceStatus | string;
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

interface TrendItem {
  tanggal: string;
  Hadir: number;
  TidakHadir: number;
}

const COLORS = ['#16a34a', '#eab308', '#2563eb', '#dc2626'];

const normalizeStatus = (value: unknown): AttendanceStatus | null => {
  const status = String(value ?? '').trim().toLowerCase();

  if (status === 'hadir') return 'Hadir';
  if (status === 'sakit') return 'Sakit';
  if (status === 'izin') return 'Izin';
  if (status === 'alfa' || status === 'alpha') return 'Alfa';

  return null;
};

const formatDate = (value: string) => {
  if (!value) return '-';

  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
};

export default function RekapKehadiranPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const [classes, setClasses] = useState<Class[]>([]);
  const [studentData, setStudentData] = useState<StudentStat[]>([]);

  const [pieData, setPieData] = useState<{ name: string; value: number }[]>(
    []
  );
  const [barData, setBarData] = useState<
    { name: string; Jumlah: number }[]
  >([]);
  const [trendData, setTrendData] = useState<TrendItem[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] =
    useState<StudentStat | null>(null);

  const today = new Date();

  const firstDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  )
    .toLocaleDateString('en-CA');

  const lastDay = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  )
    .toLocaleDateString('en-CA');

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    if (user) {
      loadClasses();
    }
  }, [user]);

  const loadClasses = async () => {
    if (!user) return;

    setLoadingClasses(true);

    try {
      const q = query(
        collection(db, 'classes'),
        where('user_id', '==', user.uid)
      );

      const querySnapshot = await getDocs(q);

      const classesData: Class[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        classesData.push({
          id: doc.id,
          name: String(data.name ?? data.nama ?? ''),
        });
      });

      classesData.sort((a, b) =>
        a.name.localeCompare(b.name, 'id', {
          numeric: true,
          sensitivity: 'base',
        })
      );

      setClasses(classesData);
    } catch (error) {
      console.error('Gagal memuat kelas:', error);
      alert('Gagal memuat daftar kelas.');
    } finally {
      setLoadingClasses(false);
    }
  };

  const handleSearch = async () => {
    if (!user) {
      alert('Sesi pengguna belum tersedia.');
      return;
    }

    if (!startDate || !endDate) {
      alert('Mohon isi rentang tanggal terlebih dahulu.');
      return;
    }

    if (startDate > endDate) {
      alert('Tanggal mulai tidak boleh lebih besar dari tanggal selesai.');
      return;
    }

    setLoading(true);

    try {
      /*
       * SUMBER DATA REKAP:
       * Sekarang membaca collection `absensi`, bukan `jurnal_mengajar`.
       *
       * Struktur dokumen absensi:
       * - user_id
       * - tanggal
       * - class_id
       * - class_name
       * - detail_absensi[]
       * - rekap_absensi
       *
       * Mata pelajaran dan jam pelajaran tidak digunakan.
       */
      const q = query(
        collection(db, 'absensi'),
        where('user_id', '==', user.uid)
      );

      const querySnapshot = await getDocs(q);

      const stats: Record<string, StudentStat> = {};

      let tHadir = 0;
      let tSakit = 0;
      let tIzin = 0;
      let tAlfa = 0;

      const trendMap: Record<
        string,
        { tanggal: string; Hadir: number; TidakHadir: number }
      > = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<AttendanceDocument, 'id'>;

        const tanggal = String(data.tanggal ?? '');
        const classId = String(data.class_id ?? '');

        if (!tanggal) return;

        if (tanggal < startDate || tanggal > endDate) {
          return;
        }

        if (selectedClass && classId !== selectedClass) {
          return;
        }

        const details = Array.isArray(data.detail_absensi)
          ? data.detail_absensi
          : [];

        if (!trendMap[tanggal]) {
          trendMap[tanggal] = {
            tanggal,
            Hadir: 0,
            TidakHadir: 0,
          };
        }

        details.forEach((record) => {
          const status = normalizeStatus(record.status);

          if (!status) return;

          const studentId = String(record.studentId ?? '');

          if (!studentId) return;

          if (!stats[studentId]) {
            stats[studentId] = {
              id: studentId,
              nis: String(record.studentNisn ?? '---'),
              name: String(record.studentName ?? 'Tanpa Nama'),
              className: String(data.class_name ?? ''),
              hadir: 0,
              sakit: 0,
              izin: 0,
              alfa: 0,
              total: 0,
              history: [],
            };
          }

          /*
           * Jika NIS/NISN tersedia pada dokumen absensi,
           * gunakan nilainya.
           */
          if (
            record.studentNisn &&
            String(record.studentNisn).trim() !== ''
          ) {
            stats[studentId].nis = String(record.studentNisn);
          }

          if (status === 'Hadir') {
            stats[studentId].hadir++;
            tHadir++;
            trendMap[tanggal].Hadir++;
          }

          if (status === 'Sakit') {
            stats[studentId].sakit++;
            tSakit++;
            trendMap[tanggal].TidakHadir++;

            stats[studentId].history.push({
              tanggal,
              status,
            });
          }

          if (status === 'Izin') {
            stats[studentId].izin++;
            tIzin++;
            trendMap[tanggal].TidakHadir++;

            stats[studentId].history.push({
              tanggal,
              status,
            });
          }

          if (status === 'Alfa') {
            stats[studentId].alfa++;
            tAlfa++;
            trendMap[tanggal].TidakHadir++;

            stats[studentId].history.push({
              tanggal,
              status,
            });
          }

          stats[studentId].total++;
        });
      });

      const finalData = Object.values(stats).sort((a, b) =>
        a.name.localeCompare(b.name, 'id')
      );

      setStudentData(finalData);

      setPieData([
        { name: 'Hadir', value: tHadir },
        { name: 'Sakit', value: tSakit },
        { name: 'Izin', value: tIzin },
        { name: 'Alfa', value: tAlfa },
      ]);

      setBarData([
        { name: 'Sakit', Jumlah: tSakit },
        { name: 'Izin', Jumlah: tIzin },
        { name: 'Alfa', Jumlah: tAlfa },
      ]);

      const sortedTrend = Object.values(trendMap).sort(
        (a, b) =>
          new Date(a.tanggal).getTime() -
          new Date(b.tanggal).getTime()
      );

      setTrendData(
        sortedTrend.map((item) => ({
          ...item,
          tanggal: formatDate(item.tanggal),
        }))
      );
    } catch (error: any) {
      console.error('Gagal memuat rekap absensi:', error);

      const message =
        error?.code === 'permission-denied'
          ? 'Akses Firestore ditolak. Periksa Firestore Rules untuk collection absensi.'
          : 'Gagal memuat data rekapitulasi dari collection absensi.';

      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (student: StudentStat) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  const exportToExcel = () => {
    if (studentData.length === 0) {
      alert('Tidak ada data untuk diexport!');
      return;
    }

    const exportData = studentData.map((student, index) => {
      const percentage =
        student.total > 0
          ? ((student.hadir / student.total) * 100).toFixed(1)
          : '0.0';

      return {
        No: index + 1,
        NIS: student.nis,
        'Nama Lengkap': student.name,
        Kelas: student.className,
        Hadir: student.hadir,
        Sakit: student.sakit,
        Izin: student.izin,
        Alfa: student.alfa,
        'Persentase Kehadiran': `${percentage}%`,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Rekap Kehadiran'
    );

    XLSX.writeFile(
      workbook,
      `Rekap_Kehadiran_${startDate}_sd_${endDate}.xlsx`
    );
  };

  const exportToPDF = () => {
    if (studentData.length === 0) {
      alert('Tidak ada data untuk diexport!');
      return;
    }

    const doc = new jsPDF('landscape');

    doc.setFontSize(16);
    doc.text(
      'Laporan Rekapitulasi Kehadiran Siswa',
      14,
      15
    );

    doc.setFontSize(10);
    doc.text(
      `Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`,
      14,
      22
    );

    if (selectedClass) {
      const selectedClassName =
        classes.find((item) => item.id === selectedClass)?.name ||
        '-';

      doc.text(`Kelas: ${selectedClassName}`, 14, 28);
    } else {
      doc.text('Kelas: Semua Kelas', 14, 28);
    }

    const tableData = studentData.map((student, index) => {
      const percentage =
        student.total > 0
          ? ((student.hadir / student.total) * 100).toFixed(1)
          : '0.0';

      return [
        index + 1,
        student.nis,
        student.name,
        student.className,
        student.hadir,
        student.sakit,
        student.izin,
        student.alfa,
        `${percentage}%`,
      ];
    });

    autoTable(doc, {
      startY: 34,
      head: [
        [
          'No',
          'NIS/NISN',
          'Nama Siswa',
          'Kelas',
          'Hadir',
          'Sakit',
          'Izin',
          'Alfa',
          '%',
        ],
      ],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [37, 99, 235],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 65 },
        3: { cellWidth: 25 },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 18, halign: 'center' },
        8: { cellWidth: 18, halign: 'center' },
      },
    });

    doc.save(
      `Rekap_Kehadiran_${startDate}_sd_${endDate}.pdf`
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 pb-10 pt-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-700 p-6 text-white shadow-[0_18px_50px_rgba(79,70,229,0.20)] md:p-8">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                <Activity className="h-3.5 w-3.5" />
                Monitoring Kehadiran
              </div>

              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Rekap Kehadiran
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100 md:text-base">
                Analisis kehadiran siswa berdasarkan data pada menu
                Absensi.
              </p>
            </div>

            <div className="hidden rounded-[28px] bg-white/10 p-5 backdrop-blur md:block">
              <Users className="h-12 w-12" />
            </div>
          </div>
        </section>

        {/* FILTER */}
        <Card className="rounded-[28px] border-0 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.07)]">
          <CardContent className="p-5 md:p-6">
            <div className="grid grid-cols-1 items-end gap-5 md:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Tanggal Mulai
                </label>

                <div className="relative">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) =>
                      setStartDate(event.target.value)
                    }
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10"
                  />
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Tanggal Selesai
                </label>

                <div className="relative">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(event) =>
                      setEndDate(event.target.value)
                    }
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10"
                  />
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Kelas
                </label>

                <div className="relative">
                  <select
                    disabled={loadingClasses}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    value={selectedClass}
                    onChange={(event) =>
                      setSelectedClass(event.target.value)
                    }
                  >
                    <option value="">
                      {loadingClasses
                        ? 'Memuat kelas...'
                        : 'Semua Kelas'}
                    </option>

                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <BookOpen className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div>
                <Button
                  onClick={handleSearch}
                  disabled={loading || !user}
                  className="h-11 w-full rounded-2xl bg-blue-600 font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}

                  {loading
                    ? 'Memuat Data...'
                    : 'Tampilkan Data'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* STATISTIK RINGKAS */}
        {studentData.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card className="rounded-[24px] border-0 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div className="text-2xl font-bold text-slate-800">
                  {pieData[0]?.value ?? 0}
                </div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Hadir
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-0 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div className="text-2xl font-bold text-slate-800">
                  {pieData[1]?.value ?? 0}
                </div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Sakit
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-0 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="text-2xl font-bold text-slate-800">
                  {pieData[2]?.value ?? 0}
                </div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Izin
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-0 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                  <UserX className="h-5 w-5" />
                </div>
                <div className="text-2xl font-bold text-slate-800">
                  {pieData[3]?.value ?? 0}
                </div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Alfa
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CHARTS */}
        {studentData.length > 0 && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="rounded-[28px] border-0 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
              <CardHeader className="pb-2 text-center">
                <CardTitle className="text-sm font-bold text-slate-700">
                  Distribusi Kehadiran
                </CardTitle>
              </CardHeader>

              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="48%"
                      innerRadius={55}
                      outerRadius={78}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>

                    <RechartsTooltip
                      formatter={(value: any) => [
                        `${value} Data`,
                        'Jumlah',
                      ]}
                    />

                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-0 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
              <CardHeader className="pb-2 text-center">
                <CardTitle className="text-sm font-bold text-slate-700">
                  Tren Kehadiran Harian
                </CardTitle>
              </CardHeader>

              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{
                      top: 10,
                      right: 10,
                      left: -20,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />

                    <XAxis
                      dataKey="tanggal"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />

                    <RechartsTooltip />

                    <Legend
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '12px' }}
                    />

                    <Line
                      type="monotone"
                      dataKey="Hadir"
                      stroke="#16a34a"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />

                    <Line
                      type="monotone"
                      dataKey="TidakHadir"
                      stroke="#dc2626"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Tidak Hadir"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-0 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
              <CardHeader className="pb-2 text-center">
                <CardTitle className="text-sm font-bold text-slate-700">
                  Alasan Ketidakhadiran
                </CardTitle>
              </CardHeader>

              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barData}
                    margin={{
                      top: 10,
                      right: 10,
                      left: -20,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />

                    <XAxis
                      dataKey="name"
                      tick={{
                        fontSize: 12,
                        fontWeight: 'bold',
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />

                    <RechartsTooltip
                      cursor={{ fill: '#f1f5f9' }}
                    />

                    <Bar
                      dataKey="Jumlah"
                      fill="#2563eb"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TABLE */}
        <Card className="overflow-hidden rounded-[28px] border-0 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.07)]">
          <CardHeader className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg text-slate-800">
                Detail Rekap Kehadiran
              </CardTitle>

              <p className="mt-1 text-sm text-slate-500">
                Klik detail untuk melihat riwayat ketidakhadiran siswa.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={exportToExcel}
                variant="outline"
                size="sm"
                className="rounded-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>

              <Button
                onClick={exportToPDF}
                variant="outline"
                size="sm"
                className="rounded-full border-rose-300 text-rose-700 hover:bg-rose-50"
              >
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="w-28 text-center text-xs font-bold text-slate-500">
                      NIS/NISN
                    </TableHead>

                    <TableHead className="text-xs font-bold text-slate-500">
                      NAMA
                    </TableHead>

                    <TableHead className="text-xs font-bold text-slate-500">
                      KELAS
                    </TableHead>

                    <TableHead className="text-center text-xs font-bold text-slate-500">
                      HADIR
                    </TableHead>

                    <TableHead className="text-center text-xs font-bold text-slate-500">
                      SAKIT
                    </TableHead>

                    <TableHead className="text-center text-xs font-bold text-slate-500">
                      IZIN
                    </TableHead>

                    <TableHead className="text-center text-xs font-bold text-slate-500">
                      ALFA
                    </TableHead>

                    <TableHead className="text-center text-xs font-bold text-slate-500">
                      PERSENTASE
                    </TableHead>

                    <TableHead className="text-center text-xs font-bold text-slate-500">
                      DETAIL
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {studentData.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="h-40 text-center text-slate-400"
                      >
                        <div className="flex flex-col items-center justify-center">
                          <Users className="mb-3 h-10 w-10 text-slate-200" />

                          <p className="font-semibold text-slate-500">
                            Belum ada data rekap
                          </p>

                          <p className="mt-1 text-sm">
                            Pilih rentang tanggal lalu tekan{' '}
                            <b>Tampilkan Data</b>.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    studentData.map((student) => {
                      const percentage =
                        student.total > 0
                          ? (
                              (student.hadir /
                                student.total) *
                              100
                            ).toFixed(1)
                          : '0.0';

                      return (
                        <TableRow
                          key={student.id}
                          className="transition-colors hover:bg-slate-50/80"
                        >
                          <TableCell className="text-center text-sm text-slate-500">
                            {student.nis}
                          </TableCell>

                          <TableCell className="text-sm font-semibold uppercase text-slate-700">
                            {student.name}
                          </TableCell>

                          <TableCell className="text-sm text-slate-600">
                            Kelas {student.className}
                          </TableCell>

                          <TableCell className="text-center font-semibold text-emerald-700">
                            {student.hadir}
                          </TableCell>

                          <TableCell className="text-center font-semibold text-amber-700">
                            {student.sakit}
                          </TableCell>

                          <TableCell className="text-center font-semibold text-blue-700">
                            {student.izin}
                          </TableCell>

                          <TableCell className="text-center font-semibold text-rose-700">
                            {student.alfa}
                          </TableCell>

                          <TableCell className="text-center">
                            <span
                              className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold ${
                                Number(percentage) >= 80
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {percentage}%
                            </span>
                          </TableCell>

                          <TableCell className="text-center">
                            <button
                              type="button"
                              onClick={() =>
                                openModal(student)
                              }
                              className="rounded-full bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
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

        {/* DETAIL MODAL */}
        {isModalOpen && selectedStudent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeModal();
              }
            }}
          >
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/70 p-6">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                    <UserCheck className="h-3.5 w-3.5" />
                    Detail Kehadiran
                  </div>

                  <h2 className="text-xl font-extrabold uppercase tracking-tight text-slate-800">
                    {selectedStudent.name}
                  </h2>

                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Kelas {selectedStudent.className}
                    {' · '}
                    {selectedStudent.nis}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-white p-6">
                <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600">
                      {selectedStudent.hadir}
                    </div>
                    <div className="mt-1 text-xs font-semibold uppercase text-emerald-700">
                      Hadir
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center">
                    <div className="text-2xl font-bold text-amber-600">
                      {selectedStudent.sakit}
                    </div>
                    <div className="mt-1 text-xs font-semibold uppercase text-amber-700">
                      Sakit
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedStudent.izin}
                    </div>
                    <div className="mt-1 text-xs font-semibold uppercase text-blue-700">
                      Izin
                    </div>
                  </div>

                  <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center">
                    <div className="text-2xl font-bold text-rose-600">
                      {selectedStudent.alfa}
                    </div>
                    <div className="mt-1 text-xs font-semibold uppercase text-rose-700">
                      Alfa
                    </div>
                  </div>
                </div>

                <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-800">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Daftar Ketidakhadiran
                </h3>

                {selectedStudent.history.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <div className="mb-3 text-4xl">🌟</div>

                    <p className="font-medium text-slate-600">
                      Luar biasa! Siswa ini tidak pernah
                      tidak hadir pada rentang waktu yang
                      dipilih.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold text-slate-600">
                            Tanggal
                          </TableHead>

                          <TableHead className="font-semibold text-slate-600">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {selectedStudent.history.map(
                          (record, index) => {
                            const status = normalizeStatus(
                              record.status
                            );

                            return (
                              <TableRow
                                key={`${record.tanggal}-${index}`}
                                className="hover:bg-slate-50/50"
                              >
                                <TableCell className="font-medium text-slate-700">
                                  {formatDate(record.tanggal)}
                                </TableCell>

                                <TableCell>
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                                      status === 'Sakit'
                                        ? 'bg-amber-100 text-amber-800'
                                        : status === 'Izin'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {status ??
                                      record.status}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          }
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}