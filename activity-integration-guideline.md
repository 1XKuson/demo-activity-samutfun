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
        │  return { launchToken, launchUrl, expiresAt }
        ▼
  app ฝัง launchUrl = <web_url>?token=<launch JWT> ใน iframe
        │
        ▼
  Activity (iframe)
        │  1. verify launch JWT กับ /.well-known/jwks.json
        │  2. ดึง report_token ออกจาก claim
        │  3. (ระหว่างเล่น) callback ด้วย report_token:
        │        GET  /activities/:id/student-context
        │        PUT  /activities/:id/progress          (WS2 return)
        │           ▼
        │     Dreambook backend → mark completed, เก็บ result_id, แจก badge อัตโนมัติ
        │
        │  4. PUT สำเร็จแล้ว → window.parent.postMessage({ type: "activity_finished" })
        ▼
  Dreambook app  → ปิด iframe, เปิดหน้า "ได้รับสแตมป์ใหม่"
```

- `:id` = **ActivityInstance id** = ค่า claim `activity_id` ใน launch JWT (ตัวเดียวกัน)
- Callback ยิงกลับที่ **host เดียวกับ Dreambook backend**
- **2 ช่องทางแยกกัน:** callback = ข้อมูลจริง (backend), postMessage = สัญญาณให้ UI
  เปลี่ยนหน้า (ไม่ใช่ตัวแจก sticker)

---

## 2. ฝั่ง Dreambook ต้องเตรียม (ops / backend)

1. **Seed ActivityCatalog** — เพิ่ม entry ใน `prisma/activity-catalog.ts`
   (`name`, `activity_type`, `config.aud`, `web_url`) แล้วรัน `prisma db seed`
   (idempotent, upsert by id)
   - `config.aud` = audience ของ activity นั้น (ดูข้อ 3.2). เว้นว่าง = ใช้ค่า default
     `DREAMBOOK_LAUNCH_AUD` (`activity`)
   - `web_url` = URL ของ activity app
2. **สร้าง ActivityInstance** — ผูก catalog + teacher + ช่วงเวลาเปิด
   (`available_from`/`available_to`) + badge sticker (ถ้ามี)
   *(ยังไม่มี API/seed — ตอนนี้ insert ตรงใน DB)*
3. **ไม่ต้องตั้ง env ใหม่ต่อ activity** — private key / iss ใช้ร่วมกันทั้งระบบ
   audience แยกได้ผ่าน `config.aud` ใน DB

---

## 3. ฝั่ง Activity ต้อง implement

### 3.1 รับ launch token

เปิดจาก `launchUrl` รูปแบบ `<web_url>?token=<JWT>` — อ่าน query param `token`
(query อยู่ก่อน `#fragment` เสมอ)

### 3.2 Verify launch JWT (สำคัญที่สุด)

- **Algorithm:** RS256 เท่านั้น — ปฏิเสธ `alg` อื่น (กัน alg-confusion / `none`)
- **Public key:** ดึงจาก `GET https://<dreambook>/.well-known/jwks.json`
  - response: `{ keys: [{ kty, n, e, use, alg, kid }] }`
  - เลือกกุญแจด้วย `kid` ให้ตรงกับ `kid` ใน header ของ token (รองรับ key rotation)
  - cache JWKS ได้ แต่ต้อง refresh เมื่อเจอ `kid` ที่ไม่รู้จัก
- **ต้องเช็ค claim:**
  | claim | เช็คว่า |
  |---|---|
  | ลายเซ็น | verify ด้วย public key ที่ match `kid` |
  | `iss` | == `dreambook` (ค่าที่ตกลงกัน) |
  | `aud` | == audience ของ activity ตัวเอง |
  | `exp` | ยังไม่หมดอายุ (อายุ ~600 วิ) |
  | `jti` | (แนะนำ) กันใช้ซ้ำ — token launch ควรใช้ครั้งเดียว |

### 3.3 อ่านข้อมูลจาก claim

