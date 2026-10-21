'use client';
import { generateModulAjarAction } from './actions';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, Loader2, CheckCircle2, 
  Trash2, Search, Filter, FileText, Download, Check 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';


/**
 * Mengubah Markdown hasil AI menjadi HTML terstruktur untuk preview dan Word.
 * HTML mentah di-escape terlebih dahulu agar konten AI tidak menyisipkan markup/script.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(value: string): string {
  // Beberapa respons AI menyisipkan <br> di dalam sel tabel Markdown.
  return value.split(/<br\s*\/?\s*>/i).map((part) => {
    let text = escapeHtml(part);
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    text = text.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');
    return text;
  }).join('<br/>');
}
/** Gaya tabel disisipkan inline karena Word mengabaikan sebagian CSS berbasis class. */
const TABLE_STYLE = 'width:100%;border-collapse:collapse;border:1px solid #444444;margin:6pt 0 12pt;';
const TH_STYLE = 'border:1px solid #444444;padding:4pt 6pt;background:#F2DCDB;font-weight:bold;text-align:center;vertical-align:middle;';
const TD_STYLE = 'border:1px solid #444444;padding:4pt 6pt;vertical-align:top;text-align:left;';

/**
 * Membersihkan Markdown AI sebelum diubah ke HTML:
 * - membuang judul/subjudul sebelum heading "## " pertama (diganti halaman sampul),
 * - membuang blok pengesahan/tanda tangan buatan AI (aplikasi menambah tanda tangan sendiri),
 * - membuang garis pemisah "---".
 */
