import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '@/components/app/SiteChrome';

export const metadata: Metadata = { title: 'Privacy - GitGotchi' };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-pixel text-[10px] leading-relaxed text-[#9bbc0f]">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** What GitGotchi stores, where, for how long, who can read it, and how to delete it (accounts R9.9). */
export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 pb-10 pt-2 font-mono text-sm leading-relaxed text-zinc-300">
        <h1 className="font-pixel text-sm leading-relaxed text-zinc-50">PRIVACY</h1>

        <Section title="WHAT IS STORED">
          <ul className="list-inside list-disc space-y-1">
            <li>For each pet: its stats (HP, fullness, sanity), stage, counts such as commits and stale issues, and up to 50 event log entries like &quot;PUSH! +5 FOOD&quot;.</li>
            <li>The file path of a code smell the Kiro hook reported, inside its event.</li>
            <li>Hashes of badge keys and hook tokens. The keys and tokens themselves are shown once and not kept.</li>
            <li>When you sign in: your GitHub id, login and avatar URL, and your GitHub access and refresh tokens, encrypted.</li>
          </ul>
        </Section>

        <Section title="WHAT IS NEVER STORED">
          <p>Code, diffs, commit messages, author names or emails, branch names, issue and pull request titles or bodies, workflow names and run links. Webhook bodies are read for the event type and counts, then dropped.</p>
          <p>The Summon Kiro diagnosis reads failing runs and stale issue titles from GitHub when you ask for it, shows them to you, and does not keep them.</p>
        </Section>

        <Section title="PRIVATE REPOS">
          <ul className="list-inside list-disc space-y-1">
            <li>Only people with access to the repo on GitHub see its pet. Everyone else gets the same &quot;not found&quot; as for a repo that does not exist.</li>
            <li>A private pet is encrypted (AES-256-GCM) by the app before it is written to the store.</li>
            <li>Private pages and API answers are sent with no-store and noindex, so they are not cached or indexed.</li>
            <li>The GitGotchi App has read-only permissions and only on the repos it is installed on. It never writes to a repo.</li>
          </ul>
        </Section>

        <Section title="WHERE AND HOW LONG">
          <ul className="list-inside list-disc space-y-1">
            <li>The app runs on Vercel. Pets and sessions are stored in Upstash Redis (region us-east-1), over TLS. Sign in passes through gitgochi.vercel.app, which hands the session back with a one-time ticket and keeps no cookie.</li>
            <li>Pets stay until a keeper deletes them, or, for private repos, until the app is uninstalled from the repo.</li>
            <li>Sessions end when you sign out, or 30 days after their last use.</li>
            <li>Demo pets are stored only in your own browser.</li>
          </ul>
        </Section>

        <Section title="WHO CAN READ IT">
          <p>
            The person who operates this deployment controls the server and the encryption keys, so they can technically read what is stored, and
            they can see repo names in request logs and store keys. Encryption protects against a leaked copy of the store, not against the
            operator. If that is not acceptable for a repo, do not install the app on it.
          </p>
        </Section>

        <Section title="HOW TO DELETE">
          <ul className="list-inside list-disc space-y-1">
            <li>Keepers: DELETE PET on the pet page removes its stats, history, badge key and tokens at once.</li>
            <li>Uninstalling the app from a private repo deletes its pet.</li>
            <li>SIGN OUT deletes your session and revokes its GitHub token at GitHub, so a copy of the token stops working. You can also revoke GitGotchi in your GitHub settings under Applications.</li>
          </ul>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
