/**
 * Sakura Garden activity UI + deterministic game logic.
 *
 * This file has no Dreambook dependency. `/sakura` supplies the verified
 * launch session and callbacks; `/sakura/demo` supplies an in-memory session.
 * Keeping the garden, shop and 24 game here makes both routes exercise the
 * same rules and lets the small pure helpers be smoke-tested in Node.
 */
(function (global) {
  'use strict';

  const LEVELS = [
    { level: 1, threshold: 0, name: 'ต้นกล้าแรกผลิ', stamp: 'เมล็ดแห่งความหวัง' },
    { level: 2, threshold: 3, name: 'กิ่งอ่อนตั้งตัว', stamp: 'กิ่งอ่อนกล้าหาญ' },
    { level: 3, threshold: 6, name: 'พุ่มใบเติบโต', stamp: 'ผู้ดูแลสวน' },
    { level: 4, threshold: 9, name: 'ซากุระเริ่มบาน', stamp: 'ผู้เฝ้าดอกไม้' },
    { level: 5, threshold: 12, name: 'ซากุระบานเต็มต้น', stamp: 'เจ้าสวนซากุระ' },
  ];

  const SHOP = {
    water: { key: 'water', label: 'น้ำสะอาด', sprite: 'water', price: 3, growth: 1 },
    fertilizer: { key: 'fertilizer', label: 'ปุ๋ยดอกไม้', sprite: 'sprout', price: 5, growth: 2 },
  };

  const GAME_REWARD = 8;
  const MAX_GROWTH = LEVELS[LEVELS.length - 1].threshold;

  // Each entry is solvable with the pair-combining interaction below. The
  // solution is only shown after a student asks for a hint.
  const PUZZLES = [
    { numbers: [1, 2, 3, 4], solution: '(1 + 3) × (2 + 4)' },
    { numbers: [1, 3, 4, 6], solution: '6 ÷ (1 − 3 ÷ 4)' },
    { numbers: [2, 3, 4, 6], solution: '6 × 4 ÷ (3 − 2)' },
    { numbers: [2, 2, 3, 9], solution: '(9 − 3) × (2 + 2)' },
    { numbers: [1, 5, 5, 5], solution: '5 × (5 − 1 ÷ 5)' },
    { numbers: [4, 7, 8, 8], solution: '(7 − 4) × 8 × (8 ÷ 8)' },
    { numbers: [3, 3, 8, 8], solution: '8 ÷ (3 − 8 ÷ 3)' },
    { numbers: [2, 4, 6, 8], solution: '8 × 4 − 6 − 2' },
  ];

  const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  const esc = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const freshState = () => ({
    version: 1,
    coins: 6,
    inventory: { water: 0, fertilizer: 0 },
    growth: 0,
    careDays: {},
    reportedLevels: [],
    gamesWon: 0,
    closed: false,
  });

  function normalizeState(raw) {
    const base = freshState();
    const state = raw && typeof raw === 'object' ? raw : {};
    const reported = Array.isArray(state.reportedLevels)
      ? [...new Set(state.reportedLevels.map(Number).filter((n) => n >= 1 && n <= 5))].sort((a, b) => a - b)
      : [];
    return {
      ...base,
      coins: Math.max(0, Math.floor(Number(state.coins ?? base.coins) || 0)),
      inventory: {
        water: Math.max(0, Math.floor(Number(state.inventory?.water) || 0)),
        fertilizer: Math.max(0, Math.floor(Number(state.inventory?.fertilizer) || 0)),
      },
      growth: Math.min(MAX_GROWTH, Math.max(0, Math.floor(Number(state.growth) || 0))),
      careDays: state.careDays && typeof state.careDays === 'object' ? state.careDays : {},
      reportedLevels: reported,
      gamesWon: Math.max(0, Math.floor(Number(state.gamesWon) || 0)),
      closed: !!state.closed,
    };
  }

  const stageForGrowth = (growth) =>
    LEVELS.reduce((stage, candidate) => (growth >= candidate.threshold ? candidate : stage), LEVELS[0]);

  const stageByLevel = (level) => LEVELS.find((stage) => stage.level === Number(level)) || null;

  const imageForLevel = (level, assetRoot) =>
    `${String(assetRoot || 'assets/sakura').replace(/\/$/, '')}/pixel/sticker-level-${Number(level)}.png`;

  function localDateKey(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function buyItem(input, itemKey) {
    const state = normalizeState(input);
    const item = SHOP[itemKey];
    if (!item) return { state, ok: false, message: 'ไม่พบของชิ้นนี้ในร้าน' };
    if (state.coins < item.price) {
      return { state, ok: false, message: `ต้องมีอีก ${item.price - state.coins} เหรียญ` };
    }
    state.coins -= item.price;
    state.inventory[itemKey] += 1;
    return { state, ok: true, message: `ซื้อ${item.label}แล้ว` };
  }

  function tendTree(input, itemKey, dateKey = localDateKey()) {
    const state = normalizeState(input);
    const item = SHOP[itemKey];
    if (!item) return { state, ok: false, message: 'ไม่รู้จักอุปกรณ์ชิ้นนี้' };
    if (state.closed) return { state, ok: false, message: 'สวนรอบนี้ปิดแล้ว' };
    if (state.growth >= MAX_GROWTH) return { state, ok: false, message: 'ต้นซากุระโตเต็มที่แล้ว' };
    if (state.inventory[itemKey] < 1) return { state, ok: false, message: `${item.label}หมดแล้ว แวะร้านค้าก่อนได้` };

    const today = state.careDays[dateKey] || { water: false, fertilizer: false };
    if (today[itemKey]) return { state, ok: false, message: `วันนี้ให้${item.label}แล้ว กลับมาดูแลต่อพรุ่งนี้นะ` };

    const beforeLevel = stageForGrowth(state.growth).level;
    state.inventory[itemKey] -= 1;
    state.growth = Math.min(MAX_GROWTH, state.growth + item.growth);
    state.careDays = { ...state.careDays, [dateKey]: { ...today, [itemKey]: true } };

    // Only recent dates are useful to the UI. This prevents an unbounded local
    // storage record without changing the growth total.
    const keys = Object.keys(state.careDays).sort();
    for (const oldKey of keys.slice(0, Math.max(0, keys.length - 45))) delete state.careDays[oldKey];

    const afterLevel = stageForGrowth(state.growth).level;
    return {
      state,
      ok: true,
      leveledUp: afterLevel > beforeLevel,
      message: afterLevel > beforeLevel ? `เติบโตเป็นระดับ ${afterLevel} แล้ว` : `${item.label}ช่วยให้ต้นไม้เติบโตขึ้น`,
    };
  }

  function mintCoins(input, amount = 100) {
    const state = normalizeState(input);
    state.coins += Math.max(0, Math.floor(Number(amount) || 0));
    return state;
  }

  function awardGame(input) {
    const state = normalizeState(input);
    state.coins += GAME_REWARD;
    state.gamesWon += 1;
    return state;
  }

  const nextThreshold = (growth) => LEVELS.find((stage) => stage.threshold > growth)?.threshold ?? MAX_GROWTH;

  function statusBar(state) {
    const slot = (sprite, count, label) =>
      `<li class="sv-slot"><span class="px px-${sprite}" aria-hidden="true"></span><b>${count}</b><small>${label}</small></li>`;
    return `<ul class="sv-hotbar" aria-label="ของในกระเป๋า">
      ${slot('coin', state.coins, 'เหรียญ')}
      ${slot('water', state.inventory.water, 'น้ำ')}
      ${slot('sprout', state.inventory.fertilizer, 'ปุ๋ย')}
    </ul>`;
  }

  function renderTrail(state, assetRoot) {
    const current = stageForGrowth(state.growth).level;
    return `<ol class="sakura-trail" aria-label="การเติบโต 5 ระดับ">
      ${LEVELS.map((stage) => {
        const reached = stage.level <= current;
        return `<li class="${reached ? 'reached' : ''}" aria-label="ระดับ ${stage.level} ${stage.name}${reached ? ' ปลดล็อกแล้ว' : ' ยังไม่ปลดล็อก'}">
          <img src="${esc(imageForLevel(stage.level, assetRoot))}" alt="" />
          <span>${stage.level}</span>
        </li>`;
      }).join('')}
    </ol>`;
  }

  function renderHome(app, opts) {
    const state = normalizeState(opts.state);
    const stage = stageForGrowth(state.growth);
    const today = state.careDays[opts.dateKey || localDateKey()] || {};
    const target = nextThreshold(state.growth);
    const progress = Math.round((state.growth / MAX_GROWTH) * 100);
    const nextCopy = stage.level === 5
      ? 'ต้นซากุระบานเต็มที่แล้ว'
      : `อีก ${target - state.growth} แต้มจะถึงระดับ ${stage.level + 1}`;

    app.innerHTML = '';
    const screen = el(`<div class="sakura-screen">
      <header class="sakura-topline">
        <div>
          <p class="sakura-kicker">สวนของ ${esc(opts.name || 'เพื่อน')}</p>
          <h1>ซากุระของฉัน</h1>
        </div>
        ${opts.envLabel ? `<span class="env-ribbon">${esc(opts.envLabel)}</span>` : ''}
      </header>

      <section class="garden-stage" aria-labelledby="tree-stage-name">
        <div class="petal petal-a" aria-hidden="true">✿</div>
        <div class="petal petal-b" aria-hidden="true">✿</div>
        <img class="hero-tree" src="${esc(imageForLevel(stage.level, opts.assetRoot))}" alt="${esc(stage.name)} ระดับ ${stage.level}" />
        <div class="stage-caption">
          <p>ระดับ ${stage.level} จาก ${LEVELS.length}</p>
          <h2 id="tree-stage-name">${esc(stage.name)}</h2>
          <div class="growth-meter" role="progressbar" aria-label="การเติบโตของต้นซากุระ" aria-valuemin="0" aria-valuemax="${MAX_GROWTH}" aria-valuenow="${state.growth}">
            <span style="--growth-scale:${progress / 100}"></span>
          </div>
          <small>${esc(nextCopy)}</small>
        </div>
      </section>

      ${statusBar(state)}

      ${opts.status ? `<div class="garden-notice ${opts.statusKind === 'error' ? 'error' : ''}" role="status"><span>${esc(opts.status)}</span>${opts.onRetry ? '<button type="button" data-retry>ลองบันทึกอีกครั้ง</button>' : ''}</div>` : ''}

      <section class="care-sheet" aria-labelledby="care-title">
        <div class="sheet-heading">
          <div><p>ดูแลวันนี้</p><h2 id="care-title">น้ำหนึ่งครั้ง ปุ๋ยหนึ่งครั้ง</h2></div>
          <span>${esc(opts.dateLabel || 'วันนี้')}</span>
        </div>
        <div class="care-actions">
          <button class="care-button water" type="button" data-care="water" ${today.water || state.closed || stage.level === 5 ? 'disabled' : ''}>
            <span class="care-icon px px-water" aria-hidden="true"></span><span><b>${today.water ? 'รดน้ำแล้ว' : 'รดน้ำ'}</b><small>โต +1 · มี ${state.inventory.water}</small></span>
          </button>
          <button class="care-button fertilizer" type="button" data-care="fertilizer" ${today.fertilizer || state.closed || stage.level === 5 ? 'disabled' : ''}>
            <span class="care-icon px px-sprout" aria-hidden="true"></span><span><b>${today.fertilizer ? 'ใส่ปุ๋ยแล้ว' : 'ใส่ปุ๋ย'}</b><small>โต +2 · มี ${state.inventory.fertilizer}</small></span>
          </button>
        </div>
      </section>

      <nav class="garden-nav" aria-label="กิจกรรมในสวน">
        <button type="button" data-open="game"><span class="nav-glyph">24</span><b>หาเหรียญ</b><small>เล่นเกมตัวเลข</small></button>
        <button type="button" data-open="shop"><span class="nav-glyph px px-basket" aria-hidden="true"></span><b>ร้านสวน</b><small>ซื้อน้ำและปุ๋ย</small></button>
      </nav>

      <section class="sticker-book" aria-labelledby="sticker-title">
        <div class="sheet-heading"><div><p>สมุดสติกเกอร์</p><h2 id="sticker-title">การเติบโตของเรา</h2></div><span>${stage.level}/5</span></div>
        ${renderTrail(state, opts.assetRoot)}
      </section>

      ${opts.onMint || opts.onSkipDay ? `<section class="dev-tools"><div><b>เครื่องมือ dev</b><small>เติมเหรียญและข้ามวันเพื่อทดสอบการดูแล แสดงเฉพาะตอนรันบนเครื่อง</small></div><div class="dev-buttons">${opts.onMint ? '<button type="button" data-mint>+100<span class="px px-coin" aria-hidden="true"></span></button>' : ''}${opts.onSkipDay ? '<button type="button" data-skip-day>+1 วัน</button>' : ''}</div></section>` : ''}
      ${stage.level === 5 && !state.closed && opts.onFinish ? '<button class="finish-garden" type="button" data-finish>จบกิจกรรมและเก็บสวนนี้ไว้</button>' : ''}
      ${state.closed ? '<p class="garden-closed">สวนรอบนี้จบสมบูรณ์แล้ว 🌸</p>' : ''}
    </div>`);
    app.append(screen);

    screen.querySelectorAll('[data-care]').forEach((button) =>
      button.addEventListener('click', () => opts.onCare?.(button.dataset.care)),
    );
    screen.querySelector('[data-open="game"]')?.addEventListener('click', () => opts.onGame?.());
    screen.querySelector('[data-open="shop"]')?.addEventListener('click', () => opts.onShop?.());
    screen.querySelector('[data-mint]')?.addEventListener('click', () => opts.onMint?.());
    screen.querySelector('[data-skip-day]')?.addEventListener('click', () => opts.onSkipDay?.());
    screen.querySelector('[data-finish]')?.addEventListener('click', () => opts.onFinish?.());
    screen.querySelector('[data-retry]')?.addEventListener('click', () => opts.onRetry?.());
  }

  function renderShop(app, opts) {
    const state = normalizeState(opts.state);
    app.innerHTML = '';
    const screen = el(`<div class="sakura-screen sub-screen">
      <button class="paper-back" type="button" data-back>‹ กลับสวน</button>
      <header class="shop-header"><p>ร้านสวนของคุณโฮชิ</p><h1>เติมของให้พร้อม<br />ก่อนดูแลต้นไม้</h1></header>
      ${statusBar(state)}
      ${opts.status ? `<p class="garden-notice ${opts.statusKind === 'error' ? 'error' : ''}" role="status">${esc(opts.status)}</p>` : ''}
      <section class="shop-list" aria-label="สินค้า">
        ${Object.values(SHOP).map((item) => `<article>
          <span class="shop-icon px px-${item.sprite}" aria-hidden="true"></span>
          <div><h2>${esc(item.label)}</h2><p>ช่วยให้ต้นไม้โต +${item.growth} · มี ${state.inventory[item.key]}</p></div>
          <button class="sv-btn buy" type="button" data-buy="${item.key}" ${state.coins < item.price ? 'disabled' : ''}>${item.price}<span class="px px-coin" aria-hidden="true"></span></button>
        </article>`).join('')}
      </section>
      <button class="game-ticket" type="button" data-game><span>เหรียญไม่พอ?</span><b>เล่นเกม 24 รับ ${GAME_REWARD} เหรียญ</b></button>
    </div>`);
    app.append(screen);
    screen.querySelector('[data-back]').addEventListener('click', opts.onBack);
    screen.querySelector('[data-game]').addEventListener('click', opts.onGame);
    screen.querySelectorAll('[data-buy]').forEach((button) =>
      button.addEventListener('click', () => opts.onBuy?.(button.dataset.buy)),
    );
  }

  const gcd = (a, b) => {
    a = Math.abs(a); b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a || 1;
  };

  function fraction(num, den = 1, label = null, id = null) {
    if (den < 0) { num *= -1; den *= -1; }
    const d = gcd(num, den);
    return { num: num / d, den: den / d, label: label ?? String(num / d), id: id ?? Math.random().toString(36).slice(2) };
  }

  function combine(a, b, op) {
    if (op === '+') return fraction(a.num * b.den + b.num * a.den, a.den * b.den, `(${a.label} + ${b.label})`);
    if (op === '-') return fraction(a.num * b.den - b.num * a.den, a.den * b.den, `(${a.label} − ${b.label})`);
    if (op === '*') return fraction(a.num * b.num, a.den * b.den, `(${a.label} × ${b.label})`);
    if (op === '/' && b.num !== 0) return fraction(a.num * b.den, a.den * b.num, `(${a.label} ÷ ${b.label})`);
    return null;
  }

  const displayFraction = (value) => value.den === 1 ? String(value.num) : `${value.num}/${value.den}`;

  // Exhaustive pair search. Returns the winning expression so the hint slip and
  // the random generator share one source of truth.
  function solve(numbers) {
    const search = (values) => {
      if (values.length === 1) return values[0].num === 24 * values[0].den ? values[0].label : null;
      for (let i = 0; i < values.length; i += 1) {
        for (let j = 0; j < values.length; j += 1) {
          if (i === j) continue;
          const rest = values.filter((_, index) => index !== i && index !== j);
          for (const op of ['+', '-', '*', '/']) {
            const merged = combine(values[i], values[j], op);
            const found = merged && search([...rest, merged]);
            if (found) return found;
          }
        }
      }
      return null;
    };
    // A combined label always wraps the whole expression, so the outer pair is noise.
    const label = search(numbers.map((n) => fraction(n, 1, String(n))));
    return label && label.startsWith('(') ? label.slice(1, -1) : label;
  }

  function randomPuzzle(rand = Math.random) {
    for (let tries = 0; tries < 200; tries += 1) {
      const numbers = Array.from({ length: 4 }, () => 1 + Math.floor(rand() * 9));
      const solution = solve(numbers);
      if (solution) return { numbers, solution };
    }
    return PUZZLES[Math.floor(rand() * PUZZLES.length)];
  }

  const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2 };

  // Shunting-yard alone happily folds "4 4 +" into 8, so the block order is
  // checked against the grammar first: a value where a value is due, an
  // operator where an operator is due, and balanced parentheses.
  function wellFormed(tokens) {
    let wantValue = true;
    let depth = 0;
    for (const token of tokens) {
      if (token.kind === 'num') {
        if (!wantValue) return false;
        wantValue = false;
      } else if (token.paren === '(') {
        if (!wantValue) return false;
        depth += 1;
      } else if (token.paren === ')') {
        if (wantValue || depth === 0) return false;
        depth -= 1;
      } else {
        if (wantValue) return false;
        wantValue = true;
      }
    }
    return tokens.length > 0 && !wantValue && depth === 0;
  }

  // Returns null for anything incomplete, malformed or dividing by zero, which
  // is also what the readout shows as "?".
  function evaluateTokens(tokens) {
    if (!wellFormed(tokens)) return null;
    const values = [];
    const ops = [];
    const apply = () => {
      const op = ops.pop();
      const b = values.pop();
      const a = values.pop();
      const merged = op !== '(' && a && b && combine(a, b, op);
      if (!merged) return false;
      values.push(merged);
      return true;
    };
    for (const token of tokens) {
      if (token.kind === 'num') {
        values.push(fraction(token.num));
      } else if (token.paren === '(') {
        ops.push('(');
      } else if (token.paren === ')') {
        while (ops.length && ops.at(-1) !== '(') if (!apply()) return null;
        if (ops.pop() !== '(') return null;
      } else {
        while (ops.length && ops.at(-1) !== '(' && PRECEDENCE[ops.at(-1)] >= PRECEDENCE[token.op]) {
          if (!apply()) return null;
        }
        ops.push(token.op);
      }
    }
    while (ops.length) if (ops.at(-1) === '(' || !apply()) return null;
    return values.length === 1 ? values[0] : null;
  }

  const isTwentyFour = (value) => !!value && value.num === 24 * value.den;

  const OPERATOR_BLOCKS = [
    { kind: 'op', op: '+', text: '+', name: 'บวก' },
    { kind: 'op', op: '-', text: '−', name: 'ลบ' },
    { kind: 'op', op: '*', text: '×', name: 'คูณ' },
    { kind: 'op', op: '/', text: '÷', name: 'หาร' },
    { kind: 'paren', paren: '(', text: '(', name: 'วงเล็บเปิด' },
    { kind: 'paren', paren: ')', text: ')', name: 'วงเล็บปิด' },
  ];

  function renderGame(app, opts = {}) {
    let puzzle = opts.puzzle || randomPuzzle();
    let placed = [];
    let solved = false;
    let uid = 0;
    let drag = null;

    app.innerHTML = '';
    const screen = el(`<div class="sakura-screen sub-screen game-screen">
      <button class="paper-back" type="button" data-back>‹ กลับสวน</button>
      <header class="game-header">
        <p>เกมเก็บเหรียญ</p>
        <h1>ทำให้ได้ 24</h1>
        <span>ลากบล็อกมาต่อเป็นสมการ ใช้ตัวเลขครบทั้ง 4 ใบ</span>
      </header>

      <section class="eq-board" aria-labelledby="eq-title">
        <h2 id="eq-title" class="eq-title">สมการของฉัน</h2>
        <div class="eq-strip" data-strip></div>
        <div class="eq-readout" data-readout><span>=</span><b>?</b></div>
      </section>

      <p class="game-instruction" data-message role="status"></p>

      <section class="tray-block">
        <h2>ตัวเลขของข้อนี้</h2>
        <div class="tray numbers" data-numbers></div>
      </section>
      <section class="tray-block">
        <h2>เครื่องหมาย</h2>
        <div class="tray ops" data-ops></div>
      </section>

      <div class="game-tools">
        <button type="button" data-undo>⌫ ลบบล็อกท้าย</button>
        <button type="button" data-clear>ล้างสมการ</button>
        <button type="button" data-new>สุ่มเลขใหม่</button>
        <button type="button" data-hint>ดูคำใบ้</button>
      </div>
      <aside class="hint-slip" data-hint-slip hidden></aside>
      <div class="win-slip" data-win hidden><span>+${GAME_REWARD}<i class="px px-coin" aria-hidden="true"></i></span><h2>ได้ 24 พอดี!</h2><p data-win-expression></p><button type="button" data-claim>รับเหรียญและกลับสวน</button></div>
    </div>`);
    app.append(screen);

    const strip = screen.querySelector('[data-strip]');
    const numberTray = screen.querySelector('[data-numbers]');
    const opTray = screen.querySelector('[data-ops]');
    const readout = screen.querySelector('[data-readout]');
    const message = screen.querySelector('[data-message]');
    const hintSlip = screen.querySelector('[data-hint-slip]');
    const winSlip = screen.querySelector('[data-win]');

    const usedNumbers = () => new Set(placed.filter((token) => token.kind === 'num').map((token) => token.src));

    const dropIndexAt = (x, y) => {
      const blocks = [...strip.querySelectorAll('.block')];
      for (let i = 0; i < blocks.length; i += 1) {
        const rect = blocks[i].getBoundingClientRect();
        if (y < rect.bottom && x < rect.left + rect.width / 2) return i;
      }
      return blocks.length;
    };

    // Pointer events cover mouse, pen and touch in one path; a drag that ends
    // away from the strip deletes the block, a press without movement is a tap.
    function draggable(node, makeToken, fromIndex = -1) {
      const tap = () => {
        if (solved) return;
        if (fromIndex >= 0) placed.splice(fromIndex, 1);
        else placed.push({ ...makeToken(), uid: (uid += 1) });
        update();
      };

      const onMove = (event) => {
        if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
        if (!drag.moved) {
          drag.moved = true;
          drag.ghost = el(`<div class="block ghost ${drag.token.kind}">${esc(drag.token.text)}</div>`);
          document.body.append(drag.ghost);
          strip.classList.add('dropping');
        }
        drag.ghost.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`;
        const caret = insideStrip(event) ? dropIndexAt(event.clientX, event.clientY) : -1;
        if (caret !== drag.caret) {
          drag.caret = caret;
          paintStrip(caret);
        }
      };

      const onUp = (event) => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        const current = drag;
        drag = null;
        current.ghost?.remove();
        strip.classList.remove('dropping');
        if (!current.moved) return tap();
        const target = insideStrip(event) ? dropIndexAt(event.clientX, event.clientY) : -1;
        if (current.fromIndex >= 0) {
          placed.splice(current.fromIndex, 1);
          if (target >= 0) placed.splice(target > current.fromIndex ? target - 1 : target, 0, current.token);
        } else if (target >= 0) {
          placed.splice(target, 0, current.token);
        }
        update();
      };

      node.addEventListener('pointerdown', (event) => {
        if (solved || drag || event.button > 0) return;
        event.preventDefault();
        drag = {
          token: fromIndex >= 0 ? placed[fromIndex] : { ...makeToken(), uid: (uid += 1) },
          fromIndex,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
          caret: -1,
          ghost: null,
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
      });
      // pointerdown's preventDefault suppresses the synthetic click, so a click
      // that still arrives came from the keyboard.
      node.addEventListener('click', (event) => { if (event.detail === 0) tap(); });
    }

    const insideStrip = (event) => {
      const rect = strip.getBoundingClientRect();
      return event.clientX >= rect.left - 28 && event.clientX <= rect.right + 28
        && event.clientY >= rect.top - 28 && event.clientY <= rect.bottom + 28;
    };

    function paintStrip(caretAt = -1) {
      strip.innerHTML = '';
      if (!placed.length && caretAt < 0) {
        strip.append(el('<p class="eq-empty">ลากบล็อกมาวางตรงนี้ หรือแตะบล็อกเพื่อต่อท้าย</p>'));
        return;
      }
      placed.forEach((token, index) => {
        if (index === caretAt) strip.append(el('<span class="eq-caret" aria-hidden="true"></span>'));
        const node = el(`<button class="block ${token.kind} placed ${drag?.fromIndex === index ? 'lifted' : ''}" type="button" aria-label="เอา ${esc(token.text)} ออก">${esc(token.text)}</button>`);
        if (!solved) draggable(node, null, index);
        strip.append(node);
      });
      if (caretAt >= placed.length) strip.append(el('<span class="eq-caret" aria-hidden="true"></span>'));
    }

    function paintTrays() {
      const used = usedNumbers();
      numberTray.innerHTML = '';
      puzzle.numbers.forEach((number, index) => {
        const spent = used.has(index);
        const node = el(`<button class="block num ${spent ? 'spent' : ''}" type="button" ${spent ? 'disabled' : ''} aria-label="ตัวเลข ${number}">${number}</button>`);
        if (!spent && !solved) draggable(node, () => ({ kind: 'num', num: number, text: String(number), src: index }));
        numberTray.append(node);
      });
      opTray.innerHTML = '';
      OPERATOR_BLOCKS.forEach((proto) => {
        const node = el(`<button class="block ${proto.kind}" type="button" aria-label="${esc(proto.name)}">${esc(proto.text)}</button>`);
        if (!solved) draggable(node, () => ({ ...proto }));
        opTray.append(node);
      });
    }

    function note(value, missing) {
      if (!placed.length) return 'เริ่มด้วยการลากตัวเลขใบแรกมาวาง';
      if (missing) return `ยังเหลือตัวเลขอีก ${missing} ใบที่ต้องใช้`;
      if (!value) return 'สมการยังไม่สมบูรณ์ ลองเติมเครื่องหมายหรือปิดวงเล็บ';
      return `ตอนนี้ได้ ${displayFraction(value)} ยังไม่ใช่ 24 — สลับบล็อกดูอีกที`;
    }

    function update(status) {
      paintStrip();
      paintTrays();
      const value = evaluateTokens(placed);
      const missing = 4 - usedNumbers().size;
      readout.innerHTML = `<span>=</span><b>${value ? esc(displayFraction(value)) : '?'}</b>`;
      readout.classList.toggle('hit', isTwentyFour(value));
      if (!missing && isTwentyFour(value)) {
        solved = true;
        paintStrip();
        paintTrays();
        message.hidden = true;
        screen.querySelector('[data-win-expression]').textContent = `${placed.map((token) => token.text).join(' ')} = 24`;
        winSlip.hidden = false;
        winSlip.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      message.textContent = status || note(value, missing);
    }

    screen.querySelector('[data-undo]').addEventListener('click', () => {
      if (solved || !placed.length) return;
      placed.pop();
      update();
    });
    screen.querySelector('[data-clear]').addEventListener('click', () => {
      if (solved) return;
      placed = [];
      update('ล้างสมการแล้ว เริ่มใหม่ได้เลย');
    });
    screen.querySelector('[data-new]').addEventListener('click', () => {
      if (solved) return;
      puzzle = randomPuzzle();
      placed = [];
      hintSlip.hidden = true;
      update('สุ่มเลขชุดใหม่ให้แล้ว');
    });
    screen.querySelector('[data-hint]').addEventListener('click', () => {
      hintSlip.innerHTML = `ลองคิดจาก <b>${esc(puzzle.solution)}</b>`;
      hintSlip.hidden = false;
      hintSlip.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    screen.querySelector('[data-back]').addEventListener('click', opts.onBack);
    screen.querySelector('[data-claim]').addEventListener('click', opts.onWin);
    update();
  }

  function renderResult(app, level, assetRoot) {
    const stage = stageByLevel(level);
    app.innerHTML = '';
    if (!stage) {
      app.append(el('<div class="sakura-screen"><p class="garden-notice error">ไม่พบระดับของสติกเกอร์นี้</p></div>'));
      return;
    }
    app.append(el(`<div class="sakura-screen result-screen">
      <p class="sakura-kicker">บันทึกจากสวนซากุระ</p>
      <h1>${esc(stage.stamp)}</h1>
      <img src="${esc(imageForLevel(stage.level, assetRoot))}" alt="${esc(stage.name)}" />
      <p>ระดับ ${stage.level} จาก 5</p>
      <h2>${esc(stage.name)}</h2>
      <small>สติกเกอร์ใบนี้บันทึกวันที่ต้นซากุระเติบโตถึงระดับนี้</small>
    </div>`));
  }

  global.SakuraKit = {
    LEVELS, SHOP, PUZZLES, GAME_REWARD, MAX_GROWTH,
    el, esc, freshState, normalizeState, stageForGrowth, stageByLevel,
    imageForLevel, localDateKey, buyItem, tendTree, mintCoins, awardGame,
    combine, displayFraction, solve, randomPuzzle, evaluateTokens,
    renderHome, renderShop, renderGame, renderResult,
  };
})(typeof window !== 'undefined' ? window : globalThis);
