# การเชื่อม activity กับ Dreambook

> **source of truth คือ `dreambook-backend/documents/activity/spec.md`**
> ไฟล์นี้เหลือไว้แค่สรุปว่า repo นี้ implement อะไร และชี้ว่าไปอ่านของจริงที่ไหน
> ก่อนหน้านี้มีเอกสารเต็มสองฉบับ (ที่นี่กับฝั่ง backend) แล้ว drift กัน — **ห้าม
> copy สเปคทั้งก้อนกลับมาเก็บไว้แก้แยกอีก** แก้ที่สเปคที่เดียว

| อยากรู้เรื่อง | อ่านที่สเปค |
|---|---|
| ศัพท์ (catalog / instance / run / checkpoint) | §1 |
| โมเดลข้อมูล + invariant (1 สติกเกอร์ต่อนักเรียนตลอดชีพ) | §2 |
| route + claim ของ token | §3 |
| postMessage 3 type | §4 |
| แอปทำอะไรกับแต่ละ type | §5 |
| กฎของ activity + checklist ก่อนส่ง | §6 |
| ขั้นตอนพา activity ใหม่ขึ้นระบบ | `documents/activity/impl-activity.md` |

## repo นี้ implement อะไร

| ส่วน | ไฟล์ | ตรงกับสเปค |
|---|---|---|
| verify launch JWT (RS256 + JWKS, `iss`/`aud`/`exp`, กัน `jti` ซ้ำ) | `launch.js` | §3.3, §6.2 |
| callback ด้วย report token (HTTPS เท่านั้น) | `launch.js` → `callback()` | §3.2 |
| postMessage 3 type ที่เดียว | `launch.js` → `postToApp()` | §4 |
| กิจกรรม `single` 1 level | `index.html` | §3.2 |
| กิจกรรม `continuous` 5 level + state ใน localStorage ผูกกับ `run_id` | `sakura/index.html` | §6.1 |
| ค่าที่ต้อง seed ลง `ActivityCatalog` | `sakura/catalog.md` | §6.3 |

## สามข้อที่พลาดบ่อยที่สุด

1. **ยิง postMessage หลัง `PUT` ได้ 2xx เท่านั้น** — ยิงก่อน แอปจะไปเปิดสแตมป์ที่ยังไม่มี
2. **`PUT` พังที่ไม่ใช่ 401 ห้ามยิง `activity_error`** — run ยังกู้ได้ ให้โชว์ปุ่มลองใหม่
   ในหน้าตัวเอง · **401 ต้องยิง** พร้อม `code: 'session_expired'` เพราะมีแต่แอปที่ออก
   report token ใบใหม่ให้ได้
3. **`result_id` เป็นของ run ไม่ใช่ของ level** — ส่งครั้งเดียวตอนปิด run ส่งทุก level
   ก็ถูกทับอยู่ดี
