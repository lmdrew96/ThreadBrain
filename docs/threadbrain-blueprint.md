# 🧠 ThreadBrain — Architecture Blueprint

> AI-powered reading companion for ADHD brains. Don't skip the reading — make the reading possible.

---

## Tech Stack

Matched to your existing ChaosLimbă/ControlledChaos stack for consistency:

| Layer | Tool | Why |
|-------|------|-----|
| Framework | **Next.js 16** (App Router) | Your standard, SSR + API routes in one place |
| Language | **TypeScript** | Consistent across all your projects |
| Database | **Neon (Postgres)** + **Drizzle ORM** | Same as ChaosLimbă, serverless-friendly |
| Auth | **Clerk** | Already using it, one less thing to set up |
| Styling | **Tailwind v4** + **Radix UI** | Your existing component patterns |
| AI | **Anthropic Claude API** | Document analysis, chunking, highlights, comprehension prompts |
| PDF Parsing | **pdf-parse** or **unpdf** | Extract text + structure from uploaded PDFs |
| File Storage | **Cloudflare R2** | S3-compatible, already in your stack, no egress fees |
| Hosting | **Vercel** | Standard for your Next.js apps |

### New Dependencies (not in your current stack)

- `pdf-parse` or `unpdf` — PDF text extraction
- `mozilla/readability` — Clean article extraction from URLs (V2)
- `rehype` / `remark` — Render chunked content with annotations
- `@aws-sdk/client-s3` — Already in your stack; works with Cloudflare R2 as-is

---

## Data Model (Drizzle Schema)

### `documents`
The source material a user uploads or pastes.

```
id              uuid        PK
userId          text        FK → Clerk user
title           text        extracted or user-provided
sourceType      enum        'pdf' | 'url' | 'paste'
sourceUrl       text?       if imported from URL
fileKey         text?       S3 key if PDF upload
rawText         text        full extracted text
wordCount       integer
createdAt       timestamp
updatedAt       timestamp
```

### `reading_sessions`
Each time a user sits down to read a document.

```
id              uuid        PK
userId          text        FK → Clerk user
documentId      uuid        FK → documents
purpose         text        "Why are you reading this?" (free text)
energyLevel     integer     1-5 scale
status          enum        'active' | 'paused' | 'completed'
currentChunkIdx integer     where they left off
startedAt       timestamp
completedAt     timestamp?
```

### `chunks`
The AI-generated reading segments for a specific session.

```
id              uuid        PK
sessionId       uuid        FK → reading_sessions
documentId      uuid        FK → documents
chunkIndex      integer     order in sequence
microHeader     text        AI-generated "what this section is doing"
content         text        the actual text chunk
highlights      jsonb       array of {text, reason} — purpose-relevant highlights
startOffset     integer     character offset in rawText (for mapping back)
endOffset       integer
```

### `check_ins`
Comprehension prompts and user responses.

```
id              uuid        PK
chunkId         uuid        FK → chunks
prompt          text        AI-generated comprehension question
userResponse    text?       what the user typed (optional)
skipped         boolean     default false
respondedAt     timestamp?
```

### `exports`
Generated summaries from completed sessions.

```
id              uuid        PK
sessionId       uuid        FK → reading_sessions
summaryMd       text        markdown summary
keyQuotes       jsonb       array of {quote, pageRef}
createdAt       timestamp
```

---

## Page / Route Structure

```
src/app/
├── (marketing)/
│   └── page.tsx                    # Landing page
│
├── (app)/
│   ├── layout.tsx                  # App shell — sidebar + header
│   ├── dashboard/
│   │   └── page.tsx                # Library view — all documents + sessions
│   │
│   ├── upload/
│   │   └── page.tsx                # Upload/paste/URL import flow
│   │
│   ├── read/[sessionId]/
│   │   ├── page.tsx                # THE CORE — chunked reading experience
│   │   ├── map/
│   │   │   └── page.tsx            # "The Map" — orientation summary (pre-read)
│   │   └── export/
│   │       └── page.tsx            # Post-session export view
│   │
│   └── settings/
│       └── page.tsx                # Preferences (chunk size, energy defaults)
│
├── api/
│   ├── documents/
│   │   ├── route.ts                # POST: upload/create document
│   │   └── [id]/route.ts           # GET document details
│   │
│   ├── sessions/
│   │   ├── route.ts                # POST: start new reading session
│   │   └── [id]/
│   │       ├── route.ts            # GET/PATCH session state
│   │       └── chunks/route.ts     # GET chunks for session
│   │
│   ├── ai/
│   │   ├── analyze/route.ts        # POST: initial document analysis (The Map)
│   │   ├── chunk/route.ts          # POST: generate chunks for session
│   │   ├── check-in/route.ts       # POST: generate comprehension prompt
│   │   └── export/route.ts         # POST: generate session summary
│   │
│   └── upload/route.ts             # POST: handle file upload to S3
```

