import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { readingSessions, documents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { THREAD_MAP_SYSTEM_PROMPT, buildThreadMapPrompt } from "@/lib/ai/prompts";
import type { ThreadMap } from "@/types";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  // Fetch session + document
  const [session] = await db
    .select()
    .from(readingSessions)
    .where(
      and(eq(readingSessions.id, sessionId), eq(readingSessions.userId, userId))
    );

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Return cached thread map if it exists
  if (session.threadMap) {
    return NextResponse.json({ threadMap: session.threadMap });
  }

  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, session.documentId));

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const start = Date.now();

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: THREAD_MAP_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildThreadMapPrompt(document.rawText, session.purpose),
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text : "";

    console.log(
      `Thread map generated in ${Date.now() - start}ms, ${response.usage.input_tokens}→${response.usage.output_tokens} tokens`
    );

    // Strip markdown code fences if the model wrapped the JSON anyway
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let threadMap: ThreadMap;
    try {
      threadMap = JSON.parse(text);
    } catch {
      console.error("Thread map JSON parse failed:", text.slice(0, 300));
      return NextResponse.json(
        { error: "Failed to parse thread map from AI response" },
        { status: 500 }
      );
    }

    // Validate minimal structure
    if (!threadMap.nodes?.length || !Array.isArray(threadMap.edges)) {
      return NextResponse.json(
        { error: "Thread map response was malformed" },
        { status: 500 }
      );
    }

    // Cache on session
    await db
      .update(readingSessions)
      .set({ threadMap })
      .where(eq(readingSessions.id, sessionId));

    return NextResponse.json({ threadMap });
  } catch (err) {
    console.error("Thread map generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate thread map" },
      { status: 500 }
    );
  }
}
