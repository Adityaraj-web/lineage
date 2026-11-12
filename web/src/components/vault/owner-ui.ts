// Shared classes for owner controls. Plain buttons, no glass: they sit inside an existing panel.
const BASE =
  "press inline-flex min-h-11 items-center justify-center rounded-full px-5 text-small font-medium outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-55 max-md:w-full";
export const BTN = {
  primary: `${BASE} bg-foreground text-background hover-fine:bg-white`,
  secondary: `${BASE} border border-white/15 text-foreground hover-fine:bg-white/[0.06]`,
  attacker: `${BASE} border border-attacker-ring text-attacker hover-fine:bg-attacker-soft`,
  quiet: `${BASE} text-muted-foreground hover-fine:text-foreground`,
} as const;
export const WAITING = "Waiting for your wallet…";
