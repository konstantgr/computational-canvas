import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { Play, Sparkles, Unlink, Trash2, Loader2, ChevronRight, FastForward } from "lucide-react";
import type { Cell, CodeCell, MarkdownCell, OutputCell } from "../types";
import { useStore } from "../store";
import { ENV_COLOR_MAP, clsx } from "../utils";
import { OutputView } from "./OutputView";

interface CellViewProps {
  cell: Cell;
}

export function CellView({ cell }: CellViewProps) {
  const { state, moveCell, resizeCell, bringToFront, select, runCell, runPipeline, updateCode, detachOutput, deleteCell, getScale } = useStore();
  const env = state.environments[cell.envId];
  const envColor = env ? ENV_COLOR_MAP[env.color] : ENV_COLOR_MAP.orange;
  const isSelected = state.selectedId === cell.id;
  const isMain = !!env?.isMain;

  const onPointerDownDrag = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      e.stopPropagation();
      bringToFront(cell.id);
      select(cell.id);
      let lx = e.clientX;
      let ly = e.clientY;
      const move = (ev: PointerEvent) => {
        const s = getScale();
        const dx = (ev.clientX - lx) / s;
        const dy = (ev.clientY - ly) / s;
        lx = ev.clientX;
        ly = ev.clientY;
        moveCell(cell.id, dx, dy);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [bringToFront, cell.id, getScale, moveCell, select],
  );

  const onResize = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = cell.size.w;
      const startH = cell.size.h;
      const move = (ev: PointerEvent) => {
        const s = getScale();
        const w = Math.max(180, startW + (ev.clientX - startX) / s);
        const h = Math.max(60, startH + (ev.clientY - startY) / s);
        resizeCell(cell.id, { w, h });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [cell.id, cell.size.h, cell.size.w, getScale, resizeCell],
  );

  // Compute pipeline metadata once for code cells
  const pipelineInfo = useMemo(() => {
    if (cell.kind !== "code" || !cell.pipelineId) return null;
    const peers = Object.values(state.cells)
      .filter((c): c is CodeCell => c.kind === "code" && c.pipelineId === cell.pipelineId)
      .sort((a, b) => (a.pipelineOrder ?? 0) - (b.pipelineOrder ?? 0));
    const idx = peers.findIndex((c) => c.id === cell.id);
    return { idx, total: peers.length, isFirst: idx === 0, pipelineId: cell.pipelineId };
  }, [cell, state.cells]);

  return (
    <motion.div
      // Note: no `layout` prop. Framer-motion's layout animations measure the
      // element's bounding box; inside a CSS-transformed parent, every zoom step
      // changes that bbox and the element starts trying to "animate back" to its
      // previous on-screen position, which looks like the cell collapses or jumps.
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      style={{
        position: "absolute",
        left: cell.position.x,
        top: cell.position.y,
        width: cell.size.w,
        height: cell.size.h,
        zIndex: cell.z,
      }}
      className={clsx(
        "group cell-shell rounded-lg shadow-cell transition-shadow",
        isSelected && "ring-2",
        isSelected && envColor.ring,
      )}
      onPointerDown={onPointerDownDrag}
    >
      {cell.kind === "code" && (
        <CodeCellInner
          cell={cell}
          isMain={isMain}
          envChip={envColor.chip}
          pipelineInfo={pipelineInfo}
          onRun={() => runCell(cell.id)}
          onRunPipeline={() => pipelineInfo && runPipeline(pipelineInfo.pipelineId)}
          onChange={(c) => updateCode(cell.id, c)}
          onDelete={() => deleteCell(cell.id)}
        />
      )}
      {cell.kind === "output" && (
        <OutputCellInner
          cell={cell}
          envChip={envColor.chip}
          onDetach={() => detachOutput(cell.id)}
          onDelete={() => deleteCell(cell.id)}
        />
      )}
      {cell.kind === "markdown" && <MarkdownCellInner cell={cell} />}

      <div
        data-no-drag
        onPointerDown={onResize}
        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 cursor-nwse-resize rounded-br-lg"
        style={{ background: "linear-gradient(135deg, transparent 50%, rgba(24,24,27,0.18) 50%)" }}
        title="Resize"
      />
    </motion.div>
  );
}

// ---------- Code cell ----------

interface CodeInnerProps {
  cell: CodeCell;
  isMain: boolean;
  envChip: string;
  pipelineInfo: { idx: number; total: number; isFirst: boolean; pipelineId: string } | null;
  onRun: () => void;
  onRunPipeline: () => void;
  onChange: (code: string) => void;
  onDelete: () => void;
}

