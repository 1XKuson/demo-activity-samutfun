const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, '..', 'launch.js'), 'utf8');
const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** One backend: its signing key and the JWKS it serves. */
async function backend(kid) {
  const { privateKey, publicKey } = await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = await webcrypto.subtle.exportKey('jwk', publicKey);
  const sign = async (claims) => {
    const head = b64url(JSON.stringify({ alg: 'RS256', kid }));
    const body = b64url(JSON.stringify(claims));
    const sig = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, Buffer.from(`${head}.${body}`));
    return `${head}.${body}.${b64url(sig)}`;
  };
  return { jwks: { keys: [{ kty: 'RSA', n: jwk.n, e: jwk.e, kid, alg: 'RS256', use: 'sig' }] }, sign };
}

/** Load launch.js as the dev page: dev + sit issuers, fetch served from `sites`. */
function loadLaunch(sites) {
  const fetched = [];
  const window = {
    APP_CONFIG: { issuers: { dreambook: 'https://dev.example', 'dreambook-sit': 'https://sit.example/' } },
  };
  window.parent = window;
  const fetch = async (url) => {
    fetched.push(url);
    const site = Object.keys(sites).find((s) => url.startsWith(s));
    const body = site && url.endsWith('/.well-known/jwks.json') ? sites[site] : { ok: true };
    return { ok: true, json: async () => body };
  };
  const sandbox = {
    window, location: { search: '' }, URLSearchParams, console: { warn() {} },
    fetch, crypto: webcrypto, TextEncoder, TextDecoder, atob, localStorage: undefined,
  };
  vm.runInNewContext(source, sandbox);
  return { Launch: window.Launch, fetched };
}

(async () => {
  const dev = await backend('dev-key');
  const sit = await backend('sit-key');
  const sites = { 'https://dev.example': dev.jwks, 'https://sit.example': sit.jwks };
  const now = Math.floor(Date.now() / 1000);
  const claims = (iss) => ({ iss, aud: 'sakura-garden', exp: now + 600, iat: now, activity_id: 'a1', report_token: 'r1' });

  // A sit token verifies against sit's keys, and callbacks follow it to sit.
  {
    const { Launch, fetched } = loadLaunch(sites);
    assert.equal(Launch.API, 'https://dev.example');
    await Launch.verifyLaunchToken(await sit.sign(claims('dreambook-sit')), 'sakura-garden');
    assert.equal(Launch.API, 'https://sit.example');
    await Launch.callback('GET', '/activities/a1/context', 'r1');
    assert.deepEqual(fetched, ['https://sit.example/.well-known/jwks.json', 'https://sit.example/activities/a1/context']);
  }

  // A dev token still verifies against dev.
  {
    const { Launch } = loadLaunch(sites);
    await Launch.verifyLaunchToken(await dev.sign(claims('dreambook')), 'sakura-garden');
    assert.equal(Launch.API, 'https://dev.example');
  }

  // Sit's key claiming dev's iss (the old sit config) is checked against dev's keys and fails.
  {
    const { Launch } = loadLaunch(sites);
    await assert.rejects(Launch.verifyLaunchToken(await sit.sign(claims('dreambook')), 'sakura-garden'), /kid=sit-key/);
    assert.equal(Launch.API, 'https://dev.example');
  }

  // An unlisted iss is refused before anything is fetched.
  for (const iss of ['dreambook-prod', 'constructor', undefined]) {
    const { Launch, fetched } = loadLaunch(sites);
    await assert.rejects(Launch.verifyLaunchToken(await sit.sign(claims(iss)), 'sakura-garden'), /ไม่อยู่ในรายชื่อ/);
    assert.equal(fetched.length, 0);
  }

  console.log('launch verify tests passed (iss picks backend: sit, dev, cross-key, unlisted)');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
