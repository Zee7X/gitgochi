'use client';

import { useEffect, useRef } from 'react';
import type { HealDiagnosis } from '@/lib/types';
import { btnGhost, btnPrimary, CopyButton } from './ui';

export type HealState =
  | { status: 'loading' }
  | { status: 'ready'; diagnosis: HealDiagnosis }
  | { status: 'error'; message: string };

const KIND: Record<HealDiagnosis['findings'][number]['kind'], string> = {
  ci: 'CI',
  issue: 'ISSUE',
  poop: 'POOP',
  hunger: 'HUNGER',
};

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex="0"]';

export function HealModal({ state, repo, onClose }: { state: HealState; repo: string; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // Focus trap + Escape. Capture phase, so the handheld's own A/B/C shortcuts never see these keys.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    (items()[0] ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const outside = !el.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby="summon-title"
        aria-busy={state.status === 'loading'}
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-lg flex-col border-4 border-[#0f380f] bg-[#9bbc0f] font-mono text-xs text-[#0f380f] shadow-[8px_8px_0_#000] outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b-4 border-[#0f380f] px-4 py-3">
          <h2 id="summon-title" className="font-pixel text-[11px] leading-relaxed">
            SUMMON KIRO
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog (Escape)"
            className="border-2 border-[#0f380f] px-2 py-1.5 font-pixel text-[9px] leading-none hover:bg-[#8bac0f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f380f]"
          >
            ESC
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
          {state.status === 'loading' && <p className="font-pixel text-[10px] leading-relaxed">READING {repo.toUpperCase()}...</p>}

          {state.status === 'error' && (
            <p role="alert" className="font-bold">
              The ritual fizzled: {state.message}. Close this and try HEAL again.
            </p>
          )}

          {state.status === 'ready' && (
            <>
              <p>
                Read-only diagnosis of <b className="break-all">{state.diagnosis.repo}</b>. Nothing was changed. Paste the prompt into Kiro
                and let it work spec-first.
              </p>

              {state.diagnosis.findings.length === 0 ? (
                <p className="border-2 border-[#0f380f] p-3 font-bold">Nothing to fix. The repo is behaving.</p>
              ) : (
                <ol className="space-y-2">
                  {state.diagnosis.findings.map((f, i) => (
                    <li key={`${f.kind}-${i}`} className="border-2 border-[#0f380f] bg-[#8bac0f] p-2.5">
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 bg-[#0f380f] px-1.5 py-1 font-pixel text-[7px] leading-none text-[#9bbc0f]">
                          {KIND[f.kind]}
                        </span>
                        {f.url ? (
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="min-w-0 break-words font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f380f]"
                          >
                            {f.title}
                            <span className="sr-only"> (opens GitHub in a new tab)</span>
                          </a>
                        ) : (
                          <span className="min-w-0 break-words font-bold">{f.title}</span>
                        )}
                      </div>
                      <p className="mt-1.5 break-words pl-1">{f.detail}</p>
                    </li>
                  ))}
                </ol>
              )}

              <div>
                <div className="mb-1.5 font-pixel text-[8px]">KIRO PROMPT</div>
                <pre
                  tabIndex={0}
                  aria-label="Kiro prompt"
                  className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-2 border-[#0f380f] bg-[#0f380f] p-3 text-[11px] text-[#9bbc0f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f380f]"
                >
                  {state.diagnosis.kiroPrompt}
                </pre>
              </div>
            </>
          )}
        </div>

        {state.status === 'ready' && (
          <div className="flex flex-wrap gap-3 border-t-4 border-[#0f380f] px-4 py-3">
            <CopyButton
              text={state.diagnosis.kiroPrompt}
              label="COPY PROMPT"
              className={`${btnPrimary} !border-[#0f380f] !bg-[#0f380f] !text-[#9bbc0f] hover:!bg-[#8bac0f] hover:!text-[#0f380f] focus-visible:!outline-[#0f380f]`}
            />
            <button
              type="button"
              onClick={onClose}
              className={`${btnGhost} !border-[#0f380f] !bg-transparent !text-[#0f380f] hover:!bg-[#8bac0f] focus-visible:!outline-[#0f380f]`}
            >
              CLOSE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
