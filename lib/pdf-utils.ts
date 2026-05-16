import pdfParse from 'pdf-parse';

/**
 * Extract text from PDF buffer with page limit for safety
 * @param buffer - PDF file as Buffer
 * @param maxPages - Maximum pages to extract (default: 50)
 */
export async function extractTextFromPDF(buffer: Buffer, maxPages: number = 50): Promise<string> {
  try {
    // First, parse to get page count
    const data = await pdfParse(buffer, {
      max: maxPages // Limit pages to extract
    });
    
    const totalPages = data.numpages;
    console.log(`[PDF Extract] Total pages: ${totalPages}, extracted: ${Math.min(totalPages, maxPages)}`);
    
    let text = data.text;
    
    // Add warning if pages were skipped
    if (totalPages > maxPages) {
      text += `\n\n[CATATAN: ${totalPages - maxPages} halaman tersisa tidak di-extract untuk efisiensi. Total halaman buku: ${totalPages}. Upload per bab untuk hasil lebih lengkap.]`;
      console.log(`[PDF Extract] Skipped ${totalPages - maxPages} pages for efficiency`);
    }
    
    return text;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
}

/**
 * Validate and sanitize text input
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
