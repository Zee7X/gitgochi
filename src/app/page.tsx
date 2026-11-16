import { AdoptForm } from '@/components/app/AdoptForm';
import { DemoChips } from '@/components/app/DemoChips';
import { HowItWorks } from '@/components/app/HowItWorks';
import { PetConsole } from '@/components/app/PetConsole';
import { SiteFooter, SiteHeader } from '@/components/app/SiteChrome';

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 text-zinc-100">
        <section className="grid items-center gap-10 py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16 lg:py-12">
          <div className="min-w-0 space-y-8">
            <div className="space-y-4">
              <h1 className="font-pixel text-xl leading-snug text-zinc-50 sm:text-3xl sm:leading-snug">
                Your repo is alive. <span className="text-[#9bbc0f]">Keep it that way.</span>
              </h1>
              <p className="max-w-xl font-mono text-sm leading-relaxed text-zinc-300 sm:text-base">
                GitGotchi is a haunted handheld pet fed by your commits and killed by red builds. Green CI brings it back from the dead.
              </p>
            </div>

            <AdoptForm />

            <div>
              <h2 className="mb-3 font-pixel text-[10px] leading-relaxed text-purple-100">OR MEET A DEMO PET</h2>
              <DemoChips />
            </div>
          </div>

          <div className="min-w-0 lg:order-last">
            <PetConsole repoKey="demo/healthy" variant="device" />
          </div>
        </section>

        <div className="mt-8 lg:mt-14">
          <HowItWorks />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
