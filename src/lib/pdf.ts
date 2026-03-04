import pdfParse from "pdf-parse";

/**
 * Clean up raw text extracted from PDFs.
 * Handles hyphenated line breaks, column wrapping, and excessive whitespace.
 */
export function cleanPdfText(raw: string): string {
  let text = raw;

  // Rejoin hyphenated words split across lines:
  // "compre-\nhension" → "comprehension"
  // Only when continuation starts lowercase (avoids breaking compound words at line starts)
  text = text.replace(/(\w)-\s*\n\s*([a-z])/g, "$1$2");

  // Collapse 3+ newlines into paragraph breaks
  text = text.replace(/\n{3,}/g, "\n\n");

  // Collapse single mid-sentence newlines into spaces (PDF column wrapping)
  // Only when previous line doesn't end with sentence-ending punctuation
  // and next line starts lowercase
  text = text.replace(/([^\n.!?:;])\n(?!\n)([a-z])/g, "$1 $2");

  // Collapse multiple spaces into single
  text = text.replace(/ {2,}/g, " ");

  // Trim each line
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();

  return text;
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return cleanPdfText(data.text);
}
