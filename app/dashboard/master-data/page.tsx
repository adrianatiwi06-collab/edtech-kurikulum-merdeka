'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit2, Plus, Users as UsersIcon } from 'lucide-react';

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
        limit(50) // Limit to 50 classes for performance
      );
      const querySnapshot = await getDocs(q);
      const classesData: Class[] = [];
      querySnapshot.forEach((doc) => {
        classesData.push({ id: doc.id, ...doc.data() } as Class);
      });
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadStudents = useCallback(async (classId: string) => {
    if (!user) return;
    
    // Check cache first
    if (students[classId]) {
      setSelectedClass(classId);
      return;
    }
    
    setLoading(true);
    try {
      const studentsRef = collection(db, 'classes', classId, 'students');
      const q = query(studentsRef, limit(100)); // Limit students
      const querySnapshot = await getDocs(q);
      const studentsData: Student[] = [];
      querySnapshot.forEach((doc) => {
        studentsData.push({ id: doc.id, class_id: classId, ...doc.data() } as Student);
      });
      setStudents((prev) => ({ ...prev, [classId]: studentsData }));
      setSelectedClass(classId);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  }, [user, students]);

  // Class CRUD operations
  const handleSaveClass = async () => {
    if (!user || !className || !classGrade) return;
    setLoading(true);
    try {
      if (editingClass) {
        await updateDoc(doc(db, 'classes', editingClass.id), {
          name: className,
          grade: classGrade,
        });
      } else {
        await addDoc(collection(db, 'classes'), {
          name: className,
          grade: classGrade,
          user_id: user.uid,
          created_at: new Date().toISOString(),
        });
      }
      setClassName('');
      setClassGrade('');
      setShowClassForm(false);
      setEditingClass(null);
      loadClasses();
    } catch (error) {
      console.error('Error saving class:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClass = (cls: Class) => {
    setEditingClass(cls);
    setClassName(cls.name);
    setClassGrade(cls.grade);
    setShowClassForm(true);
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Hapus kelas ini? Semua data siswa akan ikut terhapus.')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'classes', classId));
      loadClasses();
      if (selectedClass === classId) {
        setSelectedClass(null);
      }
    } catch (error) {
      console.error('Error deleting class:', error);
    } finally {
      setLoading(false);
    }
  };

  // Student CRUD operations
  const handleSaveStudent = async () => {
    if (!user || !selectedClass || !studentName || !studentNisn) return;
    setLoading(true);
    try {
      if (editingStudent) {
        await updateDoc(doc(db, 'classes', selectedClass, 'students', editingStudent.id), {
          name: studentName,
          nisn: studentNisn,
        });
      } else {
        await addDoc(collection(db, 'classes', selectedClass, 'students'), {
          name: studentName,
          nisn: studentNisn,
          created_at: new Date().toISOString(),
        });
      }
      setStudentName('');
      setStudentNisn('');
      setShowStudentForm(false);
      setEditingStudent(null);
      loadStudents(selectedClass);
    } catch (error) {
      console.error('Error saving student:', error);
    } finally {
      setLoading(false);
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
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'classes', selectedClass, 'students', studentId));
      loadStudents(selectedClass);
    } catch (error) {
      console.error('Error deleting student:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportXLSX = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass) return;

    setImportError('');
    setLoading(true);

    try {
      const { read, utils } = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      if (!worksheet) {
        setImportError('File XLSX tidak valid atau kosong');
        return;
      }

      const data: any[] = utils.sheet_to_json(worksheet, { header: 1 });
      
      if (data.length < 2) {
        setImportError('File XLSX kosong atau tidak valid');
        return;
      }

      // Skip header (first row)
      const dataLines = data.slice(1);
      let successCount = 0;
      let errorCount = 0;

      for (const row of dataLines) {
        const name = String(row[0] || '').trim();
        const nisn = String(row[1] || '').trim();
        
        if (!name || !nisn) {
          errorCount++;
          continue;
        }

        try {
          await addDoc(collection(db, 'classes', selectedClass, 'students'), {
            name,
            nisn,
            created_at: new Date().toISOString(),
          });
          successCount++;
        } catch {
          errorCount++;
        }
      }

      loadStudents(selectedClass);
      setShowImportForm(false);
      alert(`Import selesai: ${successCount} berhasil, ${errorCount} gagal`);
    } catch (error) {
      setImportError('Gagal membaca file XLSX');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplateXLSX = async () => {
    try {
      const XLSX = await import('xlsx');
      const data = [
        ['Nama', 'NISN'],
        ['Contoh Siswa 1', '1234567890'],
        ['Contoh Siswa 2', '0987654321']
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Siswa');
      XLSX.writeFile(workbook, 'template_siswa.xlsx');
    } catch (error) {
      console.error('Error downloading template:', error);
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
              <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                <Input
                  placeholder="Nama Kelas (contoh: 7A)"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
                <Input
                  placeholder="Tingkat (contoh: 7)"
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveClass} disabled={loading}>
                    {editingClass ? 'Update' : 'Simpan'}
                  </Button>
                  <Button
                    variant="outline"
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

            <div className="space-y-2">
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
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => loadStudents(cls.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <UsersIcon className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium">{cls.name}</p>
                          <p className="text-sm text-gray-500">Tingkat {cls.grade}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClass(cls);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClass(cls.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
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
                    ? `Siswa di kelas ${classes.find((c) => c.id === selectedClass)?.name}`
                    : 'Pilih kelas untuk melihat siswa'}
                </CardDescription>
              </div>
              {selectedClass && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowStudentForm(!showStudentForm);
                      setShowImportForm(false);
                      setEditingStudent(null);
                      setStudentName('');
                      setStudentNisn('');
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Siswa
                  </Button>
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
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedClass ? (
              <div className="text-center py-12 text-gray-500">
                <UsersIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Pilih kelas di sebelah kiri untuk melihat daftar siswa</p>
              </div>
            ) : (
              <>
                {showStudentForm && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                    <Input
                      placeholder="Nama Lengkap Siswa"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                    />
                    <Input
                      placeholder="NISN"
                      value={studentNisn}
                      onChange={(e) => setStudentNisn(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSaveStudent} disabled={loading}>
                        {editingStudent ? 'Update' : 'Simpan'}
                      </Button>
                      <Button
                        variant="outline"
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
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Import Data Siswa dari XLSX</p>
                      <p className="text-xs text-gray-600">
                        Format XLSX: Kolom A = Nama, Kolom B = NISN (dengan header di baris pertama)
                      </p>
                    </div>
                    
                    {importError && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                        {importError}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={downloadTemplateXLSX}
                      >
                        Download Template
                      </Button>
                      <label className="cursor-pointer">
                        <Button size="sm" asChild disabled={loading}>
                          <span>{loading ? 'Mengimpor...' : 'Pilih File XLSX'}</span>
                        </Button>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={handleImportXLSX}
                          disabled={loading}
                        />
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowImportForm(false);
                          setImportError('');
                        }}
                      >
                        Batal
                      </Button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>NISN</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students[selectedClass]?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-500">
                            Belum ada siswa di kelas ini
                          </TableCell>
                        </TableRow>
                      ) : (
                        students[selectedClass]?.map((student, index) => (
                          <TableRow key={student.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{student.name}</TableCell>
                            <TableCell>{student.nisn}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditStudent(student)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteStudent(student.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
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
