import { ArrowLeft, Construction } from 'lucide-react';

interface PlaceholderPageProps {
  /** Section name shown after "Alan Ton at", e.g. "Home" or "Work". */
  section: string;
}

/** Temporary "Work in Progress" page for sections that are not built yet. */
export function PlaceholderPage({ section }: PlaceholderPageProps) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-slate-500">
        Alan Ton @ {section}
      </p>
      <div className="mt-8 flex items-center gap-3 text-sky-400">
        <Construction className="h-8 w-8" aria-hidden="true" />
        <h1 className="text-3xl sm:text-4xl font-semibold text-slate-100">Work in Progress</h1>
      </div>
      <p className="mt-4 max-w-md text-slate-400">
        This page is still under construction. Check back soon.
      </p>
      <a
        href="/"
        className="mt-10 inline-flex items-center gap-2 rounded-full border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-sky-500/60 hover:text-sky-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to alanton.at
      </a>
    </main>
  );
}
