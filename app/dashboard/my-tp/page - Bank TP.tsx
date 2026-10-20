'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch } from '@/lib/auth-fetch';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, orderBy, addDoc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Trash2, Edit2, Check, X, Filter, Search, ArrowRightLeft, Download, FileSpreadsheet, Zap, Split, BookOpen, Settings, Upload, Plus, FileUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { compressTP, type CompressionResult, formatCompressionResult } from '@/lib/tp-compressor';

interface SavedTP {
  id: string;
  chapter: string;
  tp: string;
  tpOriginal?: string; // Original ABCD format (if compressed)
  semester: number;
  grade: string;
  subject: string;
  cpReference: string;
  created_at: string;
  isRaporFormat?: boolean;
}

type TPTabType = 'all' | 'original' | 'compressed';

export default function MyTPPage() {
  const { user } = useAuth();
  const [savedTPs, setSavedTPs] = useState<SavedTP[]>([]);
  const [filteredTPs, setFilteredTPs] = useState<SavedTP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tab system
  const [activeTab, setActiveTab] = useState<TPTabType>('all');
  
  // Filters
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  
  // Edit metadata mode
  const [editMetadataOpen, setEditMetadataOpen] = useState(false);
  const [selectedTPForMetadata, setSelectedTPForMetadata] = useState<SavedTP | null>(null);
  const [metadataGrade, setMetadataGrade] = useState('');
  const [metadataSubject, setMetadataSubject] = useState('');
  const [metadataSemester, setMetadataSemester] = useState('');
  const [metadataChapter, setMetadataChapter] = useState('');
  const [metadataLoading, setMetadataLoading] = useState(false);

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
  
  // Compress mode
  const [compressModalOpen, setCompressModalOpen] = useState(false);
  const [selectedTPForCompress, setSelectedTPForCompress] = useState<SavedTP | null>(null);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [compressLoading, setCompressLoading] = useState(false);
  const [compressSaveOption, setCompressSaveOption] = useState<'single' | 'split'>('single');
  const [compressEditMode, setCompressEditMode] = useState(false);
  const [compressEditText, setCompressEditText] = useState('');
  const [compressEditSplits, setCompressEditSplits] = useState<string[]>([]);
  const [trimWithAILoading, setTrimWithAILoading] = useState(false);

  // View original/full format
  const [viewFullFormatOpen, setViewFullFormatOpen] = useState(false);
  const [selectedTPForView, setSelectedTPForView] = useState<SavedTP | null>(null);

  // Restore original
  const [restoreOriginalOpen, setRestoreOriginalOpen] = useState(false);
  const [selectedTPForRestore, setSelectedTPForRestore] = useState<SavedTP | null>(null);
  const [restoreOriginalText, setRestoreOriginalText] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Import XLSX
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Input
  const [manualInputOpen, setManualInputOpen] = useState(false);
  const [manualTPText, setManualTPText] = useState('');
  const [manualChapter, setManualChapter] = useState('');
  const [manualGrade, setManualGrade] = useState('');
  const [manualSubject, setManualSubject] = useState('');
  const [manualSemester, setManualSemester] = useState('');
  const [manualCPReference, setManualCPReference] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadSavedTPs();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [savedTPs, filterGrade, filterSemester, filterSubject, searchQuery, activeTab]);

  const loadSavedTPs = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      const q = query(
        collection(db, 'learning_goals'),
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const tps: SavedTP[] = [];
      
      querySnapshot.forEach((doc) => {
        tps.push({
          id: doc.id,
          ...doc.data()
        } as SavedTP);
      });
      
      setSavedTPs(tps);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat TP tersimpan');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...savedTPs];
    
    // Apply tab filter
    if (activeTab === 'original') {
      filtered = filtered.filter(tp => !tp.isRaporFormat);
    } else if (activeTab === 'compressed') {
      filtered = filtered.filter(tp => tp.isRaporFormat);
    }
    
    if (filterGrade) {
      filtered = filtered.filter(tp => tp.grade === filterGrade);
    }
    
    if (filterSemester) {
      filtered = filtered.filter(tp => tp.semester === parseInt(filterSemester));
    }
    
    if (filterSubject) {
      filtered = filtered.filter(tp => tp.subject === filterSubject);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tp => 
        tp.tp.toLowerCase().includes(query) ||
        tp.chapter.toLowerCase().includes(query) ||
        tp.cpReference.toLowerCase().includes(query)
      );
    }
    
    setFilteredTPs(filtered);
  };

  const handleDelete = async (id: string, tpText: string) => {
    if (!confirm(`Hapus TP ini?\n\n"${tpText.substring(0, 100)}..."`)) return;
    
    try {
      await deleteDoc(doc(db, 'learning_goals', id));
      setSavedTPs(savedTPs.filter(tp => tp.id !== id));
      alert('TP berhasil dihapus');
    } catch (err: any) {
      alert('Gagal menghapus TP: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = filteredTPs.map(tp => tp.id);
    
    if (selectedIds.length === 0) {
      alert('Tidak ada TP untuk dihapus');
      return;
    }
    
    if (!confirm(`Hapus ${selectedIds.length} TP yang sedang ditampilkan?\n\nPeringatan: Ini tidak bisa dibatalkan!`)) return;
    
    setLoading(true);
    try {
      const deletePromises = selectedIds.map(id => 
        deleteDoc(doc(db, 'learning_goals', id))
      );
      
      await Promise.all(deletePromises);
      
      setSavedTPs(savedTPs.filter(tp => !selectedIds.includes(tp.id)));
      alert(`${selectedIds.length} TP berhasil dihapus`);
    } catch (err: any) {
      alert('Gagal menghapus beberapa TP: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (tp: SavedTP) => {
    setEditingId(tp.id);
    setEditText(tp.tp);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) {
      alert('TP tidak boleh kosong');
      return;
    }
    
    try {
      await updateDoc(doc(db, 'learning_goals', id), {
        tp: editText,
      });
      
      setSavedTPs(savedTPs.map(tp => 
        tp.id === id ? { ...tp, tp: editText } : tp
      ));
      
      setEditingId(null);
      setEditText('');
    } catch (err: any) {
      alert('Gagal menyimpan perubahan: ' + err.message);
    }
  };

  const openEditMetadata = (tp: SavedTP) => {
    setSelectedTPForMetadata(tp);
    setMetadataGrade(tp.grade);
    setMetadataSubject(tp.subject || '');
    setMetadataSemester(tp.semester.toString());
    setMetadataChapter(tp.chapter);
    setEditMetadataOpen(true);
  };

  const saveMetadataEdit = async () => {
    if (!selectedTPForMetadata) return;

    if (!metadataGrade || !metadataSemester) {
      alert('Kelas dan semester harus diisi');
      return;
    }

    setMetadataLoading(true);
    try {
      await updateDoc(doc(db, 'learning_goals', selectedTPForMetadata.id), {
        grade: metadataGrade,
        subject: metadataSubject,
        semester: parseInt(metadataSemester),
        chapter: metadataChapter,
      });

      setSavedTPs(savedTPs.map(tp => 
        tp.id === selectedTPForMetadata.id 
          ? { 
              ...tp, 
              grade: metadataGrade,
              subject: metadataSubject,
              semester: parseInt(metadataSemester),
              chapter: metadataChapter
            } 
          : tp
      ));

      alert('✅ Metadata berhasil diupdate!');
      setEditMetadataOpen(false);
      setSelectedTPForMetadata(null);
    } catch (err: any) {
      alert('Gagal menyimpan metadata: ' + err.message);
    } finally {
      setMetadataLoading(false);
    }
  };

  const saveCompressedTP = async () => {
    if (!selectedTPForCompress || !compressionResult) return;

    setCompressLoading(true);
    try {
      if (compressSaveOption === 'split' && compressEditSplits.length > 0) {
        // Save as multiple TPs using edited splits
        const savePromises = compressEditSplits.map((split, idx) => {
          const newTPData = {
            ...selectedTPForCompress,
            tp: split,
            tpOriginal: selectedTPForCompress.tp, // Store original ABCD format
            isRaporFormat: true,
            chapter: `${selectedTPForCompress.chapter} (Bagian ${idx + 1})`,
            created_at: new Date().toISOString(),
          };
          
          return updateDoc(doc(db, 'learning_goals', selectedTPForCompress.id), newTPData);
        });

        await Promise.all(savePromises);
        alert(`TP berhasil di-split menjadi ${compressEditSplits.length} bagian dengan format rapor`);
      } else {
        // Save as single compressed TP using edited text
        const textToSave = compressEditMode ? compressEditText : compressionResult.compressed;
        
        // Validate length
        if (textToSave.length > 100) {
          alert(`⚠️ TP masih ${textToSave.length} karakter (>100). Silakan singkat lagi.`);
          setCompressLoading(false);
          return;
        }

        await updateDoc(doc(db, 'learning_goals', selectedTPForCompress.id), {
          tp: textToSave,
          tpOriginal: selectedTPForCompress.tp, // Store original ABCD format
          isRaporFormat: true,
        });

        alert('TP berhasil dikompres dan disimpan sebagai format rapor');
      }

      // Reload TPs
      await loadSavedTPs();
      setCompressModalOpen(false);
      setSelectedTPForCompress(null);
      setCompressionResult(null);
      setCompressEditMode(false);
      setCompressEditText('');
      setCompressEditSplits([]);
    } catch (err: any) {
      alert('Gagal menyimpan TP: ' + err.message);
    } finally {
      setCompressLoading(false);
    }
  };

  const restoreOriginalTP = async () => {
    if (!selectedTPForRestore || !restoreOriginalText.trim()) return;

    setRestoreLoading(true);
    try {
      await updateDoc(doc(db, 'learning_goals', selectedTPForRestore.id), {
        tpOriginal: restoreOriginalText.trim(),
      });

      alert('✅ Format ABCD original berhasil disimpan! Sekarang bisa dilihat dengan klik tombol 📖');
      await loadSavedTPs();
      setRestoreOriginalOpen(false);
      setSelectedTPForRestore(null);
      setRestoreOriginalText('');
    } catch (err: any) {
      alert('Gagal menyimpan original: ' + err.message);
    } finally {
      setRestoreLoading(false);
    }
  };

  const moveToSemester = async (tpId: string, currentSemester: number, tpText: string) => {
    const targetSemester = currentSemester === 1 ? 2 : 1;
    
    if (!confirm(`Pindahkan TP ini ke Semester ${targetSemester}?\n\n"${tpText.substring(0, 100)}..."`)) return;
    
    try {
      await updateDoc(doc(db, 'learning_goals', tpId), {
        semester: targetSemester,
      });
      
      setSavedTPs(savedTPs.map(tp => 
        tp.id === tpId ? { ...tp, semester: targetSemester } : tp
      ));
      
      alert(`TP berhasil dipindahkan ke Semester ${targetSemester}`);
    } catch (err: any) {
      alert('Gagal memindahkan TP: ' + err.message);
    }
  };

  const openCompressModal = (tp: SavedTP) => {
    setSelectedTPForCompress(tp);
    setCompressionResult(null);
    setCompressModalOpen(true);
  };

  const performCompression = () => {
    if (!selectedTPForCompress) return;

    setCompressLoading(true);
    try {
      // Simulate async compression
      const result = compressTP(selectedTPForCompress.tp, 100, true);
      
      // Determine save option based on result
      if (result.hasSplit && result.splits && result.splits.length > 1) {
        setCompressSaveOption('split');
        setCompressEditSplits([...result.splits]); // Initialize splits for editing
      } else {
        setCompressSaveOption('single');
        setCompressEditText(result.compressed); // Initialize compressed text for editing
      }
      
      setCompressionResult(result);
      setCompressEditMode(false); // Start with preview mode, not edit mode
    } catch (err: any) {
      alert('Error saat kompresi: ' + err.message);
    } finally {
      setCompressLoading(false);
    }
  };

  // Rate limit state untuk mencegah 429 errors
  const lastTrimAttempt = useRef<number>(0);
  const trimRetryCount = useRef<number>(0);
  const MAX_TRIM_RETRIES = 3;
  const TRIM_RATE_LIMIT_MS = 3000; // 3 detik antar requests

  /**
   * Retry logic dengan exponential backoff untuk trim API
   * Mencegah 429 rate limit errors
   */
  const performTrimWithAIRetry = async (attemptNum = 0): Promise<any> => {
    // Check rate limit
    const now = Date.now();
    const timeSinceLastAttempt = now - lastTrimAttempt.current;
    
    if (timeSinceLastAttempt < TRIM_RATE_LIMIT_MS) {
      const waitTime = TRIM_RATE_LIMIT_MS - timeSinceLastAttempt;
      console.log(`[TrimTP] Rate limit: waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    lastTrimAttempt.current = Date.now();

    try {
      const data = await authenticatedFetch('/api/trim-tp', {
        method: 'POST',
        body: {
          tpText: selectedTPForCompress!.tp,
          maxLength: 100,
          allowSplit: true,
          grade: selectedTPForCompress!.grade,
          subject: selectedTPForCompress!.subject,
        },
      });

      if (!data.success) {
        throw new Error(data.error || 'Trim gagal');
      }

      return data;
    } catch (error: any) {
      // Retry logic untuk 429 rate limit errors
      if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
        if (attemptNum < MAX_TRIM_RETRIES) {
          const backoffMs = Math.pow(2, attemptNum) * 1000; // 1s, 2s, 4s
          console.log(`[TrimTP] Rate limit hit. Retrying in ${backoffMs}ms (attempt ${attemptNum + 1}/${MAX_TRIM_RETRIES})...`);
          
          // Show user a message
          if (attemptNum === 0) {
            alert('Sedang mencoba lagi (terlalu banyak permintaan)...');
          }
          
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return performTrimWithAIRetry(attemptNum + 1);
        } else {
          throw new Error('Terlalu banyak upaya (rate limited). Tunggu beberapa saat sebelum mencoba lagi.');
        }
      }
      
      throw error;
    }
  };

  const performTrimWithAI = async () => {
    if (!selectedTPForCompress) return;

    setTrimWithAILoading(true);
    trimRetryCount.current = 0;
    
    try {
      const data = await performTrimWithAIRetry();

      // Convert trim result to CompressionResult format
      const trimResult: CompressionResult = {
        status: 'success',
        original: selectedTPForCompress.tp,
        compressed: data.trimmed,
        charCount: data.charCount,
        maxLength: 100,
        topicCount: data.splits?.length || 1,
        hasMultipleTopics: (data.splits?.length || 0) > 1,
        hasSplit: (data.splits?.length || 0) > 1,
        splits: data.splits || [],
        confidenceScore: 0.9,
        recommendedAction: data.splits?.length > 1 ? 'split_required' : 'compress_only',
      };

      // Determine save option
      if (trimResult.hasSplit && trimResult.splits && trimResult.splits.length > 1) {
        setCompressSaveOption('split');
        setCompressEditSplits([...trimResult.splits]);
      } else {
        setCompressSaveOption('single');
        setCompressEditText(trimResult.compressed);
      }

      setCompressionResult(trimResult);
      setCompressEditMode(false);
    } catch (err: any) {
      alert('Error saat trim dengan AI: ' + err.message);
    } finally {
      setTrimWithAILoading(false);
    }
  };

  const exportToXLSX = () => {
    if (filteredTPs.length === 0) {
      alert('Tidak ada data TP untuk diekspor');
      return;
    }

    const dataForExport = filteredTPs.map((tp, index) => ({
      'No': index + 1,
      'Bab/Elemen': tp.chapter,
      'Tujuan Pembelajaran': tp.tp,
      'Semester': tp.semester,
      'Kelas': tp.grade,
      'Mata Pelajaran': tp.subject || '-',
      'Format': tp.isRaporFormat ? 'Format Rapor (100 char)' : 'Format Lengkap ABCD',
      'Panjang': tp.tp.length + ' karakter',
      'Tanggal Dibuat': new Date(tp.created_at).toLocaleDateString('id-ID')
    }));

    const ws = XLSX.utils.json_to_sheet(dataForExport);
    
    // Format headers
    const headerStyle = {
      fill: { fgColor: { rgb: '1e40af' } }, // Blue
      font: { bold: true, color: { rgb: 'FFFFFF' } }, // White bold
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    
    // Apply header styling
    const headers = Object.keys(dataForExport[0]);
    headers.forEach((header, index) => {
      const cellRef = XLSX.utils.encode_col(index) + '1';
      if (ws[cellRef]) {
        ws[cellRef].s = headerStyle;
      }
    });

    // Set column widths
    const colWidths = [5, 20, 30, 12, 8, 15, 20, 15, 18];
    ws['!cols'] = colWidths.map(w => ({ wch: w }));

    // Center align data columns
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef]) {
          if (!ws[cellRef].s) ws[cellRef].s = {};
          ws[cellRef].s.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TP');
    
    const timestamp = new Date().toISOString().split('T')[0];
    const tabName = activeTab === 'original' ? 'Lengkap' : activeTab === 'compressed' ? 'Rapor' : 'Semua';
    const filename = `TP_${tabName}_${filterGrade || 'Semua'}_${timestamp}.xlsx`;
    
    XLSX.writeFile(wb, filename);
  };

  const exportToExcel = () => {
    if (filteredTPs.length === 0) {
      alert('Tidak ada data TP untuk diekspor');
      return;
    }

    // Prepare data for export
    const dataForExport = filteredTPs.map((tp, index) => ({
      'No': index + 1,
      'Bab/Elemen': tp.chapter,
      'Tujuan Pembelajaran': tp.tp,
      'Semester': tp.semester,
      'Kelas': tp.grade,
      'Mata Pelajaran': tp.subject || '-',
      'Format': tp.isRaporFormat ? 'Format Rapor (100 char)' : 'Format Lengkap ABCD',
      'Panjang': tp.tp.length + ' karakter',
      'Tanggal Dibuat': new Date(tp.created_at).toLocaleDateString('id-ID')
    }));

    // Convert to CSV (compatible with Excel)
    const headers = Object.keys(dataForExport[0]);
    const csvContent = [
      headers.join(','),
      ...dataForExport.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row];
          // Escape quotes and wrap in quotes if contains comma
          const escaped = String(value).replace(/"/g, '""');
          return escaped.includes(',') || escaped.includes('\n') ? `"${escaped}"` : escaped;
        }).join(',')
      )
    ].join('\n');

    // Add BOM for Excel UTF-8 support
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `TP_Tersimpan_${filterGrade || 'Semua'}_${timestamp}.csv`;
    link.download = filename;
    
    link.click();
    URL.revokeObjectURL(url);
  };

  // Download Template XLSX
  const downloadTemplateXLSX = () => {
    // Data contoh untuk template
    const templateData = [
      {
        'Bab/Elemen': 'Bab 1 - Bilangan Bulat',
        'Tujuan Pembelajaran': 'Peserta didik mampu mengidentifikasi bilangan bulat dan operasinya dalam kehidupan sehari-hari',
        'Semester': 1,
        'Kelas': '4',
        'Mata Pelajaran': 'Matematika',
        'Referensi CP': 'CP Fase B - Bilangan'
      },
      {
        'Bab/Elemen': 'Bab 2 - Pecahan',
        'Tujuan Pembelajaran': 'Peserta didik mampu membandingkan dan mengurutkan pecahan serta menggunakan pecahan dalam kehidupan sehari-hari',
        'Semester': 1,
        'Kelas': '4',
        'Mata Pelajaran': 'Matematika',
        'Referensi CP': 'CP Fase B - Bilangan'
      },
      {
        'Bab/Elemen': 'Bab 1 - Cerita Rakyat',
        'Tujuan Pembelajaran': 'Peserta didik mampu mengidentifikasi unsur intrinsik dalam cerita rakyat dan menceritakan kembali dengan bahasa sendiri',
        'Semester': 1,
        'Kelas': '4',
        'Mata Pelajaran': 'Bahasa Indonesia',
        'Referensi CP': 'CP Fase B - Membaca dan Memirsa'
      }
    ];

    // Buat worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    const colWidths = [
      { wch: 25 }, // Bab/Elemen
      { wch: 80 }, // Tujuan Pembelajaran
      { wch: 10 }, // Semester
      { wch: 8 },  // Kelas
      { wch: 30 }, // Mata Pelajaran
      { wch: 30 }  // Referensi CP
    ];
    ws['!cols'] = colWidths;

    // Style header row
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws[cellRef]) {
        if (!ws[cellRef].s) ws[cellRef].s = {};
        ws[cellRef].s = {
          fill: { fgColor: { rgb: "4472C4" } },
          font: { bold: true, color: { rgb: "FFFFFF" } },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }

    // Wrap text untuk semua cell
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef]) {
          if (!ws[cellRef].s) ws[cellRef].s = {};
          ws[cellRef].s.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template TP');
    
    const filename = 'Template_Import_TP.xlsx';
    XLSX.writeFile(wb, filename);
  };

  // Import XLSX
  const handleImportXLSX = async () => {
    if (!importFile || !user) {
      alert('Pilih file terlebih dahulu');
      return;
    }

    setImportLoading(true);
    try {
      const data = await importFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        alert('File Excel kosong');
        setImportLoading(false);
        return;
      }

      // Validasi kolom yang diperlukan
      const requiredColumns = ['Bab/Elemen', 'Tujuan Pembelajaran', 'Semester', 'Kelas', 'Mata Pelajaran'];
      const firstRow = jsonData[0];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      
      if (missingColumns.length > 0) {
        alert(`Kolom yang diperlukan tidak ditemukan: ${missingColumns.join(', ')}\n\nPastikan file Excel memiliki kolom: ${requiredColumns.join(', ')}`);
        setImportLoading(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData) {
        try {
          const tpData = {
            chapter: String(row['Bab/Elemen'] || '').trim(),
            tp: String(row['Tujuan Pembelajaran'] || '').trim(),
            semester: parseInt(String(row['Semester'])) || 1,
            grade: String(row['Kelas'] || '').trim(),
            subject: String(row['Mata Pelajaran'] || '').trim(),
            cpReference: String(row['Referensi CP'] || row['CP Reference'] || 'Import Manual').trim(),
            user_id: user.uid,
            created_at: Timestamp.now().toDate().toISOString(),
            isRaporFormat: false
          };

          // Validasi data tidak kosong
          if (!tpData.chapter || !tpData.tp || !tpData.grade || !tpData.subject) {
            errorCount++;
            continue;
          }

          await addDoc(collection(db, 'learning_goals'), tpData);
          successCount++;
        } catch (err) {
          console.error('Error importing row:', err);
          errorCount++;
        }
      }

      alert(`Import selesai!\n✅ Berhasil: ${successCount}\n❌ Gagal: ${errorCount}`);
      
      // Reload data
      await loadSavedTPs();
      
      // Reset state
      setImportModalOpen(false);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      alert('Gagal import file: ' + err.message);
    } finally {
      setImportLoading(false);
    }
  };

  // Manual Input
  const handleManualInput = async () => {
    if (!user) return;

    // Validasi
    if (!manualTPText.trim()) {
      alert('Tujuan Pembelajaran harus diisi');
      return;
    }
    if (!manualChapter.trim()) {
      alert('Bab/Elemen harus diisi');
      return;
    }
    if (!manualGrade) {
      alert('Kelas harus dipilih');
      return;
    }
    if (!manualSubject) {
      alert('Mata Pelajaran harus dipilih');
      return;
    }
    if (!manualSemester) {
      alert('Semester harus dipilih');
      return;
    }

    setManualSaving(true);
    try {
      const tpData = {
        chapter: manualChapter.trim(),
        tp: manualTPText.trim(),
        semester: parseInt(manualSemester),
        grade: manualGrade,
        subject: manualSubject,
        cpReference: manualCPReference.trim() || 'Input Manual',
        user_id: user.uid,
        created_at: Timestamp.now().toDate().toISOString(),
        isRaporFormat: false
      };

      await addDoc(collection(db, 'learning_goals'), tpData);
      
      alert('✅ TP berhasil ditambahkan!');
      
      // Reload data
      await loadSavedTPs();
      
      // Reset form
      setManualTPText('');
      setManualChapter('');
      setManualGrade('');
      setManualSubject('');
      setManualSemester('');
      setManualCPReference('');
      setManualInputOpen(false);
    } catch (err: any) {
      alert('Gagal menyimpan TP: ' + err.message);
    } finally {
      setManualSaving(false);
    }
  };

  const uniqueGrades = Array.from(new Set(savedTPs.map(tp => tp.grade))).sort((a, b) => parseInt(a) - parseInt(b));
  const uniqueSubjects = Array.from(new Set(savedTPs.map(tp => tp.subject).filter(s => s)));

  const groupedTPs = filteredTPs.reduce((acc, tp) => {
    const key = `${tp.grade}-${tp.semester}`;
    if (!acc[key]) {
      acc[key] = {
        grade: tp.grade,
        semester: tp.semester,
        chapters: {}
      };
    }
    
    if (!acc[key].chapters[tp.chapter]) {
      acc[key].chapters[tp.chapter] = [];
    }
    
    acc[key].chapters[tp.chapter].push(tp);
    return acc;
  }, {} as Record<string, any>);

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="rounded-3xl border-slate-200">
          <CardContent className="p-10 text-center">
            <p className="text-slate-600">Silakan login terlebih dahulu</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalCount = savedTPs.length;
  const originalCount = savedTPs.filter(tp => !tp.isRaporFormat).length;
  const compressedCount = savedTPs.filter(tp => tp.isRaporFormat).length;
  const selectedFilterCount = filteredTPs.length;

  const clearFilters = () => {
    setFilterGrade('');
    setFilterSemester('');
    setFilterSubject('');
    setSearchQuery('');
  };

  const hasFilters = !!(filterGrade || filterSemester || filterSubject || searchQuery);

  return (
    <div className="w-full space-y-7 py-4 px-1 sm:px-2">
      {/* HERO */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:p-8"
      >
        <motion.div
          animate={{ x: [0, 18, 0], y: [0, -10, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-100/50 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -16, 0], y: [0, 12, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-violet-100/40 blur-3xl"
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              <BookOpen className="h-3.5 w-3.5" />
              Learning Goals Workspace
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              TP Tersimpan
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Kelola semua Tujuan Pembelajaran yang telah Anda simpan,
              rapikan metadata, kompres ke format rapor, atau lanjutkan ke pembuatan soal.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Semua', totalCount, 'bg-blue-50 text-blue-700'],
              ['Lengkap', originalCount, 'bg-violet-50 text-violet-700'],
              ['Rapor', compressedCount, 'bg-emerald-50 text-emerald-700'],
              ['Ditampilkan', selectedFilterCount, 'bg-slate-100 text-slate-700'],
            ].map(([label, value, classes], index) => (
              <motion.div
                key={String(label)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + index * 0.05, duration: 0.3 }}
                className="min-w-[96px] rounded-2xl border border-slate-100 bg-white/85 p-3.5 text-center shadow-sm backdrop-blur"
              >
                <p className="text-xl font-black text-slate-900">{value}</p>
                <p className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${classes}`}>
                  {label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* TABS */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4 }}
        className="rounded-[28px] border border-slate-200/80 bg-white p-2 shadow-[0_8px_28px_rgba(15,23,42,0.04)]"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([
            ['all', 'Semua TP', totalCount],
            ['original', 'Format Lengkap', originalCount],
            ['compressed', 'Format Rapor 100-char', compressedCount],
          ] as const).map(([tab, label, count]) => {
            const active = activeTab === tab;
            return (
              <motion.button
                key={tab}
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => setActiveTab(tab)}
                className={`relative flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition-colors ${
                  active ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mytp-tab-indicator"
                    className="absolute inset-0 rounded-2xl bg-blue-50"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="relative">{label}</span>
                <span className={`relative rounded-full px-2 py-0.5 text-[10px] ${active ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* INFO */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.35 }}
        className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3.5 text-sm text-blue-900 shadow-sm"
      >
        Menampilkan <strong>{filteredTPs.length}</strong> TP dari total <strong>{savedTPs.length}</strong> yang tersimpan. Gunakan filter untuk mempersempit hasil pencarian.
      </motion.div>

      {/* FILTER TOOLBAR */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6"
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Workspace</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">Filter & Pencarian</h2>
              <p className="mt-1 text-xs text-slate-400">
                {filteredTPs.length} dari {savedTPs.length} TP ditampilkan
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => setManualInputOpen(true)}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600"
              >
                <Plus className="mr-2 h-4 w-4" />
                Input Manual
              </Button>
              <Button
                size="sm"
                onClick={() => setImportModalOpen(true)}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                <FileUp className="mr-2 h-4 w-4" />
                Import XLSX
              </Button>
              {filteredTPs.length > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={exportToXLSX} className="rounded-xl">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportToExcel} className="rounded-xl">
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="rounded-xl">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus Semua
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Kelas</label>
              <select
                aria-label="Filter berdasarkan kelas"
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              >
                <option value="">Semua Kelas</option>
                {uniqueGrades.map(grade => (
                  <option key={grade} value={grade}>Kelas {grade}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Semester</label>
              <select
                aria-label="Filter berdasarkan semester"
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              >
                <option value="">Semua Semester</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Mata Pelajaran</label>
              <select
                aria-label="Filter berdasarkan mata pelajaran"
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              >
                <option value="">Semua Mapel</option>
                {uniqueSubjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Cari TP</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari TP, bab, atau CP..."
                  className="h-[46px] rounded-2xl border-slate-200 bg-slate-50 pl-10 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Filter aktif</span>
              {filterGrade && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Kelas {filterGrade}</span>}
              {filterSemester && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">Semester {filterSemester}</span>}
              {filterSubject && <span className="max-w-[220px] truncate rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{filterSubject}</span>}
              {searchQuery && <span className="max-w-[220px] truncate rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">"{searchQuery}"</span>}
              <Button size="sm" variant="ghost" onClick={clearFilters} className="ml-auto rounded-xl text-slate-500">
                <X className="mr-1.5 h-3.5 w-3.5" />
                Reset Filter
              </Button>
            </div>
          )}
        </div>
      </motion.section>

      {/* DATA */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.section
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-[30px] border border-slate-200 bg-white p-10 shadow-sm"
          >
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <div>
                <p className="font-bold text-slate-800">Memuat TP tersimpan...</p>
                <p className="mt-1 text-xs text-slate-400">Mengambil data Tujuan Pembelajaran dari database.</p>
              </div>
            </div>
          </motion.section>
        ) : error ? (
          <motion.section
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[30px] border border-red-200 bg-red-50 p-8 text-center shadow-sm"
          >
            <p className="font-bold text-red-700">Gagal memuat TP</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-red-600">{error}</p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={loadSavedTPs}>Coba Lagi</Button>
          </motion.section>
        ) : filteredTPs.length === 0 ? (
          <motion.section
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[30px] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-black text-slate-900">
              {savedTPs.length === 0 ? 'Belum ada TP tersimpan' : 'Tidak ada TP yang sesuai'}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {savedTPs.length === 0
                ? 'Generate TP baru di menu Generate TP atau tambahkan TP secara manual.'
                : 'Coba ubah filter atau kata pencarian untuk melihat hasil lainnya.'}
            </p>
            {savedTPs.length === 0 ? (
              <Button className="mt-5 rounded-xl" onClick={() => window.location.href = '/dashboard/generate-tp'}>
                <Plus className="mr-2 h-4 w-4" />
                Generate TP Baru
              </Button>
            ) : hasFilters ? (
              <Button variant="outline" className="mt-5 rounded-xl" onClick={clearFilters}>
                Reset Filter
              </Button>
            ) : null}
          </motion.section>
        ) : (
          <motion.div
            key="content"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            className="grid grid-cols-1 gap-5 2xl:grid-cols-2"
          >
            {Object.entries(groupedTPs)
              .sort(([, a], [, b]) => {
                const dataA = a as any;
                const dataB = b as any;
                return dataA.semester - dataB.semester || String(dataA.grade).localeCompare(String(dataB.grade), undefined, { numeric: true });
              })
              .map(([key, data]) => {
                const group = data as any;
                const chapterEntries = Object.entries(group.chapters) as [string, SavedTP[]][];
                const groupCount = chapterEntries.reduce((sum, [, tps]) => sum + tps.length, 0);

                return (
                  <motion.section
                    key={key}
                    variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
                    className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
                  >
                    <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                            <BookOpen className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Learning Goals</p>
                            <h2 className="mt-1 text-lg font-black text-slate-900">Kelas {group.grade} · Semester {group.semester}</h2>
                          </div>
                        </div>
                        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700">{groupCount} TP</span>
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      {chapterEntries.map(([chapter, tps]) => (
                        <motion.div
                          key={chapter}
                          whileHover={{ y: -2 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                          className="overflow-hidden rounded-[24px] border border-slate-200"
                        >
                          <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3.5">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black text-slate-500 shadow-sm">{tps.length}</div>
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-bold text-slate-800">{chapter}</h3>
                                <p className="mt-0.5 text-[10px] text-slate-400">Tujuan Pembelajaran</p>
                              </div>
                            </div>
                          </div>

                          <div className="divide-y divide-slate-100">
                            {tps.map((tp, tpIndex) => (
                              <motion.div
                                key={tp.id}
                                whileHover={{ backgroundColor: 'rgba(248,250,252,0.85)' }}
                                className="group p-4"
                              >
                                {editingId === tp.id ? (
                                  <div className="space-y-3">
                                    <textarea
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      placeholder="Masukkan teks TP yang diubah"
                                      aria-label="Edit teks TP"
                                      className="min-h-[120px] w-full resize-y rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <Button size="sm" onClick={() => saveEdit(tp.id)} className="rounded-xl">
                                        <Check className="mr-1.5 h-4 w-4" /> Simpan
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={cancelEdit} className="rounded-xl">
                                        <X className="mr-1.5 h-4 w-4" /> Batal
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start gap-4">
                                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[10px] font-black text-slate-500">{String(tpIndex + 1).padStart(2, '0')}</div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm leading-6 text-slate-700">{tp.tp}</p>
                                      <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {tp.subject && (
                                          <span className="max-w-[220px] truncate rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{tp.subject}</span>
                                        )}
                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${tp.isRaporFormat ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}>
                                          {tp.isRaporFormat ? 'Format Rapor 100-char' : 'Format Lengkap ABCD'}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{tp.tp.length} karakter</span>
                                      </div>
                                      <p className="mt-2 text-[10px] text-slate-400">
                                        Dibuat: {new Date(tp.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                                      </p>
                                    </div>

                                    <div className="flex shrink-0 flex-wrap justify-end gap-1 opacity-100 sm:opacity-70 sm:transition-opacity sm:group-hover:opacity-100">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => window.location.href = `/dashboard/generate-soal?tpId=${encodeURIComponent(tp.id)}`}
                                        title="Buat soal dari TP"
                                        className="rounded-xl text-blue-600 hover:bg-blue-50"
                                      >
                                        <span className="text-base">🧠</span>
                                      </Button>
                                      <Button size="icon" variant="ghost" onClick={() => openEditMetadata(tp)} title="Edit metadata" className="rounded-xl text-indigo-600 hover:bg-indigo-50">
                                        <Settings className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" onClick={() => moveToSemester(tp.id, tp.semester, tp.tp)} title={`Pindahkan ke Semester ${tp.semester === 1 ? 2 : 1}`} className="rounded-xl text-cyan-600 hover:bg-cyan-50">
                                        <ArrowRightLeft className="h-4 w-4" />
                                      </Button>
                                      {tp.isRaporFormat && (tp.tpOriginal ? (
                                        <Button size="icon" variant="ghost" onClick={() => { setSelectedTPForView(tp); setViewFullFormatOpen(true); }} title="Lihat format lengkap ABCD" className="rounded-xl text-violet-600 hover:bg-violet-50">
                                          <BookOpen className="h-4 w-4" />
                                        </Button>
                                      ) : (
                                        <Button size="icon" variant="ghost" onClick={() => { setSelectedTPForRestore(tp); setRestoreOriginalOpen(true); setRestoreOriginalText(''); }} title="Tambahkan format ABCD original" className="rounded-xl text-amber-600 hover:bg-amber-50">
                                          <BookOpen className="h-4 w-4" />
                                        </Button>
                                      ))}
                                      {!tp.isRaporFormat && (
                                        <Button size="icon" variant="ghost" onClick={() => openCompressModal(tp)} title="Kompres ke format rapor" className="rounded-xl text-orange-600 hover:bg-orange-50">
                                          <Zap className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <Button size="icon" variant="ghost" onClick={() => startEdit(tp)} title="Edit teks TP" className="rounded-xl text-slate-500 hover:bg-slate-100">
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" onClick={() => handleDelete(tp.id, tp.tp)} title="Hapus TP" className="rounded-xl text-red-500 hover:bg-red-50">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.section>
                );
              })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compress Modal */}
      {compressModalOpen && selectedTPForCompress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-600" />
                Kompresi TP ke Format Rapor
              </CardTitle>
              <CardDescription>
                Ringkas TP format lengkap menjadi maksimal 100 karakter untuk rapor
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 p-6">
              {/* Original TP */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">TP Original:</label>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-sm text-gray-700">{selectedTPForCompress.tp}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedTPForCompress.tp.length} karakter
                  </p>
                </div>
              </div>

              {/* Compression Button */}
              {!compressionResult && (
                <div className="flex gap-3">
                  <Button
                    onClick={performCompression}
                    disabled={compressLoading || trimWithAILoading}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                  >
                    {compressLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sedang menganalisis...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Kompresi TP
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={performTrimWithAI}
                    disabled={compressLoading || trimWithAILoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {trimWithAILoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sedang pangkas...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Pangkas dengan AI
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Compression Result */}
              {compressionResult && (
                <div className="space-y-4">
                  {/* Status Badge */}
                  <div className={`p-3 rounded-lg ${
                    compressionResult.hasSplit 
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-green-50 border border-green-200'
                  }`}>
                    <p className="font-semibold text-sm">
                      {compressionResult.hasSplit 
                        ? `✅ Akan di-split menjadi ${compressionResult.splits?.length} bagian`
                        : `✅ Berhasil dikompres menjadi ${compressionResult.charCount} karakter`
                      }
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Confidence: {(compressionResult.confidenceScore * 100).toFixed(0)}%
                    </p>
                  </div>

                  {/* Save Options */}
                  {compressionResult.hasSplit && compressionResult.splits ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-semibold">Pilihan Penyimpanan:</label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCompressEditMode(!compressEditMode)}
                          className="text-xs"
                        >
                          {compressEditMode ? (
                            <>
                              <X className="w-3 h-3 mr-1" />
                              Batal Edit
                            </>
                          ) : (
                            <>
                              <Edit2 className="w-3 h-3 mr-1" />
                              Edit
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {/* Option Split */}
                      <label className={`flex items-start p-3 border-2 rounded-lg cursor-pointer ${
                        compressSaveOption === 'split' ? 'border-orange-600' : 'border-gray-200'
                      }`}>
                        <input
                          type="radio"
                          name="save-option"
                          value="split"
                          checked={compressSaveOption === 'split'}
                          onChange={(e) => setCompressSaveOption('split')}
                          className="mt-1 mr-3"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-sm">Simpan sebagai {compressEditMode ? compressEditSplits.length : compressionResult.splits.length} TP terpisah</p>
                          <div className="mt-2 space-y-2">
                            {(compressEditMode ? compressEditSplits : compressionResult.splits).map((split, i) => (
                              <div key={i} className={compressEditMode ? "text-xs bg-blue-50 p-2 rounded border border-blue-200" : "text-xs bg-white p-2 rounded border"}>
                                {compressEditMode ? (
                                  <div className="space-y-1">
                                    <p className="font-medium text-xs">TP {i + 1}:</p>
                                    <textarea
                                      value={split}
                                      onChange={(e) => {
                                        const newSplits = [...compressEditSplits];
                                        newSplits[i] = e.target.value;
                                        setCompressEditSplits(newSplits);
                                      }}
                                      placeholder="Edit teks TP..."
                                      aria-label={`Edit teks TP ${i + 1}`}
                                      className="w-full p-1 border rounded text-xs"
                                      rows={2}
                                    />
                                    <p className={`text-xs ${split.length > 100 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                      {split.length} / 100 karakter {split.length > 100 && '⚠️'}
                                    </p>
                                  </div>
                                ) : (
                                  <>
                                    <p className="font-medium">TP {i + 1}:</p>
                                    <p className="text-gray-600">{split}</p>
                                    <p className="text-gray-400 mt-1">{split.length} karakter</p>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </label>

                      {/* Option Single Compress */}
                      <label className={`flex items-start p-3 border-2 rounded-lg cursor-pointer ${
                        compressSaveOption === 'single' ? 'border-orange-600' : 'border-gray-200'
                      }`}>
                        <input
                          type="radio"
                          name="save-option"
                          value="single"
                          checked={compressSaveOption === 'single'}
                          onChange={(e) => setCompressSaveOption('single')}
                          className="mt-1 mr-3"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-sm">Simpan sebagai 1 TP hasil kompresi</p>
                          <div className="mt-2 text-xs bg-white p-2 rounded border">
                            <p className="text-gray-600">{compressionResult.compressed}</p>
                            <p className="text-gray-400 mt-1">{compressionResult.charCount} karakter</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Edit Toggle Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCompressEditMode(!compressEditMode)}
                        className="w-full"
                      >
                        {compressEditMode ? (
                          <>
                            <X className="w-4 h-4 mr-2" />
                            Batal Edit
                          </>
                        ) : (
                          <>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit Manual
                          </>
                        )}
                      </Button>

                      {/* Display Mode */}
                      {!compressEditMode && (
                        <div className="p-3 bg-white border rounded-lg">
                          <p className="font-semibold text-sm mb-2">Hasil Kompresi:</p>
                          <p className="text-sm text-gray-700">{compressionResult.compressed}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {compressionResult.charCount} / 100 karakter
                          </p>
                        </div>
                      )}

                      {/* Edit Mode */}
                      {compressEditMode && (
                        <div className="space-y-2">
                          <textarea
                            value={compressEditText}
                            onChange={(e) => setCompressEditText(e.target.value)}
                            placeholder="Edit teks TP di sini..."
                            aria-label="Edit teks TP hasil kompresi"
                            className="w-full p-2 border rounded text-sm"
                            rows={4}
                          />
                          <div className="flex justify-between items-center">
                            <span className={`text-xs font-medium ${
                              compressEditText.length > 100 
                                ? 'text-red-600' 
                                : compressEditText.length > 90
                                ? 'text-orange-600'
                                : 'text-green-600'
                            }`}>
                              {compressEditText.length} / 100 karakter
                            </span>
                            {compressEditText.length > 100 && (
                              <span className="text-xs text-red-600">⚠️ Terlalu panjang</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => {
                        setCompressionResult(null);
                        setCompressLoading(false);
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      ← Kembali
                    </Button>
                    <Button
                      onClick={saveCompressedTP}
                      disabled={compressLoading}
                      className="flex-1 bg-orange-600 hover:bg-orange-700"
                    >
                      {compressLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Simpan & Tutup
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>

            {/* Modal Close Button */}
            <button
              onClick={() => {
                setCompressModalOpen(false);
                setSelectedTPForCompress(null);
                setCompressionResult(null);
              }}
              title="Tutup modal"
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </Card>
        </div>
      )}

      {/* Modal View Full Format ABCD */}
      {viewFullFormatOpen && selectedTPForView && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                Format Lengkap ABCD (Original)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Format Info */}
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-700 font-medium">ℹ️ Format Lengkap</p>
                <p className="text-xs text-blue-600 mt-1">Ini adalah format original sebelum dikompresi ke 100 karakter</p>
              </div>

              {/* Compressed Version */}
              <div className="border rounded p-4 bg-yellow-50">
                <p className="text-xs font-semibold text-yellow-700 mb-2">📋 Versi Ringkas (100 char)</p>
                <p className="text-sm">{selectedTPForView.tp}</p>
                <p className="text-xs text-gray-500 mt-2">{selectedTPForView.tp.length} karakter</p>
              </div>

              <div className="border-t my-4"></div>

              {/* Original Version */}
              <div className="border rounded p-4 bg-purple-50">
                <p className="text-xs font-semibold text-purple-700 mb-2">📚 Versi Lengkap ABCD (Original)</p>
                <p className="text-sm whitespace-pre-wrap">{selectedTPForView.tpOriginal}</p>
                <p className="text-xs text-gray-500 mt-2">{selectedTPForView.tpOriginal?.length || 0} karakter</p>
              </div>

              {/* Comparison */}
              <div className="bg-green-50 border border-green-200 rounded p-3 mt-4">
                <p className="text-xs font-semibold text-green-700 mb-2">📊 Perbandingan</p>
                <div className="text-xs text-green-600 space-y-1">
                  <p>✓ Berhasil dikompres dari {selectedTPForView.tpOriginal?.length || 0} menjadi {selectedTPForView.tp.length} karakter</p>
                  <p>✓ Pengurangan: {((selectedTPForView.tpOriginal?.length || 0) - selectedTPForView.tp.length)} karakter ({Math.round(((selectedTPForView.tpOriginal?.length || 0) - selectedTPForView.tp.length) / (selectedTPForView.tpOriginal?.length || 1) * 100)}%)</p>
                </div>
              </div>
            </CardContent>

            {/* Modal Close Button */}
            <button
              onClick={() => {
                setViewFullFormatOpen(false);
                setSelectedTPForView(null);
              }}
              title="Tutup modal"
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </Card>
        </div>
      )}

      {/* Modal Restore Original ABCD */}
      {restoreOriginalOpen && selectedTPForRestore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-600" />
                Pulihkan Format ABCD Original
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Info */}
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <p className="text-sm text-amber-700 font-medium">ℹ️ Pulihkan Data Original</p>
                <p className="text-xs text-amber-600 mt-1">
                  TP ini sudah dikompres menjadi {selectedTPForRestore.tp.length} karakter, 
                  tapi format ABCD original tidak tersimpan. Silakan input kembali format lengkapnya.
                </p>
              </div>

              {/* Current Compressed Version */}
              <div className="border rounded p-4 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700 mb-2">📋 Versi Ringkas Saat Ini (100 char)</p>
                <p className="text-sm">{selectedTPForRestore.tp}</p>
                <p className="text-xs text-gray-500 mt-2">{selectedTPForRestore.tp.length} karakter</p>
              </div>

              {/* Input Original */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block">
                  📝 Masukkan Format ABCD Original (Lengkap)
                </label>
                <textarea
                  value={restoreOriginalText}
                  onChange={(e) => setRestoreOriginalText(e.target.value)}
                  placeholder="Contoh: Peserta didik mampu mengidentifikasi dan menggunakan kalimat aktif dan kalimat pasif dalam berbagai konteks"
                  className="w-full h-32 p-3 border rounded bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {restoreOriginalText.length} karakter
                </p>
              </div>

              {/* Validation Info */}
              {restoreOriginalText.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-xs text-green-700">
                    ✓ Format akan disimpan dengan panjang {restoreOriginalText.length} karakter
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={restoreOriginalTP}
                  disabled={!restoreOriginalText.trim() || restoreLoading}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {restoreLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Simpan Original
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setRestoreOriginalOpen(false);
                    setSelectedTPForRestore(null);
                    setRestoreOriginalText('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Batal
                </Button>
              </div>
            </CardContent>

            {/* Modal Close Button */}
            <button
              onClick={() => {
                setRestoreOriginalOpen(false);
                setSelectedTPForRestore(null);
                setRestoreOriginalText('');
              }}
              title="Tutup modal"
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </Card>
        </div>
      )}

      {/* Modal Edit Metadata */}
      {editMetadataOpen && selectedTPForMetadata && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl bg-white">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                Edit Metadata TP
              </CardTitle>
              <CardDescription>
                Ubah informasi kelas, mata pelajaran, semester, dan bab
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 p-6">
              {/* TP Preview */}
              <div className="bg-gray-50 border rounded p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Teks TP:</p>
                <p className="text-sm text-gray-700">{selectedTPForMetadata.tp}</p>
              </div>

              {/* Form */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Kelas *</label>
                  <select
                    value={metadataGrade}
                    onChange={(e) => setMetadataGrade(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Pilih Kelas</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Semester *</label>
                  <select
                    value={metadataSemester}
                    onChange={(e) => setMetadataSemester(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Pilih Semester</option>
                    <option value="1">Semester 1 (Ganjil)</option>
                    <option value="2">Semester 2 (Genap)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Mata Pelajaran</label>
                <select
                  value={metadataSubject}
                  onChange={(e) => setMetadataSubject(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Pilih Mata Pelajaran</option>
                  {sdSubjects.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Atau ketik manual jika mapel tidak ada di daftar
                </p>
                <Input
                  type="text"
                  placeholder="Atau ketik nama mapel..."
                  value={metadataSubject}
                  onChange={(e) => setMetadataSubject(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Bab/Elemen</label>
                <Input
                  type="text"
                  placeholder="Contoh: Bab 1 - Bilangan"
                  value={metadataChapter}
                  onChange={(e) => setMetadataChapter(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={saveMetadataEdit}
                  disabled={metadataLoading}
                  className="flex-1"
                >
                  {metadataLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Simpan Perubahan
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditMetadataOpen(false);
                    setSelectedTPForMetadata(null);
                  }}
                  disabled={metadataLoading}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Import XLSX Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <FileUp className="w-5 h-5" />
                Import TP dari Excel
              </CardTitle>
              <CardDescription className="text-blue-100">
                Upload file Excel (.xlsx) dengan format yang sesuai
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">📋 Format File Excel:</h4>
                <p className="text-sm text-blue-800 mb-3">File Excel harus memiliki kolom-kolom berikut:</p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li><strong>Bab/Elemen</strong> - Nama bab atau elemen (wajib)</li>
                  <li><strong>Tujuan Pembelajaran</strong> - Teks TP lengkap (wajib)</li>
                  <li><strong>Semester</strong> - Angka 1 atau 2 (wajib)</li>
                  <li><strong>Kelas</strong> - Tingkat kelas 1-12 (wajib)</li>
                  <li><strong>Mata Pelajaran</strong> - Nama mata pelajaran (wajib)</li>
                  <li><strong>Referensi CP</strong> - Referensi capaian pembelajaran (opsional)</li>
                </ul>
              </div>

              {/* Download Template */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                      📥 Download Template Excel
                    </h4>
                    <p className="text-sm text-green-800 mb-3">
                      Download file template Excel dengan format yang sudah sesuai dan berisi 3 contoh data TP sebagai panduan.
                    </p>
                    <Button
                      onClick={downloadTemplateXLSX}
                      variant="outline"
                      size="sm"
                      className="bg-white hover:bg-green-50 border-green-300 text-green-700 hover:text-green-800 font-semibold"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">💡 Tips Penting:</h4>
                <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                  <li>Gunakan template yang sudah disediakan untuk menghindari kesalahan format</li>
                  <li>Pastikan tidak ada baris kosong di tengah-tengah data</li>
                  <li>Kolom <strong>Referensi CP</strong> boleh dikosongkan (opsional)</li>
                  <li>Nilai <strong>Semester</strong> harus angka 1 atau 2</li>
                  <li>Nilai <strong>Kelas</strong> harus angka 1-12</li>
                </ul>
              </div>

              {/* File Input */}
              <div>
                <label className="block text-sm font-medium mb-2">Pilih File Excel</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {importFile && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ File terpilih: {importFile.name}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={handleImportXLSX}
                  disabled={!importFile || importLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  {importLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Mengimport...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Sekarang
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportModalOpen(false);
                    setImportFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={importLoading}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Manual Input Modal */}
      {manualInputOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
            <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Tambah TP Manual
              </CardTitle>
              <CardDescription className="text-green-100">
                Input tujuan pembelajaran secara manual
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {/* Tujuan Pembelajaran */}
              <div>
                <label className="block text-sm font-medium mb-2">Tujuan Pembelajaran *</label>
                <textarea
                  value={manualTPText}
                  onChange={(e) => setManualTPText(e.target.value)}
                  placeholder="Contoh: Peserta didik mampu mengidentifikasi bilangan bulat dan operasinya dalam kehidupan sehari-hari"
                  className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {manualTPText.length} karakter
                </p>
              </div>

              {/* Bab/Elemen */}
              <div>
                <label className="block text-sm font-medium mb-2">Bab/Elemen *</label>
                <Input
                  type="text"
                  value={manualChapter}
                  onChange={(e) => setManualChapter(e.target.value)}
                  placeholder="Contoh: Bab 1 - Bilangan Bulat"
                />
              </div>

              {/* Grid untuk Kelas, Semester */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Kelas *</label>
                  <select
                    value={manualGrade}
                    onChange={(e) => setManualGrade(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Pilih Kelas</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                      <option key={g} value={g}>Kelas {g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Semester *</label>
                  <select
                    value={manualSemester}
                    onChange={(e) => setManualSemester(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Pilih Semester</option>
                    <option value="1">Semester 1 (Ganjil)</option>
                    <option value="2">Semester 2 (Genap)</option>
                  </select>
                </div>
              </div>

              {/* Mata Pelajaran */}
              <div>
                <label className="block text-sm font-medium mb-2">Mata Pelajaran *</label>
                <select
                  value={manualSubject}
                  onChange={(e) => setManualSubject(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Pilih Mata Pelajaran</option>
                  {sdSubjects.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Atau ketik manual jika mapel tidak ada di daftar
                </p>
                <Input
                  type="text"
                  placeholder="Atau ketik nama mapel..."
                  value={manualSubject}
                  onChange={(e) => setManualSubject(e.target.value)}
                  className="mt-2"
                />
              </div>

              {/* Referensi CP (Optional) */}
              <div>
                <label className="block text-sm font-medium mb-2">Referensi CP (Opsional)</label>
                <Input
                  type="text"
                  value={manualCPReference}
                  onChange={(e) => setManualCPReference(e.target.value)}
                  placeholder="Contoh: CP Fase A - Bilangan"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={handleManualInput}
                  disabled={manualSaving}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600"
                >
                  {manualSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Simpan TP
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setManualInputOpen(false);
                    setManualTPText('');
                    setManualChapter('');
                    setManualGrade('');
                    setManualSubject('');
                    setManualSemester('');
                    setManualCPReference('');
                  }}
                  disabled={manualSaving}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}