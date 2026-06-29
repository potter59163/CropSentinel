'use client';

import { Icon } from '../components/Icon';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="agro-app">
      <div className="agro-gistda danger">
        <span className="agro-gistda-icon"><Icon name="warning" size={24} /></span>
        <div className="agro-gistda-body">
          <b className="thai">ระบบขัดข้อง</b>
          <div className="thai">{error.message || 'ไม่สามารถแสดงผลได้ในขณะนี้'}</div>
          <button type="button" className="btn primary thai" onClick={reset}>ลองใหม่</button>
        </div>
      </div>
    </main>
  );
}
