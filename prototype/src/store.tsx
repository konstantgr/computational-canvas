import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type {
  CanvasState,
  Cell,
  CodeCell,
  Environment,
  EnvColor,
  OutputCell,
  OutputKind,
  Position,
} from "./types";
import { execute, forkRuntime, newRuntime, type SimRuntime } from "./simEngine";
import { SCENARIOS, type ScenarioApi, type ScenarioName } from "./scenarios";

// ----- IDs -----
let idCounter = 1;
const id = (prefix: string) => `${prefix}_${idCounter++}_${Math.random().toString(36).slice(2, 6)}`;

// ----- Initial seed -----
function makeSeed(): CanvasState {
  // Main env exists as a runtime but doesn't render as a bounding box.
  const mainEnv: Environment = {
    id: "env_main",
    name: "Main",
    color: "orange",
    position: { x: 0, y: 0 },
    size: { w: 0, h: 0 },
    isMain: true,
  };

  const expEnv: Environment = {
    id: "env_explore",
    name: "Exploration",
    color: "blue",
    position: { x: 920, y: 80 },
    size: { w: 720, h: 460 },
    parentEnvId: "env_main",
    description: "Forked from Main · safe to experiment.",
  };

  const aiEnv: Environment = {
    id: "env_ai",
    name: "AI workspace",
    color: "purple",
    position: { x: 920, y: 580 },
    size: { w: 720, h: 460 },
    parentEnvId: "env_main",
    description: "Created by the AI assistant.",
  };

  const PIPE = "pipe_main";

  // Main pipeline — three steps that run in order, no surrounding box.
  const c1: CodeCell = {
    id: "c1",
    kind: "code",
    language: "python",
    code: "import pandas as pd\ndf = pd.read_csv('data/titanic.csv')\ndf.head()",
    position: { x: 120, y: 120 },
    size: { w: 360, h: 130 },
    envId: mainEnv.id,
    z: 1,
    status: "ok",
    executionCount: 1,
    pipelineId: PIPE,
    pipelineOrder: 1,
  };
  const o1: OutputCell = {
    id: "o1",
    kind: "output",
    parentId: c1.id,
    detached: false,
    position: { x: 120, y: 270 },
    size: { w: 460, h: 180 },
    envId: mainEnv.id,
    z: 1,
    output: {
      type: "dataframe",
      columns: ["PassengerId", "Survived", "Pclass", "Name", "Sex", "Age", "Fare"],
      rows: [
        [1, 0, 3, "Braund, Mr. Owen H.", "male", 22, 7.25],
        [2, 1, 1, "Cumings, Mrs. John B.", "female", 38, 71.2833],
        [3, 1, 3, "Heikkinen, Miss. Laina", "female", 26, 7.925],
        [4, 1, 1, "Futrelle, Mrs. Jacques H.", "female", 35, 53.1],
        [5, 0, 3, "Allen, Mr. William H.", "male", 35, 8.05],
      ],
      meta: "[891 rows x 12 columns]",
    },
  };
  c1.outputId = o1.id;

  const c2: CodeCell = {
    id: "c2",
    kind: "code",
    language: "python",
    code: "df = df.dropna(subset=['Age'])\ndf['AgeBucket'] = pd.cut(df.Age, [0, 18, 40, 80])",
    position: { x: 120, y: 470 },
    size: { w: 360, h: 100 },
    envId: mainEnv.id,
    z: 1,
    status: "ok",
    executionCount: 2,
    pipelineId: PIPE,
    pipelineOrder: 2,
  };

  const c3: CodeCell = {
    id: "c3",
    kind: "code",
    language: "python",
    code: "df.describe()",
    position: { x: 120, y: 590 },
    size: { w: 360, h: 70 },
    envId: mainEnv.id,
    z: 1,
    status: "ok",
    executionCount: 3,
    pipelineId: PIPE,
    pipelineOrder: 3,
  };
  const o3: OutputCell = {
    id: "o3",
    kind: "output",
    parentId: c3.id,
    detached: false,
    position: { x: 120, y: 680 },
    size: { w: 580, h: 230 },
    envId: mainEnv.id,
    z: 1,
    output: {
      type: "dataframe",
      columns: ["", "Survived", "Pclass", "Age", "Fare"],
      rows: [
        ["count", 714, 714, 714, 714],
        ["mean", 0.4062, 2.2367, 29.6991, 34.6942],
        ["std", 0.4914, 0.8389, 14.5265, 52.9189],
        ["min", 0, 1, 0.42, 0],
        ["50%", 0, 2, 28, 15.7417],
        ["max", 1, 3, 80, 512.3292],
      ],
      meta: "summary statistics",
    },
  };
  c3.outputId = o3.id;

  // Forked Exploration env — Fare + Pclass plots
  const c4: CodeCell = {
    id: "c4",
    kind: "code",
    language: "python",
    code: "import matplotlib.pyplot as plt\nplt.hist(df['Fare'])",
    position: { x: 960, y: 150 },
    size: { w: 320, h: 90 },
    envId: expEnv.id,
    z: 1,
    status: "ok",
    executionCount: 4,
  };
  const o4: OutputCell = {
    id: "o4",
    kind: "output",
    parentId: c4.id,
    detached: false,
    position: { x: 960, y: 260 },
    size: { w: 320, h: 250 },
    envId: expEnv.id,
    z: 1,
    output: {
      type: "histogram",
      title: "Fare distribution",
      bins: [
        { label: "0-10", value: 240 },
        { label: "10-20", value: 180 },
        { label: "20-40", value: 130 },
        { label: "40-80", value: 90 },
        { label: "80+", value: 60 },
      ],
    },
  };
  c4.outputId = o4.id;

  const c5: CodeCell = {
    id: "c5",
    kind: "code",
    language: "python",
    code: "df['Pclass'].hist()",
    position: { x: 1310, y: 150 },
    size: { w: 320, h: 80 },
    envId: expEnv.id,
    z: 1,
    status: "ok",
    executionCount: 5,
  };
  const o5: OutputCell = {
    id: "o5",
    kind: "output",
    parentId: c5.id,
    detached: false,
    position: { x: 1310, y: 250 },
    size: { w: 320, h: 250 },
    envId: expEnv.id,
    z: 1,
    output: {
      type: "bar",
      title: "Pclass distribution",
      bins: [
        { label: "1", value: 216 },
        { label: "2", value: 184 },
        { label: "3", value: 491 },
      ],
    },
  };
  c5.outputId = o5.id;

  // AI workspace env — AI authored cell + output
  const c6: CodeCell = {
    id: "c6",
    kind: "code",
    language: "python",
    code: "df.describe()",
    position: { x: 960, y: 640 },
    size: { w: 380, h: 80 },
    envId: aiEnv.id,
    z: 1,
    status: "ok",
    authoredBy: "ai",
    executionCount: 6,
  };
  const o6: OutputCell = {
    id: "o6",
    kind: "output",
    parentId: c6.id,
    detached: false,
    position: { x: 960, y: 740 },
    size: { w: 620, h: 270 },
    envId: aiEnv.id,
    z: 1,
    authoredBy: "ai",
    output: {
      type: "dataframe",
      columns: ["", "Survived", "Pclass", "Age", "Fare"],
      rows: [
        ["count", 891, 891, 714, 891],
        ["mean", 0.3838, 2.3086, 29.6991, 32.2042],
        ["std", 0.4866, 0.8361, 14.5265, 49.6934],
        ["min", 0, 1, 0.42, 0],
        ["50%", 0, 3, 28, 14.4542],
        ["max", 1, 3, 80, 512.3292],
      ],
      meta: "summary statistics",
    },
  };
  c6.outputId = o6.id;

  const cells: Record<string, Cell> = {
    [c1.id]: c1, [o1.id]: o1,
    [c2.id]: c2,
    [c3.id]: c3, [o3.id]: o3,
    [c4.id]: c4, [o4.id]: o4,
    [c5.id]: c5, [o5.id]: o5,
    [c6.id]: c6, [o6.id]: o6,
  };
  const cellOrder = [c1.id, o1.id, c2.id, c3.id, o3.id, c4.id, o4.id, c5.id, o5.id, c6.id, o6.id];

  return {
    cells,
    environments: { [mainEnv.id]: mainEnv, [expEnv.id]: expEnv, [aiEnv.id]: aiEnv },
    envOrder: [mainEnv.id, expEnv.id, aiEnv.id],
    cellOrder,
    viewport: { offsetX: 0, offsetY: 0, scale: 0.78 },
    zCounter: 10,
    execCounter: 7,
    chat: [
      {
        id: id("m"),
        role: "ai",
        text: "Hi! Ask me to plot something, summarise a dataset, or run an experiment. I'll spin up a separate environment so your main pipeline stays untouched.",
        createdAt: Date.now() - 1000 * 60,
      },
    ],
  };
}

