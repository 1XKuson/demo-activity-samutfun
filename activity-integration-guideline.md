# Activity Integration Guideline

คู่มือสำหรับ **activity ภายนอก** (เช่น goal-setting, future-you) ที่จะเชื่อมกับ
Dreambook backend — อธิบายว่า activity ต้อง implement อะไรบ้าง และฝั่ง Dreambook
ต้องเตรียมอะไร

> โมเดลการเชื่อม = **Model-B identity handoff**: Dreambook เซ็น token ให้นักเรียน
> ตอน launch, activity verify เองด้วย public key (JWKS) โดยไม่ต้องแชร์ secret และ
> ไม่ต้อง callback ตอน launch อ่านแนวคิด token 2 ตัวได้ท้ายเอกสาร

---

## 1. ภาพรวม flow

```
  นักเรียนกดเล่น activity ใน Dreambook app
        │
        │  POST /activities/:id/launch        (WS1)
        ▼
  Dreambook backend
        │  mint launch JWT (RS256) + report_token (HS256, ซ่อนใน claim)
        │  return { launchToken, launchUrl, expiresAt, run }
        ▼
  app เปิด launchUrl = <web_url>?token=<launch JWT>
        │
        ▼
  Activity (WebView)
        │  1. verify launch JWT กับ /.well-known/jwks.json
        │  2. ดึง report_token ออกจาก claim
        │  3. (ระหว่างเล่น) callback ด้วย report_token:
        │        GET  /activities/:id/student-context
        │        PUT  /activities/:id/progress          (WS2 return)
        ▼
  Dreambook backend  → บันทึก checkpoint, แจกสแตมป์ของ level นั้น, ปิด run ถ้าจบ
        │
        │  (ถ้า host ฝังด้วย iframe) activity postMessage บอกแอป
        ▼
  แอป Dreambook  → เด้งสแตมป์ใหม่ / ปิด iframe
```

- `:id` = **ActivityInstance id** = ค่า claim `activity_id` ใน launch JWT (ตัวเดียวกัน)
- Callback ยิงกลับที่ **host เดียวกับ Dreambook backend**
- ทุก callback ผูกกับ **run เดียว** — `run_id` อยู่ใน `report_token` แล้ว activity
  ไม่ต้องส่งเอง และเปลี่ยน run ไม่ได้

---

## 2. ฝั่ง Dreambook ต้องเตรียม (ops / backend)

1. **Seed ActivityCatalog** — เพิ่ม entry ใน `prisma/activity-catalog.ts`
   (`name`, `activity_slug`, `activity_type`, `config.aud`, `web_url`, `levels`)
   แล้วรัน `prisma db seed` (idempotent, upsert by id)
   - `activity_slug` = ชื่ออังกฤษของกิจกรรม (`goal-setting`) ห้ามซ้ำ
   - `activity_type` = `single` (ทุก launch เริ่ม run ใหม่) หรือ `continuous`
     (ออกแล้วกลับมาเล่น run เดิมต่อได้)
   - `levels` = checkpoint ทั้งหมดของกิจกรรม เรียง `1..N` ห้ามข้าม แต่ละ level ผูก
     สแตมป์ 1 ใบ (`id`, `name`, `qr_token`, `variant`, `image_url`) — **เพิ่ม level ได้
     แต่ห้ามลบหรือเปลี่ยน `id` ของ level ที่แจกไปแล้ว** เพราะ ownership ของสแตมป์
     คือหลักฐานว่าผ่าน level นั้น
   - `config.aud` = audience ของ activity นั้น (ดูข้อ 3.2). เว้นว่าง = ใช้ค่า default
     `DREAMBOOK_LAUNCH_AUD` (`activity`)
   - `web_url` = URL ของ activity app
   - `config.result_url` = base URL สำหรับเปิดผลของ run ซ้ำ (optional) โดย Dreambook
     จะต่อท้ายด้วย `result_id`; ไม่ตั้งค่านี้จะไม่มีลิงก์เปิดผล
