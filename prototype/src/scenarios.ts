import type { Cell, CodeCell, EnvColor, Position, Size } from "./types";

export type ScenarioName =
  | "Plot Pclass distribution"
  | "Plot Age histogram"
  | "Describe the dataset"
  | "Train a quick classifier";

export interface ScenarioApi {
  addChat: (msg: { role: "user" | "ai"; text: string; envId?: string }) => void;
  addCell: (cell: Cell) => void;
  runCell: (id: string) => Promise<void>;
  forkEnvironment: (
    parentId: string,
    near?: Position,
    color?: EnvColor,
    name?: string,
  ) => string;
  fitEnvToCells: (envId: string, padding?: number) => void;
  resizeEnv: (envId: string, size: Size) => void;
  updateCode: (cellId: string, code: string) => void;
  bringToFront: (cellId: string) => void;
  setAgentFocus: (cellId?: string) => void;
  newId: (prefix: string) => string;
  fit: () => void;
  isCancelled: () => boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function step(api: ScenarioApi, ms: number) {
  await sleep(ms);
  if (api.isCancelled()) throw new Error("CANCELLED");
}

const MAIN_PIPE = "pipe_main";

interface CodeOpts {
  envId: string;
  code: string;
  position: Position;
  size?: { w: number; h: number };
  pipelineId?: string;
  pipelineOrder?: number;
  authoredBy?: "user" | "ai";
}

function makeCodeCell(api: ScenarioApi, opts: CodeOpts): CodeCell {
  return {
    id: api.newId("c"),
    kind: "code",
    language: "python",
    code: opts.code,
    envId: opts.envId,
    z: 1,
    status: "idle",
    position: opts.position,
    size: opts.size ?? { w: 360, h: 110 },
    pipelineId: opts.pipelineId,
    pipelineOrder: opts.pipelineOrder,
    authoredBy: opts.authoredBy,
  };
}

// ----- Layout helpers -----
// Auto-generated output cells live below their parent code cell at
//   y_output = code.y + code.h + 16, with height ~200.
// To stack the next pipeline cell cleanly, we need to clear that block.
const OUTPUT_OFFSET = 16;
const OUTPUT_HEIGHT = 200;
const PIPELINE_GAP = 28;

function nextPipelineY(prev: { position: Position; size: Size }, hasOutput = true): number {
  const blockBottom = prev.position.y + prev.size.h + (hasOutput ? OUTPUT_OFFSET + OUTPUT_HEIGHT : 0);
  return blockBottom + PIPELINE_GAP;
}

// ----- Reusable openings -----
async function loadDataset(
  api: ScenarioApi,
  pipelineOrder = 1,
): Promise<CodeCell> {
  const cell = makeCodeCell(api, {
    envId: "env_main",
    code: "import pandas as pd\ndf = pd.read_csv('data/titanic.csv')\ndf.head()",
    position: { x: 120, y: 120 },
    size: { w: 360, h: 130 },
    pipelineId: MAIN_PIPE,
    pipelineOrder,
  });
  api.addCell(cell);
  api.setAgentFocus(cell.id);
  api.fit();
  await step(api, 450);
  await api.runCell(cell.id);
  return cell;
}

// Add a code cell at an absolute position inside a fork, run it, fit env.
// Used for the multi-cell scattered layouts the agent builds in side envs —
// the deliberately non-grid placement showcases that the canvas is 2D, not
// a list.
async function addAndRunAt(
  api: ScenarioApi,
  envId: string,
  position: Position,
  code: string,
  size: Size = { w: 380, h: 110 },
): Promise<CodeCell> {
  const cell = makeCodeCell(api, {
    envId,
    code,
    position,
    size,
    authoredBy: "ai",
  });
  api.addCell(cell);
  api.setAgentFocus(cell.id);
  api.fitEnvToCells(envId);
  api.fit();
  await step(api, 350);
  await api.runCell(cell.id);
  api.fitEnvToCells(envId);
  return cell;
}

// Edit a cell's code, briefly highlight by bringing to front, then re-run.
async function refineAndRerun(
  api: ScenarioApi,
  envId: string,
  cell: CodeCell,
  newCode: string,
) {
  api.bringToFront(cell.id);
  api.setAgentFocus(cell.id);
  await step(api, 250);
  api.updateCode(cell.id, newCode);
  await step(api, 700); // let the user see the code change
  await api.runCell(cell.id);
  api.fitEnvToCells(envId);
}

// ----- Scenarios -----
export const SCENARIOS: Record<ScenarioName, (api: ScenarioApi) => Promise<void>> = {
  "Plot Pclass distribution": async (api) => {
    api.addChat({ role: "user", text: "Plot Pclass distribution" });
    await step(api, 500);
    api.addChat({
      role: "ai",
      text: "Sure — let me load the Titanic dataset first so we have something to plot.",
    });
    await step(api, 700);

    const load = await loadDataset(api);
    await step(api, 700);

    api.addChat({
      role: "ai",
      text: "Got 891 rows. Forking a side environment so I can poke at the plot without touching your main runtime.",
    });
    await step(api, 700);

    const envX = load.position.x + load.size.w + 220;
    const envId = api.forkEnvironment(
      "env_main",
      { x: envX, y: 80 },
      "pink",
      "AI · Plot Pclass",
    );
    api.fit();
    await step(api, 500);

    api.addChat({
      role: "ai",
      text: "Building three quick cells side-by-side: the plot, summary stats, and a head() preview. I'll scatter them around the canvas — easier to see at a glance than a single column.",
      envId,
    });
    await step(api, 500);

    // 2D layout: focal plot top-left, summary top-right (offset down a touch),
    // preview bottom-left (offset right). The deliberate non-grid placement
    // shows that cells are free-form, not a sequential list.
    const plot = await addAndRunAt(
      api,
      envId,
      { x: envX + 40, y: 150 },
      "import matplotlib.pyplot as plt\ndf['Pclass'].hist()",
      { w: 360, h: 110 },
    );
    await step(api, 500);

    await addAndRunAt(
      api,
      envId,
      { x: envX + 460, y: 180 },
      "df.describe()",
      { w: 360, h: 80 },
    );
    await step(api, 500);

    await addAndRunAt(
      api,
      envId,
      { x: envX + 100, y: 510 },
      "df.head()",
      { w: 380, h: 90 },
    );
    api.fit();
    await step(api, 800);

    api.addChat({
      role: "ai",
      text: "Initial pass: heavy 3rd-class skew (491 / 184 / 216). The describe() shows mean Pclass = 2.31, confirming that. Let me sanity-check by re-plotting only female passengers — I want to see if the class mix differs by sex.",
      envId,
    });
    await step(api, 1000);

    await refineAndRerun(
      api,
      envId,
      plot,
      "import matplotlib.pyplot as plt\ndf[df['Sex']=='female']['Pclass'].hist()",
    );
    await step(api, 700);
    api.fit();

    api.addChat({
      role: "ai",
      text: "Big shift: among women the split is 144 / 76 / 94 — class 3 still leads but much less dominantly, and 1st-class women now outnumber 2nd. That tracks with Titanic's known skew (1st-class women had higher survival).",
      envId,
    });
  },

  "Plot Age histogram": async (api) => {
    api.addChat({ role: "user", text: "Plot Age histogram" });
    await step(api, 500);
    api.addChat({
      role: "ai",
      text: "On it. Loading data, then I'll explore Age in a fork.",
    });
    await step(api, 700);

    const load = await loadDataset(api);
    await step(api, 600);

    const envX = load.position.x + load.size.w + 220;
    const envId = api.forkEnvironment(
      "env_main",
      { x: envX, y: 80 },
      "green",
      "AI · Plot Age",
    );
    api.fit();
    await step(api, 500);

    api.addChat({
      role: "ai",
      text: "Three cells in the fork — I'll spread them out so I can compare the histogram against the describe() and head() side by side.",
      envId,
    });
    await step(api, 500);

    const plot = await addAndRunAt(
      api,
      envId,
      { x: envX + 40, y: 150 },
      "import matplotlib.pyplot as plt\ndf['Age'].hist()",
      { w: 360, h: 110 },
    );
    await step(api, 500);

    await addAndRunAt(
      api,
      envId,
      { x: envX + 460, y: 180 },
      "df.describe()",
      { w: 360, h: 80 },
    );
    await step(api, 500);

    await addAndRunAt(
      api,
      envId,
      { x: envX + 100, y: 510 },
      "df.head()",
      { w: 380, h: 90 },
    );
    api.fit();
    await step(api, 800);

    api.addChat({
      role: "ai",
      text: "First pass works but the histogram is coarse and silently includes NaN ages (describe shows count = 714 vs total 891 → 177 nulls). Let me drop the NaNs and use 20 bins for a sharper view.",
      envId,
    });
    await step(api, 1000);

    await refineAndRerun(
      api,
      envId,
      plot,
      "import matplotlib.pyplot as plt\nplt.hist(df['Age'].dropna(), bins=20)",
    );
    await step(api, 700);
    api.fit();

    api.addChat({
      role: "ai",
      text: "Much cleaner. Peak at 20-25 (138) and 25-30 (130). A small bump at 0-5 (children: 38) and a long tail past 60. Useful for survival modelling — children and seniors are likely outliers.",
      envId,
    });
  },

  "Describe the dataset": async (api) => {
    api.addChat({ role: "user", text: "Describe the dataset" });
    await step(api, 500);
    api.addChat({
      role: "ai",
      text: "I'll load it, then explore in a fork so I can iterate freely.",
    });
    await step(api, 700);

    const load = await loadDataset(api);
    await step(api, 700);

    const envX = load.position.x + load.size.w + 220;
    const envId = api.forkEnvironment(
      "env_main",
      { x: envX, y: 80 },
      "blue",
      "AI · Describe",
    );
    api.fit();
    await step(api, 500);

    api.addChat({
      role: "ai",
      text: "Dropping describe(), head(), and shape() at three different spots — they're independent checks so they don't need to live in a column.",
      envId,
    });
    await step(api, 500);

    const desc = await addAndRunAt(
      api,
      envId,
      { x: envX + 40, y: 150 },
      "df.describe()",
      { w: 360, h: 80 },
    );
    await step(api, 500);

    await addAndRunAt(
      api,
      envId,
      { x: envX + 460, y: 180 },
      "df.head()",
      { w: 380, h: 90 },
    );
    await step(api, 500);

    await addAndRunAt(
      api,
      envId,
      { x: envX + 100, y: 480 },
      "print(df.shape)",
      { w: 360, h: 80 },
    );
    api.fit();
    await step(api, 800);

    api.addChat({
      role: "ai",
      text: "Numeric summary is informative but it skips Sex and Embarked entirely. Let me re-run describe with include='all' to bring in the categoricals.",
      envId,
    });
    await step(api, 1000);

    await refineAndRerun(
      api,
      envId,
      desc,
      "df.describe(include='all')",
    );
    await step(api, 700);
    api.fit();

    api.addChat({
      role: "ai",
      text: "Now I can see: Sex has 2 unique values, top = male (577), Embarked has 3 with S as the mode (644). Combined with the numeric stats — survival ~38%, fare heavily right-skewed (max 512 vs median 14) — the strongest survival signals look like Sex, Pclass, Age, Fare.",
      envId,
    });
  },

  "Train a quick classifier": async (api) => {
    api.addChat({ role: "user", text: "Train a quick classifier" });
    await step(api, 500);
    api.addChat({
      role: "ai",
      text: "Will do. Load → feature prep in main pipeline → train Random Forest in a fork so the heavy lifting stays isolated.",
    });
    await step(api, 800);

    const load = await loadDataset(api);
    await step(api, 700);

    api.addChat({ role: "ai", text: "Building features. I'll nudge this cell a bit to the right of the loader — pipelines don't need to be perfectly aligned." });
    await step(api, 500);

    const prep = makeCodeCell(api, {
      envId: "env_main",
      code:
        "df['Sex'] = df['Sex'].map({'male': 0, 'female': 1})\ndf = df.dropna(subset=['Age'])\nX = df[['Pclass','Sex','Age','Fare']]\ny = df['Survived']",
      // Slight horizontal offset from the load cell to demonstrate that
      // pipeline cells can sit anywhere — the arrow simply curves diagonally.
      position: { x: 200, y: nextPipelineY(load) },
      size: { w: 360, h: 130 },
      pipelineId: MAIN_PIPE,
      pipelineOrder: 2,
    });
    api.addCell(prep);
    api.setAgentFocus(prep.id);
    api.fit();
    await step(api, 500);
    await api.runCell(prep.id);
    await step(api, 700);

    api.addChat({
      role: "ai",
      text: "Forking for training so I don't lock up your runtime.",
    });
    await step(api, 600);

    const envX = prep.position.x + prep.size.w + 260;
    const envId = api.forkEnvironment(
      "env_main",
      { x: envX, y: 80 },
      "purple",
      "AI · Train classifier",
    );
    api.fit();
    await step(api, 500);

    api.addChat({
      role: "ai",
      text: "Three cells in the fork — model on the left, the two diagnostics on the right and below. I want to see them all at once.",
      envId,
    });
    await step(api, 500);

    // Focal model cell — top-left
    const train = await addAndRunAt(
      api,
      envId,
      { x: envX + 40, y: 150 },
      "from sklearn.ensemble import RandomForestClassifier\nfrom sklearn.model_selection import cross_val_score\n\nmodel = RandomForestClassifier(n_estimators=50, random_state=42)\ncross_val_score(model, X, y, cv=3).mean()",
      { w: 440, h: 170 },
    );
    await step(api, 500);

    // Diagnostic 1 — top-right, slightly offset down
    await addAndRunAt(
      api,
      envId,
      { x: envX + 520, y: 180 },
      "print(df.shape)",
      { w: 340, h: 80 },
    );
    await step(api, 500);

    // Diagnostic 2 — bottom-left, offset right from the model cell
    await addAndRunAt(
      api,
      envId,
      { x: envX + 110, y: 580 },
      "print('Survival rate:', y.mean())",
      { w: 380, h: 80 },
    );
    api.fit();
    await step(api, 800);

    api.addChat({
      role: "ai",
      text: "Baseline: 3-fold CV at 0.776 with a tiny 50-tree forest. Targets are slightly unbalanced (38% positive). Let me bump n_estimators and add max_depth to see if the model is under- or over-fitting.",
      envId,
    });
    await step(api, 1000);

    await refineAndRerun(
      api,
      envId,
      train,
      "from sklearn.ensemble import RandomForestClassifier\nfrom sklearn.model_selection import cross_val_score\n\nmodel = RandomForestClassifier(n_estimators=500, max_depth=8, random_state=42)\ncross_val_score(model, X, y, cv=5).mean()",
    );
    await step(api, 700);
    api.fit();

    api.addChat({
      role: "ai",
      text: "Improved: 5-fold CV jumped from 0.776 → 0.831 with 500 trees and max_depth=8. The lower std (0.026 vs 0.052) tells me the model is now less variance-bound. Sex + Pclass dominate feature importance. Worth trying gradient boosting next?",
      envId,
    });
  },
};
