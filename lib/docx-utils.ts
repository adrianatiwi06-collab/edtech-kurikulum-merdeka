import { Document, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';

export interface QuestionData {
  multipleChoice: Array<{
    questionNumber: number;
    question: string;
    options: { [key: string]: string };
    correctAnswer: string;
    weight: number;
    relatedTP?: string;
    wordCount?: number;
    imageDescription?: string;
  }>;
  essay: Array<{
    questionNumber: number;
    question: string;
    weight: number;
    rubric?: string;
    relatedTP?: string;
    wordCount?: number;
    imageDescription?: string;
  }>;
}

export function generateQuestionDocument(
  data: QuestionData,
  metadata: {
    subject: string;
    examTitle: string;
    duration: number;
    includeTP?: boolean;
  }
): Document {
  const children: any[] = [];

  children.push(
    new Paragraph({
      text: metadata.examTitle,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Mata Pelajaran: ', bold: true }),
        new TextRun(metadata.subject),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Waktu Pengerjaan: ', bold: true }),
        new TextRun(`${metadata.duration} menit`),
      ],
      spacing: { after: 300 },
    })
  );

  if (data.multipleChoice && data.multipleChoice.length > 0) {
    children.push(
      new Paragraph({
        text: 'A. PILIHAN GANDA',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 200 },
      })
    );

    data.multipleChoice.forEach((q) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${q.questionNumber}. `, bold: true }),
            new TextRun(q.question),
          ],
          spacing: { before: 100, after: 100 },
        })
      );

      // FIX: Menambahkan .sort() agar urutan A, B, C, D konsisten
      Object.entries(q.options)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .forEach(([key, value]) => {
          children.push(
            new Paragraph({
              text: `    ${key}. ${value}`,
              spacing: { after: 50 },
            })
          );
        });

      if (metadata.includeTP && q.relatedTP) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '    TP: ', italics: true, size: 18 }),
              new TextRun({ text: q.relatedTP, italics: true, size: 18 }),
            ],
            spacing: { after: 100 },
          })
        );
      }
      children.push(new Paragraph({ text: '' }));
    });
  }

  // ... (Sisa fungsi untuk Essay tetap sama)
  if (data.essay && data.essay.length > 0) {
    children.push(
      new Paragraph({
        text: 'B. SOAL ESSAY/ISIAN',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );
    data.essay.forEach((q) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${q.questionNumber}. `, bold: true }),
            new TextRun(q.question),
          ],
          spacing: { before: 100, after: 100 },
        })
      );
      if (metadata.includeTP && q.relatedTP) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '    TP: ', italics: true, size: 18 }),
              new TextRun({ text: q.relatedTP, italics: true, size: 18 }),
            ],
            spacing: { after: 100 },
          })
        );
      }
      children.push(new Paragraph({ text: '' }));
    });
  }

  return new Document({ sections: [{ children }] });
}

export function generateAnswerKeyDocument(data: QuestionData): Document {
  const children: any[] = [];
  children.push(
    new Paragraph({
      text: 'KUNCI JAWABAN',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  if (data.multipleChoice && data.multipleChoice.length > 0) {
    children.push(new Paragraph({ text: 'Pilihan Ganda:', heading: HeadingLevel.HEADING_2, spacing: { after: 200 } }));
    data.multipleChoice.forEach((q) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${q.questionNumber}. `, bold: true }),
            new TextRun({ text: q.correctAnswer, bold: true, color: '00AA00' }),
          ],
          spacing: { after: 100 },
        })
      );
    });
  }

  return new Document({ sections: [{ children }] });
}