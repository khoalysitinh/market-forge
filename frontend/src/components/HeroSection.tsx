export function HeroSection() {
  return (
    <section data-header-theme="dark" className="relative isolate flex min-h-svh items-center overflow-hidden bg-[#011c40] text-white">
      <img
        src="/images/bannerhero.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-20 size-full object-cover object-[64%_center]"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-[#011c40]/95 via-[#011c40]/85 to-[#011c40]/25" />
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-[#011c40]/50 via-transparent to-[#011c40]/15" />

      <div className="mx-auto w-full max-w-6xl px-5 py-20 pt-32 sm:px-8 sm:py-28 sm:pt-36">
        <div className="max-w-3xl">

          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Where Solid Strategy Meets Liquid Markets.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-200 sm:text-xl sm:leading-8">
            Experience an intuitive trading practice interface designed to cut through market noise and sharpen your decision-making.
          </p>

          <a
            href="#how-it-works"
            className="group mt-9 inline-flex min-h-12 items-center gap-3 rounded-lg bg-[#a7ebf2] px-6 py-3 font-semibold text-[#011c40] shadow-lg shadow-[#011c40]/30 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a7ebf2] motion-reduce:transition-none"
          >
            Get Started
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none">
              <path d="M3.75 10h12.5m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
