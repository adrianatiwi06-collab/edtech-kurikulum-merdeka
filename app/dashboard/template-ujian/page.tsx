'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTemplate, LearningGoal } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

type Step = 1 | 2 | 3;

export default function TemplateUjianPage() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  
  // Step 1: Exam Info
  const [examName, setExamName] = useState('');
  const [examType, setExamType] = useState<'PAS' | 'PTS' | 'PAT' | 'Ulangan' | 'Kuis'>('PAS');
  const [selectedGrade, setSelectedGrade] = useState('1');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(1);
  
  // Step 2: TP Selection
  const [availableTPs, setAvailableTPs] = useState<LearningGoal[]>([]);
  const [selectedTPs, setSelectedTPs] = useState<Set<string>>(new Set());
  const [loadingTPs, setLoadingTPs] = useState(false);
  
  // Step 3: Question Config
  const [pgCount, setPgCount] = useState(20);
  const [pgWeight, setPgWeight] = useState(1);
  const [pgAnswerKeys, setPgAnswerKeys] = useState<string[]>(Array(20).fill(''));
  const [pgTPMapping, setPgTPMapping] = useState<{ [key: number]: string }>({});
  
  const [essayCount, setEssayCount] = useState(5);
  const [essayWeight, setEssayWeight] = useState(4);
  const [essayTPMapping, setEssayTPMapping] = useState<{ [key: number]: string }>({});
  
  const [saving, setSaving] = useState(false);

  const subjects = [
    'Bahasa Indonesia',
    'Matematika',
    'Pendidikan Agama Islam',
    'Pendidikan Pancasila',
    'IPAS',
    'Bahasa Inggris',
    'Seni',
    'PJOK'
  ];

  const grades = ['1', '2', '3', '4', '5', '6'];

  // Load TPs when filters change
  useEffect(() => {
    if (currentStep === 2 && user && selectedGrade && selectedSubject && selectedSemester) {
      loadTPs();
    }
  }, [currentStep, user, selectedGrade, selectedSubject, selectedSemester]);

  const loadTPs = async () => {
    if (!user) return;
    
    setLoadingTPs(true);
    try {
      const q = query(
        collection(db, 'learning_goals'),
        where('user_id', '==', user.uid),
        where('grade', '==', selectedGrade),
        where('subject', '==', selectedSubject),
        where('semester', '==', selectedSemester)
      );
      
      const snapshot = await getDocs(q);
      const tps: LearningGoal[] = [];
      snapshot.forEach((doc) => {
        tps.push({ id: doc.id, ...doc.data() } as LearningGoal);
      });
      
      setAvailableTPs(tps);
    } catch (error) {
      console.error('Error loading TPs:', error);
      alert('Gagal memuat TP');
    } finally {
      setLoadingTPs(false);
    }
  };

  const handleStep1Next = () => {
    if (!examName.trim()) {
      alert('Nama ujian harus diisi');
      return;
    }
    if (!selectedSubject) {
      alert('Mata pelajaran harus dipilih');
      return;
    }
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    if (selectedTPs.size === 0) {
      alert('Pilih minimal 1 TP');
      return;
    }
    setCurrentStep(3);
  };

  const toggleTPSelection = (tpId: string) => {
    const newSet = new Set(selectedTPs);
    if (newSet.has(tpId)) {
      newSet.delete(tpId);
    } else {
      newSet.add(tpId);
    }
    setSelectedTPs(newSet);
  };

  const handlePgCountChange = (count: number) => {
    setPgCount(count);
    setPgAnswerKeys(Array(count).fill(''));
    // Clear mappings beyond new count
    const newMapping = { ...pgTPMapping };
    Object.keys(newMapping).forEach(key => {
      if (parseInt(key) > count) {
        delete newMapping[parseInt(key)];
      }
    });
    setPgTPMapping(newMapping);
  };

  const handleEssayCountChange = (count: number) => {
    setEssayCount(count);
    // Clear mappings beyond new count
    const newMapping = { ...essayTPMapping };
    Object.keys(newMapping).forEach(key => {
      if (parseInt(key) > count) {
        delete newMapping[parseInt(key)];
      }
    });
    setEssayTPMapping(newMapping);
  };

  const autoDistributeTPs = () => {
    if (selectedTPs.size === 0) return;
    
    const tpArray = Array.from(selectedTPs);
    const totalQuestions = pgCount + essayCount;
    
    const newPgMapping: { [key: number]: string } = {};
    const newEssayMapping: { [key: number]: string } = {};
    
    for (let i = 1; i <= totalQuestions; i++) {
      const tpIndex = (i - 1) % tpArray.length;
      const tpId = tpArray[tpIndex];
      
      if (i <= pgCount) {
        newPgMapping[i] = tpId;
      } else {
        newEssayMapping[i - pgCount] = tpId;
      }
    }
    
    setPgTPMapping(newPgMapping);
    setEssayTPMapping(newEssayMapping);
  };

  const handleSaveTemplate = async () => {
    if (!user) return;
    
    // Validation
    const allPGAnswered = pgAnswerKeys.every((key, idx) => idx >= pgCount || key !== '');
    if (!allPGAnswered) {
      alert('Semua kunci jawaban PG harus diisi');
      return;
    }
    
    const allPGMapped = Object.keys(pgTPMapping).length === pgCount;
    if (!allPGMapped) {
      alert('Semua soal PG harus dipetakan ke TP');
      return;
    }
    
    const allEssayMapped = Object.keys(essayTPMapping).length === essayCount;
    if (!allEssayMapped) {
      alert('Semua soal Isian harus dipetakan ke TP');
      return;
    }
    
    setSaving(true);
    
    try {
      // Build tp_details with question_numbers
      const tpDetails = Array.from(selectedTPs).map(tpId => {
        const tp = availableTPs.find(t => t.id === tpId);
        const questionNumbers: number[] = [];
        
        // Add PG questions
        Object.entries(pgTPMapping).forEach(([qNum, mappedTpId]) => {
          if (mappedTpId === tpId) {
            questionNumbers.push(parseInt(qNum));
          }
        });
        
        // Add Essay questions (offset by pgCount)
        Object.entries(essayTPMapping).forEach(([qNum, mappedTpId]) => {
          if (mappedTpId === tpId) {
            questionNumbers.push(pgCount + parseInt(qNum));
          }
        });
        
        return {
          tp_id: tpId,
          chapter: tp?.chapter || '',
          tp_text: tp?.tp || '',
          question_numbers: questionNumbers.sort((a, b) => a - b)
        };
      });
      
      const totalQuestions = pgCount + essayCount;
      const maxScore = (pgCount * pgWeight) + (essayCount * essayWeight);
      
      const template: Omit<ExamTemplate, 'id'> = {
        user_id: user.uid,
        exam_name: examName.trim(),
        exam_type: examType,
        grade: selectedGrade,
        subject: selectedSubject,
        semester: selectedSemester,
        tp_ids: Array.from(selectedTPs),
        tp_details: tpDetails,
        multiple_choice: {
          count: pgCount,
          weight: pgWeight,
          answer_keys: pgAnswerKeys.slice(0, pgCount),
          tp_mapping: pgTPMapping
        },
        essay: {
          count: essayCount,
          weight: essayWeight,
          tp_mapping: essayTPMapping
        },
        total_questions: totalQuestions,
        max_score: maxScore,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'exam_templates'), template);
      
      alert('Template ujian berhasil disimpan!');
      
      // Reset form
      setCurrentStep(1);
      setExamName('');
      setSelectedTPs(new Set());
      setPgAnswerKeys(Array(20).fill(''));
      setPgTPMapping({});
      setEssayTPMapping({});
      
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Gagal menyimpan template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Template Ujian Cepat</h1>
        <p className="text-muted-foreground">
          Buat template untuk ujian berbasis kertas (PAS/PTS) dengan pemetaan TP
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-4 mb-8">
        <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            1
          </div>
          <span className="font-medium">Info Ujian</span>
        </div>
        <div className="flex-1 h-0.5 bg-muted" />
        <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            2
          </div>
          <span className="font-medium">Pilih TP</span>
        </div>
        <div className="flex-1 h-0.5 bg-muted" />
        <div className={`flex items-center gap-2 ${currentStep >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            3
          </div>
          <span className="font-medium">Konfigurasi Soal</span>
        </div>
      </div>

      {/* Step 1: Exam Info */}
      {currentStep === 1 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Informasi Ujian</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nama Ujian</label>
              <Input
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="Contoh: PAS Matematika Semester 1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Jenis Ujian</label>
              <select
                className="w-full p-2 border rounded"
                value={examType}
                onChange={(e) => setExamType(e.target.value as any)}
              >
                <option value="PAS">PAS (Penilaian Akhir Semester)</option>
                <option value="PTS">PTS (Penilaian Tengah Semester)</option>
                <option value="PAT">PAT (Penilaian Akhir Tahun)</option>
                <option value="Ulangan">Ulangan Harian</option>
                <option value="Kuis">Kuis</option>
              </select>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Kelas</label>
                <select
                  className="w-full p-2 border rounded"
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                >
                  {grades.map(g => (
                    <option key={g} value={g}>Kelas {g}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Mata Pelajaran</label>
                <select
                  className="w-full p-2 border rounded"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                >
                  <option value="">Pilih...</option>
                  {subjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Semester</label>
                <select
                  className="w-full p-2 border rounded"
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(parseInt(e.target.value) as 1 | 2)}
                >
                  <option value={1}>Semester 1</option>
                  <option value={2}>Semester 2</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={handleStep1Next}>
              Lanjut ke Pemilihan TP
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: TP Selection */}
      {currentStep === 2 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Pilih Tujuan Pembelajaran</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Kelas {selectedGrade} - {selectedSubject} - Semester {selectedSemester}
          </p>
          
          {loadingTPs ? (
            <p className="text-center py-8">Memuat TP...</p>
          ) : availableTPs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Tidak ada TP tersedia untuk filter ini. Buat TP terlebih dahulu di menu Generate TP.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableTPs.map((tp) => (
                <div
                  key={tp.id}
                  className={`p-4 border rounded cursor-pointer transition-colors ${
                    selectedTPs.has(tp.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                  }`}
                  onClick={() => toggleTPSelection(tp.id)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedTPs.has(tp.id)}
                      onChange={() => {}}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">{tp.chapter}</p>
                      <p className="text-sm">{tp.tp}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex justify-between gap-2 mt-6">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              Kembali
            </Button>
            <Button onClick={handleStep2Next} disabled={selectedTPs.size === 0}>
              Lanjut ke Konfigurasi Soal ({selectedTPs.size} TP dipilih)
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Question Config & TP Mapping */}
      {currentStep === 3 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Konfigurasi Soal & Pemetaan TP</h2>
          
          <div className="space-y-6">
            {/* Question Config */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Soal Pilihan Ganda</h3>
                <div>
                  <label className="block text-sm font-medium mb-2">Jumlah Soal</label>
                  <Input
                    type="number"
                    min="0"
                    value={pgCount}
                    onChange={(e) => handlePgCountChange(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Bobot per Soal</label>
                  <Input
                    type="number"
                    min="1"
                    value={pgWeight}
                    onChange={(e) => setPgWeight(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold">Soal Isian</h3>
                <div>
                  <label className="block text-sm font-medium mb-2">Jumlah Soal</label>
                  <Input
                    type="number"
                    min="0"
                    value={essayCount}
                    onChange={(e) => handleEssayCountChange(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Bobot per Soal</label>
                  <Input
                    type="number"
                    min="1"
                    value={essayWeight}
                    onChange={(e) => setEssayWeight(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-muted p-4 rounded">
              <p className="text-sm">
                Total Soal: {pgCount + essayCount} | 
                Nilai Maksimal: {(pgCount * pgWeight) + (essayCount * essayWeight)}
              </p>
            </div>
            
            {/* Display Selected TPs */}
            {selectedTPs.size > 0 && (
              <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <span>📋</span> TP yang Dipilih ({selectedTPs.size})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {Array.from(selectedTPs).map((tpId, index) => {
                    const tp = availableTPs.find(t => t.id === tpId);
                    return (
                      <div key={tpId} className="bg-white p-3 rounded border border-blue-200">
                        <p className="text-sm font-medium text-blue-900">TP {index + 1}:</p>
                        <p className="text-sm text-gray-700 mt-1">{tp?.chapter}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Auto Distribute Button */}
            <div>
              <Button onClick={autoDistributeTPs} variant="outline">
                🔄 Distribusi TP Otomatis
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Membagi soal secara merata ke semua TP yang dipilih
              </p>
            </div>
            
            {/* PG Answer Keys & Mapping */}
            {pgCount > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Kunci Jawaban & Pemetaan TP - Pilihan Ganda</h3>
                <div className="grid grid-cols-5 gap-3 max-h-96 overflow-y-auto">
                  {Array.from({ length: pgCount }, (_, i) => i + 1).map((num) => {
                    const selectedTP = availableTPs.find(t => t.id === pgTPMapping[num]);
                    return (
                      <div key={num} className="space-y-2 p-3 border rounded">
                        <p className="text-sm font-medium">No. {num}</p>
                        <select
                          className="w-full p-1 text-sm border rounded"
                          value={pgAnswerKeys[num - 1] || ''}
                          onChange={(e) => {
                            const newKeys = [...pgAnswerKeys];
                            newKeys[num - 1] = e.target.value;
                            setPgAnswerKeys(newKeys);
                          }}
                        >
                          <option value="">Pilih</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                          <option value="E">E</option>
                        </select>
                        <select
                          className="w-full p-1 text-sm border rounded h-auto"
                          size={5}
                          value={pgTPMapping[num] || ''}
                          onChange={(e) => setPgTPMapping({ ...pgTPMapping, [num]: e.target.value })}
                        >
                          <option value="">TP...</option>
                          {Array.from(selectedTPs).map((tpId) => {
                            const tp = availableTPs.find(t => t.id === tpId);
                            return (
                              <option key={tpId} value={tpId} className="whitespace-normal py-1">
                                {tp?.chapter}
                              </option>
                            );
                          })}
                        </select>
                        {selectedTP && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                            <p className="font-medium text-blue-900">TP Dipilih:</p>
                            <p className="text-blue-800 mt-1">{selectedTP.chapter}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Essay Mapping */}
            {essayCount > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Pemetaan TP - Soal Isian</h3>
                <div className="grid grid-cols-5 gap-3">
                  {Array.from({ length: essayCount }, (_, i) => i + 1).map((num) => {
                    const selectedTP = availableTPs.find(t => t.id === essayTPMapping[num]);
                    return (
                      <div key={num} className="space-y-2 p-3 border rounded">
                        <p className="text-sm font-medium">No. {num}</p>
                        <select
                          className="w-full p-1 text-sm border rounded h-auto"
                          size={5}
                          value={essayTPMapping[num] || ''}
                          onChange={(e) => setEssayTPMapping({ ...essayTPMapping, [num]: e.target.value })}
                        >
                          <option value="">TP...</option>
                          {Array.from(selectedTPs).map((tpId) => {
                            const tp = availableTPs.find(t => t.id === tpId);
                            return (
                              <option key={tpId} value={tpId} className="whitespace-normal py-1">
                                {tp?.chapter}
                              </option>
                            );
                          })}
                        </select>
                        {selectedTP && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                            <p className="font-medium text-blue-900">TP Dipilih:</p>
                            <p className="text-blue-800 mt-1">{selectedTP.chapter}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-between gap-2 mt-6">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              Kembali
            </Button>
            <Button onClick={handleSaveTemplate} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Template'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
