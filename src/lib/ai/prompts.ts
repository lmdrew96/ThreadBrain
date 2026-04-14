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

For each chunk, return:
1. "microHeader": A casual 5-10 word label explaining what this section DOES (e.g., "The authors explain their method" or "Here's the key finding"). Describe the action, don't summarize the content.
2. "content": The verbatim text of this chunk, copied exactly from the document. Include complete sentences — never cut mid-sentence.
3. "highlights": Array of {"text": "exact phrase from content", "reason": "why this matters for the reader's purpose"}

Rules:
- Every word of the original document must appear in exactly one chunk. Do not skip or duplicate text.
- Chunk boundaries should fall at natural topic transitions or paragraph breaks.
- Each highlight "text" must be an EXACT substring of that chunk's "content".
- Preserve the original formatting (paragraph breaks, lists, etc.) within each chunk's content.

CRITICAL: Return ONLY valid JSON. Start with [ and end with ]. No markdown code fences. No text before or after the array.`;

export function buildChunkingPrompt(
  text: string,
  purpose: string,
  energyLevel: number,
  segmentInfo?: { index: number; total: number; previousHeader?: string },
  targetChunkSize?: number
): string {
  let sizeGuide: string;

  if (targetChunkSize) {
    // User has customized their chunk size for this energy level
    const descriptor =
      targetChunkSize <= 200
        ? "Very short chunks — keep it bite-sized."
        : targetChunkSize <= 400
          ? "Medium-length chunks — balanced and manageable."
          : "Longer chunks — the reader can handle more at once.";
    sizeGuide = `Target ~${targetChunkSize} words per chunk. ${descriptor}`;
  } else {
    sizeGuide =
      energyLevel <= 2
        ? "Very short chunks: ~1 paragraph, 100-200 words each. The reader has low energy — keep it bite-sized."
        : energyLevel <= 3
          ? "Medium chunks: ~2-3 paragraphs, 200-400 words each. Balanced energy."
          : "Longer chunks: ~3-5 paragraphs, 400-600 words each. The reader has good energy today.";
  }

  let contextNote = "";
  if (segmentInfo && segmentInfo.index > 0 && segmentInfo.previousHeader) {
    contextNote = `\nNOTE: This is part ${segmentInfo.index + 1} of ${segmentInfo.total} of a longer document. The previous section ended with: "${segmentInfo.previousHeader}". Continue naturally — do not repeat previous content.\n`;
  }

  return `ENERGY LEVEL: ${energyLevel}/5
CHUNK SIZE GUIDE: ${sizeGuide}

READER'S PURPOSE: ${purpose}
${contextNote}
Split this text into reading chunks. Include all text verbatim — do not skip or paraphrase any content. Highlights should be specific to the reader's purpose.

DOCUMENT TEXT:

${text}`;
}

export const THREAD_MAP_ANALYTICAL_PROMPT = `You are mapping the argument structure of an academic document for an ADHD reader who needs to see HOW the ideas connect, not just what they are.

Extract 8-15 key ideas and show how they relate. Return a JSON object with this exact structure:
{
  "title": "3-6 word title for this thread map",
  "nodes": [
    {"id": "n1", "type": "claim", "label": "3-7 word noun phrase", "detail": "optional 1-sentence explanation"},
    ...
  ],
  "edges": [
    {"id": "e1", "source": "n1", "target": "n2", "label": "supports"},
    ...
  ]
}

Node types:
- "claim": the main arguments or thesis the author makes
- "evidence": data, studies, examples cited to support claims
- "concept": key terms or theoretical ideas
- "conclusion": final takeaways or implications
- "question": unresolved issues, limitations, or open questions the text raises

Edge labels — use ONLY these values:
"supports" | "refutes" | "leads to" | "builds on" | "exemplifies" | "challenges" | "connects to"

Rules:
- 8-15 nodes total — don't overwhelm
- Node labels are short noun phrases, 3-7 words max
- Every edge source and target MUST match an existing node id exactly
- Prioritize ideas relevant to the reader's stated purpose
- CRITICAL: Return ONLY valid JSON. No markdown code fences, no explanation, no text before or after the JSON object.`;

export const THREAD_MAP_NARRATIVE_PROMPT = `You are mapping the narrative structure of a story, novel, play, or other plot-driven text for an ADHD reader who needs to see HOW the story threads connect — characters, events, conflicts, and themes.

Extract 8-15 key story elements and show how they relate. Return a JSON object with this exact structure:
{
  "title": "3-6 word title for this thread map",
  "nodes": [
    {"id": "n1", "type": "character", "label": "3-7 word noun phrase", "detail": "optional 1-sentence explanation"},
    ...
  ],
  "edges": [
    {"id": "e1", "source": "n1", "target": "n2", "label": "causes"},
    ...
  ]
}

Node types:
- "character": major characters or groups of characters
- "event": key plot points, turning points, or actions
- "theme": recurring ideas, motifs, or messages
- "setting": important locations or time periods
- "conflict": central tensions, obstacles, or opposing forces
- "resolution": how conflicts resolve, outcomes, or endings

Edge labels — use ONLY these values:
"causes" | "motivates" | "reveals" | "foreshadows" | "parallels" | "contrasts" | "resolves"