function CodeCellInner({ cell, isMain, envChip, pipelineInfo, onRun, onRunPipeline, onChange, onDelete }: CodeInnerProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (editing && taRef.current) taRef.current.focus();
  }, [editing]);

  const isAi = cell.authoredBy === "ai";
  const showPipelineBadge = pipelineInfo !== null;
  const showRunPipelineBtn = pipelineInfo?.isFirst === true;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-lg border-b border-paper-200 bg-paper-100/60 px-2.5 py-1.5">
        <div
          className={clsx(
            "flex h-5 min-w-[20px] items-center justify-center rounded text-[10px] font-semibold tabular-nums",
            cell.status === "running"
              ? "bg-paper-200 text-paper-600"
              : "bg-paper-900 text-white",
          )}
          title="Execution count"
        >
          {cell.status === "running" ? "…" : (cell.executionCount ?? "·")}
        </div>
        {showPipelineBadge ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-paper-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-paper-600">
            pipeline · step {pipelineInfo!.idx + 1}/{pipelineInfo!.total}
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-paper-500">
            {cell.language}
          </span>
        )}
        {isAi && (
          <span className={clsx("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]", envChip)}>
            <Sparkles className="h-2.5 w-2.5" /> AI
          </span>
        )}
        {!isMain && !showPipelineBadge && (
          <span className="rounded-md border border-paper-300 bg-white px-1.5 py-0.5 text-[10px] text-paper-500">
            code
          </span>
        )}

        <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {showRunPipelineBtn && (
            <button
              data-no-drag
              onClick={(e) => { e.stopPropagation(); onRunPipeline(); }}
              className="inline-flex items-center gap-1 rounded-md border border-paper-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-paper-700 hover:bg-paper-100"
              title="Run all cells in this pipeline in order"
            >
              <FastForward className="h-3 w-3" /> Pipeline
            </button>
          )}
          <button
            data-no-drag
            onClick={(e) => { e.stopPropagation(); onRun(); }}
            className="inline-flex items-center gap-1 rounded-md border border-paper-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-paper-700 hover:bg-paper-100"
            title="Run this cell (Shift+Enter while editing)"
          >
            {cell.status === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Run
          </button>
          <button
            data-no-drag
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded-md border border-paper-300 bg-white p-1 text-paper-500 hover:bg-red-50 hover:text-red-600"
            title="Delete cell"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Code body */}
      <div
        data-no-drag
        className={clsx(
          "relative flex-1 cursor-text overflow-hidden rounded-b-lg bg-white px-3 py-2 font-mono text-[12px] leading-snug text-paper-900",
          cell.status === "running" && "running-stripes",
        )}
        onClick={() => setEditing(true)}
        onDoubleClick={() => setEditing(true)}
      >
        {editing ? (
          <textarea
            ref={taRef}
            value={cell.code}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.shiftKey || e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onRun();
                setEditing(false);
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="scroll-thin h-full w-full resize-none bg-transparent text-paper-900 outline-none"
            spellCheck={false}
          />
        ) : (
          <pre className="scroll-thin h-full overflow-auto whitespace-pre-wrap text-paper-900">
            <SyntaxHighlightedPython code={cell.code} />
          </pre>
        )}
      </div>
    </div>
  );
}

// Tiny static highlighter — minimal, monochromatic-ish
function SyntaxHighlightedPython({ code }: { code: string }) {
  const KEYWORDS = ["import", "from", "as", "def", "return", "for", "in", "if", "else", "elif", "True", "False", "None", "and", "or", "not"];
  const tokens: { text: string; cls: string }[] = [];
  code.split(/(\n)/).forEach((seg) => {
    if (seg === "\n") {
      tokens.push({ text: "\n", cls: "" });
      return;
    }
    if (seg.trim().startsWith("#")) {
      tokens.push({ text: seg, cls: "text-paper-500" });
      return;
    }
    const parts = seg.split(/('[^']*'|"[^"]*")/g);
    for (const part of parts) {
      if (!part) continue;
      if ((part.startsWith("'") && part.endsWith("'")) || (part.startsWith('"') && part.endsWith('"'))) {
        tokens.push({ text: part, cls: "text-emerald-700" });
        continue;
      }
      const words = part.split(/(\b[A-Za-z_][\w]*\b|\d+\.?\d*|\W)/g).filter((w) => w !== "");
      for (const w of words) {
        if (KEYWORDS.includes(w)) tokens.push({ text: w, cls: "text-purple-700" });
        else if (/^\d/.test(w)) tokens.push({ text: w, cls: "text-orange-700" });
        else tokens.push({ text: w, cls: "text-paper-900" });
      }
    }
  });
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className={t.cls}>
          {t.text}
        </span>
      ))}
    </>
  );
}

// ---------- Output cell ----------

interface OutputInnerProps {
  cell: OutputCell;
  envChip: string;
  onDetach: () => void;
  onDelete: () => void;
}

function OutputCellInner({ cell, envChip, onDetach, onDelete }: OutputInnerProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 rounded-t-lg border-b border-paper-200 bg-paper-100/60 px-2.5 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-paper-500">
          {cell.detached ? "detached" : "output"}
        </span>
        {cell.authoredBy === "ai" && (
          <span className={clsx("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]", envChip)}>
            <Sparkles className="h-2.5 w-2.5" /> AI
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!cell.detached && (
            <button
              data-no-drag
              onClick={(e) => { e.stopPropagation(); onDetach(); }}
              className="inline-flex items-center gap-1 rounded-md border border-paper-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-paper-700 hover:bg-paper-100"
              title="Detach this output so the next run creates a fresh one"
            >
              <Unlink className="h-3 w-3" /> Detach
            </button>
          )}
          <button
            data-no-drag
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded-md border border-paper-300 bg-white p-1 text-paper-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div data-no-drag className="flex-1 overflow-hidden bg-white p-2">
        <OutputView output={cell.output} />
      </div>
    </div>
  );
}

function MarkdownCellInner({ cell }: { cell: MarkdownCell }) {
  return (
    <div className="flex h-full flex-col p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-paper-500">
        <ChevronRight className="h-3 w-3" /> note
      </div>
      <div className="mt-1 text-sm text-paper-900">{cell.text}</div>
    </div>
  );
}
