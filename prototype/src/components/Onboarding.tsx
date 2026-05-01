import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, GitBranch, MessageSquare, X, ArrowRight, Workflow } from "lucide-react";

const STEPS = [
  {
    icon: <LayoutGrid className="h-5 w-5" />,
    title: "A 2D canvas, not a list",
    body: "Code, outputs, plots and dataframes can be placed anywhere. Drag the cells to rearrange. Pan with the background, zoom with ⌘ + scroll.",
  },
  {
    icon: <Workflow className="h-5 w-5" />,
    title: "Main runtime is a pipeline",
    body: "Cells in the main runtime live freely on the canvas — but the ones you mark as a pipeline are connected by arrows in execution order. Press the Pipeline button on the first step to run them all in sequence.",
  },
  {
    icon: <GitBranch className="h-5 w-5" />,
    title: "Forks for safe experiments",
    body: "Coloured regions are separate runtimes forked from main. Mutate, break, throw away — the main pipeline stays intact.",
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Human–AI interaction",
    body: "Ask the assistant on the right to do something. It spawns its own environment, writes code there, runs it, and shows you the result — no surprise edits to your main flow.",
  },
];

export function Onboarding() {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-paper-900/15 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ y: 12, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-[460px] max-w-[92vw] overflow-hidden rounded-2xl border border-paper-200 bg-white p-6 shadow-cellHover"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1 text-paper-500 transition-colors hover:bg-paper-100 hover:text-paper-900"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
              {STEPS[step].icon}
            </div>
            <h2 className="mt-4 text-xl font-semibold text-paper-900">{STEPS[step].title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-paper-600">{STEPS[step].body}</p>

            <div className="mt-6 flex items-center gap-2">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-paper-900" : "w-3 bg-paper-200 hover:bg-paper-300"}`}
                />
              ))}
              <div className="ml-auto flex items-center gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep((s) => s - 1)}
                    className="rounded-md border border-paper-300 bg-white px-3 py-1.5 text-sm text-paper-700 hover:bg-paper-100"
                  >
                    Back
                  </button>
                )}
                {step < STEPS.length - 1 ? (
                  <button
                    onClick={() => setStep((s) => s + 1)}
                    className="inline-flex items-center gap-1 rounded-md bg-paper-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-paper-800"
                  >
                    Next <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1 rounded-md bg-paper-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-paper-800"
                  >
                    Try it <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
