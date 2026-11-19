'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { parseRepo } from './parse-repo';
import { btnPrimary } from './ui';

/** `label` and `hint` change with the context: visitors adopt, signed-in users look a repo up. */
export function AdoptForm({
  label = 'ADOPT YOUR REPO',
  hint = 'Any public repo works without signing in. Its pet comes from real CI runs, commits and issues.',
}: { label?: string; hint?: string } = {}) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const key = parseRepo(value);
    if (!key) {
      setError('Use owner/repo or a github.com link, like vercel/next.js.');
      return;
    }
    setError(null);
    router.push(`/pet/${key}`);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <label htmlFor="adopt-repo" className="mb-2 block font-pixel text-[10px] leading-relaxed text-purple-100">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="adopt-repo"
          name="repo"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="owner/repo or github.com/owner/repo"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'adopt-hint adopt-error' : 'adopt-hint'}
          className="min-w-0 flex-1 rounded border-2 border-purple-600 bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        />
        <button type="submit" className={`${btnPrimary} py-3`}>
          ADOPT
        </button>
      </div>
      <p id="adopt-hint" className="mt-2 font-mono text-xs text-zinc-400">
        {hint}
      </p>
      {error && (
        <p id="adopt-error" role="alert" className="mt-2 font-mono text-xs text-rose-300">
          {error}
        </p>
      )}
    </form>
  );
}
