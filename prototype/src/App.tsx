import { Canvas } from "./components/Canvas";
import { ChatPanel } from "./components/ChatPanel";
import { Onboarding } from "./components/Onboarding";
import { HelpHints, Toolbar } from "./components/Toolbar";
import { StoreProvider } from "./store";

export default function App() {
  return (
    <StoreProvider>
      <div className="relative flex h-screen w-screen overflow-hidden bg-white text-paper-900">
        <div className="relative flex-1">
          <Canvas />
          <HelpHints />
          <Toolbar />
        </div>
        <ChatPanel />
        <Onboarding />
      </div>
    </StoreProvider>
  );
}
