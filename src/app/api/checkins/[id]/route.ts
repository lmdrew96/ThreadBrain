import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkIns, chunks, readingSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    // Verify the check-in exists and belongs to the user
    const [checkIn] = await db
      .select()
      .from(checkIns)
      .where(eq(checkIns.id, id));

    if (!checkIn) {
      return NextResponse.json({ error: "Check-in not found" }, { status: 404 });
    }

    // Verify ownership through chunk → session → userId
    const [chunk] = await db
      .select()
      .from(chunks)
      .where(eq(chunks.id, checkIn.chunkId));

    if (!chunk) {
      return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
    }

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update the check-in
    const [updated] = await db
      .update(checkIns)
      .set({
        userResponse: body.userResponse ?? null,
        skipped: body.skipped ?? false,
        respondedAt: new Date(),
      })
      .where(eq(checkIns.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Check-in update failed:", error);
    return NextResponse.json(
      { error: "Failed to update check-in" },
      { status: 500 }
    );
  }
}
