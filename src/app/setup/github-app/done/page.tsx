import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/app/SiteChrome';
import { CopyButton } from '@/components/app/ui';
import { safeEqual } from '@/lib/crypto';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'GitGotchi App created', robots: { index: false } };

/**
 * GitHub sends the owner back here with a one-time code (valid one hour). The code is exchanged for the
 * app credentials by whoever deploys GitGotchi, and goes straight into the Vercel environment.
 */
export default async function SetupDone({ searchParams }: { searchParams: Promise<{ code?: string; state?: string }> }) {
  const { code, state } = await searchParams;
  const expected = process.env.SETUP_TOKEN;
  if (!expected || !state || !safeEqual(state, expected)) notFound();
  const valid = typeof code === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(code);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 pb-10 pt-2 font-mono text-sm text-zinc-200">
        <h1 className="font-pixel text-sm leading-relaxed text-[#9bbc0f]">APP CREATED</h1>
        {valid ? (
          <>
            <p>Copy this one-time code and send it to whoever deploys GitGotchi. It works once, for one hour.</p>
            <code className="block break-all rounded border border-zinc-700 bg-zinc-950 p-3 text-zinc-100">{code}</code>
            <CopyButton text={code} label="COPY CODE" />
          </>
        ) : (
          <p>GitHub did not send a code. Start again from the setup page.</p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
