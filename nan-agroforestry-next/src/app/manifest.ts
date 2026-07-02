import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'วนเกษตรน่าน | Nan Agroforestry Planner',
    short_name: 'วนเกษตรน่าน',
    description: 'ระบบออกแบบวนเกษตรหลายชั้น สำหรับเกษตรกรน่านและ RECOFTC field pilots – ใช้ดาวเทียม AI ข้อมูล GISTDA',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f5ede3',
    theme_color: '#6b4423',
    categories: ['agriculture', 'productivity'],
    screenshots: [
      {
        src: '/screenshot-1.png',
        sizes: '192x192',
        type: 'image/png',
        form_factor: 'narrow',
      },
      {
        src: '/screenshot-2.png',
        sizes: '512x512',
        type: 'image/png',
        form_factor: 'wide',
      },
    ],
    icons: [
      {
        src: '/favicon.ico',
        sizes: '16x16',
        type: 'image/x-icon',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    lang: 'th',
    dir: 'ltr',
    shortcuts: [
      {
        name: 'ออกแบบวนเกษตร',
        short_name: 'ออกแบบ',
        description: 'เริ่มออกแบบระบบวนเกษตรใหม่',
        url: '/?start=new',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
