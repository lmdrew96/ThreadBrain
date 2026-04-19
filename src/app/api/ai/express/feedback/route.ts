import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expressSessions, documents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { callClaude, HAIKU } from "@/lib/ai/claude";
import {
  QUIZ_FEEDBACK_PROMPT,
  buildQuizFeedbackPrompt,
} from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId, prompt, userAnswer } = await req.json();

    if (!sessionId || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Missing sessionId or prompt" },
        { status: 400 }
      );
    }

    const answerText = typeof userAnswer === "string" ? userAnswer : "";

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

    if (!session.cramOutput) {
      return NextResponse.json(
        { error: "Cram sheet not yet generated for this session" },
        { status: 400 }
      );
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

    const feedback = await callClaude({
      system: QUIZ_FEEDBACK_PROMPT,
      user: buildQuizFeedbackPrompt(
        prompt,
        answerText,
        session.cramOutput,
        doc.rawText
      ),
      model: HAIKU,
      maxTokens: 512,
    });

    return NextResponse.json({ feedback: feedback.trim() });
  } catch (error) {
    console.error("Quiz feedback generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate feedback" },
      { status: 500 }
    );
  }
}
