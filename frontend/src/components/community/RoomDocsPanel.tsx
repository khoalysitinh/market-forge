import { useState, type ReactElement } from 'react'

type GuideStep = {
  title: string
  role: string
  detail: string
  accent: 'blue' | 'pink' | 'ice'
}

const PILLARS = [
  {
    letter: 'A',
    title: 'Blind Practice',
    detail: 'Everyone sees the same chart up to the current clock. The server holds the remaining candles, so nobody can peek ahead.',
    accent: 'blue',
  },
  {
    letter: 'B',
    title: 'Sealed Decision',
    detail: 'After you commit LONG, SHORT, or WAIT, your decision is locked forever and stays hidden from others until the Owner locks the round.',
    accent: 'pink',
  },
  {
    letter: 'C',
    title: 'Evidence-Based Review',
    detail: 'Before reveal, members complete a blind review using a four-criteria checklist. Grade the plan, not the outcome.',
    accent: 'ice',
  },
  {
    letter: 'D',
    title: 'Learning Progress',
    detail: 'Every decision, review, and outcome is stored to support future progress reports.',
    accent: 'blue',
  },
] as const

const REVIEW_CHECKLIST = [
  'The thesis is specific and actionable, not just “price will go up.”',
  'The invalidation condition is realistic and observable.',
  'The direction is consistent with the thesis.',
  'The confidence level matches the quality of the reasoning.',
]

const FIRST_STEP: GuideStep = {
  title: 'Create a room',
  role: 'OWNER ONLY',
  detail: 'The Owner creates a practice room for a group of 2–10 people. The room is shared practice on synthetic market data.',
  accent: 'blue',
}

const STEPS: GuideStep[] = [
  FIRST_STEP,
  {
    title: 'Share the invite code',
    role: 'OWNER',
    detail: 'The Owner shares the room’s 10-character invite code with the group so members can join the same practice space.',
    accent: 'ice',
  },
  {
    title: 'Join a room',
    role: 'MEMBER',
    detail: 'A member enters the 10-character invite code to join the Owner’s room and practice with the group.',
    accent: 'pink',
  },
  {
    title: 'Start a Trial',
    role: 'OWNER ONLY',
    detail: 'The Owner starts one Trial. It uses one synthetic dataset of 600 one-minute (M1) candles; 120 candles are visible initially.',
    accent: 'blue',
  },
  {
    title: 'Read the chart and commit',
    role: 'ALL MEMBERS',
    detail: 'Choose LONG, SHORT, or WAIT. Record a thesis, an invalidation condition, and confidence from 1–5. Add risk_note if useful; it is optional. Committing locks the decision permanently.',
    accent: 'pink',
  },
  {
    title: 'Lock the round',
    role: 'OWNER ONLY',
    detail: 'The Owner locks the round after members commit. Decisions become visible to the group, while future candles remain hidden.',
    accent: 'blue',
  },
  {
    title: 'Complete a blind review',
    role: 'ALL MEMBERS · BEFORE REVEAL',
    detail: 'Review another member’s plan without seeing the outcome. Use the four criteria below to assess the decision at the time it was made.',
    accent: 'pink',
  },
  {
    title: 'Reveal 30 more candles',
    role: 'OWNER ONLY',
    detail: 'The Owner reveals the next 30 candles from the synthetic dataset. The group can now compare the market path with the plans and reviews.',
    accent: 'ice',
  },
  {
    title: 'Complete the round',
    role: 'OWNER ONLY',
    detail: 'The Owner completes the round. The round’s decisions, reviews, and outcome are stored, and the next round opens.',
    accent: 'blue',
  },
  {
    title: 'Repeat the practice loop',
    role: 'UP TO 16 ROUNDS',
    detail: 'Continue through the Trial at the group’s pace. One Trial supports up to 16 rounds using the same synthetic dataset.',
    accent: 'pink',
  },
]

const KEY_RULES = [
  'Decisions are immutable after commit: no editing and no deleting.',
  'Synthetic data only. The chart is labelled “SYNTHETIC MARKET DATA — NOT REAL NAS100.”',
  'There is no P&L calculation. The goal is decision quality, not profit.',
  'Only the Owner controls the pace: lock, reveal, and complete.',
  'Review is blind: grade the plan at decision time, not the outcome.',
]

const accentClasses = {
  blue: {
    text: 'text-[#007BA7]',
    border: 'border-[#007BA7]/40',
    surface: 'bg-[#007BA7]/10',
  },
  pink: {
    text: 'text-[#FF2D95]',
    border: 'border-[#FF2D95]/40',
    surface: 'bg-[#FF2D95]/10',
  },
  ice: {
    text: 'text-[#DBF2FC]',
    border: 'border-[#DBF2FC]/30',
    surface: 'bg-[#DBF2FC]/[0.06]',
  },
} as const

