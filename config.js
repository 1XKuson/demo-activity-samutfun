/**
 * Deploy-time config. This site is static (no build step), so the backend it
 * talks to has to live in a served file — a .env would never reach the browser.
 *
 * `issuers` = launch-token `iss` -> the Dreambook backend origin used for that
 * token's JWKS + report callbacks. Each backend signs with its own key, and the
 * dev page also serves sit (sit seeds dev's catalog), so the token's `iss`
 * picks the backend. An `iss` not listed here is rejected. The launch URL only
 * carries `?token=`, so without this the page would fall back to localhost.
 *
 * Three environments share this one file, told apart by where the page is
 * served from (see .github/workflows/pages.yml):
 *
 *   local  http://localhost:*  /  http://127.0.0.1:*        -> localhost:3000
 *   dev    https://1xkuson.github.io/demo-activity-samutfun/dev/ -> api-dev / api-sit.samutfun.org
 *   prod   https://1xkuson.github.io/demo-activity-samutfun/     -> api.samutfun.org
 *
 * Deciding by location instead of shipping a different file per branch means
 * merging dev into main can never drag a dev backend into production.
 * Anything served from elsewhere (a fork, a preview host) gets prod, which is
 * the safe default: a wrong guess there fails signature verification rather
 * than writing to a real backend. A `?api=` in the URL still wins over all of
 * it, for pointing any page at another backend while debugging.
 *
 * Hostname is checked before path, so a local checkout served under a `/dev/`
 * path is still local — reach the deployed dev backend with `?api=`.
 *
 * No secrets here: it ships to every visitor. An origin is public by nature.
 */
const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const isDevDeploy = /(^|\/)dev\//.test(location.pathname);
const env = isLocal ? 'local' : isDevDeploy ? 'dev' : 'prod';

window.APP_CONFIG = {
  env,
  // Keys must match each backend's DREAMBOOK_LAUNCH_ISS.
  issuers: {
    local: { dreambook: 'http://localhost:3000' },
    dev: { dreambook: 'https://api-dev.samutfun.org', 'dreambook-sit': 'https://api-sit.samutfun.org' },
    prod: { dreambook: 'https://api.samutfun.org' },
  }[env],
  features: {
    // The garden's dev tools: free coins and a +1 day jump. Both are
    // client-side only — neither mints a Dreambook reward nor moves the run.
    // Local only: a deployed dev page is still a real run against a real
    // backend, so it gets the env ribbon but no tools.
    devTools: env === 'local',
  },
};
