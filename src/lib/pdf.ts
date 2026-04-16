import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

// Disable worker in serverless — runs in same thread, which is fine for text extraction
GlobalWorkerOptions.workerSrc = "";

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

/**
 * Assess text quality by checking for garbled font encoding patterns.
 * Uses two signals:
 * 1. Letter ratio: normal text is mostly letters+digits; garbled text has
 *    excessive punctuation/symbols used as character substitutions.
 * 2. Symbol cluster density: garbled text produces dense clusters of symbols
 *    (e.g., "5+%(&;#") that don't appear in normal prose.
 */
export function assessTextQuality(text: string): "good" | "poor" {
  const nonWhitespace = text.replace(/\s/g, "");
  if (nonWhitespace.length === 0) return "poor";

  // Signal 1: ratio of letters+digits to all non-whitespace
  // Normal English prose is ~85-92% letters+digits. Garbled text drops below 80%.
  const alphanumeric = nonWhitespace.replace(/[^a-zA-Z0-9]/g, "");
  const letterRatio = alphanumeric.length / nonWhitespace.length;

  // Signal 2: density of symbol clusters (3+ consecutive non-letter-digit-space chars)
  // Normal text rarely has these; garbled text has many.
  const symbolClusters = text.match(/[^a-zA-Z0-9\s]{3,}/g) ?? [];
  const clusterDensity = symbolClusters.length / (text.length / 1000); // per 1000 chars

  if (letterRatio < 0.78 || clusterDensity > 5) return "poor";
  return "good";
}

export interface PdfExtractionResult {
  text: string;
  quality: "good" | "poor";
}

export async function extractTextFromPdf(
  buffer: Buffer
): Promise<PdfExtractionResult> {
  const data = new Uint8Array(buffer);
  const doc = await getDocument({
    data,
    // Skip external CMap/font fetches — not needed for basic text extraction
    // and they fail in Vercel serverless (unpkg.com requests timeout)
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const pageTexts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    const pageText = content.items
      .filter((item): item is TextItem => "str" in item)
      .map((item) => (item.hasEOL ? item.str + "\n" : item.str))
      .join("");

    pageTexts.push(pageText);
  }

  const rawText = pageTexts.join("\n\n");
  const text = cleanPdfText(rawText);
  const quality = assessTextQuality(text);

  return { text, quality };
}
