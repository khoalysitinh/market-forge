import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

type MarketKind = "Crypto" | "Forex" | "Equity";
type Market = {
  symbol: string;
  name: string;
  exchange: string;
  kind: MarketKind;
  category: "Perps" | "Spot" | "Forex";
  tvSymbol: string;
  price: string;
  change: string;
  volume: string;
};
const LOGO_BASE = "https://s3-symbol-logo.tradingview.com/";
const LOGOS: Record<string, string> = {
  BTC: "crypto/XTVCBTC.svg", ETH: "crypto/XTVCETH.svg", SOL: "crypto/XTVCSOL.svg",
  XRP: "crypto/XTVCXRP.svg", DOGE: "crypto/XTVCDOGE.svg", AVAX: "crypto/XTVCAVAX.svg",
  LINK: "crypto/XTVCLINK.svg", HYPE: "crypto/XTVCHYPEH.svg", NVDA: "nvidia.svg",
};
const FLAGS: Record<string, string> = { EUR: "EU", GBP: "GB", USD: "US", JPY: "JP", AUD: "AU", CAD: "CA", CHF: "CH" };
const MARKETS: Market[] = [
  { symbol: "BTC-USDC", name: "Bitcoin / USDC", exchange: "Hyperliquid", kind: "Crypto", category: "Perps", tvSymbol: "BINANCE:BTCUSDT", price: "67,842.10", change: "+2.38%", volume: "$1.82B" },
  { symbol: "ETH-USDC", name: "Ethereum / USDC", exchange: "Hyperliquid", kind: "Crypto", category: "Perps", tvSymbol: "BINANCE:ETHUSDT", price: "3,521.80", change: "+1.16%", volume: "$842.6M" },
  { symbol: "SOL-USDC", name: "Solana / USDC", exchange: "Hyperliquid", kind: "Crypto", category: "Perps", tvSymbol: "BINANCE:SOLUSDT", price: "182.46", change: "−0.72%", volume: "$386.2M" },
  { symbol: "XRP-USDC", name: "XRP / USDC", exchange: "Hyperliquid", kind: "Crypto", category: "Perps", tvSymbol: "BINANCE:XRPUSDT", price: "0.6241", change: "+0.48%", volume: "$218.4M" },
  { symbol: "DOGE-USDC", name: "Dogecoin / USDC", exchange: "Hyperliquid", kind: "Crypto", category: "Perps", tvSymbol: "BINANCE:DOGEUSDT", price: "0.1682", change: "−1.25%", volume: "$174.8M" },
  { symbol: "AVAX-USDC", name: "Avalanche / USDC", exchange: "Hyperliquid", kind: "Crypto", category: "Perps", tvSymbol: "BINANCE:AVAXUSDT", price: "36.72", change: "+3.04%", volume: "$95.6M" },
  { symbol: "LINK-USDC", name: "Chainlink / USDC", exchange: "Hyperliquid", kind: "Crypto", category: "Perps", tvSymbol: "BINANCE:LINKUSDT", price: "18.42", change: "+0.93%", volume: "$72.1M" },
  { symbol: "HYPE-USDC", name: "Hyperliquid / USDC", exchange: "Hyperliquid", kind: "Crypto", category: "Perps", tvSymbol: "BYBIT:HYPEUSDT", price: "24.86", change: "+5.71%", volume: "$68.9M" },
  { symbol: "NVDA-USDC", name: "NVIDIA / USDC", exchange: "xyz", kind: "Equity", category: "Perps", tvSymbol: "NASDAQ:NVDA", price: "162.23", change: "−7.21%", volume: "$1.24B" },
  { symbol: "BTC-USD", name: "Bitcoin / US Dollar", exchange: "Coinbase", kind: "Crypto", category: "Spot", tvSymbol: "COINBASE:BTCUSD", price: "67,851.40", change: "+2.41%", volume: "$534.8M" },
  { symbol: "EUR-USD", name: "Euro / US Dollar", exchange: "FX_IDC", kind: "Forex", category: "Forex", tvSymbol: "FX:EURUSD", price: "1.08472", change: "+0.12%", volume: "—" },
  { symbol: "GBP-USD", name: "British Pound / US Dollar", exchange: "FX_IDC", kind: "Forex", category: "Forex", tvSymbol: "FX:GBPUSD", price: "1.27184", change: "−0.08%", volume: "—" },
  { symbol: "USD-JPY", name: "US Dollar / Japanese Yen", exchange: "FX_IDC", kind: "Forex", category: "Forex", tvSymbol: "FX:USDJPY", price: "156.284", change: "+0.31%", volume: "—" },
];

