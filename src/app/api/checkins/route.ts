import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkIns, chunks, readingSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { callClaude } from "@/lib/ai/claude";
import { CHECKIN_SYSTEM_PROMPT, buildCheckinPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { chunkId } = await req.json();
    if (!chunkId) {
      return NextResponse.json({ error: "chunkId required" }, { status: 400 });
    }

    // Idempotency: return existing check-in if one exists for this chunk
    const [existing] = await db
      .select()
      .from(checkIns)
      .where(eq(checkIns.chunkId, chunkId));

    if (existing) {
      return NextResponse.json(existing);
    }

    // Load the chunk
    const [chunk] = await db
      .select()
      .from(chunks)
      .where(eq(chunks.id, chunkId));

    if (!chunk) {
      return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
    }

    // Load the session to get purpose and verify ownership
    const [session] = await db
      .select()
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.id, chunk.sessionId),
          eq(readingSessions.userId, userId)
        )
      );

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Generate a reflection prompt
    const prompt = await callClaude({
      system: CHECKIN_SYSTEM_PROMPT,
      user: buildCheckinPrompt(chunk.content, chunk.microHeader, session.purpose),
      maxTokens: 256,
    });

    const [checkIn] = await db
      .insert(checkIns)
      .values({
        chunkId,
        prompt: prompt.trim(),
      })
      .returning();

    return NextResponse.json(checkIn);
  } catch (error) {
    console.error("Check-in generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate check-in" },
      { status: 500 }
    );
  }
}
