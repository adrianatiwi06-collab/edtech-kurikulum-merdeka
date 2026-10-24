/**
 * Export Prota & Promes ke format DOCX yang proper dan rapi.
 * Menangani Markdown, tabel, heading, list, dan formatting sesuai standar formal.
 */

import {
  Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun,
  AlignmentType, BorderStyle, UnderlineType, VerticalAlign, WidthType,
  HeadingLevel, ShadingType, convertMillimetersToTwip,
} from 'docx';

export interface ProtaPromesData {
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

type Block = Paragraph | Table;

/** Lebar area tulis A4: 210mm - margin kiri 25mm - margin kanan 20mm */
const CONTENT_WIDTH = convertMillimetersToTwip(165);
const FONT = 'Times New Roman';

/* ────────────────────────────────────────────────────────────────────────
   Parsing Markdown → struktur dokumen
──────────────────────────────────────────────────────────────────────── */

interface HeadingNode { type: 'heading'; level: number; content: string }
interface ParagraphNode { type: 'paragraph'; content: string }
interface ListNode { type: 'list'; ordered: boolean; items: string[] }
interface TableNode { type: 'table'; headers: string[]; rows: string[][] }
interface EmptyNode { type: 'empty' }

type DocNode = HeadingNode | ParagraphNode | ListNode | TableNode | EmptyNode;

const LIST_REGEX = /^([*\-+]|\d+\.)\s+(.+)$/;

function parseTableRow(row: string): string[] {
  let r = row.trim();
  if (r.startsWith('|')) r = r.slice(1);
  if (r.endsWith('|')) r = r.slice(0, -1);
  // JANGAN filter sel kosong, supaya posisi kolom tidak bergeser
  return r.split('|').map((c) => c.trim());
}

function isSeparatorRow(row: string): boolean {
  const t = row.trim();
  return /^\|?[\s:|-]+\|?$/.test(t) && t.includes('-');
}

function parseMarkdown(md: string): DocNode[] {
  // Buang pembungkus code fence (```markdown ... ```) yang sering dikirim AI
  const lines = (md || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => !l.trim().startsWith('```'));

  const nodes: DocNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Garis horizontal (---, ***, ___) → abaikan
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      i++;
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      nodes.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] });
      i++;
      continue;
    }

    // Tabel: baris diawali dan diakhiri |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        const headers = parseTableRow(tableLines[0]);
        const start = isSeparatorRow(tableLines[1]) ? 2 : 1;
        const rows: string[][] = [];
        for (let j = start; j < tableLines.length; j++) {
          const cells = parseTableRow(tableLines[j]);
          while (cells.length < headers.length) cells.push('');
          rows.push(cells.slice(0, headers.length));
        }
        nodes.push({ type: 'table', headers, rows });
      } else {
        // Hanya 1 baris → jangan hilang, jadikan paragraf
        nodes.push({ type: 'paragraph', content: tableLines[0].trim() });
      }
      continue;
    }

    // List
    const listMatch = trimmed.match(LIST_REGEX);
    if (listMatch) {
      const ordered = /^\d+\.$/.test(listMatch[1]);
      const items: string[] = [listMatch[2]];
      i++;
      while (i < lines.length) {
        const nextMatch = lines[i].trim().match(LIST_REGEX);
        if (!nextMatch) break;
        const nextOrdered = /^\d+\.$/.test(nextMatch[1]);
        if (nextOrdered !== ordered) break;
        items.push(nextMatch[2]);
        i++;
      }
      nodes.push({ type: 'list', ordered, items });
      continue;
    }

    // Kosong
    if (!trimmed) {
      nodes.push({ type: 'empty' });
      i++;
      continue;
    }

    // Paragraf biasa
    nodes.push({ type: 'paragraph', content: trimmed });
    i++;
  }

  return nodes;
}

/* ────────────────────────────────────────────────────────────────────────
   Inline formatting: **bold**, *italic*, __underline__
──────────────────────────────────────────────────────────────────────── */

interface RunBase { bold?: boolean; size?: number }

