'use client';
import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, limit, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit2, Plus, Users as UsersIcon, Loader2, ChevronDown, ChevronUp, Download, Upload, Info, BookOpen, BarChart3, FileSpreadsheet } from 'lucide-react';
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
  nis?: string;
  gender?: 'L' | 'P' | '';
  religion?: string;
  birth_place?: string;
  birth_date?: string;
  age?: string;
  father_name?: string;
  mother_name?: string;
  father_occupation?: string;
  mother_occupation?: string;
  address?: string;
  class_id: string;
}

const PEKERJAAN_LIST = [
  'Buruh',
  'Karyawan Swasta',
  'Nelayan',
  'Pedagang Besar / Kecil',
  'Pensiunan',
  'Petani',
  'Peternak',
  'PNS / TNI / Polri',
  'Sudah Meninggal',
  'TKI (Tenaga Kerja Indonesia)',
  'Tidak bekerja',
  'Tidak dapat diterapkan',
  'Wiraswasta',
  'Wirausaha',
  'Lainnya'
];

const formatTanggalPanjang = (dateStr?: string) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
};

export default function MasterDataPage() {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'siswa' | 'kelas' | 'laporan'>('siswa');
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<{ [classId: string]: Student[] }>({});
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [reportFilterClass, setReportFilterClass] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const [selectedReportCategory, setSelectedReportCategory] = useState<string>('Menampilkan seluruh data');
  const [filteredReportStudents, setFilteredReportStudents] = useState<Student[]>([]);

  // Class form state
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [className, setClassName] = useState('');
  const [classGrade, setClassGrade] = useState('');

  // Student form state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentNisn, setStudentNisn] = useState('');
  const [studentNis, setStudentNis] = useState('');
  const [studentGender, setStudentGender] = useState<'L' | 'P' | ''>('');
  const [studentReligion, setStudentReligion] = useState('');
  const [studentBirthPlace, setStudentBirthPlace] = useState('');
  const [studentBirthDate, setStudentBirthDate] = useState('');
  const [studentAge, setStudentAge] = useState('');
  const [studentFatherName, setStudentFatherName] = useState('');
  const [studentMotherName, setStudentMotherName] = useState('');
  const [studentFatherOcc, setStudentFatherOcc] = useState('');
  const [studentMotherOcc, setStudentMotherOcc] = useState('');
  const [studentAddress, setStudentAddress] = useState('');

  // Import state
  const [showImportForm, setShowImportForm] = useState(false);
  const [importError, setImportError] = useState('');

  const hitungUsia = (tanggalLahir: string) => {
    if (!tanggalLahir) return '';
    const hariIni = new Date();
    const tglLahir = new Date(tanggalLahir);
    let usia = hariIni.getFullYear() - tglLahir.getFullYear();
    const bulan = hariIni.getMonth() - tglLahir.getMonth();
    if (bulan < 0 || (bulan === 0 && hariIni.getDate() < tglLahir.getDate())) {
      usia--;
    }
    return usia.toString();
  };

  useEffect(() => {
    if (user) loadClasses();
  }, [user]);

  const loadClasses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'classes'), where('user_id', '==', user.uid), limit(50));
      const querySnapshot = await getDocs(q);
      const classesData: Class[] = [];
      querySnapshot.forEach((doc) => {
        classesData.push({ id: doc.id, ...doc.data() } as Class);
      });
      classesData.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      setClasses(classesData);
      
      if (classesData.length > 0 && !selectedClass) {
        setSelectedClass(classesData[0].id);
        classesData.forEach(c => loadStudents(c.id));
      }
    } catch (error: any) {
      toast.error('Gagal memuat daftar kelas');
    } finally {
      setLoading(false);
    }
  }, [user, selectedClass]);

  const loadStudents = useCallback(async (classId: string, forceReload = false) => {
    if (!user || !classId) return;
    if (!forceReload && students[classId]) return;
    
    try {
      const studentsRef = collection(db, 'classes', classId, 'students');
      const q = query(studentsRef, limit(100)); 
      const querySnapshot = await getDocs(q);
      const studentsData: Student[] = [];
      querySnapshot.forEach((doc) => {
        studentsData.push({ id: doc.id, class_id: classId, ...doc.data() } as Student);
      });
      studentsData.sort((a, b) => a.name.localeCompare(b.name));
      setStudents((prev) => {
        const updated = { ...prev, [classId]: studentsData };
        const allList: Student[] = Object.values(updated).flat();
        setFilteredReportStudents(allList);
        return updated;
      });
    } catch (error) {
      console.error('Gagal memuat siswa kelas:', classId);
    }
  }, [user, students]);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    setSelectedClass(cid);
    if (cid) loadStudents(cid);
  };

  // --- CRUD KELAS ---
  const handleSaveClass = async () => {
    if (!user || !className || !classGrade) return toast.error('Nama Kelas dan Tingkat harus diisi');
    setActionLoading(true);
    try {
      if (editingClass) {
        await updateDoc(doc(db, 'classes', editingClass.id), { name: className.trim(), grade: classGrade.trim() });
        toast.success('Kelas berhasil diperbarui');
      } else {
        await addDoc(collection(db, 'classes'), { name: className.trim(), grade: classGrade.trim(), user_id: user.uid, created_at: new Date().toISOString() });
        toast.success('Kelas berhasil ditambahkan');
      }
      setClassName(''); setClassGrade(''); setEditingClass(null); loadClasses();
    } catch (error: any) {
      toast.error('Gagal menyimpan kelas');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClass = (cls: Class) => {
    setEditingClass(cls); setClassName(cls.name); setClassGrade(cls.grade); setActiveTab('kelas');
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('PERINGATAN: Hapus kelas ini beserta seluruh siswanya?')) return;
    setActionLoading(true);
    try {
      const studentsRef = collection(db, 'classes', classId, 'students');
      const studentSnapshot = await getDocs(studentsRef);
      const batch = writeBatch(db);
      studentSnapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      batch.delete(doc(db, 'classes', classId));
      await batch.commit();
      toast.success('Kelas berhasil dihapus');
      if (selectedClass === classId) setSelectedClass('');
      loadClasses();
    } catch (error: any) {
      toast.error('Gagal menghapus kelas');
    } finally {
      setActionLoading(false);
    }
  };

  // --- CRUD SISWA ---
  const resetStudentForm = () => {
    setStudentName(''); setStudentNisn(''); setStudentNis(''); setStudentGender('');
    setStudentReligion(''); setStudentBirthPlace(''); setStudentBirthDate(''); setStudentAge('');
    setStudentFatherName(''); setStudentMotherName(''); setStudentFatherOcc(''); setStudentMotherOcc(''); setStudentAddress('');
    setEditingStudent(null);
  };

  const handleSaveStudent = async () => {
    if (!user || !selectedClass || !studentName.trim()) {
      return toast.error('Pilih Kelas dan Nama Siswa wajib diisi');
    }
    setActionLoading(true);
    try {
      const studentData = {
        name: studentName.trim(), 
        nisn: studentNisn.trim(), 
        nis: studentNis.trim(), 
        gender: studentGender,
        religion: studentReligion.trim(),
        birth_place: studentBirthPlace.trim(), 
        birth_date: studentBirthDate, 
        age: studentAge.trim(),
        father_name: studentFatherName.trim(), 
        mother_name: studentMotherName.trim(),
        father_occupation: studentFatherOcc.trim(), 
        mother_occupation: studentMotherOcc.trim(), 
        address: studentAddress.trim(), 
        class_id: selectedClass
      };

      // JIKA DALAM MODE EDIT (menggunakan ID siswa yang sedang diedit)
      if (editingStudent && editingStudent.id) {
        const studentRef = doc(db, 'classes', selectedClass, 'students', editingStudent.id);
        await updateDoc(studentRef, studentData);
        toast.success('Data siswa berhasil diperbarui');
      } else {
        // MODE TAMBAH BARU
        await addDoc(collection(db, 'classes', selectedClass, 'students'), { 
          ...studentData, 
          created_at: new Date().toISOString() 
        });
        toast.success('Siswa baru berhasil ditambahkan');
      }

      resetStudentForm();
      loadStudents(selectedClass, true);
    } catch (error: any) {
      toast.error('Gagal menyimpan siswa: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student); // Mengunci referensi data dan ID siswa yang sedang diedit
    if (student.class_id) {
      setSelectedClass(student.class_id);
    }
    setStudentName(student.name || ''); 
    setStudentNisn(student.nisn || ''); 
    setStudentNis(student.nis || '');
    setStudentGender(student.gender || ''); 
    setStudentReligion(student.religion || '');
    setStudentBirthPlace(student.birth_place || ''); 
    setStudentBirthDate(student.birth_date || ''); 
    setStudentAge(student.age || '');
    setStudentFatherName(student.father_name || ''); 
    setStudentMotherName(student.mother_name || '');
    setStudentFatherOcc(student.father_occupation || ''); 
    setStudentMotherOcc(student.mother_occupation || '');
    setStudentAddress(student.address || '');
    setActiveTab('siswa');
    window.scrollTo({ top: 100, behavior: 'smooth' });
  };

  const handleDeleteStudent = async (classId: string, studentId: string) => {
    if (!confirm('Hapus data siswa ini?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'classes', classId, 'students', studentId));
      toast.success('Siswa dihapus');
      loadStudents(classId, true);
    } catch (error) {
      toast.error('Gagal menghapus');
    } finally {
      setActionLoading(false);
    }
  };

  const exportDaftarSiswaCSV = () => {
    const listToExport = selectedClass ? (students[selectedClass] || []) : Object.values(students).flat();
    if (listToExport.length === 0) return toast.error('Tidak ada data siswa untuk diekspor');

    let csvContent = 'data:text/csv;charset=utf-8,No,Nama Siswa,NISN,NIS,L/P,Agama,Tempat Lahir,Tanggal Lahir,Usia,Nama Ayah,Pekerjaan Ayah,Nama Ibu,Pekerjaan Ibu,Alamat\n';
    
    listToExport.forEach((s, idx) => {
      const row = [
        idx + 1,
        `"${s.name || ''}"`,
        `"${s.nisn || ''}"`,
        `"${s.nis || ''}"`,
        `"${s.gender || ''}"`,
        `"${s.religion || ''}"`,
        `"${s.birth_place || ''}"`,
        `"${s.birth_date || ''}"`,
        `"${s.age || ''}"`,
        `"${s.father_name || ''}"`,
        `"${s.father_occupation || ''}"`,
        `"${s.mother_name || ''}"`,
        `"${s.mother_occupation || ''}"`,
        `"${s.address || ''}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Daftar_Siswa_${selectedClass ? classes.find(c => c.id === selectedClass)?.name || 'Kelas' : 'Semua_Kelas'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Daftar siswa berhasil diunduh');
  };

  const downloadTemplateXLSX = async () => {
    try {
      const XLSX = await import('xlsx');
      const data = [
        ['Nama Lengkap', 'NISN', 'NIS', 'L/P', 'Agama', 'Tempat Lahir', 'Tanggal Lahir (YYYY-MM-DD)', 'Usia', 'Nama Ayah', 'Pekerjaan Ayah', 'Nama Ibu', 'Pekerjaan Ibu', 'Alamat Lengkap'],
        ['Budi Santoso', '0012345678', '1011', 'L', 'Islam', 'Jakarta', '2016-05-14', '10', 'Agus Santoso', 'Wiraswasta', 'Siti Aminah', 'Ibu Rumah Tangga', 'Jl. Merdeka No 10']
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa');
      XLSX.writeFile(workbook, 'Template_Master_Data_Siswa.xlsx');
    } catch (error) {
      toast.error('Gagal mengunduh template');
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
        return;
      }

      const data: any[] = utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (data.length < 2) {
        setImportError('File XLSX kosong atau tidak memiliki data siswa');
        return;
      }

      // Ambil seluruh siswa di kelas agar impor bisa memperbarui dokumen yang sudah ada.
      const studentsRef = collection(db, 'classes', selectedClass, 'students');
      const existingSnapshot = await getDocs(studentsRef);
      type ExistingStudent = { id: string; data: Record<string, any> };
      const existingStudents: ExistingStudent[] = existingSnapshot.docs.map((studentDoc) => ({
        id: studentDoc.id,
        data: studentDoc.data(),
      }));

      const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('id-ID');
      const normalizeId = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, '');
      const byNisn = new Map<string, ExistingStudent>();
      const byNis = new Map<string, ExistingStudent>();
      const byName = new Map<string, ExistingStudent[]>();

      const addToIndexes = (student: ExistingStudent) => {
        const nisn = normalizeId(student.data.nisn);
        const nis = normalizeId(student.data.nis);
        const name = normalize(student.data.name);
        if (nisn) byNisn.set(nisn, student);
        if (nis) byNis.set(nis, student);
        if (name) {
          const matches = byName.get(name) || [];
          if (!matches.some((item) => item.id === student.id)) matches.push(student);
          byName.set(name, matches);
        }
      };
      existingStudents.forEach(addToIndexes);

      // Satu batch Firestore maksimal 500 operasi; commit per 450 agar tetap aman.
      let batch = writeBatch(db);
      let operationsInBatch = 0;
      let createdCount = 0;
      let updatedCount = 0;
      let validRowsCount = 0;
      const commitBatchIfNeeded = async (force = false) => {
        if (operationsInBatch >= 450 || (force && operationsInBatch > 0)) {
          await batch.commit();
          batch = writeBatch(db);
          operationsInBatch = 0;
        }
      };

      for (const row of data.slice(1)) {
        const name = String(row[0] ?? '').trim();
        if (!name) continue;

        const nisn = normalizeId(row[1]);
        const nis = normalizeId(row[2]);
        const normalizedName = normalize(name);
        let matched: ExistingStudent | undefined;

        if (nisn) matched = byNisn.get(nisn);
        if (!matched && nis) matched = byNis.get(nis);
        // Nama dipakai sebagai fallback bila tidak ada kecocokan ID.
        // Jika nama tidak unik, jangan menimpa siswa yang salah.
        if (!matched) {
          const sameName = byName.get(normalizedName) || [];
          if (sameName.length === 1) matched = sameName[0];
        }

        const tglLahir = String(row[6] ?? '').trim();
        const studentData = {
          name,
          nisn: String(row[1] ?? '').trim(),
          nis: String(row[2] ?? '').trim(),
          gender: String(row[3] ?? '').trim().toUpperCase() === 'P'
            ? 'P'
            : (String(row[3] ?? '').trim().toUpperCase() === 'L' ? 'L' : ''),
          religion: String(row[4] ?? '').trim(),
          birth_place: String(row[5] ?? '').trim(),
          birth_date: tglLahir,
          age: String(row[7] ?? '').trim() || hitungUsia(tglLahir),
          father_name: String(row[8] ?? '').trim(),
          father_occupation: String(row[9] ?? '').trim(),
          mother_name: String(row[10] ?? '').trim(),
          mother_occupation: String(row[11] ?? '').trim(),
          address: String(row[12] ?? '').trim(),
          updated_at: new Date().toISOString(),
        };

        let target: ExistingStudent;
        if (matched) {
          target = { id: matched.id, data: { ...matched.data, ...studentData } };
          batch.set(doc(db, 'classes', selectedClass, 'students', matched.id), {
            ...studentData,
            created_at: matched.data.created_at || new Date().toISOString(),
          }, { merge: true });
          updatedCount++;
        } else {
          const newRef = doc(studentsRef);
          target = {
            id: newRef.id,
            data: { ...studentData, created_at: new Date().toISOString() },
          };
          batch.set(newRef, target.data);
          createdCount++;
        }

        // Perbarui indeks agar baris berulang dalam file yang sama tidak membuat duplikat.
        addToIndexes(target);
        operationsInBatch++;
        validRowsCount++;
        await commitBatchIfNeeded();
      }

      await commitBatchIfNeeded(true);

      if (validRowsCount > 0) {
        toast.success(`Impor selesai: ${createdCount} siswa baru, ${updatedCount} siswa diperbarui`);
        await loadStudents(selectedClass, true);
        setShowImportForm(false);
      } else {
        setImportError('Tidak ada data siswa yang valid ditemukan');
      }
    } catch (error: any) {
      console.error('Gagal impor data siswa XLSX:', error);
      setImportError('Gagal membaca atau menyimpan file XLSX. Periksa format file dan akses Firestore.');
      toast.error('Terjadi kesalahan saat import data');
    } finally {
      setActionLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const allStudentsList: Student[] = Object.values(students).flat();
  const reportTargetStudents = reportFilterClass === 'all' 
    ? allStudentsList 
    : (students[reportFilterClass] || []);

  const currentStudents = selectedClass ? (students[selectedClass] || []) : [];

  useEffect(() => {
    setFilteredReportStudents(reportTargetStudents);
    setSelectedReportCategory(`Semua Siswa (${reportFilterClass === 'all' ? 'Gabungan Seluruh Kelas' : classes.find(c => c.id === reportFilterClass)?.name})`);
  }, [reportFilterClass, students]);

  if (!user) return null;

  return (
    <div className="p-4 md:p-6 bg-[#f8fafc] min-h-screen max-w-[1600px] mx-auto space-y-6">
      
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Data Induk &middot; TP 2026/2027</p>
        <h1 className="text-2xl font-bold text-gray-900">Data Kelas & Siswa</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <BookOpen className="w-5 h-5 text-emerald-600"/>, label: 'Kelas terdaftar', count: classes.length, bg: 'bg-emerald-100' },
          { icon: <UsersIcon className="w-5 h-5 text-blue-600"/>, label: 'Jumlah siswa (semua kelas)', count: allStudentsList.length, bg: 'bg-blue-100' },
          { icon: <UsersIcon className="w-5 h-5 text-blue-500"/>, label: 'Laki-laki', count: allStudentsList.filter(s => s.gender === 'L').length, bg: 'bg-blue-50' },
          { icon: <UsersIcon className="w-5 h-5 text-orange-500"/>, label: 'Perempuan', count: allStudentsList.filter(s => s.gender === 'P').length, bg: 'bg-orange-50' }
        ].map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${item.bg}`}>{item.icon}</div>
              <div className="text-3xl font-bold text-gray-800">{item.count}</div>
            </div>
            <div className="text-sm font-medium text-gray-500">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
        <label className="block text-xs font-medium text-gray-500 mb-2">Filter laporan & manajemen berdasarkan kelas</label>
        <select 
          value={selectedClass} 
          onChange={handleClassChange}
          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 font-medium text-gray-700"
        >
          <option value="" disabled>-- Pilih Kelas Terlebih Dahulu --</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} - Tingkat {c.grade}</option>)}
        </select>
        <p className="text-[11px] text-gray-400 mt-1.5">Digunakan saat menambah siswa baru ke kelas yang bersangkutan.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-px">
        <Button 
          variant={activeTab === 'siswa' ? 'default' : 'outline'} 
          className={activeTab === 'siswa' ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-600'}
          onClick={() => setActiveTab('siswa')}
        >
          <UsersIcon className="w-4 h-4 mr-2" /> Data Siswa ({currentStudents.length})
        </Button>
        <Button 
          variant={activeTab === 'kelas' ? 'default' : 'outline'} 
          className={activeTab === 'kelas' ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-600'}
          onClick={() => setActiveTab('kelas')}
        >
          <BookOpen className="w-4 h-4 mr-2" /> Daftar Kelas ({classes.length})
        </Button>
        <Button 
          variant={activeTab === 'laporan' ? 'default' : 'outline'} 
          className={activeTab === 'laporan' ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-600'}
          onClick={() => setActiveTab('laporan')}
        >
          <BarChart3 className="w-4 h-4 mr-2" /> Laporan & Rekap
        </Button>
      </div>

      {activeTab === 'siswa' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-gray-600" />
                <h2 className="font-semibold text-gray-800 text-sm">
                  {editingStudent ? 'Edit Data Siswa' : 'Tambah Data Siswa'}
                </h2>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  onClick={exportDaftarSiswaCSV}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" /> Unduh Daftar Siswa
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  onClick={() => setShowImportForm(!showImportForm)}
                >
                  <Upload className="w-4 h-4 mr-1.5" /> Impor Excel (.xlsx)
                </Button>
              </div>
            </div>
            
            <div className="p-5 space-y-5">
              {!selectedClass && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-lg text-sm flex items-center gap-2">
                  <Info className="w-4 h-4" /> Buat dan pilih kelas di atas terlebih dahulu sebelum memasukkan siswa.
                </div>
              )}

              {showImportForm && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                  <p className="text-sm font-semibold text-emerald-900">Impor Data Siswa Massal via Excel</p>
                  <p className="text-xs text-emerald-700">Unduh template terlebih dahulu, isi datanya sesuai format kolom, lalu unggah file ke sini.</p>
                  {importError && <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">{importError}</div>}
                  <div className="flex flex-wrap gap-3 items-center pt-2">
                    <Button size="sm" variant="outline" className="bg-white text-emerald-800 border-emerald-300" onClick={downloadTemplateXLSX}>
                      <Download className="w-4 h-4 mr-2"/> Unduh Template Excel
                    </Button>
                    <label className="cursor-pointer">
                      <Button size="sm" asChild disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <span>{actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2"/>} Pilih & Unggah File Excel</span>
                      </Button>
                      <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportXLSX} disabled={actionLoading} />
                    </label>
                    <Button size="sm" variant="ghost" onClick={() => setShowImportForm(false)}>Tutup</Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nama lengkap *</label>
                  <Input placeholder="Sesuai dokumen" value={studentName} onChange={e => setStudentName(e.target.value)} disabled={!selectedClass} className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">NISN</label>
                  <Input placeholder="Nomor NISN" value={studentNisn} onChange={e => setStudentNisn(e.target.value)} disabled={!selectedClass} className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">NIS</label>
                  <Input placeholder="Nomor Induk Siswa" value={studentNis} onChange={e => setStudentNis(e.target.value)} disabled={!selectedClass} className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Jenis kelamin</label>
                  <select className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm bg-gray-50 outline-none focus:border-blue-500" value={studentGender} onChange={e => setStudentGender(e.target.value as 'L'|'P'|'')} disabled={!selectedClass}>
                    <option value="">Pilih</option>
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Agama</label>
                  <select className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm bg-gray-50 outline-none focus:border-blue-500" value={studentReligion} onChange={e => setStudentReligion(e.target.value)} disabled={!selectedClass}>
                    <option value="">Pilih Agama</option>
                    <option value="Islam">Islam</option>
                    <option value="Kristen">Kristen</option>
                    <option value="Katolik">Katolik</option>
                    <option value="Hindu">Hindu</option>
                    <option value="Buddha">Buddha</option>
                    <option value="Konghucu">Konghucu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tempat lahir</label>
                  <Input placeholder="Kota kelahiran" value={studentBirthPlace} onChange={e => setStudentBirthPlace(e.target.value)} disabled={!selectedClass} className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal lahir *</label>
                  <Input type="date" value={studentBirthDate} disabled={!selectedClass} className="bg-gray-50 text-sm" onChange={(e) => {
                    setStudentBirthDate(e.target.value);
                    setStudentAge(hitungUsia(e.target.value));
                  }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Usia (Otomatis)</label>
                  <Input placeholder="Thn" value={studentAge} readOnly disabled className="bg-gray-100 text-gray-500 font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Ayah</label>
                  <Input placeholder="Nama Ayah" value={studentFatherName} onChange={e => setStudentFatherName(e.target.value)} disabled={!selectedClass} className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Pekerjaan Ayah</label>
                  <select className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm bg-gray-50 outline-none focus:border-blue-500" value={studentFatherOcc} onChange={e => setStudentFatherOcc(e.target.value)} disabled={!selectedClass}>
                    <option value="">-- Pilih Pekerjaan --</option>
                    {PEKERJAAN_LIST.map((p, idx) => <option key={idx} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Ibu</label>
                  <Input placeholder="Nama Ibu" value={studentMotherName} onChange={e => setStudentMotherName(e.target.value)} disabled={!selectedClass} className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Pekerjaan Ibu</label>
                  <select className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm bg-gray-50 outline-none focus:border-blue-500" value={studentMotherOcc} onChange={e => setStudentMotherOcc(e.target.value)} disabled={!selectedClass}>
                    <option value="">-- Pilih Pekerjaan --</option>
                    {PEKERJAAN_LIST.map((p, idx) => <option key={idx} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Alamat Lengkap</label>
                  <Input placeholder="Alamat rumah..." value={studentAddress} onChange={e => setStudentAddress(e.target.value)} disabled={!selectedClass} className="bg-gray-50" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
                <Button onClick={handleSaveStudent} disabled={actionLoading || !selectedClass} className="bg-gray-800 hover:bg-gray-900 text-white shadow-sm">
                  {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (editingStudent ? 'Perbarui Data Siswa' : 'Simpan Siswa')}
                </Button>
                {editingStudent && (
                  <Button variant="outline" onClick={resetStudentForm} disabled={actionLoading}>Batal Edit</Button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
             <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4 bg-gray-50/50">
               <div className="flex items-center gap-2">
                 <UsersIcon className="w-5 h-5 text-gray-600" />
                 <h2 className="font-semibold text-gray-800 text-sm">Daftar Siswa {selectedClass ? `(${classes.find(c=>c.id===selectedClass)?.name})` : ''}</h2>
               </div>
             </div>
             
             <div className="overflow-x-auto">
                <Table className="w-full text-sm">
                  <TableHeader className="bg-gray-50 text-gray-600">
                    <TableRow className="border-b border-gray-200">
                      <TableHead className="w-12 text-center py-3">No.</TableHead>
                      <TableHead className="py-3 font-semibold">Nama siswa</TableHead>
                      <TableHead className="py-3 font-semibold">NISN / NIS</TableHead>
                      <TableHead className="py-3 font-semibold text-center">L/P</TableHead>
                      <TableHead className="py-3 font-semibold text-center">Agama</TableHead>
                      <TableHead className="py-3 font-semibold text-center">Tempat, Tgl Lahir</TableHead>
                      <TableHead className="py-3 font-semibold text-center">Usia</TableHead>
                      <TableHead className="py-3 font-semibold text-right pr-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!selectedClass ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-10">Pilih kelas di atas terlebih dahulu.</TableCell></TableRow>
                    ) : currentStudents.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-10">Belum ada data siswa di kelas ini.</TableCell></TableRow>
                    ) : (
                      currentStudents.map((student, index) => (
                        <Fragment key={student.id}>
                          <TableRow className="hover:bg-gray-50/80 border-b border-gray-100">
                            <TableCell className="text-center text-gray-500">{index + 1}</TableCell>
                            <TableCell className="font-medium text-gray-800">{student.name}</TableCell>
                            <TableCell className="text-gray-600">
                              <div className="text-xs font-medium">NISN: {student.nisn || '-'}</div>
                              <div className="text-xs text-gray-400">NIS: {student.nis || '-'}</div>
                            </TableCell>
                            <TableCell className="text-center text-gray-600">{student.gender || '-'}</TableCell>
                            <TableCell className="text-center text-gray-600">{student.religion || '-'}</TableCell>
                            <TableCell className="text-center text-gray-600 text-xs">
                              {student.birth_place || '-' }, {formatTanggalPanjang(student.birth_date)}
                            </TableCell>
                            <TableCell className="text-center text-gray-600">
                               {student.age ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{student.age} Thn</span> : '-'}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => setExpandedStudent(expandedStudent === student.id ? null : student.id)}>
                                  {expandedStudent === student.id ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => handleEditStudent(student)}><Edit2 className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => handleDeleteStudent(selectedClass, student.id)}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedStudent === student.id && (
                            <TableRow className="bg-gray-50 border-b border-gray-200">
                              <TableCell colSpan={8} className="p-4 px-6 shadow-inner">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-sm">
                                  <div><span className="text-gray-400 block text-[11px] uppercase mb-1">Ayah & Pekerjaan</span><span className="font-medium text-gray-700">{student.father_name || '-'} ({student.father_occupation || '-'})</span></div>
                                  <div><span className="text-gray-400 block text-[11px] uppercase mb-1">Ibu & Pekerjaan</span><span className="font-medium text-gray-700">{student.mother_name || '-'} ({student.mother_occupation || '-'})</span></div>
                                  <div className="md:col-span-2"><span className="text-gray-400 block text-[11px] uppercase mb-1">Alamat Lengkap</span><span className="font-medium text-gray-700">{student.address || '-'}</span></div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'kelas' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-5">
            <h2 className="font-semibold text-gray-800 text-sm mb-4 border-b border-gray-100 pb-3">
               {editingClass ? 'Edit Kelas' : 'Tambah Kelas Baru'}
            </h2>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Kelas</label>
                <Input placeholder="Misal: Kelas II A" value={className} onChange={e => setClassName(e.target.value)} className="w-64 bg-gray-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tingkat / Grade</label>
                <Input placeholder="Misal: 2" value={classGrade} onChange={e => setClassGrade(e.target.value)} className="w-32 bg-gray-50" />
              </div>
              <Button onClick={handleSaveClass} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Simpan Kelas
              </Button>
              {editingClass && <Button variant="outline" onClick={() => {setEditingClass(null); setClassName(''); setClassGrade('');}}>Batal</Button>}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
             <div className="p-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
               <BookOpen className="w-5 h-5 text-gray-600" />
               <h2 className="font-semibold text-gray-800 text-sm">Daftar Semua Kelas</h2>
             </div>
             <Table className="w-full text-sm">
                <TableHeader className="bg-gray-50 text-gray-600">
                  <TableRow>
                    <TableHead className="w-16 text-center py-3">No</TableHead>
                    <TableHead className="py-3">Nama Kelas</TableHead>
                    <TableHead className="py-3 text-center">Tingkat</TableHead>
                    <TableHead className="py-3 text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-10">Belum ada kelas.</TableCell></TableRow>
                  ) : (
                    classes.map((cls, idx) => (
                      <TableRow key={cls.id} className="hover:bg-gray-50 border-b border-gray-100">
                        <TableCell className="text-center text-gray-500">{idx + 1}</TableCell>
                        <TableCell className="font-medium text-gray-800">{cls.name}</TableCell>
                        <TableCell className="text-center text-gray-600">{cls.grade}</TableCell>
                        <TableCell className="text-right pr-4">
                           <Button size="icon" variant="ghost" className="text-gray-400 hover:text-blue-600" onClick={() => handleEditClass(cls)}><Edit2 className="w-4 h-4" /></Button>
                           <Button size="icon" variant="ghost" className="text-gray-400 hover:text-red-600" onClick={() => handleDeleteClass(cls.id)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
             </Table>
          </div>
        </div>
      )}

      {activeTab === 'laporan' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500">Pilih Cakupan Laporan</p>
              <h3 className="font-bold text-gray-800 text-base">Rekapitulasi Data Siswa</h3>
            </div>
            <select 
              value={reportFilterClass} 
              onChange={e => setReportFilterClass(e.target.value)}
              className="border border-gray-300 rounded-lg p-2 text-sm bg-gray-50 font-medium text-gray-700 min-w-[220px]"
            >
              <option value="all">Gabungan Seluruh Kelas</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600"/> Rekap Usia Siswa per Kelas
                </h3>
                <p className="text-xs text-gray-500 mt-1">Klik salah satu baris kelompok usia di bawah untuk melihat daftar nama anak di tabel bawah</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportDaftarSiswaCSV} className="bg-white text-gray-700">
                  <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" /> Unduh Laporan (CSV)
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.print()} className="bg-white">
                  Cetak / PDF
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 cursor-pointer hover:bg-blue-50 transition-colors" onClick={() => { setFilteredReportStudents(reportTargetStudents); setSelectedReportCategory('Semua Siswa pada Laporan'); }}>
                <div className="text-2xl font-bold text-gray-800">{reportTargetStudents.length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Jumlah Siswa (Klik Tampilkan Semua)</div>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{reportTargetStudents.filter(s => s.gender === 'L').length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Laki-laki</div>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-500">{reportTargetStudents.filter(s => s.gender === 'P').length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Perempuan</div>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-500">{reportTargetStudents.filter(s => !s.birth_date).length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Tgl Lahir Kosong</div>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table className="w-full text-sm">
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="py-3 font-semibold">Kelompok Usia (Klik untuk Filter)</TableHead>
                    <TableHead className="py-3 font-semibold text-center">Jumlah</TableHead>
                    <TableHead className="py-3 font-semibold text-center">Laki-laki</TableHead>
                    <TableHead className="py-3 font-semibold text-center">Perempuan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const getAgeNum = (ageStr?: string) => parseInt(ageStr || '0', 10);
                    
                    const under6 = reportTargetStudents.filter(s => s.birth_date && getAgeNum(s.age) < 6);
                    const age67 = reportTargetStudents.filter(s => s.birth_date && getAgeNum(s.age) >= 6 && getAgeNum(s.age) <= 7);
                    const age89 = reportTargetStudents.filter(s => s.birth_date && getAgeNum(s.age) >= 8 && getAgeNum(s.age) <= 9);
                    const age1011 = reportTargetStudents.filter(s => s.birth_date && getAgeNum(s.age) >= 10 && getAgeNum(s.age) <= 11);
                    const over12 = reportTargetStudents.filter(s => s.birth_date && getAgeNum(s.age) >= 12);
                    const noBirth = reportTargetStudents.filter(s => !s.birth_date);

                    const rows = [
                      { label: 'Di bawah 6 tahun', data: under6 },
                      { label: '6–7 tahun', data: age67 },
                      { label: '8–9 tahun', data: age89 },
                      { label: '10–11 tahun', data: age1011 },
                      { label: '12 tahun ke atas', data: over12 },
                      { label: 'Belum ada tanggal lahir', data: noBirth },
                    ];

                    return rows.map((r, i) => (
                      <TableRow 
                        key={i} 
                        className="border-b border-gray-100 hover:bg-blue-50/60 cursor-pointer transition-colors"
                        onClick={() => {
                          setFilteredReportStudents(r.data);
                          setSelectedReportCategory(`Kelompok Usia: ${r.label}`);
                        }}
                      >
                        <TableCell className="font-medium text-blue-700 underline">{r.label}</TableCell>
                        <TableCell className="text-center font-semibold">{r.data.length}</TableCell>
                        <TableCell className="text-center text-blue-600">{r.data.filter(s => s.gender === 'L').length}</TableCell>
                        <TableCell className="text-center text-orange-500">{r.data.filter(s => s.gender === 'P').length}</TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-6 space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-emerald-600"/> Rekap Pekerjaan Orang Tua
              </h3>
              <p className="text-xs text-gray-500 mt-1">Klik salah satu jenis pekerjaan di bawah untuk melihat rincian nama siswa pada tabel anak</p>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table className="w-full text-sm">
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="py-3 font-semibold">Jenis Pekerjaan (Klik untuk Filter)</TableHead>
                    <TableHead className="py-3 font-semibold text-center">Ayah</TableHead>
                    <TableHead className="py-3 font-semibold text-center">Ibu</TableHead>
                    <TableHead className="py-3 font-semibold text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PEKERJAAN_LIST.map((pek, idx) => {
                    const ayahList = reportTargetStudents.filter(s => s.father_occupation === pek);
                    const ibuList = reportTargetStudents.filter(s => s.mother_occupation === pek);
                    const combinedList = Array.from(new Set([...ayahList, ...ibuList]));
                    const totalPek = ayahList.length + ibuList.length;
                    
                    if (totalPek === 0) return null;

                    return (
                      <TableRow 
                        key={idx} 
                        className="border-b border-gray-100 hover:bg-emerald-50/60 cursor-pointer transition-colors"
                        onClick={() => {
                          setFilteredReportStudents(combinedList);
                          setSelectedReportCategory(`Pekerjaan Orang Tua: ${pek}`);
                        }}
                      >
                        <TableCell className="font-medium text-emerald-700 underline">{pek}</TableCell>
                        <TableCell className="text-center">{ayahList.length}</TableCell>
                        <TableCell className="text-center">{ibuList.length}</TableCell>
                        <TableCell className="text-center font-bold text-gray-900">{totalPek}</TableCell>
                      </TableRow>
                    );
                  })}
                  {reportTargetStudents.every(s => !s.father_occupation && !s.mother_occupation) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-400 py-8">Belum ada data pekerjaan orang tua yang tercatat.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  <UsersIcon className="w-5 h-5 text-gray-700" /> Daftar Siswa pada Laporan
                </h3>
                <p className="text-xs text-blue-600 font-medium mt-0.5">Filter aktif: {selectedReportCategory} ({filteredReportStudents.length} siswa)</p>
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-12 text-center py-3">No.</TableHead>
                    <TableHead className="py-3 font-semibold">Nama</TableHead>
                    <TableHead className="py-3 font-semibold">NIS/NISN</TableHead>
                    <TableHead className="py-3 font-semibold text-center">L/P</TableHead>
                    <TableHead className="py-3 font-semibold text-center">Tanggal lahir</TableHead>
                    <TableHead className="py-3 font-semibold text-center">Usia</TableHead>
                    <TableHead className="py-3 font-semibold">Kelas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReportStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-10">Belum ada siswa pada filter ini.</TableCell>
                    </TableRow>
                  ) : (
                    filteredReportStudents.map((st, i) => {
                      const parentClassName = classes.find(c => c.id === st.class_id)?.name || 'Kelas Tidak Diketahui';
                      return (
                        <TableRow key={st.id || i} className="hover:bg-gray-50 border-b border-gray-100">
                          <TableCell className="text-center text-gray-500">{i + 1}</TableCell>
                          <TableCell className="font-medium text-gray-800">{st.name}</TableCell>
                          <TableCell className="text-gray-500 text-xs">{st.nisn || '-'}{st.nis ? ` / ${st.nis}` : ''}</TableCell>
                          <TableCell className="text-center">{st.gender || '-'}</TableCell>
                          <TableCell className="text-center text-xs">{formatTanggalPanjang(st.birth_date)}</TableCell>
                          <TableCell className="text-center">{st.age ? `${st.age} Thn` : '-'}</TableCell>
                          <TableCell className="text-xs font-medium text-blue-700">{parentClassName}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
