import Link from "next/link";

export default function NotFound() {
  return (
    <section className="pt-24">
      <p className="label">404</p>
      <h1 className="mt-3 font-serif text-title">
        No such page
      </h1>
      <p className="mt-4 text-muted-foreground">
        The dashboard has an overview, two vaults and a comparison.{" "}
        <Link href="/" className="text-foreground underline underline-offset-4">
          Back to the overview
        </Link>
        .
      </p>
    </section>
  );
}
