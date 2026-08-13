/**
 * Shared quiz kit for both entry points:
 *   /       — the real activity (launch JWT + Dreambook callbacks)
 *   /demo   — the same quiz, sandboxed, no backend
 *
 * Keeping the questions and the rendering here means the demo route can never
 * drift from what a student actually sees. Classic script, no build step:
 * it exposes a single global `QuizKit`.
 */
(function (global) {
  // Thai exam convention: choices are lettered ก ข ค ง, not numbered.
  const KEYS = ['ก', 'ข', 'ค', 'ง'];

  const QUESTIONS = [
    {
      q: 'ยอดเขาที่สูงที่สุดในประเทศไทยคือยอดเขาใด?',
      choices: ['ดอยหลวงเชียงดาว', 'ภูกระดึง', 'ดอยอินทนนท์', 'ภูทับเบิก'],
      answer: 2,
    },
    {
      q: 'สัตว์ประจำชาติของไทยคือสัตว์ชนิดใด?',
      choices: ['ช้าง', 'เสือโคร่ง', 'ควาย', 'สิงโต'],
      answer: 0,
    },
    {
      q: 'ก่อนที่จะเปลี่ยนชื่อเป็น "ประเทศไทย" ประเทศของเรามีชื่อทางการว่าอะไรมาก่อน?',
      choices: ['ล้านนา', 'สยาม', 'สุวรรณภูมิ', 'ศรีวิชัย'],
      answer: 1,
    },
  ];

  const CHECK_ICON =
    '<svg viewBox="0 0 22 22" aria-hidden="true"><path d="M4.5 11.5l4.5 4.5 8.5-9.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CLOSE_ICON =
    '<svg viewBox="0 0 22 22" aria-hidden="true"><path d="M6 6l10 10M16 6L6 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const AWARD_SVG = `<div class="award">
        <svg viewBox="0 0 132 132" role="img" aria-label="กิจกรรมสำเร็จ">
          <circle class="ring" cx="66" cy="66" r="57" transform="rotate(-90 66 66)" />
          <path class="tick" d="M42 68l16 16 32-36" />
        </svg>
      </div>`;

  const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /**
   * Render greeting + the 3-question quiz into `app`.
   *
   * @param {HTMLElement} app
   * @param {object}   opts
   * @param {string}   opts.name      nickname shown in the greeting
   * @param {string}  [opts.tag]      pill before the subtitle (class level, or "ตัวอย่าง")
   * @param {string}  [opts.tagClass] 'class-tag' (real) or 'demo-tag' (sandbox)
   * @param {string}  [opts.subtitle]
   * @param {Function} opts.onDone    called once all questions are answered right
   */
  function renderQuiz(app, opts) {
    const { name, tag = null, tagClass = 'class-tag', onDone } = opts;
    const subtitle = opts.subtitle ?? 'ตอบให้ถูกครบ 3 ข้อ แล้วรับเหรียญ';

    app.innerHTML = '';
    app.append(
      el(`<header class="header enter">
            <h1 class="large-title">สวัสดี ${esc(name)}</h1>
            <p class="subhead">${tag ? `<span class="${tagClass}">${esc(tag)}</span>` : ''}${esc(subtitle)}</p>
          </header>`),
    );

    const quiz = el('<section class="group enter-2"></section>');
    app.append(quiz);

    const steps = el(`<div class="steps">
          <div class="bars"></div>
          <p class="footnote"></p>
        </div>`);
    const bars = steps.querySelector('.bars');
    const counter = steps.querySelector('.footnote');
    QUESTIONS.forEach(() => bars.append(el('<div class="bar"><span></span></div>')));
    quiz.append(steps);

    let index = 0;
    const step = () => {
      [...quiz.children].slice(1).forEach((n) => n.remove());
      const item = QUESTIONS[index];
      counter.textContent = `ข้อ ${index + 1} จาก ${QUESTIONS.length}`;

      const body = el('<div class="enter"></div>');
      body.append(el(`<h2 class="question headline">${esc(item.q)}</h2>`));

      const list = el('<ul class="list"></ul>');
      const feedback = el('<p class="feedback"></p>');

      item.choices.forEach((choice, i) => {
        const row = el(`<li><button class="row" type="button">
              <span class="key">${KEYS[i]}</span>
              <span class="text">${esc(choice)}</span>
              <span class="mark"></span>
            </button></li>`);
        const btn = row.querySelector('.row');
        btn.addEventListener('click', () => {
          if (i === item.answer) {
            btn.dataset.state = 'right';
            btn.querySelector('.mark').innerHTML = CHECK_ICON;
            bars.children[index].classList.add('done');
            feedback.className = 'feedback good';
            feedback.textContent = 'ถูกต้อง';
            list.querySelectorAll('.row').forEach((b) => (b.disabled = true));
            index += 1;
            setTimeout(() => (index < QUESTIONS.length ? step() : onDone()), 550);
          } else {
            // Retry until right — no penalty, no scoring. This activity only
            // exists to prove the launch/callback loop works end to end.
            btn.dataset.state = 'wrong';
            btn.querySelector('.mark').innerHTML = CLOSE_ICON;
            feedback.className = 'feedback bad';
            feedback.textContent = 'ยังไม่ใช่ ลองข้ออื่นดู';
          }
        });
        list.append(row);
      });

      body.append(list, feedback);
      quiz.append(body);
    };
    step();
  }

  global.QuizKit = { KEYS, QUESTIONS, CHECK_ICON, CLOSE_ICON, AWARD_SVG, el, esc, renderQuiz };
})(window);
