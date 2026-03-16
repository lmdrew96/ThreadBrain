"use client";

import { useEffect, useState, useCallback } from "react";
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
import type { ThreadMap, ThreadNode as TNode } from "@/types";

// ─── Node styles by type ───────────────────────────────────────────────────

const TYPE_META: Record<
  TNode["type"],
  { color: string; bg: string; border: string; emoji: string }
> = {
  claim: {
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.1)",
    border: "rgba(251,191,36,0.4)",
    emoji: "💬",
  },
  evidence: {
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.1)",
    border: "rgba(96,165,250,0.4)",
    emoji: "📊",
  },
  concept: {
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.1)",
    border: "rgba(167,139,250,0.4)",
    emoji: "💡",
  },
  conclusion: {
    color: "#34d399",
    bg: "rgba(52,211,153,0.1)",
    border: "rgba(52,211,153,0.4)",
    emoji: "✅",
  },
  question: {
    color: "#fb923c",
    bg: "rgba(251,146,60,0.1)",
    border: "rgba(251,146,60,0.4)",
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
          color: "#f0ede6",
          lineHeight: 1.35,
        }}
      >
        {data.label}
      </div>
      {data.detail && (
        <div
          style={{
            fontSize: "11px",
            color: "#7a8699",
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

// ─── Layout: arrange by type in horizontal bands ──────────────────────────

const TYPE_ROW: Record<TNode["type"], number> = {
  claim: 0,
  concept: 1,
  evidence: 2,
  conclusion: 3,
  question: 4,
};

function layoutNodes(nodes: TNode[]): Node[] {
  const rows: Record<number, TNode[]> = {};
  for (const n of nodes) {
    const row = TYPE_ROW[n.type] ?? 2;
    (rows[row] ??= []).push(n);
  }

  const NODE_W = 220;
  const NODE_H = 160;
  const ROW_GAP = 180;

  return nodes.map((n) => {
    const row = TYPE_ROW[n.type] ?? 2;
    const rowNodes = rows[row];
    const idx = rowNodes.indexOf(n);
    const total = rowNodes.length;
    const x = (idx - (total - 1) / 2) * NODE_W;
    const y = row * ROW_GAP;

    return {
      id: n.id,
      type: "threadNode",
      position: { x, y },
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
    labelStyle: { fontSize: 10, fill: "#7a8699" },
    labelBgStyle: { fill: "rgba(5,8,15,0.8)" },
    labelBgPadding: [4, 3] as [number, number],
    style: { stroke: "#1b2438", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#1b2438" },
    animated: e.label === "supports" || e.label === "leads to",
  }));
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [threadMap, setThreadMap] = useState<ThreadMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const applyMap = useCallback((map: ThreadMap) => {
    setThreadMap(map);
    setNodes(layoutNodes(map.nodes));
    setEdges(buildEdges(map.edges));
  }, [setNodes, setEdges]);

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

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      applyMap(data.threadMap as ThreadMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate thread map");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b glass shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm font-medium">
            {threadMap ? threadMap.title : "Thread Map"}
          </span>
        </div>

        {/* Legend */}
        {threadMap && (
          <div className="hidden sm:flex items-center gap-4">
            {(Object.entries(TYPE_META) as [TNode["type"], typeof TYPE_META[TNode["type"]]][]).map(
              ([type, meta]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: meta.color }}
                  />
                  <span className="text-xs text-muted-foreground capitalize">{type}</span>
                </div>
              )
            )}
          </div>
        )}

        {threadMap && (
          <button
            onClick={() => router.push(`/read/${sessionId}`)}
            className="text-sm rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Continue Reading →
          </button>
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
              onClick={generate}
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
