import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, readingSessions, chunks, expressSessions } from "@/lib/db/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { extractTextFromPdf } from "@/lib/pdf";
import { uploadToR2 } from "@/lib/r2";
import { wordCount } from "@/lib/utils";

// GET: List all user documents with latest session info
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch user's documents
  const userDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt));

  // Fetch all sessions for these documents
  const userSessions = await db
    .select()
    .from(readingSessions)
    .where(eq(readingSessions.userId, userId))
    .orderBy(desc(readingSessions.startedAt));

  // Get chunk counts for all sessions
  const chunkCounts = await db
    .select({
      sessionId: chunks.sessionId,
      total: count(),
    })
    .from(chunks)
    .groupBy(chunks.sessionId);

  const chunkCountMap = new Map(
    chunkCounts.map((c) => [c.sessionId, Number(c.total)])
  );

  // Group sessions by document, take latest
  const sessionsByDoc = new Map<
    string,
    (typeof userSessions)[0] & { totalChunks: number }
  >();
  for (const session of userSessions) {
    if (!sessionsByDoc.has(session.documentId)) {
      sessionsByDoc.set(session.documentId, {
        ...session,
        totalChunks: chunkCountMap.get(session.id) ?? 0,
      });
    }
  }

  // Fetch express sessions for these documents
  const userExpressSessions = await db
    .select()
    .from(expressSessions)
    .where(eq(expressSessions.userId, userId))
    .orderBy(desc(expressSessions.createdAt));

  // Group express sessions by document — count per doc
  const expressCountByDoc = new Map<string, number>();
  for (const es of userExpressSessions) {
    expressCountByDoc.set(es.documentId, (expressCountByDoc.get(es.documentId) ?? 0) + 1);
  }

  const result = userDocs.map((doc) => ({
    ...doc,
    latestSession: sessionsByDoc.get(doc.id) ?? null,
    expressCount: expressCountByDoc.get(doc.id) ?? 0,
  }));

  return NextResponse.json(result);
}

// POST: Create a new document from PDF upload or text paste
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  try {
    let title: string;
    let rawText: string;
    let sourceType: "pdf" | "paste";
    let fileKey: string | undefined;
    let quality: "good" | "poor" = "good";

    if (contentType.includes("multipart/form-data")) {
      // PDF upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file || !file.name.endsWith(".pdf")) {
        return NextResponse.json(
          { error: "Please upload a PDF file" },
          { status: 400 }
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File too large. Max 10 MB." },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const { text: extractedText, quality: pdfQuality } = await extractTextFromPdf(buffer);
      quality = pdfQuality;
      rawText = extractedText;
      title = file.name.replace(/\.pdf$/i, "");
      sourceType = "pdf";

      // Upload original PDF to R2 (non-blocking — don't fail if R2 isn't configured)
      if (process.env.R2_ACCESS_KEY_ID) {
        try {
          const key = `${userId}/${Date.now()}-${file.name}`;
          fileKey = await uploadToR2(key, buffer, "application/pdf");
        } catch (err) {
          console.error("R2 upload failed (non-critical):", err);
        }
      }
    } else {
      // Text paste
      const body = await req.json();
      rawText = body.text;
      title = body.title || "Untitled Document";
      sourceType = "paste";
    }

    if (!rawText || !rawText.trim()) {
      return NextResponse.json(
        { error: "No text could be extracted" },
        { status: 400 }
      );
    }

    const words = wordCount(rawText);
    const estimatedTokens = Math.round(words * 1.33);
    const MAX_TOKENS = 150_000;

    if (estimatedTokens > MAX_TOKENS) {
      return NextResponse.json(
        {
          error: `Document is too long (~${words.toLocaleString()} words, ~${estimatedTokens.toLocaleString()} tokens). Max ~${Math.round(MAX_TOKENS / 1.33).toLocaleString()} words to stay within AI context limits.`,
        },
        { status: 400 }
      );
    }

    const [doc] = await db
      .insert(documents)
      .values({
        userId,
        title,
        sourceType,
        rawText,
        fileKey,
        wordCount: wordCount(rawText),
      })
      .returning();

    return NextResponse.json({
      documentId: doc.id,
      title: doc.title,
      wordCount: doc.wordCount,
      ...(quality === "poor" && {
        warning:
          "Some text in this PDF may not have extracted correctly. If the reading looks garbled, try pasting the text directly instead.",
      }),
    });
  } catch (error) {
    console.error("Document creation failed:", error);
    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}
