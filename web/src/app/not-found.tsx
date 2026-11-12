import Link from "next/link";

export default function NotFound() {
  return (
    <section className="pt-24">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-serif text-h1">
        No such <em>page</em>
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
