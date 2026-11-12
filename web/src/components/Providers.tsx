"use client";

import { MotionConfig } from "motion/react";
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createLiveStore, LiveStoreContext } from "@/hooks/live-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [store] = useState(createLiveStore);
  return (
    <MotionConfig reducedMotion="user">
      <LiveStoreContext.Provider value={store}>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </LiveStoreContext.Provider>
    </MotionConfig>
  );
}
