import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expressSessions, documents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { callClaudeJsonNoPrefill, SONNET } from "@/lib/ai/claude";
import {
  EXPRESS_ANALYTICAL_PROMPT,
  EXPRESS_NARRATIVE_PROMPT,
  buildExpressPrompt,
  detectContentType,
} from "@/lib/ai/prompts";
import type { CramOutput } from "@/types";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    // Load the express session
    const [session] = await db
      .select()
      .from(expressSessions)
      .where(
        and(
          eq(expressSessions.id, sessionId),
          eq(expressSessions.userId, userId)
        )
      );

    if (!session) {
      return NextResponse.json(
        { error: "Express session not found" },
        { status: 404 }
      );
    }

    // Return cached output if already generated
    if (session.cramOutput) {
      return NextResponse.json({
        cramOutput: session.cramOutput,
        cached: true,
      });
    }

    // Load the document
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

    // Detect content type to pick the right prompt
    const contentType = detectContentType(doc.rawText);
    const systemPrompt =
      contentType === "narrative"
        ? EXPRESS_NARRATIVE_PROMPT
        : EXPRESS_ANALYTICAL_PROMPT;

    // Format deadline for the prompt
    const deadlineStr = session.deadline
      ? new Date(session.deadline).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : undefined;

    const cramOutput = await callClaudeJsonNoPrefill<CramOutput>({
      system: systemPrompt,
      user: buildExpressPrompt(
        doc.rawText,
        session.purpose,
        session.expressPurpose,
        deadlineStr
      ),
      model: SONNET,
      maxTokens: 4096,
    });

    // Save output to session and mark completed
    await db
      .update(expressSessions)
      .set({
        cramOutput,
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(expressSessions.id, sessionId));

    return NextResponse.json({ cramOutput, cached: false });
  } catch (error) {
    console.error("Express generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate cram sheet" },
      { status: 500 }
    );
  }
}
