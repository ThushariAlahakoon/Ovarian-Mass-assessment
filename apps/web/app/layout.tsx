import type { Metadata, Viewport } from 'next';
import { AppHeader } from '@/components/AppHeader';
import { StoreProvider } from '@/lib/store';
import './globals.css';

export const metadata: Metadata = {
  title: 'CFWU Adnexal Mass Assessment (prototype)',
  description: 'IOTA / O-RADS adnexal mass assessment prototype. Synthetic data only.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        <StoreProvider>
          <AppHeader />
          <main className="page">{children}</main>
        </StoreProvider>
      </body>
    </html>
  );
}
