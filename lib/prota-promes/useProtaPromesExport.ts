'use client';

import { exportToDocxBlob } from './docx-exporter';
import type { ProtaPromesData } from './docx-exporter';

/* ────────────────────────────────────────────────────────────────────────
   Helper umum
──────────────────────────────────────────────────────────────────────── */

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape dulu, baru ubah markdown inline → HTML (urutan ini penting agar aman). */
function inlineToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>');
}

function safeFileName(title: string): string {
  const name = (title || '')
    .trim()
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return name || 'Prota_Promes';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Ditunda agar unduhan tidak dibatalkan di sebagian browser
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ────────────────────────────────────────────────────────────────────────
   Hook
──────────────────────────────────────────────────────────────────────── */

/**
 * Hook untuk export Prota & Promes ke DOCX (Word) atau HTML.
 * Gunakan DOCX untuk hasil profesional.
 */
export function useProtaPromesExport() {
  const exportAsDocx = async (data: ProtaPromesData) => {
    try {
      // Di browser gunakan Blob langsung (bukan Buffer, yang khusus Node.js)
      const blob = await exportToDocxBlob(data);
      downloadBlob(blob, `${safeFileName(data.title)}.docx`);
      return { success: true };
    } catch (error) {
      console.error('Export DOCX error:', error);
      return { success: false, error: String(error) };
    }
  };

  const exportAsHtmlDoc = (data: ProtaPromesData) => {
    /**
     * Export sebagai HTML yang dibungkus untuk dibuka di Word.
     * Fallback jika docx library tidak tersedia.
     */
    const style = `
      @page { size: A4; margin: 2cm; }
      body { font-family: "Calibri", sans-serif; font-size: 11pt; line-height: 1.5; color: #222; }
      .cover-page { text-align: center; page-break-after: always; margin: 6cm 0; }
      .cover-title { font-size: 18pt; font-weight: bold; margin: 1cm 0; }
      .cover-meta { font-size: 12pt; margin: 0.5cm 0; }
      h1 { font-size: 13pt; font-weight: bold; margin: 1.2cm 0 0.3cm; page-break-after: avoid; }
      h2 { font-size: 12pt; font-weight: bold; margin: 1.2cm 0 0.3cm; padding: 0.2cm 0.4cm; background: #E8E8E8; border-left: 3pt solid #0b3d33; page-break-after: avoid; }
      h3 { font-size: 11pt; font-weight: bold; margin: 0.8cm 0 0.2cm; page-break-after: avoid; }
      p { margin: 0 0 0.3cm; text-align: justify; line-height: 1.5; }
      ul, ol { margin: 0.3cm 0; padding-left: 1.5cm; }
      li { margin: 0.1cm 0; }
      table { width: 100%; border-collapse: collapse; margin: 0.5cm 0; }
      tr { page-break-inside: avoid; }
      th { background: #E8E8E8; border: 1pt solid #999; padding: 0.3cm; font-weight: bold; text-align: center; }
      td { border: 1pt solid #999; padding: 0.3cm; vertical-align: top; line-height: 1.4; }
      .sig-table { width: 100%; border: none; margin-top: 2cm; }
      .sig-table td.sig-cell { border: none; text-align: center; padding: 0.3cm; width: 50%; }
      .sig-space { height: 2cm; }
    `;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(data.title)}</title>
  <style>${style}</style>
</head>
<body>
  <div class="cover-page">
    <p class="cover-title">PROGRAM TAHUNAN &amp; PROGRAM SEMESTER</p>
    <p class="cover-meta">Berdasarkan Kalender Pendidikan Prov. Jawa Tengah</p>
    <p class="cover-meta"><b>${escapeHtml(data.subject)}</b> | Kelas <b>${escapeHtml(data.grade)}</b></p>
    <p class="cover-meta">${escapeHtml(data.school)}</p>
    <p class="cover-meta">Tahun Pelajaran <b>${escapeHtml(data.academicYear)}</b></p>
  </div>
  ${convertMarkdownToHtml(data.konten_ai)}
  <table class="sig-table">
    <tr>
      <td class="sig-cell">
        <p>Mengetahui,</p>
        <p>Kepala ${escapeHtml(data.school)}</p>
        <div class="sig-space"></div>
        <p><b>${escapeHtml(data.headmaster)}</b></p>
        <p>NIP. ${escapeHtml(data.headmasterNip)}</p>
      </td>
      <td class="sig-cell">
        <p>${escapeHtml(data.city)}, ${escapeHtml(data.date)}</p>
        <p>Guru Mata Pelajaran</p>
        <div class="sig-space"></div>
        <p><b>${escapeHtml(data.teacher)}</b></p>
        <p>NIP. ${escapeHtml(data.teacherNip)}</p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    downloadBlob(blob, `${safeFileName(data.title)}.doc`);
  };

  return { exportAsDocx, exportAsHtmlDoc };
}

