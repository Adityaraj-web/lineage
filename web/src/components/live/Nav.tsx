"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/cn";
import { LiveIndicator } from "./LiveIndicator";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/vault/vault", label: "Lineage vault", short: "Lineage" },
  { href: "/vault/guarded", label: "LimitsOnly vault", short: "LimitsOnly" },
  { href: "/compare", label: "Compare" },
] as const;

const norm = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);

export function LineageMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path d="M3 5c6 0 8 7 18 7" stroke="var(--color-p1)" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 12h18" stroke="var(--color-p2)" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 19c5 0 7-4 10-6" stroke="var(--color-p3)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Nav() {
  const path = norm(usePathname() ?? "/");
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[rgb(7_8_10/0.6)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 md:h-16 md:flex-nowrap md:py-0 md:px-10">
        <Link href="/" className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2">
          <LineageMark className="size-5" />
          <span className="text-[1.125rem] leading-none font-semibold">Lineage</span>
        </Link>
        <span className="inline-flex items-center gap-1.5 text-micro text-muted-foreground">
          testnet
        </span>
        <div className="ml-auto md:order-last">
          <LiveIndicator />
        </div>
        <nav aria-label="Main" className="-mx-1 w-full overflow-x-auto md:mx-0 md:w-auto">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => {
              const active = path === l.href;
              return (
                <li key={l.href} className="relative">
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2.5 py-2 text-small sm:px-3 whitespace-nowrap transition-colors outline-none focus-visible:ring-2",
                      active ? "text-foreground" : "text-muted-foreground hover-fine:text-foreground",
                    )}
                  >
                    {"short" in l ? (
                      <>
                        <span aria-hidden="true" className="sm:hidden">
                          {l.short}
                        </span>
                        <span className="max-sm:sr-only">{l.label}</span>
                      </>
                    ) : (
                      l.label
                    )}
                  </Link>
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-x-2.5 -bottom-px sm:inset-x-3 h-px bg-gradient-to-r from-p1 via-p2 to-p3"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
