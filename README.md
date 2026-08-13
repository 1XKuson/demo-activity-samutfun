# demo-activity

กิจกรรมทดสอบตัวเล็กที่สุดสำหรับ Dreambook — **ตอบถูกครบ 3 ข้อ = กิจกรรมสำเร็จ**
ใช้พิสูจน์ว่า launch (Model-B handoff) + callback ทำงานครบ loop จริง

สเปกที่ implement ตาม: `dreambook-backend/documents/activity-integration-guideline.md`

## มีอะไรบ้าง

ไม่มี build step, ไม่มี backend ของตัวเอง — เสิร์ฟไฟล์ static ตรง ๆ

| ไฟล์ | ทำอะไร |
|---|---|
| [`index.html`](index.html) | route `/` — กิจกรรมจริง (verify launch JWT + callback กลับ Dreambook) |
| [`demo/index.html`](demo/index.html) | route `/demo` — กิจกรรมเดียวกันแบบไม่ต่อ backend |
| [`quiz.js`](quiz.js) | คำถาม 3 ข้อ + การ render ควิซ ใช้ร่วมกันทั้งสอง route |
| [`app.css`](app.css) | สไตล์ (Apple HIG tokens) ใช้ร่วมกันทั้งสอง route |

### route `/` — flow จริง

| ขั้น | ทำอะไร |
|---|---|
| 1 | อ่าน `?token=` จาก URL (launch JWT) |
| 2 | verify RS256 ด้วย WebCrypto กับ `<api>/.well-known/jwks.json` (เลือกกุญแจตาม `kid`) |
| 3 | เช็ค `iss=dreambook`, `aud=demo-activity`, `exp`, กัน `jti` ซ้ำผ่าน localStorage |
| 4 | `GET /activities/:id/student-context` ด้วย `report_token` → ทักชื่อเล่น + ห้อง |
| 5 | ควิซ 3 ข้อ ตอบผิดได้ ไม่มีโทษ ตอบใหม่จนถูก |
| 6 | ครบ 3 ข้อ → `PUT /activities/:id/progress` → backend mark completed + แจกเหรียญ |
| 7 | รายงานผลเสร็จ → เด้งกลับ `/?sticker=<stickerId>` (id จาก `reward` ที่ backend ตอบมา) |

### route `/demo` — โหมดทดลอง

`http://localhost:5175/demo` เปิดได้เลย ไม่ต้องมี token ไม่ต้องมี backend ไม่ต้องมี CORS
ใช้ตอนโชว์งาน รีวิวดีไซน์ หรือเปิดออฟไลน์

- ตัดทิ้ง: `?token=`, verify JWT, JWKS, `student-context`, `PUT /progress`, redirect กลับแอป
- เหลือ: ควิซ 3 ข้อชุดเดียวกัน (มาจาก `quiz.js`) + หน้าจบ + ปุ่ม **เล่นอีกครั้ง**
- ไม่มีการส่งผลหรือแจกเหรียญจริง

คำถามและหน้าตาควิซอยู่ใน `quiz.js` ไฟล์เดียว ทั้งสอง route จึงไม่มีทางเพี้ยนจากกัน

## รัน

```bash
# ที่ demo-activity/
python3 -m http.server 5175
# หรือ: npx serve -l 5175 .
```

ค่า default ชี้ backend ที่ `http://localhost:3000` — เปลี่ยนได้ด้วย query param
โดยไม่ต้องแก้ไฟล์:

| param | default | ใช้ทำอะไร |
|---|---|---|
| `token` | — | launch JWT (บังคับ) |
| `api` | `http://localhost:3000` | host ของ Dreambook backend |
| `iss` | `dreambook` | issuer ที่คาดหวัง |
| `aud` | `demo-activity` | audience ที่คาดหวัง |
| `return` | origin ปัจจุบัน | origin ของ web app ที่จะเด้งกลับหลังจบ (ใส่ตอน dev เมื่อ activity คนละ port กับแอป เช่น `http://localhost:5173`) |

## เด้งกลับหลังจบกิจกรรม

หลัง `PUT /activities/:id/progress` สำเร็จ หน้าจะโชว์ผล ~1.5 วิ แล้ว `location.replace()`
ไปที่ `<return>/?sticker=<stickerId>` โดย `stickerId` มาจาก `reward.id` ใน response
(หน้า Journal ของ web app อ่าน `?sticker=` แล้วเปิดเหรียญใบนั้น) ถ้ากิจกรรมไม่มีเหรียญ
(`reward: null`) จะเด้งไปที่ `/` เฉย ๆ

ใช้ `replace()` ไม่ใช่ `assign()` เพราะ launch token ใช้ครั้งเดียว — กด Back กลับมา URL เดิม
จะโดน `jti` ซ้ำปฏิเสธ

## ทดสอบ end-to-end กับ backend

1. seed catalog (ฝั่ง dreambook-backend) — entry `Demo Activity` ชี้ `web_url` มาที่
   `http://localhost:5175`
   ```bash
   cd ../dreambook-backend && pnpm prisma db seed
   ```
2. ครูสร้าง instance จาก catalog id `00000000-0000-4000-a000-000000000003`
   ```bash
   curl -X POST http://localhost:3000/activities \
     -H "Authorization: Bearer <teacher JWT>" -H 'Content-Type: application/json' \
     -d '{"activity_catalog_id":"00000000-0000-4000-a000-000000000003"}'
   ```
3. นักเรียน launch → ได้ `launchUrl` (คือ `http://localhost:5175?token=…`)
   ```bash
   curl -X POST http://localhost:3000/activities/<instanceId>/launch \
     -H "Authorization: Bearer <student JWT>"
   ```
4. เปิด `launchUrl` ในเบราว์เซอร์ → ตอบให้ครบ 3 ข้อ → ได้ **เหรียญนักทดสอบ**

### CORS

หน้านี้เรียก backend ข้าม origin — dev ต้องตั้ง `CORS_ORIGIN="*"` (หรือใส่
`http://localhost:5175` ในลิสต์) ไม่งั้น JWKS/callback จะโดนบล็อก

### หมายเหตุ dev

- ถ้า backend ไม่ได้ตั้ง `DREAMBOOK_LAUNCH_PRIVATE_KEY` มันจะสร้าง keypair ใหม่ทุก
  restart → JWKS เปลี่ยน → token เก่าจะ verify ไม่ผ่าน (หน้านี้ fetch JWKS สดทุกครั้ง
  ไม่ cache จึงแค่ launch ใหม่ก็พอ)
- launch token ใช้ครั้งเดียว — reload หน้าเดิมด้วย token เดิมจะโดนปฏิเสธ (`jti` ซ้ำ)
  ล้างได้ด้วย `localStorage.clear()`
