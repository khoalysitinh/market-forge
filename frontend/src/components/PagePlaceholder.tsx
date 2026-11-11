interface PagePlaceholderProps {
  title: string;
  description: string;
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-lg shadow-black/10 sm:p-8" aria-labelledby="page-title">
      <h1 id="page-title" className="mb-2 text-2xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
      <p className="m-0 text-sm leading-6 text-slate-400 sm:text-base">{description}</p>
    </section>
  );
}
