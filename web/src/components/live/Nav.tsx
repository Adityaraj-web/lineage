"use client";

import { Menu, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Popover } from "radix-ui";
import { useState } from "react";
import { cn } from "@/components/cn";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/vault/vault", label: "Lineage vault" },
  { href: "/vault/guarded", label: "LimitsOnly vault" },
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

function MobileMenu({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="press inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 text-small text-foreground hover-fine:bg-white/[0.06] lg:hidden"
        aria-label="Menu"
      >
        {open ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
        <span aria-hidden="true" className="max-[419px]:hidden">Menu</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          collisionPadding={16}
          className="z-50 w-[min(18rem,calc(100vw-2rem))] origin-[var(--radix-popover-content-transform-origin)] rounded-xl border border-hairline bg-raised-2 p-1.5 shadow-2xl shadow-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-150"
        >
          <nav aria-label="Pages">
            <ul className="flex flex-col">
              {LINKS.map((l) => {
                const active = path === l.href;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-lg px-3 text-body",
                        active ? "text-foreground" : "text-muted-foreground hover-fine:bg-white/[0.05] hover-fine:text-foreground",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("h-px w-3 rounded-full", active ? "bg-foreground" : "bg-transparent")}
                      />
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function Nav() {
  const path = norm(usePathname() ?? "/");
  return (
    <header
      style={{ viewTransitionName: "site-header" }}
      className="sticky top-0 z-40 h-16 bg-[rgb(10_13_20/0.82)] shadow-[0_1px_0_var(--hairline)]"
    >
      <div className="mx-auto flex h-full max-w-[75rem] items-center gap-3 px-5 sm:gap-6 md:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md">
          <LineageMark className="size-5" />
          <span className="text-[1.125rem] leading-none font-semibold">Lineage</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden h-full lg:block">
          <ul className="flex h-full items-center gap-1">
            {LINKS.map((l) => {
              const active = path === l.href;
              return (
                <li key={l.href} className="relative flex h-full items-center">
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-md px-3 py-2 text-small whitespace-nowrap transition-colors duration-150",
                      active ? "text-foreground" : "text-muted-foreground hover-fine:text-foreground",
                    )}
                  >
                    {l.label}
                  </Link>
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      aria-hidden="true"
                      className="absolute inset-x-3 bottom-0 h-[1.5px] rounded-full bg-foreground shadow-[0_0_8px_rgb(236_238_243/0.5)]"
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center lg:hidden">
          <MobileMenu path={path} />
        </div>
      </div>
    </header>
  );
}
