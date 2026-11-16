'use client';

import { CopyButton, useOrigin } from './ui';

const EVENTS = ['Pushes', 'Check runs', 'Pull requests', 'Issues'];

export function WebhookSetup() {
  const origin = useOrigin();
  const url = `${origin}/api/webhook/github`;
  return (
    <details className="group rounded-md border-2 border-purple-900 bg-zinc-900/80">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        <span className="font-pixel text-[9px] leading-relaxed tracking-wider text-[#9bbc0f]">WEBHOOK SETUP</span>
        <span className="font-mono text-[11px] text-zinc-400 group-open:hidden">show</span>
        <span className="hidden font-mono text-[11px] text-zinc-400 group-open:inline">hide</span>
      </summary>
      <div className="space-y-3 border-t-2 border-purple-900 p-3 font-mono text-xs text-zinc-300">
        <p className="text-zinc-400">Repo settings, Webhooks, Add webhook. Your pet then reacts to real events.</p>
        <div>
          <div className="mb-1 text-zinc-400">Payload URL</div>
          <code className="block break-all rounded border border-zinc-700 bg-zinc-950 p-2 text-[11px] text-zinc-200">{origin ? url : '...'}</code>
          <div className="mt-2">
            <CopyButton text={url} label="COPY URL" />
          </div>
        </div>
        <div>
          <div className="text-zinc-400">Content type</div>
          <code className="text-zinc-100">application/json</code>
        </div>
        <div>
          <div className="text-zinc-400">Secret</div>
          <span>Optional. If the server sets GITHUB_WEBHOOK_SECRET, use the same value.</span>
        </div>
        <div>
          <div className="text-zinc-400">Events to send</div>
          <ul className="list-inside list-disc text-zinc-100">
            {EVENTS.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
