import type { OwnerTx } from "@/lib/actions";
import type { WalletDriver } from "@/lib/wallet";

export const FAKE_HASH = "8pDqvWm5DPGbxQoVZRqTiyvqMxgSj2mGbjJVhQwsWPZe";
export const okOutcome = (hash = FAKE_HASH) => ({
  status: { SuccessValue: "" },
  transaction: { hash },
  transaction_outcome: { id: hash },
  receipts_outcome: [],
});

// In-memory WalletDriver for jsdom tests: records every tx, never touches a network.
export class FakeWallet implements WalletDriver {
  account: string | null;
  connectAs: string | null;
  sent: OwnerTx[] = [];
  calls = { connect: 0, disconnect: 0 };
  sendImpl: (tx: OwnerTx) => Promise<unknown> = async () => okOutcome();
  connectImpl: () => Promise<string | null> = async () => this.connectAs;
  private listeners = new Set<(id: string | null) => void>();

  constructor({ account = null, connectAs = "lineage-aditya.testnet" }: { account?: string | null; connectAs?: string | null } = {}) {
    this.account = account;
    this.connectAs = connectAs;
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  restore = async (): Promise<string | null> => this.account;

  connect = async (): Promise<string | null> => {
    this.calls.connect++;
    const id = await this.connectImpl();
    this.emit(id);
    return id;
  };

  disconnect = async (): Promise<void> => {
    this.calls.disconnect++;
    this.emit(null);
  };

  send = (tx: OwnerTx): Promise<unknown> => {
    this.sent.push(tx);
    return this.sendImpl(tx);
  };

  onAccountChange = (cb: (id: string | null) => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  emit(id: string | null): void {
    this.account = id;
    for (const cb of this.listeners) cb(id);
  }

  // The next send stays pending until the test settles it.
  defer(): { resolve: (v: unknown) => void; reject: (e: unknown) => void } {
    let resolve!: (v: unknown) => void;
    let reject!: (e: unknown) => void;
    const pending = new Promise<unknown>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.sendImpl = () => pending;
    return { resolve, reject };
  }
}
