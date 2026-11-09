import { useMemo } from "react";
import type { Candle } from "../api/types";
import { formatTicks, formatUtcTime } from "../lib/format";

interface Props {
  candles: Candle[];
  priceScale: number;
  label: string;
  /** Candles with seq > this index were revealed by the last round (shaded). */
  decisionIndex?: number;
  maxVisible?: number;
}

const W = 1000; // SVG user units; the SVG scales to its container width
const H = 420;
const PAD = { top: 16, right: 80, bottom: 28, left: 8 };
const GRID_LINES = 5;

/**
 * Minimal SVG candlestick chart. It only draws what the server sent:
 * there is no data here beyond the server's replay clock.
 */
export function CandleChart({ candles, priceScale, label, decisionIndex, maxVisible = 180 }: Props) {
  const view = useMemo(() => candles.slice(-maxVisible), [candles, maxVisible]);

  const geometry = useMemo(() => {
    if (view.length === 0) return null;
    let hi = -Infinity;
    let lo = Infinity;
    for (const c of view) {
      hi = Math.max(hi, c.h);
      lo = Math.min(lo, c.l);
    }
    const pad = Math.max(1, Math.round((hi - lo) * 0.05));
    hi += pad;
    lo -= pad;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const step = plotW / view.length;
    const y = (p: number) => PAD.top + ((hi - p) / (hi - lo)) * plotH;
    const x = (i: number) => PAD.left + i * step + step / 2;
    return { hi, lo, step, x, y, plotW, plotH };
  }, [view]);

  if (!geometry) return <div className="chart chart-empty">No candles visible yet.</div>;
  const { hi, lo, step, x, y } = geometry;
  const bodyW = Math.max(1, step * 0.65);
  const first = view[0]!;
  const last = view[view.length - 1]!;
  const firstRevealed = decisionIndex === undefined ? -1 : view.findIndex((c) => c.seq > decisionIndex);

  const grid = Array.from({ length: GRID_LINES + 1 }, (_, i) => Math.round(lo + ((hi - lo) * i) / GRID_LINES));

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`${label} candlestick chart, last close ${formatTicks(last.c, priceScale)}`}>
        <text x={W / 2} y={H / 2} className="chart-watermark" textAnchor="middle">{label}</text>

        {firstRevealed >= 0 && (
          <rect className="chart-revealed" x={PAD.left + firstRevealed * step} y={PAD.top}
            width={(view.length - firstRevealed) * step} height={H - PAD.top - PAD.bottom} />
        )}

        {grid.map((p) => (
          <g key={p}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(p)} y2={y(p)} />
            <text className="chart-axis" x={W - PAD.right + 6} y={y(p) + 4}>{formatTicks(p, priceScale)}</text>
          </g>
        ))}

        {view.map((c, i) => {
          const up = c.c >= c.o;
          const top = y(Math.max(c.o, c.c));
          const bottom = y(Math.min(c.o, c.c));
          return (
            <g key={c.seq} className={up ? "candle-up" : "candle-down"}>
              <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} className="candle-wick" />
              <rect x={x(i) - bodyW / 2} y={top} width={bodyW} height={Math.max(1, bottom - top)} className="candle-body" />
            </g>
          );
        })}

        <line className="chart-last" x1={PAD.left} x2={W - PAD.right} y1={y(last.c)} y2={y(last.c)} />
        <text className="chart-last-label" x={W - PAD.right + 6} y={y(last.c) + 4}>{formatTicks(last.c, priceScale)}</text>

        <text className="chart-axis" x={PAD.left} y={H - 8}>{formatUtcTime(first.open_time)}</text>
        <text className="chart-axis" x={W - PAD.right} y={H - 8} textAnchor="end">{formatUtcTime(last.open_time)}</text>
      </svg>
    </div>
  );
}