// ----- Action types -----
type Action =
  | { type: "MOVE_CELL"; id: string; dx: number; dy: number }
  | { type: "SET_CELL_POS"; id: string; position: Position }
  | { type: "RESIZE_CELL"; id: string; size: { w: number; h: number } }
  | { type: "MOVE_ENV"; id: string; dx: number; dy: number }
  | { type: "RESIZE_ENV"; id: string; size: { w: number; h: number } }
  | { type: "BRING_TO_FRONT"; id: string }
  | { type: "SELECT"; id?: string }
  | { type: "UPDATE_CODE"; id: string; code: string }
  | { type: "SET_STATUS"; id: string; status: CodeCell["status"]; executionCount?: number }
  | { type: "SET_OUTPUT"; codeId: string; output: OutputKind; authoredBy?: "user" | "ai" }
  | { type: "DETACH_OUTPUT"; id: string }
  | { type: "ADD_CELL"; cell: Cell }
  | { type: "DELETE_CELL"; id: string }
  | { type: "ADD_ENVIRONMENT"; env: Environment }
  | { type: "DELETE_ENVIRONMENT"; id: string }
  | { type: "ASSIGN_CELL_TO_ENV"; cellId: string; envId: string }
  | { type: "VIEWPORT"; offsetX?: number; offsetY?: number; scale?: number; relPan?: { dx: number; dy: number }; zoomAt?: { x: number; y: number; factor: number } }
  | { type: "ADD_CHAT"; role: "user" | "ai"; text: string; envId?: string }
  | { type: "CLEAR_CHAT" }
  | { type: "CLEAR_CANVAS"; keepMain?: boolean }
  | { type: "FIT_ENV_TO_CELLS"; id: string; padding?: number; topPadding?: number }
  | { type: "SET_AGENT_FOCUS"; id?: string };

