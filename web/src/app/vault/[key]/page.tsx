import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VaultScreen } from "@/components/screens/VaultScreen";
import { PageTransition } from "@/components/transitions";
import { VAULT_KEYS, type VaultKey } from "@/lib/config";

export const dynamicParams = false;

export function generateStaticParams() {
  return VAULT_KEYS.map((key) => ({ key }));
}

const TITLES: Record<VaultKey, string> = { vault: "Lineage vault", guarded: "LimitsOnly vault" };
type Props = { params: Promise<{ key: string }> };

const isKey = (k: string): k is VaultKey => (VAULT_KEYS as readonly string[]).includes(k);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  return { title: isKey(key) ? TITLES[key] : "Vault" };
}

export default async function VaultPage({ params }: Props) {
  const { key } = await params;
  if (!isKey(key)) notFound();
  return (
    <PageTransition key={key}>
      <VaultScreen vaultKey={key} />
    </PageTransition>
  );
}
