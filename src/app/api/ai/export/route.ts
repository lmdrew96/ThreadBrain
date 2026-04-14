import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  readingSessions,
  chunks,
  exports as exportsTable,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { callClaude, callClaudeJson } from "@/lib/ai/claude";
import {
  EXPORT_SYSTEM_PROMPT,
  buildExportPrompt,
  QUOTE_EXTRACTION_PROMPT,
  buildQuoteExtractionPrompt,
} from "@/lib/ai/prompts";
import type { KeyQuote } from "@/types";

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

    // Check for existing export
    const [existing] = await db
      .select()
      .from(exportsTable)
      .where(eq(exportsTable.sessionId, sessionId));

    if (existing) {
      return NextResponse.json(existing);
    }

    // Get all chunks for the session
    const sessionChunks = await db
      .select()
      .from(chunks)
      .where(eq(chunks.sessionId, sessionId))
      .orderBy(asc(chunks.chunkIndex));

    if (sessionChunks.length === 0) {
      return NextResponse.json(
        { error: "No chunks found for this session" },
        { status: 400 }
      );
    }

    const [summaryMd, keyQuotes] = await Promise.all([
      callClaude({
        system: EXPORT_SYSTEM_PROMPT,
        user: buildExportPrompt(
          sessionChunks.map((c) => ({
            content: c.content,
            highlights: c.highlights,
          })),
          session.purpose
        ),
      }),
      callClaudeJson<KeyQuote[]>({
        system: QUOTE_EXTRACTION_PROMPT,
        user: buildQuoteExtractionPrompt(
          sessionChunks.map((c) => ({
            microHeader: c.microHeader,
            content: c.content,
          })),
          session.purpose
        ),
        maxTokens: 2048,
      }).catch((err) => {
        console.error("Quote extraction failed (non-blocking):", err);
        return [] as KeyQuote[];
      }),
    ]);

    const [exportRecord] = await db
      .insert(exportsTable)
      .values({
        sessionId,
        summaryMd,
        keyQuotes,
      })
      .returning();

    return NextResponse.json(exportRecord);
  } catch (error) {
    console.error("Export generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}
