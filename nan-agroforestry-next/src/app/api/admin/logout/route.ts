import { NextResponse } from 'next/server';
import { adminCookieName } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName(), '', { path: '/', maxAge: 0 });
  return res;
}
