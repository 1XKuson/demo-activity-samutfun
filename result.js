/**
 * The result page — what a student sees when they reopen the sticker in the
 * Dreambook journal. The app iframes `<origin>/activity/result/<result_id>`
 * (built server-side from the activity's own web_url, see dreambook-backend
 * sticker.service.ts), cold: no launch token, no callback, no session.
 *
 * So the whole review has to come out of the result_id itself, which is why the
 * run is encoded into it at completion time (QuizKit.encodeRun). Nothing here
 * talks to a backend.
 */
(function () {
  const { decodeRun, renderReview, firstTryCount, QUESTIONS, el, esc } = QuizKit;

  /** The id from the path the app links to, or `?r=` when a host can't serve a
   *  path segment (see 404.html). */
  function readResultId() {
    const fromQuery = new URLSearchParams(location.search).get('r');
    if (fromQuery) return fromQuery;
    const m = location.pathname.match(/\/activity\/result\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function renderResultPage(app) {
    const resultId = readResultId();
    const run = resultId ? decodeRun(resultId) : null;

    app.innerHTML = '';

    if (!run) {
      // Same wording the app falls back to when a sticker carries no result.
      app.append(
        el(`<div class="group group-pad enter">
              <h1 class="title-3">ยังไม่มีรายละเอียดผลลัพธ์</h1>
              <p class="subhead" style="margin-top:8px">${
                resultId ? 'ผลลัพธ์นี้มาจากคำถามชุดก่อนหน้า จึงเปิดดูย้อนหลังไม่ได้' : 'เปิดหน้านี้จากสแตมป์ในสมุดบันทึก'
              }</p>
              ${resultId ? `<p class="footnote" style="margin-top:6px">result_id: ${esc(resultId)}</p>` : ''}
            </div>`),
      );
      return;
    }

    const perfect = firstTryCount(run) === QUESTIONS.length;
    app.append(
      el(`<header class="header enter">
            <h1 class="large-title">ผลกิจกรรม</h1>
            <p class="subhead">ตอบถูกครบ ${QUESTIONS.length} ข้อ${
              perfect ? ' · ถูกตั้งแต่ครั้งแรกทุกข้อ' : ''
            }</p>
          </header>`),
    );

    const review = renderReview(app, run);
    review.classList.add('enter-2');
  }

  // The 404 shim injects this script late, so DOMContentLoaded may already be
  // gone by the time we get here.
  const start = () => renderResultPage(document.getElementById('app'));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