2. **สร้าง ActivityInstance** — ผูก catalog + teacher + ช่วงเวลาเปิด
   (`available_from`/`available_to`) + reward sticker แบบเดิม (optional/deprecated)
   ผ่าน `POST /activities` ด้วย teacher token
3. **ไม่ต้องตั้ง env ใหม่ต่อ activity** — private key / iss ใช้ร่วมกันทั้งระบบ
   audience แยกได้ผ่าน `config.aud` ใน DB

---

## 3. ฝั่ง Activity ต้อง implement

### 3.1 รับ launch token

เปิดจาก `launchUrl` รูปแบบ `<web_url>?token=<JWT>` — อ่าน query param `token`
(query อยู่ก่อน `#fragment` เสมอ)

`POST /activities/:id/launch` ตอบ 200 พร้อม:

```jsonc
{
  "launchToken": "<RS256 JWT>",
  "launchUrl": "<web_url>?token=<RS256 JWT>",
  "expiresAt": "<ISO 8601>",
  "run": { "id": "<runId>", "resumed": true, "started_at": "<ISO 8601>" },
}
```

- สำหรับ `continuous` การ launch ปกติจะ resume open run เดิม (ถ้ามี)
- แอป Dreambook ส่ง `{ "new_run": true }` เมื่อผู้ใช้กด “เริ่มใหม่” เพื่อปิด run เดิม
  เป็น abandoned แล้วสร้าง run ใหม่
- สำหรับ `single` ทุก launch จะเริ่ม run ใหม่เสมอ
- Activity ไม่ต้องส่ง `run.id` กลับมาเอง เพราะ `report_token` ผูกกับ run ให้แล้ว

### 3.2 Verify launch JWT (สำคัญที่สุด)

- **Algorithm:** RS256 เท่านั้น — ปฏิเสธ `alg` อื่น (กัน alg-confusion / `none`)
- **Public key:** ดึงจาก `GET https://<dreambook>/.well-known/jwks.json`
  - response: `{ keys: [{ kty, n, e, use, alg, kid }] }`
  - เลือกกุญแจด้วย `kid` ให้ตรงกับ `kid` ใน header ของ token (รองรับ key rotation)
  - cache JWKS ได้ แต่ต้อง refresh เมื่อเจอ `kid` ที่ไม่รู้จัก
- **ต้องเช็ค claim:**
  | claim   | เช็คว่า                                           |
  | ------- | ------------------------------------------------- |
  | ลายเซ็น | verify ด้วย public key ที่ match `kid`            |
  | `iss`   | == `dreambook` (ค่าที่ตกลงกัน)                    |
  | `aud`   | == audience ของ activity ตัวเอง                   |
  | `exp`   | ยังไม่หมดอายุ (อายุ ~600 วิ)                      |
  | `jti`   | (แนะนำ) กันใช้ซ้ำ — token launch ควรใช้ครั้งเดียว |

### 3.3 อ่านข้อมูลจาก claim

```jsonc
{
  "iss": "dreambook",
  "aud": "goal-setting",
  "sub": "<studentId>",
  "student_id": "<studentId>",
  "name": "<ชื่อเล่น>",
  "class": "ป.5/2", // อาจไม่มี ถ้านักเรียนไม่ได้อยู่ห้อง
  "activity_id": "<instanceId>", // ใช้เป็น :id ตอน callback
  "report_token": "<HS256 JWT>", // เก็บไว้ callback (ดู 3.4)
  "jti": "...",
  "iat": 0,
  "exp": 0,
}
```

### 3.4 Callback (WS2 return)

ใช้ **`report_token`** (จาก claim) เป็น bearer — ไม่ใช่ launch token

```
Authorization: Bearer <report_token>
```

`:id` = `activity_id` จาก claim

**a) ดึงข้อมูลนักเรียนไป personalize**

```
GET /activities/:id/student-context
→ 200 { nickname, gradeLevel, avatarUrl }
```

**b) รายงาน checkpoint / จบ run**

