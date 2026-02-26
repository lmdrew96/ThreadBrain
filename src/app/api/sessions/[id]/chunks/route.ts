import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chunks, readingSessions } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify session belongs to user
  const [session] = await db
    .select()
    .from(readingSessions)
    .where(
      and(eq(readingSessions.id, id), eq(readingSessions.userId, userId))
    );

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const sessionChunks = await db
    .select()
    .from(chunks)
    .where(eq(chunks.sessionId, id))
    .orderBy(asc(chunks.chunkIndex));

  return NextResponse.json(sessionChunks);
}
