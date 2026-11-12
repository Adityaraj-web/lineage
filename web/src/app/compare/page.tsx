import type { Metadata } from "next";
import { CompareScreen } from "@/components/screens/CompareScreen";
import { PageTransition } from "@/components/transitions";

export const metadata: Metadata = { title: "Compare" };

export default function ComparePage() {
  return (
    <PageTransition>
      <div className="flex flex-col gap-10 pt-14 md:pt-20">
        <h1 className="font-serif text-display">One poisoned invoice</h1>
        <CompareScreen />
      </div>
    </PageTransition>
  );
}