```
PUT /activities/:id/progress
Body: {
  "level": 2,                                     // optional; checkpoint ที่ผ่าน
  "result_id": "<id หน้า result ของ activity>",  // optional; ส่งเดี่ยวได้
  "completed": true                               // optional; ปิด run
}
→ 200 {
  "run": {
    "id": "…",
    "ended_at": "<ISO 8601>",
    "completed_at": "<ISO 8601>",
    "result_id": "<id หน้า result ของ activity>"
  },
  "checkpoint": { "level": 2, "recorded": true },
  "stamps_granted": [ { "level": 2, "sticker_id": "…", "name": "นักวางแผน" } ],
  "collection": { "owned": 2, "total": 3 }
}
```

กฎ:

- ต้องมีอย่างน้อยหนึ่งอย่าง: `level`, `result_id` หรือ `completed: true`
- **activity เป็นผู้กำหนด level เอง** Dreambook แค่เช็คว่า level นั้นมีใน catalog
  แล้วแจกสแตมป์ของ level นั้น — ส่ง `sticker_id` มาไม่ได้
- **level ไม่สะสม**: ผ่าน level 3 ได้สแตมป์ใบที่ 3 ใบเดียว ไม่ได้ 1 กับ 2 ด้วย
  ถ้าอยากให้ได้ครบต้องยิงทีละ level
- ยิง level เดิมซ้ำ → 200 แต่ `recorded: false` และไม่แจกซ้ำ (idempotent — retry ได้)
- `result_id` เป็นผลลัพธ์ของ **run** ไม่ใช่ของ level: ส่งเดี่ยวโดยไม่มี `level` ได้ และ
  ค่าล่าสุดที่ส่งมาจะทับค่าเดิมตราบใดที่ run ยังเปิดอยู่
- `stamps_granted` = เฉพาะสแตมป์ที่ **request นี้** เพิ่งแจก ถ้านักเรียนมีอยู่แล้วจะเป็น `[]`
- `completed: true` ปิด run — หลังจากนั้นยิงอะไรเข้ามาอีกได้ 409 `run_closed`
  ถ้ายังไม่ครบทุก level ก็ปิดได้ ระบบไม่ปิดให้เองแม้ผ่าน level สุดท้าย
- `submission` ยังรับอยู่เพื่อ compatibility แต่ไม่ถูกเก็บ

Error:

| HTTP | code                  | สาเหตุ                                                 |
| ---- | --------------------- | ------------------------------------------------------ |
| 400  | `invalid_level`       | level ไม่มีใน catalog ของกิจกรรมนี้                    |
| 400  | `progress_body_empty` | ไม่ได้ส่ง `level`, `result_id` หรือ `completed: true`  |
| 401  | —                     | token ผิด/หมดอายุ/เป็น token รุ่นเก่าที่ไม่มี `run_id` |
| 403  | —                     | token ไม่ตรงกับ `:id` ใน path                          |
| 404  | `activity_not_found`  | run ใน token ไม่ใช่ของนักเรียน/กิจกรรมนี้              |
| 409  | `run_closed`          | run ถูกปิดไปแล้ว                                       |

- `report_token` อายุ ~3 ชม. — ถ้าเจอ 401 ระหว่างเล่น **ไม่มี endpoint ต่ออายุ**
  ให้จบ WebView แล้วให้นักเรียนกดเปิดกิจกรรมใหม่จากแอป: launch จะ resume run เดิม
  (ถ้าเป็น `continuous`) checkpoint ที่บันทึกไปแล้วไม่หาย
- token ผูกกับ activity เดียวและ run เดียว: ยิงผิด `:id` → 403
- run ไม่มีวันหมดอายุ: ยิง callback หลัง `available_to` ได้ตราบที่ run ยังไม่ปิด
  โดยช่วง availability มีผลเฉพาะตอนเริ่ม run ใหม่ ไม่ได้ปิด run ที่เริ่มไปแล้ว


### 3.5 แจ้งผลกลับแอปด้วย postMessage

