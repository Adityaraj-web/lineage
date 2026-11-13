"use client";

import { MotionConfig } from "motion/react";
import { useState } from "react";
import { SmoothScroll } from "@/components/SmoothScroll";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createLiveStore, LiveStoreContext } from "@/hooks/live-store";
import { WalletProvider } from "./wallet/WalletProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [store] = useState(createLiveStore);
  return (
    <MotionConfig reducedMotion="user">
      <LiveStoreContext.Provider value={store}>
        <WalletProvider>
          <TooltipProvider delayDuration={150}>
            <SmoothScroll>{children}</SmoothScroll>
          </TooltipProvider>
        </WalletProvider>
      </LiveStoreContext.Provider>
    </MotionConfig>
  );
}
