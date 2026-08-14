/**
 * The result page — what a student sees when they reopen the sticker in the
 * Dreambook journal. The app iframes `<origin>/activity/result/<result_id>`
 * (built server-side from the activity's own web_url, see dreambook-backend
 * sticker.service.ts), cold: no launch token, no callback, no session.
 *
 * It shows the answer key, which is the same for everyone — so the result_id in
 * the URL is not read at all, and nothing here talks to a backend.
 */
(function () {
  const { renderAnswerKey, QUESTIONS, el } = QuizKit;

  function renderResultPage(app) {
    app.innerHTML = '';
    app.append(
      el(`<header class="header enter">
            <h1 class="large-title">เฉลยกิจกรรม</h1>
            <p class="subhead">คำถามชวนคิด ${QUESTIONS.length} ข้อ</p>
          </header>`),
    );
    renderAnswerKey(app).classList.add('enter-2');
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
