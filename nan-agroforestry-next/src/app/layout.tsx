import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'วนเกษตรน่าน | Nan Agroforestry Planner',
  description: 'Decision support system for Nan agroforestry transition, ReCorp field pilots, GISTDA risk verification, and farm cashflow planning.',
  applicationName: 'Nan Agroforestry Planner',
  openGraph: {
    title: 'Nan Agroforestry Planner',
    description: 'Space-tech decision support for forest-friendly agroforestry in Nan province.',
    type: 'website',
    locale: 'th_TH',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nan Agroforestry Planner',
    description: 'Farm design calculator for agroforestry, GISTDA risk, cashflow, and field validation.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#06120f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
