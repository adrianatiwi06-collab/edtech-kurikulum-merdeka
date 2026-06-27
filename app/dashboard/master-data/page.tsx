'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, limit, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit2, Plus, Users as UsersIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Class {
  id: string;
  name: string;
  grade: string;
  user_id: string;
}

interface Student {
  id: string;
  name: string;
  nisn: string;
  class_id: string;
}

export default function MasterDataPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<{ [classId: string]: Student[] }>({});
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false); // Untuk tombol aksi agar UI tidak terkunci total

  // Class form state
  const [showClassForm, setShowClassForm] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [className, setClassName] = useState('');
  const [classGrade, setClassGrade] = useState('');

  // Student form state
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentNisn, setStudentNisn] = useState('');
  const [showImportForm, setShowImportForm] = useState(false);
  const [importError, setImportError] = useState('');

  // Load classes
  useEffect(() => {
    if (user) {
      loadClasses();
    }
  }, [user]);

  const loadClasses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'classes'), 
        where('user_id', '==', user.uid),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      const classesData: Class[] = [];
      querySnapshot.forEach((doc) => {
        classesData.push({ id: doc.id, ...doc.data() } as Class);
      });

      // Urutkan kelas secara alfanumerik (misal: 1A, 1B, 2A)
      classesData.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      
      setClasses(classesData);
    } catch (error: any) {
      console.error('Error loading classes:', error);
      toast.error('Gagal memuat daftar kelas');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadStudents = useCallback(async (classId: string, forceReload = false) => {
    if (!user) return;
    
    // Check cache first, kecuali dipaksa reload (setelah insert/delete)
    if (!forceReload && students[classId]) {
      setSelectedClass(classId);
      return;
    }
    
    setLoading(true);
    try {
      const studentsRef = collection(db, 'classes', classId, 'students');
      const q = query(studentsRef, limit(100)); 
      const querySnapshot = await getDocs(q);
      const studentsData: Student[] = [];
      querySnapshot.forEach((doc) => {
        studentsData.push({ id: doc.id, class_id: classId, ...doc.data() } as Student);
      });

      // Urutkan siswa berdasarkan nama (A-Z)
      studentsData.sort((a, b) => a.name.localeCompare(b.name));
      
      setStudents((prev) => ({ ...prev, [classId]: studentsData }));
      setSelectedClass(classId);
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Gagal memuat daftar siswa');
    } finally {
      setLoading(false);
    }
  }, [user, students]);

  // Class CRUD operations
  const handleSaveClass = async () => {
    if (!user || !className || !classGrade) {
      toast.error('Nama Kelas dan Tingkat harus diisi');
      return;
    }
    
    setActionLoading(true);
    try {
      if (editingClass) {
        await updateDoc(doc(db, 'classes', editingClass.id), {
          name: className.trim(),
          grade: classGrade.trim(),
        });
        toast.success('Kelas berhasil diperbarui');
      } else {
        await addDoc(collection(db, 'classes'), {
          name: className.trim(),
          grade: classGrade.trim(),
          user_id: user.uid,
          created_at: new Date().toISOString(),
        });
        toast.success('Kelas berhasil ditambahkan');
      }
      setClassName('');
      setClassGrade('');
      setShowClassForm(false);
      setEditingClass(null);
      loadClasses();
    } catch (error: any) {
      console.error('Error saving class:', error);
      toast.error('Gagal menyimpan kelas: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClass = (cls: Class) => {
    setEditingClass(cls);
    setClassName(cls.name);
    setClassGrade(cls.grade);
    setShowClassForm(true);
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('PERINGATAN: Hapus kelas ini? Semua data siswa di dalam kelas ini akan ikut terhapus permanen.')) return;
    setActionLoading(true);
    try {
      // BATCH DELETE: Hapus semua siswa dulu, baru hapus kelasnya agar tidak ada Orphan Data
      const studentsRef = collection(db, 'classes', classId, 'students');
      const studentSnapshot = await getDocs(studentsRef);
      
      const batch = writeBatch(db);
      studentSnapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      // Tambahkan instruksi hapus dokumen kelas ke dalam batch
      batch.delete(doc(db, 'classes', classId));
      
      // Eksekusi semua perintah hapus secara bersamaan
      await batch.commit();

      toast.success('Kelas beserta seluruh siswanya berhasil dihapus');
      loadClasses();
      if (selectedClass === classId) {
        setSelectedClass(null);
      }
    } catch (error: any) {
      console.error('Error deleting class:', error);
      toast.error('Gagal menghapus kelas: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Student CRUD operations
  const handleSaveStudent = async () => {
    if (!user || !selectedClass || !studentName || !studentNisn) {
      toast.error('Nama dan NISN harus diisi');
      return;
    }

    // Validasi NISN ganda di kelas yang sama
    const isDuplicateNisn = students[selectedClass]?.some(
      s => s.nisn === studentNisn && s.id !== editingStudent?.id
    );

    if (isDuplicateNisn) {
      toast.error('Gagal menyimpan: NISN ini sudah terdaftar untuk siswa lain di kelas ini');
      return;
    }

    setActionLoading(true);
    try {
      if (editingStudent) {
        await updateDoc(doc(db, 'classes', selectedClass, 'students', editingStudent.id), {
          name: studentName.trim(),
          nisn: studentNisn.trim(),
        });
        toast.success('Data siswa berhasil diperbarui');
      } else {
        await addDoc(collection(db, 'classes', selectedClass, 'students'), {
          name: studentName.trim(),
          nisn: studentNisn.trim(),
          created_at: new Date().toISOString(),
        });
        toast.success('Siswa berhasil ditambahkan');
      }
      setStudentName('');
      setStudentNisn('');
      setShowStudentForm(false);
      setEditingStudent(null);
      
      // Paksa reload data siswa (bypass cache)
      loadStudents(selectedClass, true);
    } catch (error: any) {
      console.error('Error saving student:', error);
      toast.error('Gagal menyimpan data siswa: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentName(student.name);
    setStudentNisn(student.nisn);
    setShowStudentForm(true);
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!selectedClass || !confirm('Hapus data siswa ini?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'classes', selectedClass, 'students', studentId));
      toast.success('Siswa berhasil dihapus');
      loadStudents(selectedClass, true);
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast.error('Gagal menghapus siswa: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportXLSX = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass) return;

    setImportError('');
    setActionLoading(true);

    try {
      const { read, utils } = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      if (!worksheet) {
        setImportError('File XLSX tidak valid atau kosong');
        toast.error('File Excel tidak valid');
        return;
      }

      const data: any[] = utils.sheet_to_json(worksheet, { header: 1 });
      
      if (data.length < 2) {
        setImportError('File XLSX kosong atau tidak memiliki data siswa');
        return;
      }

      const dataLines = data.slice(1);
      const batch = writeBatch(db);
      let validRowsCount = 0;

      for (const row of dataLines) {
        const name = String(row[0] || '').trim();
        const nisn = String(row[1] || '').trim();
        
        if (name && nisn) {
          const newStudentRef = doc(collection(db, 'classes', selectedClass, 'students'));
          batch.set(newStudentRef, {
            name,
            nisn,
            created_at: new Date().toISOString()
          });
          validRowsCount++;
        }
      }

      if (validRowsCount > 0) {
        await batch.commit(); // Eksekusi import massal secara bersamaan
        toast.success(`Berhasil mengimpor ${validRowsCount} siswa`);
        loadStudents(selectedClass, true);
        setShowImportForm(false);
      } else {
        setImportError('Tidak ada data siswa yang valid ditemukan');
      }
      
    } catch (error: any) {
      console.error('Import error:', error);
      setImportError('Gagal membaca file XLSX');
      toast.error('Terjadi kesalahan saat import data');
    } finally {
      setActionLoading(false);
      // Reset input file agar bisa memilih file yang sama lagi jika perlu
      if (e.target) e.target.value = '';
    }
  };

  const downloadTemplateXLSX = async () => {
    try {
      const XLSX = await import('xlsx');
      const data = [
        ['Nama Lengkap', 'NISN'],
        ['Budi Santoso', '0012345678'],
        ['Siti Aminah', '0098765432']
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      
      // Auto-size columns
      worksheet['!cols'] = [{ wch: 30 }, { wch: 15 }];
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa');
      XLSX.writeFile(workbook, 'Template_Import_Siswa.xlsx');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Gagal mengunduh template');
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Master Data</h1>
        <p className="mt-2 text-gray-600">Kelola data kelas dan siswa</p>
      </div>

      {loading && classes.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse w-32"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse w-32"></div>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-gray-100 rounded animate-pulse"></div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classes Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daftar Kelas</CardTitle>
                <CardDescription>Kelola kelas yang Anda ajar</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setShowClassForm(!showClassForm);
                  setEditingClass(null);
                  setClassName('');
                  setClassGrade('');
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Kelas
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showClassForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3 border border-gray-200">
                <Input
                  placeholder="Nama Kelas (contoh: 7A / Kelas Bintang)"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
                <Input
                  placeholder="Tingkat (contoh: 7 / Fase D)"
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveClass} disabled={actionLoading}>
                    {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingClass ? 'Update' : 'Simpan'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => {
                      setShowClassForm(false);
                      setEditingClass(null);
                      setClassName('');
                      setClassGrade('');
                    }}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {classes.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  Belum ada kelas. Tambahkan kelas pertama Anda.
                </p>
              ) : (
                classes.map((cls) => (
                  <div
                    key={cls.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedClass === cls.id
                        ? 'bg-blue-50 border-blue-400 shadow-sm'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => loadStudents(cls.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${selectedClass === cls.id ? 'bg-blue-100' : 'bg-gray-100'}`}>
                           <UsersIcon className={`w-5 h-5 ${selectedClass === cls.id ? 'text-blue-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{cls.name}</p>
                          <p className="text-xs text-gray-500">Tingkat / Fase: {cls.grade}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-500 hover:text-blue-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClass(cls);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClass(cls.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Students Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daftar Siswa</CardTitle>
                <CardDescription>
                  {selectedClass
                    ? `Siswa di ${classes.find((c) => c.id === selectedClass)?.name}`
                    : 'Pilih kelas di sebelah kiri'}
                </CardDescription>
              </div>
              {selectedClass && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowImportForm(!showImportForm);
                      setShowStudentForm(false);
                      setImportError('');
                    }}
                  >
                    Import XLSX
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      setShowStudentForm(!showStudentForm);
                      setShowImportForm(false);
                      setEditingStudent(null);
                      setStudentName('');
                      setStudentNisn('');
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedClass ? (
              <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                <UsersIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Pilih kelas dari daftar untuk mengelola siswa</p>
              </div>
            ) : (
              <>
                {showStudentForm && (
                  <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3 shadow-sm">
                    <Input
                      placeholder="Nama Lengkap Siswa"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                    />
                    <Input
                      placeholder="Nomor Induk Siswa (NISN/NIS)"
                      value={studentNisn}
                      onChange={(e) => setStudentNisn(e.target.value)}
                    />
                    <div className="flex gap-2 pt-2 border-t border-gray-200">
                      <Button onClick={handleSaveStudent} disabled={actionLoading} className="w-full sm:w-auto">
                        {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingStudent ? 'Update Data' : 'Simpan Siswa'}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={actionLoading}
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setShowStudentForm(false);
                          setEditingStudent(null);
                          setStudentName('');
                          setStudentNisn('');
                        }}
                      >
                        Batal
                      </Button>
                    </div>
                  </div>
                )}

                {showImportForm && (
                  <div className="mb-4 p-4 bg-blue-50/50 border border-blue-100 rounded-lg space-y-4 shadow-sm">
                    <div className="space-y-1 border-b border-blue-100 pb-3">
                      <p className="text-sm font-semibold text-blue-900">Import Data Masal dari Excel</p>
                      <p className="text-xs text-blue-700">
                        Format file harus <b>.xlsx</b> dengan Kolom A: Nama, Kolom B: NISN (Baris 1 khusus untuk judul/header).
                      </p>
                    </div>
                    
                    {importError && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                        {importError}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white"
                        onClick={downloadTemplateXLSX}
                      >
                        Unduh Template
                      </Button>
                      
                      <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>

                      <label className="cursor-pointer flex-1">
                        <Button size="sm" asChild disabled={actionLoading} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                          <span>
                            {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2"/>}
                            {actionLoading ? 'Membaca Data...' : 'Pilih & Upload File'}
                          </span>
                        </Button>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={handleImportXLSX}
                          disabled={actionLoading}
                        />
                      </label>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-500"
                        onClick={() => {
                          setShowImportForm(false);
                          setImportError('');
                        }}
                      >
                        Tutup
                      </Button>
                    </div>
                  </div>
                )}

                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="w-12 text-center">No</TableHead>
                        <TableHead>Nama Siswa</TableHead>
                        <TableHead>NISN</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students[selectedClass]?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                            Belum ada siswa di kelas ini. Klik "Tambah" atau "Import XLSX".
                          </TableCell>
                        </TableRow>
                      ) : (
                        students[selectedClass]?.map((student, index) => (
                          <TableRow key={student.id} className="hover:bg-gray-50/50">
                            <TableCell className="text-center font-medium text-gray-500">{index + 1}</TableCell>
                            <TableCell className="font-medium text-gray-900">{student.name}</TableCell>
                            <TableCell className="text-gray-600">{student.nisn}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-gray-500 hover:text-blue-600"
                                  onClick={() => handleEditStudent(student)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => handleDeleteStudent(student.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  );
}