/**
 * The Dreambook handoff, shared by every real (non-demo) route: read the launch
 * token, verify it, and call back with the report token.
 *
 * It lives in its own file because two activities now implement the same
 * handshake (`/` the quiz, `/sakura` the continuous one) and the verification
 * half is security-critical — one copy means a fix can't land in one route and
 * miss the other. Everything activity-specific (the expected `aud`, what to
 * report, what to draw) stays in the route.
 *
 * Implements documents/activity/spec.md (dreambook-backend) §3.2–3.3 and §4.
 * Classic script, no build step: exposes a single global `Launch`.
 */
(function (global) {
  const QS = new URLSearchParams(location.search);

  // Where the backend lives: ?api= (debugging) beats config.js (the deployed
  // default, see that file) beats localhost (a bare `git clone`).
  const API = (QS.get('api') || global.APP_CONFIG?.api || 'http://localhost:3000').replace(/\/$/, '');
  // Callbacks carry the report_token, so they go over HTTPS only (spec §3.2).
  // Plain-HTTP localhost stays allowed so a local backend still works.
  const API_IS_SECURE =
    /^https:\/\//.test(API) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API);
  const EXPECTED_ISS = QS.get('iss') || 'dreambook';
  // Dreambook mints launch tokens with a ~600s TTL; reject anything much
  // longer-lived, whatever the token claims (spec §3.3).
  const MAX_TOKEN_TTL_SEC = 900;

  // ---------- JWT verify ----------
  const b64urlToBytes = (s) => {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  };
  const b64urlToJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

  async function fetchJwks() {
    const res = await fetch(`${API}/.well-known/jwks.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`JWKS ${res.status}`);
    return res.json();
  }

  /**
   * Verify the launch JWT. Security checklist (spec §3.3):
   * RS256 only, signature against the kid-matched key, iss/aud/exp checked,
   * jti single-use. Throws with a human-readable reason.
   *
   * @param {string} token     the `?token=` value
   * @param {string} expectedAud  this activity's `config.aud` in the catalog
   */
  async function verifyLaunchToken(token, expectedAud) {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('token ไม่ใช่ JWT');
    const [rawHeader, rawPayload, rawSig] = parts;

    const header = b64urlToJson(rawHeader);
    // Reject `none`/HS256 before touching any key material (alg-confusion).
    if (header.alg !== 'RS256') throw new Error(`alg=${header.alg} ไม่ได้รับอนุญาต (ต้องเป็น RS256)`);

    if (typeof header.kid !== 'string' || !header.kid) throw new Error('token ไม่มี kid สำหรับเลือก public key');

    const jwks = await fetchJwks();
    const jwk = (jwks.keys || []).find(
      (k) => k.kid === header.kid && k.kty === 'RSA' && k.alg === 'RS256' && (!k.use || k.use === 'sig'),
    );
    if (!jwk) throw new Error(`ไม่พบ public key ที่ตรงกับ kid=${header.kid}`);

    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(rawSig),
      new TextEncoder().encode(`${rawHeader}.${rawPayload}`),
    );
    if (!ok) throw new Error('ลายเซ็นไม่ถูกต้อง');

    const claims = b64urlToJson(rawPayload);
    if (claims.iss !== EXPECTED_ISS) throw new Error(`iss=${claims.iss} ไม่ตรงกับ ${EXPECTED_ISS}`);
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!auds.includes(expectedAud)) throw new Error(`aud=${claims.aud} ไม่ตรงกับ ${expectedAud}`);
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp <= now) throw new Error('token หมดอายุแล้ว');
    // Cap the lifetime we accept regardless of what the token asks for, so a
    // long-lived launch token can't be sat on and replayed (spec §3.3).
    if (claims.exp - now > MAX_TOKEN_TTL_SEC) throw new Error('token อายุยาวเกินกำหนด');
    if (typeof claims.iat === 'number' && claims.exp - claims.iat > MAX_TOKEN_TTL_SEC) {
      throw new Error('อายุ token ตั้งแต่ iat ถึง exp ยาวเกินกำหนด');
    }
    if (!claims.activity_id || !claims.report_token) throw new Error('token ไม่มี activity_id/report_token');

    // Single-use: a launch token replayed from history must not start a new
    // run. Storage can be unavailable in a partitioned WebView; losing replay
    // protection must not block the activity.
    if (claims.jti) {
      const seenKey = `demo-activity:jti:${claims.jti}`;
      try {
        if (localStorage.getItem(seenKey)) throw new Error('token นี้ถูกใช้ไปแล้ว (เปิดกิจกรรมใหม่จากแอป)');
        localStorage.setItem(seenKey, String(now));
      } catch (err) {
        if (err.message.startsWith('token นี้')) throw err;
        console.warn('jti replay check unavailable:', err.message);
      }
    }
    return claims;
  }

  // ---------- host app ----------
  // Only an iframe host can hear us. In the WebView `window.parent === window`,
  // so every post below is a no-op and the callback stays the only channel.
  const EMBEDDED = global.parent !== global;

  /**
   * Tell the host app what happened. Fire-and-forget: the Dreambook callback is
   * the authoritative channel, this only drives the app's UI.
   * targetOrigin '*' means anyone can read it, so keep tokens and PII out.
   *
   * Types: `activity_error` (cannot start), `level_complete` (one level
   * recorded, continuous activities only), `activity_finished` (run closed).
   */
  const postToApp = (type, extra) => {
    if (!EMBEDDED) return;
    try {
      global.parent.postMessage({ type, ...extra }, '*');
    } catch (err) {
      console.warn('postMessage failed:', err.message);
    }
  };

  // ---------- Dreambook callbacks ----------
  /**
   * Call a Dreambook callback with the report token as bearer (spec §3.2).
   *
   * A non-2xx throws an Error carrying `.status` and `.code` — the machine-
   * readable half of the spec's error table (`run_closed`, `invalid_level`,
   * …), which callers branch on to tell "retry this" from "this run is over".
   */
  const callback = async (method, path, reportToken, body) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${reportToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.ok) return res.json();

    const text = await res.text();
    let code = null;
    try {
      // Nest's error shape varies (`code`, or a `message` that is the code).
      const parsed = JSON.parse(text);
      code = parsed.code || parsed.error || (typeof parsed.message === 'string' ? parsed.message : null);
    } catch {
      /* not JSON — the status alone has to carry it */
    }
    const err = new Error(`${method} ${path} → ${res.status} ${text}`);
    err.status = res.status;
    err.code = code;
    throw err;
  };

  global.Launch = { QS, API, API_IS_SECURE, EXPECTED_ISS, MAX_TOKEN_TTL_SEC, EMBEDDED, verifyLaunchToken, callback, postToApp };
})(window);