```jsonc
{
  "iss": "dreambook",
  "aud": "goal-setting",
  "sub": "<studentId>",
  "student_id": "<studentId>",
  "name": "<ชื่อเล่น>",
  "class": "ป.5/2",              // อาจไม่มี ถ้านักเรียนไม่ได้อยู่ห้อง
  "activity_id": "<instanceId>", // ใช้เป็น :id ตอน callback
  "report_token": "<HS256 JWT>", // เก็บไว้ callback (ดู 3.4)
  "jti": "...", "iat": 0, "exp": 0
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

**b) รายงานผลตอนเล่นจบ**
```
PUT /activities/:id/progress
Body: {
  "result_id": "<id หน้า result ของ activity>",  // optional; เก็บไว้ให้เปิดดูซ้ำ
  "submission": { ... }                           // optional; opaque payload
}
→ mark completed + เก็บ result_id + แจก badge อัตโนมัติ
```

- `report_token` อายุ ~3 ชม. (ยาวพอจบ 1 run) — ยาวกว่า session token (~45 นาที)
- token ผูกกับ activity เดียว: ยิงผิด `:id` → 403

### 3.5 แจ้งสถานะกลับ Dreambook app (postMessage)

Activity ถูกฝังใน **iframe** ของ Dreambook app — ต้อง post สถานะไปที่ `window.parent`
ไม่งั้น app ไม่รู้ว่าจบแล้ว หน้าจอจะค้างอยู่ที่ iframe

```js
window.parent.postMessage({ type: "activity_finished", result_id, sticker_code }, "*");
```

**Event ที่รองรับ**

| `type` | ส่งเมื่อ | field เพิ่ม | app ทำอะไร |
|---|---|---|---|
| `activity_finished` | เล่นจบ **หลัง `PUT /progress` สำเร็จ** | `result_id?`, `sticker_code?` | ปิด iframe → หน้า "ได้รับสแตมป์ใหม่" |
| `activity_cancelled` | นักเรียนกดออกในหน้า activity เอง (ยืนยันแล้ว) | — | ปิด iframe กลับหน้าสแกน (ไม่ถามซ้ำ) |
| `activity_error` | เปิด/เล่นไม่สำเร็จจนไปต่อไม่ได้ | `message?` (ข้อความไทยให้นักเรียนอ่าน) | โชว์จอ error ใน iframe |
| `activity_progress` | ระหว่างเล่น (optional) | `percent?` (0–100) | ยังไม่มี UI — รับไว้เฉย ๆ |

**รายละเอียด**

- **ลำดับสำคัญ:** `await PUT /activities/:id/progress` ให้ได้ 2xx **ก่อน** ค่อยยิง
  `activity_finished` — ยิงก่อน backend เขียนเสร็จ app จะหา sticker ไม่เจอและโชว์หน้าเปล่า
- **target ต้องเป็น `window.parent`** (ไม่ใช่ `window` / `window.top`)
- **targetOrigin:** ใส่ `"*"` ได้ หรือใส่ origin ของ Dreambook ก็ได้ — ฝั่ง app กรองด้วย
  `type` ไม่ได้กรองด้วย origin
- **payload ต้องเป็น object** — ส่ง JSON string ก็ได้ (app พยายาม `JSON.parse` ให้)
- ใช้ key `event` แทน `type` ก็ได้ ค่าเดียวกัน
- alias เดิม `goal_setting_finished` ยังใช้ได้ (ของเก่าไม่พัง) แต่ของใหม่ให้ใช้ `activity_*`
- message ที่ `type` ไม่ตรงตาราง → app ทิ้งเงียบ ๆ

**อ้างอิงฝั่ง app:** `src/lib/activityMessage.ts` (parser + alias),
`src/components/activity/ActivityPlayer.tsx` (routing แต่ละ event)

---

## 4. Config ที่ต้องตกลงกัน 2 ฝั่ง

| ค่า | ฝั่ง Dreambook | ฝั่ง Activity | ต้อง |
|---|---|---|---|
| issuer | `DREAMBOOK_LAUNCH_ISS` | `DREAMBOOK_JWT_ISS` | **ตรงกัน** |
| audience | `config.aud` (DB) หรือ `DREAMBOOK_LAUNCH_AUD` | `DREAMBOOK_JWT_AUD` | **ตรงกัน** |
| JWKS URL | เสิร์ฟที่ `/.well-known/jwks.json` | ชี้มาที่ URL นี้ (`DREAMBOOK_JWT_MODE=jwks`) | — |
| launch TTL | `DREAMBOOK_LAUNCH_TTL_SEC` (≤ 900) | verifier cap 900 วิ | — |

---

## 5. Security checklist (ฝั่ง Activity)

- [ ] บังคับ `alg=RS256` — ปฏิเสธ `none` / HS256 (กัน key-confusion)
- [ ] verify ลายเซ็นด้วย public key ที่ match `kid` เท่านั้น
- [ ] เช็ค `iss` + `aud` + `exp` ครบ
- [ ] กัน `jti` ซ้ำ (launch token = single-use)
- [ ] ใช้ `report_token` เป็น bearer ตอน callback — อย่าเอา launch token ไปยิง callback
- [ ] อย่า log token เต็ม ๆ (มี PII: `name`, `class`)
- [ ] เรียก callback ผ่าน HTTPS เท่านั้น
- [ ] อย่าใส่ token / PII ลง payload ของ `postMessage` (targetOrigin `"*"` = ใครก็อ่านได้)

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

| | Launch JWT | Session / report token |
|---|---|---|
| ใคร verify | activity (ข้าง Dreambook) | Dreambook เอง |
| crypto | **RS256** asymmetric | **HS256** symmetric (`JWT_SECRET`) |
| ใช้ตอน | handoff ตอน launch | callback (`student-context`, `progress`) |
| เหตุผล | ข้าม service → ไม่ต้องแชร์ secret | ในบ้านตัวเอง → เร็ว ง่าย |

- **Stateless** — claim พก authz มาเอง ไม่มี session store ใน DB
- **Least-privilege** — report token ทำได้แค่ complete run ของนักเรียนคนนั้น
- **Key rotation** — เลือกกุญแจด้วย `kid` (RFC 7638 thumbprint) เปลี่ยนกุญแจไม่พัง

---

**อ้างอิง code:** `src/activity/launch-token.service.ts` (launch JWT + JWKS),
`src/activity/activity.service.ts` (`createLaunch`, callback logic),
`src/activity/activity-callback.controller.ts` (callback routes),
`src/auth/activity-session.guard.ts` (verify report/session token).
เส้นทาง HTTP ทั้งหมดดูที่ [`routes.md`](routes.md).