function parseInlineMarkdown(text: string, base: RunBase = {}): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ ...base, text: text.slice(lastIndex, match.index) }));
    }

    if (match[1]) {
      runs.push(new TextRun({ ...base, text: match[1], bold: true }));
    } else if (match[2]) {
      runs.push(new TextRun({ ...base, text: match[2], underline: { type: UnderlineType.SINGLE } }));
    } else if (match[3]) {
      runs.push(new TextRun({ ...base, text: match[3], italics: true }));
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ ...base, text: text.slice(lastIndex) }));
  }

  return runs.length ? runs : [new TextRun({ ...base, text })];
}

/* ────────────────────────────────────────────────────────────────────────
   Konversi node ke Paragraph / Table (untuk docx)
──────────────────────────────────────────────────────────────────────── */

interface BuildContext { firstHeadingSeen: boolean }

/** Isi sel tabel; <br> di dalam sel dijadikan paragraf baru */
function cellParagraphs(text: string, opts: { bold?: boolean; center?: boolean }): Paragraph[] {
  return text.split(/<br\s*\/?>/i).map(
    (part) =>
      new Paragraph({
        children: parseInlineMarkdown(part.trim(), { bold: opts.bold, size: 20 }),
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 40, after: 40, line: 240 },
      }),
  );
}

function nodeToBlocks(node: DocNode, ctx: BuildContext): Block[] {
  const blocks: Block[] = [];

  switch (node.type) {
    case 'heading': {
      const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
      const level = Math.min(node.level - 1, 2);
      const sizes = [14, 13, 12];
      // H1 pertama tidak perlu page break (cover sudah memberi halaman baru)
      const needBreak = level === 0 && ctx.firstHeadingSeen;
      if (level === 0) ctx.firstHeadingSeen = true;

      blocks.push(
        new Paragraph({
          heading: levels[level],
          spacing: { before: 200, after: 100, line: 240 },
          pageBreakBefore: needBreak,
          children: [
            new TextRun({
              text: node.content.replace(/\*\*|__/g, ''),
              bold: true,
              size: sizes[level] * 2,
              font: FONT,
              color: '000000',
            }),
          ],
        }),
      );
      break;
    }

    case 'paragraph': {
      blocks.push(
        new Paragraph({
          children: parseInlineMarkdown(node.content),
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 0, after: 120, line: 240 },
          // 1,25 cm = 12,5 mm (sebelumnya 1,25 mm sehingga nyaris tidak terlihat)
          indent: { firstLine: convertMillimetersToTwip(12.5) },
        }),
      );
      break;
    }

    case 'list': {
      node.items.forEach((item, idx) => {
        const runs = parseInlineMarkdown(item);
        if (node.ordered) {
          runs.unshift(new TextRun({ text: `${idx + 1}. ` }));
        }
        blocks.push(
          new Paragraph({
            children: runs,
            bullet: node.ordered ? undefined : { level: 0 },
            spacing: { after: 60, line: 240 },
            indent: {
              left: convertMillimetersToTwip(10),
              hanging: node.ordered ? 0 : convertMillimetersToTwip(5),
            },
          }),
        );
      });
      break;
    }

    case 'table': {
      const colCount = node.headers.length;
      const colWidth = Math.floor(CONTENT_WIDTH / colCount);
      const columnWidths = node.headers.map(() => colWidth);
      const cellWidth = { size: colWidth, type: WidthType.DXA } as const;

      const headerRow = new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: node.headers.map(
          (h) =>
            new TableCell({
              children: cellParagraphs(h, { bold: true, center: true }),
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E8E8E8' },
              verticalAlign: VerticalAlign.CENTER,
              width: cellWidth,
            }),
        ),
      });

      const bodyRows = node.rows.map(
        (row) =>
          new TableRow({
            cantSplit: true,
            children: node.headers.map(
              (_, colIdx) =>
                new TableCell({
                  children: cellParagraphs(row[colIdx] || '', {}),
                  shading:
                    colIdx % 2 === 0
                      ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F9F9F9' }
                      : undefined,
                  verticalAlign: VerticalAlign.TOP,
                  width: cellWidth,
                }),
            ),
          }),
      );

      blocks.push(
        new Table({
          rows: [headerRow, ...bodyRows],
          width: { size: colWidth * colCount, type: WidthType.DXA },
          columnWidths,
        }),
        // Spacer: mencegah tabel menempel/menyatu dengan elemen berikutnya
        new Paragraph({ text: '', spacing: { after: 120 } }),
      );
      break;
    }

    case 'empty':
      // Baris kosong diabaikan; jarak antar elemen sudah diatur lewat spacing
      break;
  }

  return blocks;
}

