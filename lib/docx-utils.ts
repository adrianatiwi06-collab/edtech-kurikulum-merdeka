import { Document, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';

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

/**
 * Generate Word document from question data
 */
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

  // Header
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

  // Multiple Choice Questions
  if (data.multipleChoice && data.multipleChoice.length > 0) {
    children.push(
      new Paragraph({
        text: 'A. PILIHAN GANDA',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 200 },
      })
    );

    data.multipleChoice.forEach((q) => {
      // Question
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${q.questionNumber}. `, bold: true }),
            new TextRun(q.question),
          ],
          spacing: { before: 100, after: 100 },
        })
      );

      // Image Description Box (if available)
      if (q.imageDescription && q.imageDescription.trim() !== '') {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '    [TEMPAT GAMBAR/ILUSTRASI]', bold: true, color: '666666' }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '    Deskripsi: ', italics: true, size: 18, color: '666666' }),
              new TextRun({ text: q.imageDescription, italics: true, size: 18, color: '666666' }),
            ],
            spacing: { after: 100 },
          })
        );
      }

      // Options
      Object.entries(q.options).forEach(([key, value]) => {
        children.push(
          new Paragraph({
            text: `    ${key}. ${value}`,
            spacing: { after: 50 },
          })
        );
      });

      // Related TP (if enabled)
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

      children.push(new Paragraph({ text: '' })); // Spacer
    });
  }

  // Essay Questions
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

      // Image Description Box (if available)
      if (q.imageDescription && q.imageDescription.trim() !== '') {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '    [TEMPAT GAMBAR/ILUSTRASI]', bold: true, color: '666666' }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '    Deskripsi: ', italics: true, size: 18, color: '666666' }),
              new TextRun({ text: q.imageDescription, italics: true, size: 18, color: '666666' }),
            ],
            spacing: { after: 100 },
          })
        );
      }

      // Related TP (if enabled)
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

      children.push(new Paragraph({ text: '' })); // Spacer
    });
  }

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}

/**
 * Generate answer key document
 */
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

  // Multiple Choice Answer Key
  if (data.multipleChoice && data.multipleChoice.length > 0) {
    children.push(
      new Paragraph({
        text: 'Pilihan Ganda:',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      })
    );

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

  // Essay Rubric
  if (data.essay && data.essay.length > 0) {
    children.push(
      new Paragraph({
        text: 'Rubrik Essay:',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );

    data.essay.forEach((q) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${q.questionNumber}. `, bold: true }),
          ],
          spacing: { before: 100, after: 50 },
        }),
        new Paragraph({
          text: q.rubric || 'Tidak ada rubrik',
          spacing: { after: 200 },
        })
      );
    });
  }

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}
