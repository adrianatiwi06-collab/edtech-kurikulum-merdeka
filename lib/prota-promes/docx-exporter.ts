/**
 * Export Prota & Promes ke format DOCX yang proper dan rapi.
 * Menangani Markdown, tabel, heading, list, dan formatting sesuai standar formal.
 */

import {
  Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, PageBreak,
  AlignmentType, BorderStyle, UnderlineType, VerticalAlign, WidthType, convertInchesToTwip,
  HeadingLevel, convertMillimetersToTwip, TabStopType, TabStopPosition,
} from 'docx';

interface ProtaPromesData {
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

/* ────────────────────────────────────────────────────────────────────────
   Parsing Markdown → struktur dokumen
──────────────────────────────────────────────────────────────────────── */

interface TextNode { type: 'text'; content: string; bold?: boolean; italic?: boolean; underline?: boolean }
interface HeadingNode { type: 'heading'; level: number; content: string }
interface ParagraphNode { type: 'paragraph'; content: string }
interface ListNode { type: 'list'; ordered: boolean; items: string[] }
interface TableNode { type: 'table'; headers: string[]; rows: string[][] }
interface PageBreakNode { type: 'page-break' }
interface EmptyNode { type: 'empty' }

type DocNode = TextNode | HeadingNode | ParagraphNode | ListNode | TableNode | PageBreakNode | EmptyNode;

function parseMarkdown(md: string): DocNode[] {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n');
  const nodes: DocNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      nodes.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] });
      i++;
      continue;
    }

    // Table: dimulai dengan |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (row: string) => row.split('|').filter(c => c.trim() !== '').map(c => c.trim());
        const headers = parseRow(tableLines[0]);
        const rows: string[][] = [];
        for (let j = 2; j < tableLines.length; j++) {
          const cells = parseRow(tableLines[j]);
          // Normalisasi jumlah kolom
          while (cells.length < headers.length) cells.push('');
          rows.push(cells.slice(0, headers.length));
        }
        if (rows.length > 0) {
          nodes.push({ type: 'table', headers, rows });
        }
      }
      continue;
    }

    // List
    const listMatch = trimmed.match(/^([*\-+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]);
      const items: string[] = [listMatch[2]];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        const nextListMatch = nextLine.match(/^([*\-+]|\d+\.)\s+(.+)$/);
        const isOrdered = /\d+\./.test(nextLine.charAt(0));
        if (nextListMatch && isOrdered === ordered && nextLine) {
          items.push(nextListMatch[2]);
          i++;
        } else {
          break;
        }
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

    // Paragraph (teks biasa)
    nodes.push({ type: 'paragraph', content: trimmed });
    i++;
  }

  return nodes;
}

/* ────────────────────────────────────────────────────────────────────────
   Inline formatting: **bold**, *italic*, __underline__
──────────────────────────────────────────────────────────────────────── */

function parseInlineMarkdown(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let remaining = text;
  const regex = /\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: remaining.slice(lastIndex, match.index) }));
    }

    const content = match[1] || match[2] || match[3] || match[4];
    if (match[1]) {
      runs.push(new TextRun({ text: content, bold: true }));
    } else if (match[2] || match[3]) {
      runs.push(new TextRun({ text: content, underline: { type: UnderlineType.SINGLE } }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: content, italic: true }));
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < remaining.length) {
    runs.push(new TextRun({ text: remaining.slice(lastIndex) }));
  }

  return runs.length ? runs : [new TextRun({ text })];
}

/* ────────────────────────────────────────────────────────────────────────
   Konversi node ke Paragraph (untuk docx)
──────────────────────────────────────────────────────────────────────── */

