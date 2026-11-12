import type { Metadata } from "next";
import { Backdrop } from "@/components/backdrop/Backdrop";
import { Nav } from "@/components/live/Nav";
import { Providers } from "@/components/Providers";
import { instrumentSerif, jakarta, jetbrains } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lineage — provenance you can see", template: "%s — Lineage" },
  description:
    "Prepared statements for money: a NEAR vault for AI agents that checks where a payee came from before it pays. Live testnet dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${jakarta.variable} ${jetbrains.variable} ${instrumentSerif.variable}`}
    >
      <body>
        <Providers>
          <Backdrop />
          <Nav />
          <main className="relative z-10 mx-auto w-full max-w-[75rem] px-5 pb-24 md:px-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
