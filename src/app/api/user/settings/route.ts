import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  if (!row) {
    return NextResponse.json({ rjUrl: null, rjApiKeySet: false });
  }

  return NextResponse.json({
    rjUrl: row.rjUrl,
    rjApiKeySet: !!row.rjApiKey,
  });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { rjUrl?: string; rjApiKey?: string };

  if (!process.env.SETTINGS_ENCRYPTION_KEY) {
    return NextResponse.json(
      { error: "SETTINGS_ENCRYPTION_KEY is not configured on this server" },
      { status: 503 }
    );
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if ("rjApiKey" in body && body.rjApiKey?.trim()) {
    updates.rjApiKey = encrypt(body.rjApiKey.trim());
  }

  await db
    .insert(userSettings)
    .values({ userId, ...updates })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: updates,
    });

  return NextResponse.json({ ok: true });
}
