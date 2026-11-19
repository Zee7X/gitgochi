import type { Metadata } from 'next';
import { MyPets } from '@/components/app/MyPets';
import { SiteFooter, SiteHeader } from '@/components/app/SiteChrome';

export const metadata: Metadata = { title: 'My pets - GitGotchi', robots: { index: false } };

export default function MePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 pb-10 pt-2 text-zinc-100">
        <h1 className="font-pixel text-sm leading-relaxed text-[#9bbc0f]">MY PETS</h1>
        <MyPets />
      </main>
      <SiteFooter />
    </>
  );
}
