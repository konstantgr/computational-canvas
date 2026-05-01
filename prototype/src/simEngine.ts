import type { OutputKind } from "./types";

// Each environment is a tiny key/value runtime. We don't actually execute
// Python — we pattern-match a small DSL to mimic common notebook operations.
export interface SimRuntime {
  vars: Record<string, unknown>;
}

export function newRuntime(seed?: Partial<SimRuntime>): SimRuntime {
  return { vars: { ...(seed?.vars ?? {}) } };
}

export function forkRuntime(rt: SimRuntime): SimRuntime {
  // Deep-ish clone for primitive demo data
  return { vars: JSON.parse(JSON.stringify(rt.vars)) };
}

const TITANIC = {
  columns: ["PassengerId", "Survived", "Pclass", "Name", "Sex", "Age", "Fare"],
  rows: [
    [1, 0, 3, "Braund, Mr. Owen H.", "male", 22, 7.25],
    [2, 1, 1, "Cumings, Mrs. John B.", "female", 38, 71.2833],
    [3, 1, 3, "Heikkinen, Miss. Laina", "female", 26, 7.925],
    [4, 1, 1, "Futrelle, Mrs. Jacques H.", "female", 35, 53.1],
    [5, 0, 3, "Allen, Mr. William H.", "male", 35, 8.05],
  ] as (string | number)[][],
  pclassDist: [
    { label: "1", value: 216 },
    { label: "2", value: 184 },
    { label: "3", value: 491 },
  ],
  fareHist: [
    { label: "0-10", value: 240 },
    { label: "10-20", value: 180 },
    { label: "20-40", value: 130 },
    { label: "40-80", value: 90 },
    { label: "80+", value: 60 },
  ],
  describe: {
    columns: ["count", "mean", "std", "min", "max"],
    rows: [
      ["891", "0.38", "0.49", "0", "1"], // Survived
      ["891", "2.31", "0.84", "1", "3"], // Pclass
      ["714", "29.7", "14.5", "0.42", "80"], // Age
      ["891", "32.20", "49.69", "0", "512.33"], // Fare
    ],
  },
};

function strip(s: string): string {
  return s.trim();
}

function makeDataFrame(): OutputKind {
  return {
    type: "dataframe",
    columns: TITANIC.columns,
    rows: TITANIC.rows,
    meta: "[891 rows x 12 columns]",
  };
}

