import type { InferSelectModel } from "drizzle-orm";
import type {
  documents,
  readingSessions,
  chunks,
  checkIns,
  exports,
} from "@/lib/db/schema";

// Inferred types from Drizzle schema
export type Document = InferSelectModel<typeof documents>;
export type ReadingSession = InferSelectModel<typeof readingSessions>;
export type Chunk = InferSelectModel<typeof chunks>;
export type CheckIn = InferSelectModel<typeof checkIns>;
export type Export = InferSelectModel<typeof exports>;

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
