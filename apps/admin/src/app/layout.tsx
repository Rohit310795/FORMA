import type { Metadata } from 'next';
import { themes } from '@forma/shared';
import './globals.css';

export const metadata: Metadata = {
  title: 'FORMA Admin',
  description: 'FORMA owner console',
  robots: { index: false, follow: false },
};

const vars = (t: Record<string, string>) => Object.entries(t).map(([k, v]) => `--${k}:${v};`).join('');
const css = `:root{${vars(themes.dark as unknown as Record<string, string>)}}@media (prefers-color-scheme: light){:root{${vars(themes.light as unknown as Record<string, string>)}}}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
