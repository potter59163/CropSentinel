import { Icon } from '../components/Icon';

export default function NotFound() {
  return (
    <main className="agro-app">
      <div className="agro-gistda warn">
        <span className="agro-gistda-icon"><Icon name="pin" size={24} /></span>
        <div className="agro-gistda-body">
          <b className="thai">ไม่พบหน้าที่ต้องการ</b>
          <div className="thai">กลับไปหน้าแพลนเนอร์เพื่อออกแบบระบบวนเกษตรน่าน</div>
        </div>
      </div>
    </main>
  );
}
