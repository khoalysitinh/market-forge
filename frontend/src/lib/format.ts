// Prices arrive as integer ticks plus a price_scale (ticks / 10^scale).
// Formatting is done with integer math so the display matches the server
// exactly — no floating-point rounding surprises.

export function formatTicks(ticks: number, scale: number): string {
  if (!Number.isInteger(ticks) || !Number.isInteger(scale) || scale < 0) return "—";
  const negative = ticks < 0;
  const abs = Math.abs(ticks);
  if (scale === 0) return (negative ? "-" : "") + abs.toString();
  const s = abs.toString().padStart(scale + 1, "0");
  const whole = s.slice(0, s.length - scale);
  const frac = s.slice(s.length - scale);
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function formatSignedTicks(ticks: number, scale: number): string {
  const s = formatTicks(ticks, scale);
  return ticks > 0 ? `+${s}` : s;
}

/** UTC time as HH:MM (the dataset clock is always UTC). */
export function formatUtcTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(11, 16) + " UTC";
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
