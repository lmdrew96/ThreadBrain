import type { InferSelectModel } from "drizzle-orm";
import type {
  documents,
  readingSessions,
  chunks,
  checkIns,
  exports,
  shelves,
} from "@/lib/db/schema";

// Inferred types from Drizzle schema
export type Document = InferSelectModel<typeof documents>;
export type ReadingSession = InferSelectModel<typeof readingSessions>;
export type Shelf = InferSelectModel<typeof shelves>;
export type Chunk = InferSelectModel<typeof chunks>;
export type CheckIn = InferSelectModel<typeof checkIns>;
export type Export = InferSelectModel<typeof exports>;

// Thread Map types
export interface ThreadNode {
  id: string;
  type: "claim" | "evidence" | "concept" | "conclusion" | "question";
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
