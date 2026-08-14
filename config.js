/**
 * Deploy-time config. This site is static (no build step), so the backend it
 * talks to has to live in a served file — a .env would never reach the browser.
 *
 * `api` = the Dreambook backend origin used for JWKS + the report callbacks.
 * The launch URL only carries `?token=`, so without this the page would fall
 * back to localhost and fail every launch off a developer's machine.
 * A `?api=` in the URL still wins, for pointing a deployed page at a local
 * backend while debugging.
 *
 * No secrets here: it ships to every visitor. An origin is public by nature.
 */
window.APP_CONFIG = {
  api: 'https://api-dev.samutfun.org',
};
