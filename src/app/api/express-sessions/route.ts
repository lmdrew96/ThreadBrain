import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expressSessions, documents } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { documentId, purpose, expressPurpose, deadline } = await req.json();

    if (!documentId || !purpose || !expressPurpose) {
      return NextResponse.json(
        { error: "Missing required fields: documentId, purpose, expressPurpose" },
        { status: 400 }
      );
    }

    const validPurposes = ["discussion", "quiz", "essay", "conversation"];
    if (!validPurposes.includes(expressPurpose)) {
      return NextResponse.json(
        { error: "expressPurpose must be one of: discussion, quiz, essay, conversation" },
        { status: 400 }
      );
    }

    // Verify the document belongs to this user
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const [session] = await db
      .insert(expressSessions)
      .values({
        userId,
        documentId,
        purpose,
        expressPurpose,
        deadline: deadline ? new Date(deadline) : null,
      })
      .returning();

    return NextResponse.json(session);
  } catch (error) {
    console.error("Express session creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create express session" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessions = await db
      .select()
      .from(expressSessions)
      .where(eq(expressSessions.userId, userId))
      .orderBy(desc(expressSessions.createdAt));

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Failed to fetch express sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch express sessions" },
      { status: 500 }
    );
  }
}
