import { ProvenanceFlow } from "@/components/overview/ProvenanceFlow";
import { OverviewScreen } from "@/components/screens/OverviewScreen";

const LEGEND = [
  { code: "P1", label: "Signed by you", text: "A payee in a task mandate you signed. Paid within your caps.", chip: "bg-p1", tone: "text-p1-fg" },
  {
    code: "P2",
    label: "Resolved via registry",
    text: "A resolver you pinned returns the payee and price. The vault pays exactly that.",
    chip: "bg-p2",
    tone: "text-p2-fg",
  },
  {
    code: "P3",
    label: "Untrusted — needs you",
    text: "A raw address the agent read. Never paid automatically.",
    chip: "bg-p3",
    tone: "text-p3-fg",
  },
];

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-16 pt-14 md:gap-20 md:pt-20">
      <section aria-labelledby="hero-title">
        <p className="eyebrow">Lineage · a NEAR vault for AI agents · testnet</p>
        <h1 id="hero-title" className="mt-3 font-serif text-display">
          Prepared statements for <em>money</em>
        </h1>
        <div className="glass-blur mt-10 p-4 md:p-8">
          <ProvenanceFlow />
        </div>
        <p className="mt-8 max-w-3xl font-serif text-[1.625rem] leading-snug md:text-[2rem]">
          The vault checks <em>where a payee came from</em> before it pays.
        </p>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {LEGEND.map((l) => (
            <li key={l.code} className="flex gap-3">
              <span className={`mt-0.5 h-5 shrink-0 rounded-full px-1.5 font-mono text-[10.5px] leading-5 font-semibold text-[#07080a] ${l.chip}`}>
                {l.code}
              </span>
              <p className="text-small">
                <span className={`font-medium ${l.tone}`}>{l.label}.</span>{" "}
                <span className="text-muted-foreground">{l.text}</span>
              </p>
            </li>
          ))}
        </ul>
      </section>
      <OverviewScreen />
    </div>
  );
}
