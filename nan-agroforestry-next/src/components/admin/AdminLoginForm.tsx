'use client';

import { useState, type FormEvent } from 'react';

export function AdminLoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'เข้าสู่ระบบไม่สำเร็จ');
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch {
      setError('เชื่อมต่อไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <form className="admin-login-card" onSubmit={submit}>
      <h1>จัดการราคาพืชผล</h1>
      <p>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="รหัสผ่าน"
        autoFocus
      />
      <button type="submit" disabled={busy || !password}>
        {busy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
      </button>
      {error && <p className="admin-error">{error}</p>}
    </form>
  );
}
