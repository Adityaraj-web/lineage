export function fmtUsdc(amount: string | bigint): string {
  const v = BigInt(amount);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}${frac ? "." + frac : ""} tUSDC`;
}

export function fmtAgo(ms: number, now: number): string {
  const d = now - ms;
  const abs = Math.abs(d);
  if (abs < 1000) return "just now";
  const [n, unit] =
    abs < 60_000
      ? [Math.floor(abs / 1000), "s"]
      : abs < 3_600_000
        ? [Math.floor(abs / 60_000), "min"]
        : abs < 86_400_000
          ? [Math.floor(abs / 3_600_000), "h"]
          : [Math.floor(abs / 86_400_000), "d"];
  return d >= 0 ? `${n} ${unit} ago` : `in ${n} ${unit}`;
}

export function fmtDate(ms: number): string {
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
