import type { BadgeTone } from "@/lib/provenance";
import type { FindingTone, RiskLevel } from "@/lib/risk";

export type Accent = "p1" | "p2" | "p3" | "attacker" | "neutral";

export const badgeAccent: Record<BadgeTone, Accent> = {
  green: "p1",
  blue: "p2",
  amber: "p3",
  red: "attacker",
  grey: "neutral",
};

export const findingAccent: Record<FindingTone, Accent> = {
  danger: "attacker",
  warn: "p3",
  info: "p2",
  ok: "p1",
};

export const levelAccent: Record<RiskLevel, Accent> = { high: "attacker", medium: "p3", low: "p1" };

// Literal class strings so Tailwind sees them.
export const accentClass: Record<Accent, { text: string; soft: string; ring: string; solid: string; border: string }> = {
  p1: { text: "text-p1", soft: "bg-p1-soft", ring: "ring-p1-ring", solid: "bg-p1", border: "border-p1-ring" },
  p2: { text: "text-p2", soft: "bg-p2-soft", ring: "ring-p2-ring", solid: "bg-p2", border: "border-p2-ring" },
  p3: { text: "text-p3", soft: "bg-p3-soft", ring: "ring-p3-ring", solid: "bg-p3", border: "border-p3-ring" },
  attacker: {
    text: "text-attacker",
    soft: "bg-attacker-soft",
    ring: "ring-attacker-ring",
    solid: "bg-attacker",
    border: "border-attacker-ring",
  },
  neutral: {
    text: "text-neutral",
    soft: "bg-neutral-soft",
    ring: "ring-neutral-ring",
    solid: "bg-neutral",
    border: "border-neutral-ring",
  },
};

export const accentHex: Record<Accent, string> = {
  p1: "#34d399",
  p2: "#38bdf8",
  p3: "#fbbf24",
  attacker: "#fb7185",
  neutral: "#9aa3b5",
};
