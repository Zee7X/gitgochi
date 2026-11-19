'use client';

import { useMe, useMyPets } from '@/hooks/useMe';
import { DemoChips } from './DemoChips';
import { PetChips, myPetChip } from './PetChips';

/** Bottom of the pet page: the user's other pets when signed in, demo pets otherwise. */
export function MorePets({ current }: { current: string }) {
  const me = useMe();
  const pets = useMyPets(!!me?.signedIn);
  const others = (pets ?? []).filter((p) => p.key !== current);

  if (!me?.signedIn || !pets) {
    return (
      <div className="mt-12 border-t-2 border-purple-900 pt-6">
        <h2 className="mb-3 font-pixel text-[10px] leading-relaxed text-[#9bbc0f]">MEET ANOTHER PET</h2>
        <DemoChips current={current} />
      </div>
    );
  }

  return (
    <div className="mt-12 space-y-6 border-t-2 border-purple-900 pt-6">
      {others.length > 0 && (
        <div>
          <h2 className="mb-3 font-pixel text-[10px] leading-relaxed text-[#9bbc0f]">YOUR OTHER PETS</h2>
          <PetChips items={others.map(myPetChip)} label="Your other pets" />
        </div>
      )}
      <div>
        <h2 className="mb-3 font-pixel text-[10px] leading-relaxed text-purple-100">TRY A DEMO PET</h2>
        <DemoChips current={current} compact />
      </div>
    </div>
  );
}
