import Link from 'next/link';
import type { PetError } from '@/hooks/usePet';
import { DemoChips } from './DemoChips';
import { btnGhost } from './ui';

const COPY: Record<PetError['kind'], (repo: string) => { title: string; body: string }> = {
  not_found: (repo) => ({
    title: 'NO GRAVE FOUND',
    body: `GitHub has no public repo called ${repo}. Check the spelling. Private repos stay invisible to the pet.`,
  }),
  rate_limited: () => ({
    title: 'GITHUB IS SLEEPING',
    body: 'The GitHub API rate limit is used up for now. Try again in a few minutes, or meet a demo pet in the meantime.',
  }),
  invalid: () => ({
    title: 'THAT IS NOT A REPO',
    body: 'Use the form owner/repo, like vercel/next.js.',
  }),
  network: () => ({
    title: 'LOST THE SIGNAL',
    body: 'The server did not answer. Check your connection and try again.',
  }),
  server: () => ({
    title: 'THE RITUAL BACKFIRED',
    body: 'Something broke on our side. Try again, or open a demo pet.',
  }),
};

export function ErrorCard({ error, repoKey, onRetry }: { error: PetError; repoKey: string; onRetry: () => void }) {
  const { title, body } = COPY[error.kind](repoKey);
  const retryable = error.kind === 'network' || error.kind === 'rate_limited' || error.kind === 'server';
  return (
    <div role="alert" className="mx-auto w-full max-w-xl space-y-5 rounded-md border-2 border-rose-400 bg-zinc-900/90 p-5">
      <h1 className="font-pixel text-[12px] leading-relaxed text-rose-300">{title}</h1>
      <p className="font-mono text-sm leading-relaxed text-zinc-200">{body}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={`${btnGhost} inline-block`}>
          ADOPT ANOTHER REPO
        </Link>
        {retryable && (
          <button type="button" onClick={onRetry} className={btnGhost}>
            TRY AGAIN
          </button>
        )}
      </div>
      <div className="border-t border-zinc-700 pt-4">
        <p className="mb-3 font-mono text-xs text-zinc-400">No setup needed, try a demo pet:</p>
        <DemoChips compact />
      </div>
    </div>
  );
}