function StepButton({
  step,
  index,
  active,
  onSelect,
}: {
  step: GuideStep
  index: number
  active: boolean
  onSelect: () => void
}): ReactElement {
  const accent = accentClasses[step.accent]

  return (
    <button
      type='button'
      aria-pressed={active}
      onClick={onSelect}
      className={`flex min-h-14 w-full min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DBF2FC] ${
        active
          ? `${accent.border} ${accent.surface}`
          : 'border-[#DBF2FC]/15 bg-[#0A0A0A] hover:border-[#007BA7]/60 hover:bg-[#007BA7]/[0.06]'
      }`}
    >
      <span className={`shrink-0 font-mono text-xs font-bold ${accent.text}`}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className='min-w-0 flex-1 break-words'>
        <span className='block text-sm font-semibold text-[#DBF2FC]'>{step.title}</span>
        <span className='mt-1 block font-mono text-[10px] tracking-[0.08em] text-[#DBF2FC]/60'>
          {step.role}
        </span>
      </span>
    </button>
  )
}

export function RoomDocsPanel(): ReactElement {
  const [activeStep, setActiveStep] = useState(0)
  const currentStep = STEPS[activeStep] ?? FIRST_STEP

  return (
    <article className='mx-auto w-full max-w-6xl min-w-0 px-4 py-8 font-sans text-[#DBF2FC] sm:px-8 sm:py-12'>
      <header className='mb-10'>
        <p className='mb-3 font-mono text-xs font-semibold tracking-[0.16em] text-[#007BA7]'>
          MARKET FORGE · ROOM GUIDE
        </p>
        <h1 className='max-w-3xl text-3xl font-bold tracking-tight text-[#DBF2FC] sm:text-5xl'>
          Practice together. Learn from the process.
        </h1>
        <p className='mt-4 max-w-3xl text-sm leading-6 text-[#DBF2FC]/75 sm:text-base'>
          A Room gives a small group a shared, structured way to practice decisions on synthetic market data.
          Every member sees the same chart clock, commits before the future is revealed, then reviews the reasoning.
        </p>
        <p className='mt-5 inline-flex max-w-full items-start gap-2 rounded-md border border-[#FF2D95]/50 bg-[#FF2D95]/10 px-3 py-2 font-mono text-xs font-bold leading-5 text-[#DBF2FC] sm:text-sm'>
          <span aria-hidden='true' className='text-[#FF2D95]'>●</span>
          <span>SYNTHETIC MARKET DATA — NOT REAL NAS100</span>
        </p>
      </header>

      <section aria-labelledby='room-basics' className='mb-12'>
        <div className='mb-4'>
          <p className='font-mono text-[11px] tracking-[0.14em] text-[#007BA7]'>THE BASICS</p>
          <h2 id='room-basics' className='mt-1 text-2xl font-bold text-[#DBF2FC]'>What is a Room?</h2>
        </div>
        <p className='mb-5 max-w-3xl text-sm leading-6 text-[#DBF2FC]/75'>
          A Room is a practice group of 2–10 people. The Owner creates the room and shares its 10-character invite
          code; each member joins with that code. The group practices on one synthetic dataset per Trial.
        </p>
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
          {[
            { value: '2–10', label: 'people per practice group' },
            { value: '10 chars', label: 'room invite code' },
            { value: '600 M1', label: 'candles in one Trial' },
            { value: '120', label: 'candles visible initially' },
          ].map((fact) => (
            <div key={fact.label} className='min-w-0 rounded-lg border border-[#DBF2FC]/15 bg-[#0A0A0A] p-4'>
              <p className='text-xl font-bold tabular-nums text-[#007BA7] sm:text-2xl'>{fact.value}</p>
              <p className='mt-1 text-xs leading-5 text-[#DBF2FC]/70'>{fact.label}</p>
            </div>
          ))}
        </div>
        <p className='mt-3 text-xs leading-5 text-[#DBF2FC]/65'>
          One Trial uses one synthetic dataset and supports up to <strong className='text-[#DBF2FC]'>16 rounds</strong>.
        </p>
      </section>

      <section aria-labelledby='four-pillars' className='mb-12'>
        <div className='mb-4'>
          <p className='font-mono text-[11px] tracking-[0.14em] text-[#007BA7]'>PRODUCT MECHANICS</p>
          <h2 id='four-pillars' className='mt-1 text-2xl font-bold text-[#DBF2FC]'>How it works</h2>
        </div>
        <div className='grid gap-3 sm:grid-cols-2'>
          {PILLARS.map((pillar) => {
            const accent = accentClasses[pillar.accent]
            return (
              <section key={pillar.letter} className={`min-w-0 rounded-xl border ${accent.border} bg-[#0A0A0A] p-5`}>
                <div className='flex items-center gap-3'>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${accent.surface} font-mono text-sm font-bold ${accent.text}`}>
                    {pillar.letter}
                  </span>
                  <h3 className='text-base font-bold text-[#DBF2FC]'>{pillar.title}</h3>
                </div>
                <p className='mt-3 text-sm leading-6 text-[#DBF2FC]/75'>{pillar.detail}</p>
              </section>
            )
          })}
        </div>
      </section>

      <section aria-labelledby='step-guide' className='mb-12'>
        <div className='mb-4'>
          <p className='font-mono text-[11px] tracking-[0.14em] text-[#007BA7]'>FROM ROOM TO REVIEW</p>
          <h2 id='step-guide' className='mt-1 text-2xl font-bold text-[#DBF2FC]'>Step-by-step guide</h2>
          <p className='mt-2 text-sm text-[#DBF2FC]/70'>Select a step to read what happens.</p>
        </div>
        <div className='grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'>
          <nav aria-label='Room guide steps' className='grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1'>
            {STEPS.map((step, index) => (
              <StepButton
                key={step.title}
                step={step}
                index={index}
                active={activeStep === index}
                onSelect={() => setActiveStep(index)}
              />
            ))}
          </nav>
          <section
            aria-live='polite'
            aria-atomic='true'
            aria-labelledby='step-detail-title'
            className='min-w-0 self-start rounded-xl border border-[#007BA7]/50 bg-[#0A0A0A] p-5 sm:p-6'
          >
            <p className='font-mono text-xs tracking-[0.12em] text-[#007BA7]'>STEP {String(activeStep + 1).padStart(2, '0')}</p>
            <h3 id='step-detail-title' className='mt-2 text-xl font-bold text-[#DBF2FC]'>
              {currentStep.title}
            </h3>
            <p className='mt-1 font-mono text-[10px] tracking-[0.08em] text-[#FF2D95]'>{currentStep.role}</p>
            <p className='mt-4 text-sm leading-6 text-[#DBF2FC]/80'>{currentStep.detail}</p>

            {activeStep === 6 && (
              <div className='mt-5 rounded-lg border border-[#007BA7]/40 bg-[#007BA7]/10 p-4'>
                <h4 className='text-sm font-bold text-[#DBF2FC]'>The 4-criteria review checklist</h4>
                <ol className='mt-3 grid gap-3'>
                  {REVIEW_CHECKLIST.map((criterion, index) => (
                    <li key={criterion} className='flex min-w-0 items-start gap-3 text-sm leading-5 text-[#DBF2FC]/80'>
                      <span className='font-mono text-xs font-bold tabular-nums text-[#007BA7]'>{index + 1}.</span>
                      <span className='min-w-0'>{criterion}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className='mt-6 flex flex-wrap gap-2'>
              <button
                type='button'
                disabled={activeStep === 0}
                onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
                className='min-h-10 rounded-md border border-[#DBF2FC]/20 px-4 text-sm font-semibold text-[#DBF2FC] transition-colors hover:border-[#007BA7] hover:bg-[#007BA7]/10 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DBF2FC]'
              >
                Previous step
              </button>
              <button
                type='button'
                disabled={activeStep === STEPS.length - 1}
                onClick={() => setActiveStep((step) => Math.min(STEPS.length - 1, step + 1))}
                className='min-h-10 rounded-md bg-[#007BA7] px-4 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-[#DBF2FC] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DBF2FC]'
              >
                Next step <span aria-hidden='true'>→</span>
              </button>
            </div>
          </section>
        </div>
      </section>

      <section aria-labelledby='key-rules' className='mb-12 rounded-xl border border-[#FF2D95]/40 bg-[#FF2D95]/[0.06] p-5 sm:p-6'>
        <p className='font-mono text-[11px] tracking-[0.14em] text-[#FF2D95]'>ALWAYS VISIBLE</p>
        <h2 id='key-rules' className='mt-1 text-2xl font-bold text-[#DBF2FC]'>Key rules</h2>
        <ul className='mt-4 grid gap-3 sm:grid-cols-2'>
          {KEY_RULES.map((rule) => (
            <li key={rule} className='flex min-w-0 items-start gap-3 text-sm leading-6 text-[#DBF2FC]/85'>
              <span aria-hidden='true' className='mt-0.5 shrink-0 text-[#FF2D95]'>●</span>
              <span className='min-w-0'>{rule}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className='border-t border-[#DBF2FC]/15 pt-5'>
        <p className='text-xs leading-5 text-[#DBF2FC]/65'>
          This is a synthetic practice environment. It does not connect to real NAS100 markets and does not calculate profit or loss.
        </p>
      </footer>
    </article>
  )
}

