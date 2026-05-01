import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, ChevronRight, ChevronLeft, Bot, User, GitBranch, Play } from "lucide-react";
import { useStore } from "../store";
import { ENV_COLOR_MAP, clsx } from "../utils";
import type { ScenarioName } from "../scenarios";

const SUGGESTIONS: ScenarioName[] = [
  "Plot Pclass distribution",
  "Plot Age histogram",
  "Describe the dataset",
  "Train a quick classifier",
];

export function ChatPanel() {
  const { state, sendUserPrompt, setViewport, runScenario } = useStore();
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");
  const [activeScenario, setActiveScenario] = useState<ScenarioName | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.chat.length, open]);

  const send = async (msg?: string) => {
    const value = (msg ?? text).trim();
    if (!value) return;
    setText("");
    await sendUserPrompt(value);
  };

  const playScenario = async (name: ScenarioName) => {
    setActiveScenario(name);
    try {
      await runScenario(name);
    } finally {
      setActiveScenario((curr) => (curr === name ? null : curr));
    }
  };

  const focusEnv = (envId: string) => {
    const env = state.environments[envId];
    if (!env) return;
    const target = {
      x: env.position.x + env.size.w / 2,
      y: env.position.y + env.size.h / 2,
    };
    const screenW = window.innerWidth - (open ? 360 : 0);
    const screenH = window.innerHeight;
    const scale = Math.min(0.95, Math.max(0.55, Math.min(screenW / (env.size.w + 200), screenH / (env.size.h + 200))));
    setViewport({
      scale,
      offsetX: screenW / 2 - target.x * scale,
      offsetY: screenH / 2 - target.y * scale,
    });
  };

  return (
    <motion.div
      initial={false}
      animate={{ width: open ? 360 : 48 }}
      transition={{ type: "spring", stiffness: 240, damping: 30 }}
      className="relative z-20 flex h-full flex-col border-l border-paper-200 bg-white"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 border-b border-paper-200 px-3 py-3 text-left transition-colors hover:bg-paper-100"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        {open && (
          <div className="flex-1">
            <div className="text-sm font-medium text-paper-900">AI Assistant</div>
            <div className="text-[10px] text-paper-500">Spawns isolated environments</div>
          </div>
        )}
        {open ? (
          <ChevronRight className="h-4 w-4 text-paper-500" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-paper-500" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col"
          >
            <div ref={scrollRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {state.chat.map((m) => (
                <ChatBubble
                  key={m.id}
                  role={m.role}
                  text={m.text}
                  envName={m.envId ? state.environments[m.envId]?.name : undefined}
                  envColor={m.envId ? state.environments[m.envId]?.color : undefined}
                  onFocusEnv={m.envId ? () => focusEnv(m.envId!) : undefined}
                />
              ))}
            </div>

            <div className="border-t border-paper-200 px-3 py-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-paper-500">
                  Try a demo
                </span>
                <span className="text-[10px] text-paper-400">replays the agent</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => {
                  const isActive = activeScenario === s;
                  return (
                    <button
                      key={s}
                      onClick={() => playScenario(s)}
                      title={isActive ? "Playing… click again to restart" : "Replay this demo on the canvas"}
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                        isActive
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-paper-300 bg-white text-paper-700 hover:border-paper-400 hover:bg-paper-100",
                      )}
                    >
                      <Play className={clsx("h-2.5 w-2.5", isActive && "animate-pulse")} />
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-paper-200 p-3"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask the assistant…"
                className="flex-1 rounded-md border border-paper-300 bg-white px-3 py-2 text-sm text-paper-900 placeholder:text-paper-400 focus:border-paper-500 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-paper-900 p-2 text-white transition-colors hover:bg-paper-800"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ChatBubble({
  role,
  text,
  envName,
  envColor,
  onFocusEnv,
}: {
  role: "user" | "ai";
  text: string;
  envName?: string;
  envColor?: keyof typeof ENV_COLOR_MAP;
  onFocusEnv?: () => void;
}) {
  const isUser = role === "user";
  const meta = envColor ? ENV_COLOR_MAP[envColor] : undefined;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={clsx("flex items-start gap-2", isUser && "flex-row-reverse")}
    >
      <div
        className={clsx(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          isUser
            ? "border border-zinc-300 bg-white text-zinc-700"
            : "bg-zinc-900 text-white",
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={clsx("max-w-[85%]", isUser && "text-right")}>
        <div
          className={clsx(
            "rounded-lg border px-3 py-2 text-[12px] leading-snug",
            isUser
              ? "border-paper-200 bg-paper-100 text-paper-900"
              : "border-paper-200 bg-white text-paper-900",
          )}
        >
          {text}
        </div>
        {envName && meta && (
          <button
            onClick={onFocusEnv}
            className={clsx(
              "mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors hover:bg-white",
              meta.chip,
            )}
            title="Focus this environment"
          >
            <GitBranch className="h-2.5 w-2.5" />
            {envName}
          </button>
        )}
      </div>
    </motion.div>
  );
}