function reducer(state: CanvasState, action: Action): CanvasState {
  switch (action.type) {
    case "MOVE_CELL": {
      const cell = state.cells[action.id];
      if (!cell) return state;
      const moved = { ...cell, position: { x: cell.position.x + action.dx, y: cell.position.y + action.dy } };
      return { ...state, cells: { ...state.cells, [cell.id]: moved } };
    }
    case "SET_CELL_POS": {
      const cell = state.cells[action.id];
      if (!cell) return state;
      return { ...state, cells: { ...state.cells, [cell.id]: { ...cell, position: action.position } } };
    }
    case "RESIZE_CELL": {
      const cell = state.cells[action.id];
      if (!cell) return state;
      return { ...state, cells: { ...state.cells, [cell.id]: { ...cell, size: action.size } } };
    }
    case "MOVE_ENV": {
      const env = state.environments[action.id];
      if (!env) return state;
      const newPos = { x: env.position.x + action.dx, y: env.position.y + action.dy };
      // Move every cell currently inside this env's bounding box too.
      const newCells = { ...state.cells };
      Object.values(state.cells).forEach((c) => {
        if (c.envId === env.id) {
          newCells[c.id] = { ...c, position: { x: c.position.x + action.dx, y: c.position.y + action.dy } } as Cell;
        }
      });
      return {
        ...state,
        environments: { ...state.environments, [env.id]: { ...env, position: newPos } },
        cells: newCells,
      };
    }
    case "RESIZE_ENV": {
      const env = state.environments[action.id];
      if (!env) return state;
      return { ...state, environments: { ...state.environments, [env.id]: { ...env, size: action.size } } };
    }
    case "BRING_TO_FRONT": {
      const cell = state.cells[action.id];
      if (!cell) return state;
      const z = state.zCounter + 1;
      return {
        ...state,
        zCounter: z,
        cells: { ...state.cells, [cell.id]: { ...cell, z } },
      };
    }
    case "SELECT":
      return { ...state, selectedId: action.id };
    case "UPDATE_CODE": {
      const cell = state.cells[action.id];
      if (!cell || cell.kind !== "code") return state;
      return { ...state, cells: { ...state.cells, [cell.id]: { ...cell, code: action.code } } };
    }
    case "SET_STATUS": {
      const cell = state.cells[action.id];
      if (!cell || cell.kind !== "code") return state;
      return {
        ...state,
        cells: {
          ...state.cells,
          [cell.id]: { ...cell, status: action.status, executionCount: action.executionCount ?? cell.executionCount },
        },
      };
    }
    case "SET_OUTPUT": {
      const code = state.cells[action.codeId];
      if (!code || code.kind !== "code") return state;
      const existingOutput = code.outputId ? (state.cells[code.outputId] as OutputCell | undefined) : undefined;
      // Update existing live output OR create a new one
      if (existingOutput && !existingOutput.detached) {
        const updated: OutputCell = { ...existingOutput, output: action.output };
        return { ...state, cells: { ...state.cells, [updated.id]: updated } };
      }
      const newOut: OutputCell = {
        id: id("o"),
        kind: "output",
        parentId: code.id,
        detached: false,
        envId: code.envId,
        position: { x: code.position.x, y: code.position.y + code.size.h + 16 },
        size: { w: Math.max(360, code.size.w), h: 200 },
        z: code.z,
        output: action.output,
        authoredBy: action.authoredBy ?? code.authoredBy,
      };
      return {
        ...state,
        cells: { ...state.cells, [newOut.id]: newOut, [code.id]: { ...code, outputId: newOut.id } },
        cellOrder: [...state.cellOrder, newOut.id],
      };
    }
    case "DETACH_OUTPUT": {
      const o = state.cells[action.id];
      if (!o || o.kind !== "output") return state;
      const newOutput: OutputCell = { ...o, detached: true, parentId: undefined };
      // Unlink parent's outputId reference so a fresh execution will create a new output cell.
      const parent = o.parentId ? state.cells[o.parentId] : undefined;
      const cells = { ...state.cells, [o.id]: newOutput };
      if (parent && parent.kind === "code" && parent.outputId === o.id) {
        cells[parent.id] = { ...parent, outputId: undefined };
      }
      return { ...state, cells };
    }
    case "ADD_CELL":
      return {
        ...state,
        cells: { ...state.cells, [action.cell.id]: action.cell },
        cellOrder: [...state.cellOrder, action.cell.id],
      };
    case "DELETE_CELL": {
      const cells = { ...state.cells };
      const target = cells[action.id];
      if (!target) return state;
      delete cells[action.id];
      // If we delete a code cell, also delete its live (non-detached) output.
      if (target.kind === "code" && target.outputId) {
        const o = cells[target.outputId];
        if (o && o.kind === "output" && !o.detached) {
          delete cells[o.id];
        }
      }
      return { ...state, cells, cellOrder: state.cellOrder.filter((id) => id in cells) };
    }
    case "ADD_ENVIRONMENT":
      return {
        ...state,
        environments: { ...state.environments, [action.env.id]: action.env },
        envOrder: [...state.envOrder, action.env.id],
      };
    case "DELETE_ENVIRONMENT": {
      const env = state.environments[action.id];
      if (!env || env.isMain) return state;
      const envs = { ...state.environments };
      delete envs[action.id];
      // Reassign or delete cells in this env — for the demo, delete them.
      const cells = { ...state.cells };
      Object.values(cells).forEach((c) => {
        if (c.envId === action.id) delete cells[c.id];
      });
      return {
        ...state,
        environments: envs,
        envOrder: state.envOrder.filter((id) => id !== action.id),
        cells,
        cellOrder: state.cellOrder.filter((id) => id in cells),
      };
    }
    case "ASSIGN_CELL_TO_ENV": {
      const cell = state.cells[action.cellId];
      if (!cell) return state;
      return { ...state, cells: { ...state.cells, [cell.id]: { ...cell, envId: action.envId } } };
    }
    case "VIEWPORT": {
      let { offsetX, offsetY, scale } = state.viewport;
      if (action.relPan) {
        offsetX += action.relPan.dx;
        offsetY += action.relPan.dy;
      }
      if (action.zoomAt) {
        // Zoom about a screen point so the world point under the cursor stays put
        const { x, y, factor } = action.zoomAt;
        const newScale = Math.min(4, Math.max(0.15, scale * factor));
        const wx = (x - offsetX) / scale;
        const wy = (y - offsetY) / scale;
        offsetX = x - wx * newScale;
        offsetY = y - wy * newScale;
        scale = newScale;
      }
      if (action.offsetX !== undefined) offsetX = action.offsetX;
      if (action.offsetY !== undefined) offsetY = action.offsetY;
      if (action.scale !== undefined) scale = action.scale;
      return { ...state, viewport: { offsetX, offsetY, scale } };
    }
    case "ADD_CHAT":
      return {
        ...state,
        chat: [
          ...state.chat,
          { id: id("m"), role: action.role, text: action.text, envId: action.envId, createdAt: Date.now() },
        ],
      };
    case "CLEAR_CHAT":
      return { ...state, chat: [] };
    case "CLEAR_CANVAS": {
      const main = state.environments["env_main"];
      const environments: Record<string, Environment> = main
        ? { env_main: { ...main, position: { x: 0, y: 0 }, size: { w: 0, h: 0 } } }
        : {};
      const envOrder = main ? ["env_main"] : [];
      return {
        ...state,
        cells: {},
        cellOrder: [],
        environments,
        envOrder,
        selectedId: undefined,
        zCounter: 1,
        execCounter: 1,
        agentFocusCellId: undefined,
      };
    }
    case "SET_AGENT_FOCUS":
      return { ...state, agentFocusCellId: action.id };
    case "FIT_ENV_TO_CELLS": {
      const env = state.environments[action.id];
      if (!env) return state;
      const cells = Object.values(state.cells).filter((c) => c.envId === action.id);
      if (cells.length === 0) return state;
      const padding = action.padding ?? 36;
      const topPadding = action.topPadding ?? 56; // room for env header chip
      const minX = Math.min(...cells.map((c) => c.position.x)) - padding;
      const minY = Math.min(...cells.map((c) => c.position.y)) - topPadding;
      const maxX = Math.max(...cells.map((c) => c.position.x + c.size.w)) + padding;
      const maxY = Math.max(...cells.map((c) => c.position.y + c.size.h)) + padding;
      // Only grow — never shrink — to keep the box stable as cells appear.
      const w = Math.max(env.size.w, maxX - env.position.x);
      const h = Math.max(env.size.h, maxY - env.position.y);
      // Allow growing leftward/upward only if needed.
      const x = Math.min(env.position.x, minX);
      const y = Math.min(env.position.y, minY);
      const finalW = w + (env.position.x - x);
      const finalH = h + (env.position.y - y);
      if (
        x === env.position.x &&
        y === env.position.y &&
        finalW === env.size.w &&
        finalH === env.size.h
      ) {
        return state;
      }
      return {
        ...state,
        environments: {
          ...state.environments,
          [env.id]: { ...env, position: { x, y }, size: { w: finalW, h: finalH } },
        },
      };
    }
  }
}

