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
export const INPUT =
  "w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-body text-foreground outline-none focus-visible:ring-2 disabled:opacity-60 aria-[invalid=true]:border-attacker-ring";
export const FIELD_ERROR = "text-small text-attacker";
// Small outlined pill: section asides and in-form secondary actions.
export const PILL =
  "press inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 px-4 text-small text-muted-foreground outline-none transition-colors duration-150 hover-fine:text-foreground focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-55";
