'use client';

import Link from 'next/link';
import { useMe, useMyPets } from '@/hooks/useMe';
import { AdoptForm } from './AdoptForm';
import { DemoChips } from './DemoChips';
import { PetConsole } from './PetConsole';
import { PetChips, myPetChip } from './PetChips';
import { btnPrimary } from './styles';

const intro = (
  <p className="max-w-xl font-mono text-sm leading-relaxed text-zinc-300 sm:text-base">
    GitGotchi is a haunted handheld pet fed by your commits and killed by red builds. Green CI brings it back from the dead.
  </p>
);

/** What visitors see: a demo pet on the device and the three demo chips. */
function PublicHero() {
  return (
    <section className="grid items-center gap-10 py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16 lg:py-12">
      <div className="min-w-0 space-y-8">
        <div className="space-y-4">
          <h1 className="font-pixel text-xl leading-snug text-zinc-50 sm:text-3xl sm:leading-snug">
            Your repo is alive. <span className="text-[#9bbc0f]">Keep it that way.</span>
          </h1>
          {intro}
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
  );
}

/**
 * Signed-in home: the user's own pet on the device and their other pets as chips. Demo pets move to a small
 * section at the bottom. `maybeSignedIn` comes from the presence of the session cookie, so visitors never wait.
 */
export function HomeHero({ maybeSignedIn }: { maybeSignedIn: boolean }) {
  const me = useMe();
  const pets = useMyPets(maybeSignedIn);

  if (!maybeSignedIn || pets === null) return <PublicHero />;

  const loading = pets === undefined;
  const first = pets?.[0];
  return (
    <>
      <section className="grid items-center gap-10 py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16 lg:py-12">
        <div className="min-w-0 space-y-8">
          <div className="space-y-4">
            <h1 className="font-pixel text-xl leading-snug text-zinc-50 sm:text-3xl sm:leading-snug">
              Welcome back{me?.login ? `, @${me.login}` : ''}. <span className="text-[#9bbc0f]">Keep them alive.</span>
            </h1>
            {intro}
          </div>

          <div>
            <h2 className="mb-3 font-pixel text-[10px] leading-relaxed text-purple-100">YOUR PETS</h2>
            {loading ? (
              <p className="font-mono text-xs text-zinc-400">Loading your pets...</p>
            ) : pets.length ? (
              <PetChips items={pets.map(myPetChip)} current={first?.key} label="Your pets" />
            ) : (
              <div className="space-y-3 font-mono text-sm text-zinc-300">
                <p>No pets yet. Install the GitGotchi App on a repo and its pet shows up here.</p>
                {me?.installUrl && (
                  <a href={me.installUrl} className={`${btnPrimary} inline-block`}>
                    INSTALL GITGOTCHI
                  </a>
                )}
              </div>
            )}
            {!loading && pets.length > 0 && (
              <p className="mt-3 font-mono text-xs">
                <Link href="/me" className="text-zinc-300 underline hover:text-zinc-100">
                  Manage your pets
                </Link>
                {me?.installUrl && (
                  <>
                    <span className="mx-2 text-zinc-500">|</span>
                    <a href={me.installUrl} className="text-zinc-300 underline hover:text-zinc-100">
                      Add a repo
                    </a>
                  </>
                )}
              </p>
            )}
          </div>

          <AdoptForm
            label="LOOK UP ANY REPO"
            hint="Open the pet of any public repo, yours or someone else's. You can care for it if you have push access. Private repos appear in YOUR PETS once the app is installed on them."
          />
        </div>

        <div className="min-w-0 lg:order-last">
          {loading ? (
            <div className="mx-auto flex min-h-[560px] w-full max-w-[380px] items-center justify-center rounded-[48px] border-2 border-purple-900 font-pixel text-[9px] text-purple-200">
              LOADING YOUR PET...
            </div>
          ) : (
            <PetConsole key={first?.key ?? 'demo/healthy'} repoKey={first?.key ?? 'demo/healthy'} variant="device" />
          )}
        </div>
      </section>

      <section className="mt-4 border-t-2 border-purple-900 pt-6">
        <h2 className="mb-1 font-pixel text-[10px] leading-relaxed text-purple-100">TRY A DEMO PET</h2>
        <p className="mb-3 font-mono text-xs text-zinc-400">Practice pets with a simulator. Your changes stay in this browser and never touch a real repo.</p>
        <DemoChips compact />
      </section>
    </>
  );
}
