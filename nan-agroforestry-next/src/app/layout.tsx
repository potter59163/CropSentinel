import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

// Self-hosted at build time (served from our own origin) — no render-blocking
// @import, no external Google Fonts request, no layout shift. Only the weights we
// actually use; the previously-loaded Inter family was unused and is dropped.
const notoThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-thai',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'วนเกษตรน่าน | Nan Agroforestry Planner',
  description: 'ระบบวิเคราะห์วนเกษตรหลายชั้น สำหรับเกษตรกรน่านและ RECOFTC – ใช้ดาวเทียม AI ข้อมูล GISTDA และการคำนวณรายได้10ปี',
  applicationName: 'Nan Agroforestry Planner',
  metadataBase: new URL('https://nan-agroforestry.vercel.app'),
  keywords: ['วนเกษตร', 'agroforestry', 'น่าน', 'RECOFTC', 'ระบบสนับสนุนการตัดสินใจ', 'SDM', 'GISTDA', 'NASA POWER'],
  authors: [{ name: 'Potter' }],
  creator: 'Potter',
  publisher: 'CropSentinel',
  openGraph: {
    title: 'วนเกษตรน่าน | Nan Agroforestry Planner',
    description: 'ออกแบบระบบวนเกษตรหลายชั้น จากข้อมูลดาวเทียม GISTDA + โมเดล AI',
    type: 'website',
    locale: 'th_TH',
    url: 'https://nan-agroforestry.vercel.app',
    siteName: 'Nan Agroforestry Planner',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'วนเกษตรน่าน | Nan Agroforestry Planner',
    description: 'ระบบวิเคราะห์วนเกษตรสำหรับเกษตรกรและ RECOFTC',
    creator: '@CropSentinel',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#0c6654', // --sugar-1; the old #6b4423 was a leftover from the CropSentinel palette
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={notoThai.variable}>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
