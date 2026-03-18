"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import type { ThreadMap, ThreadNode as TNode } from "@/types";

// ─── Node styles by type ───────────────────────────────────────────────────

const TYPE_META: Record<
  TNode["type"],
  { color: string; bg: string; border: string; emoji: string }
> = {
  claim: {
    color: "#d97706",
    bg: "rgba(217,119,6,0.12)",
    border: "rgba(217,119,6,0.5)",
    emoji: "💬",
  },
  evidence: {
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.5)",
    emoji: "📊",
  },
  concept: {
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.5)",
    emoji: "💡",
  },
  conclusion: {
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.5)",
    emoji: "✅",
  },
  question: {
    color: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.5)",
    emoji: "❓",
  },
};

// ─── Custom node component ─────────────────────────────────────────────────

function ThreadNode({ data }: { data: { label: string; type: TNode["type"]; detail?: string } }) {
  const meta = TYPE_META[data.type] ?? TYPE_META.concept;

  return (
    <div
      style={{
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: "10px",
        padding: "10px 14px",
        maxWidth: "200px",
        minWidth: "140px",
        backdropFilter: "blur(8px)",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: meta.color, width: 8, height: 8, border: "none" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
        <span style={{ fontSize: "12px" }}>{meta.emoji}</span>
        <span
          style={{
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: meta.color,
            opacity: 0.8,
          }}
        >
          {data.type}
        </span>
      </div>
      <div
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--color-foreground)",
          lineHeight: 1.35,
        }}
      >
        {data.label}
      </div>
      {data.detail && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--color-muted-foreground)",
            marginTop: "5px",
            lineHeight: 1.4,
          }}
        >
          {data.detail}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: meta.color, width: 8, height: 8, border: "none" }}
      />
    </div>
  );
}

const nodeTypes = { threadNode: ThreadNode };

// ─── Dagre layout ──────────────────────────────────────────────────────────

const NODE_W = 220;
const NODE_H = 120;

function dagreLayout(tnodes: TNode[], tedges: ThreadMap["edges"]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80, marginx: 40, marginy: 40 });

  for (const n of tnodes) {
    g.setNode(n.id, { width: NODE_W, height: NODE_H });
  }
  for (const e of tedges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  return tnodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: "threadNode",
      position: {
        x: pos.x - NODE_W / 2,
        y: pos.y - NODE_H / 2,
      },
      data: { label: n.label, type: n.type, detail: n.detail },
    };
  });
}

function buildEdges(edges: ThreadMap["edges"]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    labelStyle: { fontSize: 10, fill: "var(--color-muted-foreground)" },
    labelBgStyle: { fill: "var(--color-background)", fillOpacity: 0.85 },
    labelBgPadding: [4, 3] as [number, number],
    style: { stroke: "var(--color-border)", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-muted-foreground)" },
    animated: e.label === "supports" || e.label === "leads to",
  }));
}

// ─── localStorage position persistence ────────────────────────────────────

function loadSavedPositions(sessionId: string): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(`tb-thread-pos-${sessionId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePositions(sessionId: string, nodes: Node[]) {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    positions[n.id] = n.position;
  }
  localStorage.setItem(`tb-thread-pos-${sessionId}`, JSON.stringify(positions));
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [threadMap, setThreadMap] = useState<ThreadMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenState, setRegenState] = useState<"idle" | "confirm">("idle");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Debounce ref for saving positions
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyMap = useCallback(
    (map: ThreadMap, force = false) => {
      setThreadMap(map);

      const laid = dagreLayout(map.nodes, map.edges);

      // Overlay saved positions unless this is a forced regeneration
      if (!force) {
        const saved = loadSavedPositions(sessionId);
        const withSaved = laid.map((n) =>
          saved[n.id] ? { ...n, position: saved[n.id] } : n
        );
        setNodes(withSaved);
      } else {
        // Clear stale saved positions when regenerating
        localStorage.removeItem(`tb-thread-pos-${sessionId}`);
        setNodes(laid);
      }

      setEdges(buildEdges(map.edges));
    },
    [sessionId, setNodes, setEdges]
  );

  // On mount, check if the session already has a cached thread map
  useEffect(() => {
    async function checkCache() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        if (!res.ok) return;
        const session = await res.json();
        if (session.threadMap) {
          applyMap(session.threadMap as ThreadMap);
        }
      } catch {
        // silent — user can still generate manually
      }
    }
    checkCache();
  }, [sessionId, applyMap]);

  // Save positions whenever nodes change (debounced 500ms)
  useEffect(() => {
    if (!threadMap || nodes.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePositions(sessionId, nodes);
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [nodes, threadMap, sessionId]);

  async function generate(force = false) {
    setLoading(true);
    setError(null);
    setRegenState("idle");
    try {
      const res = await fetch("/api/ai/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      applyMap(data.threadMap as ThreadMap, force);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate thread map");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 56px)" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b glass shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            ← Back
          </button>
          <span className="text-muted-foreground shrink-0">·</span>
          <span className="text-sm font-medium truncate">
            {threadMap ? threadMap.title : "Thread Map"}
          </span>
        </div>

        {/* Legend — emoji-only on mobile, full on sm+ */}
        {threadMap && (
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
            {(Object.entries(TYPE_META) as [TNode["type"], typeof TYPE_META[TNode["type"]]][]).map(
              ([type, meta]) => (
                <div key={type} className="flex items-center gap-1 shrink-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: meta.color }}
                  />
                  <span className="hidden sm:inline text-xs text-muted-foreground capitalize">{type}</span>
                  <span className="sm:hidden text-xs" title={type}>{meta.emoji}</span>
                </div>
              )
            )}
          </div>
        )}

        {threadMap && (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => {
                if (regenState === "idle") {
                  setRegenState("confirm");
                } else {
                  generate(true);
                }
              }}
              onMouseLeave={() => setRegenState("idle")}
              disabled={loading}
              className={`text-sm rounded-md border px-3 py-2 font-medium transition-colors disabled:opacity-50 ${
                regenState === "confirm"
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span className="hidden sm:inline">{regenState === "confirm" ? "Sure? Regenerate" : "↺ Regenerate"}</span>
              <span className="sm:hidden">{regenState === "confirm" ? "Sure?" : "↺ Regen"}</span>
            </button>
            <button
              onClick={() => router.push(`/read/${sessionId}`)}
              className="text-sm rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <span className="hidden sm:inline">Continue Reading →</span>
              <span className="sm:hidden">Continue →</span>
            </button>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {!threadMap && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10">
            <div className="text-center space-y-2">
              <p className="text-4xl">🧵</p>
              <h2 className="text-xl font-semibold">Thread Map</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                See how the key ideas in this document connect — claims,
                evidence, concepts, and conclusions laid out as a visual graph.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              onClick={() => generate()}
              className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Generate Thread Map
            </button>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Mapping the argument structure...</p>
          </div>
        )}

        {threadMap && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            style={{ background: "var(--color-background)" }}
          >
            <Background color="#1b2438" gap={24} size={1} />
            <Controls
              style={{
                background: "rgba(8,12,24,0.9)",
                border: "1px solid #1b2438",
                borderRadius: "8px",
              }}
            />
            <MiniMap
              style={{
                background: "rgba(8,12,24,0.9)",
                border: "1px solid #1b2438",
                borderRadius: "8px",
              }}
              nodeColor={(n) => {
                const type = (n.data as { type: TNode["type"] }).type;
                return TYPE_META[type]?.color ?? "#7a8699";
              }}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