Rules:
- 8-15 nodes total — don't overwhelm
- Node labels are short noun phrases, 3-7 words max
- Every edge source and target MUST match an existing node id exactly
- Prioritize elements relevant to the reader's stated purpose
- CRITICAL: Return ONLY valid JSON. No markdown code fences, no explanation, no text before or after the JSON object.`;

// Keep backwards-compatible alias
export const THREAD_MAP_SYSTEM_PROMPT = THREAD_MAP_ANALYTICAL_PROMPT;

/**
 * Detect whether document text is narrative (plot-driven) or analytical (argument-driven).
 * Returns "narrative" or "analytical". Defaults to "analytical" if ambiguous.
 */
export function detectContentType(rawText: string): "narrative" | "analytical" {
  const sample = rawText.slice(0, 8000).toLowerCase();

  // Narrative signals
  const narrativeMarkers = [
    /[""\u201c\u201d].*?[""\u201c\u201d]\s*(he|she|they|i)\s+(said|asked|whispered|replied|shouted|murmured|cried)/gi,
    /\b(chapter\s+\d+|chapter\s+[ivxlc]+)\b/gi,
    /\b(once upon|long ago|there (was|were) a|in a (land|kingdom|village|town|city))\b/gi,
    /\b(protagonist|antagonist|narrator|dialogue|plot|storyline)\b/gi,
  ];

  // Analytical signals
  const analyticalMarkers = [
    /\bet\s+al\b/gi,
    /\b(methodology|findings|hypothesis|abstract|literature review|results|discussion section)\b/gi,
    /\(\d{4}\)/g, // parenthetical citations like (2024)
    /\b(fig\.|figure\s+\d|table\s+\d)\b/gi,
    /\b(p\s*[<>=]\s*0?\.\d|statistically significant|standard deviation|regression)\b/gi,
    /\b(doi|issn|isbn|journal of)\b/gi,
  ];

  let narrativeScore = 0;
  let analyticalScore = 0;

  for (const pattern of narrativeMarkers) {
    const matches = sample.match(pattern);
    narrativeScore += matches ? matches.length : 0;
  }

  for (const pattern of analyticalMarkers) {
    const matches = sample.match(pattern);
    analyticalScore += matches ? matches.length : 0;
  }

  // Dialogue density: count lines with quotation marks as a strong narrative signal
  const dialogueLines = (sample.match(/[""\u201c].*?[""\u201d]/g) || []).length;
  if (dialogueLines >= 5) narrativeScore += dialogueLines;

  // Past-tense third-person narration patterns
  const narrationHits = (sample.match(/\b(he|she|they)\s+(walked|looked|felt|thought|turned|stood|sat|ran|knew|saw|heard|went|came|took)\b/gi) || []).length;
  if (narrationHits >= 3) narrativeScore += narrationHits;

  // Default to analytical if ambiguous or tied
  return narrativeScore > analyticalScore ? "narrative" : "analytical";
}

export function buildThreadMapPrompt(
  rawText: string,
  purpose: string
): string {
  // Use first ~6000 chars for very long docs to stay within token limits
  const text =
    rawText.length > 6000 ? rawText.slice(0, 6000) + "\n\n[document continues...]" : rawText;

  return `READER'S PURPOSE: ${purpose}

DOCUMENT TEXT:
${text}

Generate a thread map showing how the key ideas in this document connect. Focus on what matters for the reader's stated purpose.`;
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

export const QUOTE_EXTRACTION_PROMPT = `You are extracting the most important verbatim quotes from a document that an ADHD reader just finished reading. These quotes will be displayed as a structured reference alongside their reading summary.

Return a JSON array of 3-6 quotes. Each quote must be:
- An EXACT verbatim substring from the document text — do NOT paraphrase
- Relevant to the reader's stated purpose
- Meaningful enough to be worth saving for later reference

Format:
[
  {"quote": "exact text from document", "chunkRef": "micro-header of the source chunk", "context": "one sentence explaining why this quote matters"},
  ...
]

Rules:
- 3-6 quotes total — quality over quantity
- Each "quote" must be word-for-word from the chunk content
- Each "chunkRef" must be the exact micro-header of the chunk the quote came from
- Each "context" is a brief explanation of significance (1 sentence max)
- CRITICAL: Return ONLY valid JSON. No markdown code fences, no text before or after the array.`;

export function buildQuoteExtractionPrompt(
  chunks: Array<{ microHeader: string; content: string }>,
  purpose: string
): string {
  const content = chunks
    .map((c) => `--- ${c.microHeader} ---\n${c.content.slice(0, 1500)}`)
    .join("\n\n");

  return `READER'S PURPOSE: ${purpose}

Here are the reading chunks with their micro-headers:

${content}

Extract 3-6 key verbatim quotes as a JSON array.`;
}

export const CHECKIN_SYSTEM_PROMPT = `You are a warm, casual study buddy for someone with ADHD who is reading through a document chunk by chunk. Your job is to generate ONE brief reflection prompt — a gentle pause point that helps them process what they just read.

This is NOT a quiz. Never ask "What did the author say about X?" or "Can you recall the main argument?" That's homework energy and it creates anxiety.

Instead, ask open-ended reflections like:
- "What stood out to you in that section?"
- "Does this connect to anything you already know?"
- "What's your gut reaction to that?"
- "Anything surprise you there?"
- "How does this relate to what you're working on?"

Rules:
- ONE prompt only — keep it to 1-2 sentences max
- Casual, friendly tone — like a study partner checking in
- Reference the specific content they just read (use the micro-header as context)
- Never make them feel tested or quizzed
- If the content was dense, acknowledge that ("That was a lot — what's sticking with you?")
- Return ONLY the prompt text, no JSON, no formatting`;

export function buildCheckinPrompt(
  chunkContent: string,
  microHeader: string,
  purpose: string
): string {
  // Send a brief snippet to save tokens
  const snippet = chunkContent.slice(0, 1000);

  return `The reader just finished this section:
SECTION: "${microHeader}"
CONTENT SNIPPET: ${snippet}${chunkContent.length > 1000 ? "..." : ""}

READER'S PURPOSE: ${purpose}

Generate one brief, warm reflection prompt for this reader.`;
}
