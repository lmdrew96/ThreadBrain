import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readingSessions, documents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { documentId, purpose, energyLevel } = await req.json();

    if (!documentId || !purpose || !energyLevel) {
      return NextResponse.json(
        { error: "Missing required fields: documentId, purpose, energyLevel" },
        { status: 400 }
      );
    }

    if (energyLevel < 1 || energyLevel > 5) {
      return NextResponse.json(
        { error: "Energy level must be between 1 and 5" },
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
      .insert(readingSessions)
      .values({
        userId,
        documentId,
        purpose,
        energyLevel,
      })
      .returning();

    return NextResponse.json(session);
  } catch (error) {
    console.error("Session creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
