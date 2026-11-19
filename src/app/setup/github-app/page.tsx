import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/app/SiteChrome';
import { btnPrimary } from '@/components/app/styles';
import { safeEqual } from '@/lib/crypto';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Register the GitGotchi App', robots: { index: false } };

/**
 * One-time helper for the deployment owner (accounts task 5): posts a GitHub App manifest, so the app is
 * created with exactly the read-only permissions and events of the design. Hidden unless SETUP_TOKEN is set
 * and passed as ?token=.
 */
export default async function SetupGitHubApp({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const expected = process.env.SETUP_TOKEN;
  if (!expected || !token || !safeEqual(token, expected)) notFound();

  const h = await headers();
  const origin = process.env.APP_ORIGIN || `https://${h.get('host')}`;
  const manifest = {
    name: process.env.GITHUB_APP_NAME || 'GitGotchi Pet',
    url: origin,
    description: 'A 90s virtual pet whose health is your repo health. Read-only: GitGotchi never writes to your repository.',
    hook_attributes: { url: `${origin}/api/github-app/webhook`, active: true },
    redirect_url: `${origin}/setup/github-app/done`,
    callback_urls: [`${origin}/api/auth/callback`],
    setup_url: `${origin}/me`,
    request_oauth_on_install: true,
    public: true,
    default_permissions: {
      metadata: 'read',
      contents: 'read',
      actions: 'read',
      checks: 'read',
      issues: 'read',
      pull_requests: 'read',
    },
    default_events: ['push', 'check_run', 'workflow_run', 'pull_request', 'issues', 'repository'],
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 pb-10 pt-2 font-mono text-sm text-zinc-200">
        <h1 className="font-pixel text-sm leading-relaxed text-[#9bbc0f]">REGISTER THE GITGOTCHI APP</h1>
        <p>This creates a GitHub App on your account with read-only access: metadata, contents, actions, checks, issues and pull requests. It never gets write access.</p>
        <p>
          Webhook: <code className="break-all">{manifest.hook_attributes.url}</code>
          <br />
          Sign-in callback: <code className="break-all">{manifest.callback_urls[0]}</code>
        </p>
        <form action={`https://github.com/settings/apps/new?state=${encodeURIComponent(token)}`} method="post">
          <input type="hidden" name="manifest" value={JSON.stringify(manifest)} />
          <button type="submit" className={btnPrimary}>
            CREATE GITHUB APP
          </button>
        </form>
        <p className="text-zinc-400">If GitHub says the name is taken, change it on the GitHub page before you confirm.</p>
      </main>
      <SiteFooter />
    </>
  );
}
