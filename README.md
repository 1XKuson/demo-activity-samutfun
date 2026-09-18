# demo-activity

กิจกรรมทดสอบสำหรับ Dreambook ใช้พิสูจน์ว่า launch (Model-B handoff) + callback
ทำงานครบ loop จริง — ตอนนี้มี **2 กิจกรรม** ตาม `activity_type`

| กิจกรรม | type | level | route | จบเมื่อ |
|---|---|---|---|---|
| คำถามชวนคิด | `single` | 1 | `/` | ตอบถูกครบ 3 ข้อ → รายงาน level 1 + ปิด run ในครั้งเดียว |
| ซากุระของฉัน | `continuous` | 1–5 | `/sakura` | เล่นเกม 24 หาเหรียญ ซื้อน้ำ/ปุ๋ย ดูแลรายวันจนต้นไม้โตเต็มที่ |

สเปกที่ implement ตาม: `dreambook-backend/documents/activity-integration-guideline.md`

## มีอะไรบ้าง

ไม่มี build step, ไม่มี backend ของตัวเอง — เสิร์ฟไฟล์ static ตรง ๆ

| ไฟล์ | ทำอะไร |
|---|---|
| [`launch.js`](launch.js) | **ใช้ร่วมกันทุกกิจกรรมจริง** — อ่าน+verify launch JWT (RS256/JWKS) และยิง callback ด้วย `report_token` |
| [`index.html`](index.html) | route `/` — ควิซตัวจริง (single, level 1) |
| [`demo/index.html`](demo/index.html) | route `/demo` — ควิซเดียวกันแบบไม่ต่อ backend |
| [`quiz.js`](quiz.js) | คำถาม 3 ข้อ + render ควิซ + render เฉลย ใช้ร่วมกันทุก route ของควิซ |
| [`result.js`](result.js) | bootstrap หน้าเฉลยของควิซ |
| [`sakura/index.html`](sakura/index.html) | route `/sakura` — สวนจริงแบบ continuous + Dreambook callbacks |
| [`sakura/demo/index.html`](sakura/demo/index.html) | route `/sakura/demo` — เล่นครบ loop ได้โดยไม่มี token/backend |
| [`sakura.js`](sakura.js) | growth/economy/shop/เกม 24 และ renderer ที่ใช้ร่วมกันสอง route |
| [`sakura-result.js`](sakura-result.js) | หน้าเปิดย้อนหลังจาก `result_id=sakura-l1..5` |
| [`sakura/catalog.md`](sakura/catalog.md) | ค่าที่ต้อง seed ใน ActivityCatalog ทั้ง prod/dev และสติกเกอร์ทั้ง 5 level |
| [`activity/result/index.html`](activity/result/index.html) | route `/activity/result/<result_id>` — หน้าเฉลย/สรุป เปิดย้อนหลังจากสแตมป์ |
| [`404.html`](404.html) | shim ให้ static host เสิร์ฟ path `/activity/result/<result_id>` ได้ — แยกว่าเป็นของกิจกรรมไหนจาก `result_id` |
| [`app.css`](app.css) | สไตล์ (Apple HIG tokens) ใช้ร่วมกันทุก route |
| [`assets/`](assets) | รูป thumbnail + สแตมป์ ของกิจกรรม (ดูหัวข้อ [รูปกิจกรรม](#รูปกิจกรรม)) |

### route `/` — flow จริง

| ขั้น | ทำอะไร |
|---|---|
| 1 | อ่าน `?token=` จาก URL (launch JWT) |
| 2 | verify RS256 ด้วย WebCrypto กับ `<api>/.well-known/jwks.json` (เลือกกุญแจตาม `kid`) |
| 3 | เช็ค `iss=dreambook`, `aud=thailand-quiz`, `exp` (cap 900 วิ), กัน `jti` ซ้ำผ่าน localStorage |
| 4 | `GET /activities/:id/student-context` ด้วย `report_token` → ทักชื่อเล่น + ห้อง |
| 5 | ควิซ 3 ข้อ ตอบผิดได้ ไม่มีโทษ ตอบใหม่จนถูก |
| 6 | ครบ 3 ข้อ → `PUT /activities/:id/progress` ด้วย `{ level: 1, result_id, completed: true }` → backend บันทึก checkpoint แจกสแตมป์ของ level 1 แล้วปิด run |
| 7 | PUT สำเร็จแล้วค่อย `postToApp('activity_finished', …)` ไปที่ `window.parent` → แอปปิด iframe เปิดหน้า "ได้รับสแตมป์ใหม่" (ทุกหน้ายิง `/sakura` ยิง `level_complete` รายด่านด้วย — ดู [แจ้งผลกลับแอป](#แจ้งผลกลับแอปหลังจบกิจกรรม)) |
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

URL ประกาศตรง ๆ ใน catalog ที่ `config.result_url` แล้ว backend เอา `result_id` ไปต่อท้าย
(`resultUrlFor` ใน `activity-config.ts`) — ไม่ได้ derive จาก `web_url` อยู่ใต้ path ย่อย
แบบ GitHub Pages project page จึงใช้ได้:

```
result_url  https://1xkuson.github.io/demo-activity-samutfun/activity/result
+ result_id /demo-quiz-v1
```

### route `/demo` — โหมดทดลอง

`http://localhost:5175/demo` เปิดได้เลย ไม่ต้องมี token ไม่ต้องมี backend ไม่ต้องมี CORS
ใช้ตอนโชว์งาน รีวิวดีไซน์ หรือเปิดออฟไลน์

- ตัดทิ้ง: `?token=`, verify JWT, JWKS, `student-context`, `PUT /progress`, `postMessage` กลับแอป
- เหลือ: ควิซ 3 ข้อชุดเดียวกัน (มาจาก `quiz.js`) + หน้าจบ + **เฉลย** + ปุ่ม **เล่นอีกครั้ง**
- ไม่มีการส่งผลหรือแจกเหรียญจริง

คำถามและหน้าตาควิซอยู่ใน `quiz.js` ไฟล์เดียว ทั้งสอง route จึงไม่มีทางเพี้ยนจากกัน

## ซากุระของฉัน — `/sakura` (`continuous`, 5 level)

ต้นซากุระโตตามการดูแลรายวัน: น้ำ `+1`, ปุ๋ย `+2`, ให้ได้ชนิดละหนึ่งครั้งต่อวัน
และปลด level ที่ growth `0, 3, 6, 9, 12` ตามลำดับ เงินสำหรับซื้อของมาจาก
เกม 24 ซึ่งสุ่มเลขโจทย์ 4 หลัก (1–9) แล้วให้ลาก/แตะบล็อกตัวเลข เครื่องหมายและวงเล็บ
มาต่อเป็นสมการ ใช้เลขครบทั้ง 4 ใบและได้ผลลัพธ์ 24 จึงได้ 8 เหรียญ

- `/sakura` verify launch token ด้วย `launch.js`, โหลด `student-context`, จำ state
  แยกตาม `activity_id + student_id + run_id` และรายงาน checkpoint ทีละ level
- โจทย์เกม 24 สุ่มใหม่ทุกครั้งและผ่านตัวแก้โจทย์ก่อนเสมอ จึงมีทางออกแน่นอน และ
  คำใบ้กับปุ่มสุ่มใหม่ใช้ตัวแก้ตัวเดียวกัน
- `/sakura/demo` ไม่มี backend เก็บ state ไว้ที่ `localStorage['sakura-garden:demo:v1']`
  ของเครื่องนั้น (รวม `dayOffset`) มีปุ่มข้ามวันและปุ่มเริ่มใหม่สำหรับล้างข้อมูล
- prod ไม่มีปุ่ม mint; dev (`/dev/` และ localhost) มีปุ่ม `+100` กดซ้ำได้ไม่จำกัด
- ทุก level มี PNG RGBA 360×360 ใน `assets/sakura/` เท่ากับ stamp ของ activity เดิม
- เมื่อถึง level 5 ผู้เรียนเป็นคนกดจบ run; ระบบไม่ปิด run ให้อัตโนมัติ

ค่า seed ที่ต้องใส่ฝั่ง backend อยู่ใน [`sakura/catalog.md`](sakura/catalog.md)

## รัน

```bash
# ที่ demo-activity/
python3 -m http.server 5175
# หรือ: npx serve -l 5175 .
```

backend ที่หน้านี้ยิงไปหา มาจาก `config.js` (`window.APP_CONFIG.api`) ซึ่งเลือกให้เอง
**จากที่อยู่ของหน้า** (ดูหัวข้อ [environment](#environment)) — เสิร์ฟจาก `localhost`
หรือ `127.0.0.1` จะได้ env `local` ที่ยิงไป `http://localhost:3000` ทับได้ด้วย `?api=`
หน้านี้เป็น static ไม่มี build step ดังนั้น `.env` จึงไปไม่ถึง browser

ทับได้ด้วย query param โดยไม่ต้องแก้ไฟล์:

| param | default | ใช้ทำอะไร |
|---|---|---|
| `token` | — | launch JWT (บังคับ) |
| `api` | `config.js` (local/dev/prod ตามที่อยู่ของหน้า) | host ของ Dreambook backend — ต้องเป็น HTTPS ยกเว้น `localhost`/`127.0.0.1` (callback พก `report_token`) |
| `iss` | `dreambook` | issuer ที่คาดหวัง |
| `aud` | `thailand-quiz` (`/`), `sakura-garden` (`/sakura`) | audience ที่คาดหวัง — ต้องตรงกับ `config.aud` ของแถวใน `ActivityCatalog` |
| `return` | origin ปัจจุบัน | origin ของ web app ที่จะเด้งกลับหลังจบ (ใส่ตอน dev เมื่อ activity คนละ port กับแอป เช่น `http://localhost:5173`) |

## environment

**2 env ที่ deploy อยู่บน GitHub Pages site เดียวกัน คนละ path** (บวก `local`
สำหรับรันบนเครื่อง) — deploy ด้วย
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) ที่ checkout ทั้งสอง branch
แล้วอัปเป็น artifact เดียว (Pages ทับทั้ง site ทุกครั้งที่ deploy — push branch ไหน
ก็ build ใหม่ทั้งคู่)

| env | branch | ที่อยู่ | backend |
|---|---|---|---|
| prod | `main` | `https://1xkuson.github.io/demo-activity-samutfun/` | `https://api.samutfun.org` |
| dev | `dev` | `https://1xkuson.github.io/demo-activity-samutfun/dev/` | `https://api-dev.samutfun.org` |
| local | ไหนก็ได้ | `http://localhost:*` / `http://127.0.0.1:*` | `http://localhost:3000` |

`config.js` เป็นไฟล์เดียวกันทุก branch — เลือก backend ตอน runtime จากที่อยู่ของหน้า
**ไม่ใช่** hardcode คนละค่าคนละ branch เพราะแบบนั้น merge `dev` → `main` เมื่อไหร่
prod จะโดน backend dev ลากไปด้วย ลำดับการตัดสิน:

1. hostname เป็น `localhost`/`127.0.0.1` → `local` (เช็คก่อน path เสมอ ดังนั้น
   checkout ที่เสิร์ฟใต้ `/dev/` บนเครื่องก็ยังเป็น local)
2. path มี `/dev/` → `dev`
3. ที่เหลือ → `prod` — เป็น default ที่ปลอดภัยที่สุด เพราะถ้าเดาผิดจะไปตกที่
   ตรวจ signature ไม่ผ่าน ไม่ใช่เขียนลง backend จริง

`launch.js` ยอมให้ callback วิ่งบน plain http เฉพาะ `localhost`/`127.0.0.1` ที่เหลือ
บังคับ HTTPS เพราะ callback พก `report_token`

ริบบิ้นมุมขวาบนบอกชื่อ env ทุกครั้งที่ไม่ใช่ prod (`LOCAL` / `DEV`, หน้า
`/sakura/demo` ขึ้น `DEMO`) — คนละเรื่องกับเครื่องมือ dev (ปุ่มเติมเหรียญ) ซึ่งเปิด
เฉพาะ `local` เพราะ dev ที่ deploy แล้วก็ยังรายงานเข้า backend จริง เปลี่ยนได้ที่
`config.js` → `features.mintCoins`

| env | ริบบิ้น | เครื่องมือ dev |
|---|---|---|
| local | `LOCAL` | ✅ |
| dev | `DEV` | ❌ |
| prod | — | ❌ |

ค่าที่ต้อง seed ลง `ActivityCatalog` ของ backend แต่ละตัว (backend คนละตัว = คนละแถว):

| field | prod | dev |
|---|---|---|
| `web_url` (ควิซ) | `https://1xkuson.github.io/demo-activity-samutfun` | `https://1xkuson.github.io/demo-activity-samutfun/dev` |
| `web_url` (ซากุระ) | `https://1xkuson.github.io/demo-activity-samutfun/sakura` | `https://1xkuson.github.io/demo-activity-samutfun/dev/sakura` |
| `result_url` (ทุกกิจกรรม) | `https://1xkuson.github.io/demo-activity-samutfun/activity/result` | `https://1xkuson.github.io/demo-activity-samutfun/dev/activity/result` |

ทั้งสอง activity ใช้ `result_url` เส้นเดียวกันได้ เพราะ `result_id` เป็นของเราเอง —
`404.html` ดูจาก `result_id` ว่าจะ render เฉลยควิซ หรือสติกเกอร์ซากุระ

หน้าเฉลยใต้ `/dev/` ใช้ `404.html` ใบเดียวกับ prod ได้ เพราะมัน derive site root จาก
ตำแหน่งของ `/activity/result/` ใน path ไม่ได้ fix ว่าอยู่ที่ราก

ปล่อยของ: push `dev` → เห็นที่ `/dev/` ก่อน, พอชัวร์แล้ว merge เข้า `main` → ขึ้น prod
(ถ้าอยากให้ dev ตามโค้ด prod ไปก่อน ก็ merge `main` → `dev` ได้ตามปกติ ไฟล์ config
ไม่ต่างกัน)

## แจ้งผลกลับแอปหลังจบกิจกรรม

> ทุกหน้า (`/`, `/sakura`) ยิงผ่าน `Launch.postToApp()` ใน `launch.js`
> ที่เดียว — guideline ตัด contract นี้ออกไปตอนแอปย้ายจาก iframe ไป WebView
> (`window.parent === window` ทุก post เลยเป็น no-op) เก็บไว้เผื่อ host ที่ยัง
> iframe อยู่ ไม่ว่าจะยิงหรือไม่ **callback ยังเป็นช่องทางเดียวที่ถือ state**

แอปรุ่นที่ฝังกิจกรรมไว้ใน **iframe** รู้ว่าจบแล้วผ่าน `postMessage` เท่านั้น
(`ActivityPlayer.tsx`) — redirect ข้างในไม่ถึงแอป หน้าจอจะค้าง

| type | ยิงเมื่อไหร่ | payload | หน้าไหน |
|---|---|---|---|
| `activity_error` | เปิดกิจกรรมไม่ได้ (ไม่มี token / API ไม่ HTTPS / verify ไม่ผ่าน) | `{ message }` | ทุกหน้า |
| `level_complete` | บันทึก level หนึ่งสำเร็จ (PUT `{ level, result_id }` ได้ 2xx) | `{ level, result_id, granted, sticker_id?, done, total }` | `/sakura` |
| `activity_finished` | ปิดรอบสำเร็จ (PUT `{ completed: true }` ได้ 2xx) | ควิซ `{ result_id, sticker_code? }` · ซากุระ `{ levels, total }` | ทุกหน้า |

| อยู่ที่ไหน | ทำอะไรตอนจบ |
|---|---|
| ใน iframe (ของจริง) | `postToApp(...)` ตามตารางข้างบน **หลัง** `PUT /progress` ได้ 2xx |
| เปิดตรง ๆ ไม่มี parent (dev) | `EMBEDDED` เป็น false ไม่ยิงอะไร — ควิซโชว์ผล ~1.5 วิ แล้ว `location.replace()` ไป `<return>/?sticker=<stickerId>` |

- ยิงหลัง PUT เสมอ — ยิงก่อน backend เขียนเสร็จ แอปจะหาเหรียญไม่เจอแล้วโชว์หน้าเปล่า
- `granted` เป็น false ตอนยิง level ซ้ำ (`stamps_granted` ว่าง เพราะ checkpoint idempotent) —
  แอปจึงแยกได้ว่าอันไหนสแตมป์ใหม่จริง อันไหนแค่ replay
- `sticker_id` มาจาก `stamps_granted[0].sticker_id` ของ response ไม่ใช่ id ที่หน้าเว็บตั้งเอง
  (Dreambook เลือกสแตมป์จาก level) ตอน `granted:false` จะไม่มี field นี้เลย
- `stickerId` มาจาก `stamps_granted[0].sticker_id` ใน response ของ PUT (field `reward`
  หายไปตอน API เปลี่ยนเป็นระบบ level) ถ้า request นี้ไม่ได้แจกอะไร — เช่น ยิง level ซ้ำ —
  `stamps_granted` จะว่าง จะไม่ส่ง `sticker_code` และ fallback จะเด้งไป `/` เฉย ๆ
- verify token ไม่ผ่าน → `activity_error` แอปจะโชว์ error แทน iframe
- ส่งผลไม่สำเร็จ (PUT พัง) → **ไม่** ยิง `activity_error` เพราะยังกู้ได้ ควิซโชว์ปุ่ม
  **ลองส่งใหม่** ซากุระกลับหน้าหลักพร้อมข้อความ error
- payload ไม่มี token และไม่มี PII เพราะ targetOrigin เป็น `'*'` (ใครก็อ่านได้)
- fallback ใช้ `replace()` ไม่ใช่ `assign()` เพราะ launch token ใช้ครั้งเดียว — กด Back
  กลับมา URL เดิมจะโดน `jti` ซ้ำปฏิเสธ

## รูปกิจกรรม

PNG 2 ใบ เสิร์ฟจาก Pages ตรง ๆ (catalog ตอนนี้ชี้ไปที่สำเนาบน GCS —
`preview_card/thai_quize_thumbnail.png`, `sticker/thai_quize_stamp.png`
แก้รูปที่นี่แล้วอย่าลืมอัปทับบน GCS ด้วย)

| ไฟล์ | ขนาด | ใส่ที่ field | แอป render ยังไง |
|---|---|---|---|
| [`assets/thumbnail.png`](assets/thumbnail.png) | 720×720 (3× ของ 240) | `thumbnail_url` | `ActivityScanSheet` — `size-60` + `object-cover` + `rounded-card` |
| [`assets/stamp.png`](assets/stamp.png) | 360×360 **โปร่งใส** (3× ของ 120) | `reward.image_url` | `StickerCard` — `size-[120px]` + `object-contain` + เอียง 4° บนพื้นการ์ดสีอ่อน |

```
https://1xkuson.github.io/demo-activity-samutfun/assets/thumbnail.png
https://1xkuson.github.io/demo-activity-samutfun/assets/stamp.png
```

- สแตมป์ต้อง**พื้นหลังโปร่งใส** เพราะการ์ดมีสีพื้นของตัวเอง (`highlight-*-100`) — ใบนี้เป็น RGBA แล้ว
- ทรงหกเหลี่ยมล้อ placeholder ใน `StickerCard.tsx` (polygon เดียวกัน) การ์ดที่มีรูปกับไม่มีรูปจะได้อยู่ตระกูลเดียวกัน
- สีล้อ token ของแอป: brand `#fff454`, ink `#222`, secondary-yellow `#c98a00`, green `#1ac57d`
- ต้นฉบับเป็น SVG ใน `art/` — แก้แล้ว render ใหม่ด้วย headless Chrome (ดู `art/README.md`)

## ทดสอบ end-to-end กับ backend

1. seed catalog (ฝั่ง dreambook-backend) — entry มีแล้วใน `prisma/activity-catalog.ts`
   ชื่อ `คำถามเกี่ยวกับประเทศไทย`: `aud: 'thailand-quiz'` (ค่านี้คือค่าที่หน้านี้เช็ค —
   แก้ฝั่งไหนต้องแก้ให้ตรงกันทั้งคู่), `web_url` + `result_url` ตามตารางใน
   [environment](#environment) (backend dev ใช้แถวคอลัมน์ dev, ตอน dev เครื่องตัวเอง
   ชี้ `http://localhost:5175` ได้), `id: '00000000-0000-4000-a000-000000000003'`,
   `thumbnail_url` + `reward.image_url` = สำเนาบน GCS ของรูปในหัวข้อ [รูปกิจกรรม](#รูปกิจกรรม)
   แล้วค่อยรัน
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

> แถวของควิซต้องมี `levels` อย่างน้อย 1 แถว (level 1) ด้วยแล้ว — API ใหม่แจกสแตมป์
> จาก level เท่านั้น และ body ที่ไม่มีทั้ง `level` และ `completed` จะโดน 400
> `level_or_completed_required` หน้า `/` เลยยิง `{ level: 1, result_id, completed: true }`
> ในครั้งเดียว

### seed ของกิจกรรมต่อเนื่อง

แถวใน `ActivityCatalog` ของ `/sakura` ต้องมีเพิ่มจากของควิซ (guideline ข้อ 2) —
ค่าครบทุก field ทั้ง prod/dev อยู่ใน [`sakura/catalog.md`](sakura/catalog.md):

| field | ค่า |
|---|---|
| `activity_slug` | `sakura-garden` (ห้ามซ้ำกับกิจกรรมอื่น) |
| `activity_type` | `continuous` — ถ้าใส่ `single` launch จะเปิด run ใหม่ทุกครั้ง ทำต่อไม่ได้ |
| `config.aud` | `sakura-garden` (ตรงกับที่หน้านี้เช็ค) |
| `web_url` | ตามตารางใน [environment](#environment) — ชี้ที่ `/sakura` ไม่ใช่ราก |
| `levels` | 5 แถว เรียง 1–5 ห้ามข้าม แต่ละแถวผูกสแตมป์ 1 ใบ (`sticker` + `variant` + `image_url`) |

**ห้ามลบหรือย้ายสแตมป์ของ level ที่แจกไปแล้ว** — ownership ของสแตมป์คือหลักฐานว่า
นักเรียนผ่าน level นั้น เพิ่ม level ใหม่ต่อท้ายได้อย่างเดียว

### CORS

หน้านี้เรียก backend ข้าม origin — dev ต้องตั้ง `CORS_ORIGIN="*"` (หรือใส่
`http://localhost:5175` ในลิสต์) ไม่งั้น JWKS/callback จะโดนบล็อก

### หมายเหตุ dev

- ถ้า backend ไม่ได้ตั้ง `DREAMBOOK_LAUNCH_PRIVATE_KEY` มันจะสร้าง keypair ใหม่ทุก
  restart → JWKS เปลี่ยน → token เก่าจะ verify ไม่ผ่าน (หน้านี้ fetch JWKS สดทุกครั้ง
  ไม่ cache จึงแค่ launch ใหม่ก็พอ)
- launch token ใช้ครั้งเดียว — reload หน้าเดิมด้วย token เดิมจะโดนปฏิเสธ (`jti` ซ้ำ)
  ล้างได้ด้วย `localStorage.clear()`
