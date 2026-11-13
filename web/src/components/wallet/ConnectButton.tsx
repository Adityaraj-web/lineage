"use client";

import { LogOut, Wallet } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { CANCELLED, walletErrorMessage } from "@/lib/tx";
import { AccountId } from "../AccountId";
import { Glass } from "../Glass";
import { useWallet } from "./WalletProvider";

const CHIP = "press inline-flex h-9 items-center gap-2 px-3.5 text-small text-foreground outline-none transition-colors duration-150 hover-fine:bg-white/[0.06] focus-visible:ring-2 disabled:opacity-60";

// Nav: Connect / account chip with a Disconnect menu. Hidden until the wallet library is ready, and
// for good if it can't load. The role is per vault and shown on the vault page, not here.
export function ConnectButton() {
  const { status, port } = useWallet();
  const [connecting, setConnecting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const connectRef = useRef<HTMLButtonElement>(null);
  const focusConnect = useRef(false);
  const accountId = port?.accountId ?? null;

  useEffect(() => {
    if (!accountId && focusConnect.current) {
      focusConnect.current = false;
      connectRef.current?.focus();
    }
  }, [accountId]);

  if (status !== "ready" || !port) return null;

  if (!accountId) {
    const connect = async () => {
      setConnecting(true);
      setFailed(false);
      try {
        await port.connect();
      } catch (e) {
        setFailed(walletErrorMessage(e) !== CANCELLED);
      } finally {
        setConnecting(false);
      }
    };
    return (
      <Glass as="button" tier="chip" type="button" ref={connectRef} disabled={connecting} onClick={connect} className={CHIP}>
        <Wallet className="size-3.5 text-muted-foreground" aria-hidden="true" />
        {connecting ? "Connecting…" : failed ? "Couldn't connect, try again" : "Connect wallet"}
      </Glass>
    );
  }

  const disconnect = async () => {
    focusConnect.current = true;
    setOpen(false);
    await port.disconnect();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Glass as="button" tier="chip" type="button" className={`${CHIP} max-w-[10.5rem] sm:max-w-[14rem]`}>
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-p1" />
          <span className="truncate font-mono text-[12.5px]">{accountId}</span>
        </Glass>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          collisionPadding={16}
          className="z-50 w-[min(18rem,calc(100vw-2rem))] origin-[var(--radix-popover-content-transform-origin)] rounded-xl border border-hairline bg-raised-2 p-1.5 shadow-2xl shadow-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-150"
        >
          <p className="px-3 pt-2 pb-3 text-small text-muted-foreground">
            Connected as
            <br />
            <AccountId id={accountId} className="text-[13px]" />
          </p>
          <button
            type="button"
            onClick={disconnect}
            className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-body text-foreground outline-none hover-fine:bg-white/[0.05] focus-visible:ring-2"
          >
            <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
            Disconnect
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
