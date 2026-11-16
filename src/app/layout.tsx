import type { Metadata } from 'next';
import { Press_Start_2P } from 'next/font/google';
import './globals.css';

const pressStart = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pixel',
});

const title = 'GitGotchi - The Repo-Necromancer (Kiroween 2026)';
const description =
  'A 90s virtual pet, resurrected as a live view of your GitHub repo. Pushes feed it, red CI drains its HP, and a green build brings it back from the dead.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    siteName: 'GitGotchi',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={pressStart.variable}>
      <body className="min-h-screen bg-zinc-950 flex flex-col justify-between antialiased">
        {children}
      </body>
    </html>
  );
}
