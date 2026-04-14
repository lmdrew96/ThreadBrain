import type { InferSelectModel } from "drizzle-orm";
import type {
  documents,
  readingSessions,
  chunks,
  checkIns,
  exports,
  shelves,
  userSettings,
} from "@/lib/db/schema";

// Inferred types from Drizzle schema
export type Document = InferSelectModel<typeof documents>;
export type ReadingSession = InferSelectModel<typeof readingSessions>;
export type Shelf = InferSelectModel<typeof shelves>;
export type Chunk = InferSelectModel<typeof chunks>;
export type CheckIn = InferSelectModel<typeof checkIns>;
export type Export = InferSelectModel<typeof exports>;
export type UserSettings = InferSelectModel<typeof userSettings>;

// Thread Map types
// Analytical content (essays, articles, research papers)
export type AnalyticalNodeType = "claim" | "evidence" | "concept" | "conclusion" | "question";

// Narrative content (fiction, stories, plays, chapters with plot)
export type NarrativeNodeType = "character" | "event" | "theme" | "setting" | "conflict" | "resolution";

export interface ThreadNode {
  id: string;
  type: AnalyticalNodeType | NarrativeNodeType;
  label: string;
  detail?: string;
}

export interface ThreadEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface ThreadMap {
  title: string;
  nodes: ThreadNode[];
  edges: ThreadEdge[];
}

// Key quote extracted from export
export interface KeyQuote {
  quote: string;
  chunkRef: string;
  context: string;
}

// API request/response types
export interface CreateDocumentRequest {
  text: string;
  title: string;
}

export interface StartSessionRequest {
  documentId: string;
  purpose: string;
  energyLevel: number;
}

export interface ChunkHighlight {
  text: string;
  reason: string;
}

// NDJSON stream message types from /api/ai/chunk
export type ChunkStreamMessage =
  | { type: "chunk"; chunk: Chunk }
  | { type: "done"; totalChunks: number }
  | { type: "error"; message: string };
