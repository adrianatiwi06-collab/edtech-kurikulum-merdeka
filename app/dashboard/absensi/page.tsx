'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { addDoc, collection, getDocs, query, updateDoc, where, doc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Check, CheckCircle2, Loader2, Save, Users, UserCheck, Settings, Trash2, AlertTriangle, X } from 'lucide-react';

interface Class { id: string; name: string; }
interface Student { id: string; name: string; nisn?: string; nis?: string; }
type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alfa';
interface AttendanceRecord {
  studentId: string;
  studentName: string;
  studentNisn: string;
  status: AttendanceStatus;
}

// Interface baru untuk Hari Libur
interface Holiday {
  id: string;
  date: string;
  description: string;
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
  
  const [existingDocId, setExistingDocId] = useState<string | null>(null);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [savedAt, setSavedAt] = useState('');

  // === STATE PENGATURAN HARI LIBUR ===
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');
  const [loadingHolidays, setLoadingHolidays] = useState(false);

  useEffect(() => {
    if (user) {
      loadClasses();
      loadHolidays();
    }
  }, [user]);

  useEffect(() => {
    if (selectedClass) {
      loadStudents(selectedClass);
      checkExistingAttendance(selectedClass, tanggal);
    } else {
      setStudents([]);
      setAttendance([]);
      setAlreadySaved(false);
      setExistingDocId(null);
      setSavedAt('');
    }
  }, [selectedClass, tanggal]);

