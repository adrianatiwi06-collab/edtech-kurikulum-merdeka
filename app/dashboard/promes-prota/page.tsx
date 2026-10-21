'use client';
import { generateModulAjarAction } from '../modul-ajar/actions'; // Menggunakan action server Gemini yang sama
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, Loader2, Trash2, Search, FileText, Download, Calendar 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function ProtaPromesPage() {
  const { user } = useAuth();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'generator' | 'tersimpan'>('generator');

  // Form State
  const [namaSekolah, setNamaSekolah] = useState('SD Negeri Nusawangkal 02');
  const [namaKepalaSekolah, setNamaKepalaSekolah] = useState('..............................');
  const [nipKepalaSekolah, setNipKepalaSekolah] = useState('..............................');
  const [namaGuru, setNamaGuru] = useState('Gara Nuradin, S.Pd.SD.');
  const [nipGuru, setNipGuru] = useState('198207142022211006');
  
  const [mataPelajaran, setMataPelajaran] = useState('Matematika');
  const [kelas, setKelas] = useState('2');
  const [fase, setFase] = useState('A');
  const [tahunPelajaran, setTahunPelajaran] = useState('2026/2027');
  const [kota, setKota] = useState('Nusawangkal');
  const [tanggalPembuatan, setTanggalPembuatan] = useState('20 Juli 2026');

  // Generator & Database Tersimpan
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedDoc, setGeneratedDoc] = useState<any | null>(null);
  const [savedDocs, setSavedDocs] = useState<any[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');

  const sdSubjects = [
    'Pendidikan Agama Islam', 'Pendidikan Pancasila', 'Bahasa Indonesia', 'Matematika',
    'Ilmu Pengetahuan Alam', 'IPAS (Ilmu Pengetahuan Alam dan Sosial)', 
    'Pendidikan Jasmani Olahraga dan Kesehatan (PJOK)', 'Seni Rupa', 'Bahasa Inggris', 'Bahasa Daerah'
  ];

  useEffect(() => {
    if (user) {
      loadSavedDocuments();
    }
  }, [user]);

  const loadSavedDocuments = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'prota_promes_docs'), where('user_id', '==', user.uid));
      const snapshot = await getDocs(q);
      const docsList: any[] = [];
      snapshot.forEach(d => docsList.push({ id: d.id, ...d.data() }));
      docsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSavedDocs(docsList);
    } catch (err) {
      console.error('Gagal memuat dokumen Prota & Promes:', err);
    }
  };

  // PROMPT INDUK PROTA & PROMES
  const handleGenerate = async () => {
    setLoading(true);
    setLoadingMessage('AI sedang menyusun Program Tahunan (Prota) & Program Semester (Promes) Kurikulum Merdeka...');

    try {
      const prompt = `
// Bertindaklah sebagai ahli kurikulum, perancang pembelajaran nasional, dan praktisi administrasi guru profesional di Indonesia.
//
// Tugasmu adalah menyusun dokumen **Program Tahunan (Prota) dan Program Semester (Promes) secara lengkap, logis, terstruktur, dan siap pakai** untuk tahun ajaran ${tahunPelajaran}.
//
// Gunakan data berikut sebagai acuan:
// - Nama Satuan Pendidikan: ${namaSekolah}
// - Mata Pelajaran: ${mataPelajaran}
// - Fase: ${fase} / Kelas: ${kelas}
// - Tahun Pelajaran: ${tahunPelajaran}
// - Penyusun: ${namaGuru} (NIP: ${nipGuru})
//
// ATURAN FORMAT OUTPUT (WAJIB, karena output langsung diekspor ke dokumen Word):
// - JANGAN menulis halaman sampul, judul ganda, atau blok tanda tangan di dokumen. Aplikasi menambahkannya sendiri. Mulai langsung dari "## BAGIAN I".
// - Gunakan HANYA heading: "## " untuk bagian utama (HURUF KAPITAL), dan "### " untuk sub-bagian bernomor.
// - Sajikan informasi dalam TABEL Markdown dengan baris pemisah |---|---|. Setiap baris tabel harus satu baris teks dengan jumlah kolom sama header.
// - Dilarang: blok kode, diagram ASCII, emoji, garis pemisah "---", HTML. Gunakan <br> untuk baris baru di sel tabel.
// - Gunakan **tebal** hanya untuk penekanan penting. Daftar pakai "- " atau "1. ". Kelompok daftar tulis sebagai satu blok.
// - Gunakan bahasa Indonesia baku, konkret, siap pakai. Hindari kalimat pembuka/penutup berbelit.
//
// Struktur:
//
// ## BAGIAN I: ANALISIS STRUKTUR WAKTU & KALENDER PENDIDIKAN
// - Tabel Perhitungan Pekan Efektif Semester 1: No | Bulan | Jumlah Minggu | Minggu Tidak Efektif | Minggu Efektif | JP Efektif
// - Tabel Perhitungan Pekan Efektif Semester 2 (sama struktur)
// - Tabel Distribusi JP Efektif: Semester | Total JP | JP Efektif
//
// ## BAGIAN II: PROGRAM TAHUNAN (PROTA)
// Tabel 3 kolom: No | Bab/Topik | Alokasi Waktu/JP (pemetaan materi seluruh tahun Semester 1 & 2)
//
// ## BAGIAN III: PROGRAM SEMESTER (PROMES) SEMESTER 1
// Tabel matriks: Bulan | Minggu Ke-1 | Minggu Ke-2 | ... | Minggu Ke-5/6
//
// ## BAGIAN IV: PROGRAM SEMESTER (PROMES) SEMESTER 2
// Tabel matriks serupa untuk Semester 2
// `;
//

      const result = await generateModulAjarAction(prompt);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Server AI gagal merespons.');
      }

      const docData = {
        title: `Prota & Promes ${mataPelajaran} Kelas ${kelas}`,
        school: namaSekolah,
        headmaster: namaKepalaSekolah,
        headmasterNip: nipKepalaSekolah,
        teacher: namaGuru,
        teacherNip: nipGuru,
        subject: mataPelajaran,
        grade: kelas,
        fase: fase,
        academicYear: tahunPelajaran,
        city: kota,
        date: tanggalPembuatan,
        konten_ai: result.data,
        created_at: new Date().toISOString()
      };

      setGeneratedDoc(docData);
      toast.success('Prota & Promes berhasil digenerate!');
    } catch (err: any) {
      toast.error('Gagal generate: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSaveDoc = async () => {
    if (!user || !generatedDoc) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'prota_promes_docs'), {
        user_id: user.uid,
        ...generatedDoc
      });
      toast.success('Dokumen Prota & Promes berhasil disimpan!');
      loadSavedDocuments();
      setActiveTab('tersimpan');
    } catch (err: any) {
      toast.error('Gagal menyimpan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fungsi Export ke Word (.doc) dengan Tabel Otomatis
  const handleExportWord = (docItem: any) => {
    if (!docItem || !docItem.konten_ai) {
      toast.error('Konten dokumen kosong.');
      return;
    }

    // Pembersihan: hapus judul buatan AI, blok pengesahan, garis berlebihan
    let md = docItem.konten_ai;
    
    // Buang 5 baris pertama bila berisi judul duplikat
    const lines = md.split('\n');
    let startIdx = 0;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (/^(#{1,3}\s+|PROGRAM|DOKUMEN|TAHUN)/.test(lines[i].trim())) {
        startIdx = i;
        break;
      }
    }
    md = lines.slice(startIdx).join('\n');

    // Buang blok pengesahan (ditambah app sendiri)
    const sigIdx = md.lastIndexOf('Mengetahui');
    if (sigIdx > md.length - 1000) md = md.slice(0, sigIdx);

    // Konversi Markdown → HTML dengan tabel, list bertingkat, pembersihan inline markup
    const htmlBody = markdownToHtmlProta(md);

    // CSS dan layout
    const style = `
        @page { size: A4; margin: 2cm 2cm 2cm 2.5cm; }
        body { font-family: "Times New Roman", serif; font-size: 11pt; line-height: 1.4; color: #111; }
        h1 { font-size: 14pt; text-align: center; margin: 12pt 0 8pt; page-break-after: avoid; }
        h2 { font-size: 11.5pt; font-weight: bold; margin: 14pt 0 6pt; padding: 3pt 6pt; background: #D3D3D3; page-break-after: avoid; }
        h3 { font-size: 11pt; font-weight: bold; margin: 10pt 0 4pt; page-break-after: avoid; }
        p { margin: 0 0 6pt; text-align: justify; }
        ul, ol { margin: 3pt 0 6pt; padding-left: 20pt; }
        li { margin: 0 0 2pt; }
        table { width: 100%; border-collapse: collapse; margin: 10pt 0; page-break-inside: avoid; }
        th, td { border: 1px solid #333; padding: 4pt 6pt; text-align: left; vertical-align: top; font-size: 10pt; }
        th { background: #E8E8E8; font-weight: bold; text-align: center; }
        tr { page-break-inside: avoid; }
        .cover-title { text-align: center; font-size: 15pt; font-weight: bold; margin: 6pt 0; }
        .cover-meta { text-align: center; font-size: 10pt; margin: 0 0 4pt; }
        .sig-table { width: 100%; border: none; margin-top: 40pt; }
        .sig-cell { border: none; text-align: center; padding: 5pt; width: 50%; vertical-align: top; }
        .sig-space { height: 50pt; }
    `;

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docItem.title}</title><style>${style}</style></head><body>
      <p class="cover-title">PROGRAM TAHUNAN &amp; PROGRAM SEMESTER</p>
      <p class="cover-meta">${docItem.subject} | Kelas ${docItem.grade} | ${docItem.school}</p>
      <p class="cover-meta">Tahun Pelajaran ${docItem.academicYear}</p>
      <hr/>
      ${htmlBody}
      <table class="sig-table"><tr>
        <td class="sig-cell">Mengetahui,<br/>Kepala ${docItem.school}<div class="sig-space"></div><b>${docItem.headmaster}</b><br/>NIP. ${docItem.headmasterNip}</td>
        <td class="sig-cell">${docItem.city}, ${docItem.date}<br/>Guru Mata Pelajaran<div class="sig-space"></div><b>${docItem.teacher}</b><br/>NIP. ${docItem.teacherNip}</td>
      </tr></table></body></html>`;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docItem.title.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Dokumen berhasil diunduh!');
  };

  // ---- Fungsi-fungsi pembantu konversi Markdown ----
  const escapeHtml = (str: string): string =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const renderInlineMarkdown = (text: string): string => {
    // Hapus atau bersihkan markup inline agar tidak muncul di akhir
    text = text.replace(/\*\*(.+?)\*\*/g, '$1'); // **tebal** → tebal
    text = text.replace(/\*(.+?)\*/g, '$1');     // *italic* → italic
    text = text.replace(/`(.+?)`/g, '$1');       // `kode` → kode
    return escapeHtml(text);
  };

  const markdownToHtmlProta = (markdown: string): string => {
    const lines = (markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const output: string[] = [];
    let paragraph: string[] = [];
    let listStack: Array<{ type: 'ul' | 'ol'; indent: number }> = [];
    let tableRows: string[][] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    const flushPara = () => {
      if (paragraph.length) {
        output.push(`<p>${paragraph.map(renderInlineMarkdown).join('<br/>')}</p>`);
        paragraph = [];
      }
    };
    const closeList = () => {
      while (listStack.length) output.push(`</${listStack.pop()!.type}>`);
    };
    const flushTable = () => {
      if (!tableRows.length) return;
      const rows = tableRows.filter(row => !row.every(c => /^:?-{2,}:?$/.test(c.replace(/\s/g, ''))));
      if (rows.length > 1) {
        const hdr = rows[0];
        const bdy = rows.slice(1);
        output.push(
          '<table><thead><tr>' +
          hdr.map(c => `<th>${renderInlineMarkdown(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          bdy.map(row => '<tr>' + hdr.map((_, i) => 
            `<td>${renderInlineMarkdown(row[i] ?? '')}</td>`
          ).join('') + '</tr>').join('') +
          '</tbody></table>'
        );
      }
      tableRows = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();

      // Blok kode
      if (/^```/.test(trimmed)) {
        flushPara();
        closeList();
        flushTable();
        if (inCodeBlock) {
          output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
          codeLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }
      if (inCodeBlock) {
        codeLines.push(raw);
        continue;
      }

      // Tabel
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        flushPara();
        closeList();
        const cells = trimmed.split('|').filter(c => c.trim() !== '');
        tableRows.push(cells);
        continue;
      } else {
        flushTable();
      }

      if (!trimmed) {
        flushPara();
        closeList();
        continue;
      }

      // Heading
      const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushPara();
        closeList();
        const level = Math.min(heading[1].length, 5);
        output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }

      // Garis separator (jangan output sebagai <hr>, paling-paling skip)
      if (/^([-*_])(?:\s*\1){2,}\s*$/.test(trimmed)) {
        flushPara();
        closeList();
        continue;
      }

      // List bertingkat
      const listMatch = raw.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
      if (listMatch) {
        flushPara();
        const indent = listMatch[1].replace(/\t/g, '    ').length;
        const type: 'ul' | 'ol' = /\d/.test(listMatch[2]) ? 'ol' : 'ul';
        while (listStack.length && indent < listStack[listStack.length - 1].indent) {
          output.push(`</${listStack.pop()!.type}>`);
        }
        const top = listStack[listStack.length - 1];
        if (!top || indent > top.indent) {
          listStack.push({ type, indent });
          output.push(`<${type}>`);
        } else if (top.type !== type) {
          output.push(`</${listStack.pop()!.type}>`);
          listStack.push({ type, indent });
          output.push(`<${type}>`);
        }
        output.push(`<li>${renderInlineMarkdown(listMatch[3])}</li>`);
        continue;
      }

      closeList();
      paragraph.push(trimmed);
    }

    if (inCodeBlock) output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    flushPara();
    closeList();
    flushTable();
    return output.join('\n');
  };


    const handleDeleteDoc = async (id: string) => {
    if (!confirm('Hapus dokumen ini?')) return;
    try {
      await deleteDoc(doc(db, 'prota_promes_docs', id));
      setSavedDocs(savedDocs.filter(d => d.id !== id));
      toast.success('Berhasil dihapus');
    } catch (err) {
      toast.error('Gagal menghapus');
    }
  };

  const filteredDocs = savedDocs.filter(d => 
    d.title?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    d.subject?.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  return (
    <div className="w-full space-y-8 py-4 px-2 max-w-[1600px] mx-auto font-sans">
      
      {/* HEADER UTAMA */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white p-6 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.04)]"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700">
              <Calendar className="h-4 w-4" />
              Administrasi Guru Workspace
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Generator <span className="text-emerald-600">Prota & Promes</span>
            </h1>
          </div>

          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('generator')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'generator' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Buat Prota & Promes
            </button>
            <button
              onClick={() => setActiveTab('tersimpan')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'tersimpan' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dokumen Tersimpan ({savedDocs.length})
            </button>
          </div>
        </div>
      </motion.section>

      {/* TAB GENERATOR */}
      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* KOLOM KIRI: FORMULIR INPUT */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <h3 className="text-[11px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px]">1</span> 
                PARAMETER DOKUMEN PROTA & PROMES
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">NAMA SEKOLAH</label>
                  <input
                    type="text"
                    value={namaSekolah}
                    onChange={(e) => setNamaSekolah(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">KEPALA SEKOLAH</label>
                    <input
                      type="text"
                      value={namaKepalaSekolah}
                      onChange={(e) => setNamaKepalaSekolah(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">NIP KEPSEK</label>
                    <input
                      type="text"
                      value={nipKepalaSekolah}
                      onChange={(e) => setNipKepalaSekolah(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">NAMA GURU</label>
                    <input
                      type="text"
                      value={namaGuru}
                      onChange={(e) => setNamaGuru(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">NIP GURU</label>
                    <input
                      type="text"
                      value={nipGuru}
                      onChange={(e) => setNipGuru(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">MATA PELAJARAN</label>
                  <select
                    value={mataPelajaran}
                    onChange={(e) => setMataPelajaran(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 font-bold outline-none"
                  >
                    {sdSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">KELAS</label>
                    <input
                      type="text"
                      value={kelas}
                      onChange={(e) => setKelas(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">FASE</label>
                    <input
                      type="text"
                      value={fase}
                      onChange={(e) => setFase(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">TAHUN PELAJARAN</label>
                  <input
                    type="text"
                    value={tahunPelajaran}
                    onChange={(e) => setTahunPelajaran(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">KOTA</label>
                    <input
                      type="text"
                      value={kota}
                      onChange={(e) => setKota(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">TANGGAL PEMBUATAN</label>
                    <input
                      type="text"
                      value={tanggalPembuatan}
                      onChange={(e) => setTanggalPembuatan(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 mt-4"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Buat Prota & Promes AI
              </Button>
            </div>
          </div>

          {/* KOLOM KANAN: PREVIEW HASIL */}
          <div className="lg:col-span-8">
            {loading ? (
              <div className="rounded-[30px] border border-dashed border-slate-300 bg-slate-50 p-16 text-center flex flex-col items-center justify-center min-h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
                <p className="text-sm font-bold text-slate-700">{loadingMessage}</p>
              </div>
            ) : generatedDoc ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm space-y-6 relative"
              >
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase">PREVIEW PROTA & PROMES</h2>
                    <p className="text-xs text-slate-500">{generatedDoc.subject} &middot; Kelas {generatedDoc.grade} &middot; TP {generatedDoc.academicYear}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleExportWord(generatedDoc)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-9 px-3 text-xs font-bold">
                      <Download className="w-4 h-4 mr-1.5" /> Word (.doc)
                    </Button>
                    <Button onClick={handleSaveDoc} className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-9 px-3 text-xs font-bold">
                      Simpan
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 text-sm text-slate-800 font-serif leading-relaxed whitespace-pre-wrap">
                  {generatedDoc.konten_ai}
                </div>
              </motion.div>
            ) : (
              <div className="rounded-[30px] border border-dashed border-slate-300 bg-slate-50 p-16 text-center flex flex-col items-center justify-center min-h-[500px]">
                <Calendar className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-800">Dokumen Prota & Promes belum dibuat.</h3>
                <p className="text-xs text-slate-500 mt-1">Lengkapi parameter di sebelah kiri lalu klik "Buat Prota & Promes AI".</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB TERSIMPAN */}
      {activeTab === 'tersimpan' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari dokumen Prota..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Tidak ada dokumen tersimpan</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredDocs.map(docItem => (
                <div key={docItem.id} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {docItem.subject}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleExportWord(docItem)} className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50" title="Download Word"><Download className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteDoc(docItem.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <h3 className="font-black text-slate-900 text-lg">{docItem.title}</h3>
                    <p className="text-xs text-slate-500">Penyusun: {docItem.teacher} | Tahun Ajaran: {docItem.academicYear}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}