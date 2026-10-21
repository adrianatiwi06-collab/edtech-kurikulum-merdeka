'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { addDoc, collection, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Check, CheckCircle2, Loader2, Save, Users, UserCheck } from 'lucide-react';

interface Class { id: string; name: string; }
interface Student { id: string; name: string; nisn?: string; nis?: string; }
type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alfa';
interface AttendanceRecord {
  studentId: string;
  studentName: string;
  studentNisn: string;
  status: AttendanceStatus;
}

const statusStyles: Record<AttendanceStatus, string> = {
  Hadir: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  Izin: 'border-blue-300 bg-blue-50 text-blue-700',
  Sakit: 'border-amber-300 bg-amber-50 text-amber-700',
  Alfa: 'border-rose-300 bg-rose-50 text-rose-700',
};

export default function AbsensiPage() {
  const { user } = useAuth();

  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('');
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [savedAt, setSavedAt] = useState('');

  useEffect(() => {
    if (user) loadClasses();
  }, [user]);

  useEffect(() => {
    if (selectedClass) {
      loadStudents(selectedClass);
      checkExistingAttendance(selectedClass, tanggal);
    } else {
      setStudents([]);
      setAttendance([]);
      setAlreadySaved(false);
      setSavedAt('');
    }
  }, [selectedClass, tanggal]);

  const loadClasses = async () => {
    if (!user) return;
    setLoadingClasses(true);
    try {
      const q = query(collection(db, 'classes'), where('user_id', '==', user.uid));
      const snapshot = await getDocs(q);
      const data: Class[] = [];
      snapshot.forEach((item) => data.push({ id: item.id, ...item.data() } as Class));
      data.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      setClasses(data);
    } catch (error) {
      console.error(error);
      alert('Gagal memuat daftar kelas.');
    } finally {
      setLoadingClasses(false);
    }
  };

  const loadStudents = async (classId: string) => {
    setLoadingStudents(true);
    try {
      const snapshot = await getDocs(collection(db, 'classes', classId, 'students'));
      const data: Student[] = [];
      snapshot.forEach((item) => data.push({ id: item.id, ...item.data() } as Student));
      data.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      setStudents(data);
      setAttendance(data.map((student) => ({
        studentId: student.id,
        studentName: student.name,
        studentNisn: student.nisn || student.nis || '',
        status: 'Hadir',
      })));
    } catch (error) {
      console.error(error);
      alert('Gagal memuat daftar siswa.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const checkExistingAttendance = async (classId: string, date: string) => {
    if (!user || !classId || !date) return;

    setCheckingExisting(true);
    try {
      // Satu dokumen absensi = satu kelas + satu tanggal.
      // Tidak ada lagi pembeda berdasarkan mata pelajaran/jam.
      const q = query(
        collection(db, 'absensi'),
        where('user_id', '==', user.uid),
        where('tanggal', '==', date),
        where('class_id', '==', classId)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const existing = snapshot.docs[0].data();
        const details = Array.isArray(existing.detail_absensi)
          ? existing.detail_absensi as AttendanceRecord[]
          : [];

        setAttendance(details);
        setAlreadySaved(true);
        setSavedAt(existing.updated_at || existing.created_at || '');
      } else {
        setAlreadySaved(false);
        setSavedAt('');
      }
    } catch (error) {
      console.error(error);
      alert('Gagal mengecek status absensi hari ini.');
    } finally {
      setCheckingExisting(false);
    }
  };

  const updateAttendance = (studentId: string, status: AttendanceStatus) => {
    if (alreadySaved) return;

    setAttendance((prev) =>
      prev.map((record) =>
        record.studentId === studentId ? { ...record, status } : record
      )
    );
  };

  const setAllStatus = (status: AttendanceStatus) => {
    if (alreadySaved) return;
    setAttendance((prev) => prev.map((record) => ({ ...record, status })));
  };

  const summary = useMemo(() => ({
    hadir: attendance.filter((x) => x.status === 'Hadir').length,
    izin: attendance.filter((x) => x.status === 'Izin').length,
    sakit: attendance.filter((x) => x.status === 'Sakit').length,
    alfa: attendance.filter((x) => x.status === 'Alfa').length,
  }), [attendance]);

  const handleSave = async () => {
    if (!user) return alert('Sesi pengguna belum tersedia.');
    if (!tanggal || !selectedClass) {
      alert('Mohon lengkapi tanggal dan kelas.');
      return;
    }
    if (!attendance.length) {
      alert('Belum ada siswa untuk dicatat.');
      return;
    }
    if (alreadySaved) {
      alert('Absensi kelas ini sudah dicatat untuk tanggal tersebut. Absensi hanya dapat dilakukan 1 kali sehari.');
      return;
    }

    setSaving(true);
    try {
      const className = classes.find((item) => item.id === selectedClass)?.name || '';

      // Cek ulang sebelum menyimpan agar double-submit tidak membuat dua dokumen.
      const existingQuery = query(
        collection(db, 'absensi'),
        where('user_id', '==', user.uid),
        where('tanggal', '==', tanggal),
        where('class_id', '==', selectedClass)
      );
      const existing = await getDocs(existingQuery);

      if (!existing.empty) {
        setAlreadySaved(true);
        alert('Absensi untuk kelas ini pada tanggal tersebut sudah ada. Tidak dibuat duplikat.');
        return;
      }

      const now = new Date().toISOString();

      await addDoc(collection(db, 'absensi'), {
        user_id: user.uid,
        tanggal,
        class_id: selectedClass,
        class_name: className,
        detail_absensi: attendance,
        rekap_absensi: summary,
        created_at: now,
        updated_at: now,
      });

      setAlreadySaved(true);
      setSavedAt(now);
      alert('Absensi berhasil disimpan. Absensi untuk kelas ini sudah terkunci untuk tanggal tersebut.');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan absensi.');
    } finally {
      setSaving(false);
    }
  };

  const selectedClassName =
    classes.find((item) => item.id === selectedClass)?.name || '';

  return (
    <div className="min-h-screen bg-[#f7f8fc] px-4 pb-12 pt-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-600 p-6 text-white shadow-[0_18px_50px_rgba(13,148,136,0.20)] md:p-8">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                <UserCheck className="h-3.5 w-3.5" />
                Presensi Harian
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Absensi Siswa</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50 md:text-base">
                Satu kali absensi untuk setiap kelas setiap hari. Mata pelajaran dan jam
                pelajaran tidak diperlukan.
              </p>
            </div>
            <div className="hidden rounded-[24px] bg-white/10 p-5 backdrop-blur md:block">
              <Users className="h-12 w-12" />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          <Card className="h-fit rounded-[28px] border-0 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.07)]">
            <CardHeader className="rounded-t-[28px] border-b border-slate-100 bg-slate-50/70">
              <CardTitle className="text-lg text-slate-800">Presensi Harian</CardTitle>
              <CardDescription>Pilih tanggal dan kelas yang akan diabsen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  Tanggal
                </label>
                <Input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Kelas</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  disabled={loadingClasses}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                >
                  <option value="">
                    {loadingClasses ? 'Memuat kelas...' : '-- Pilih Kelas --'}
                  </option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      Kelas {item.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedClass && (
                <div className={`rounded-[22px] border p-4 ${
                  alreadySaved
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-blue-100 bg-blue-50'
                }`}>
                  {alreadySaved ? (
                    <>
                      <div className="flex items-center gap-2 font-bold text-emerald-800">
                        <CheckCircle2 className="h-5 w-5" />
                        Sudah Diabsen
                      </div>
                      <p className="mt-2 text-xs leading-5 text-emerald-700">
                        Kelas {selectedClassName} sudah memiliki absensi pada tanggal ini.
                        Data dikunci dan tidak dapat disimpan ulang.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="font-bold text-blue-900">Aturan Presensi</div>
                      <p className="mt-2 text-xs leading-5 text-blue-700">
                        Absensi hanya boleh dibuat <b>1 kali sehari untuk kelas ini</b>.
                        Setelah disimpan, data akan dikunci.
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  ['Hadir', summary.hadir, 'bg-emerald-50 text-emerald-700 border-emerald-100'],
                  ['Izin', summary.izin, 'bg-blue-50 text-blue-700 border-blue-100'],
                  ['Sakit', summary.sakit, 'bg-amber-50 text-amber-700 border-amber-100'],
                  ['Alfa', summary.alfa, 'bg-rose-50 text-rose-700 border-rose-100'],
                ].map(([label, value, cls]) => (
                  <div key={String(label)} className={`rounded-[20px] border p-4 ${cls}`}>
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="mt-1 text-[11px] font-bold uppercase tracking-wider">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border-0 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.07)]">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-6 py-5 md:px-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-lg text-slate-800">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <Users className="h-5 w-5" />
                    </span>
                    Daftar Kehadiran
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {selectedClass
                      ? `Kelas ${selectedClassName} · ${tanggal}`
                      : 'Pilih kelas untuk menampilkan siswa.'}
                  </CardDescription>
                </div>

                {students.length > 0 && !alreadySaved && (
                  <Button
                    variant="outline"
                    onClick={() => setAllStatus('Hadir')}
                    className="h-10 rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Semua Hadir
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {!selectedClass ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center text-slate-400">
                  <Users className="mb-4 h-12 w-12 text-slate-200" />
                  <p className="font-semibold text-slate-600">Pilih kelas terlebih dahulu</p>
                  <p className="mt-1 text-sm">Daftar siswa akan muncul di sini.</p>
                </div>
              ) : loadingStudents || checkingExisting ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  <p className="text-sm text-slate-400">Memeriksa presensi...</p>
                </div>
              ) : students.length === 0 ? (
                <div className="flex min-h-[360px] items-center justify-center p-8 text-center text-slate-400">
                  Belum ada siswa pada kelas ini.
                </div>
              ) : (
                <div className="max-h-[610px] overflow-auto">
                  <table className="w-full min-w-[720px]">
                    <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                      <tr className="border-b border-slate-100">
                        <th className="w-16 px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                          No
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                          Siswa
                        </th>
                        <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                          Status Kehadiran
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => {
                        const current =
                          attendance.find((x) => x.studentId === student.id)?.status || 'Hadir';

                        return (
                          <tr
                            key={student.id}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-4 text-center text-sm font-semibold text-slate-400">
                              {index + 1}
                            </td>
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-800">{student.name}</div>
                              <div className="mt-0.5 text-xs text-slate-400">
                                {student.nisn || student.nis || 'NIS/NISN belum tersedia'}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap justify-center gap-2">
                                {(['Hadir', 'Izin', 'Sakit', 'Alfa'] as AttendanceStatus[]).map(
                                  (status) => (
                                    <button
                                      key={status}
                                      type="button"
                                      disabled={alreadySaved}
                                      onClick={() => updateAttendance(student.id, status)}
                                      className={`rounded-full border px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed ${
                                        current === status
                                          ? statusStyles[status]
                                          : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                                      }`}
                                    >
                                      {current === status && <Check className="mr-1 inline h-3.5 w-3.5" />}
                                      {status}
                                    </button>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>

            {students.length > 0 && !alreadySaved && (
              <div className="border-t border-slate-100 bg-slate-50/70 p-5">
                <Button
                  onClick={handleSave}
                  disabled={saving || checkingExisting}
                  className="h-12 w-full rounded-2xl bg-emerald-600 font-bold shadow-sm hover:bg-emerald-700 md:w-auto md:px-8"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-5 w-5" />
                  )}
                  Simpan Absensi Hari Ini
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
