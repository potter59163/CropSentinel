# CropSentinel

โฟลเดอร์นี้เก็บ **สองโปรเจคที่แยกขาดจากกัน** ไม่มีโค้ดร่วมกัน และ deploy คนละที่

## `cropsentinel/` — CropSentinel

แพลตฟอร์มติดตามและคาดการณ์ความมั่นคงทางอาหาร พื้นที่นำร่อง **อ.ธัญบุรี จ.ปทุมธานี** (ข้าว KDML105)
คือตัวที่ยื่นประกวดตามข้อเสนอโครงการในไฟล์
`CropSentinel - ชี้พิกัดเตมแมวบุฟเฟ่ต์.pdf` ที่ราก repo

- โครงสร้าง 3 โมดูล: Data Intelligence · Predictive Engine · Decision Platform
- static prototype ไม่มี build step — React + ReactDOM + Babel standalone โหลดจาก unpkg
- เปิดด้วยการเสิร์ฟโฟลเดอร์นี้ตรง ๆ เช่น `npx serve cropsentinel`
- deploy: <https://crop-sentinel.vercel.app/>

> โฟลเดอร์นี้เคยชื่อ `legacy-static/` การเปลี่ยนชื่อ**ไม่ได้**เปลี่ยนค่า Root Directory
> ของโปรเจคใน Vercel ต้องเข้าไปแก้เป็น `cropsentinel` เองก่อน deploy ครั้งถัดไป

## `nan-agroforestry-next/` — วนเกษตรน่าน (น่านไง)

ระบบวางแผนวนเกษตรหลายชั้นสำหรับ จ.น่าน สำหรับเกษตรกรและเจ้าหน้าที่ RECOFTC
เป็นคนละโครงการกับ CropSentinel (เป็นตัวที่ยื่น AgriPitch)

- Next.js 16 App Router + TypeScript, เอนจินคิดแผนทั้งหมดทำงานฝั่ง server
- โมเดล SDM 21 พืช + ข้อมูล NASA POWER / GISTDA / SoilGrids / LDD / DOAE
- `npm install && npm run dev` (พอร์ต 5175 ผ่าน `.claude/launch.json`)
- `npm test` · `npm run typecheck`
- deploy: <https://nan-agroforestry.vercel.app/>
- อ่าน `nan-agroforestry-next/ml/MODEL-FINDINGS.md` ก่อนอ้างตัวเลขความแม่นยำของโมเดลทุกครั้ง

> โฟลเดอร์นี้ไม่ได้เปลี่ยนชื่อ ค่า Root Directory ใน Vercel จึงไม่ต้องแก้

## ของที่ถูกเก็บเข้ากรุ

แอปไฟป่า + ข้าวโพด จ.เชียงใหม่ (Vite + React + Google Maps) เคยอยู่ที่ `src/` ที่ราก repo
พัฒนาช่วง มิ.ย. 2569 แล้วหยุด ไม่เคย deploy และไม่ตรงกับข้อเสนอโครงการ CropSentinel
ตอนนี้ถอดออกจาก working tree แล้ว โค้ดยังอยู่ครบใน git ที่ tag `archive/chiangmai-fire-app`

```bash
git checkout archive/chiangmai-fire-app -- src index.html vite.config.ts tsconfig.json package.json
```
