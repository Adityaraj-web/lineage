import type { ReactNode } from "react";
import { useOwnerAction, type OwnerAction } from "@/components/wallet/useOwnerAction";
import type { FakeWallet } from "@/components/wallet/test-wallet";

// Binds a real useOwnerAction to a FakeWallet for component tests.
export function WithOwnerAction({ fake, refresh = () => {}, children }: { fake: FakeWallet; refresh?: () => void; children: (a: OwnerAction) => ReactNode }) {
  const action = useOwnerAction(fake.send, refresh);
  return <>{children(action)}</>;
}
