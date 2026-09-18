/** Cold result page opened from a Sakura level sticker. */
(function () {
  'use strict';
  const marker = '/activity/result/';
  const at = location.pathname.indexOf(marker);
  const id = at >= 0 ? location.pathname.slice(at + marker.length).replace(/\/+$/, '') : '';
  const match = /^sakura-l([1-5])$/.exec(id);
  const base = at >= 0 ? location.pathname.slice(0, at + 1) : '../../';
  SakuraKit.renderResult(document.getElementById('app'), match ? Number(match[1]) : null, `${base}assets/sakura`);
})();