export function execute(code: string, rt: SimRuntime): OutputKind {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length === 0) return { type: "text", value: "" };

  const lastLine = lines[lines.length - 1];
  const fullCode = lines.join("\n");

  // imports — don't really do anything but acknowledge them
  if (/^import\s+(numpy|pandas|matplotlib|seaborn|sklearn)/.test(fullCode) && lines.length === 1) {
    return { type: "text", value: "" };
  }
  if (/^from\s+\w+\s+import/.test(fullCode) && lines.length === 1) {
    return { type: "text", value: "" };
  }

  // Load titanic dataset
  if (/pd\.read_csv\([^)]*titanic/.test(fullCode)) {
    rt.vars["df"] = "TITANIC";
    if (/\.head\(/.test(lastLine)) return makeDataFrame();
    if (lastLine === "df" || lastLine.endsWith("df")) return makeDataFrame();
    return { type: "text", value: "" };
  }

  // df.head() / df
  if (/(^|\W)df\.head\(\)?$/.test(lastLine) || strip(lastLine) === "df") {
    if (rt.vars["df"]) return makeDataFrame();
    return { type: "error", value: "NameError: name 'df' is not defined" };
  }

  // df.columns
  if (/df\.columns/.test(lastLine)) {
    return {
      type: "text",
      value: `Index(['PassengerId', 'Survived', 'Pclass', 'Name', 'Sex', 'Age',
       'SibSp', 'Parch', 'Ticket', 'Fare', 'Cabin', 'Embarked'],
      dtype='object')`,
    };
  }

  // df.describe(include='all') — refined describe with categorical columns
  if (/df\.describe\([^)]*include\s*=\s*['"]all['"]/.test(fullCode)) {
    return {
      type: "dataframe",
      columns: ["", "Survived", "Pclass", "Sex", "Age", "Fare", "Embarked"],
      rows: [
        ["count", 891, 891, 891, 714, 891, 889],
        ["unique", "—", "—", 2, "—", "—", 3],
        ["top", "—", "—", "male", "—", "—", "S"],
        ["freq", "—", "—", 577, "—", "—", 644],
        ["mean", 0.3838, 2.3086, "—", 29.6991, 32.2042, "—"],
        ["std", 0.4866, 0.8361, "—", 14.5265, 49.6934, "—"],
        ["min", 0, 1, "—", 0.42, 0, "—"],
        ["max", 1, 3, "—", 80, 512.3292, "—"],
      ],
      meta: "summary statistics (all columns)",
    };
  }

  // df.describe()
  if (/df\.describe\(\)/.test(fullCode)) {
    return {
      type: "dataframe",
      columns: ["", "Survived", "Pclass", "Age", "Fare"],
      rows: [
        ["count", 891, 891, 714, 891],
        ["mean", 0.3838, 2.3086, 29.6991, 32.2042],
        ["std", 0.4866, 0.8361, 14.5265, 49.6934],
        ["min", 0, 1, 0.42, 0],
        ["25%", 0, 2, 20.125, 7.9104],
        ["50%", 0, 3, 28, 14.4542],
        ["75%", 1, 3, 38, 31],
        ["max", 1, 3, 80, 512.3292],
      ],
      meta: "summary statistics",
    };
  }

  // df.columns
  // (broader bare-expression handler is below; this gives a friendlier hit)

  // Sex-filtered Pclass plot, e.g. df[df['Sex']=='female']['Pclass'].hist()
  const sexFilterPclass = fullCode.match(
    /df\[df\[['"]?Sex['"]?\]\s*==\s*['"](male|female)['"]\]\[['"]?Pclass['"]?\]\.hist/,
  );
  if (sexFilterPclass) {
    const sex = sexFilterPclass[1];
    return {
      type: "bar",
      title: `Pclass distribution (${sex} only)`,
      bins: sex === "female"
        ? [
            { label: "1", value: 94 },
            { label: "2", value: 76 },
            { label: "3", value: 144 },
          ]
        : [
            { label: "1", value: 122 },
            { label: "2", value: 108 },
            { label: "3", value: 347 },
          ],
    };
  }

  // Age plot with explicit bins arg, e.g. plt.hist(df['Age'].dropna(), bins=20)
  const ageBinsMatch = fullCode.match(
    /(?:plt\.hist\(\s*df[^)]*['"]?Age['"]?[^)]*|df[^)]*['"]?Age['"]?[^)]*\.hist)\([^)]*bins\s*=\s*(\d+)/,
  );
  if (ageBinsMatch) {
    const bins = Number(ageBinsMatch[1]);
    if (bins >= 12) {
      return {
        type: "histogram",
        title: `Age distribution (${bins} bins, NaNs dropped)`,
        bins: [
          { label: "0-5", value: 38 },
          { label: "5-15", value: 56 },
          { label: "15-20", value: 86 },
          { label: "20-25", value: 138 },
          { label: "25-30", value: 130 },
          { label: "30-35", value: 88 },
          { label: "35-40", value: 67 },
          { label: "40-50", value: 78 },
          { label: "50-60", value: 42 },
          { label: "60-70", value: 18 },
          { label: "70+", value: 4 },
        ],
      };
    }
  }

  // Histogram: plt.hist(df.Pclass) / df.Pclass.hist() / df['Pclass'].hist()
  const histMatch = fullCode.match(
    /(?:plt\.hist\(\s*df\[?['"]?(\w+)['"]?\]?|df\[?['"]?(\w+)['"]?\]?\.hist|sns\.histplot\(\s*df\[?['"]?(\w+)['"]?\]?)/,
  );
  if (histMatch) {
    const col = histMatch[1] || histMatch[2] || histMatch[3];
    if (col && /pclass/i.test(col)) {
      return {
        type: "bar",
        title: "Pclass distribution",
        bins: TITANIC.pclassDist,
      };
    }
    if (col && /fare/i.test(col)) {
      return {
        type: "histogram",
        title: "Fare distribution",
        bins: TITANIC.fareHist,
      };
    }
    if (col && /age/i.test(col)) {
      return {
        type: "histogram",
        title: "Age distribution",
        bins: [
          { label: "0-10", value: 64 },
          { label: "10-20", value: 115 },
          { label: "20-30", value: 230 },
          { label: "30-40", value: 155 },
          { label: "40-50", value: 86 },
          { label: "50-60", value: 42 },
          { label: "60+", value: 22 },
        ],
      };
    }
  }

  // np.log(df.Fare) -> a small textual array
  if (/np\.log\(df\.Fare\)/.test(fullCode)) {
    return {
      type: "text",
      value: `0    2.110213
1    4.280593
2    2.070022
3    3.998534
4    2.082766
Name: Fare, dtype: float64`,
    };
  }

  // print(...) — handles multi-arg prints with nested function calls
  // e.g. print('Survival rate:', y.mean()) or print(df.shape)
  const printMatch = fullCode.match(/^\s*print\s*\((.*)\)\s*$/m);
  if (printMatch) {
    const args = splitTopLevelCommas(printMatch[1].trim());
    const out = args.map((a) => evalPrintArg(a.trim(), rt)).join(" ");
    return { type: "text", value: out };
  }

  // simple assignment x = number
  const assign = fullCode.match(/^(\w+)\s*=\s*(.+)$/);
  if (assign) {
    const name = assign[1];
    const valueStr = assign[2].trim();
    const num = Number(valueStr);
    rt.vars[name] = isNaN(num) ? valueStr : num;
    return { type: "text", value: "" };
  }

  // Bare expression: echo it back
  if (/^[A-Za-z_][\w\.\[\]'"]*$/.test(lastLine)) {
    if (lastLine in rt.vars) {
      return { type: "text", value: String(rt.vars[lastLine]) };
    }
  }

  // ML demo — accuracy varies with hyperparameters so refinement is visible.
  if (/RandomForestClassifier|model\.fit|cross_val_score/.test(fullCode)) {
    const nMatch = fullCode.match(/n_estimators\s*=\s*(\d+)/);
    const cvMatch = fullCode.match(/\bcv\s*=\s*(\d+)/);
    const depthMatch = fullCode.match(/max_depth\s*=\s*(\d+)/);
    const n = nMatch ? Number(nMatch[1]) : 100;
    const cv = cvMatch ? Number(cvMatch[1]) : 5;
    const hasDepth = depthMatch !== null;
    let mean = 0.812;
    let std = 0.034;
    if (n <= 50) {
      mean = 0.776;
      std = 0.052;
    } else if (n <= 200 && !hasDepth) {
      mean = 0.812;
      std = 0.034;
    } else {
      mean = 0.831;
      std = 0.026;
    }
    return {
      type: "text",
      value: `Mean ${cv}-fold CV accuracy: ${mean.toFixed(3)} (+/- ${std.toFixed(3)})`,
    };
  }

  // Fallback: pretend it ran
  return { type: "text", value: "" };
}

// Split a comma-separated list while respecting nested parens/brackets/braces,
// so "'Survival rate:', y.mean()" → ["'Survival rate:'", " y.mean()"].
function splitTopLevelCommas(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim().length > 0) parts.push(cur);
  return parts;
}

// Resolve a single print() argument to its rendered string.
// Handles string literals, a few common pandas/sklearn expressions used
// in the demo scenarios, and runtime variables.
function evalPrintArg(arg: string, rt: SimRuntime): string {
  const t = arg.trim();
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1);
  }
  if (/^df\.shape$/.test(t)) return "(891, 12)";
  if (/^X\.shape$/.test(t)) return "(714, 4)";
  if (/^y\.shape$/.test(t)) return "(714,)";
  if (/^y\.mean\(\)$/.test(t)) return "0.406";
  if (/^y\.value_counts\(\)$/.test(t)) return "0    424\n1    290";
  if (/^df\.columns$/.test(t)) {
    return "Index(['PassengerId','Survived','Pclass','Name','Sex','Age','SibSp','Parch','Ticket','Fare','Cabin','Embarked'])";
  }
  if (t in rt.vars) return String(rt.vars[t]);
  return t;
}
