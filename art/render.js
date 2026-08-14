/** Render the art HTML to PNG via headless Chrome (CDP). */
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const CDP = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const JOBS = [
  { html: 'thumbnail.html', out: 'thumbnail.png', w: 720, h: 720, transparent: false },
  { html: 'stamp.html', out: 'stamp.png', w: 360, h: 360, transparent: true },
];

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej)));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  };
  return {
    ws,
    send: (method, params = {}) =>
      new Promise((res, rej) => {
        const mid = ++id;
        pending.set(mid, { res, rej });
        ws.send(JSON.stringify({ id: mid, method, params }));
      }),
  };
}

(async () => {
  const targets = await fetch(`http://localhost:${CDP}/json/list`).then((r) => r.json());
  const { ws, send } = await connect(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await send('Page.enable');

  for (const job of JOBS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: job.w,
      height: job.h,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Page.navigate', { url: 'file://' + path.join(DIR, job.html) });
    await sleep(1200); // fonts
    // omitBackground alone still composites the page's base colour; the
    // override is what actually makes the capture alpha-transparent.
    if (job.transparent) {
      await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    } else {
      await send('Emulation.setDefaultBackgroundColorOverride', {});
    }
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      ...(job.transparent ? { omitBackground: true } : {}),
    });
    fs.writeFileSync(path.join(DIR, job.out), Buffer.from(shot.data, 'base64'));
    console.log('wrote', job.out);
  }

  ws.close();
  process.exit(0);
})();