function Icon({ name, className = "size-4" }: { name: "globe" | "settings" | "chevron" | "search" | "candle" | "chart" | "expand" | "bell" | "bars" | "hollow" | "line" | "markers" | "step" | "area" | "hlcArea" | "baseline" | "columns" | "highLow" | "cursor" | "fib" | "brush" | "text" | "smile" | "ruler" | "zoom" | "magnet" | "lock" | "eye"; className?: string }) {
  const paths: Record<typeof name, ReactNode> = {
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18"/></>,
    settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.4.8l-.3 1.8h-2.8L13 18.8a8 8 0 0 1-1.6 0l-.4 1.8H8.2l-.3-1.8a8 8 0 0 1-1.4-.8l-1.7.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-1.7l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.4-.8l.3-1.8H11l.4 1.8a8 8 0 0 1 1.6 0l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.4.8l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 1.7Z"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>, search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></>,
    candle: <><path d="M7 3v18m10-18v18"/><rect x="4.5" y="7" width="5" height="7" rx=".6"/><rect x="14.5" y="10" width="5" height="6" rx=".6"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m7 14 4-4 3 2 6-7"/></>,
    bars: <><path d="M6 3v18m6-15v12m6-15v18"/><path d="M3 8h6m0 5h6m0-7h6"/></>,
    hollow: <><path d="M7 3v18m10-18v18"/><rect x="4.5" y="7" width="5" height="7" rx=".6"/><rect x="14.5" y="10" width="5" height="6" rx=".6"/></>,
    line: <path d="m3 17 6-7 4 3 8-9"/>,
    markers: <><path d="m3 17 6-7 4 3 8-9"/><circle cx="3" cy="17" r="1.5"/><circle cx="9" cy="10" r="1.5"/><circle cx="13" cy="13" r="1.5"/><circle cx="21" cy="4" r="1.5"/></>,
    step: <path d="M3 18h5V9h5V5h8"/>,
    area: <><path d="m3 17 6-7 4 3 8-9v15H3Z"/><path d="m3 17 6-7 4 3 8-9"/></>,
    hlcArea: <><path d="m3 17 6-7 4 3 8-9v15H3Z"/><path d="M6 12v6m7-8v6m5-10v7"/></>,
    baseline: <><path d="M3 12h18" strokeDasharray="2 2"/><path d="m4 8 4-3 4 5 4-4 4 3"/></>,
    columns: <><path d="M3 20V9h4v11m3 0V4h4v16m3 0v-8h4v8"/></>,
    highLow: <><path d="M6 5v14m0-11H3m3 8H3m9-12v14m0-10H9m3 6H9m9-10v14m0-12h-3m3 8h-3"/></>,
    cursor: <path d="m5 3 14 11-7 1-3.5 6L5 3Z"/>,
    fib: <><path d="M4 20 20 4M4 7h6m-3 6h10m-7 6h6"/><circle cx="4" cy="20" r="1.4"/><circle cx="20" cy="4" r="1.4"/></>,
    brush: <><path d="M14 5 19 10M4 20c3 0 5-1 6-4l9-9a2.1 2.1 0 0 0-3-3l-9 9c-3 1-4 3-4 7Z"/><path d="M4 20h4"/></>,
    text: <><path d="M4 6V4h16v2M12 4v16m-3 0h6"/></>,
    smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></>,
    ruler: <><path d="m3 17 14-14 4 4L7 21l-4-4Z"/><path d="m14 6 4 4m-7-1 2 2m-5 1 2 2m-5 1 2 2"/></>,
    zoom: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4m-9.2-12v6m-3-3h6"/></>,
    magnet: <><path d="M6 14V5a3 3 0 0 1 6 0v9a3 3 0 0 0 6 0V5a3 3 0 0 0-6 0"/><path d="M6 9H3v5a9 9 0 0 0 18 0V9h-3M6 5h6m6 0h3"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 5v2"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    expand: <><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name]}</svg>;
}

function MarketIcon({ market, className = "size-7" }: { market: Market; className?: string }) {
  const base = market.symbol.split("-")[0] ?? "BTC";
  const quote = market.symbol.split("-")[1] ?? "USDC";
  const src = market.kind === "Forex" ? `${LOGO_BASE}country/${FLAGS[base] ?? "US"}.svg` : `${LOGO_BASE}${LOGOS[base] ?? `crypto/XTVC${base}.svg`}`;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <span className={`relative grid shrink-0 place-items-center rounded-full bg-luna-400 ${className}`} aria-hidden="true">
    {!failed && <img src={src} alt="" className="size-[70%] rounded-full object-contain" onError={() => setFailed(true)} />}
    {market.kind === "Forex" && <img src={`${LOGO_BASE}country/${FLAGS[quote] ?? "US"}.svg`} alt="" className="absolute -bottom-0.5 -right-1 size-3.5 rounded-full border border-luna-500" />}
  </span>;
}

function MarketSelector({ market, onSelect }: { market: Market; onSelect: (market: Market) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => MARKETS.filter((item) => `${item.symbol} ${item.name}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  return <div className="relative z-40">
    <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => { setOpen(!open); requestAnimationFrame(() => input.current?.focus()); }} className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-luna-400">
      <MarketIcon market={market} className="size-6" /><span className="whitespace-nowrap text-[18px] font-semibold text-text-primary">{market.symbol}</span>
      <span className="rounded-md bg-luna-400 px-2 py-1 text-xs font-semibold text-luna-200">20x</span><Icon name="chevron" className="size-4 text-text-secondary" />
    </button>
    {open && <>
      <button className="fixed inset-0 z-0 cursor-default" aria-label="Close market selector" onClick={() => setOpen(false)} />
      <div role="dialog" aria-label="Choose market" className="absolute left-0 top-11 z-10 w-[min(34rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-luna-300 bg-luna-500 shadow-2xl shadow-black/50">
        <div className="border-b border-luna-300 p-3"><label htmlFor="trade-market-search" className="mb-1.5 block text-[11px] text-text-secondary">Search markets</label><div className="flex items-center gap-2 rounded-md border border-luna-300 bg-luna-500 px-2.5"><Icon name="search" className="size-4 text-text-muted"/><input ref={input} id="trade-market-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter" && filtered[0]) { onSelect(filtered[0]); setOpen(false); setQuery(""); } }} placeholder="Symbol or asset name" className="h-9 min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary" autoFocus /></div></div>
        <div className="max-h-[55vh] overflow-y-auto">
          {filtered.map((item) => <button key={item.symbol} onClick={() => { onSelect(item); setOpen(false); setQuery(""); }} className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-luna-300/70 px-3 py-2 text-left hover:bg-luna-400"><span className="flex items-center gap-2"><MarketIcon market={item} className="size-6"/><span><span className="block text-xs font-semibold text-text-primary">{item.symbol}</span><span className="block text-[10px] text-text-secondary">{item.name}</span></span></span><span className="font-mono text-xs tabular-nums text-text-primary">{item.price}</span><span className={`font-mono text-xs tabular-nums ${item.change.startsWith("−") ? "text-trade-short" : "text-luna-200"}`}>{item.change}</span></button>)}
          {filtered.length === 0 && <p className="px-4 py-8 text-center text-xs text-text-secondary">No matches in this demo list.</p>}
        </div>
        <div className="border-t border-luna-300 px-3 py-2 text-[10px] text-text-secondary">Market rows are illustrative. Full market search is available in TradingView’s chart.</div>
      </div>
    </>}
  </div>;
}

function TradingViewChart({ market }: { market: Market }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const theme = getComputedStyle(document.documentElement);
    const luna500 = theme.getPropertyValue("--luna-500").trim();
    const luna900 = theme.getPropertyValue("--luna-900").trim();
    const luna300 = theme.getPropertyValue("--luna-300").trim();
    const tradeLong = theme.getPropertyValue("--trade-long").trim();
    const tradeShort = theme.getPropertyValue("--trade-short").trim();
    const [red, green, blue] = luna300.match(/[A-Fa-f0-9]{2}/g)!.map((channel) => Number.parseInt(channel, 16));
    const gridColor = `rgba(${red}, ${green}, ${blue}, 0.20)`;
    container.replaceChildren();
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget h-full w-full";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: market.tvSymbol,
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: luna900,
      gridColor,
      toolbar_bg: luna500,
      allow_symbol_change: false,
      disabled_features: ["header_symbol_search"],
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      save_image: false,
      calendar: false,
      details: false,
      withdateranges: false,
      studies: ["Volume@tv-basicstudies"],
      overrides: {
        "paneProperties.background": luna900,
        "paneProperties.vertGridProperties.color": gridColor,
        "paneProperties.horzGridProperties.color": gridColor,
        "mainSeriesProperties.candleStyle.upColor": tradeLong,
        "mainSeriesProperties.candleStyle.borderUpColor": tradeLong,
        "mainSeriesProperties.candleStyle.wickUpColor": tradeLong,
        "mainSeriesProperties.candleStyle.downColor": tradeShort,
        "mainSeriesProperties.candleStyle.borderDownColor": tradeShort,
        "mainSeriesProperties.candleStyle.wickDownColor": tradeShort,
        "mainSeriesProperties.barStyle.upColor": tradeLong,
        "mainSeriesProperties.barStyle.downColor": tradeShort,
      },
    });
    container.append(widget, script);
    return () => container.replaceChildren();
  }, [market.tvSymbol]);
  return <div ref={ref} className="tradingview-widget-container h-full min-h-0 w-full" aria-label={`${market.symbol} TradingView chart`} />;
}
function OrderBook({ market }: { market: Market }) {
  const [tab, setTab] = useState<"Order Book" | "Trades">("Order Book");
  const base = Number(market.price.replaceAll(",", ""));
  const decimals = base < 1 ? 5 : base < 100 ? 3 : 2;
  const fmt = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const asks = Array.from({ length: 9 }, (_, i) => ({ price: base * (1 + (9 - i) * 0.00035), size: 1.15 + ((i * 7) % 13) * 0.37 }));
  const bids = Array.from({ length: 9 }, (_, i) => ({ price: base * (1 - (i + 1) * 0.00035), size: 0.82 + ((i * 5) % 11) * 0.42 }));
  return <section className="flex h-full min-h-0 flex-col overflow-hidden bg-luna-900" aria-label="Order book">
    <div className="flex h-10 shrink-0 border-b border-luna-300">{(["Order Book", "Trades"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`flex-1 border-b-2 text-xs font-medium ${tab === item ? "border-luna-200 text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"}`}>{item}</button>)}</div>
    <div className="flex h-8 shrink-0 items-center justify-between px-2 text-[11px] text-text-secondary"><button className="rounded bg-luna-400 px-2 py-1">0.01⌄</button><button className="rounded bg-luna-400 px-2 py-1">{market.symbol.split("-")[0]}⌄</button></div>
    {tab === "Order Book" ? <>
      <div className="grid h-6 shrink-0 grid-cols-3 items-center px-2 font-mono text-[10px] text-text-secondary"><span>Price</span><span className="text-right">Size</span><span className="text-right">Total</span></div>
      <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto_1fr]">
        <div className="flex min-h-0 flex-col justify-end overflow-hidden">{asks.map((row, i) => <div key={`ask-${i}`} className="relative grid min-h-0 flex-1 grid-cols-3 items-center px-2 font-mono text-[11px] tabular-nums"><span className="absolute inset-y-0 right-0" style={{ width: `${Math.min(100, row.size / 6 * 100)}%`, background: "var(--trade-short-bg)" }}/><span className="relative z-10 text-trade-short">{fmt(row.price)}</span><span className="relative z-10 text-right text-text-primary">{row.size.toFixed(3)}</span><span className="relative z-10 text-right text-text-secondary">{(row.size * (i + 1)).toFixed(2)}</span></div>)}</div>
        <div className="flex h-8 shrink-0 items-center justify-between bg-luna-400 px-2 font-mono text-[10px] text-text-primary"><span>Spread</span><span>0.01</span><span>0.006%</span></div>
        <div className="flex min-h-0 flex-col overflow-hidden">{bids.map((row, i) => <div key={`bid-${i}`} className="relative grid min-h-0 flex-1 grid-cols-3 items-center px-2 font-mono text-[11px] tabular-nums"><span className="absolute inset-y-0 right-0" style={{ width: `${Math.min(100, row.size / 6 * 100)}%`, background: "var(--trade-long-bg)" }}/><span className="relative z-10 text-luna-200">{fmt(row.price)}</span><span className="relative z-10 text-right text-text-primary">{row.size.toFixed(3)}</span><span className="relative z-10 text-right text-text-secondary">{(row.size * (i + 1)).toFixed(2)}</span></div>)}</div>
      </div>
    </> : <div className="min-h-0 flex-1 overflow-auto px-2"><div className="grid h-6 grid-cols-3 font-mono text-[10px] text-text-secondary"><span>Price</span><span className="text-right">Size</span><span className="text-right">Side</span></div>{Array.from({ length: 22 }, (_, i) => { const buy = i % 3 !== 0; return <div key={i} className="grid h-6 grid-cols-3 items-center font-mono text-[11px] tabular-nums"><span className={buy ? "text-luna-200" : "text-trade-short"}>{fmt(base * (1 + (i % 5 - 2) * .0002))}</span><span className="text-right text-text-primary">{(.3 + i * .26).toFixed(3)}</span><span className={`text-right ${buy ? "text-luna-200" : "text-trade-short"}`}>{buy ? "Buy" : "Sell"}</span></div>; })}</div>}
  </section>;
}

function OrderEntry({ market, onConnect }: { market: Market; onConnect: () => void }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"Market" | "Limit" | "Pro">("Market");
  const [marginMode, setMarginMode] = useState<"Cross" | "Isolated">("Cross");
  const [leverage, setLeverage] = useState("20x");
  const [accountMode, setAccountMode] = useState<"Unified" | "Standard">("Unified");
  const [percent, setPercent] = useState(0);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [risk, setRisk] = useState(false);
  return <section className="flex h-full min-h-0 flex-col overflow-auto bg-luna-900 p-2.5" aria-label="Order entry">
    <div className="grid shrink-0 grid-cols-3 gap-1.5"><button onClick={() => setMarginMode((value) => value === "Cross" ? "Isolated" : "Cross")} className="h-8 rounded-md bg-luna-400 text-[11px] font-medium text-text-primary hover:bg-luna-400">{marginMode}</button><button onClick={() => setLeverage((value) => value === "20x" ? "10x" : "20x")} className="h-8 rounded-md bg-luna-400 text-[11px] font-medium text-text-primary hover:bg-luna-400">{leverage}</button><button onClick={() => setAccountMode((value) => value === "Unified" ? "Standard" : "Unified")} className="h-8 rounded-md bg-luna-400 text-[11px] font-medium text-text-primary hover:bg-luna-400">{accountMode}</button></div>
    <div className="mt-2.5 flex h-9 shrink-0 border-b border-luna-300">{(["Market", "Limit", "Pro"] as const).map((item) => <button key={item} onClick={() => setType(item)} className={`flex-1 border-b-2 text-xs ${type === item ? "border-luna-200 text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"}`}>{item}</button>)}</div>
    <div className="mt-2 grid h-9 shrink-0 grid-cols-2 rounded-lg bg-luna-400 p-1"><button onClick={() => setSide("buy")} className={`rounded-md text-xs font-semibold ${side === "buy" ? "bg-trade-long text-luna-950" : "text-text-secondary"}`}>Buy / Long</button><button onClick={() => setSide("sell")} className={`rounded-md text-xs font-semibold ${side === "sell" ? "bg-trade-short text-luna-950" : "text-text-secondary"}`}>Sell / Short</button></div>
    <div className="mt-3 space-y-2 text-[11px]"><div className="flex justify-between"><span className="text-text-secondary">Available to Trade</span><span className="font-mono tabular-nums text-text-primary">0.00 USDC</span></div><div className="flex justify-between"><span className="text-text-secondary">Current Position</span><span className="font-mono tabular-nums text-text-primary">0.000 {market.symbol.split("-")[0]}</span></div></div>
    {type === "Limit" && <input placeholder="Limit price" className="mt-3 h-9 shrink-0 rounded-md border border-luna-300 bg-luna-500 px-2.5 text-xs text-text-primary outline-none placeholder:text-text-secondary focus:border-luna-200"/>}
    <label className="mt-3 flex h-9 shrink-0 items-center justify-between rounded-md border border-luna-300 bg-luna-500 px-2.5 text-[11px] text-text-secondary">Size <input aria-label="Order size" type="number" value={percent} onChange={(event) => setPercent(Math.max(0, Math.min(100, Number(event.target.value))))} className="w-20 bg-transparent text-right font-mono tabular-nums text-text-primary outline-none"/><span className="text-text-primary">%</span></label>
    <div className="mt-2 flex shrink-0 items-center gap-2"><input aria-label="Order size percentage" type="range" min="0" max="100" value={percent} onChange={(event) => setPercent(Number(event.target.value))} className="h-1 w-full accent-trade-long"/><span className="w-8 text-right font-mono text-[10px] tabular-nums text-text-primary">{percent}%</span></div>
    <div className="mt-2 flex shrink-0 flex-col gap-1.5 text-[11px] text-text-primary"><label className="flex items-center gap-2"><input type="checkbox" checked={reduceOnly} onChange={(event) => setReduceOnly(event.target.checked)} className="size-3.5 accent-trade-long"/>Reduce Only</label><label className="flex items-center gap-2"><input type="checkbox" checked={risk} onChange={(event) => setRisk(event.target.checked)} className="size-3.5 accent-trade-long"/>Take Profit / Stop Loss</label></div>
    {risk && <div className="mt-2 grid shrink-0 grid-cols-2 gap-1.5"><input placeholder="Take profit" className="h-8 min-w-0 rounded border border-luna-300 bg-luna-500 px-2 text-[10px] text-text-primary"/><input placeholder="Stop loss" className="h-8 min-w-0 rounded border border-luna-300 bg-luna-500 px-2 text-[10px] text-text-primary"/></div>}
    <div className="mt-auto pt-3"><button onClick={onConnect} className="h-9 w-full rounded-md bg-luna-200 text-xs font-bold text-luna-950 transition-colors hover:bg-luna-400 hover:text-text-primary">Connect</button><div className="mt-2.5 space-y-1.5 border-t border-luna-300 pt-2.5 text-[10px]"><div className="flex justify-between"><span className="text-text-secondary">Liquidation Price</span><span className="text-text-primary">—</span></div><div className="flex justify-between"><span className="text-text-secondary">Order Value</span><span className="text-text-primary">—</span></div><div className="flex justify-between"><span className="text-text-secondary">Margin Required</span><span className="text-text-primary">—</span></div><div className="flex justify-between"><span className="border-b border-dashed border-text-secondary text-text-secondary">Slippage</span><span className="text-luna-200">Est: 0% / Max: 8.00%</span></div></div></div>
  </section>;
}

export function TradePage() {
  const [market, setMarket] = useState(MARKETS[0]!);
  const [chartTab, setChartTab] = useState<"Chart" | "Funding">("Chart");
  const [notice, setNotice] = useState("");
  const marketStats = [
    { label: "Mark", value: market.price, tip: "Last traded price from the chart feed." },
    { label: "Oracle", value: market.price, tip: "Sample reference price." },
    { label: "24h Change", value: market.change, tip: "Illustrative percentage change." },
    { label: "24h Volume", value: market.volume, tip: "Illustrative volume." },
    { label: "Open Interest", value: "—", tip: "Exchange data is not connected." },
    { label: "Funding / Countdown", value: "0.0058%  00:32", tip: "Illustrative funding rate and countdown." },
  ];
  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-luna-950 text-text-primary">
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-luna-300 bg-luna-500 px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-5"><a href="/" aria-label="Market Forge home" className="flex shrink-0 items-center"><img src="/images/market-forge-logo-full.png" alt="Market Forge" className="h-7 w-auto object-contain" width="1936" height="350"/></a><nav aria-label="Main navigation" className="hidden h-12 items-center gap-5 text-xs text-text-secondary sm:flex"><a href="/trade" className="flex h-full items-center border-b-2 border-luna-200 text-text-primary">Trade</a><a href="#portfolio" className="hover:text-text-primary">Portfolio</a><a href="#vaults" className="hover:text-text-primary">Vaults</a><a href="#leaderboard" className="hover:text-text-primary">Leaderboard</a></nav></div>
      <div className="flex shrink-0 items-center gap-2"><button onClick={() => setNotice("Language selection is not connected yet.")} aria-label="Language" className="grid size-8 place-items-center rounded hover:bg-luna-400 text-text-secondary"><Icon name="globe"/></button><button onClick={() => setNotice("Trading settings are not connected yet.")} aria-label="Settings" className="grid size-8 place-items-center rounded hover:bg-luna-400 text-text-secondary"><Icon name="settings"/></button><button onClick={() => setNotice("Practice mode: wallet connection is not enabled.")} className="ml-1 h-8 rounded-md bg-luna-200 px-4 text-xs font-bold text-luna-950 hover:bg-luna-400 hover:text-text-primary">Connect</button></div>
    </header>
    <section aria-label="Market ticker" className="grid h-[52px] shrink-0 grid-cols-[minmax(0,auto)_1fr] items-center gap-2 border-b border-luna-300 bg-luna-500 px-2.5 sm:grid-cols-[minmax(250px,1.1fr)_repeat(6,minmax(90px,1fr))] sm:px-3">
      <MarketSelector market={market} onSelect={setMarket}/>
      {marketStats.map((item) => <div key={item.label} title={item.tip} className="hidden min-w-0 sm:block"><div className="w-fit border-b border-dashed border-text-secondary pb-0.5 text-[11px] text-text-secondary">{item.label}</div><div className={`truncate pt-0.5 font-mono text-[13px] font-medium tabular-nums ${item.label === "24h Change" ? market.change.startsWith("−") ? "text-trade-short" : "text-luna-200" : "text-text-primary"}`}>{item.value}</div></div>)}
    </section>
    <main className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-y-auto bg-luna-950 lg:grid-cols-[minmax(0,3.25fr)_minmax(220px,1fr)_minmax(260px,1fr)] lg:overflow-hidden">
      <section className="flex min-h-[70vh] min-w-0 flex-col bg-luna-900 lg:min-h-0" aria-label="Chart workspace">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-luna-300 px-3"><div role="tablist" aria-label="Chart views" className="flex h-full gap-5">{(["Chart", "Funding"] as const).map((tab) => <button key={tab} role="tab" aria-selected={chartTab === tab} onClick={() => setChartTab(tab)} className={`border-b-2 px-1 text-xs ${chartTab === tab ? "border-luna-200 text-text-primary" : "border-transparent text-text-secondary"}`}>{tab}</button>)}</div><span className="font-mono text-[9px] uppercase tracking-wide text-text-secondary">{chartTab === "Chart" ? "TradingView" : "Funding preview"}</span></div>
        {chartTab === "Chart" ? <div className="flex min-h-[440px] flex-1 flex-col bg-luna-900 lg:min-h-0"><TradingViewChart key={market.tvSymbol} market={market}/></div> : <div className="grid flex-1 content-start gap-2 bg-luna-900 p-3 sm:grid-cols-3 lg:grid-cols-1">{[{ label: "Current funding", value: "0.0058%" }, { label: "Next funding", value: "00:32" }, { label: "Annualized", value: "6.35%" }].map((item) => <div key={item.label} className="rounded-md border border-luna-300 bg-luna-400 p-3"><p className="text-[11px] text-text-secondary">{item.label}</p><p className="mt-1 font-mono text-sm tabular-nums text-text-primary">{item.value}</p></div>)}<p className="text-[10px] text-text-secondary">Funding values are illustrative and not connected to an exchange feed.</p></div>}
      </section>
      <OrderBook market={market}/>
      <OrderEntry market={market} onConnect={() => setNotice("Practice mode: no wallet connected and no order was sent.")}/>
    </main>
    {notice && <div role="status" className="fixed bottom-4 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-md border border-luna-300 bg-luna-400 px-3 py-2 text-xs text-text-primary shadow-xl"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message" className="text-luna-200">×</button></div>}
  </div>;
}
