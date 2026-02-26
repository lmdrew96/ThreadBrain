import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  readingSessions,
  chunks,
  exports as exportsTable,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { callClaude } from "@/lib/ai/claude";
import { EXPORT_SYSTEM_PROMPT, buildExportPrompt } from "@/lib/ai/prompts";

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

    const response = await callClaude({
      system: EXPORT_SYSTEM_PROMPT,
      user: buildExportPrompt(
        sessionChunks.map((c) => ({
          content: c.content,
          highlights: c.highlights,
        })),
        session.purpose
      ),
    });

    const [exportRecord] = await db
      .insert(exportsTable)
      .values({
        sessionId,
        summaryMd: response,
        keyQuotes: [],
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
