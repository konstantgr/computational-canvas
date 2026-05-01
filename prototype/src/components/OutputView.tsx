import type { OutputKind } from "../types";
import { fmt } from "../utils";
import { BarChart, ScatterChart } from "./Plot";

interface Props {
  output: OutputKind;
}

export function OutputView({ output }: Props) {
  switch (output.type) {
    case "text":
      return (
        <pre className="scroll-thin h-full w-full overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-snug text-paper-800">
          {output.value || <span className="italic text-paper-400">no output</span>}
        </pre>
      );
    case "error":
      return (
        <pre className="scroll-thin h-full w-full overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-snug text-red-600">
          {output.value}
        </pre>
      );
    case "dataframe":
      return (
        <div className="flex h-full flex-col">
          <div className="scroll-thin flex-1 overflow-auto">
            <table className="w-full border-collapse text-[11px] font-mono">
              <thead>
                <tr>
                  {output.columns.map((c, i) => (
                    <th
                      key={`${c}-${i}`}
                      className="sticky top-0 border-b border-paper-300 bg-white px-2.5 py-1 text-left font-medium text-paper-500"
                    >
                      {c || ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {output.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td
                        key={j}
                        className="border-b border-paper-200 px-2.5 py-1 text-paper-800"
                      >
                        {typeof v === "number" ? fmt(v) : String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {output.meta && (
            <div className="mt-1 text-[10px] font-mono text-paper-400">{output.meta}</div>
          )}
        </div>
      );
    case "histogram":
    case "bar":
      return (
        <BarChart
          bins={output.bins}
          color={output.color}
          title={output.title}
          variant={output.type === "histogram" ? "histogram" : "bar"}
        />
      );
    case "scatter":
      return <ScatterChart points={output.points} color={output.color} title={output.title} />;
    case "image":
      return <img src={output.src} alt={output.alt ?? ""} className="h-full w-full rounded object-contain" />;
  }
}
