import { useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { useStore } from "../store";
import { CellView } from "./CellView";
import { EnvironmentRegion } from "./EnvironmentRegion";
import type { Cell, CodeCell, OutputCell } from "../types";

export function Canvas() {
  const { state, pan, zoomAt, select } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);

  // Wheel zoom (ctrl/cmd + wheel) and pan (regular wheel)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0015);
        zoomAt(x, y, factor);
      } else {
        pan(-e.deltaX, -e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pan, zoomAt]);

  const onBackgroundPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.target !== e.currentTarget && !(e.target as HTMLElement).hasAttribute("data-canvas-bg")) {
        return;
      }
      select(undefined);
      isPanning.current = true;
      let lx = e.clientX;
      let ly = e.clientY;
      const move = (ev: PointerEvent) => {
        if (!isPanning.current) return;
        pan(ev.clientX - lx, ev.clientY - ly);
        lx = ev.clientX;
        ly = ev.clientY;
      };
      const up = () => {
        isPanning.current = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [pan, select],
  );

  const { offsetX, offsetY, scale } = state.viewport;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-white"
      onPointerDown={onBackgroundPointerDown}
    >
      {/* Subtle dotted grid */}
      <div
        data-canvas-bg
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(24,24,27,0.08) 1px, transparent 1px)",
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          backgroundPosition: `${offsetX}px ${offsetY}px`,
          cursor: isPanning.current ? "grabbing" : "grab",
        }}
      />

      {/* Transformed world */}
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Environment regions (forks only) */}
        {state.envOrder.map((envId) => {
          const env = state.environments[envId];
          if (!env) return null;
          return <EnvironmentRegion key={env.id} env={env} />;
        })}

        {/* Pipeline + parent connectors */}
        <ConnectorLayer />

        {/* Cells on top */}
        {state.cellOrder.map((cellId) => {
          const cell = state.cells[cellId];
          if (!cell) return null;
          return <CellView key={cell.id} cell={cell} />;
        })}

        {/* Floating AI marker — follows whichever cell the agent is working on. */}
        <AgentFocusMarker />
      </div>

      {/* Top-left brand chip */}
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-chip backdrop-blur">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-zinc-900 text-[10px] font-bold text-white">
          CC
        </div>
        Computational Canvas
        <span className="rounded-full border border-zinc-200 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-zinc-500">
          prototype
        </span>
      </div>
    </div>
  );
}

function ConnectorLayer() {
  const { state } = useStore();
  const pad = 4000;

  // Pipeline arrows: ordered chain by pipelineOrder
  const pipelineArrows: { id: string; d: string }[] = [];
  const byPipeline = new Map<string, CodeCell[]>();
  Object.values(state.cells).forEach((c) => {
    if (c.kind !== "code" || !c.pipelineId) return;
    const arr = byPipeline.get(c.pipelineId) ?? [];
    arr.push(c as CodeCell);
    byPipeline.set(c.pipelineId, arr);
  });
  byPipeline.forEach((cells, pipelineId) => {
    const sorted = cells.slice().sort((a, b) => (a.pipelineOrder ?? 0) - (b.pipelineOrder ?? 0));
    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i];
      const to = sorted[i + 1];
      // Anchor on the bottom-center of "from" and top-center of "to"
      // If "from" has a non-detached output, route from below the output instead.
      let fromX = from.position.x + from.size.w / 2;
      let fromY = from.position.y + from.size.h;
      if (from.outputId) {
        const out = state.cells[from.outputId];
        if (out && out.kind === "output" && !out.detached) {
          fromX = out.position.x + out.size.w / 2;
          fromY = out.position.y + out.size.h;
        }
      }
      const toX = to.position.x + to.size.w / 2;
      const toY = to.position.y;
      const midY = (fromY + toY) / 2;
      const d = `M ${fromX + pad} ${fromY + pad} C ${fromX + pad} ${midY + pad}, ${toX + pad} ${midY + pad}, ${toX + pad} ${toY + pad - 8}`;
      pipelineArrows.push({ id: `${pipelineId}-${i}`, d });
    }
  });

  // Code -> output connectors (only live, non-detached)
  const codeOutputLinks: { id: string; d: string }[] = [];
  Object.values(state.cells).forEach((c: Cell) => {
    if (c.kind !== "output") return;
    const o = c as OutputCell;
    if (o.detached || !o.parentId) return;
    const parent = state.cells[o.parentId];
    if (!parent) return;
    const fx = parent.position.x + parent.size.w / 2;
    const fy = parent.position.y + parent.size.h;
    const tx = o.position.x + o.size.w / 2;
    const ty = o.position.y;
    const midY = (fy + ty) / 2;
    const d = `M ${fx + pad} ${fy + pad} C ${fx + pad} ${midY + pad}, ${tx + pad} ${midY + pad}, ${tx + pad} ${ty + pad}`;
    codeOutputLinks.push({ id: o.id, d });
  });

  return (
    <svg
      className="pointer-events-none absolute"
      style={{ left: -pad, top: -pad, width: pad * 2, height: pad * 2 }}
    >
      <defs>
        <marker
          id="pipe-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L0,6 L7,3 z" fill="#71717a" />
        </marker>
      </defs>
      {/* Pipeline arrows: solid soft gray + arrowhead */}
      {pipelineArrows.map((a) => (
        <path
          key={a.id}
          d={a.d}
          stroke="#a1a1aa"
          strokeWidth={1.5}
          fill="none"
          markerEnd="url(#pipe-arrow)"
        />
      ))}
      {/* Code -> output: dashed light gray, no arrowhead */}
      {codeOutputLinks.map((l) => (
        <path
          key={l.id}
          d={l.d}
          stroke="#d4d4d8"
          strokeWidth={1.25}
          strokeDasharray="3 4"
          fill="none"
        />
      ))}
    </svg>
  );
}

// A small floating "AI agent" chip that springs from cell to cell to visualise
// what the assistant is currently writing or running. Lives inside the world
// container so it scales/pans with the canvas. Stays parked at the last cell
// once the scenario finishes (per design: "keep it at the cell it was executed
// last").
function AgentFocusMarker() {
  const { state } = useStore();
  const focusId = state.agentFocusCellId;
  if (!focusId) return null;
  const cell = state.cells[focusId];
  if (!cell) return null;

  // Anchor on the top-right corner of the cell, slightly outside so it doesn't
  // cover code. The chip is 28px; centre it on the corner with a small offset.
  const x = cell.position.x + cell.size.w - 14;
  const y = cell.position.y - 14;
  const isRunning = cell.kind === "code" && cell.status === "running";

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{ left: 0, top: 0, zIndex: 9999 }}
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.8 }}
    >
      <div className="relative">
        {/* Soft halo, stronger when actively running */}
        <motion.div
          className="absolute inset-0 rounded-full bg-zinc-900/20 blur-md"
          animate={
            isRunning
              ? { scale: [1, 1.6, 1], opacity: [0.5, 0.15, 0.5] }
              : { scale: 1.2, opacity: 0.3 }
          }
          transition={
            isRunning
              ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.4 }
          }
          style={{ width: 28, height: 28 }}
        />
        {/* Chip itself */}
        <motion.div
          className="relative flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg ring-2 ring-white"
          animate={isRunning ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={
            isRunning
              ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.25 }
          }
        >
          <Bot className="h-3.5 w-3.5" />
        </motion.div>
      </div>
    </motion.div>
  );
}
