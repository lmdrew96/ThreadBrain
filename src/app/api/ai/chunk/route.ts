import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readingSessions, documents, chunks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { callClaude } from "@/lib/ai/claude";
import {
  CHUNKING_SYSTEM_PROMPT,
  buildChunkingPrompt,
} from "@/lib/ai/prompts";
import type { ChunkData } from "@/types";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId } = await req.json();

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

    // Check if chunks already exist for this session
    const existingChunks = await db
      .select()
      .from(chunks)
      .where(eq(chunks.sessionId, sessionId));

    if (existingChunks.length > 0) {
      return NextResponse.json({ chunks: existingChunks });
    }

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

    const response = await callClaude({
      system: CHUNKING_SYSTEM_PROMPT,
      user: buildChunkingPrompt(
        doc.rawText,
        session.purpose,
        session.energyLevel
      ),
      maxTokens: 8192,
    });

    // Parse the AI response as JSON
    let chunkData: ChunkData[];
    try {
      // Strip potential markdown code fences
      const cleaned = response.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
      chunkData = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse chunk response:", response);
      return NextResponse.json(
        { error: "AI returned invalid chunk format" },
        { status: 500 }
      );
    }

    // Insert all chunks sequentially (neon-http doesn't support transactions)
    const insertedChunks = [];
    for (let i = 0; i < chunkData.length; i++) {
      const chunk = chunkData[i];
      const [inserted] = await db
        .insert(chunks)
        .values({
          sessionId,
          documentId: session.documentId,
          chunkIndex: i,
          microHeader: chunk.microHeader,
          content: chunk.content,
          highlights: chunk.highlights || [],
          startOffset: chunk.startOffset ?? 0,
          endOffset: chunk.endOffset ?? 0,
        })
        .returning();
      insertedChunks.push(inserted);
    }

    return NextResponse.json({ chunks: insertedChunks });
  } catch (error) {
    console.error("Chunking failed:", error);
    return NextResponse.json(
      { error: "Failed to generate chunks" },
      { status: 500 }
    );
  }
}
