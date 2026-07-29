import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import AppProviders from '@/components/providers/AppProviders';
import ImpersonationBanner from '@/components/admin/ImpersonationBanner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OMGLaunch Dashboard',
  description: 'AI-powered SEO analysis and workflow platform',
  openGraph: {
    images: [{ url: 'https://bolt.new/static/og_default.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [{ url: 'https://bolt.new/static/og_default.png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ImpersonationBanner />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
