import { useCallback } from "react";
import { motion } from "framer-motion";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import type { Environment } from "../types";
import { useStore } from "../store";
import { ENV_COLOR_MAP, clsx, envClass } from "../utils";

interface Props {
  env: Environment;
}

export function EnvironmentRegion({ env }: Props) {
  const { moveEnv, resizeEnv, forkEnvironment, deleteEnv, addCell, newId, getScale } = useStore();
  const meta = ENV_COLOR_MAP[env.color];

  if (env.isMain) return null;

  const onPointerDownDrag = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-no-env-drag]")) return;
      e.stopPropagation();
      let lx = e.clientX;
      let ly = e.clientY;
      const move = (ev: PointerEvent) => {
        const s = getScale();
        const dx = (ev.clientX - lx) / s;
        const dy = (ev.clientY - ly) / s;
        lx = ev.clientX;
        ly = ev.clientY;
        moveEnv(env.id, dx, dy);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [env.id, getScale, moveEnv],
  );

  const onResize = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = env.size.w;
      const startH = env.size.h;
      const move = (ev: PointerEvent) => {
        const s = getScale();
        const w = Math.max(280, startW + (ev.clientX - startX) / s);
        const h = Math.max(220, startH + (ev.clientY - startY) / s);
        resizeEnv(env.id, { w, h });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [env.id, env.size.h, env.size.w, getScale, resizeEnv],
  );

  const onAddCell = useCallback(() => {
    const id = newId("c");
    addCell({
      id,
      kind: "code",
      language: "python",
      code: "# new cell\n",
      position: { x: env.position.x + 30, y: env.position.y + env.size.h - 130 },
      size: { w: 320, h: 100 },
      envId: env.id,
      z: 1,
      status: "idle",
    });
  }, [addCell, env.id, env.position.x, env.position.y, env.size.h, newId]);

  const onFork = useCallback(() => {
    forkEnvironment(env.id);
  }, [env.id, forkEnvironment]);

  return (
    <motion.div
      // No `layout` here on purpose — see CellView for the reason.
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
      style={{
        position: "absolute",
        left: env.position.x,
        top: env.position.y,
        width: env.size.w,
        height: env.size.h,
      }}
      className={clsx("env-region group/env", envClass(env.color))}
      onPointerDown={onPointerDownDrag}
    >
      {/* Header */}
      <div className="absolute -top-3 left-3 right-3 flex items-center gap-2">
        <div
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-0.5 text-[11px] font-medium shadow-chip",
            meta.chip,
          )}
        >
          <GitBranch className="h-3 w-3" />
          {env.name}
        </div>
        <div data-no-env-drag className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover/env:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onAddCell(); }}
            className="inline-flex items-center gap-1 rounded-full border border-paper-300 bg-white px-2 py-0.5 text-[10px] text-paper-700 shadow-chip transition-colors hover:bg-paper-100"
            title="Add code cell here"
          >
            <Plus className="h-3 w-3" /> Cell
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFork(); }}
            className="inline-flex items-center gap-1 rounded-full border border-paper-300 bg-white px-2 py-0.5 text-[10px] text-paper-700 shadow-chip transition-colors hover:bg-paper-100"
            title="Fork this environment (creates a new runtime)"
          >
            <GitBranch className="h-3 w-3" /> Fork
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteEnv(env.id); }}
            className="inline-flex items-center justify-center rounded-full border border-paper-300 bg-white p-1 text-paper-600 shadow-chip transition-colors hover:bg-red-50 hover:text-red-600"
            title="Delete environment"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {env.description && (
        <div className="pointer-events-none absolute right-3 bottom-2 max-w-[60%] text-right text-[10px] text-paper-500">
          {env.description}
        </div>
      )}

      {/* Resize handle */}
      <div
        data-no-env-drag
        onPointerDown={onResize}
        className="absolute -bottom-0.5 -right-0.5 h-4 w-4 cursor-nwse-resize"
        style={{
          background: `linear-gradient(135deg, transparent 50%, ${meta.hex}55 50%)`,
          borderBottomRightRadius: 16,
        }}
      />
    </motion.div>
  );
}
