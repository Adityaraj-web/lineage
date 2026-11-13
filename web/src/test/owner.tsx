import { useState, type ReactNode } from "react";
import { VaultDashboard } from "@/components/vault/VaultDashboard";
import { useOwnerAction, type OwnerAction } from "@/components/wallet/useOwnerAction";
import type { FakeWallet } from "@/components/wallet/test-wallet";
import { DEMO_RUN_SNAPSHOT, NOW, ROOT } from "@/lib/test-fixtures";
import type { VaultView } from "@/lib/views";

// Binds a real useOwnerAction to a FakeWallet for component tests.
export function WithOwnerAction({ fake, refresh = () => {}, children }: { fake: FakeWallet; refresh?: () => void; children: (a: OwnerAction) => ReactNode }) {
  const action = useOwnerAction(fake.send, refresh);
  return <>{children(action)}</>;
}

// The owner's dashboard with a view the test can replace, the way a poll refresh does.
export const live: { setView: (v: VaultView) => void } = { setView: () => {} };
export function OwnerDashboard({ initial, fake, refresh = () => {} }: { initial: VaultView; fake: FakeWallet; refresh?: () => void }) {
  const [view, setView] = useState(initial);
  live.setView = setView;
  const action = useOwnerAction(fake.send, refresh);
  return <VaultDashboard view={view} demoRun={DEMO_RUN_SNAPSHOT} now={NOW} wallet={{ role: "owner", accountId: ROOT, action }} />;
}
