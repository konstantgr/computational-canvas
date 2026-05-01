import type { EnvColor } from "./types";

export function clsx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export const ENV_COLOR_MAP: Record<EnvColor, { hex: string; soft: string; chip: string; ring: string; tag: string }> = {
  orange: {
    hex: "#ea580c",
    soft: "rgba(234,88,12,0.06)",
    chip: "bg-orange-50 text-orange-700 border-orange-200",
    ring: "ring-orange-300/60",
    tag: "Orange",
  },
  purple: {
    hex: "#9333ea",
    soft: "rgba(147,51,234,0.06)",
    chip: "bg-purple-50 text-purple-700 border-purple-200",
    ring: "ring-purple-300/60",
    tag: "AI",
  },
  blue: {
    hex: "#0284c7",
    soft: "rgba(2,132,199,0.06)",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
    ring: "ring-sky-300/60",
    tag: "Explore",
  },
  pink: {
    hex: "#db2777",
    soft: "rgba(219,39,119,0.06)",
    chip: "bg-pink-50 text-pink-700 border-pink-200",
    ring: "ring-pink-300/60",
    tag: "Side",
  },
  green: {
    hex: "#16a34a",
    soft: "rgba(22,163,74,0.06)",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ring: "ring-emerald-300/60",
    tag: "Try",
  },
};

export function envClass(color: EnvColor): string {
  switch (color) {
    case "orange":
      return "env-orange";
    case "purple":
      return "env-purple";
    case "blue":
      return "env-blue";
    case "pink":
      return "env-pink";
    case "green":
      return "env-green";
  }
}

export function fmt(n: number, frac = 4): string {
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(frac)).toString();
}
