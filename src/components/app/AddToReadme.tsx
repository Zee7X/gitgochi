'use client';

import { useState } from 'react';
import { btnPrimary } from './styles';

const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/');

/**
 * ADD TO README: copies the badge markdown and opens the repo's README in GitHub's editor, so adding the
 * badge is paste + commit. GitGotchi itself never writes to the repo. Without a README, GitHub's "new file"
 * page opens with the badge already filled in.
 */
export function AddToReadme({ repoKey, snippet }: { repoKey: string; snippet: string }) {
  const [state, setState] = useState<'idle' | 'opened' | 'failed'>('idle');

  const onClick = async () => {
    // Both must start inside the click, or the browser blocks the clipboard and the new tab.
    const copied = navigator.clipboard.writeText(snippet).then(
      () => true,
      () => false
    );
    const tab = window.open('about:blank', '_blank');
    let url = `https://github.com/${repoKey}`;
    try {
      const res = await fetch(`/api/pet/${repoKey}/readme`, { cache: 'no-store' });
      const t = (await res.json()) as { fullName?: string; branch?: string; path?: string | null };
      if (res.ok && t.fullName && t.branch) {
        url = t.path
          ? `https://github.com/${t.fullName}/edit/${enc(t.branch)}/${enc(t.path)}`
          : `https://github.com/${t.fullName}/new/${enc(t.branch)}?filename=README.md&value=${encodeURIComponent(`# ${t.fullName.split('/')[1]}\n\n${snippet}\n`)}`;
      }
    } catch {
      // Fall back to the repo page.
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
    setState((await copied) ? 'opened' : 'failed');
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => void onClick()} className={btnPrimary}>
        ADD TO README
      </button>
      <p role="status" className="text-zinc-400">
        {state === 'opened'
          ? 'Badge copied. In the GitHub tab, put the cursor where it should go, paste (Ctrl+V), then Commit changes.'
          : state === 'failed'
            ? 'GitHub opened, but copying failed. Copy the markdown above, then paste it in the GitHub tab.'
            : 'Copies the badge and opens this repo\u2019s README on GitHub. You paste and commit; GitGotchi never writes to your repo.'}
      </p>
    </div>
  );
}
