import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { extractTextFromPdf } from "@/lib/pdf";
import { wordCount } from "@/lib/utils";

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

      if (file.size > 25 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File too large. Max 25 MB." },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      rawText = await extractTextFromPdf(buffer);
      title = file.name.replace(/\.pdf$/i, "");
      sourceType = "pdf";
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

    const [doc] = await db
      .insert(documents)
      .values({
        userId,
        title,
        sourceType,
        rawText,
        wordCount: wordCount(rawText),
      })
      .returning();

    return NextResponse.json({ documentId: doc.id, title: doc.title, wordCount: doc.wordCount });
  } catch (error) {
    console.error("Document creation failed:", error);
    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}
