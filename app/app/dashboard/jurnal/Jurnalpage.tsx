'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save, CheckCircle } from 'lucide-react';

interface Class {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  nisn: string;
}

interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: 'Hadir' | 'Izin' | 'Sakit' | 'Alfa';
}

export default function JurnalAbsensiPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Data Master
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Form Jurnal
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('');
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [jamPelajaran, setJamPelajaran] = useState('');
  const [materi, setMateri] = useState('');
  const [metode, setMetode] = useState('');
  const [catatan, setCatatan] = useState('');

  // Data Absensi
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

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

  const loadStudents = async (classId: string) => {
    setLoading(true);
    try {
      const studentsRef = collection(db, 'classes', classId, 'students');
      const querySnapshot = await getDocs(studentsRef);
      const studentsData: Student[] = [];
      querySnapshot.forEach((doc) => studentsData.push({ id: doc.id, ...doc.data() } as Student));
      
      // Urutkan abjad
      studentsData.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      setStudents(studentsData);

      // Siapkan default absensi: Semua siswa dianggap "Hadir" pada awalnya
      const defaultAttendance: AttendanceRecord[] = studentsData.map(student => ({
        studentId: student.id,
        studentName: student.name,
        status: 'Hadir'
      }));
      setAttendance(defaultAttendance);

    } catch (error) {
      console.error("Gagal memuat siswa", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    if (classId) {
      loadStudents(classId);
    } else {
      setStudents([]);
      setAttendance([]);
    }
  };

  const updateAttendance = (studentId: string, status: 'Hadir' | 'Izin' | 'Sakit' | 'Alfa') => {
    setAttendance(prev => 
      prev.map(record => 
        record.studentId === studentId ? { ...record, status } : record
      )
    );
  };

  const handleSave = async () => {
    if (!selectedClass || !mataPelajaran || !materi) {
      alert("Mohon lengkapi Kelas, Mata Pelajaran, dan Materi Pembelajaran!");
      return;
    }

    setSaving(true);
    try {
      // Rekap jumlah kehadiran
      const rekap = {
        hadir: attendance.filter(a => a.status === 'Hadir').length,
        izin: attendance.filter(a => a.status === 'Izin').length,
        sakit: attendance.filter(a => a.status === 'Sakit').length,
        alfa: attendance.filter(a => a.status === 'Alfa').length,
      };

      const className = classes.find(c => c.id === selectedClass)?.name || '';

      const dataToSave = {
        user_id: user?.uid,
        tanggal,
        class_id: selectedClass,
        class_name: className,
        mata_pelajaran: mataPelajaran,
        jam_pelajaran: jamPelajaran,
        materi,
        metode,
        catatan,
        rekap_absensi: rekap,
        detail_absensi: attendance, // Simpan siapa saja yang hadir/izin/dll
        created_at: new Date().toISOString()
      };

      await addDoc(collection(db, 'jurnal_mengajar'), dataToSave);
      
      alert("✅ Jurnal Mengajar dan Absensi berhasil disimpan!");
      
      // Reset form secukupnya
      setMateri('');
      setCatatan('');
      setJamPelajaran('');
      // Kembalikan semua ke hadir
      setAttendance(attendance.map(a => ({ ...a, status: 'Hadir' })));

    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto pb-10 px-4 pt-6 animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Jurnal & Absensi</h1>
        <p className="mt-2 text-gray-600">Catat aktivitas mengajar dan kehadiran siswa dalam satu langkah mudah.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KOLOM KIRI: FORM JURNAL */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-blue-200 shadow-sm">
            <CardHeader className="bg-blue-50/50 border-b border-blue-100">
              <CardTitle className="text-blue-800">Buku Jurnal Mengajar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Tanggal Pelaksanaan</label>
                <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Pilih Kelas</label>
                <select 
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                  value={selectedClass}
                  onChange={(e) => handleClassChange(e.target.value)}
                >
                  <option value="">-- Pilih Kelas --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>Kelas {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Mata Pelajaran</label>
                <Input placeholder="Contoh: Pendidikan Pancasila" value={mataPelajaran} onChange={e => setMataPelajaran(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Jam Pelajaran Ke-</label>
                <Input placeholder="Contoh: 1 - 3" value={jamPelajaran} onChange={e => setJamPelajaran(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Materi Pembelajaran</label>
                <textarea 
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 min-h-[80px]" 
                  placeholder="Tuliskan materi atau Tujuan Pembelajaran (TP) hari ini..."
                  value={materi} onChange={e => setMateri(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Metode Pembelajaran</label>
                <Input placeholder="Contoh: Ceramah, Diskusi, PBL" value={metode} onChange={e => setMetode(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Catatan Khusus (Opsional)</label>
                <textarea 
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 min-h-[60px]" 
                  placeholder="Catatan kejadian di kelas..."
                  value={catatan} onChange={e => setCatatan(e.target.value)} 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KOLOM KANAN: ABSENSI */}
        <div className="lg:col-span-2">
          <Card className="border-green-200 shadow-sm h-full">
            <CardHeader className="bg-green-50/50 border-b border-green-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-green-800">Daftar Hadir Siswa</CardTitle>
                <CardDescription>Pilih status selain "Hadir" jika ada siswa yang berhalangan.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="mt-4 p-0">
              {!selectedClass ? (
                <div className="p-10 text-center text-gray-500 italic">
                  Silakan pilih kelas pada kolom Jurnal di sebelah kiri untuk memuat daftar siswa.
                </div>
              ) : loading ? (
                <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>
              ) : students.length === 0 ? (
                <div className="p-10 text-center text-gray-500">Belum ada data siswa di kelas ini.</div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-12 text-center">No</TableHead>
                        <TableHead>Nama Siswa</TableHead>
                        <TableHead className="text-center">Kehadiran</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, idx) => {
                        const currentStatus = attendance.find(a => a.studentId === student.id)?.status || 'Hadir';
                        return (
                          <TableRow key={student.id} className="hover:bg-gray-50">
                            <TableCell className="text-center font-medium">{idx + 1}</TableCell>
                            <TableCell className="font-semibold text-gray-700">{student.name}</TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-2">
                                {['Hadir', 'Izin', 'Sakit', 'Alfa'].map(status => (
                                  <button
                                    key={status}
                                    onClick={() => updateAttendance(student.id, status as any)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${
                                      currentStatus === status 
                                      ? status === 'Hadir' ? 'bg-green-100 border-green-500 text-green-700'
                                        : status === 'Izin' ? 'bg-blue-100 border-blue-500 text-blue-700'
                                        : status === 'Sakit' ? 'bg-yellow-100 border-yellow-500 text-yellow-700'
                                        : 'bg-red-100 border-red-500 text-red-700'
                                      : 'bg-white border-gray-300 text-gray-400 hover:bg-gray-100'
                                    }`}
                                  >
                                    {status}
                                  </button>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            
            {/* FOOTER TOMBOL SIMPAN */}
            {selectedClass && !loading && (
              <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-4 rounded-b-lg">
                <Button 
                  onClick={handleSave} 
                  disabled={saving} 
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto px-8 py-6"
                >
                  {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                  <span className="font-bold text-lg">Simpan Jurnal & Absensi</span>
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}