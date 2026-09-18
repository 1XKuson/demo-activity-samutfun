# Dreambook catalog — Sakura Garden

นำค่าชุดนี้ไปเพิ่มใน `prisma/activity-catalog.ts` ของ Dreambook backend แล้วรัน
`prisma db seed` ตาม `activity-integration-guideline.md` (backend ไม่ได้อยู่ใน repo นี้)

| field | value |
|---|---|
| `name` | `ซากุระของฉัน` |
| `activity_slug` | `sakura-garden` |
| `activity_type` | `continuous` |
| `config.aud` | `sakura-garden` |
| `web_url` prod | `https://1xkuson.github.io/demo-activity-samutfun/sakura` |
| `web_url` dev | `https://1xkuson.github.io/demo-activity-samutfun/dev/sakura` |
| `config.result_url` prod | `https://1xkuson.github.io/demo-activity-samutfun/activity/result` |
| `config.result_url` dev | `https://1xkuson.github.io/demo-activity-samutfun/dev/activity/result` |
| `thumbnail_url` prod | `https://1xkuson.github.io/demo-activity-samutfun/assets/sakura/pixel/thumbnail.png` |
| `thumbnail_url` dev | `https://1xkuson.github.io/demo-activity-samutfun/dev/assets/sakura/pixel/thumbnail.png` |

## Levels

ต้อง seed ครบ 5 level เรียง 1–5 และใช้ ID/QR token ที่คงที่หลังเริ่มแจกแล้ว

| level | sticker name | suggested `qr_token` | suggested `variant` | image path |
|---:|---|---|---|---|
| 1 | เมล็ดแห่งความหวัง | `sakura-garden-l1` | `sakura-seedling` | `assets/sakura/pixel/sticker-level-1.png` |
| 2 | กิ่งอ่อนกล้าหาญ | `sakura-garden-l2` | `sakura-sapling` | `assets/sakura/pixel/sticker-level-2.png` |
| 3 | ผู้ดูแลสวน | `sakura-garden-l3` | `sakura-growing` | `assets/sakura/pixel/sticker-level-3.png` |
| 4 | ผู้เฝ้าดอกไม้ | `sakura-garden-l4` | `sakura-blooming` | `assets/sakura/pixel/sticker-level-4.png` |
| 5 | เจ้าสวนซากุระ | `sakura-garden-l5` | `sakura-full-bloom` | `assets/sakura/pixel/sticker-level-5.png` |

รูปที่ใช้เป็นชุด pixel art ใน `assets/sakura/pixel/` ชุดเดียวกับที่เกมแสดง
(ไฟล์ต้นฉบับความละเอียดเต็มยังอยู่ที่ `assets/sakura/` แต่ไม่ได้ใช้ใน catalog)
URL รูปใน catalog ต้องเป็น absolute URL โดยเติม origin ของ env หน้า path ในตาราง
ด้านบน Activity จะส่งเพียง `{ level, result_id }`; ห้ามส่ง `sticker_id` กลับเอง
เพราะ backend เป็นผู้เลือกสติกเกอร์จาก level

## Growth contract

- เริ่มที่ level 1 และรายงาน checkpoint แรกเมื่อเปิดสวนสำเร็จ
- น้ำให้ growth `+1`, ปุ๋ยให้ `+2`; ให้แต่ละชนิดได้อย่างละหนึ่งครั้งต่อวัน
- threshold level 1–5 คือ `0, 3, 6, 9, 12`
- เมื่อข้าม level จะ `PUT /activities/:id/progress` ทีละ level พร้อม
  `result_id: sakura-l<level>` เพื่อไม่พลาดสติกเกอร์เพราะ level ไม่สะสม
- level 5 แล้วนักเรียนกดจบ จึงส่ง `{ result_id: "sakura-l5", completed: true }`

## Seed entry

รูปแบบเดียวกับ entry อื่นใน `prisma/activity-catalog.ts` (flat `aud`/`result_url`
ไม่ได้ซ้อนใน `config`) เช็ค `id` ทั้ง 6 ตัวว่าไม่ชนของเดิมก่อน seed

### local — ทดสอบบนเครื่อง

`web_url` ต้องเป็นที่อยู่ที่ WebView เปิดถึง ถ้า backend กับ app อยู่เครื่องเดียวกัน
ใช้ `localhost` ได้ ถ้ายิงจากมือถือจริงเปลี่ยนเป็น LAN IP ของเครื่อง (`http://192.168.x.x:8811`)