// ----- Context -----
interface StoreCtx {
  state: CanvasState;
  // Cells
  moveCell: (id: string, dx: number, dy: number) => void;
  setCellPos: (id: string, position: Position) => void;
  resizeCell: (id: string, size: { w: number; h: number }) => void;
  bringToFront: (id: string) => void;
  select: (id?: string) => void;
  updateCode: (id: string, code: string) => void;
  detachOutput: (id: string) => void;
  deleteCell: (id: string) => void;
  addCell: (cell: Cell) => void;
  // Environments
  moveEnv: (id: string, dx: number, dy: number) => void;
  resizeEnv: (id: string, size: { w: number; h: number }) => void;
  forkEnvironment: (parentId: string, near?: Position, color?: EnvColor, name?: string) => string;
  deleteEnv: (id: string) => void;
  assignCellToEnv: (cellId: string, envId: string) => void;
  // Execution
  runCell: (id: string) => Promise<void>;
  runPipeline: (pipelineId: string) => Promise<void>;
  // Viewport
  pan: (dx: number, dy: number) => void;
  zoomAt: (x: number, y: number, factor: number) => void;
  setViewport: (v: { offsetX?: number; offsetY?: number; scale?: number }) => void;
  // Stable accessor that always returns the latest scale, so consumers can read
  // it inside event handlers without subscribing to viewport changes (which
  // would cause every cell to re-render on every wheel tick).
  getScale: () => number;
  // Chat
  addChat: (msg: { role: "user" | "ai"; text: string; envId?: string }) => void;
  sendUserPrompt: (text: string) => Promise<void>;
  // Canvas-wide
  clearCanvas: (opts?: { clearChat?: boolean }) => void;
  fitToContent: (padding?: number) => void;
  runScenario: (name: ScenarioName) => Promise<void>;
  isScenarioPlaying: () => boolean;
  // Helpers
  newId: (prefix: string) => string;
}

