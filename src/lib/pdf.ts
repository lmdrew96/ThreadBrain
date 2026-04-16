import pdfParse from "pdf-parse";

/**
 * Clean up raw text extracted from PDFs.
 * Handles hyphenated line breaks, column wrapping, and excessive whitespace.
 */
export function cleanPdfText(raw: string): string {
  let text = raw;

  // Rejoin hyphenated words split across lines
  text = text.replace(/(\w)-\s*\n\s*([a-z])/g, "$1$2");

  // Collapse 3+ newlines into paragraph breaks
  text = text.replace(/\n{3,}/g, "\n\n");

  // Collapse single mid-sentence newlines into spaces (PDF column wrapping)
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
 */
export function assessTextQuality(text: string): "good" | "poor" {
  const nonWhitespace = text.replace(/\s/g, "");
  if (nonWhitespace.length === 0) return "poor";

  const alphanumeric = nonWhitespace.replace(/[^a-zA-Z0-9]/g, "");
  const letterRatio = alphanumeric.length / nonWhitespace.length;

  const symbolClusters = text.match(/[^a-zA-Z0-9\s]{3,}/g) ?? [];
  const clusterDensity = symbolClusters.length / (text.length / 1000);

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
  const result = await pdfParse(buffer);
  const text = cleanPdfText(result.text);
  const quality = assessTextQuality(text);

  return { text, quality };
}
