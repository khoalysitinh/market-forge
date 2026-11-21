import { MarketSignalCanvas } from './MarketSignalCanvas';

export function HeroSection() {
  return (
    <section data-header-theme="dark" className="relative isolate flex min-h-svh items-center overflow-hidden bg-[#0A0A0A] text-[#DBF2FC]">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-32 size-[34rem] rounded-full bg-[radial-gradient(ellipse,rgba(0,123,167,0.36)_0%,rgba(0,123,167,0.14)_34%,transparent_72%)] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-64 -right-36 size-[48rem] rounded-full bg-[radial-gradient(ellipse,rgba(255,45,149,0.28)_0%,rgba(255,45,149,0.11)_42%,transparent_72%)] blur-3xl" />
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

        <div className="group/stage relative isolate mx-auto flex min-h-[280px] w-full max-w-[560px] items-center justify-center overflow-hidden [perspective:1200px] [transform-style:preserve-3d] sm:min-h-[400px] lg:min-h-[560px]">
          <div aria-hidden="true" className="absolute inset-[12%] z-0 rounded-[46%] border border-[#007BA7]/35 bg-linear-to-br from-[#007BA7]/15 via-[#0A0A0A]/5 to-[#FF2D95]/10 shadow-[inset_0_0_36px_rgba(0,123,167,0.14),0_0_35px_rgba(0,123,167,0.08)] backdrop-blur-[2px] [transform:rotateY(-18deg)_rotateX(4deg)] transition-transform duration-700 group-hover/stage:-translate-y-1 motion-reduce:transition-none" />
          <div aria-hidden="true" className="absolute inset-[19%] z-0 rounded-[42%] border border-[#FF2D95]/30 bg-linear-to-br from-[#007BA7]/10 via-[#0A0A0A]/5 to-[#FF2D95]/10 opacity-60 backdrop-blur-[2px] [transform:rotateY(17deg)_rotateX(-6deg)_scale(0.88)] transition-transform duration-700 group-hover/stage:[transform:translateZ(-22px)_rotateY(17deg)_rotateX(-6deg)_scale(0.84)] motion-reduce:transition-none" />
          <div aria-hidden="true" className="absolute inset-[18%] z-0 animate-pulse rounded-full bg-[#FF2D95]/10 blur-3xl motion-reduce:animate-none" />
          <MarketSignalCanvas />
          <img
            src="/images/market-forge-signal-core-v2.png"
            alt="A sculptural market signal core made of glass candlesticks and a rising price ribbon"
            className="pointer-events-none relative z-[2] max-h-[27rem] w-[88%] max-w-[29rem] object-contain drop-shadow-[0_24px_54px_rgba(0,123,167,0.2)] transition-all duration-700 ease-out [transform:translateZ(24px)] group-hover/stage:[transform:translateZ(62px)_scale(1.035)] group-hover/stage:drop-shadow-[0_30px_62px_rgba(0,123,167,0.32)] motion-reduce:transition-none motion-reduce:group-hover/stage:transform-none lg:max-h-[36rem]"
          />
        </div>

        <div className="relative z-20 max-w-xl translate-y-3 py-6 lg:translate-y-8 lg:justify-self-end lg:py-0">
          <p className="max-w-xl text-base leading-7 text-[#DBF2FC]/85 sm:text-lg sm:leading-8">
            Experience an intuitive trading practice interface designed to cut through market noise and sharpen your decision-making.
          </p>
          <a
            href="#how-it-works"
            className="group mt-7 inline-flex min-h-12 items-center gap-3 rounded-xl bg-[#007BA7] px-7 py-3 text-base font-semibold text-[#DBF2FC] shadow-lg shadow-[#007BA7]/25 transition-[background-color,color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-[#FF2D95] hover:text-[#0A0A0A] hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#007BA7] motion-reduce:transition-none"
          >
            Get Started
            <span className="grid size-7 place-items-center rounded-full bg-[#0A0A0A] text-[#DBF2FC]">
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
