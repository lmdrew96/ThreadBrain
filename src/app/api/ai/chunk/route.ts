import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readingSessions, documents, chunks } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { streamClaudeJsonArray } from "@/lib/ai/claude";
import {
  CHUNKING_SYSTEM_PROMPT,
  buildChunkingPrompt,
} from "@/lib/ai/prompts";

interface AIChunk {
  microHeader: string;
  content: string;
  highlights: Array<{ text?: string; phrase?: string; reason: string }>;
}

/** Split document into segments at paragraph boundaries for batch processing. */
function splitIntoSegments(text: string): string[] {
  const SEGMENT_MAX_WORDS = 3000;
  const words = text.split(/\s+/);

  if (words.length <= SEGMENT_MAX_WORDS) {
    return [text];
  }

  const paragraphs = text.split(/\n\n+/);
  const segments: string[] = [];
  let currentSegment = "";
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length;

    if (currentWordCount + paraWords > SEGMENT_MAX_WORDS && currentSegment) {
      segments.push(currentSegment.trim());
      currentSegment = para;
      currentWordCount = paraWords;
    } else {
      currentSegment += (currentSegment ? "\n\n" : "") + para;
      currentWordCount += paraWords;
    }
  }

  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  return segments;
}


/** Normalize highlight objects — handle both text/phrase field names. */
function normalizeHighlights(
  highlights: Array<{ text?: string; phrase?: string; reason: string }> | undefined
): Array<{ text: string; reason: string }> {
  return (highlights || [])
    .map((h) => ({
      text: h.text || h.phrase || "",
      reason: h.reason || "",
    }))
    .filter((h) => h.text.length > 0 && h.reason.length > 0);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId, targetChunkSize } = await req.json();

    // Load session
    const [session] = await db
      .select()
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.id, sessionId),
          eq(readingSessions.userId, userId)
        )
      );

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Idempotency: return cached chunks as regular JSON
    const existingChunks = await db
      .select()
      .from(chunks)
      .where(eq(chunks.sessionId, sessionId))
      .orderBy(asc(chunks.chunkIndex));

    if (existingChunks.length > 0) {
      return NextResponse.json({ chunks: existingChunks });
    }

    // Load document
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, session.documentId));

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Split into segments for batch processing
    const segments = splitIntoSegments(doc.rawText);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let globalChunkIndex = 0;
        let previousHeader: string | undefined;

        try {
          for (let segIdx = 0; segIdx < segments.length; segIdx++) {
            const segmentText = segments[segIdx];

            const prompt = buildChunkingPrompt(
              segmentText,
              session.purpose,
              session.energyLevel,
              segments.length > 1
                ? { index: segIdx, total: segments.length, previousHeader }
                : undefined,
              targetChunkSize
            );

            // Stream from Claude — each chunk object is emitted as soon as it's complete
            await streamClaudeJsonArray(
              {
                system: CHUNKING_SYSTEM_PROMPT,
                user: prompt,
                prefill: "[",
                maxTokens: 8192,
              },
              async (obj) => {
                const aiChunk = obj as AIChunk;
                if (!aiChunk.microHeader || !aiChunk.content) return;

                const [inserted] = await db
                  .insert(chunks)
                  .values({
                    sessionId,
                    documentId: session.documentId,
                    chunkIndex: globalChunkIndex,
                    microHeader: aiChunk.microHeader,
                    content: aiChunk.content,
                    highlights: normalizeHighlights(aiChunk.highlights),
                  })
                  .returning();

                // Stream chunk to frontend immediately
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ type: "chunk", chunk: inserted }) + "\n"
                  )
                );

                previousHeader = aiChunk.microHeader;
                globalChunkIndex++;
              }
            );
          }

          // Signal completion
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "done", totalChunks: globalChunkIndex }) + "\n"
            )
          );
        } catch (error) {
          console.error("[AI] Chunking stream error:", error);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                message: "Failed to generate chunks. Please try again.",
              }) + "\n"
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Chunking failed:", error);
    return NextResponse.json(
      { error: "Failed to generate chunks" },
      { status: 500 }
    );
  }
}