```ts
{
  // Continuous: the garden survives leaving the WebView. Appending a level
  // later is safe; renumbering or repointing one is not.
  id: '00000000-0000-4000-a000-000000000005',
  name: 'ซากุระของฉัน',
  description: 'ดูแลต้นซากุระให้โตครบ 5 ระดับ ด้วยการรดน้ำและใส่ปุ๋ยวันละครั้ง',
  activity_slug: 'sakura-garden',
  activity_type: 'continuous',
  aud: 'sakura-garden',
  web_url: 'http://localhost:8811/sakura',
  demo_url: 'http://localhost:8811/sakura/demo',
  result_url: 'http://localhost:8811/activity/result',
  thumbnail_url: 'http://localhost:8811/assets/sakura/pixel/thumbnail.png',
  levels: [
    {
      level: 1,
      id: '00000000-0000-4000-b000-000000000011',
      name: 'เมล็ดแห่งความหวัง',
      qr_token: 'sakura-garden-l1',
      variant: 'green',
      image_url: 'http://localhost:8811/assets/sakura/pixel/sticker-level-1.png',
    },
    {
      level: 2,
      id: '00000000-0000-4000-b000-000000000012',
      name: 'กิ่งอ่อนกล้าหาญ',
      qr_token: 'sakura-garden-l2',
      variant: 'green',
      image_url: 'http://localhost:8811/assets/sakura/pixel/sticker-level-2.png',
    },
    {
      level: 3,
      id: '00000000-0000-4000-b000-000000000013',
      name: 'ผู้ดูแลสวน',
      qr_token: 'sakura-garden-l3',
      variant: 'pink',
      image_url: 'http://localhost:8811/assets/sakura/pixel/sticker-level-3.png',
    },
    {
      level: 4,
      id: '00000000-0000-4000-b000-000000000014',
      name: 'ผู้เฝ้าดอกไม้',
      qr_token: 'sakura-garden-l4',
      variant: 'pink',
      image_url: 'http://localhost:8811/assets/sakura/pixel/sticker-level-4.png',
    },
    {
      level: 5,
      id: '00000000-0000-4000-b000-000000000015',
      name: 'เจ้าสวนซากุระ',
      qr_token: 'sakura-garden-l5',
      variant: 'purple',
      image_url: 'http://localhost:8811/assets/sakura/pixel/sticker-level-5.png',
    },
  ],
}
```

### dev — deploy แล้ว

entry เดียวกัน เปลี่ยนแค่ origin เป็น
`https://1xkuson.github.io/demo-activity-samutfun/dev` (prod ตัด `/dev` ออก)
และใช้ `id` คนละชุดถ้า backend dev กับ prod เป็นคนละฐาน

| field | ค่า |
|---|---|
| `web_url` | `https://1xkuson.github.io/demo-activity-samutfun/dev/sakura` |
| `demo_url` | `https://1xkuson.github.io/demo-activity-samutfun/dev/sakura/demo` |
| `result_url` | `https://1xkuson.github.io/demo-activity-samutfun/dev/activity/result` |
| `thumbnail_url` | `https://1xkuson.github.io/demo-activity-samutfun/dev/assets/sakura/pixel/thumbnail.png` |
| `image_url` | `…/dev/assets/sakura/pixel/sticker-level-<n>.png` |

### ก่อน seed ต้องเช็ค

- **`variant`** — entry ตัวอย่างใช้ `'purple'` ถ้าฟิลด์นี้เป็น enum สีใน schema
  ให้ใช้ค่าที่ enum รับเท่านั้น ถ้าเป็น string อิสระใช้ค่า semantic จากตารางด้านบน
  (`sakura-seedling` … `sakura-full-bloom`) จะสื่อกว่า
- **`result_url` บน local ใช้ไม่ได้ถ้าเสิร์ฟด้วย `python3 -m http.server`** เพราะ
  ไม่มี 404 shim หน้า `/activity/result/sakura-l3` จะได้ 404 ต้องเสิร์ฟด้วยตัวที่
  fallback ไป `404.html` หรือเทสหน้าสติกเกอร์แยกจาก console
- **`id` ของ level ห้ามเปลี่ยนหลังแจก QR แล้ว** ownership ของสติกเกอร์คือหลักฐาน
  ว่าผ่าน level นั้น
