import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readingSessions, documents, chunks } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getUserJournalConfig } from "@/lib/journal";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch per-user Research Journal config (decrypted)
  const config = await getUserJournalConfig(userId);
  if (!config) {
    return NextResponse.json(
      { error: "Connect Research Journal in Settings first" },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { sessionId, excerpts: providedExcerpts } = body as {
    sessionId: string;
    excerpts?: Array<{ quote: string; comment: string }>;
  };

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  // Verify session ownership
  const [session] = await db
    .select()
    .from(readingSessions)
    .where(
      and(eq(readingSessions.id, sessionId), eq(readingSessions.userId, userId))
    );

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Fetch document for source metadata
  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, session.documentId));

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Determine excerpts to save
  let excerpts: Array<{ quote: string; comment: string }>;

  if (providedExcerpts && Array.isArray(providedExcerpts) && providedExcerpts.length > 0) {
    excerpts = providedExcerpts;
  } else {
    // Harvest all highlights from all session chunks
    const sessionChunks = await db
      .select()
      .from(chunks)
      .where(eq(chunks.sessionId, sessionId))
      .orderBy(asc(chunks.chunkIndex));

    excerpts = sessionChunks.flatMap((c) =>
      c.highlights.map((h) => ({ quote: h.text, comment: h.reason }))
    );
  }

  if (excerpts.length === 0) {
    return NextResponse.json({ error: "No excerpts to save" }, { status: 400 });
  }

  // Forward each excerpt to Research Journal
  const results = await Promise.allSettled(
    excerpts.map((e) =>
      fetch(`${config.rjUrl}/api/excerpts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.rjApiKey}`,
        },
        body: JSON.stringify({
          quote: e.quote,
          comment: e.comment,
          articleTitle: document.title,
          articleUrl: document.sourceUrl ?? undefined,
          source: "threadbrain" as const,
        }),
      })
    )
  );

  const saved = results.filter(
    (r) => r.status === "fulfilled" && r.value.ok
  ).length;
  const failed = results.length - saved;

  console.log(
    `Journal save: ${saved}/${results.length} excerpts for session ${sessionId}`
  );

  if (saved === 0) {
    return NextResponse.json(
      { error: "All saves failed — check your Research Journal connection in Settings" },
      { status: 502 }
    );
  }

  return NextResponse.json({ saved, failed, total: results.length });
}