---

## AI Pipeline

This is the brain of the app. Four distinct AI calls, each with a focused job:

### 1. 📄 Document Ingestion
**Trigger:** User uploads PDF, pastes URL, or pastes text
**Process:**
- Extract raw text (pdf-parse for PDFs, readability for URLs)
- Store in `documents` table
- No AI needed yet — just parsing

### 2. 🧭 The Map (Orientation Summary)
**Trigger:** User starts a new reading session
**Input to AI:**
- Full document text (or first ~8000 tokens for very long docs)
- User's stated purpose
- User's energy level

**Prompt pattern:**
```
You are a reading guide for someone with ADHD who needs to read
an academic document. They've told you:

PURPOSE: {purpose}
ENERGY LEVEL: {energyLevel}/5

First, generate a 2-3 sentence orientation summary. Tell them:
- What this text IS (type, topic, main argument)
- Why it matters (connection to their stated purpose)
- What to expect (structure: "first they'll argue X, then show data, then conclude Y")

Keep it casual and encouraging. No jargon they wouldn't already know.
```

**Output:** Stored as part of the session, displayed on the Map page.

### 3. 🧩 Chunking + Highlights
**Trigger:** After Map is generated, before reading begins
**Input to AI:**
- Full document text
- User's purpose
- User's energy level (determines chunk size)

**Prompt pattern:**
```
Split this document into reading chunks for someone with ADHD.

ENERGY LEVEL: {energyLevel}/5
- Level 1-2: Very short chunks (1 paragraph, ~100-200 words)
- Level 3: Medium chunks (2-3 paragraphs, ~200-400 words)
- Level 4-5: Longer chunks (3-5 paragraphs, ~400-600 words)

For each chunk, provide:
1. microHeader: A casual 5-10 word label explaining what this section DOES
   (e.g., "The authors explain their method" or "Here's the key finding")
2. content: The actual text
3. highlights: Array of specific phrases/sentences that matter most for
   the reader's PURPOSE: "{purpose}". Each highlight needs a brief reason.

Return as JSON array.
```

**Output:** Stored in `chunks` table, rendered sequentially in reading view.

### 4. 💬 Check-In Prompts
**Trigger:** After user completes each chunk (generated on-demand, not pre-built)
**Input to AI:**
- The chunk they just read
- Their stated purpose
- Previous check-in responses (if any) for continuity

**Prompt pattern:**
```
The reader just finished this chunk: {chunkContent}

Their purpose: {purpose}

Generate ONE short comprehension check-in. This is NOT a quiz.
It should feel like a friend asking "so what'd you think?"

Good examples:
- "In your own words, what's the main claim here?"
- "How does this connect to what you read in chunk 2?"
- "Does this change how you'd think about [purpose-related topic]?"

Bad examples (don't do these):
- "What year was the study conducted?" (trivia)
- "List three key points" (homework)
```

**Output:** Displayed as optional prompt between chunks. Response saved to `check_ins`.

### 5. 📋 Export Generation
**Trigger:** User finishes or manually requests export
**Input to AI:**
- All chunks + highlights
- Any check-in responses
- User's purpose

**Output:** Markdown summary + key quotes with references. Stored in `exports`.

---

## V1 Feature Scope (What to Build First)

### ✅ In V1
- [ ] PDF upload + text paste (skip URL for now — adds complexity)
- [ ] The Map (orientation summary)
- [ ] Chunked reading mode with micro-headers
- [ ] Purpose-aware highlight layer
- [ ] Energy level selector (adjusts chunk size)
- [ ] Session persistence (pick up where you left off)
- [ ] Basic export (markdown summary + key quotes)
- [ ] Simple dashboard/library view

