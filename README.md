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
| [`activity/result/index.html`](activity/result/index.html) | route `/activity/result/<result_id>` — หน้าเฉลย เปิดย้อนหลังจากสแตมป์ |
| [`404.html`](404.html) | shim ให้ static host เสิร์ฟ path `/activity/result/<result_id>` ได้ |
| [`quiz.js`](quiz.js) | คำถาม 3 ข้อ + render ควิซ + render เฉลย ใช้ร่วมกันทุก route |
| [`result.js`](result.js) | bootstrap ของหน้าเฉลย |
| [`app.css`](app.css) | สไตล์ (Apple HIG tokens) ใช้ร่วมกันทุก route |

### route `/` — flow จริง

| ขั้น | ทำอะไร |
|---|---|
| 1 | อ่าน `?token=` จาก URL (launch JWT) |
| 2 | verify RS256 ด้วย WebCrypto กับ `<api>/.well-known/jwks.json` (เลือกกุญแจตาม `kid`) |
| 3 | เช็ค `iss=dreambook`, `aud=demo-activity`, `exp` (cap 900 วิ), กัน `jti` ซ้ำผ่าน localStorage |
| 4 | `GET /activities/:id/student-context` ด้วย `report_token` → ทักชื่อเล่น + ห้อง |
| 5 | ควิซ 3 ข้อ ตอบผิดได้ ไม่มีโทษ ตอบใหม่จนถูก |
| 6 | ครบ 3 ข้อ → `PUT /activities/:id/progress` → backend mark completed + แจกเหรียญ |
| 7 | PUT สำเร็จแล้วค่อย `postMessage({type:'activity_finished'})` ไปที่ `window.parent` → แอปปิด iframe เปิดหน้า "ได้รับสแตมป์ใหม่" |
| 8 | เปิดสแตมป์ในสมุดบันทึกทีหลัง → แอป iframe `/activity/result/<result_id>` → เห็นเฉลยทั้ง 3 ข้อ |

### route `/activity/result/<result_id>` — หน้าเฉลย

แอปเปิดหน้านี้ใน iframe ตอนกดสแตมป์ในสมุดบันทึก (`ActivityResultView.tsx`) — **เปิดเย็น ๆ
ไม่มี token ไม่มี session ไม่มี callback** URL สร้างจาก backend เป็น
`<origin ของ web_url>/activity/result/<result_id>` (ดู `sticker.service.ts`)

หน้านี้โชว์ **เฉลยคำถามทั้ง 3 ข้อ** — คำถามและคำตอบที่ถูกมาจาก `quiz.js` ชุดเดียวกับควิซ

- เฉลยเหมือนกันทุกคนทุกรอบ จึง **ไม่อ่าน `result_id` ในพาธเลย** ไม่ต้องเก็บ ไม่ต้อง
  encode อะไรลงไป (`result_id` ที่ส่งให้ backend เป็นค่าคงที่ `demo-quiz-v1`)
- static host ไม่มีไฟล์ตรง path ที่มี segment ท้าย — `404.html` เลยรับหน้าที่ render
  ให้ (GitHub Pages เสิร์ฟ `404.html` ให้ path ที่ไม่มีไฟล์) ส่วน
  `activity/result/index.html` รับเคสเปิดที่ path เปล่า ๆ

> **ข้อควรระวังตอน deploy:** backend ใช้ `new URL(web_url).origin` — **ตัด path ทิ้ง**
> ฉะนั้นถ้า activity อยู่ใต้ path ย่อย (เช่น GitHub Pages project page
> `…github.io/demo-activity-samutfun/`) ลิงก์ผลลัพธ์จะกลายเป็น `…github.io/activity/result/<id>`
> ซึ่งไม่ใช่ของเรา หน้าผลลัพธ์จะเปิดไม่ได้ — ต้อง deploy ที่ root ของโดเมน/ซับโดเมน
> (แบบ `goalsetting-dev.samutfun.org`) ถึงจะครบ loop

### route `/demo` — โหมดทดลอง

`http://localhost:5175/demo` เปิดได้เลย ไม่ต้องมี token ไม่ต้องมี backend ไม่ต้องมี CORS
ใช้ตอนโชว์งาน รีวิวดีไซน์ หรือเปิดออฟไลน์

- ตัดทิ้ง: `?token=`, verify JWT, JWKS, `student-context`, `PUT /progress`, `postMessage` กลับแอป
- เหลือ: ควิซ 3 ข้อชุดเดียวกัน (มาจาก `quiz.js`) + หน้าจบ + **เฉลย** + ปุ่ม **เล่นอีกครั้ง**
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
| `api` | `http://localhost:3000` | host ของ Dreambook backend — ต้องเป็น HTTPS ยกเว้น `localhost`/`127.0.0.1` (callback พก `report_token`) |
| `iss` | `dreambook` | issuer ที่คาดหวัง |
| `aud` | `demo-activity` | audience ที่คาดหวัง |
| `return` | origin ปัจจุบัน | origin ของ web app ที่จะเด้งกลับหลังจบ (ใส่ตอน dev เมื่อ activity คนละ port กับแอป เช่น `http://localhost:5173`) |

## แจ้งผลกลับแอปหลังจบกิจกรรม

แอป Dreambook ฝังกิจกรรมไว้ใน **iframe** และรู้ว่าจบแล้วผ่าน `postMessage` เท่านั้น
(`ActivityPlayer.tsx`) — redirect ข้างในไม่ถึงแอป หน้าจอจะค้าง

| อยู่ที่ไหน | ทำอะไรตอนจบ |
|---|---|
| ใน iframe (ของจริง) | `window.parent.postMessage({ type: 'activity_finished', result_id, sticker_code }, '*')` **หลัง** `PUT /progress` ได้ 2xx |
| เปิดตรง ๆ ไม่มี parent (dev) | โชว์ผล ~1.5 วิ แล้ว `location.replace()` ไป `<return>/?sticker=<stickerId>` |

- ยิงหลัง PUT เสมอ — ยิงก่อน backend เขียนเสร็จ แอปจะหาเหรียญไม่เจอแล้วโชว์หน้าเปล่า
- `stickerId` มาจาก `reward.id` ใน response ของ PUT ถ้ากิจกรรมไม่มีเหรียญ (`reward: null`)
  จะไม่ส่ง `sticker_code` และ fallback จะเด้งไป `/` เฉย ๆ
- verify token ไม่ผ่าน → `postMessage({ type: 'activity_error', message })` แอปจะโชว์ error แทน iframe
- ส่งผลไม่สำเร็จ (PUT พัง) → **ไม่** ยิง `activity_error` เพราะยังกู้ได้ โชว์ปุ่ม **ลองส่งใหม่** แทน
- payload ไม่มี token และไม่มี PII เพราะ targetOrigin เป็น `'*'` (ใครก็อ่านได้)
- fallback ใช้ `replace()` ไม่ใช่ `assign()` เพราะ launch token ใช้ครั้งเดียว — กด Back
  กลับมา URL เดิมจะโดน `jti` ซ้ำปฏิเสธ

## ทดสอบ end-to-end กับ backend

1. seed catalog (ฝั่ง dreambook-backend) — **ยังไม่มี entry `Demo Activity` ใน
   `prisma/activity-catalog.ts`** ต้องเพิ่มเองก่อน (guideline §2.1): `aud: 'demo-activity'`,
   `web_url: 'http://localhost:5175'` (prod ใช้ `https://1xkuson.github.io/demo-activity-samutfun`),
   `id: '00000000-0000-4000-a000-000000000003'` แล้วค่อยรัน
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
