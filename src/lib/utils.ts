import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function truncateText(text: string, maxTokens: number): string {
  // Rough approximation: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[Document truncated for analysis]";
}

/**
 * For orientation tasks: send the beginning + end of long documents
 * so the AI sees the full arc, not just the first section.
 */
export function truncateWithEnding(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;

  // 70% from the start, 30% from the end
  const headChars = Math.floor(maxChars * 0.7);
  const tailChars = Math.floor(maxChars * 0.3);

  return (
    text.slice(0, headChars) +
    "\n\n[... middle of document omitted for length ...]\n\n" +
    text.slice(-tailChars)
  );
}
