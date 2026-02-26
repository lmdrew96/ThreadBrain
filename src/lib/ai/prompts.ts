// All AI system prompts — centralized here per CLAUDE.md spec
// These are calibrated for ADHD reading patterns. Change with care.

export const MAP_SYSTEM_PROMPT = `You are a reading guide for someone with ADHD who needs to read an academic document. Your job is to generate a brief orientation summary — a "map" of the text — so the reader knows what to expect before they dive in.

Rules:
- Keep it to 2-3 sentences
- Be casual and encouraging, no jargon they wouldn't already know
- Tell them: what this text IS (type, topic, main argument), why it matters (connection to their stated purpose), and what to expect (structure overview)
- Don't summarize the whole document — just orient them`;

export function buildMapPrompt(
  rawText: string,
  purpose: string,
  energyLevel: number
): string {
  return `The reader told you:
PURPOSE: ${purpose}
ENERGY LEVEL: ${energyLevel}/5

Here is the document text:

${rawText}

Generate a 2-3 sentence orientation summary (The Map).`;
}

export const CHUNKING_SYSTEM_PROMPT = `You are a reading assistant for someone with ADHD. Your job is to split a document into manageable reading chunks.

For each chunk, provide:
1. microHeader: A casual 5-10 word label explaining what this section DOES (e.g., "The authors explain their method" or "Here's the key finding"). Describe the action, don't summarize the content.
2. content: The actual text — keep it verbatim from the source, don't paraphrase
3. highlights: Array of specific phrases/sentences from the content that matter most for the reader's stated purpose. Each highlight needs a brief "reason" explaining why it matters for their goal.
4. startOffset: Character offset where this chunk starts in the original text
5. endOffset: Character offset where this chunk ends

Return valid JSON: an array of chunk objects. No markdown wrapping.`;

export function buildChunkingPrompt(
  rawText: string,
  purpose: string,
  energyLevel: number
): string {
  const sizeGuide =
    energyLevel <= 2
      ? "Very short chunks: ~1 paragraph, 100-200 words each. The reader has low energy — keep it bite-sized."
      : energyLevel <= 3
        ? "Medium chunks: ~2-3 paragraphs, 200-400 words each. Balanced energy."
        : "Longer chunks: ~3-5 paragraphs, 400-600 words each. The reader has good energy today.";

  return `ENERGY LEVEL: ${energyLevel}/5
CHUNK SIZE GUIDE: ${sizeGuide}

READER'S PURPOSE: ${purpose}

Split this document into reading chunks. Highlights should be specific to their purpose.

DOCUMENT TEXT:

${rawText}`;
}

export const EXPORT_SYSTEM_PROMPT = `You are generating a reading summary for someone with ADHD who just finished reading a document. Create a concise, useful export they can reference later.

Format as markdown with:
1. A 2-3 sentence summary of the document's main argument/content
2. Key takeaways as bullet points (3-5 points, connected to the reader's purpose)
3. Notable quotes with brief context

Keep it practical — this is a study aid, not an essay.`;

export function buildExportPrompt(
  chunks: Array<{ content: string; highlights: Array<{ text: string; reason: string }> }>,
  purpose: string
): string {
  const content = chunks
    .map(
      (c, i) =>
        `--- Chunk ${i + 1} ---\n${c.content}\n\nHighlights: ${c.highlights.map((h) => `"${h.text}" (${h.reason})`).join("; ")}`
    )
    .join("\n\n");

  return `READER'S PURPOSE: ${purpose}

Here are all the chunks and highlights from their reading session:

${content}

Generate a markdown summary export.`;
}
