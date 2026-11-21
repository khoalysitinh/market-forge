import { HeroSection } from "../components/HeroSection";
import { HeroWaveBackground } from "../components/HeroWaveBackground";

const PRACTICE_STEPS = [
  {
    number: "01",
    title: "Observe",
    body: "Study the same synthetic market view as your group. The replay clock controls what everyone can see.",
    icon: "◉",
  },
  {
    number: "02",
    title: "Commit",
    body: "Choose LONG, SHORT, or WAIT. Record your reasoning before the next candles are revealed.",
    icon: "↳",
  },
  {
    number: "03",
    title: "Review",
    body: "Lock decisions, then review one another’s plans while the future is still hidden.",
    icon: "◇",
  },
  {
    number: "04",
    title: "Reveal",
    body: "Open the next part of the chart together and reflect on the decisions you made.",
    icon: "↗",
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
  light = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  light?: boolean;
}) {
  return (
    <div className="max-w-2xl">
      <p className={`mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] ${light ? "text-white/65" : "text-forge-navy"}`}>
        {eyebrow}
      </p>
      <h2 className={`text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl ${light ? "text-white" : "text-forge-navy"}`}>
        {title}
      </h2>
      <p className={`mt-4 text-base leading-7 sm:text-lg ${light ? "text-white/70" : "text-slate-600"}`}>
        {description}
      </p>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" data-header-theme="dark" className="scroll-mt-24 bg-hero-black px-5 py-20 text-white sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="The practice loop"
          title="Four steps. One shared market."
          description="A deliberate rhythm gives your group room to think, explain, challenge, and learn together."
          light
        />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRACTICE_STEPS.map((step) => (
            <li key={step.number} className="group rounded-2xl border border-white/10 bg-[#111111] p-6 transition-colors duration-200 hover:border-hero-pink/50 hover:bg-[#151515] motion-reduce:transition-none">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold tracking-[0.16em] text-white/50">STEP {step.number}</span>
                <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-hero-blue font-mono text-lg text-white transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none">
                  {step.icon}
                </span>
              </div>
              <h3 className="mt-8 text-xl font-semibold text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/70">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function WorkspacePreview() {
  return (
    <section id="product" data-header-theme="dark" className="scroll-mt-24 overflow-hidden bg-hero-black px-5 py-20 text-white sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="Inside the Dojo"
            title="A focused space for better decisions."
            description="Keep the chart, round state, participant progress, and your decision in one calm workspace. The server controls the replay; the interface keeps your attention on the process."
            light
          />
          <ul className="mt-8 space-y-4 text-sm text-white/80 sm:text-base">
            <li className="flex gap-3"><span className="text-hero-pink">✓</span><span>Know what is visible at the current replay point.</span></li>
            <li className="flex gap-3"><span className="text-hero-pink">✓</span><span>See who has committed without exposing sealed decisions.</span></li>
            <li className="flex gap-3"><span className="text-hero-pink">✓</span><span>Review the plan before the next candles are revealed.</span></li>
          </ul>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-[#111111] p-2 shadow-2xl shadow-black/30 sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Workspace preview</p>
              <p className="mt-1 text-sm font-semibold text-white">The Trading Dojo</p>
            </div>
            <span className="rounded-full border border-hero-pink/30 bg-hero-pink/10 px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-white">
              Synthetic · illustrative
            </span>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-white/10">
            <img src="/images/bannerhero.png" alt="Abstract synthetic candlestick chart illustration used as a workspace preview" className="h-56 w-full object-cover object-[68%_center] sm:h-72" loading="lazy" />
            <div className="absolute inset-0 bg-linear-to-t from-hero-black/95 via-hero-black/10 to-transparent" />
            <div className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-2 sm:inset-x-4 sm:bottom-4 sm:gap-3">
              <div className="rounded-xl border border-white/10 bg-hero-black/90 p-3 backdrop-blur-sm sm:p-4">
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/55">Round state</p>
                <p className="mt-1 text-sm font-semibold text-white">Decision open</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-hero-black/90 p-3 backdrop-blur-sm sm:p-4">
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/55">Your plan</p>
                <p className="mt-1 text-sm font-semibold text-white">Sealed until lock</p>
              </div>
            </div>
          </div>
          <p className="px-3 pb-2 pt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50 sm:px-4">
            Illustration only · not live prices or a trading signal
          </p>
        </div>
      </div>
    </section>
  );
}

function GroupPractice() {
  return (
    <section id="community" data-header-theme="dark" className="scroll-mt-24 bg-hero-black px-5 py-20 text-white sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="order-2 lg:order-1">
          <div className="relative mx-auto max-w-md rounded-[2rem] border border-white/10 bg-[#111111] p-6 shadow-xl shadow-black/30 sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Shared practice room</p>
                <p className="mt-1 font-semibold text-white">One session, together</p>
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-hero-blue text-white" aria-hidden="true">⌂</span>
            </div>
            <div className="mt-6 space-y-3">
              {["Everyone sees the same replay point", "Decisions stay sealed until lock", "Reviews happen before reveal"].map((line, index) => (
                <div key={line} className="flex items-center gap-3 rounded-xl bg-white/[0.05] p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-hero-pink/50 font-mono text-[10px] font-semibold text-white">0{index + 1}</span>
                  <span className="text-sm text-white/80">{line}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-5">
              <span className="size-2 rounded-full bg-hero-pink" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/55">Built for small-group practice</span>
            </div>
          </div>
        </div>
        <div id="about" className="order-1 scroll-mt-28 lg:order-2">
          <SectionHeading
            eyebrow="Practice together"
            title="Make the reasoning part of the session."
            description="A room gives a small group a shared market, a shared clock, and a clear moment to compare decisions—without revealing anyone’s plan too early."
            light
          />
          <a href="#how-it-works" className="mt-7 inline-flex items-center gap-2 font-semibold text-white transition-colors hover:text-hero-pink focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hero-blue">
            See the practice loop <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function ProductBoundaries() {
  return (
    <section data-header-theme="dark" className="relative h-[300px] scroll-mt-24 overflow-hidden bg-[#0A0A0A] sm:h-[360px] lg:h-[420px]">
      <HeroWaveBackground />
    </section>
  );
}

export function LandingPage() {
  return (
    <>
      <HeroSection />
      <HowItWorks />
      <WorkspacePreview />
      <GroupPractice />
      <ProductBoundaries />
    </>
  );
}
