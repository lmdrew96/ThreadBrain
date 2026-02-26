import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readingSessions, documents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { callClaude } from "@/lib/ai/claude";
import { MAP_SYSTEM_PROMPT, buildMapPrompt } from "@/lib/ai/prompts";
import { truncateText } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId } = await req.json();

    // Get the session and its document
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

    // If map already generated, return it
    if (session.mapSummary) {
      return NextResponse.json({ map: session.mapSummary });
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

    // Truncate for long documents (~8000 tokens)
    const textForAnalysis = truncateText(doc.rawText, 8000);

    const mapSummary = await callClaude({
      system: MAP_SYSTEM_PROMPT,
      user: buildMapPrompt(textForAnalysis, session.purpose, session.energyLevel),
    });

    // Store the map in the session
    await db
      .update(readingSessions)
      .set({ mapSummary })
      .where(eq(readingSessions.id, sessionId));

    return NextResponse.json({ map: mapSummary });
  } catch (error) {
    console.error("Map generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate document map" },
      { status: 500 }
    );
  }
}
