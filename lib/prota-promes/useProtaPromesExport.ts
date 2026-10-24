'use client';

import { exportToDocx } from './docx-exporter';
import type { ProtaPromesData } from './types';

interface ExportProtaPromesData {
  title: string;
  school: string;
  headmaster: string;
  headmasterNip: string;
  teacher: string;
  teacherNip: string;
  subject: string;
  grade: string;
  fase: string;
  academicYear: string;
  city: string;
  date: string;
  konten_ai: string;
}

/**
 * Hook untuk export Prota & Promes ke DOCX (Word) atau HTML.
 * Gunakan DOCX untuk hasil profesional.
 */
export function useProtaPromesExport() {
  const exportAsDocx = async (data: ExportProtaPromesData) => {
    try {
      const buffer = await exportToDocx(data);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.title.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      console.error('Export DOCX error:', error);
      return { success: false, error: String(error) };
    }
  };

  const exportAsHtmlDoc = (data: ExportProtaPromesData) => {
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
      h2 { font-size: 12pt; font-weight: bold; margin: 1.2cm 0 0.3cm; padding: 0.2cm 0.4cm; background: #E8E8E8; border-left: 3pt solid #0b3d33; page-break-after: avoid; }
      h3 { font-size: 11pt; font-weight: bold; margin: 0.8cm 0 0.2cm; page-break-after: avoid; }
      p { margin: 0 0 0.3cm; text-align: justify; line-height: 1.5; }
      ul, ol { margin: 0.3cm 0; padding-left: 1.5cm; }
      li { margin: 0.1cm 0; }
      table { width: 100%; border-collapse: collapse; margin: 0.5cm 0; page-break-inside: avoid; }
      th { background: #E8E8E8; border: 1pt solid #999; padding: 0.3cm; font-weight: bold; text-align: center; }
      td { border: 1pt solid #999; padding: 0.3cm; vertical-align: top; line-height: 1.4; }
      .sig-table { width: 100%; border: none; margin-top: 2cm; }
      .sig-cell { border: none; text-align: center; padding: 0.3cm; width: 50%; }
      .sig-space { height: 2cm; }
    `;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${data.title}</title>
  <style>${style}</style>
</head>
<body>
  <div class="cover-page">
    <p class="cover-title">PROGRAM TAHUNAN &amp; PROGRAM SEMESTER</p>
    <p class="cover-meta">Berdasarkan Kalender Pendidikan Prov. Jawa Tengah</p>
    <p class="cover-meta"><b>${data.subject}</b> | Kelas <b>${data.grade}</b></p>
    <p class="cover-meta">${data.school}</p>
    <p class="cover-meta">Tahun Pelajaran <b>${data.academicYear}</b></p>
  </div>
  ${convertMarkdownToHtml(data.konten_ai)}
  <table class="sig-table">
    <tr>
      <td class="sig-cell">
        <p>Mengetahui,</p>
        <p>Kepala ${data.school}</p>
        <div class="sig-space"></div>
        <p><b>${data.headmaster}</b></p>
        <p>NIP. ${data.headmasterNip}</p>
      </td>
      <td class="sig-cell">
        <p>${data.city}, ${data.date}</p>
        <p>Guru Mata Pelajaran</p>
        <div class="sig-space"></div>
        <p><b>${data.teacher}</b></p>
        <p>NIP. ${data.teacherNip}</p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return { exportAsDocx, exportAsHtmlDoc };
}

/**
 * Konversi Markdown ke HTML yang lebih rapi.
 */
function convertMarkdownToHtml(markdown: string): string {
  const lines = (markdown || '').split('\n');
  const html: string[] = [];
  let tableBuffer: string[] = [];
  let i = 0;

  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    const rows = tableBuffer
      .map(r => r.split('|').filter(c => c.trim() !== '').map(c => c.trim()))
      .filter(r => r.length > 0 && !r.every(c => /^:?-{2,}:?$/.test(c)));

    if (rows.length > 1) {
      const [headers, ...body] = rows;
      html.push('<table>');
      html.push('<thead><tr>' + headers.map(h => `<th>${escapeHtml(h)}</th>`).join('') + '</tr></thead>');
      html.push('<tbody>');
      body.forEach(row => {
        const cells = headers.map((_, i) => row[i] ?? '');
        html.push('<tr>' + cells.map(c => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>');
      });
      html.push('</tbody></table>');
    }
    tableBuffer = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      tableBuffer.push(trimmed);
      i++;
      continue;
    }

    // Flush table jika ada
    if (tableBuffer.length > 0 && !trimmed.startsWith('|')) {
      flushTable();
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3);
      html.push(`<h${level}>${escapeHtml(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // List
    const listMatch = trimmed.match(/^([*\-+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]);
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>`);
      html.push(`<li>${escapeHtml(listMatch[2])}</li>`);
      i++;
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        const nextMatch = nextLine.match(/^([*\-+]|\d+\.)\s+(.+)$/);
        if (nextMatch) {
          html.push(`<li>${escapeHtml(nextMatch[2])}</li>`);
          i++;
        } else {
          break;
        }
      }
      html.push(`</${tag}>`);
      continue;
    }

    // Kosong
    if (!trimmed) {
      html.push('<p></p>');
      i++;
      continue;
    }

    // Paragraph
    let text = trimmed;
    text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    text = text.replace(/\*(.+?)\*/g, '<i>$1</i>');
    text = text.replace(/__(.+?)__/g, '<u>$1</u>');
    html.push(`<p>${text}</p>`);
    i++;
  }

  flushTable();
  return html.join('\n');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
