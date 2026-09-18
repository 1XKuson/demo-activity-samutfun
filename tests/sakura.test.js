const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

require('../sakura.js');
const K = globalThis.SakuraKit;

let state = K.normalizeState(null);
assert.equal(state.coins, 6);
let purchase = K.buyItem(state, 'water');
assert.equal(purchase.ok, true);
assert.deepEqual([purchase.state.coins, purchase.state.inventory.water], [3, 1]);
let care = K.tendTree(purchase.state, 'water', '2026-09-14');
assert.equal(care.ok, true);
assert.equal(care.state.growth, 1);
assert.equal(K.tendTree(care.state, 'water', '2026-09-14').ok, false);

state = K.normalizeState({ coins: 0, inventory: { water: 9, fertilizer: 9 }, growth: 0 });
for (let day = 1; day <= 4; day += 1) {
  const date = `2026-09-${String(day).padStart(2, '0')}`;
  state = K.tendTree(state, 'water', date).state;
  state = K.tendTree(state, 'fertilizer', date).state;
}
assert.equal(state.growth, 12);
assert.equal(K.stageForGrowth(state.growth).level, 5);
assert.equal(K.awardGame(K.freshState()).coins, 14);

// The solver backs both the hint slip and the random generator, so a puzzle it
// returns must really be reachable, and the built-in pool must stay solvable.
K.PUZZLES.forEach((puzzle) => {
  assert.ok(K.solve(puzzle.numbers), `unsolvable puzzle: ${puzzle.numbers.join(',')}`);
});
assert.equal(K.solve([1, 1, 1, 1]), null);

for (let i = 0; i < 30; i += 1) {
  const puzzle = K.randomPuzzle();
  assert.equal(puzzle.numbers.length, 4);
  puzzle.numbers.forEach((n) => assert.ok(Number.isInteger(n) && n >= 1 && n <= 9, `bad digit ${n}`));
  assert.ok(puzzle.solution, `no solution for ${puzzle.numbers.join(',')}`);
}

const num = (n) => ({ kind: 'num', num: n });
const op = (o) => ({ kind: 'op', op: o });
const paren = (p) => ({ kind: 'paren', paren: p });
const value = (tokens) => K.evaluateTokens(tokens);
assert.equal(K.displayFraction(value([paren('('), num(1), op('+'), num(3), paren(')'), op('*'), num(6)])), '24');
assert.equal(K.displayFraction(value([num(2), op('+'), num(3), op('*'), num(4)])), '14'); // precedence, not left-to-right
assert.equal(K.displayFraction(value([num(1), op('/'), num(3)])), '1/3'); // exact fractions, no rounding
assert.equal(value([num(1), op('/'), num(0)]), null);
assert.equal(value([num(1), op('+')]), null);
assert.equal(value([paren('('), num(1), op('+'), num(2)]), null);
assert.equal(value([num(1), num(2)]), null);
assert.equal(value([num(4), num(4), op('+')]), null); // shunting-yard alone would fold this to 8
assert.equal(value([num(4), op('+'), paren('('), paren(')')]), null);
assert.equal(value([paren('('), paren(')'), num(4)]), null);
assert.equal(value([op('+'), num(4)]), null);
assert.equal(value([num(4), paren(')'), paren('('), num(4)]), null);
assert.equal(K.displayFraction(value([paren('('), paren('('), num(2), op('*'), num(3), paren(')'), op('*'), num(4), paren(')')])), '24');
assert.equal(value([]), null);

const configSource = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');
function readConfig(hostname, pathname) {
  const sandbox = { location: { hostname, pathname }, window: {} };
  vm.runInNewContext(configSource, sandbox);
  return JSON.parse(JSON.stringify(sandbox.window.APP_CONFIG));
}
assert.deepEqual(readConfig('1xkuson.github.io', '/demo-activity-samutfun/sakura/'), {
  env: 'prod', api: 'https://api.samutfun.org', features: { mintCoins: false },
});
assert.deepEqual(readConfig('1xkuson.github.io', '/demo-activity-samutfun/dev/sakura/'), {
  env: 'dev', api: 'https://api-dev.samutfun.org', features: { mintCoins: false },
});
for (const host of ['localhost', '127.0.0.1']) {
  assert.deepEqual(readConfig(host, '/sakura/'), {
    env: 'local', api: 'http://localhost:3000', features: { mintCoins: true },
  });
}
// Hostname wins over path: a local checkout served under /dev/ is still local,
// so a stray dev/ directory can never aim a laptop at the deployed backend.
assert.equal(readConfig('localhost', '/dev/sakura/').api, 'http://localhost:3000');
// Unknown hosts fall back to prod, where a wrong guess fails signature
// verification instead of writing somewhere real.
assert.equal(readConfig('example.test', '/sakura/').env, 'prod');

// GitHub Pages serves 404.html for dynamic result ids. Verify the shim selects
// the Sakura renderer and uses the project-page root for every asset.
const shimHtml = fs.readFileSync(path.join(__dirname, '..', '404.html'), 'utf8');
const shimScript = [...shimHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)][0][1];
const headNodes = [];
const bodyNodes = [];
const shimDocument = {
  title: '',
  getElementById: () => ({ innerHTML: '' }),
  createElement: () => ({}),
  head: { append: (node) => headNodes.push(node) },
  body: { append: (node) => bodyNodes.push(node) },
};
vm.runInNewContext(shimScript, {
  location: { pathname: '/demo-activity-samutfun/activity/result/sakura-l3' },
  document: shimDocument,
});
assert.equal(shimDocument.title, 'สติกเกอร์จากสวนซากุระ');
assert.deepEqual(headNodes.map((node) => node.href), [
  '/demo-activity-samutfun/app.css',
  '/demo-activity-samutfun/sakura.css',
]);
assert.deepEqual(bodyNodes.map((node) => node.src), [
  '/demo-activity-samutfun/sakura.js',
  '/demo-activity-samutfun/sakura-result.js',
]);

// Source art and the pixel cut the activity actually renders. imageForLevel
// points at pixel/, so checking only the source would guard an unused file.
const pngSize = (...parts) => {
  const png = fs.readFileSync(path.join(__dirname, '..', 'assets', 'sakura', ...parts));
  assert.equal(png[25], 6, `${parts.join('/')} must be RGBA`);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
};
for (let level = 1; level <= 5; level += 1) {
  assert.deepEqual(pngSize(`sticker-level-${level}.png`), [360, 360]);
  assert.deepEqual(pngSize('pixel', `sticker-level-${level}.png`), [64, 64]);
  const rendered = K.imageForLevel(level, 'assets/sakura');
  assert.equal(rendered, `assets/sakura/pixel/sticker-level-${level}.png`);
  assert.ok(fs.existsSync(path.join(__dirname, '..', rendered)), `missing ${rendered}`);
}
assert.deepEqual(pngSize('pixel', 'thumbnail.png'), [720, 720]);

console.log(`sakura tests passed (${K.PUZZLES.length} fallback puzzles, random generator, 5 stickers)`);
