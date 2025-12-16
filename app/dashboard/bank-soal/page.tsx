'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore'; // Tambahkan updateDoc disini
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
  // State untuk edit soal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSoal, setEditSoal] = useState<BankSoalItem | null>(null);
  const [editQuestions, setEditQuestions] = useState<any[]>([]);
  
  const { user } = useAuth();
  const [bankSoal, setBankSoal] = useState<BankSoalItem[]>([]);
  const [filteredSoal, setFilteredSoal] = useState<BankSoalItem[]>([]);
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

  useEffect(() => {
    if (user) {
      loadBankSoal();
    }
  }, [user]);

  useEffect(() => {
    // Filter soal based on selected kelas and subject
    let filtered = bankSoal;

    if (selectedKelas) {
      filtered = filtered.filter((item) => item.kelas === selectedKelas);
    }

    if (selectedSubject) {
      filtered = filtered.filter((item) => item.subject === selectedSubject);
    }

    setFilteredSoal(filtered);
  }, [selectedKelas, selectedSubject, bankSoal]);

  const loadBankSoal = async () => {
    if (!user) {
      console.log('No user found, cannot load bank soal');
      return;
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, 'question_banks'),
        where('user_id', '==', user.uid)
      );

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

      // Sort by created_at manually (newest first)
      soal.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setBankSoal(soal);
      setFilteredSoal(soal);
      setAvailableKelas(Array.from(kelasSet).sort());
      setAvailableSubjects(Array.from(subjectSet).sort());

      if (soal.length > 0) {
        toast.success(`Berhasil memuat ${soal.length} soal`);
      } else {
        toast.info('Belum ada soal tersimpan');
      }
    } catch (error: any) {
      console.error('Error loading bank soal:', error);
      toast.error('Gagal memuat Bank Soal');
    } finally {
      setLoading(false);
    }
  };

  const handleMuatSoal = (soal: BankSoalItem) => {
    setSelectedSoal(soal);
    setViewMode(true);
  };

  const handleDeleteSoal = async (soalId: string) => {
    if (!confirm('Yakin ingin menghapus soal ini?')) return;

    try {
      await deleteDoc(doc(db, 'question_banks', soalId));
      setBankSoal((prev) => prev.filter((item) => item.id !== soalId));
      if (selectedSoal?.id === soalId) {
        setSelectedSoal(null);
        setViewMode(false);
      }
      toast.success('Soal berhasil dihapus');
    } catch (error) {
      console.error('Error deleting soal:', error);
      toast.error('Gagal menghapus soal');
    }
  };

  // --- PERBAIKAN: Fungsi ini dipindahkan ke sini (sebelum return) ---
  const handleSaveEditSoal = async () => {
    if (!editSoal) return;
    try {
      setLoading(true);
      // Update hanya bagian multipleChoice
      await updateDoc(doc(db, 'question_banks', editSoal.id), {
          'questions.multipleChoice': editQuestions
      });

      // Update state lokal
      setBankSoal((prev) => prev.map((item) => item.id === editSoal.id ? { ...item, questions: { ...item.questions, multipleChoice: editQuestions } } : item));
      setFilteredSoal((prev) => prev.map((item) => item.id === editSoal.id ? { ...item, questions: { ...item.questions, multipleChoice: editQuestions } } : item));
      setEditModalOpen(false);
      setEditSoal(null);
      setEditQuestions([]);
      toast.success('Soal berhasil diperbarui');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan perubahan soal');
    } finally {
      setLoading(false);
    }
  };
  // ------------------------------------------------------------------

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
      link.download = includeAnswerKey
        ? `${selectedSoal.examTitle}_KunciJawaban.docx`
        : `${selectedSoal.examTitle}_Soal.docx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Word:', error);
      toast.error('Gagal export ke Word');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Bank Soal</h1>
        <p className="mt-2 text-gray-600">Kelola soal-soal yang telah tersimpan</p>
      </div>

      {!viewMode ? (
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter Soal</CardTitle>
              <CardDescription>Pilih kelas dan mata pelajaran untuk melihat soal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Kelas</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedKelas}
                    onChange={(e) => setSelectedKelas(e.target.value)}
                  >
                    <option value="">Semua Kelas</option>
                    {availableKelas.map((kelas) => (
                      <option key={kelas} value={kelas}>
                        Kelas {kelas}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Mata Pelajaran</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                  >
                    <option value="">Semua Mata Pelajaran</option>
                    {availableSubjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={() => {
                      setSelectedKelas('');
                      setSelectedSubject('');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Reset Filter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Soal List */}
          <Card>
            <CardHeader>
              <CardTitle>Daftar Soal Tersimpan</CardTitle>
              <CardDescription>
                {filteredSoal.length} soal ditemukan
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-1 gap-4">
                  <LoadingCard count={3} />
                </div>
              ) : filteredSoal.length === 0 ? (
                <p className="text-center text-gray-500 py-12">
                  {bankSoal.length === 0
                    ? 'Belum ada soal tersimpan. Silakan generate soal terlebih dahulu.'
                    : 'Tidak ada soal yang sesuai dengan filter.'}
                </p>
              ) : (
                <>
                  <div className="space-y-3">
                    {filteredSoal
                      .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                      .map((soal) => (
                        <div
                          key={soal.id}
                          className="border rounded-lg p-4 hover:border-blue-500 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{soal.examTitle}</h3>
                              <div className="mt-2 space-y-1 text-sm text-gray-600">
                                <p>
                                  <span className="font-medium">Kelas:</span> {soal.kelas} •{' '}
                                  <span className="font-medium">Mapel:</span> {soal.subject}
                                </p>
                                <p>
                                  <span className="font-medium">Kesulitan:</span>{' '}
                                  <span className="capitalize">{soal.difficulty}</span> •{' '}
                                  <span className="font-medium">Durasi:</span> {soal.duration} menit
                                </p>
                                <p>
                                  <span className="font-medium">PG:</span>{' '}
                                  {soal.questions.multipleChoice?.length || 0} soal ({soal.optionsCount}{' '}
                                  opsi) •{' '}
                                  <span className="font-medium">Essay:</span>{' '}
                                  {soal.questions.essay?.length || 0} soal
                                  {soal.includeImage && (
                                    <span className="ml-2 text-blue-600 font-medium">• 📷 Dengan Gambar</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Dibuat: {formatDate(soal.created_at)}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button
                                onClick={() => handleMuatSoal(soal)}
                                size="sm"
                                variant="default"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Muat
                              </Button>
                              <Button
                                onClick={() => {
                                  setEditSoal(soal);
                                  setEditQuestions(soal.questions.multipleChoice ? JSON.parse(JSON.stringify(soal.questions.multipleChoice)) : []);
                                  setEditModalOpen(true);
                                }}
                                size="sm"
                                variant="secondary"
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                onClick={() => handleDeleteSoal(soal.id)}
                                size="sm"
                                variant="destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Pagination */}
                  {filteredSoal.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <p className="text-sm text-gray-600">
                        Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredSoal.length)} dari{' '}
                        {filteredSoal.length} soal
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          variant="outline"
                          size="sm"
                        >
                          Previous
                        </Button>
                        <span className="flex items-center px-3 text-sm">
                          Halaman {currentPage} dari {Math.ceil(filteredSoal.length / ITEMS_PER_PAGE)}
                        </span>
                        <Button
                          onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredSoal.length / ITEMS_PER_PAGE), p + 1))}
                          disabled={currentPage >= Math.ceil(filteredSoal.length / ITEMS_PER_PAGE)}
                          variant="outline"
                          size="sm"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Info */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedSoal?.examTitle}</CardTitle>
              <CardDescription>
                Kelas {selectedSoal?.kelas} • {selectedSoal?.subject} • Tingkat{' '}
                <span className="capitalize">{selectedSoal?.difficulty}</span> • Durasi{' '}
                {selectedSoal?.duration} menit
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Preview Questions */}
          <Card>
            <CardHeader>
              <CardTitle>Preview Soal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Multiple Choice */}
              {selectedSoal?.questions.multipleChoice &&
                selectedSoal.questions.multipleChoice.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-4">A. PILIHAN GANDA</h3>
                    <div className="space-y-4">
                      {selectedSoal.questions.multipleChoice.map((q, idx) => (
                        <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                          <p className="font-medium mb-2">
                            {q.questionNumber}. {q.question}
                          </p>
                          <div className="ml-4 space-y-1">
                            {Object.entries(q.options).map(([key, value]) => (
                              <p
                                key={key}
                                className={
                                  key === q.correctAnswer ? 'text-green-600 font-medium' : ''
                                }
                              >
                                {key}. {value}
                              </p>
                            ))}
                          </div>
                          {selectedSoal.includeTP && q.relatedTP && (
                            <p className="text-xs text-gray-500 italic mt-2">TP: {q.relatedTP}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Essay */}
              {selectedSoal?.questions.essay && selectedSoal.questions.essay.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-4">B. ESSAY/ISIAN</h3>
                  <div className="space-y-4">
                    {selectedSoal.questions.essay.map((q, idx) => (
                      <div key={idx} className="border-l-4 border-purple-500 pl-4 py-2">
                        <p className="font-medium mb-2">
                          {q.questionNumber}. {q.question}
                        </p>
                        {selectedSoal.includeTP && q.relatedTP && (
                          <p className="text-xs text-gray-500 italic mt-2">TP: {q.relatedTP}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Options */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="showTP"
                  checked={showTPInDownload}
                  onChange={(e) => setShowTPInDownload(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="showTP" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Tampilkan Tujuan Pembelajaran (TP) dalam file download
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Export Actions */}
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => handleExportWord(false)} size="lg">
              <Download className="w-4 h-4 mr-2" />
              Download Soal (.docx)
            </Button>
            <Button onClick={() => handleExportWord(true)} size="lg" variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Download Kunci Jawaban (.docx)
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedSoal(null);
                setViewMode(false);
              }}
              size="lg"
            >
              Kembali ke Daftar
            </Button>
          </div>
        </div>
      )}

      {/* --- PERBAIKAN: Modal dipindahkan ke luar looping --- */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 relative">
            <h2 className="text-xl font-bold mb-4">Edit Soal Pilihan Ganda</h2>
            <div className="space-y-6 max-h-[60vh] overflow-y-auto">
              {editQuestions.map((q, idx) => (
                <div key={idx} className="border-b pb-4 mb-4">
                  <label className="block text-sm font-medium mb-1">Pertanyaan #{q.questionNumber}</label>
                  <textarea
                    className="w-full border rounded px-3 py-2 mb-2"
                    value={q.question}
                    onChange={e => {
                      const newQ = [...editQuestions];
                      newQ[idx].question = e.target.value;
                      setEditQuestions(newQ);
                    }}
                  />
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {Object.keys(q.options).map((key) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="font-bold">{key}.</span>
                        <input
                          className="flex-1 border rounded px-2 py-1"
                          value={q.options[key]}
                          onChange={e => {
                            const newQ = [...editQuestions];
                            newQ[idx].options[key] = e.target.value;
                            setEditQuestions(newQ);
                          }}
                        />
                        <input
                          type="radio"
                          name={`correct-${idx}`}
                          checked={q.correctAnswer === key}
                          onChange={() => {
                            const newQ = [...editQuestions];
                            newQ[idx].correctAnswer = key;
                            setEditQuestions(newQ);
                          }}
                        />
                        <span className="text-xs">Kunci</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setEditModalOpen(false)} variant="outline">Batal</Button>
              <Button onClick={handleSaveEditSoal} disabled={loading} variant="default">Simpan Perubahan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}