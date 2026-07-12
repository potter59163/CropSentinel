import Link from 'next/link';
import { Icon } from '../components/Icon';

export default function NotFound() {
  return (
    <main className="agro-app agro-notfound">
      <div className="agro-gistda warn">
        <span className="agro-gistda-icon"><Icon name="pin" size={24} /></span>
        <div className="agro-gistda-body">
          <b className="thai">ไม่พบหน้าที่ต้องการ</b>
          <div className="thai">ลิงก์นี้อาจพิมพ์ผิดหรือไม่มีอยู่จริง กลับไปหน้าแพลนเนอร์เพื่อออกแบบระบบวนเกษตรน่าน</div>
        </div>
      </div>
      <Link href="/" className="agro-submit agro-notfound-btn thai">กลับหน้าหลัก</Link>
    </main>
  );
}