ถ้าแอปฝัง activity ไว้ใน **iframe** สิ่งที่เกิดข้างใน (redirect, สแตมป์ใหม่, จบกิจกรรม)
ไม่ถึงแอปเลย — activity ต้องยิง `postMessage` บอกเอง ส่วนใน **WebView**
`window.parent === window` ทุก post เป็น no-op เขียนโค้ดชุดเดียวใช้ได้ทั้งสองแบบ

```js
const EMBEDDED = window.parent !== window;
const postToApp = (type, extra) => {
  if (!EMBEDDED) return;
  try { window.parent.postMessage({ type, ...extra }, '*'); } catch (err) { console.warn(err); }
};
```

| type                | ยิงเมื่อ                                                     | payload                                        |
| ------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| `activity_error`    | เปิดกิจกรรมไม่ได้ (ไม่มี token / verify ไม่ผ่าน / ไม่ HTTPS) | `{ message }`                                  |
| `level_complete`    | `PUT /progress` ที่มี `level` ตอบ 2xx                        | `{ level, result_id?, granted, sticker_id? }`  |
| `activity_finished` | `PUT /progress` ที่มี `completed: true` ตอบ 2xx              | `{ result_id?, levels? }`                      |

**`level_complete` — ตามที่ `sakura-garden` ทำ** (1 level = 1 message):

```jsonc
{
  "type": "level_complete",
  "level": 3,
  "result_id": "sakura-l3",
  "granted": true,         // request นี้แจกสแตมป์จริงไหม
  "sticker_id": "stk_…",   // มีเฉพาะตอน granted: true
  "done": 3,               // optional; ฟิลด์เสริมของกิจกรรมเองใส่เพิ่มได้
  "total": 5
}
```

```js
const res = await callback('PUT', `/activities/${activityId}/progress`,
  reportToken, { level, result_id });
// ว่าง = ยิงซ้ำ level ที่บันทึกไปแล้ว (idempotent ดู 3.4)
const stamp = (res.stamps_granted || [])[0] || null;
postToApp('level_complete', {
  level,
  result_id,
  granted: !!stamp,
  ...(stamp?.sticker_id ? { sticker_id: stamp.sticker_id } : {}),
});
```

กฎ:

- **ยิงหลัง PUT ได้ 2xx เท่านั้น** — ยิงก่อน backend เขียนเสร็จ แอปจะไปเปิดสแตมป์ที่ยังไม่มี
- `granted` อ่านจาก `stamps_granted` ของ response นั้นเท่านั้น — ยิง level ซ้ำได้
  `granted: false` และไม่มี `sticker_id` แอปจึงแยกสแตมป์ใหม่จริงออกจาก replay ได้
- `sticker_id` มาจาก `stamps_granted[0].sticker_id` ห้าม activity ตั้ง id เอง (Dreambook
  เลือกสแตมป์จาก level)
- กิจกรรมหลาย level: ยิง `level_complete` ทีละ level ตามลำดับที่ PUT สำเร็จ แล้วค่อยยิง
  `activity_finished` ตอนปิด run — ไม่ใช่ยิงรวมทีเดียวตอนจบ
- PUT พัง → **ห้าม** ยิง `activity_error` (type นั้นแปลว่าเปิดกิจกรรมไม่ได้) ให้โชว์ปุ่ม
  "ลองส่งใหม่" ในหน้าแทน เพราะ run ยังกู้ได้
- `targetOrigin` เป็น `'*'` ใครก็อ่านได้ → payload ห้ามมี token หรือ PII (`name`, `class`)
- postMessage เป็นแค่ UI hint — **callback คือช่องทางเดียวที่ถือ state จริง** ถ้าแอปไม่ฟัง
  ข้อมูลก็ยังถูกต้องอยู่ดี


---

## 4. Config ที่ต้องตกลงกัน 2 ฝั่ง