/* ────────────────────────────────────────────────────────────────────────
   Helper layout
──────────────────────────────────────────────────────────────────────── */

function centered(text: string, size: number, after: number, bold = false): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after },
    children: [new TextRun({ text, bold, size })],
  });
}

function line(text: string, opts: { bold?: boolean; after?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: opts.after ?? 0 },
    children: [new TextRun({ text, bold: opts.bold })],
  });
}

const blank = () => new Paragraph({ text: '' });

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
} as const;

/* ────────────────────────────────────────────────────────────────────────
   Generate dokumen DOCX
──────────────────────────────────────────────────────────────────────── */

function buildDocument(data: ProtaPromesData): Document {
  const nodes = parseMarkdown(data.konten_ai);

  // Cover
  const coverBlocks: Paragraph[] = [
    blank(),
    blank(),
    centered('PROGRAM TAHUNAN & PROGRAM SEMESTER', 28, 200, true),
    centered('Berdasarkan Kalender Pendidikan Prov. Jawa Tengah', 20, 100),
    centered(`${data.subject} | Kelas ${data.grade}`, 20, 100),
    centered(data.school, 20, 100),
    centered(`Tahun Pelajaran ${data.academicYear}`, 20, 400),
  ];

  // Konten
  const ctx: BuildContext = { firstHeadingSeen: false };
  const contentBlocks: Block[] = [];
  for (const node of nodes) {
    contentBlocks.push(...nodeToBlocks(node, ctx));
  }

  // Tanda tangan (2 kolom, baris sejajar)
  const sigLeft: Paragraph[] = [
    line('Mengetahui,', { after: 0 }),
    line(`Kepala ${data.school}`),
    blank(),
    blank(),
    blank(),
    line(data.headmaster, { bold: true, after: 100 }),
    line(`NIP. ${data.headmasterNip}`),
  ];

  const sigRight: Paragraph[] = [
    line(`${data.city}, ${data.date}`, { after: 0 }),
    line('Guru Mata Pelajaran'),
    blank(),
    blank(),
    blank(),
    line(data.teacher, { bold: true, after: 100 }),
    line(`NIP. ${data.teacherNip}`),
  ];

  const half = Math.floor(CONTENT_WIDTH / 2);
  const sigTable = new Table({
    columnWidths: [half, half],
    width: { size: half * 2, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: sigLeft,
            borders: NO_BORDERS,
            width: { size: half, type: WidthType.DXA },
          }),
          new TableCell({
            children: sigRight,
            borders: NO_BORDERS,
            width: { size: half, type: WidthType.DXA },
          }),
        ],
      }),
    ],
  });

  return new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: 24 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
            margin: {
              top: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(25),
              right: convertMillimetersToTwip(20),
            },
          },
        },
        children: [
          ...coverBlocks,
          new Paragraph({ text: '', pageBreakBefore: true }),
          ...contentBlocks,
          // Page break berada DI LUAR tabel (di dalam sel tidak bekerja dengan benar)
          new Paragraph({ text: '', pageBreakBefore: true }),
          sigTable,
          // Word membutuhkan paragraf di akhir dokumen setelah tabel
          new Paragraph({ text: '' }),
        ],
      },
    ],
  });

}

/** Untuk browser / client component: menghasilkan Blob siap unduh. */
export async function exportToDocxBlob(data: ProtaPromesData): Promise<Blob> {
  return await Packer.toBlob(buildDocument(data));
}

/** Untuk server (Node.js, mis. API route): menghasilkan Buffer. */
export async function exportToDocx(data: ProtaPromesData): Promise<Buffer> {
  return await Packer.toBuffer(buildDocument(data));
}