### 🔜 V2 Candidates
- URL import with article extraction
- Check-in comprehension prompts between chunks
- Thread View (visual argument map)
- Reading Profiles (Deep Research / Class Prep / Skim & Extract)
- Research Journal integration (export → journal)
- Reading analytics (time per chunk, completion rates)
- Multi-document sessions ("read these 3 papers for one assignment")

### 🔮 Future / Dream Features
- ChaosLimbă integration (flag SLA terminology in linguistics papers)
- ScribeCat integration (lecture mentions paper → auto-queue in ThreadBrain)
- Collaborative reading (peer study groups read same doc, share annotations)
- Spaced repetition review of key concepts from past readings

---

## Key UI Components

### Reading View (`/read/[sessionId]`)
This is the core experience. Think of it as a focused, single-column reader:

```
┌─────────────────────────────────────────┐
│  ← Back to Library          ⚡ Energy: 3 │
│─────────────────────────────────────────│
│  📄 "Interlanguage Theory & CALL Apps"  │
│  Chunk 4 of 12         ████████░░░░ 33% │
│─────────────────────────────────────────│
│                                         │
│  ┌─ The authors present their data ──┐  │
│  │                                   │  │
│  │  [Chunk content here with         │  │
│  │   highlighted phrases marked      │  │
│  │   in a subtle accent color]       │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  💡 Why highlighted: "This finding      │
│     directly relates to your question   │
│     about non-linear acquisition"       │
│                                         │
│         [ ← Previous ]  [ Next → ]      │
│                                         │
└─────────────────────────────────────────┘
```

### Dashboard / Library View
Simple grid/list of documents with session status:

```
┌─────────────────────────────────────────┐
│  🧠 ThreadBrain            [+ New Read] │
│─────────────────────────────────────────│
│                                         │
│  📄 Interlanguage & Error Analysis      │
│     Session: 8/12 chunks · In Progress  │
│     Purpose: ChaosLimbă research        │
│                                         │
│  📄 Chapter 4: Cell Biology             │
│     Session: Complete ✓                 │
│     Purpose: Bio 101 exam prep          │
│                                         │
│  📄 Krashen Input Hypothesis (1985)     │
│     No session yet · [Start Reading]    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Development Sequence

Recommended build order to get to a working prototype fastest:

### Phase 1: Foundation (Week 1)
1. Scaffold Next.js project with your standard stack
2. Set up Neon DB + Drizzle schema (documents, reading_sessions, chunks)
3. Clerk auth (copy config from ChaosLimbă)
4. Basic file upload → text extraction pipeline (PDF only)

### Phase 2: AI Core (Week 2)
5. "The Map" — document analysis API route + display page
6. Chunking engine — AI splits document, stores chunks
7. Reading view — sequential chunk display with navigation

### Phase 3: Polish V1 (Week 3)
8. Highlight layer (purpose-aware AI highlights within chunks)
9. Energy level selector that adjusts chunk sizing
10. Session persistence (resume where you left off)
11. Dashboard / library view
12. Basic export (markdown summary)

### Phase 4: Deploy
13. Vercel deployment
14. Cloudflare R2 bucket for PDF storage
15. Environment variables + production config

---

## Environment Variables

```env
# Database
DATABASE_URL=              # Neon connection string

# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# AI
ANTHROPIC_API_KEY=         # Claude API for all AI features

# Storage (Cloudflare R2 — S3-compatible)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=              # https://<account-id>.r2.cloudflarestorage.com

# App
NEXT_PUBLIC_APP_URL=       # http://localhost:3000 in dev
```

---

## Naming & Branding Notes

- **ThreadBrain** — the "thread" metaphor works on multiple levels: threading through dense text, threads of an argument, keeping the thread of your attention
- Potential tagline: *"Don't skip the reading. Thread through it."*
- Color palette suggestion: warm/approachable (not clinical), maybe amber/gold tones for highlights against a clean reading surface
- Logo concept: a brain with a thread/needle going through it, or a thread weaving through text lines

---

*This blueprint is a living document. Update as V1 takes shape.*
