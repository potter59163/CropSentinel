import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nan Agroforestry Planner',
    short_name: 'Nan Agro',
    description: 'Farm design calculator and decision support for Nan agroforestry field pilots.',
    start_url: '/',
    display: 'standalone',
    background_color: '#06120f',
    theme_color: '#0f2a22',
    lang: 'th',
  };
}
