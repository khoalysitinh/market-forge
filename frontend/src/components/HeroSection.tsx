import { Trading3DBackground } from './Trading3DBackground';

export function HeroSection() {
  return (
    <section data-header-theme="dark" className="relative isolate flex min-h-svh items-center overflow-hidden bg-[#011c40] text-white">
      {/* Dynamic 2D/3D Glowing Trading Waves, Candlesticks & Parallax */}
      <Trading3DBackground />

      {/* Bỏ max-w-[1440px] và mx-auto, dùng w-full + padding cố định (lg:px-16 xl:px-24) để bám sát lề trái */}
      <div className="relative z-10 w-full px-6 py-20 pt-32 sm:px-10 sm:py-28 sm:pt-40 lg:px-16 xl:px-24">
        <div className="max-w-5xl">
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.06] tracking-tight text-white sm:text-7xl lg:text-8xl">
            Where Solid Strategy Meets Liquid Markets.
          </h1>

          <p className="mt-8 max-w-3xl text-lg leading-8 text-slate-200 sm:text-2xl sm:leading-9">
            Experience an intuitive trading practice interface designed to cut through market noise and sharpen your decision-making.
          </p>

          <a
            href="#how-it-works"
            className="group mt-10 inline-flex min-h-14 items-center gap-3 rounded-lg bg-[#a7ebf2] px-8 py-4 text-lg font-semibold text-[#011c40] shadow-lg shadow-[#011c40]/30 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a7ebf2] motion-reduce:transition-none"
          >
            Get Started
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-5 transition-transform group-hover:translate-x-1 motion-reduce:transition-none">
              <path d="M3.75 10h12.5m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}