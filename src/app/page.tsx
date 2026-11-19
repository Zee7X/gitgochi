import { cookies } from 'next/headers';
import { HomeHero } from '@/components/app/HomeHero';
import { HowItWorks } from '@/components/app/HowItWorks';
import { SiteFooter, SiteHeader } from '@/components/app/SiteChrome';
import { SESSION_COOKIE } from '@/lib/session';

export default async function Home() {
  // Only the cookie's presence is read here (no store call); the client then asks who is signed in.
  const maybeSignedIn = (await cookies()).has(SESSION_COOKIE);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 text-zinc-100">
        <HomeHero maybeSignedIn={maybeSignedIn} />

        <div className="mt-8 lg:mt-14">
          <HowItWorks />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
