import { MarketSignalCanvas } from './MarketSignalCanvas';

export function HeroSection() {
  return (
    <section data-header-theme="dark" className="landing-hero relative isolate flex min-h-svh items-center overflow-hidden text-white">
      <div aria-hidden="true" className="hero-blue-glow pointer-events-none absolute -left-40 -top-32 size-[34rem] rounded-full" />
      <div aria-hidden="true" className="hero-pink-glow pointer-events-none absolute -bottom-64 -right-36 size-[48rem] rounded-full" />
      <svg aria-hidden="true" viewBox="0 0 1600 420" preserveAspectRatio="none" className="pointer-events-none absolute -bottom-1 left-0 h-[34%] w-full opacity-60">
        <defs>
          <linearGradient id="hero-wave-gradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#0A0A0A" stopOpacity="0.2" />
            <stop offset="0.52" stopColor="#FF2D95" stopOpacity="0.7" />
            <stop offset="1" stopColor="#0A0A0A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 314 C250 270 330 365 590 304 S930 180 1120 263 1420 175 1600 80" fill="none" stroke="url(#hero-wave-gradient)" strokeWidth="2" />
        <path d="M0 355 C260 310 400 390 635 335 S965 226 1175 302 1430 230 1600 158" fill="none" stroke="url(#hero-wave-gradient)" strokeOpacity=".55" strokeWidth="1" />
      </svg>
      <div className="relative z-10 mx-auto grid w-full max-w-[1700px] items-center gap-5 px-6 pb-12 pt-28 sm:px-10 sm:pb-16 sm:pt-32 lg:grid-cols-[0.9fr_1.15fr_0.9fr] lg:gap-2 lg:px-10 xl:gap-6 xl:px-14 2xl:px-20">
        <div className="relative z-20 max-w-xl -translate-y-2 py-6 lg:-translate-y-5 lg:py-0">
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-[3.5rem] xl:text-[4.25rem]">
            Where Solid Strategy Meets Liquid Markets.
          </h1>
        </div>

        <div className="market-signal-stage relative mx-auto flex min-h-[280px] w-full max-w-[560px] items-center justify-center overflow-hidden sm:min-h-[400px] lg:min-h-[560px]">
          <div aria-hidden="true" className="market-signal-glass absolute inset-[12%] rounded-[46%] border border-hero-blue/35" />
          <div aria-hidden="true" className="market-signal-glass market-signal-glass-back absolute inset-[19%] rounded-[42%] border border-hero-pink/30" />
          <div aria-hidden="true" className="market-signal-aura absolute inset-[18%] rounded-full bg-hero-pink/10 blur-3xl" />
          <MarketSignalCanvas />
          <img
            src="/images/market-forge-signal-core-v2.png"
            alt="A sculptural market signal core made of glass candlesticks and a rising price ribbon"
            className="market-signal-model pointer-events-none relative z-[2] max-h-[27rem] w-[88%] max-w-[29rem] object-contain lg:max-h-[36rem]"
          />
        </div>

        <div className="relative z-20 max-w-xl translate-y-3 py-6 lg:translate-y-8 lg:justify-self-end lg:py-0">
          <p className="max-w-xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
            Experience an intuitive trading practice interface designed to cut through market noise and sharpen your decision-making.
          </p>
          <a
            href="#how-it-works"
            className="group mt-7 inline-flex min-h-12 items-center gap-3 rounded-xl bg-hero-blue px-7 py-3 text-base font-semibold text-white shadow-lg shadow-hero-blue/25 transition-[background-color,color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-hero-pink hover:text-hero-black hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hero-blue motion-reduce:transition-none"
          >
            Get Started
            <span className="grid size-7 place-items-center rounded-full bg-hero-black text-white">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">
                <path d="M3.75 10h12.5m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
