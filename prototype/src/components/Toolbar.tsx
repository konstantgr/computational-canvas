import { Plus, Minus, Maximize2, MousePointer2, Hand } from "lucide-react";
import { useStore } from "../store";

export function Toolbar() {
  const { state, zoomAt, setViewport } = useStore();
  const fit = () => {
    const cells = Object.values(state.cells);
    const envs = Object.values(state.environments).filter((e) => !e.isMain);
    const items = [
      ...cells.map((c) => ({ x: c.position.x, y: c.position.y, w: c.size.w, h: c.size.h })),
      ...envs.map((e) => ({ x: e.position.x, y: e.position.y, w: e.size.w, h: e.size.h })),
    ];
    if (items.length === 0) return;
    const minX = Math.min(...items.map((i) => i.x));
    const minY = Math.min(...items.map((i) => i.y));
    const maxX = Math.max(...items.map((i) => i.x + i.w));
    const maxY = Math.max(...items.map((i) => i.y + i.h));
    const padX = 80;
    const padY = 80;
    const w = maxX - minX + padX * 2;
    const h = maxY - minY + padY * 2;
    const screenW = window.innerWidth - 360;
    const screenH = window.innerHeight;
    const scale = Math.min(1.4, Math.max(0.35, Math.min(screenW / w, screenH / h)));
    setViewport({
      scale,
      offsetX: -minX * scale + padX * scale,
      offsetY: -minY * scale + padY * scale,
    });
  };

  return (
    <div className="absolute right-6 bottom-6 z-10 flex items-center gap-1 rounded-full border border-paper-300 bg-white px-1.5 py-1 shadow-chip">
      <ToolbarButton onClick={() => zoomAt(window.innerWidth / 2 - 180, window.innerHeight / 2, 1.2)} title="Zoom in">
        <Plus className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="px-1 font-mono text-[10px] tabular-nums text-paper-500">
        {Math.round(state.viewport.scale * 100)}%
      </div>
      <ToolbarButton onClick={() => zoomAt(window.innerWidth / 2 - 180, window.innerHeight / 2, 1 / 1.2)} title="Zoom out">
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-paper-200" />
      <ToolbarButton onClick={fit} title="Fit to screen">
        <Maximize2 className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

export function HelpHints() {
  return (
    <div className="absolute right-6 top-4 z-10 hidden items-center gap-3 rounded-full border border-paper-300 bg-white/90 px-3 py-1.5 text-[11px] text-paper-600 shadow-chip backdrop-blur md:flex">
      <span className="inline-flex items-center gap-1.5">
        <Hand className="h-3 w-3" /> drag background to pan
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MousePointer2 className="h-3 w-3" /> drag cells freely
      </span>
      <span className="font-mono text-[10px] text-paper-400">⌘ + scroll to zoom</span>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-paper-700 transition-colors hover:bg-paper-100"
    >
      {children}
    </button>
  );
}
