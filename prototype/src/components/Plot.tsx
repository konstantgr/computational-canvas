import { useMemo } from "react";

interface BarProps {
  bins: { label: string; value: number }[];
  color?: string;
  title?: string;
  variant?: "histogram" | "bar";
}

const DEFAULT_BAR = "#27272a";

export function BarChart({ bins, color = DEFAULT_BAR, title, variant = "bar" }: BarProps) {
  const max = useMemo(() => Math.max(1, ...bins.map((b) => b.value)), [bins]);

  return (
    <div className="flex h-full flex-col">
      {title && (
        <div className="mb-1 text-[11px] font-medium tracking-wide text-paper-700">
          {title}
        </div>
      )}
      <div className="relative flex-1">
        <svg viewBox="0 0 320 180" preserveAspectRatio="none" className="h-full w-full">
          {/* Subtle horizontal gridlines */}
          {[0.25, 0.5, 0.75, 1].map((y) => (
            <line
              key={y}
              x1={28}
              x2={310}
              y1={155 - y * 130}
              y2={155 - y * 130}
              stroke="#e4e4e7"
              strokeWidth={1}
            />
          ))}
          {/* Axis baseline */}
          <line x1={28} x2={310} y1={155} y2={155} stroke="#a1a1aa" strokeWidth={1} />
          {/* Y-ticks */}
          {[0, 0.5, 1].map((y) => (
            <text
              key={y}
              x={24}
              y={155 - y * 130 + 3}
              textAnchor="end"
              fontSize={9}
              fill="#71717a"
              fontFamily="JetBrains Mono, monospace"
            >
              {Math.round(max * y)}
            </text>
          ))}
          {/* Bars */}
          {bins.map((b, i) => {
            const colW = (310 - 36) / bins.length;
            const padding = variant === "histogram" ? 0 : 6;
            const x = 32 + i * colW + padding;
            const w = Math.max(1, colW - padding * 2);
            const h = (b.value / max) * 130;
            const y = 155 - h;
            return (
              <g key={`${b.label}-${i}`}>
                <rect x={x} y={y} width={w} height={h} fill={color} />
                <text
                  x={x + w / 2}
                  y={167}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#71717a"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {b.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

interface ScatterProps {
  points: { x: number; y: number }[];
  color?: string;
  title?: string;
}

export function ScatterChart({ points, color = DEFAULT_BAR, title }: ScatterProps) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sx = (x: number) => 28 + ((x - minX) / (maxX - minX || 1)) * (310 - 36);
  const sy = (y: number) => 155 - ((y - minY) / (maxY - minY || 1)) * 130;
  return (
    <div className="flex h-full flex-col">
      {title && (
        <div className="mb-1 text-[11px] font-medium tracking-wide text-paper-700">
          {title}
        </div>
      )}
      <svg viewBox="0 0 320 180" preserveAspectRatio="none" className="h-full w-full">
        {[0.25, 0.5, 0.75].map((y) => (
          <line
            key={y}
            x1={28}
            x2={310}
            y1={155 - y * 130}
            y2={155 - y * 130}
            stroke="#e4e4e7"
            strokeWidth={1}
          />
        ))}
        <line x1={28} x2={310} y1={155} y2={155} stroke="#a1a1aa" strokeWidth={1} />
        {points.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3} fill={color} fillOpacity={0.85} />
        ))}
      </svg>
    </div>
  );
}
