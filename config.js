/**
 * Deploy-time config. This site is static (no build step), so the backend it
 * talks to has to live in a served file — a .env would never reach the browser.
 *
 * `api` = the Dreambook backend origin used for JWKS + the report callbacks.
 * The launch URL only carries `?token=`, so without this the page would fall
 * back to localhost and fail every launch off a developer's machine.
 *
 * Two environments share this one file, told apart by where they are served
 * from (see .github/workflows/pages.yml):
 *
 *   prod  https://1xkuson.github.io/demo-activity-samutfun/      -> api.samutfun.org
 *   dev   https://1xkuson.github.io/demo-activity-samutfun/dev/  -> api-dev.samutfun.org
 *
 * Deciding by path instead of shipping a different file per branch means
 * merging dev into main can never drag a dev backend into production.
 * Anything served from elsewhere (a local `python3 -m http.server`, a fork)
 * gets prod; a `?api=` in the URL still wins over all of it, for pointing a
 * deployed page at a local backend while debugging.
 *
 * No secrets here: it ships to every visitor. An origin is public by nature.
 */
window.APP_CONFIG = {
  api: /(^|\/)dev\//.test(location.pathname)
    ? 'https://api-dev.samutfun.org'
    : 'https://api.samutfun.org',
};
