'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUp, Loader2, BookOpen, Check, X, Edit2, FileText } from 'lucide-react';
import { QuotaMonitor } from '@/components/QuotaMonitor';
import { toast } from 'sonner';

interface TPItem {
  chapter: string;
  tps: string[];
  selected: boolean[];
}

interface GeneratedTP {
  semester1: TPItem[];
  semester2: TPItem[];
}

export default function GenerateTPPage() {
  const { user } = useAuth();
  const [inputMethod, setInputMethod] = useState<'text' | 'pdf'>('text');
  const [textContent, setTextContent] = useState('');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [cpReference, setCpReference] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedTP, setGeneratedTP] = useState<GeneratedTP | null>(null);
  const [error, setError] = useState('');
  const [semesterSelection, setSemesterSelection] = useState('both'); // 'both', 'semester1', 'semester2'
  const [materiPokok, setMateriPokok] = useState('');

  // Daftar mata pelajaran SD
  const sdSubjects = [
    'Pendidikan Agama Islam',
    'Pendidikan Agama Kristen',
    'Pendidikan Agama Katolik',
    'Pendidikan Agama Hindu',
    'Pendidikan Agama Buddha',
    'Pendidikan Agama Khonghucu',
    'Pendidikan Pancasila',
    'Bahasa Indonesia',
    'Matematika',
    'IPAS (Ilmu Pengetahuan Alam dan Sosial)',
    'Pendidikan Jasmani Olahraga dan Kesehatan (PJOK)',
    'Seni dan Budaya',
    'Bahasa Inggris',
    'Bahasa Daerah',
    'Seni Rupa',
    'Seni Musik',
    'Seni Tari',
    'Seni Teater',
  ];

  // Check if grade is SD (1-6)
  const isSD = grade && parseInt(grade) >= 1 && parseInt(grade) <= 6;
  
  // Edit mode state
  const [editingChapter, setEditingChapter] = useState<string | null>(null);
  const [editChapterName, setEditChapterName] = useState('');
  const [editingTP, setEditingTP] = useState<{ semester: number; chapterIdx: number; tpIdx: number } | null>(null);
  const [editTPText, setEditTPText] = useState('');
  const [maxLength100, setMaxLength100] = useState(false);

  const handleGenerate = async () => {
    if (!user) {
      setError('User tidak ditemukan');
      return;
    }

    if (!grade || !cpReference) {
      setError('Mohon lengkapi semua field yang diperlukan');
      return;
    }

    if (isSD && !subject) {
      setError('Mohon pilih mata pelajaran untuk kelas SD');
      return;
    }

    if (inputMethod === 'text' && !textContent) {
      setError('Mohon masukkan teks materi');
      return;
    }

    if (inputMethod === 'pdf' && !pdfFile) {
      setError('Mohon upload file PDF');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let pdfBase64 = '';
      
      if (inputMethod === 'pdf') {
        setLoadingMessage('Membaca file PDF...');
        // Convert PDF to base64
        const arrayBuffer = await pdfFile!.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        pdfBase64 = btoa(binary);
        setLoadingMessage('PDF berhasil dibaca, sedang menganalisis...');
      } else {
        setLoadingMessage('Sedang menganalisis materi...');
      }

      // Get Firebase ID token for authentication
      const token = await user.getIdToken();

      // Call API endpoint instead of Server Action
      const response = await fetch('/api/generate-tp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          textContent: inputMethod === 'text' ? textContent : '',
          pdfBase64: pdfBase64,
          grade: grade,
          subject: isSD ? subject : '',
          cpReference: cpReference,
          maxLength100: maxLength100,
          semesterSelection: semesterSelection, // Pass semester selection from dropdown
          materiPokok: materiPokok, // Pass materi pokok (optional)
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle quota errors specifically
        if (result.quotaInfo) {
          setError(`${result.error}\n\n💡 Saran: ${result.quotaInfo.suggestion}`);
        } else {
          throw new Error(result.error || 'Gagal generate TP');
        }
        return;
      }

      if (result.success) {
        // Add selected flags to each TP
        const processedData: GeneratedTP = {
          semester1: result.data.semester1.map((item: any) => ({
            ...item,
            selected: item.tps.map(() => true),
          })),
          semester2: result.data.semester2.map((item: any) => ({
            ...item,
            selected: item.tps.map(() => true),
          })),
        };
        setGeneratedTP(processedData);
        
        // Log quota info for monitoring
        if (result.quotaInfo) {
          console.log('Quota Status:', result.quotaInfo);
        }
      } else {
        setError(result.error || 'Gagal generate TP');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const toggleTPSelection = (semester: 1 | 2, chapterIdx: number, tpIdx: number) => {
    if (!generatedTP) return;
    
    const semesterKey = semester === 1 ? 'semester1' : 'semester2';
    const updated = { ...generatedTP };
    updated[semesterKey][chapterIdx].selected[tpIdx] = !updated[semesterKey][chapterIdx].selected[tpIdx];
    setGeneratedTP(updated);
  };

  const handleEditChapter = (semester: 1 | 2, chapterIdx: number) => {
    if (!generatedTP) return;
    const semesterKey = semester === 1 ? 'semester1' : 'semester2';
    const chapter = generatedTP[semesterKey][chapterIdx];
    setEditingChapter(`${semester}-${chapterIdx}`);
    setEditChapterName(chapter.chapter);
  };

  const saveChapterEdit = (semester: 1 | 2, chapterIdx: number) => {
    if (!generatedTP) return;
    const semesterKey = semester === 1 ? 'semester1' : 'semester2';
    const updated = { ...generatedTP };
    updated[semesterKey][chapterIdx].chapter = editChapterName;
    setGeneratedTP(updated);
    setEditingChapter(null);
  };

  const handleEditTP = (semester: 1 | 2, chapterIdx: number, tpIdx: number) => {
    if (!generatedTP) return;
    const semesterKey = semester === 1 ? 'semester1' : 'semester2';
    const tp = generatedTP[semesterKey][chapterIdx].tps[tpIdx];
    setEditingTP({ semester, chapterIdx, tpIdx });
    setEditTPText(tp);
  };

  const saveTPEdit = () => {
    if (!generatedTP || !editingTP) return;
    const semesterKey = editingTP.semester === 1 ? 'semester1' : 'semester2';
    const updated = { ...generatedTP };
    updated[semesterKey][editingTP.chapterIdx].tps[editingTP.tpIdx] = editTPText;
    setGeneratedTP(updated);
    setEditingTP(null);
  };

  const deleteTP = (semester: 1 | 2, chapterIdx: number, tpIdx: number) => {
    if (!generatedTP || !confirm('Hapus TP ini?')) return;
    const semesterKey = semester === 1 ? 'semester1' : 'semester2';
    const updated = { ...generatedTP };
    updated[semesterKey][chapterIdx].tps.splice(tpIdx, 1);
    updated[semesterKey][chapterIdx].selected.splice(tpIdx, 1);
    
    // If chapter has no more TPs, remove the chapter
    if (updated[semesterKey][chapterIdx].tps.length === 0) {
      updated[semesterKey].splice(chapterIdx, 1);
    }
    
    setGeneratedTP(updated);
  };

  const deleteChapter = (semester: 1 | 2, chapterIdx: number) => {
    if (!generatedTP) return;
    const semesterKey = semester === 1 ? 'semester1' : 'semester2';
    const chapter = generatedTP[semesterKey][chapterIdx];
    
    if (!confirm(`Hapus bab "${chapter.chapter}" beserta ${chapter.tps.length} TP di dalamnya?`)) return;
    
    const updated = { ...generatedTP };
    updated[semesterKey].splice(chapterIdx, 1);
    setGeneratedTP(updated);
  };

  const moveChapter = (fromSemester: 1 | 2, chapterIdx: number, toSemester: 1 | 2) => {
    if (!generatedTP || fromSemester === toSemester) return;
    
    const fromKey = fromSemester === 1 ? 'semester1' : 'semester2';
    const toKey = toSemester === 1 ? 'semester1' : 'semester2';
    const chapter = generatedTP[fromKey][chapterIdx];
    
    if (!confirm(`Pindahkan bab "${chapter.chapter}" dari Semester ${fromSemester} ke Semester ${toSemester}?`)) return;
    
    const updated = { ...generatedTP };
    // Remove from source semester
    updated[fromKey].splice(chapterIdx, 1);
    // Add to target semester
    updated[toKey].push(chapter);
    
    setGeneratedTP(updated);
  };

  const handleSaveToDatabase = async () => {
    if (!user || !generatedTP) return;
    
    setLoading(true);
    try {
      const selectedTPs: any[] = [];
      
      // Collect selected TPs from Semester 1
      generatedTP.semester1.forEach((chapter) => {
        chapter.tps.forEach((tp, idx) => {
          if (chapter.selected[idx]) {
            selectedTPs.push({
              chapter: chapter.chapter,
              tp: tp,
              semester: 1,
              grade: grade,
              subject: isSD ? subject : '',
              cpReference: cpReference,
            });
          }
        });
      });
      
      // Collect selected TPs from Semester 2
      generatedTP.semester2.forEach((chapter) => {
        chapter.tps.forEach((tp, idx) => {
          if (chapter.selected[idx]) {
            selectedTPs.push({
              chapter: chapter.chapter,
              tp: tp,
              semester: 2,
              grade: grade,
              subject: isSD ? subject : '',
              cpReference: cpReference,
            });
          }
        });
      });

      // Save to Firestore with isRaporFormat flag
      for (const tpData of selectedTPs) {
        await addDoc(collection(db, 'learning_goals'), {
          ...tpData,
          user_id: user.uid,
          created_at: new Date().toISOString(),
          isRaporFormat: maxLength100, // Flag untuk membedakan format rapor vs lengkap
        });
      }

      toast.success('Berhasil menyimpan Tujuan Pembelajaran', {
        description: `${selectedTPs.length} TP telah disimpan ke database`
      });
      
      // Reset form
      setGeneratedTP(null);
      setTextContent('');
      setGrade('');
      setSubject('');
      setCpReference('');
      setMateriPokok('');
      setPdfFile(null);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan ke database');
    } finally {
      setLoading(false);
    }
  };

  const renderTPSection = (semester: 1 | 2) => {
    if (!generatedTP) return null;
    const semesterKey = semester === 1 ? 'semester1' : 'semester2';
    const items = generatedTP[semesterKey];

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Semester {semester}</CardTitle>
            <span className="text-sm text-gray-500">
              {items.length} Bab • {items.reduce((sum, ch) => sum + ch.tps.length, 0)} TP
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((chapter, chapterIdx) => (
            <div key={chapterIdx} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                {editingChapter === `${semester}-${chapterIdx}` ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={editChapterName}
                      onChange={(e) => setEditChapterName(e.target.value)}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={() => saveChapterEdit(semester, chapterIdx)}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingChapter(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <h4 className="font-semibold text-lg flex-1">{chapter.chapter}</h4>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moveChapter(semester, chapterIdx, semester === 1 ? 2 : 1)}
                        title={`Pindah ke Semester ${semester === 1 ? 2 : 1}`}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        S{semester === 1 ? 2 : 1}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditChapter(semester, chapterIdx)}
                        title="Edit nama bab"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteChapter(semester, chapterIdx)}
                        title="Hapus bab"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
              
              <div className="space-y-2">
                {chapter.tps.map((tp, tpIdx) => (
                  <div key={tpIdx} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={chapter.selected[tpIdx]}
                      onChange={() => toggleTPSelection(semester, chapterIdx, tpIdx)}
                      className="mt-1"
                    />
                    
                    {editingTP?.semester === semester && 
                     editingTP?.chapterIdx === chapterIdx && 
                     editingTP?.tpIdx === tpIdx ? (
                      <div className="flex-1 flex gap-2">
                        <textarea
                          value={editTPText}
                          onChange={(e) => setEditTPText(e.target.value)}
                          className="flex-1 p-2 border rounded text-sm"
                          rows={3}
                        />
                        <div className="flex flex-col gap-1">
                          <Button size="sm" onClick={saveTPEdit}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingTP(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="text-sm">{tp}</p>
                          {maxLength100 && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                tp.length <= 100 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {tp.length} karakter
                              </span>
                              {tp.length > 100 && (
                                <span className="text-xs text-red-600">⚠️ Melebihi 100 karakter</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditTP(semester, chapterIdx, tpIdx)}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteTP(semester, chapterIdx, tpIdx)}
                          >
                            <X className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Generate Tujuan Pembelajaran</h1>
        <p className="mt-2 text-gray-600">Generate TP otomatis menggunakan AI dari materi pembelajaran</p>
      </div>

      {/* Quota Monitor - Always visible */}
      <div className="mb-6">
        <QuotaMonitor />
      </div>

      {!generatedTP ? (
        <Card>
          <CardHeader>
            <CardTitle>Input Materi Pembelajaran</CardTitle>
            <CardDescription>Pilih metode input dan lengkapi data berikut</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Input method selection */}
            <div className="flex gap-4">
              <Button
                variant={inputMethod === 'text' ? 'default' : 'outline'}
                onClick={() => setInputMethod('text')}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Input Teks
              </Button>
              <Button
                variant={inputMethod === 'pdf' ? 'default' : 'outline'}
                onClick={() => setInputMethod('pdf')}
              >
                <FileUp className="w-4 h-4 mr-2" />
                Upload PDF
              </Button>
            </div>

            {/* Common fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Kelas</label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  title="Pilih kelas atau fase"
                >
                  <option value="">Pilih Kelas/Fase</option>
                  <optgroup label="📚 Fase A (Kelas 1-2 SD)">
                    <option value="1">Kelas 1 SD</option>
                    <option value="2">Kelas 2 SD</option>
                  </optgroup>
                  <optgroup label="📖 Fase B (Kelas 3-4 SD)">
                    <option value="3">Kelas 3 SD</option>
                    <option value="4">Kelas 4 SD</option>
                  </optgroup>
                  <optgroup label="📕 Fase C (Kelas 5-6 SD)">
                    <option value="5">Kelas 5 SD</option>
                    <option value="6">Kelas 6 SD</option>
                  </optgroup>
                </select>
                <p className="text-xs text-blue-600 mt-1">
                  💡 Fase A: Bahasa sangat sederhana | Fase B: Bahasa sederhana | Fase C: Bahasa menengah
                </p>
              </div>

              {isSD && (
                <div>
                  <label className="block text-sm font-medium mb-2">Mata Pelajaran *</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    title="Pilih mata pelajaran"
                  >
                    <option value="">Pilih Mata Pelajaran</option>
                    {sdSubjects.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Mata pelajaran wajib untuk kelas SD
                  </p>
                </div>
              )}

              {/* Semester Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Pilih Semester</label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={semesterSelection}
                  onChange={(e) => setSemesterSelection(e.target.value)}
                  title="Pilih semester untuk generate TP"
                >
                  <option value="both">Semester 1 & 2</option>
                  <option value="semester1">Semester 1</option>
                  <option value="semester2">Semester 2</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Pilih semester untuk membuat atau menampilkan TP
                </p>
              </div>

              {/* Toggle for max 100 characters */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={maxLength100}
                    onChange={(e) => setMaxLength100(e.target.checked)}
                    id="maxLength100"
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="maxLength100" className="text-sm font-medium text-gray-700 cursor-pointer">
                      🎯 Batasi panjang TP maksimal 100 karakter
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Jika diaktifkan, setiap TP akan dibatasi maksimal 100 karakter agar lebih ringkas dan mudah dibaca.
                      Cocok untuk format rapor atau dokumen yang memerlukan TP singkat.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Referensi Capaian Pembelajaran (CP) *
                </label>
                <textarea
                  className="w-full p-3 border rounded-md text-sm"
                  rows={4}
                  placeholder="Contoh:
- Siswa mampu memahami dan menganalisis teks narasi dengan struktur yang benar
- Siswa mampu menyelesaikan operasi hitung bilangan bulat dalam konteks kehidupan sehari-hari
- Siswa mampu menjelaskan proses fotosintesis dan faktor-faktor yang mempengaruhinya"
                  value={cpReference}
                  onChange={(e) => setCpReference(e.target.value)}
                />
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    {cpReference.length} / 2000 karakter (minimal 50 karakter)
                  </p>
                  {cpReference.length > 0 && cpReference.length < 50 && (
                    <p className="text-xs text-amber-600">
                      ⚠️ CP terlalu singkat. Jelaskan kompetensi yang ingin dicapai siswa secara detail.
                    </p>
                  )}
                  {cpReference.length > 1500 && (
                    <p className="text-xs text-amber-600">
                      ⚠️ CP mendekati batas maksimal (2000 karakter)
                    </p>
                  )}
                  <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer hover:text-gray-900 font-medium">💡 Tips menulis CP yang baik</summary>
                    <ul className="mt-2 ml-4 space-y-1 list-disc">
                      <li>Fokus pada kompetensi yang dapat diukur (menganalisis, menerapkan, mengevaluasi)</li>
                      <li>Hindari kata kerja generik (belajar, mengetahui, memahami saja)</li>
                      <li>Sebutkan konteks atau aplikasi (dalam kehidupan sehari-hari, pada teks sederhana, dll)</li>
                      <li>Bisa berupa beberapa poin kompetensi yang saling terkait</li>
                      <li>Rujuk CP dari Kurikulum Merdeka sesuai fase dan mata pelajaran</li>
                    </ul>
                  </details>
                </div>
              </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  📚 Materi Pokok (Opsional)
                </label>
                <textarea
                  className="w-full p-3 border rounded-md text-sm"
                  rows={3}
                  placeholder="Contoh: Bilangan Bulat, Operasi Dasar, Persamaan Linear, Statistik Dasar"
                  value={materiPokok}
                  onChange={(e) => setMateriPokok(e.target.value)}
                />
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    {materiPokok.length} / 500 karakter
                  </p>
                  <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer hover:text-gray-900 font-medium">💡 Mengapa mengisi Materi Pokok?</summary>
                    <ul className="mt-2 ml-4 space-y-1 list-disc">
                      <li>Membantu AI fokus pada topik utama yang ingin Anda prioritaskan</li>
                      <li>Memastikan semua materi pokok yang disebutkan tercakup dalam TP</li>
                      <li>Meningkatkan relevansi dan kedalaman TP yang dihasilkan</li>
                      <li>Sebutkan topik utama dipisahkan dengan koma (tidak perlu detail panjang)</li>
                    </ul>
                  </details>
                </div>
              </div>

            {/* Input method specific */}
            {inputMethod === 'text' ? (
              <div>
                <label className="block text-sm font-medium mb-2">Materi Pembelajaran *</label>
                <textarea
                  className="w-full p-3 border rounded-md text-sm"
                  rows={10}
                  placeholder="Paste materi pembelajaran di sini. Struktur yang baik:

BAB/TOPIK: [Nama Bab]

MATERI POKOK:
- [Konsep utama 1]
- [Konsep utama 2]

URAIAN:
[Penjelasan detail materi dengan contoh dan ilustrasi]

CONTOH SOAL/LATIHAN:
[Jika ada]"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                />
                {textContent.length < 100 && textContent.length > 0 && (
                  <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                    ⚠️ Materi terlalu singkat. Tambahkan detail materi pembelajaran (minimal 100 karakter).
                  </p>
                )}
                {textContent.length > 10000 && (
                  <p className="mt-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                    ⚠️ Teks panjang ({Math.round(textContent.length / 1000)}K karakter). 
                    Akan dipotong otomatis menjadi ~4000 tokens untuk menghemat quota.
                  </p>
                )}
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    {textContent.length} karakter (~{Math.ceil(textContent.length / 4)} tokens)
                  </p>
                  <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer hover:text-gray-900 font-medium">💡 Struktur materi yang efektif</summary>
                    <ul className="mt-2 ml-4 space-y-1 list-disc">
                      <li><strong>Identifikasi Bab/Topik</strong>: Nama bab atau topik utama</li>
                      <li><strong>Materi Pokok</strong>: List konsep-konsep kunci yang akan dipelajari</li>
                      <li><strong>Uraian</strong>: Penjelasan detail dengan contoh konkret</li>
                      <li><strong>Sub-topik</strong>: Pembagian materi yang sistematis</li>
                      <li><strong>Latihan/Contoh</strong>: Jika ada, untuk konteks aplikasi</li>
                    </ul>
                  </details>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2">Upload File PDF *</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                />
                {pdfFile && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-gray-600">📄 File: {pdfFile.name}</p>
                    <p className="text-xs text-gray-500">
                      Ukuran: {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB
                      {pdfFile.size > 10 * 1024 * 1024 && (
                        <span className="text-amber-600"> (⚠️ Maksimal 10 MB)</span>
                      )}
                    </p>
                  </div>
                )}
                <div className="mt-2">
                  <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer hover:text-gray-900 font-medium">📌 Rekomendasi PDF untuk hasil terbaik</summary>
                    <ul className="mt-2 ml-4 space-y-1 list-disc">
                      <li><strong>Ukuran</strong>: Maksimal 10 MB (≈50 halaman)</li>
                      <li><strong>Struktur</strong>: PDF dengan heading/sub-heading yang jelas</li>
                      <li><strong>Format</strong>: Text-based PDF (bukan scan/gambar)</li>
                      <li><strong>Konten</strong>: Buku teks, modul, atau materi terstruktur</li>
                      <li><strong>Tips</strong>: Upload per bab untuk hasil lebih akurat</li>
                    </ul>
                  </details>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            {loading && loadingMessage && (
              <div className="p-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
                <div>
                  <p className="font-medium">{loadingMessage}</p>
                  {inputMethod === 'pdf' && (
                    <p className="text-xs text-blue-600 mt-1">
                      File PDF sedang diproses, mohon tunggu...
                    </p>
                  )}
                </div>
              </div>
            )}

            <Button onClick={handleGenerate} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {loadingMessage || 'Generating...'}
                </>
              ) : (
                <>
                  {inputMethod === 'pdf' ? (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Generate dari PDF
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4 mr-2" />
                      Generate dari Teks
                    </>
                  )}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-900">
                  TP berhasil di-generate! Review dan edit sesuai kebutuhan, kemudian centang TP yang ingin disimpan.
                </p>
                <div className="flex gap-4 text-xs text-blue-700">
                  <span>Kelas: {grade}</span>
                  {isSD && subject && <span>• Mata Pelajaran: {subject}</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(semesterSelection === 'both' || semesterSelection === 'semester1') && renderTPSection(1)}
            {(semesterSelection === 'both' || semesterSelection === 'semester2') && renderTPSection(2)}
          </div>

          <div className="flex gap-4">
            <Button onClick={handleSaveToDatabase} disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan TP Terpilih'
              )}
            </Button>
            <Button variant="outline" onClick={() => setGeneratedTP(null)} size="lg">
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
