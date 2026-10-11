# demo-activity

Reference Dreambook activities: a quiz (`single`, route `/`) and Sakura
(`continuous`, route `/sakura`). Static HTML/JS — no build step, no backend of
its own. Deployed to GitHub Pages from `main` / `dev`.

@../samutfun-architecture/ARCHITECTURE.md

## Role in the system

Proves the activity contract end to end: launched by `dreambook-web-app` in an
iframe, verifies the launch JWT, reports progress to `dreambook-backend` with
the report token, and tells the web-app it finished via `postMessage`. Partner
activities copy this pattern.

## Source of truth

`../dreambook-backend/documents/activity/spec.md` (+ `impl-activity.md`).
Where code and spec disagree, the code is the bug. The file-to-spec map is
`activity-integration-guideline.md`; route-by-route behavior is in `README.md`.

## Commands

- Serve: `python3 -m http.server 5175` (or `npx serve -l 5175 .`)
- Test: `node --test tests/*.test.js`
- No-backend demos: `/demo`, `/sakura/demo`

## Layout

- `launch.js` — shared by every real route: JWT verify (RS256 via JWKS), callbacks
- `quiz.js`, `result.js` — quiz + its result page
- `sakura.js`, `sakura-result.js`, `sakura/` — Sakura + its catalog values (`sakura/catalog.md`)
- `404.html` — static-host shim for `/activity/result/<result_id>`
- `assets/`, `art/`, `tools/` — images and the scripts that produce them

## Cross-repo touchpoints

- Callback calls and `postMessage` events must match the spec; send the
  `postMessage` only after the matching `PUT /activities/:id/progress` succeeds.
- Catalog values (`web_url`, `result_url`, `aud`, level stamps) are seeded by
  `../dreambook-backend/prisma/activity-catalog.{dev,prod}.json` — change both together.
