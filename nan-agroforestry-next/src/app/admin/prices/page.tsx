import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { adminCookieName, isValidAdminToken } from '@/lib/adminAuth';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { AdminPriceEditor } from '@/components/admin/AdminPriceEditor';
import '@/styles/admin.css';

// Kept out of robots.ts too — this belt-and-suspenders noindex covers the
// page even if it's ever reached without a crawl (e.g. a direct link).
export const metadata: Metadata = {
  title: 'จัดการราคาพืชผล',
  robots: { index: false, follow: false },
};

export default async function AdminPricesPage() {
  const store = await cookies();
  const authed = isValidAdminToken(store.get(adminCookieName())?.value);
  return <div className="admin-root">{authed ? <AdminPriceEditor /> : <AdminLoginForm />}</div>;
}
