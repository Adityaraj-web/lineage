import { OverviewScreen } from "@/components/screens/OverviewScreen";
import { PageTransition } from "@/components/transitions";

export default function OverviewPage() {
  return (
    <PageTransition>
      <OverviewScreen />
    </PageTransition>
  );
}
