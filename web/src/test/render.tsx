import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createLiveStore, LiveStoreContext, type LiveStore } from "@/hooks/live-store";

// Renders inside the same providers as the app (minus MotionConfig: animations are skipped in tests).
export function renderUI(ui: ReactElement, store: LiveStore = createLiveStore()): RenderResult & { store: LiveStore } {
  const result = render(
    <LiveStoreContext.Provider value={store}>
      <TooltipProvider>{ui}</TooltipProvider>
    </LiveStoreContext.Provider>,
  );
  return { ...result, store };
}
