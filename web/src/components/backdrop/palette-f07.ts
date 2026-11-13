// Dev-only (?bg=old in `next dev`): the F07 palettes, verbatim, for the old/new comparison.
// Loaded through a dynamic import behind NODE_ENV, so it is not in the production export.
import { hex, type Mood, type RGB, type Resolved, type ResolvedBlob } from "./palette";

const INK = hex("#070A12");
const INDIGO = hex("#1A1F4D");
const TEAL = hex("#0E3B43");
const EMERALD = hex("#0D3F32");
const AMBER = hex("#3A2A0C");
const ROSE = hex("#4A1830");

const b = (c: RGB, x: number, y: number, r: number, s: number): ResolvedBlob => ({ c, x, y, r, s });

export const PALETTES_F07: Record<Mood, Resolved> = {
  overview: {
    ink: INK,
    blobs: [b(INDIGO, 0.08, 0.12, 0.36, 1.25), b(TEAL, 0.86, 0.5, 0.3, 1.15), b(INDIGO, 0.62, 0.95, 0.36, 1.1), b(EMERALD, 0.78, 0.02, 0.202, 0.8), b(AMBER, 0.12, 1.02, 0.216, 0.9)],
  },
  lineage: {
    ink: INK,
    blobs: [b(TEAL, 0.06, 0.1, 0.36, 1.3), b(EMERALD, 0.94, 0.28, 0.302, 1.1), b(TEAL, 0.6, 0.98, 0.346, 1.1), b(INDIGO, 0.3, 0.6, 0.274, 0.7), b(AMBER, 0.9, 1.02, 0.202, 0.8)],
  },
  limits: {
    ink: INK,
    blobs: [b(INDIGO, 0.06, 0.1, 0.36, 1.3), b(ROSE, 0.94, 0.3, 0.302, 1.0), b(INDIGO, 0.6, 0.98, 0.346, 1.1), b(ROSE, 0.2, 0.75, 0.216, 0.55), b(AMBER, 0.88, 1.02, 0.202, 0.8)],
  },
  compare: {
    ink: INK,
    blobs: [b(TEAL, 0.04, 0.2, 0.302, 1.3), b(TEAL, 0.14, 0.85, 0.274, 1.0), b(ROSE, 0.96, 0.2, 0.302, 1.0), b(ROSE, 0.86, 0.85, 0.274, 0.85), b(AMBER, 0.5, 1.06, 0.187, 0.7)],
  },
};
