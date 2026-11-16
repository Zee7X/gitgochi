import Link from 'next/link';
import type { ReactNode } from 'react';

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4">
      <Link
        href="/"
        className="font-pixel text-[11px] leading-relaxed text-[#9bbc0f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        GITGOTCHI
      </Link>
      {children}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-7xl px-4 py-8 text-center font-mono text-xs text-zinc-400">
      Built for Kiroween 2026, Resurrection category. Pets live in server memory and restart empty.
    </footer>
  );
}
