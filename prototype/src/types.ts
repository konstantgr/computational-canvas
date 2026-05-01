export type EnvColor = "orange" | "purple" | "blue" | "pink" | "green";

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export type OutputKind =
  | { type: "text"; value: string }
  | { type: "error"; value: string }
  | { type: "dataframe"; columns: string[]; rows: (string | number)[][]; meta?: string }
  | { type: "histogram"; title?: string; bins: { label: string; value: number }[]; color?: string }
  | { type: "bar"; title?: string; bins: { label: string; value: number }[]; color?: string }
  | { type: "scatter"; title?: string; points: { x: number; y: number }[]; color?: string }
  | { type: "image"; src: string; alt?: string };

export interface CellBase {
  id: string;
  position: Position;
  size: Size;
  envId: string; // which environment runtime owns this cell
  z: number;
}

export interface CodeCell extends CellBase {
  kind: "code";
  code: string;
  language: "python";
  status: "idle" | "running" | "ok" | "error";
  outputId?: string; // linked output cell id (live)
  executionCount?: number;
  authoredBy?: "user" | "ai";
  pipelineId?: string; // cells with same pipelineId form an ordered chain
  pipelineOrder?: number; // ascending integer within the pipeline
}

export interface OutputCell extends CellBase {
  kind: "output";
  parentId?: string; // linked code cell, undefined when detached
  detached: boolean;
  output: OutputKind;
  authoredBy?: "user" | "ai";
}

export interface MarkdownCell extends CellBase {
  kind: "markdown";
  text: string;
}

export type Cell = CodeCell | OutputCell | MarkdownCell;

export interface Environment {
  id: string;
  name: string;
  color: EnvColor;
  position: Position;
  size: Size;
  parentEnvId?: string; // forked from
  description?: string;
  isMain?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  envId?: string; // env created/used by AI to fulfil this turn
  createdAt: number;
}

export interface CanvasViewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export interface CanvasState {
  cells: Record<string, Cell>;
  environments: Record<string, Environment>;
  envOrder: string[];
  cellOrder: string[];
  viewport: CanvasViewport;
  selectedId?: string;
  zCounter: number;
  execCounter: number;
  chat: ChatMessage[];
  // Cell that the AI agent is currently focused on (creating, editing,
  // or running). Used by the floating agent marker to follow the work.
  agentFocusCellId?: string;
}
