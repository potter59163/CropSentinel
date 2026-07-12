import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimited } from '@/lib/rateLimit';
import { adminCookieName, adminSessionToken, isValidAdminPassword } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  // Password guesses are cheap to brute-force without a hard per-IP cap.
  const limited = rateLimited(request, 'admin-login', 8, 60_000);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า ADMIN_PASSWORD บนเซิร์ฟเวอร์' }, { status: 503 });
  }
  if (!isValidAdminPassword(parsed.data.password)) {
    return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName(), adminSessionToken()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