| ค่า        | ฝั่ง Dreambook                                | ฝั่ง Activity                                | ต้อง       |
| ---------- | --------------------------------------------- | -------------------------------------------- | ---------- |
| issuer     | `DREAMBOOK_LAUNCH_ISS`                        | `DREAMBOOK_JWT_ISS`                          | **ตรงกัน** |
| audience   | `config.aud` (DB) หรือ `DREAMBOOK_LAUNCH_AUD` | `DREAMBOOK_JWT_AUD`                          | **ตรงกัน** |
| JWKS URL   | เสิร์ฟที่ `/.well-known/jwks.json`            | ชี้มาที่ URL นี้ (`DREAMBOOK_JWT_MODE=jwks`) | —          |
| launch TTL | `DREAMBOOK_LAUNCH_TTL_SEC` (≤ 900)            | verifier cap 900 วิ                          | —          |

---

## 5. Security checklist (ฝั่ง Activity)

- [ ] บังคับ `alg=RS256` — ปฏิเสธ `none` / HS256 (กัน key-confusion)
- [ ] verify ลายเซ็นด้วย public key ที่ match `kid` เท่านั้น
- [ ] เช็ค `iss` + `aud` + `exp` ครบ
- [ ] กัน `jti` ซ้ำ (launch token = single-use)
- [ ] ใช้ `report_token` เป็น bearer ตอน callback — อย่าเอา launch token ไปยิง callback
- [ ] อย่า log token เต็ม ๆ (มี PII: `name`, `class`)
- [ ] เรียก callback ผ่าน HTTPS เท่านั้น
- [ ] payload ของ `postMessage` ไม่มี token / PII (`targetOrigin: '*'`)

---

## 6. Testing / local dev

- ใน dev (ไม่มี `DREAMBOOK_LAUNCH_PRIVATE_KEY`) Dreambook สร้าง **ephemeral keypair**
  อัตโนมัติ — JWKS จะเปลี่ยนทุก restart (verifier ต้อง refresh JWKS)
- **prod ต้องตั้ง** `DREAMBOOK_LAUNCH_PRIVATE_KEY` (PKCS8 PEM) ไม่งั้น boot ไม่ผ่าน
  (เพราะ image ตั้ง `NODE_ENV=production`)
- ตรวจ token ได้ด้วยการ decode 3 ส่วน (base64url) → เทียบ claim ตามตาราง 3.3
- public key จริงดูได้ที่ `GET /.well-known/jwks.json`

---

## ภาคผนวก: ทำไม token 2 ตัว

|            | Launch JWT                        | Session / report token                   |
| ---------- | --------------------------------- | ---------------------------------------- |
| ใคร verify | activity (ข้าง Dreambook)         | Dreambook เอง                            |
| crypto     | **RS256** asymmetric              | **HS256** symmetric (`JWT_SECRET`)       |
| ใช้ตอน     | handoff ตอน launch                | callback (`student-context`, `progress`) |
| เหตุผล     | ข้าม service → ไม่ต้องแชร์ secret | ในบ้านตัวเอง → เร็ว ง่าย                 |

- **Stateless token verification** — claim พก identity/scope มาเอง ส่วนสถานะ run และ
  checkpoint เก็บใน DB
- **Least-privilege** — report token เขียนได้แค่ run เดียวของนักเรียนคนนั้น (`run_id` ใน claim)
- **Key rotation** — เลือกกุญแจด้วย `kid` (RFC 7638 thumbprint) เปลี่ยนกุญแจไม่พัง

---

**อ้างอิง code:** `src/activity/launch-token.service.ts` (launch JWT + JWKS),
`src/activity/activity.service.ts` (`createLaunch`),
`src/activity/activity-run.service.ts` (run, checkpoint, การแจกสแตมป์),
`src/activity/activity-callback.controller.ts` (callback routes),
`src/auth/activity-session.guard.ts` (verify report/session token).
เส้นทาง HTTP ทั้งหมดดูที่ [`routes.md`](routes.md).

**อ้างอิงฝั่ง activity (repo นี้):** `launch.js` (verify + `postToApp`),
`sakura/index.html` (`level_complete` รายด่าน + `activity_finished`).