function prepareModulMarkdown(markdown: string): string {
  let lines = (markdown || '').replace(/\r\n?/g, '\n').split('\n');

  const firstH2 = lines.findIndex(l => /^\s*##\s+/.test(l));
  if (firstH2 > 0) lines = lines.slice(firstH2);

  const sigIdx = lines.findIndex((l, i) =>
    i > lines.length - 30 &&
    !l.trim().startsWith('|') &&
    /^\W*(Disahkan|Mengetahui|Kepala\s+(Sekolah|SD))/i.test(l.trim())
  );
  if (sigIdx > 0) lines = lines.slice(0, sigIdx);

  return lines
    .filter(l => !/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(l))
    // buang sisa "---" yang menempel di akhir kalimat (kecuali baris tabel)
    .map(l => (l.trim().startsWith('|') ? l : l.replace(/(\S)\s*-{3,}\s*$/, '$1')))
    .join('\n');
}

function markdownToHtml(markdown: string): string {
  const lines = (markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let paragraph: string[] = [];
  const listStack: { type: 'ul' | 'ol'; indent: number }[] = [];
  let tableRows: string[][] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${paragraph.map(renderInlineMarkdown).join('<br/>')}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    while (listStack.length) output.push(`</${listStack.pop()!.type}>`);
  };
  const splitRow = (line: string) =>
    line.trim().slice(1, -1).split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());

  const flushTable = () => {
    if (!tableRows.length) return;
    const rows = tableRows.filter(row => !row.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s/g, ''))));
    if (rows.length) {
      const header = rows[0];
      const body = rows.slice(1);
      output.push(
        `<table class="md-table" border="1" cellspacing="0" cellpadding="5" style="${TABLE_STYLE}"><thead><tr>` +
        header.map(cell => `<th style="${TH_STYLE}">${renderInlineMarkdown(cell)}</th>`).join('') +
        '</tr></thead><tbody>' +
        body.map(row => '<tr>' + header.map((_, i) =>
          `<td style="${TD_STYLE}">${renderInlineMarkdown(row[i] ?? '')}</td>`
        ).join('') + '</tr>').join('') +
        '</tbody></table>');
    }
    tableRows = [];
  };
  const isTableLine = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (/^```/.test(trimmed)) {
      flushParagraph(); closeList(); flushTable();
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

    if (isTableLine(raw)) {
      flushParagraph(); closeList();
      tableRows.push(splitRow(raw));
      continue;
    } else {
      flushTable();
    }

    if (!trimmed) {
      flushParagraph(); closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = Math.min(heading[1].length, 5);
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^([-*_])(?:\s*\1){2,}\s*$/.test(trimmed)) {
      flushParagraph(); closeList();
      continue;
    }

    // Daftar bertingkat (indentasi) untuk bullet maupun numbering
    const listItem = raw.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      const indent = listItem[1].replace(/\t/g, '    ').length;
      const type: 'ul' | 'ol' = /\d/.test(listItem[2]) ? 'ol' : 'ul';
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
      output.push(`<li>${renderInlineMarkdown(listItem[3])}</li>`);
      continue;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph(); closeList();
      output.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  if (inCodeBlock) output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  flushParagraph();
  closeList();
  flushTable();
  return output.join('\n');
}

interface SavedTP {
  id: string;
  chapter: string;
  tp: string;
  semester: number;
  grade: string;
  subject: string;
}

export default function ModulAjarPage() {
  const { user } = useAuth();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'generator' | 'tersimpan'>('generator');
  
  // State Sumber TP dari Database
  const [savedTPs, setSavedTPs] = useState<SavedTP[]>([]);
  const [selectedTPIds, setSelectedTPIds] = useState<string[]>([]);

  // Form State sesuai Gambar UI
  const [namaSekolah, setNamaSekolah] = useState('SD Negeri Nusawangkal 02');
  const [namaKepalaSekolah, setNamaKepalaSekolah] = useState('..............................');
  const [nipKepalaSekolah, setNipKepalaSekolah] = useState('..............................');
  const [namaGuru, setNamaGuru] = useState('Gara Nuradin, S.Pd.SD.');
  const [nipGuru, setNipGuru] = useState('198207142022211006');
  
  const [mataPelajaran, setMataPelajaran] = useState('Matematika');
  const [kelas, setKelas] = useState('2');
  const [fase, setFase] = useState('A');
  const [semester, setSemester] = useState('1 (Ganjil)');
  const [tahunPelajaran, setTahunPelajaran] = useState('2026/2027');
  const [alokasiWaktu, setAlokasiWaktu] = useState('8 JP (4 kali pertemuan)');
  const [kota, setKota] = useState('Nusawangkal');
  const [tanggalPembuatan, setTanggalPembuatan] = useState('20 Oktober 2026');

  // Detail RPP
  const [materiPokok, setMateriPokok] = useState('Ayo Membilang Sampai Dengan 50');
  const [modelPembelajaran, setModelPembelajaran] = useState('Problem Based Learning');

  // Dimensi Profil Lulusan
  const [dimensi, setDimensi] = useState({
    keimanan: true,
    kewargaan: true,
    penalaranKritis: true,
    kreativitas: true,
    kolaborasi: true,
    kemandirian: true,
    kesehatan: true,
    komunikasi: true
  });

  // Generator & Database Tersimpan
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedModul, setGeneratedModul] = useState<any | null>(null);
  const [savedModules, setSavedModules] = useState<any[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [tabFilterSubject, setTabFilterSubject] = useState('Semua');

  const sdSubjects = [
    'Pendidikan Agama Islam', 'Pendidikan Pancasila', 'Bahasa Indonesia', 'Matematika',
    'Ilmu Pengetahuan Alam', 'IPAS (Ilmu Pengetahuan Alam dan Sosial)', 
    'Pendidikan Jasmani Olahraga dan Kesehatan (PJOK)', 'Seni Rupa', 'Bahasa Inggris', 'Bahasa Daerah'
  ];

  useEffect(() => {
    if (user) {
      loadSourceData();
      loadSavedModules();
    }
  }, [user]);

  const loadSourceData = async () => {
    if (!user) return;
    try {
      const qTP = query(collection(db, 'learning_goals'), where('user_id', '==', user.uid));
      const snapTP = await getDocs(qTP);
      const tps: SavedTP[] = [];
      snapTP.forEach(d => tps.push({ id: d.id, ...d.data() } as SavedTP));
      setSavedTPs(tps);
    } catch (err) {
      console.error('Gagal memuat sumber data TP:', err);
    }
  };

  const loadSavedModules = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'learning_modules'), where('user_id', '==', user.uid));
      const snapshot = await getDocs(q);
      const mods: any[] = [];
      snapshot.forEach(d => mods.push({ id: d.id, ...d.data() }));
      mods.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSavedModules(mods);
    } catch (err) {
      console.error('Gagal memuat Modul Ajar:', err);
    }
  };

  // Filter TP berdasarkan Mata Pelajaran yang dipilih di dropdown form
  const filteredTPs = savedTPs.filter(tp => 
    !mataPelajaran || tp.subject?.toLowerCase().trim() === mataPelajaran.toLowerCase().trim()
  );

  const toggleCheckboxTP = (id: string) => {
    setSelectedTPIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleDimensi = (key: keyof typeof dimensi) => {
    setDimensi(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 1. HANDLE GENERATE DENGAN PROMPT INDUK
  const handleGenerate = async () => {
    if (selectedTPIds.length === 0) {
      toast.error('Pilih/centang minimal satu Tujuan Pembelajaran (TP) terlebih dahulu!');
      return;
    }
    if (!materiPokok.trim()) {
      toast.error('Materi pokok tidak boleh kosong!');
      return;
    }

    setLoading(true);
    setLoadingMessage('AI sedang menyusun Modul Ajar Pembelajaran Mendalam (Deep Learning)...');

    try {
      const selectedTPTexts = filteredTPs
        .filter(tp => selectedTPIds.includes(tp.id))
        .map(tp => `- ${tp.tp}`)
        .join('\n');

      const selectedDimensiList = Object.entries(dimensi)
        .filter(([_, value]) => value)
        .map(([key, _]) => key)
        .join(', ');

      // PROMPT INDUK PEMBUATAN MODUL AJAR PEMBELAJARAN MENDALAM (DEEP LEARNING)
      const aiPrompt = `
Bertindaklah sebagai ahli pengembangan kurikulum pendidikan Indonesia, perancang pembelajaran, praktisi Pembelajaran Mendalam (Deep Learning), ahli asesmen pendidikan, dan penyusun perangkat ajar profesional.

Tugasmu adalah menyusun **Modul Ajar/Rencana Pembelajaran Mendalam yang lengkap, akurat, kontekstual, berdiferensiasi, sesuai regulasi yang berlaku pada tahun 2026, dan siap digunakan guru dalam pembelajaran nyata**.

Gunakan data berikut sebagai dasar penyusunan modul:
- Nama satuan pendidikan: ${namaSekolah}
- Nama guru/penyusun: ${namaGuru}
- NIP/NUPTK: ${nipGuru || '[PERLU DIISI GURU]'}
- Jenjang pendidikan: SD
- Mata pelajaran: ${mataPelajaran}
- Fase: ${fase}
- Kelas: ${kelas}
- Semester: ${semester}
- Tahun pelajaran: ${tahunPelajaran}
- Materi pokok/bab: ${materiPokok}
- Alokasi waktu: ${alokasiWaktu}
- Model Pembelajaran: ${modelPembelajaran}
- Tujuan Pembelajaran (TP): 
${selectedTPTexts}
- Dimensi Profil Lulusan: ${selectedDimensiList}

ATURAN FORMAT (WAJIB, karena hasilnya langsung diekspor ke dokumen Word):
- JANGAN menulis judul dokumen, subjudul, nama sekolah/tahun di bagian atas, dan JANGAN menulis blok pengesahan/tanda tangan di akhir. Aplikasi menambahkannya sendiri. Mulai langsung dari "## INFORMASI UMUM".
- Gunakan HANYA heading: "## " untuk bagian utama (huruf kapital), "### " untuk sub-bagian bernomor huruf (A., B., ...), dan "#### " untuk sub-sub-bagian.
- Sajikan isi dalam TABEL Markdown (baris pemisah |---|---|), setiap baris tabel harus ditulis dalam SATU baris teks dengan jumlah kolom sama dengan header. Jangan menulis karakter "|" di dalam isi sel. Untuk baris baru di dalam sel gunakan <br>.
- Dilarang memakai blok kode (tanda backtick tiga kali), diagram ASCII/panah, emoji, garis pemisah "---", dan HTML selain <br>.
- Gunakan **tebal** seperlunya. Daftar memakai "- " atau "1. ". Jangan membuat bullet satu per satu terpisah jika sebenarnya satu kelompok.
- Gunakan bahasa Indonesia baku, konkret, dan siap pakai di kelas. Hindari kalimat pembuka/penutup basa-basi.

STRUKTUR MODUL (ikuti urutan dan nama bagian persis seperti berikut):

## INFORMASI UMUM
### A. Identitas Modul
Tabel 2 kolom (Komponen | Keterangan) berisi baris: Nama Penyusun, Satuan Pendidikan, Tahun Ajaran, Mata Pelajaran, Kelas / Fase, Bab / Topik Spesifik, Alokasi Waktu, Model Pembelajaran, Acuan Regulasi (sebutkan regulasi dan CP yang benar-benar berlaku; tulis "[PERLU DIVERIFIKASI GURU]" bila tidak yakin).
### B. Identifikasi Murid (Kompetensi Awal)
Tabel 2 kolom (Kategori | Deskripsi): Pengetahuan Awal, Minat, Kebutuhan Belajar, serta Kesiapan (kelompok kesiapan rendah/sedang/tinggi dan strategi masing-masing; jangan mengarang jumlah siswa).
### C. Karakteristik Materi dan Sarana Prasarana
Tabel 2 kolom (Komponen | Deskripsi): Konsep Kunci, Kaitan dengan Kehidupan Sehari-hari, Sarana dan Prasarana, Media dan Alat Peraga.
### D. Dimensi Profil Lulusan
Tabel 2 kolom (Dimensi | Elemen yang Dikembangkan) hanya untuk dimensi yang dipilih, dengan penjelasan konkret pada kegiatan bab ini.

## E. DESAIN PEMBELAJARAN
Tabel 2 kolom (Komponen | Deskripsi): Capaian Pembelajaran, Tujuan Pembelajaran Bab Ini (daftar bernomor, kalimat operasional), Lintas Disiplin Ilmu, Praktik Pedagogis (Pendekatan Deep Learning, model, masalah/topik utama, prinsip Berkesadaran-Bermakna-Menggembirakan), Pemanfaatan Digital, Kemitraan Pembelajaran, Lingkungan Pembelajaran.

## F. PENGALAMAN BELAJAR (RINCIAN PER PERTEMUAN)
Untuk SETIAP pertemuan sesuai alokasi waktu, tulis "### Pertemuan N: <judul pertemuan>" lalu satu tabel 2 kolom (Tahapan | Deskripsi Kegiatan (Berpusat pada Siswa)) dengan tepat tiga baris: "Kegiatan Awal (X Menit)", "Kegiatan Inti (X Menit)", "Kegiatan Penutup (X Menit)". Isi sel menguraikan langkah guru dan siswa secara runtut memakai <br> antarlangkah, memuat sintaks model pembelajaran, aktivitas konkret, pertanyaan pemantik, dan unsur Mindful/Meaningful/Joyful.

## G. ASESMEN
### Matriks Keterlacakan CP - TP - Asesmen
Tabel (Tujuan Pembelajaran | Indikator | Bentuk Asesmen | Pertemuan).
### Asesmen Diagnostik (Awal Bab)
Uraian singkat dan contoh pertanyaan.
### Asesmen Formatif (Selama Proses)
#### 1. Lembar Kerja Peserta Didik (LKPD)
LKPD lengkap siap cetak (identitas "Nama: ....", petunjuk, soal/tugas bernomor, ruang jawaban berupa titik-titik).
#### 2. Kisi-kisi dan Kunci Jawaban
Tabel kisi-kisi (No | Tujuan Pembelajaran | Indikator | Bentuk Soal | No. Soal) dan kunci jawaban untuk semua soal LKPD.
#### 3. Rubrik Penilaian Asesmen Formatif
Tabel rubrik (Kriteria Penilaian | Skor 1 (Kurang) | Skor 2 (Cukup) | Skor 3 (Baik)), total skor maksimal, dan keterangan tindak lanjut berdasarkan rentang skor.
### Asesmen Sumatif (Akhir Bab)
Proyek atau tes akhir beserta kriteria penilaiannya.

## H. PENGAYAAN DAN REMEDIAL
Daftar: Pengayaan, Remedial, dan Dukungan Inklusif/Diferensiasi.

## I. REFLEKSI PENDIDIK DAN PESERTA DIDIK
### Refleksi Peserta Didik
Daftar pertanyaan refleksi sederhana sesuai usia.
### Refleksi Pendidik
Daftar pertanyaan refleksi.

## J. BAHAN BACAAN, GLOSARIUM, DAN DAFTAR PUSTAKA
Bahan bacaan/media, glosarium (istilah: pengertian), dan daftar pustaka. Jangan menambahkan tabel daftar periksa kualitas atau blok tanda tangan.
      `;

      const result = await generateModulAjarAction(aiPrompt);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Server AI tidak memberikan respons.');
      }

      const modulData = {
        title: `Modul Ajar ${mataPelajaran} - ${materiPokok}`,
        school: namaSekolah,
        headmaster: namaKepalaSekolah,
        headmasterNip: nipKepalaSekolah,
        teacher: namaGuru,
        teacherNip: nipGuru,
        subject: mataPelajaran,
        grade: kelas,
        fase: fase,
        semester: semester,
        academicYear: tahunPelajaran,
        alokasi: alokasiWaktu,
        city: kota,
        date: tanggalPembuatan,
        materi: materiPokok,
        model: modelPembelajaran,
        tujuan: selectedTPTexts,
        dimensi: dimensi,
        konten_ai: result.data, // Menyimpan teks utuh hasil Prompt Induk AI
        created_at: new Date().toISOString()
      };

      setGeneratedModul(modulData);
      toast.success('Modul Ajar Deep Learning berhasil dibuat!');
    } catch (err: any) {
      toast.error('Gagal generate: ' + err.message);
      console.error("AI Generation Error:", err);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSaveModule = async () => {
    if (!user || !generatedModul) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'learning_modules'), {
        user_id: user.uid,
        ...generatedModul
      });
      toast.success('Modul Ajar berhasil disimpan!');
      loadSavedModules();
      setActiveTab('tersimpan');
    } catch (err: any) {
      toast.error('Gagal menyimpan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. EXPORT WORD: render Markdown secara utuh (heading, tabel, daftar, bold, dll.)
  const handleExportWord = (modul: any) => {
    if (!modul || !modul.konten_ai) {
      toast.error('Konten modul kosong.');
      return;
    }

    const dynamicHtmlBody = markdownToHtml(prepareModulMarkdown(modul.konten_ai));
    const safe = (value: unknown) => escapeHtml(String(value ?? ''));
    const htmlContent = `
      <!DOCTYPE html>
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8"/>
        <meta name="ProgId" content="Word.Document"/>
        <meta name="Generator" content="Modul Ajar Generator"/>
        <title>${safe(modul.title)}</title>
        <style>
          @page { size: A4; margin: 2cm 2cm 2cm 2.5cm; }
          body { font-family: "Times New Roman", serif; font-size: 11pt; line-height: 1.3; color: #111; }
          h1 { font-size: 16pt; text-align: center; margin: 14pt 0 8pt; page-break-after: avoid; }
          h2 { font-size: 12pt; font-weight: bold; margin: 18pt 0 8pt; padding: 4pt 6pt; background: #9B1C1C; color: #FFFFFF; page-break-after: avoid; }
          h3 { font-size: 11.5pt; font-weight: bold; margin: 12pt 0 5pt; page-break-after: avoid; }
          h4 { font-size: 11pt; font-weight: bold; margin: 10pt 0 4pt; page-break-after: avoid; }
          h5 { font-size: 11pt; font-weight: bold; font-style: italic; margin: 8pt 0 4pt; page-break-after: avoid; }
          p { margin: 0 0 6pt; text-align: left; }
          ul, ol { margin: 3pt 0 8pt; padding-left: 22pt; }
          li { margin: 0 0 3pt; text-align: left; }
          td p, th p { margin: 0 0 3pt; }
          tr { page-break-inside: avoid; }
          blockquote { margin: 8pt 18pt; padding-left: 10pt; border-left: 2px solid #888; color: #333; }
          pre { white-space: pre-wrap; font-family: "Courier New", monospace; font-size: 9pt; }
          code { font-family: "Courier New", monospace; font-size: 9pt; }
          .cover-title { text-align: center; font-size: 16pt; font-weight: bold; margin: 6pt 0 4pt; }
          .cover-subtitle { text-align: center; font-size: 11.5pt; font-weight: bold; margin: 0 0 4pt; }
          .cover-meta { text-align: center; font-size: 10.5pt; margin: 0 0 14pt; }
          .signature { width: 100%; border-collapse: collapse; margin-top: 30pt; page-break-inside: avoid; }
          .signature td { width: 50%; border: none; text-align: center; vertical-align: top; padding: 5pt; }
          .signature-space { height: 55pt; }
        </style>
      </head>
      <body>
        <p class="cover-title">MODUL AJAR ${safe(String(modul.subject || '').toUpperCase())}</p>
        <p class="cover-subtitle">Bab: ${safe(modul.materi)}</p>
        <p class="cover-meta">Kelas ${safe(modul.grade)} / Fase ${safe(modul.fase)} &nbsp;|&nbsp; ${safe(modul.school)} &nbsp;|&nbsp; Tahun Pelajaran ${safe(modul.academicYear)}</p>
        ${dynamicHtmlBody}
        <table class="signature">
          <tr>
            <td>Mengetahui,<br/>Kepala Sekolah<div class="signature-space"></div><strong>${safe(modul.headmaster)}</strong><br/>NIP. ${safe(modul.headmasterNip)}</td>
            <td>${safe(modul.city)}, ${safe(modul.date)}<br/>Guru Mata Pelajaran<div class="signature-space"></div><strong>${safe(modul.teacher)}</strong><br/>NIP. ${safe(modul.teacherNip)}</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(modul.title || 'Modul_Ajar').replace(/[^\w\-]+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Dokumen Word berhasil diunduh dengan format heading, daftar, dan tabel.');
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm('Hapus Modul Ajar ini?')) return;
    try {
      await deleteDoc(doc(db, 'learning_modules', id));
      setSavedModules(savedModules.filter(m => m.id !== id));
      toast.success('Berhasil dihapus');
    } catch (err) {
      toast.error('Gagal menghapus');
    }
  };

  const filteredModules = savedModules.filter(mod => {
    const matchKey = mod.title?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                     mod.subject?.toLowerCase().includes(searchKeyword.toLowerCase());
    const matchSub = tabFilterSubject === 'Semua' || mod.subject === tabFilterSubject;
    return matchKey && matchSub;
  });

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
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700">
              <FileText className="h-4 w-4" />
              Generator Modul Ajar Workspace
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Generator <span className="text-indigo-600">Modul Ajar Deep Learning</span>
            </h1>
          </div>

          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('generator')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'generator' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Buat RPP
            </button>
            <button
              onClick={() => setActiveTab('tersimpan')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'tersimpan' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Modul Tersimpan ({savedModules.length})
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
              
              {/* 1. INFORMASI UMUM */}
              <div>
                <h3 className="text-[11px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">1</span> 
                  INFORMASI UMUM
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">JENIS KURIKULUM</label>
                    <button className="w-full py-2.5 px-3 rounded-lg text-xs font-bold border border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm">
                      Kurikulum Merdeka (Deep Learning)
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">NAMA SEKOLAH</label>
                    <input
                      type="text"
                      value={namaSekolah}
                      onChange={(e) => setNamaSekolah(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">NAMA KEPALA SEKOLAH</label>
                      <input
                        type="text"
                        value={namaKepalaSekolah}
                        onChange={(e) => setNamaKepalaSekolah(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">NIP KEPALA SEKOLAH</label>
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
                      onChange={(e) => {
                        setMataPelajaran(e.target.value);
                        setSelectedTPIds([]); 
                      }}
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">SEMESTER</label>
                      <input
                        type="text"
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                      />
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
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">ALOKASI WAKTU</label>
                    <input
                      type="text"
                      value={alokasiWaktu}
                      onChange={(e) => setAlokasiWaktu(e.target.value)}
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
              </div>

              {/* 2. DETAIL RPP */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-[11px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">2</span> 
                  DETAIL RPP
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">MATERI POKOK</label>
                    <input
                      type="text"
                      value={materiPokok}
                      onChange={(e) => setMateriPokok(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">MODEL PEMBELAJARAN</label>
                    <select
                      value={modelPembelajaran}
                      onChange={(e) => setModelPembelajaran(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
                    >
                      <option value="Problem Based Learning">Problem Based Learning</option>
                      <option value="Project Based Learning">Project Based Learning</option>
                      <option value="Discovery Learning">Discovery Learning</option>
                    </select>
                  </div>

                  {/* KONEKSI TP TERSIMPAN */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-bold text-slate-700">PILIH TUJUAN PEMBELAJARAN (TP) DARI BANK DATA</label>
                      <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">{filteredTPs.length} TP Tersedia</span>
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                      {filteredTPs.length === 0 ? (
                        <p className="text-[10px] text-red-500 italic">Belum ada TP tersimpan untuk mapel {mataPelajaran}.</p>
                      ) : (
                        filteredTPs.map(tp => (
                          <label key={tp.id} className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedTPIds.includes(tp.id)}
                              onChange={() => toggleCheckboxTP(tp.id)}
                              className="mt-0.5 text-indigo-600 rounded"
                            />
                            <span className="text-[11px] text-slate-700 leading-tight">
                              <b>{tp.chapter}</b>: {tp.tp}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* DIMENSI PROFIL LULUSAN */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-2">DIMENSI PROFIL LULUSAN</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { key: 'keimanan', label: 'Keimanan & Ketakwaan' },
                        { key: 'kewargaan', label: 'Kewargaan' },
                        { key: 'penalaranKritis', label: 'Penalaran Kritis' },
                        { key: 'kreativitas', label: 'Kreativitas' },
                        { key: 'kolaborasi', label: 'Kolaborasi' },
                        { key: 'kemandirian', label: 'Kemandirian' },
                        { key: 'kesehatan', label: 'Kesehatan' },
                        { key: 'komunikasi', label: 'Komunikasi' },
                      ].map(item => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleDimensi(item.key as any)}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border text-left transition-all ${
                            dimensi[item.key as keyof typeof dimensi]
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-200 bg-white text-slate-500'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 mt-4"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Buat Modul Ajar Deep Learning
              </Button>

            </div>
          </div>

          {/* KOLOM KANAN: PREVIEW HASIL */}
          <div className="lg:col-span-8">
            {loading ? (
              <div className="rounded-[30px] border border-dashed border-slate-300 bg-slate-50 p-16 text-center flex flex-col items-center justify-center min-h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                <p className="text-sm font-bold text-slate-700">{loadingMessage}</p>
              </div>
            ) : generatedModul ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm space-y-6 relative"
              >
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase">PREVIEW MODUL AJAR (DEEP LEARNING)</h2>
                    <p className="text-xs text-slate-500">{generatedModul.subject} &middot; Kelas {generatedModul.grade} &middot; {generatedModul.materi}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleExportWord(generatedModul)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-9 px-3 text-xs font-bold">
                      <Download className="w-4 h-4 mr-1.5" /> Word (.doc)
                    </Button>
                    <Button onClick={handleSaveModule} className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-9 px-3 text-xs font-bold">
                      Simpan
                    </Button>
                  </div>
                </div>

                <div
                  className="modul-ajar-preview text-sm text-slate-800 font-serif leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(generatedModul.konten_ai) }}
                />
                <style jsx>{`
                  .modul-ajar-preview :global(h2) { font-size: 1.15rem; font-weight: 800; margin: 1.5rem 0 .6rem; padding-bottom: .35rem; border-bottom: 1px solid #e2e8f0; }
                  .modul-ajar-preview :global(h3) { font-size: 1.02rem; font-weight: 800; margin: 1.15rem 0 .5rem; }
                  .modul-ajar-preview :global(h4), .modul-ajar-preview :global(h5) { font-weight: 700; margin: .9rem 0 .4rem; }
                  .modul-ajar-preview :global(p) { margin: .45rem 0 .8rem; text-align: justify; }
                  .modul-ajar-preview :global(ul), .modul-ajar-preview :global(ol) { margin: .4rem 0 .9rem; padding-left: 1.5rem; }
                  .modul-ajar-preview :global(ul) { list-style: disc; }
                  .modul-ajar-preview :global(ol) { list-style: decimal; }
                  .modul-ajar-preview :global(li) { margin: .25rem 0; padding-left: .15rem; }
                  .modul-ajar-preview :global(.md-table) { width: 100%; border-collapse: collapse; margin: .8rem 0 1.2rem; font-family: Arial, sans-serif; font-size: .78rem; }
                  .modul-ajar-preview :global(.md-table th), .modul-ajar-preview :global(.md-table td) { border: 1px solid #cbd5e1; padding: .5rem; vertical-align: top; }
                  .modul-ajar-preview :global(.md-table th) { background: #eef2ff; font-weight: 800; }
                  .modul-ajar-preview :global(blockquote) { border-left: 3px solid #a5b4fc; padding-left: .8rem; margin: .8rem 0; color: #475569; }
                  .modul-ajar-preview :global(pre) { white-space: pre-wrap; background: #f8fafc; padding: .75rem; border-radius: .5rem; }
                  .modul-ajar-preview :global(hr) { margin: 1rem 0; border-color: #e2e8f0; }
                `}</style>
              </motion.div>
            ) : (
              <div className="rounded-[30px] border border-dashed border-slate-300 bg-slate-50 p-16 text-center flex flex-col items-center justify-center min-h-[500px]">
                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-800">RPP belum dibuat.</h3>
                <p className="text-xs text-slate-500 mt-1">Isi formulir di sebelah kiri, centang TP, dan klik "Buat Modul Ajar Deep Learning".</p>
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
                placeholder="Cari judul materi pokok..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              />
            </div>
          </div>

          {filteredModules.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Tidak ada Modul Ajar tersimpan</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredModules.map(mod => (
                <div key={mod.id} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                        {mod.subject}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleExportWord(mod)} className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50" title="Download Word"><Download className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteModule(mod.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <h3 className="font-black text-slate-900 text-lg">{mod.materi}</h3>
                    <p className="text-xs text-slate-500">Penyusun: {mod.teacher} | Model: {mod.model}</p>
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