  // === FUNGSI LOAD & SAVE HARI LIBUR ===
  const loadHolidays = async () => {
    if (!user) return;
    setLoadingHolidays(true);
    try {
      const q = query(collection(db, 'holidays'), where('user_id', '==', user.uid));
      const snapshot = await getDocs(q);
      const data: Holiday[] = [];
      snapshot.forEach((item) => data.push({ id: item.id, ...item.data() } as Holiday));
      // Urutkan berdasarkan tanggal
      data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setHolidays(data);
    } catch (error) {
      console.error('Gagal memuat hari libur:', error);
    } finally {
      setLoadingHolidays(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!user || !newHolidayDate || !newHolidayDesc) return;
    try {
      const docRef = await addDoc(collection(db, 'holidays'), {
        user_id: user.uid,
        date: newHolidayDate,
        description: newHolidayDesc
      });
      setHolidays([...holidays, { id: docRef.id, date: newHolidayDate, description: newHolidayDesc }]);
      setNewHolidayDate('');
      setNewHolidayDesc('');
    } catch (error) {
      alert('Gagal menambahkan hari libur');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('Hapus hari libur ini?')) return;
    try {
      await deleteDoc(doc(db, 'holidays', id));
      setHolidays(holidays.filter(h => h.id !== id));
    } catch (error) {
      alert('Gagal menghapus hari libur');
    }
  };

  // === LOGIKA PENGECEKAN HARI LIBUR / WEEKEND ===
  const holidayStatus = useMemo(() => {
    if (!tanggal) return { isHoliday: false, reason: '' };
    
    const dateObj = new Date(tanggal);
    const day = dateObj.getDay();
    
    // 0 = Minggu, 6 = Sabtu
    if (day === 0) return { isHoliday: true, reason: 'Hari Minggu (Libur Akhir Pekan)' };
    if (day === 6) return { isHoliday: true, reason: 'Hari Sabtu (Libur Akhir Pekan)' };

    // Cek apakah tanggal ada di database libur nasional
    const foundHoliday = holidays.find(h => h.date === tanggal);
    if (foundHoliday) return { isHoliday: true, reason: `Libur: ${foundHoliday.description}` };

    return { isHoliday: false, reason: '' };
  }, [tanggal, holidays]);

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
      const q = query(
        collection(db, 'absensi'),
        where('user_id', '==', user.uid),
        where('tanggal', '==', date),
        where('class_id', '==', classId)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const existing = docSnap.data();
        const details = Array.isArray(existing.detail_absensi)
          ? existing.detail_absensi as AttendanceRecord[]
          : [];

        setAttendance(details);
        setAlreadySaved(true);
        setExistingDocId(docSnap.id);
        setSavedAt(existing.updated_at || existing.created_at || '');
      } else {
        setAlreadySaved(false);
        setExistingDocId(null);
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
    setAttendance((prev) =>
      prev.map((record) =>
        record.studentId === studentId ? { ...record, status } : record
      )
    );
  };

  const setAllStatus = (status: AttendanceStatus) => {
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
    if (holidayStatus.isHoliday) {
      alert('Tidak dapat menyimpan absensi pada hari libur.');
      return;
    }

    setSaving(true);
    try {
      const className = classes.find((item) => item.id === selectedClass)?.name || '';
      const now = new Date().toISOString();

      if (existingDocId) {
        const docRef = doc(db, 'absensi', existingDocId);
        await updateDoc(docRef, {
          detail_absensi: attendance,
          rekap_absensi: summary,
          updated_at: now,
        });
        
        setSavedAt(now);
        alert('Absensi berhasil diperbarui.');
      } else {
        const existingQuery = query(
          collection(db, 'absensi'),
          where('user_id', '==', user.uid),
          where('tanggal', '==', tanggal),
          where('class_id', '==', selectedClass)
        );
        const existing = await getDocs(existingQuery);

        if (!existing.empty) {
          setExistingDocId(existing.docs[0].id);
          setAlreadySaved(true);
          alert('Absensi untuk kelas ini sudah ada. Data telah disinkronkan. Silakan klik Perbarui jika ada perubahan.');
          setSaving(false);
          return;
        }

        const newDoc = await addDoc(collection(db, 'absensi'), {
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
        setExistingDocId(newDoc.id);
        setSavedAt(now);
        alert('Absensi berhasil disimpan pertama kali.');
      }
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
      
      {/* MODAL PENGATURAN LIBUR */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">Pengaturan Hari Libur</h2>
              <button onClick={() => setShowSettings(false)} className="rounded-full p-2 hover:bg-slate-100 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6 space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-xs text-slate-500 font-medium">Tambah Libur Nasional / Cuti Bersama</p>
              <div className="space-y-2">
                <Input 
                  type="date" 
                  value={newHolidayDate} 
                  onChange={(e) => setNewHolidayDate(e.target.value)} 
                  className="bg-white"
                />
                <Input 
                  type="text" 
                  placeholder="Keterangan (Contoh: Idul Fitri)" 
                  value={newHolidayDesc} 
                  onChange={(e) => setNewHolidayDesc(e.target.value)} 
                  className="bg-white"
                />
                <Button 
                  onClick={handleAddHoliday} 
                  disabled={!newHolidayDate || !newHolidayDesc}
                  className="w-full bg-slate-800 hover:bg-slate-900"
                >
                  Tambahkan Libur
                </Button>
              </div>
            </div>

            <div className="max-h-[250px] overflow-y-auto space-y-2 pr-2">
              <p className="text-sm font-bold text-slate-700 mb-2">Daftar Libur Tersimpan:</p>
              {loadingHolidays ? (
                <div className="text-center text-sm text-slate-400 py-4">Memuat...</div>
              ) : holidays.length === 0 ? (
                <div className="text-center text-sm text-slate-400 py-4">Belum ada hari libur.</div>
              ) : (
                holidays.map(holiday => (
                  <div key={holiday.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                    <div>
                      <div className="text-sm font-bold text-slate-800">{new Date(holiday.date).toLocaleDateString('id-ID', { dateStyle: 'medium'})}</div>
                      <div className="text-xs text-slate-500">{holiday.description}</div>
                    </div>
                    <button onClick={() => handleDeleteHoliday(holiday.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
              <div className="text-[10px] text-slate-400 mt-4 text-center">
                *Hari Sabtu & Minggu otomatis terhitung sebagai hari libur.
              </div>
            </div>
          </div>
        </div>
      )}

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
            
            {/* TOMBOL PENGATURAN LIBUR */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button 
                onClick={() => setShowSettings(true)}
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur"
              >
                <Settings className="mr-2 h-4 w-4" />
                Pengaturan Libur
              </Button>
              <div className="hidden rounded-[24px] bg-white/10 p-5 backdrop-blur md:block">
                <Users className="h-12 w-12" />
              </div>
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
                  onChange={(e) => {
                    setTanggal(e.target.value);
                    setSelectedClass(''); // Reset kelas jika tanggal ganti
                  }}
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>

              {/* PERINGATAN JIKA HARI LIBUR */}
              {holidayStatus.isHoliday ? (
                <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center gap-2 font-bold text-rose-800 mb-2">
                    <AlertTriangle className="h-5 w-5" />
                    Hari Libur
                  </div>
                  <p className="text-xs leading-5 text-rose-700">
                    Absensi tidak dapat diisi karena hari ini adalah <b>{holidayStatus.reason}</b>.
                  </p>
                </div>
              ) : (
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
              )}

              {!holidayStatus.isHoliday && selectedClass && (
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
                        Kelas {selectedClassName} sudah diabsen. Anda tetap dapat <b>mengubah dan memperbarui</b> data absensi di bawah jika ada kesalahan.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="font-bold text-blue-900">Aturan Presensi</div>
                      <p className="mt-2 text-xs leading-5 text-blue-700">
                        Absensi dibuat <b>1 kali sehari untuk kelas ini</b>. Jika terdapat perubahan sewaktu-waktu, Anda tetap bisa memperbaruinya.
                      </p>
                    </>
                  )}
                </div>
              )}

              {!holidayStatus.isHoliday && (
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
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border-0 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.07)]">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-6 py-5 md:px-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-lg text-slate-800">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${holidayStatus.isHoliday ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      <Users className="h-5 w-5" />
                    </span>
                    Daftar Kehadiran
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {holidayStatus.isHoliday 
                      ? 'Fitur absensi dinonaktifkan.'
                      : selectedClass
                        ? `Kelas ${selectedClassName} · ${tanggal}`
                        : 'Pilih kelas untuk menampilkan siswa.'}
                  </CardDescription>
                </div>

                {!holidayStatus.isHoliday && students.length > 0 && (
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
              {holidayStatus.isHoliday ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center text-slate-400">
                  <AlertTriangle className="mb-4 h-12 w-12 text-rose-200" />
                  <p className="font-semibold text-rose-600">Hari Libur</p>
                  <p className="mt-1 text-sm">Siswa diliburkan pada tanggal ini.</p>
                </div>
              ) : !selectedClass ? (
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
                                      onClick={() => updateAttendance(student.id, status)}
                                      className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
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

            {!holidayStatus.isHoliday && students.length > 0 && (
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
                  {alreadySaved ? 'Perbarui Absensi' : 'Simpan Absensi Hari Ini'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}