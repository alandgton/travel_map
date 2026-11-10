import { useState } from 'react';
import { Briefcase, Home, Map, Zap, ZapOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NeuralMeshBackground } from './NeuralMeshBackground';

interface SiteLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Sections linked from the landing page. Add new subpath sites here. */
const SITE_LINKS: SiteLink[] = [
  { label: 'Home', href: '/home/', icon: Home },
  { label: 'Work', href: '/work/', icon: Briefcase },
  { label: 'Garden Leave', href: '/gardenleave/', icon: Map },
];

export function LandingPage() {
  const [isAnimated, setIsAnimated] = useState<boolean>(false);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500/30 selection:text-sky-200 overflow-x-hidden">
      {/* Background Neural Mesh */}
      <NeuralMeshBackground isAnimated={isAnimated} />

      {/* Top Bar / Animation Controls */}
      <header className="relative z-10 flex justify-end p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setIsAnimated(!isAnimated)}
          aria-pressed={isAnimated}
          className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3.5 py-1.5 text-xs font-mono text-slate-300 backdrop-blur-md transition-colors hover:border-sky-500/50 hover:text-sky-300 shadow-sm"
        >
          {isAnimated ? (
            <Zap className="h-3.5 w-3.5 text-sky-400 fill-sky-400" aria-hidden="true" />
          ) : (
            <ZapOff className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          )}
          <span>Animation: {isAnimated ? 'ON' : 'OFF'}</span>
          <span
            className={`inline-block h-2 w-2 rounded-full transition-colors ${
              isAnimated ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]' : 'bg-slate-600'
            }`}
            aria-hidden="true"
          />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-6 -mt-10 text-center">
        {/* Soft radial vignette behind text and buttons */}
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
          <div className="h-[460px] w-[520px] rounded-full bg-slate-950/60 blur-3xl" />
        </div>

        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight text-slate-100">
          Alan Ton at
        </h1>

        <nav className="mt-12 flex w-full max-w-sm flex-col gap-4">
          {SITE_LINKS.map(({ label, href, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="group flex flex-1 items-center justify-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-6 py-5 text-lg font-medium text-slate-200 backdrop-blur-md transition-all hover:border-sky-500/60 hover:bg-slate-900/80 hover:text-sky-300 shadow-lg shadow-black/20"
            >
              <Icon
                className="h-5 w-5 text-slate-400 transition-colors group-hover:text-sky-400"
                aria-hidden="true"
              />
              {label}
            </a>
          ))}
        </nav>
      </main>
    </div>
  );
}
