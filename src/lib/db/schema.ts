import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// Enums
export const sourceTypeEnum = pgEnum("source_type", ["pdf", "url", "paste"]);
export const sessionStatusEnum = pgEnum("session_status", [
  "active",
  "paused",
  "completed",
]);

// Shelves — user-defined collections for organizing documents
export const shelves = pgTable("shelves", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  emoji: text("emoji").default("📚").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Documents — the source material a user uploads or pastes
export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  shelfId: uuid("shelf_id").references(() => shelves.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  sourceUrl: text("source_url"),
  fileKey: text("file_key"),
  rawText: text("raw_text").notNull(),
  wordCount: integer("word_count").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reading sessions — each time a user sits down to read a document
export const readingSessions = pgTable("reading_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  documentId: uuid("document_id")
    .references(() => documents.id, { onDelete: "cascade" })
    .notNull(),
  purpose: text("purpose").notNull(),
  energyLevel: integer("energy_level").notNull(),
  status: sessionStatusEnum("status").default("active").notNull(),
  currentChunkIdx: integer("current_chunk_idx").default(0).notNull(),
  mapSummary: text("map_summary"),
  threadMap: jsonb("thread_map"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Chunks — AI-generated reading segments for a specific session
export const chunks = pgTable("chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .references(() => readingSessions.id, { onDelete: "cascade" })
    .notNull(),
  documentId: uuid("document_id")
    .references(() => documents.id, { onDelete: "cascade" })
    .notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  microHeader: text("micro_header").notNull(),
  content: text("content").notNull(),
  highlights: jsonb("highlights")
    .$type<Array<{ text: string; reason: string }>>()
    .default([])
    .notNull(),
});

// Check-ins — comprehension prompts and user responses (V2, but schema ready)
export const checkIns = pgTable("check_ins", {
  id: uuid("id").defaultRandom().primaryKey(),
  chunkId: uuid("chunk_id")
    .references(() => chunks.id, { onDelete: "cascade" })
    .notNull(),
  prompt: text("prompt").notNull(),
  userResponse: text("user_response"),
  skipped: boolean("skipped").default(false).notNull(),
  respondedAt: timestamp("responded_at"),
});

// User settings — per-user configuration (integrations, preferences)
export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  rjUrl: text("rj_url"),
  rjApiKey: text("rj_api_key"), // AES-256-GCM encrypted
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Exports — generated summaries from completed sessions
export const exports = pgTable("exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .references(() => readingSessions.id, { onDelete: "cascade" })
    .notNull(),
  summaryMd: text("summary_md").notNull(),
  keyQuotes: jsonb("key_quotes")
    .$type<Array<{ quote: string; pageRef: string }>>()
    .default([])
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
