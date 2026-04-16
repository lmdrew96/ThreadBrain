import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expressSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [session] = await db
      .select()
      .from(expressSessions)
      .where(
        and(eq(expressSessions.id, id), eq(expressSessions.userId, userId))
      );

    if (!session) {
      return NextResponse.json(
        { error: "Express session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Failed to fetch express session:", error);
    return NextResponse.json(
      { error: "Failed to fetch express session" },
      { status: 500 }
    );
  }
}
