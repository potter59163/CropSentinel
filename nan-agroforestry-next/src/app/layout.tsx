import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'วนเกษตรน่าน | Nan Agroforestry Planner',
  description: 'ระบบวิเคราะห์วนเกษตรชั้นเดียว สำหรับเกษตรกรน่านและ ReCorp – ใช้ดาวเทียม AI ข้อมูล GISTDA และการคำนวณรายได้10ปี',
  applicationName: 'Nan Agroforestry Planner',
  metadataBase: new URL('https://nan-agroforestry.vercel.app'),
  keywords: ['วนเกษตร', 'agroforestry', 'น่าน', 'ReCorp', 'ระบบสนับสนุนการตัดสินใจ', 'ชานมไข่มุก'],
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
    description: 'ระบบวิเคราะห์วนเกษตรสำหรับเกษตรกรและ ReCorp',
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
  themeColor: '#6b4423',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
