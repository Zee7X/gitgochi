import type { Metadata } from 'next';
import { PetConsole } from '@/components/app/PetConsole';
import { SiteFooter, SiteHeader } from '@/components/app/SiteChrome';

type Params = { owner: string; repo: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { owner, repo } = await params;
  return { title: `${decodeURIComponent(owner)}/${decodeURIComponent(repo)} - GitGotchi` };
}

export default async function PetPage({ params }: { params: Promise<Params> }) {
  const { owner, repo } = await params;
  // Same normalisation as the API (lowercase), so the poll URL and the badge match the stored pet.
  const key = `${decodeURIComponent(owner)}/${decodeURIComponent(repo)}`.toLowerCase();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-2 text-zinc-100">
        <PetConsole key={key} repoKey={key} />
      </main>
      <SiteFooter />
    </>
  );
}
