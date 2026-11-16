import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GitGotchi - The Repo-Necromancer (Kiroween 2026)',
  description:
    'Retro virtual pet driven by your GitHub repository health, CI/CD, and MCP auto-healing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 flex flex-col justify-between antialiased">
        {children}
      </body>
    </html>
  );
}