const StoreContext = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as CanvasState, makeSeed);

  // Live ref of state so async callbacks can read fresh data without rebinding
  const stateRef = useRef(state);
  stateRef.current = state;

  // Per-environment runtime kept in a ref so it survives re-renders without
  // forcing the whole tree to re-render when a runtime mutates internally.
  const runtimes = useRef<Record<string, SimRuntime>>({
    env_main: newRuntime({ vars: { df: "TITANIC" } }),
    env_explore: newRuntime({ vars: { df: "TITANIC" } }),
    env_ai: newRuntime({ vars: { df: "TITANIC" } }),
  });

  const moveCell = useCallback((id: string, dx: number, dy: number) => {
    dispatch({ type: "MOVE_CELL", id, dx, dy });
  }, []);
  const setCellPos = useCallback((id: string, position: Position) => {
    dispatch({ type: "SET_CELL_POS", id, position });
  }, []);
  const resizeCell = useCallback((id: string, size: { w: number; h: number }) => {
    dispatch({ type: "RESIZE_CELL", id, size });
  }, []);
  const bringToFront = useCallback((id: string) => {
    dispatch({ type: "BRING_TO_FRONT", id });
  }, []);
  const select = useCallback((id?: string) => dispatch({ type: "SELECT", id }), []);
  const updateCode = useCallback((id: string, code: string) => dispatch({ type: "UPDATE_CODE", id, code }), []);
  const detachOutput = useCallback((id: string) => dispatch({ type: "DETACH_OUTPUT", id }), []);
  const deleteCell = useCallback((id: string) => dispatch({ type: "DELETE_CELL", id }), []);
  const addCell = useCallback((cell: Cell) => dispatch({ type: "ADD_CELL", cell }), []);

  const moveEnv = useCallback((id: string, dx: number, dy: number) => dispatch({ type: "MOVE_ENV", id, dx, dy }), []);
  const resizeEnv = useCallback((id: string, size: { w: number; h: number }) => dispatch({ type: "RESIZE_ENV", id, size }), []);
  const deleteEnv = useCallback((id: string) => dispatch({ type: "DELETE_ENVIRONMENT", id }), []);
  const assignCellToEnv = useCallback((cellId: string, envId: string) => dispatch({ type: "ASSIGN_CELL_TO_ENV", cellId, envId }), []);

  const forkEnvironment = useCallback((parentId: string, near?: Position, color?: EnvColor, name?: string) => {
    const parent = stateRef.current.environments[parentId];
    if (!parent) return parentId;
    const newEnv: Environment = {
      id: id("env"),
      name: name ?? `Fork of ${parent.name}`,
      color: color ?? pickNextColor(stateRef.current.environments),
      position: near ?? { x: parent.position.x + parent.size.w + 60, y: parent.position.y },
      size: { w: 580, h: 380 },
      parentEnvId: parent.id,
      description: `Forked from ${parent.name} at ${new Date().toLocaleTimeString()}`,
    };
    runtimes.current[newEnv.id] = forkRuntime(runtimes.current[parent.id] ?? newRuntime());
    dispatch({ type: "ADD_ENVIRONMENT", env: newEnv });
    return newEnv.id;
  }, []);

  const runCell = useCallback(async (cellId: string) => {
    const cell = stateRef.current.cells[cellId];
    if (!cell || cell.kind !== "code") return;
    dispatch({ type: "SET_STATUS", id: cell.id, status: "running" });
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    let rt = runtimes.current[cell.envId];
    if (!rt) {
      rt = newRuntime();
      runtimes.current[cell.envId] = rt;
    }
    let output: OutputKind;
    try {
      output = execute(cell.code, rt);
    } catch (err) {
      output = { type: "error", value: String(err) };
    }
    const next = stateRef.current.execCounter;
    dispatch({ type: "SET_STATUS", id: cell.id, status: output.type === "error" ? "error" : "ok", executionCount: next });
    dispatch({ type: "SET_OUTPUT", codeId: cell.id, output });
    stateRef.current = { ...stateRef.current, execCounter: next + 1 };
  }, []);

  const runPipeline = useCallback(async (pipelineId: string) => {
    const ordered = Object.values(stateRef.current.cells)
      .filter((c): c is CodeCell => c.kind === "code" && c.pipelineId === pipelineId)
      .sort((a, b) => (a.pipelineOrder ?? 0) - (b.pipelineOrder ?? 0));
    for (const c of ordered) {
      // eslint-disable-next-line no-await-in-loop
      await runCell(c.id);
    }
  }, [runCell]);

  const pan = useCallback((dx: number, dy: number) => {
    userTouchedViewport.current = true;
    dispatch({ type: "VIEWPORT", relPan: { dx, dy } });
  }, []);
  const zoomAt = useCallback((x: number, y: number, factor: number) => {
    userTouchedViewport.current = true;
    dispatch({ type: "VIEWPORT", zoomAt: { x, y, factor } });
  }, []);
  const setViewport = useCallback((v: { offsetX?: number; offsetY?: number; scale?: number }) => {
    userTouchedViewport.current = true;
    dispatch({ type: "VIEWPORT", ...v });
  }, []);
  const getScale = useCallback(() => stateRef.current.viewport.scale, []);

  const addChat = useCallback((msg: { role: "user" | "ai"; text: string; envId?: string }) => {
    dispatch({ type: "ADD_CHAT", role: msg.role, text: msg.text, envId: msg.envId });
  }, []);

  const sendUserPrompt = useCallback(async (text: string) => {
    addChat({ role: "user", text });
    await new Promise((r) => setTimeout(r, 350));

    const lower = text.toLowerCase();
    const mainEnv = stateRef.current.environments["env_main"];
    if (!mainEnv) return;

    // Choose what to do based on simple intent matching.
    const aiEnvId = id("env");
    const colors: EnvColor[] = ["pink", "green", "purple", "blue"];
    const usedColors = new Set(Object.values(stateRef.current.environments).map((e) => e.color));
    const color = colors.find((c) => !usedColors.has(c)) ?? "pink";

    // Place the env to the right of every existing thing (skip the invisible main env)
    const maxRight = Math.max(
      0,
      ...Object.values(stateRef.current.environments)
        .filter((e) => !e.isMain)
        .map((e) => e.position.x + e.size.w),
      ...Object.values(stateRef.current.cells).map((c) => c.position.x + c.size.w),
    );
    const aiEnv: Environment = {
      id: aiEnvId,
      name: "AI · " + truncate(text, 24),
      color,
      position: { x: maxRight + 60, y: 80 },
      size: { w: 620, h: 520 },
      parentEnvId: mainEnv.id,
      description: `Forked by AI to answer: "${text}"`,
    };
    runtimes.current[aiEnvId] = forkRuntime(runtimes.current[mainEnv.id] ?? newRuntime());
    dispatch({ type: "ADD_ENVIRONMENT", env: aiEnv });

    // Simulated AI plan: 1 code cell + run
    let code = "df.head()";
    let aiText = "Here's a quick look at the data.";

    if (/(pclass|class).*(distribution|histogram|plot|bar|chart)/.test(lower) || /plot.*pclass/.test(lower)) {
      code = "import matplotlib.pyplot as plt\ndf['Pclass'].hist()";
      aiText = "Sure — here's the Pclass distribution. I forked a fresh environment so your main runtime stays untouched.";
    } else if (/fare/.test(lower)) {
      code = "import matplotlib.pyplot as plt\nplt.hist(df['Fare'])";
      aiText = "Plotted the fare distribution in a separate environment.";
    } else if (/age/.test(lower)) {
      code = "df['Age'].hist()";
      aiText = "Here's the age distribution.";
    } else if (/describe|summary|stats|statistics/.test(lower)) {
      code = "df.describe()";
      aiText = "Here are the descriptive statistics for the dataset.";
    } else if (/useful|important|attributes|features/.test(lower)) {
      code = "df.describe()";
      aiText = "Looking at descriptive stats, I'd start with Pclass, Sex, Age and Fare — they correlate strongly with Survived.";
    } else if (/train|model|classifier|accuracy/.test(lower)) {
      code = "from sklearn.ensemble import RandomForestClassifier\nfrom sklearn.model_selection import cross_val_score\nmodel = RandomForestClassifier(n_estimators=200)\ncross_val_score(model, X, y).mean()";
      aiText = "Trained a small RandomForest in a side environment. Mean CV accuracy ≈ 0.81.";
    } else {
      aiText = `I'll preview the data first. Tell me what you'd like to explore — try "plot Pclass distribution" or "describe the data".`;
    }

    const codeCell: CodeCell = {
      id: id("c"),
      kind: "code",
      language: "python",
      code,
      position: { x: aiEnv.position.x + 30, y: aiEnv.position.y + 70 },
      size: { w: 360, h: 110 },
      envId: aiEnvId,
      z: 1,
      status: "idle",
      authoredBy: "ai",
    };
    dispatch({ type: "ADD_CELL", cell: codeCell });
    addChat({ role: "ai", text: aiText, envId: aiEnvId });

    await new Promise((r) => setTimeout(r, 450));
    // Run the AI cell using the fresh env
    dispatch({ type: "SET_STATUS", id: codeCell.id, status: "running" });
    await new Promise((r) => setTimeout(r, 850));
    const rt = runtimes.current[aiEnvId];
    const output = execute(code, rt);
    dispatch({ type: "SET_STATUS", id: codeCell.id, status: output.type === "error" ? "error" : "ok", executionCount: stateRef.current.execCounter });
    dispatch({ type: "SET_OUTPUT", codeId: codeCell.id, output, authoredBy: "ai" });
  }, [addChat]);

  // Tracks whether the user has manually pan/zoom/positioned the viewport
  // since the current scenario started. Once they have, scenario-driven
  // auto-fits go silent so the agent never yanks the canvas out from under
  // the user mid-demo.
  const userTouchedViewport = useRef(false);

  const clearCanvas = useCallback((opts?: { clearChat?: boolean }) => {
    dispatch({ type: "CLEAR_CANVAS" });
    if (opts?.clearChat) dispatch({ type: "CLEAR_CHAT" });
    runtimes.current = { env_main: newRuntime() };
    userTouchedViewport.current = false;
  }, []);

  const fitToContent = useCallback((padding = 96) => {
    const cells = Object.values(stateRef.current.cells);
    const envs = Object.values(stateRef.current.environments).filter((e) => !e.isMain);
    const items: { x: number; y: number; w: number; h: number }[] = [
      ...cells.map((c) => ({ x: c.position.x, y: c.position.y, w: c.size.w, h: c.size.h })),
      ...envs.map((e) => ({ x: e.position.x, y: e.position.y, w: e.size.w, h: e.size.h })),
    ];
    if (items.length === 0) {
      dispatch({ type: "VIEWPORT", offsetX: 80, offsetY: 80, scale: 0.95 });
      return;
    }
    const minX = Math.min(...items.map((i) => i.x)) - padding;
    const minY = Math.min(...items.map((i) => i.y)) - padding;
    const maxX = Math.max(...items.map((i) => i.x + i.w)) + padding;
    const maxY = Math.max(...items.map((i) => i.y + i.h)) + padding;
    const screenW = window.innerWidth - 360; // chat panel width
    const screenH = window.innerHeight - 80; // toolbar headroom
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const scale = Math.min(1, Math.max(0.25, Math.min(screenW / contentW, screenH / contentH)));
    const offsetX = (screenW - contentW * scale) / 2 - minX * scale;
    const offsetY = (screenH - contentH * scale) / 2 - minY * scale + 30;
    dispatch({ type: "VIEWPORT", offsetX, offsetY, scale });
  }, []);

  // ----- Scenario runner -----
  // Each scenario click increments the token. Steps check the token before
  // proceeding so a new click cleanly cancels the previous play-through.
  const scenarioToken = useRef(0);
  const scenarioPlaying = useRef(false);

  const runScenario = useCallback(async (name: ScenarioName) => {
    const fn = SCENARIOS[name];
    if (!fn) return;
    const myToken = ++scenarioToken.current;
    scenarioPlaying.current = true;

    // Reset everything so the demo starts from a blank slate.
    clearCanvas({ clearChat: true });
    // Give React a tick to flush the clear before reading state in the scenario.
    await new Promise((r) => setTimeout(r, 60));
    dispatch({ type: "VIEWPORT", offsetX: 80, offsetY: 80, scale: 0.95 });

    const api: ScenarioApi = {
      addChat: (msg) => dispatch({ type: "ADD_CHAT", role: msg.role, text: msg.text, envId: msg.envId }),
      addCell: (cell) => dispatch({ type: "ADD_CELL", cell }),
      runCell: async (cellId) => {
        if (scenarioToken.current !== myToken) return;
        await runCell(cellId);
      },
      forkEnvironment: (parentId, near, color, envName) => {
        const parent = stateRef.current.environments[parentId];
        if (!parent) return parentId;
        const newEnv: Environment = {
          id: id("env"),
          name: envName ?? `Fork of ${parent.name}`,
          color: color ?? pickNextColor(stateRef.current.environments),
          position: near ?? { x: 720, y: 80 },
          size: { w: 620, h: 420 },
          parentEnvId: parent.id,
          description: `Forked from ${parent.name} at ${new Date().toLocaleTimeString()}`,
        };
        runtimes.current[newEnv.id] = forkRuntime(runtimes.current[parent.id] ?? newRuntime());
        dispatch({ type: "ADD_ENVIRONMENT", env: newEnv });
        return newEnv.id;
      },
      fitEnvToCells: (envId, padding) =>
        dispatch({ type: "FIT_ENV_TO_CELLS", id: envId, padding }),
      resizeEnv: (envId, size) =>
        dispatch({ type: "RESIZE_ENV", id: envId, size }),
      updateCode: (cellId, code) => dispatch({ type: "UPDATE_CODE", id: cellId, code }),
      bringToFront: (cellId) => dispatch({ type: "BRING_TO_FRONT", id: cellId }),
      setAgentFocus: (cellId) => dispatch({ type: "SET_AGENT_FOCUS", id: cellId }),
      newId: id,
      // Auto-fit only while the user hasn't taken over the viewport.
      // The moment they pan/zoom, the agent stops moving the canvas.
      fit: () => {
        if (!userTouchedViewport.current) fitToContent();
      },
      isCancelled: () => scenarioToken.current !== myToken,
    };

    try {
      await fn(api);
    } catch (err) {
      if ((err as Error)?.message !== "CANCELLED") {
        console.error("Scenario error:", err);
      }
    } finally {
      if (scenarioToken.current === myToken) {
        scenarioPlaying.current = false;
      }
    }
  }, [clearCanvas, fitToContent, runCell]);

  const isScenarioPlaying = useCallback(() => scenarioPlaying.current, []);

  const ctxVal = useMemo<StoreCtx>(() => ({
    state,
    moveCell, setCellPos, resizeCell, bringToFront, select, updateCode, detachOutput, deleteCell, addCell,
    moveEnv, resizeEnv, forkEnvironment, deleteEnv, assignCellToEnv,
    runCell, runPipeline,
    pan, zoomAt, setViewport, getScale,
    addChat, sendUserPrompt,
    clearCanvas, fitToContent, runScenario, isScenarioPlaying,
    newId: id,
  }), [state, moveCell, setCellPos, resizeCell, bringToFront, select, updateCode, detachOutput, deleteCell, addCell, moveEnv, resizeEnv, forkEnvironment, deleteEnv, assignCellToEnv, runCell, runPipeline, pan, zoomAt, setViewport, getScale, addChat, sendUserPrompt, clearCanvas, fitToContent, runScenario, isScenarioPlaying]);

  return <StoreContext.Provider value={ctxVal}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

function pickNextColor(envs: Record<string, Environment>): EnvColor {
  const used = new Set(Object.values(envs).map((e) => e.color));
  const palette: EnvColor[] = ["purple", "blue", "pink", "green", "orange"];
  return palette.find((c) => !used.has(c)) ?? "pink";
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
