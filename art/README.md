# art — ต้นฉบับรูปกิจกรรม

PNG ใน [`../assets/`](../assets) ไม่ได้วาดมือ — render จาก SVG ในโฟลเดอร์นี้
แก้ที่นี่แล้ว render ใหม่ อย่าไปแก้ PNG ตรง ๆ

| ไฟล์ | คืออะไร |
|---|---|
| `thumbnail.html` | → `assets/thumbnail.png` (720×720 ทึบ) |
| `stamp.html` | → `assets/stamp.png` (360×360 โปร่งใส) |
| `render.js` | สั่ง headless Chrome ถ่าย PNG ทั้งสองใบ |
| `preview.html` | เอา PNG ไปวางบนการ์ดจริงของแอป ดูขนาดจริงก่อน ship |

## render ใหม่

```bash
# 1. เปิด Chrome พร้อม CDP (ต้องมี tab ว่างอย่างน้อย 1)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-art about:blank &

# 2. render แล้ว copy ทับของเดิม
node art/render.js && cp art/*.png assets/
```

`render.js` เขียน PNG ไว้ข้าง ๆ ตัวเองใน `art/` — ต้อง copy เข้า `assets/` เอง
เพื่อให้เห็นก่อนว่าได้รูปที่ต้องการจริงค่อยทับ

## ทำไมต้อง headless Chrome

ต้องการ PNG ที่ font ไทยและ layout ออกมาเหมือนที่เบราว์เซอร์เห็นเป๊ะ ๆ และ
สแตมป์ต้องมี alpha จริง — `Page.captureScreenshot` + `omitBackground` +
`Emulation.setDefaultBackgroundColorOverride` (alpha 0) ให้ทั้งสองอย่าง
โดยไม่ต้องลง dependency อะไรเพิ่ม (`omitBackground` เฉย ๆ ไม่พอ ยังได้พื้นทึบ)

## ข้อจำกัดที่ต้องรักษาไว้

- **thumbnail** โดน `object-cover` ที่ 240px ในกรอบมุมมน — อย่าวางอะไรสำคัญชิดขอบ
- **stamp** โดน `object-contain` ที่ 120px + เอียง 4° บนพื้นการ์ดสีอ่อน
  (`highlight-*-100`) — ต้องโปร่งใส และต้องอ่านออกตอนเล็ก เส้น ink หนา ๆ ช่วยได้
- สีล้อ token ของ web app: brand `#fff454`, ink `#222`, secondary-yellow `#c98a00`,
  green `#1ac57d`, paper-mid `#fdfdfc`
