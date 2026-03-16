import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { wordCount } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return NextResponse.json(
      { error: "Please enter a valid URL (https://...)" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ThreadBrain/1.0; +https://threadbrain.adhdesigns.dev)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Could not fetch that URL (HTTP ${response.status})` },
        { status: 422 }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "URL must point to an HTML page, not a PDF or other file" },
        { status: 422 }
      );
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url: parsedUrl.toString() });
    const article = new Readability(dom.window.document).parse();

    if (!article || !article.textContent?.trim()) {
      return NextResponse.json(
        {
          error:
            "Couldn't extract readable content from that page. Try pasting the text directly.",
        },
        { status: 422 }
      );
    }

    const rawText = article.textContent.trim();
    const title = article.title || parsedUrl.hostname;

    const [doc] = await db
      .insert(documents)
      .values({
        userId,
        title,
        sourceType: "url",
        sourceUrl: parsedUrl.toString(),
        rawText,
        wordCount: wordCount(rawText),
      })
      .returning();

    return NextResponse.json({
      documentId: doc.id,
      title: doc.title,
      wordCount: doc.wordCount,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Request timed out — the page took too long to respond" },
        { status: 408 }
      );
    }
    console.error("URL import failed:", err);
    return NextResponse.json(
      { error: "Failed to import from URL" },
      { status: 500 }
    );
  }
}