function nodeToParagraph(node: DocNode, index: number, total: number): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  switch (node.type) {
    case 'heading': {
      const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
      const level = Math.min(node.level - 1, 2);
      const sizes = [14, 13, 12];
      paragraphs.push(
        new Paragraph({
          text: node.content,
          heading: levels[level],
          bold: true,
          size: sizes[level] * 2,
          spacing: { before: 200, after: 100, line: 240 },
          pageBreakBefore: level === 0 && index > 0,
        }),
      );
      break;
    }

    case 'paragraph': {
      paragraphs.push(
        new Paragraph({
          children: parseInlineMarkdown(node.content),
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 0, after: 120, line: 240 },
          indent: { firstLine: convertMillimetersToTwip(1.25) },
        }),
      );
      break;
    }

    case 'list': {
      node.items.forEach((item, idx) => {
        paragraphs.push(
          new Paragraph({
            children: parseInlineMarkdown(item),
            bullet: node.ordered ? undefined : { level: 0 },
            numbering: node.ordered ? { level: 0, instance: index } : undefined,
            spacing: { after: 60, line: 240 },
            indent: { left: convertMillimetersToTwip(10) },
          }),
        );
      });
      break;
    }

    case 'table': {
      const headerCells = node.headers.map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ text: h, bold: true, alignment: AlignmentType.CENTER })],
            shading: { fill: 'E8E8E8' },
            verticalAlign: VerticalAlign.CENTER,
            width: { size: 100 / node.headers.length, type: WidthType.PERCENTAGE },
          }),
      );

      const bodyRows = node.rows.map(
        (row) =>
          new TableRow({
            children: node.headers.map((_, colIdx) =>
              new TableCell({
                children: [
                  new Paragraph({
                    text: row[colIdx] || '',
                    spacing: { line: 240 },
                  }),
                ],
                shading: colIdx % 2 === 0 ? { fill: 'F9F9F9' } : undefined,
                verticalAlign: VerticalAlign.TOP,
              }),
            ),
          }),
      );

      paragraphs.push(
        new Table({
          rows: [
            new TableRow({ children: headerCells }),
            ...bodyRows,
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
      );
      break;
    }

    case 'empty': {
      paragraphs.push(new Paragraph({ text: '' }));
      break;
    }
  }

  return paragraphs;
}

/* ────────────────────────────────────────────────────────────────────────
   Generate dokumen DOCX
──────────────────────────────────────────────────────────────────────── */

export async function exportToDocx(data: ProtaPromesData): Promise<Buffer> {
  const nodes = parseMarkdown(data.konten_ai);

  // Cover page
  const coverParagraphs: Paragraph[] = [
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'PROGRAM TAHUNAN & PROGRAM SEMESTER',
      bold: true,
      size: 28,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Berdasarkan Kalender Pendidikan Prov. Jawa Tengah',
      size: 20,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: `${data.subject} | Kelas ${data.grade}`,
      size: 20,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: data.school,
      size: 20,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: `Tahun Pelajaran ${data.academicYear}`,
      size: 20,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  ];

  // Content
  const contentParagraphs: Paragraph[] = [];
  nodes.forEach((node, idx) => {
    const ps = nodeToParagraph(node, idx, nodes.length);
    contentParagraphs.push(...ps);
  });

  // Signature page
  const sigParagraphs: Paragraph[] = [
    new Paragraph({ text: '', pageBreakBefore: true }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Mengetahui,' }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Kepala ${data.school}` }),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({ text: data.headmaster, bold: true }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `NIP. ${data.headmasterNip}` }),
      ],
      spacing: { after: 400 },
    }),
  ];

  const sigRight: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: `${data.city}, ${data.date}` }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Guru Mata Pelajaran' }),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({ text: data.teacher, bold: true }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `NIP. ${data.teacherNip}` }),
      ],
    }),
  ];

  const sigTable = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: sigParagraphs,
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
            width: { size: 50, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: sigRight,
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
            width: { size: 50, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margins: {
              top: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(25),
              right: convertMillimetersToTwip(20),
            },
          },
        },
        children: [
          ...coverParagraphs,
          new Paragraph({ text: '', pageBreakBefore: true }),
          ...contentParagraphs,
          sigTable,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
