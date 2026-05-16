'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc, addDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, FileText, Trash2, Eye, Pencil } from 'lucide-react';
import { Packer } from 'docx';
import { generateQuestionDocument, generateAnswerKeyDocument, QuestionData } from '@/lib/docx-utils';
import { toast } from 'sonner';
import { LoadingCard } from '@/components/ui/loading';

interface BankSoalItem {
  id: string;
  user_id: string;
  subject: string;
  kelas: string;
  examTitle: string;
  duration: number;
  difficulty: string;
  optionsCount: number;
  questions: QuestionData;
  includeTP: boolean;
  includeImage?: boolean;
  created_at: string;
  tp_texts?: Array<{ id: string; tp: string; chapter: string }>;
}

export default function BankSoalPage() {
  const { user } = useAuth();
  
  const [bankSoal, setBankSoal] = useState<BankSoalItem[]>([]);
  const [filteredSoal, setFilteredSoal] = useState<BankSoalItem[]>([]);
  const [masterTPs, setMasterTPs] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  
  const [selectedKelas, setSelectedKelas] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSoal, setSelectedSoal] = useState<BankSoalItem | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [availableKelas, setAvailableKelas] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showTPInDownload, setShowTPInDownload] = useState(true);
  const ITEMS_PER_PAGE = 10;

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSoal, setEditSoal] = useState<BankSoalItem | null>(null);
  const [editMC, setEditMC] = useState<any[]>([]);
  const [editEssay, setEditEssay] = useState<any[]>([]);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [metaKelas, setMetaKelas] = useState('');
  const [metaSubject, setMetaSubject] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDuration, setMetaDuration] = useState(60);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDefaultTP, setUploadDefaultTP] = useState(''); 

  useEffect(() => {
    if (user) {
      loadBankSoal();
      loadMasterTPs(); 
    }
  }, [user]);

  useEffect(() => {
    let filtered = bankSoal;
    if (selectedKelas) filtered = filtered.filter((item) => String(item.kelas) === String(selectedKelas));
    if (selectedSubject) filtered = filtered.filter((item) => item.subject === selectedSubject);
    setFilteredSoal(filtered);
  }, [selectedKelas, selectedSubject, bankSoal]);

  // FUNGSI MEMUAT DATABASE TP MENGGUNAKAN NAMA TABEL YANG TEPAT
  const loadMasterTPs = async () => {
    if (!user) return;
    try {
      // Sesuai temuan kita: nama koleksinya adalah 'learning_goals'
      const namaKoleksiTP = 'learning_goals'; 
      
      const q = query(collection(db, namaKoleksiTP), where('user_id', '==', user.uid));
      const snapshot = await getDocs(q);
      const tpData: any[] = [];
      snapshot.forEach(doc => tpData.push(doc.data()));
      setMasterTPs(tpData);
      
    } catch (e) {
      console.error("EROR MEMUAT DATABASE TP:", e);
    }
  };

  const loadBankSoal = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'question_banks'), where('user_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const soal: BankSoalItem[] = [];
      const kelasSet = new Set<string>();
      const subjectSet = new Set<string>();

      querySnapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() } as BankSoalItem;
        soal.push(data);
        if (data.kelas) kelasSet.add(data.kelas);
        if (data.subject) subjectSet.add(data.subject);
      });

      soal.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setBankSoal(soal);
      setFilteredSoal(soal);
      setAvailableKelas(Array.from(kelasSet).sort());
      setAvailableSubjects(Array.from(subjectSet).sort());
    } catch (error) {
      toast.error('Gagal memuat Bank Soal');
    } finally {
      setLoading(false);
    }
  };

  // EKSTRAKTOR BAB: Hanya mengambil "Bab 6" atau "Bab VI", abaikan kata sisanya
  const extractBab = (text: string) => {
    if (!text) return null;
    const match = text.toLowerCase().match(/bab\s*(\d+|[ivxlcdm]+)/);
    return match ? match[0] : null; 
  };

  // FILTER SANGAT KETAT TERHUBUNG DATABASE TP
  const getFilteredTPs = () => {
    const activeSubject = uploadModalOpen ? metaSubject : editSoal?.subject;
    const activeKelas = uploadModalOpen ? metaKelas : editSoal?.kelas;
    const activeTitle = uploadModalOpen ? metaTitle : editSoal?.examTitle;

    if (!activeSubject || !activeKelas) return [];

    const currentBab = extractBab(activeTitle || ''); // Contoh hasil: "bab 6"
    let extractedTPs: string[] = [];

    // 1. Sedot dari Database Master TP Tersimpan
    masterTPs.forEach(tpItem => {
      const tpSubject = tpItem.subject || tpItem.mapel || tpItem.mata_pelajaran || '';
      const tpKelas = tpItem.grade || tpItem.kelas || tpItem.class || tpItem.tingkat || ''; // Menggunakan kolom grade
      const tpText = tpItem.tp || tpItem.tp_text || tpItem.text || tpItem.name || '';
      
      const tpChapter = (tpItem.chapter || tpItem.bab || tpItem.materi || tpItem.judul || '').toLowerCase();
      // Ekstrak juga nama bab dari database agar presisi (Contoh: "Bab 6 - Uang" -> "bab 6")
      const dbBab = extractBab(tpChapter);

      if (
        tpSubject.toLowerCase() === activeSubject.toLowerCase() &&
        String(tpKelas) === String(activeKelas)
      ) {
        if (tpText) {
          if (currentBab) {
            // Cocokkan HANYA "bab 6" dengan "bab 6" (atau jika ada kata bab 6 di dalam teks TP-nya)
            if (dbBab === currentBab || tpText.toLowerCase().includes(currentBab)) {
              extractedTPs.push(tpText);
            }
          } else {
            extractedTPs.push(tpText);
          }
        }
      }
    });

    // 2. Sedot juga dari riwayat soal (sebagai fallback/tambahan)
    const filteredBank = bankSoal.filter(s => 
      s.subject.toLowerCase() === activeSubject.toLowerCase() && 
      String(s.kelas) === String(activeKelas)
    );

    filteredBank.forEach(soal => {
      const soalBab = extractBab(soal.examTitle || '');
      const mcTps = (soal.questions.multipleChoice || []).map((q: any) => q.relatedTP || q.tp || q.tp_text);
      const essayTps = (soal.questions.essay || []).map((q: any) => q.relatedTP || q.tp || q.tp_text);
      const allSoalTps = [...mcTps, ...essayTps].filter(Boolean) as string[];

      allSoalTps.forEach(tp => {
        if (currentBab) {
          if (soalBab === currentBab || tp.toLowerCase().includes(currentBab)) {
            extractedTPs.push(tp);
          }
        } else {
          extractedTPs.push(tp);
        }
      });
    });

    return Array.from(new Set(extractedTPs)); // Hilangkan data kembar
  };

  const dynamicTPs = getFilteredTPs();

  const handleUploadManualSoal = async () => {
    if (!selectedFile || !metaKelas || !metaSubject || !metaTitle) {
      toast.error('Lengkapi semua form dan pilih file PDF');
      return;
    }
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/bank-soal/upload', { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      if (uploadDefaultTP.trim() !== '') {
        if (result.questions.multipleChoice) {
          result.questions.multipleChoice.forEach((q: any) => q.relatedTP = uploadDefaultTP);
        }
        if (result.questions.essay) {
          result.questions.essay.forEach((q: any) => q.relatedTP = uploadDefaultTP);
        }
      }

      const newBankSoalItem = {
        user_id: user?.uid,
        subject: metaSubject,
        kelas: metaKelas,
        examTitle: metaTitle,
        duration: Number(metaDuration),
        difficulty: 'sedang',
        optionsCount: result.questions.multipleChoice?.[0] ? Object.keys(result.questions.multipleChoice[0].options).length : 3,
        questions: result.questions,
        includeTP: false,
        created_at: new Date().toISOString(),
      };

      await addDoc(collection(db, 'question_banks'), newBankSoalItem);
      toast.success('Soal PDF berhasil diekstrak!');
      
      setUploadModalOpen(false);
      setSelectedFile(null);
      setMetaTitle(''); setMetaKelas(''); setMetaSubject(''); setMetaDuration(60); setUploadDefaultTP('');
      loadBankSoal();
    } catch (error: any) {
      toast.error(error.message || 'Gagal mengekstrak soal');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSaveEditSoal = async () => {
    if (!editSoal) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, 'question_banks', editSoal.id), {
        'questions.multipleChoice': editMC,
        'questions.essay': editEssay,
        examTitle: editSoal.examTitle
      });

      const updatedQuestions = { ...editSoal.questions, multipleChoice: editMC, essay: editEssay };

      setBankSoal(prev => prev.map(item => item.id === editSoal.id ? { ...item, examTitle: editSoal.examTitle, questions: updatedQuestions } : item));
      setFilteredSoal(prev => prev.map(item => item.id === editSoal.id ? { ...item, examTitle: editSoal.examTitle, questions: updatedQuestions } : item));
      
      if (selectedSoal?.id === editSoal.id) {
        setSelectedSoal({ ...selectedSoal, examTitle: editSoal.examTitle, questions: updatedQuestions });
      }

      setEditModalOpen(false);
      toast.success('Perubahan soal, TP, dan bobot berhasil disimpan!');
    } catch (err) {
      toast.error('Gagal menyimpan perubahan');
    } finally {
      setLoading(false);
    }
  };

  const handleExportWord = async (includeAnswerKey: boolean = false) => {
    if (!selectedSoal) return;
    try {
      const doc = includeAnswerKey
        ? generateAnswerKeyDocument(selectedSoal.questions)
        : generateQuestionDocument(selectedSoal.questions, {
            subject: selectedSoal.subject,
            examTitle: selectedSoal.examTitle,
            duration: selectedSoal.duration,
            includeTP: showTPInDownload,
          });

      const blob = await Packer.toBlob(doc);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = includeAnswerKey ? `${selectedSoal.examTitle}_KunciJawaban.docx` : `${selectedSoal.examTitle}_Soal.docx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Gagal export ke Word');
    }
  };

  const handleDeleteSoal = async (soalId: string) => {
    if (!confirm('Yakin ingin menghapus soal ini?')) return;
    try {
      await deleteDoc(doc(db, 'question_banks', soalId));
      setBankSoal(prev => prev.filter(item => item.id !== soalId));
      if (selectedSoal?.id === soalId) { setSelectedSoal(null); setViewMode(false); }
      toast.success('Soal berhasil dihapus');
    } catch (error) {
      toast.error('Gagal menghapus soal');
    }
  };

  return (
    <div className="container mx-auto pb-10">
      <datalist id="tp-list">
        {dynamicTPs.map((tp, idx) => <option key={idx} value={tp} />)}
      </datalist>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bank Soal</h1>
          <p className="mt-2 text-gray-600">Kelola dan gunakan berkas soal ujian secara terpusat</p>
        </div>
        {!viewMode && (
          <Button onClick={() => setUploadModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
            ➕ Upload Soal PDF
          </Button>
        )}
      </div>

      {!viewMode ? (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Filter Soal</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Kelas</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={selectedKelas} onChange={e => setSelectedKelas(e.target.value)}>
                    <option value="">Semua Kelas</option>
                    {availableKelas.map(k => <option key={k} value={k}>Kelas {k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Mata Pelajaran</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                    <option value="">Semua Mata Pelajaran</option>
                    {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button onClick={() => { setSelectedKelas(''); setSelectedSubject(''); }} variant="outline" className="w-full">Reset Filter</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Daftar Soal Tersimpan</CardTitle></CardHeader>
            <CardContent>
              {loading ? <LoadingCard count={3} /> : filteredSoal.length === 0 ? (
                <p className="text-center text-gray-500 py-12">Belum ada soal tersimpan.</p>
              ) : (
                <div className="space-y-3">
                  {filteredSoal.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(soal => (
                    <div key={soal.id} className="border rounded-lg p-4 hover:border-blue-500 transition-colors flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{soal.examTitle}</h3>
                        <p className="text-sm text-gray-600 mt-1">Kelas: {soal.kelas} • Mapel: {soal.subject}</p>
                        <p className="text-sm text-gray-600">PG: {soal.questions.multipleChoice?.length || 0} • Essay: {soal.questions.essay?.length || 0}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => { setSelectedSoal(soal); setViewMode(true); }} size="sm"><Eye className="w-4 h-4 mr-1"/> Muat</Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          setEditSoal(soal);
                          setEditMC(soal.questions.multipleChoice ? JSON.parse(JSON.stringify(soal.questions.multipleChoice)) : []);
                          setEditEssay(soal.questions.essay ? JSON.parse(JSON.stringify(soal.questions.essay)) : []);
                          setEditModalOpen(true);
                        }}><Pencil className="w-4 h-4"/></Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteSoal(soal.id)}><Trash2 className="w-4 h-4"/></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="bg-gray-50 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">{selectedSoal?.examTitle}</CardTitle>
                  <CardDescription>Kelas {selectedSoal?.kelas} • {selectedSoal?.subject} • Durasi {selectedSoal?.duration} menit</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setSelectedSoal(null); setViewMode(false); }}>← Kembali</Button>
                  <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => {
                    setEditSoal(selectedSoal);
                    setEditMC(selectedSoal?.questions.multipleChoice ? JSON.parse(JSON.stringify(selectedSoal.questions.multipleChoice)) : []);
                    setEditEssay(selectedSoal?.questions.essay ? JSON.parse(JSON.stringify(selectedSoal.questions.essay)) : []);
                    setEditModalOpen(true);
                  }}>
                    <Pencil className="w-4 h-4 mr-2" /> Edit Soal & Kunci
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6 bg-white">
              {selectedSoal?.questions.multipleChoice && selectedSoal.questions.multipleChoice.length > 0 && (
                <div>
                  <h3 className="font-bold text-xl text-blue-700 mb-4 border-b pb-2">A. PILIHAN GANDA</h3>
                  <div className="space-y-6">
                    {selectedSoal.questions.multipleChoice.map((q: any, idx: number) => (
                      <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-100 relative">
                        <span className="absolute top-4 right-4 text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">Bobot: {q.weight || 1}</span>
                        <p className="font-medium text-gray-900 mb-3 pr-16">{q.questionNumber}. {q.question}</p>
                        <div className="ml-4 space-y-2 text-sm">
                          {Object.entries(q.options).map(([key, value]) => (
                            <p key={key} className={key === q.correctAnswer ? 'text-green-700 font-bold bg-green-50 p-1 rounded inline-block w-full' : 'p-1'}>
                              {key}. {value as React.ReactNode} {key === q.correctAnswer && " ✓ (Kunci)"}
                            </p>
                          ))}
                        </div>
                        {(q.relatedTP || q.tp || q.tp_text) && (
                           <p className="text-xs text-gray-500 italic mt-4 pt-2 border-t border-gray-200">
                             TP: {q.relatedTP || q.tp || q.tp_text}
                           </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSoal?.questions.essay && selectedSoal.questions.essay.length > 0 && (
                <div className="pt-4 mt-6 border-t">
                  <h3 className="font-bold text-xl text-purple-700 mb-4 border-b pb-2">B. ESSAY / ISIAN</h3>
                  <div className="space-y-4">
                    {selectedSoal.questions.essay.map((q: any, idx: number) => (
                      <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-100 relative">
                        <span className="absolute top-4 right-4 text-xs font-bold bg-purple-100 text-purple-800 px-2 py-1 rounded">Bobot: {q.weight || 10}</span>
                        <p className="font-medium text-gray-900 pr-16">{q.questionNumber}. {q.question}</p>
                        {(q.relatedTP || q.tp || q.tp_text) && (
                           <p className="text-xs text-gray-500 italic mt-3 pt-2 border-t border-gray-200">
                             TP: {q.relatedTP || q.tp || q.tp_text}
                           </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-8 border rounded-xl bg-white shadow-sm overflow-hidden">
             <div className="p-4 bg-purple-50 border-b border-purple-100">
               <label className="flex items-center gap-3 cursor-pointer">
                 <input type="checkbox" checked={showTPInDownload} onChange={(e) => setShowTPInDownload(e.target.checked)} className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer" />
                 <span className="text-sm font-semibold text-purple-900">Tampilkan Tujuan Pembelajaran (TP) dalam file download</span>
               </label>
             </div>
             <div className="p-6 bg-white flex flex-col sm:flex-row gap-4">
               <Button onClick={() => handleExportWord(false)} className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto">
                 <Download className="w-4 h-4 mr-2" /> Download Soal (.docx)
               </Button>
               <Button onClick={() => handleExportWord(true)} variant="outline" className="border-purple-600 text-purple-700 hover:bg-purple-50 w-full sm:w-auto">
                 <FileText className="w-4 h-4 mr-2" /> Download Kunci Jawaban (.docx)
               </Button>
             </div>
          </div>
        </div>
      )}

      {/* SUPER EDIT MODAL DENGAN LAYOUT KOTAK TP & BOBOT BERSEBELAHAN SERTA LABEL INFO TP */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b bg-gray-50">
              <h2 className="text-2xl font-bold text-gray-800">Edit Soal, Kunci & Pembobotan</h2>
              <p className="text-sm text-gray-500 mt-1">Sesuaikan teks soal, pilih kunci jawaban, ubah bobot nilai, dan atur TP.</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Judul Dokumen Soal</label>
                <input className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500" value={editSoal?.examTitle || ''} onChange={e => { if (editSoal) setEditSoal({ ...editSoal, examTitle: e.target.value }); }} />
              </div>

              {editMC.length > 0 && (
                <div className="border border-blue-200 rounded-xl overflow-hidden">
                  <div className="bg-blue-50 px-4 py-3 border-b border-blue-200"><h3 className="font-bold text-blue-800">A. Pilihan Ganda</h3></div>
                  <div className="p-4 space-y-6">
                    {editMC.map((q, idx) => (
                      <div key={idx} className="pb-6 border-b border-gray-200 last:border-0 last:pb-0">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Pertanyaan {idx + 1}</label>
                        <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 mb-3 min-h-[80px]" value={q.question} onChange={e => { const newQ = [...editMC]; newQ[idx].question = e.target.value; setEditMC(newQ); }} />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          {Object.keys(q.options).map((key) => (
                            <div key={key} className={`flex items-start gap-2 p-2 rounded-md border ${q.correctAnswer === key ? 'bg-green-50 border-green-300' : 'bg-gray-50'}`}>
                              <input type="radio" name={`correct-${idx}`} checked={q.correctAnswer === key} onChange={() => { const newQ = [...editMC]; newQ[idx].correctAnswer = key; setEditMC(newQ); }} className="mt-2.5 w-4 h-4 cursor-pointer" />
                              <div className="flex-1">
                                <div className="text-xs font-bold text-gray-600 mb-1">{key}. {q.correctAnswer === key && <span className="text-green-600">(Kunci)</span>}</div>
                                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={q.options[key]} onChange={e => { const newQ = [...editMC]; newQ[idx].options[key] = e.target.value; setEditMC(newQ); }} />
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex flex-row gap-3 items-end">
                          <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                              Tujuan Pembelajaran (TP)
                              {dynamicTPs.length === 0 && <span className="text-orange-500 font-normal ml-1 italic">(Kosong)</span>}
                            </label>
                            <input 
                              list="tp-list"
                              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" 
                              placeholder="Ketik TP atau klik ganda untuk memunculkan daftar..." 
                              value={q.relatedTP || q.tp || q.tp_text || ''} 
                              onChange={e => { const newQ = [...editMC]; newQ[idx].relatedTP = e.target.value; setEditMC(newQ); }} 
                            />
                          </div>
                          <div className="w-20 sm:w-28 flex-shrink-0">
                            <label className="block text-xs font-bold text-gray-700 mb-1 text-center">Bobot Nilai</label>
                            <input 
                              type="number" min="1"
                              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-bold text-blue-700 text-center focus:ring-2 focus:ring-blue-500" 
                              value={q.weight || 1} 
                              onChange={e => { const newQ = [...editMC]; newQ[idx].weight = Number(e.target.value); setEditMC(newQ); }} 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editEssay.length > 0 && (
                <div className="border border-purple-200 rounded-xl overflow-hidden">
                  <div className="bg-purple-50 px-4 py-3 border-b border-purple-200"><h3 className="font-bold text-purple-800">B. Essay / Isian</h3></div>
                  <div className="p-4 space-y-4">
                    {editEssay.map((q, idx) => (
                      <div key={idx} className="pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Pertanyaan {idx + 1}</label>
                        <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 min-h-[80px]" value={q.question} onChange={e => { const newQ = [...editEssay]; newQ[idx].question = e.target.value; setEditEssay(newQ); }} />
                        
                        <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-100 flex flex-row gap-3 items-end mt-3">
                          <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                              Tujuan Pembelajaran (TP)
                              {dynamicTPs.length === 0 && <span className="text-orange-500 font-normal ml-1 italic">(Kosong)</span>}
                            </label>
                            <input 
                              list="tp-list"
                              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" 
                              placeholder="Ketik TP atau klik ganda untuk memunculkan daftar..." 
                              value={q.relatedTP || q.tp || q.tp_text || ''} 
                              onChange={e => { const newQ = [...editEssay]; newQ[idx].relatedTP = e.target.value; setEditEssay(newQ); }} 
                            />
                          </div>
                          <div className="w-20 sm:w-28 flex-shrink-0">
                            <label className="block text-xs font-bold text-gray-700 mb-1 text-center">Bobot Nilai</label>
                            <input 
                              type="number" min="1"
                              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-bold text-purple-700 text-center focus:ring-2 focus:ring-purple-500" 
                              value={q.weight || 10} 
                              onChange={e => { const newQ = [...editEssay]; newQ[idx].weight = Number(e.target.value); setEditEssay(newQ); }} 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <Button onClick={() => setEditModalOpen(false)} variant="outline">Batal</Button>
              <Button onClick={handleSaveEditSoal} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL UPLOAD PDF */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Berkas Soal Baru</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Judul Ujian</label>
                <input className="w-full border rounded-lg px-3 py-2" placeholder="Contoh: Ulangan Harian Bab 6" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} />
                <p className="text-[10px] text-gray-500 mt-1">*Ketik kata "Bab" (contoh: Bab 6) agar daftar TP tersaring otomatis.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold mb-1">Kelas</label><input className="w-full border rounded-lg px-3 py-2" value={metaKelas} onChange={e => setMetaKelas(e.target.value)} /></div>
                <div><label className="block text-xs font-semibold mb-1">Mata Pelajaran</label><input className="w-full border rounded-lg px-3 py-2" value={metaSubject} onChange={e => setMetaSubject(e.target.value)} /></div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <label className="block text-xs font-semibold text-blue-800 mb-1">Tujuan Pembelajaran (Opsional)</label>
                <input 
                  list="tp-list" 
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" 
                  placeholder="TP ini akan diterapkan ke SEMUA soal" 
                  value={uploadDefaultTP} 
                  onChange={e => setUploadDefaultTP(e.target.value)} 
                />
              </div>

              <div><label className="block text-xs font-semibold mb-1">Durasi (Menit)</label><input type="number" className="w-full border rounded-lg px-3 py-2" value={metaDuration} onChange={e => setMetaDuration(Number(e.target.value))} /></div>
              
              <div className="border-2 border-dashed border-gray-300 p-5 rounded-xl text-center relative cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                <p className="text-sm font-medium text-gray-700">{selectedFile ? `📄 ${selectedFile.name}` : 'Klik untuk memilih berkas PDF soal'}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => { setUploadModalOpen(false); setUploadDefaultTP(''); }} variant="outline">Batal</Button>
              <Button onClick={handleUploadManualSoal} disabled={uploadLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
                {uploadLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Proses & Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}