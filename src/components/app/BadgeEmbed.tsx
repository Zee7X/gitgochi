'use client';

import { Panel, CopyButton, useOrigin } from './ui';

export function BadgeEmbed({ repoKey, version }: { repoKey: string; version: string }) {
  const origin = useOrigin();
  const path = `/api/badge/${repoKey}.svg`;
  const snippet = `[![GitGotchi](${origin}${path})](${origin}/pet/${repoKey})`;
  return (
    <Panel title="README BADGE">
      <div className="mb-3 flex min-h-[3.5rem] items-center justify-center overflow-hidden rounded border border-zinc-800 bg-zinc-950 p-2">
        {/* Plain img on purpose: the badge is an SVG served by our own API. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${path}?v=${encodeURIComponent(version)}`} alt={`GitGotchi badge for ${repoKey}`} className="max-w-full" />
      </div>
      <label htmlFor="badge-snippet" className="mb-1 block text-zinc-400">
        Markdown for your README
      </label>
      <textarea
        id="badge-snippet"
        readOnly
        rows={3}
        value={origin ? snippet : ''}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full resize-none break-all rounded border border-zinc-700 bg-zinc-950 p-2 text-[11px] text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      />
      <div className="mt-2">
        <CopyButton text={snippet} label="COPY MARKDOWN" />
      </div>
    </Panel>
  );
}
