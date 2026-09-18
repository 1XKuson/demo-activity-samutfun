const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'launch.js'), 'utf8');

/** Load launch.js the way a page does, with a parent window of our choosing. */
function loadLaunch({ embedded, throws = false }) {
  const posted = [];
  const window = {
    APP_CONFIG: { api: 'https://api.example' },
    postMessage: (data, targetOrigin) => {
      if (throws) throw new Error('blocked');
      posted.push({ data, targetOrigin });
    },
  };
  window.parent = embedded ? { postMessage: window.postMessage } : window;
  const sandbox = { window, location: { search: '' }, URLSearchParams, console: { warn() {} } };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);
  return { Launch: window.Launch, posted };
}

// In an iframe every type reaches the host, with no token or PII in the payload.
const iframe = loadLaunch({ embedded: true });
assert.equal(iframe.Launch.EMBEDDED, true);
iframe.Launch.postToApp('level_complete', { level: 2, result_id: 'm2', granted: true, sticker_id: 'stk_2' });
iframe.Launch.postToApp('activity_finished', { levels: [1, 2, 3] });
iframe.Launch.postToApp('activity_error', { message: 'no token' });
assert.deepEqual(
  iframe.posted.map((p) => p.data.type),
  ['level_complete', 'activity_finished', 'activity_error'],
);
// JSON round-trip: the payload is built in the vm realm, so its prototype
// differs from ours and deepEqual would fail on identity alone.
assert.deepEqual(JSON.parse(JSON.stringify(iframe.posted[0].data)), {
  type: 'level_complete', level: 2, result_id: 'm2', granted: true, sticker_id: 'stk_2',
});
assert.deepEqual([...new Set(iframe.posted.map((p) => p.targetOrigin))], ['*']);

// WebView host: window.parent === window, so posting is a no-op, not a throw.
const webview = loadLaunch({ embedded: false });
assert.equal(webview.Launch.EMBEDDED, false);
webview.Launch.postToApp('activity_finished', { levels: [1] });
assert.equal(webview.posted.length, 0);

// A host that refuses the message must not break the activity.
const hostile = loadLaunch({ embedded: true, throws: true });
hostile.Launch.postToApp('activity_error', { message: 'x' });

// Every page that posts has to take the shared helper, not roll its own.
for (const page of ['index.html', 'sakura/index.html']) {
  const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
  assert.match(html, /postToApp\s*}?\s*=\s*Launch|postToApp,?\s*}\s*=\s*Launch/, `${page} must destructure postToApp from Launch`);
  assert.doesNotMatch(html, /window\.parent\.postMessage/, `${page} must not post directly`);
  assert.match(html, /postToApp\('activity_error'/, `${page} must report a failed start`);
}
for (const page of ['sakura/index.html']) {
  const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
  assert.match(html, /postToApp\('level_complete'/, `${page} must report each recorded level`);
  // The stamp id comes from stamps_granted, never from an id the page picks,
  // and is omitted when the retry granted nothing.
  assert.match(html, /\.\.\.\(stamp\?\.sticker_id \? \{ sticker_id: stamp\.sticker_id \} : \{\}\)/, `${page} must pass the granted sticker_id through`);
  assert.match(html, /stamps_granted \|\| \[\]\)\[0\]/, `${page} must read the stamp off the PUT response`);
  assert.match(html, /postToApp\('activity_finished'/, `${page} must report the closed run`);
}

console.log('launch postMessage tests passed (3 types, iframe + webview + hostile host, 2 pages)');