/* ────────────────────────────────────────────────────────────────────────
   Markdown → HTML
──────────────────────────────────────────────────────────────────────── */

const LIST_REGEX = /^([*\-+]|\d+\.)\s+(.+)$/;

function parseTableRow(row: string): string[] {
  let r = row.trim();
  if (r.startsWith('|')) r = r.slice(1);
  if (r.endsWith('|')) r = r.slice(0, -1);
  // Sel kosong dipertahankan agar kolom tidak bergeser
  return r.split('|').map((c) => c.trim());
}

/**
 * Konversi Markdown ke HTML yang lebih rapi.
 */
function convertMarkdownToHtml(markdown: string): string {
  const lines = (markdown || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => !l.trim().startsWith('```')); // buang pembungkus code fence dari AI

  const html: string[] = [];
  let tableBuffer: string[] = [];
  let i = 0;

  const flushTable = () => {
    if (tableBuffer.length === 0) return;

    const rows = tableBuffer
      .map(parseTableRow)
      .filter((r) => r.length > 0 && !r.every((c) => /^:?-{2,}:?$/.test(c)));

    if (rows.length >= 1) {
      const [headers, ...body] = rows;
      html.push('<table>');
      html.push('<thead><tr>' + headers.map((h) => `<th>${inlineToHtml(h)}</th>`).join('') + '</tr></thead>');
      html.push('<tbody>');
      body.forEach((row) => {
        const cells = headers.map((_, colIdx) => row[colIdx] ?? '');
        html.push('<tr>' + cells.map((c) => `<td>${inlineToHtml(c)}</td>`).join('') + '</tr>');
      });
      html.push('</tbody></table>');
    }
    tableBuffer = [];
  };

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Tabel
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      tableBuffer.push(trimmed);
      i++;
      continue;
    }

    // Baris non-tabel → tutup tabel yang sedang dikumpulkan
    if (tableBuffer.length > 0) {
      flushTable();
    }

    // Garis horizontal → abaikan
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      i++;
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3);
      html.push(`<h${level}>${inlineToHtml(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // List
    const listMatch = trimmed.match(LIST_REGEX);
    if (listMatch) {
      const ordered = /^\d+\.$/.test(listMatch[1]);
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>`);
      html.push(`<li>${inlineToHtml(listMatch[2])}</li>`);
      i++;
      while (i < lines.length) {
        const nextMatch = lines[i].trim().match(LIST_REGEX);
        if (!nextMatch) break;
        // Jenis list berbeda (bullet vs nomor) → mulai list baru
        if (/^\d+\.$/.test(nextMatch[1]) !== ordered) break;
        html.push(`<li>${inlineToHtml(nextMatch[2])}</li>`);
        i++;
      }
      html.push(`</${tag}>`);
      continue;
    }

    // Baris kosong → dilewati (jarak diatur lewat CSS margin)
    if (!trimmed) {
      i++;
      continue;
    }

    // Paragraf
    html.push(`<p>${inlineToHtml(trimmed)}</p>`);
    i++;
  }

  flushTable();
  return html.join('\n');
}