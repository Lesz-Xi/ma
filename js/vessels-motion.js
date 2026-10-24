/* public/vessels-motion.js — Vessels: one vessel becomes the next through water.
 * The gesture says "this changed": the vessel moves, the reference holds (tab rail,
 * plate, ground). On desktop fine pointers the image changes through the page's own
 * water handoff (XIWaterTransitions, the engine Approach uses) and the form notes rise
 * with its progress. Phones, coarse pointers and any failure get a quiet settle;
 * reduced motion and forced colours change at once. Tabs, panels, focus and the live
 * announcement stay owned by ch06-vessels.js; this only follows its panels. One
 * clock: MA.frame.
 */
(function () {
  'use strict';
  var MA = window.MA, root = document.getElementById('ch06');
  if (!MA || !MA.frame || !root) return;
  var studies = root.querySelector('.ch06-studies');
  var panels = Array.from(root.querySelectorAll('[data-vessel-panel]'));
  var images = panels.map(function (p) { return p.querySelector('.ch06-plate img'); });
  if (!studies || panels.length !== 3 || images.some(function (i) { return !i; })) return;
  var fine = matchMedia('(hover:hover) and (pointer:fine) and (min-width:900px)');
  var colors = matchMedia('(forced-colors:active)');
  var flag = /[?&]vessel-water=(\w+)/.exec(location.search);
  var KIND = flag && window.XIWaterTransitions && XIWaterTransitions.specs[flag[1]] ? flag[1] : 'tide';
  var SETTLE_ONLY = /[?&]vessel-motion=settle\b/.test(location.search);
  var RISE = 14;

  function requestFrame(fn) { var id = MA.frame.add(function (t) { MA.frame.remove(id); fn(t); }); return id; }
  function cancelFrame(id) { MA.frame.remove(id); }
  function visibleIndex() { for (var i = 0; i < panels.length; i++) if (!panels[i].hidden) return i; return -1; }
  function waterAllowed() {
    return !SETTLE_ONLY && !!window.XIWaterTransitions && fine.matches && !colors.matches && !MA.reduced.now() && !document.hidden;
  }
  function loaded() { return images.every(function (i) { return i.complete && i.naturalWidth > 0; }); }

  // The hidden vessels are lazy inside display:none panels and never load on their
  // own. Warm them as the chapter approaches so the handoff has both images.
  var warm = new IntersectionObserver(function (entries) {
    if (!entries.some(function (e) { return e.isIntersecting; })) return;
    warm.disconnect();
    images.forEach(function (img) { img.loading = 'eager'; });
  }, { rootMargin: '60% 0px' });
  warm.observe(root);
  images.forEach(function (img) { img.addEventListener('load', function () { ensureRenderer(current); }); });

  var layer = document.createElement('div'), canvas = document.createElement('canvas');
  layer.className = 'ch06-water'; layer.setAttribute('aria-hidden', 'true'); layer.hidden = true;
  layer.appendChild(canvas); studies.appendChild(layer);

  var renderer = null, current = Math.max(0, visibleIndex()), arriving = null, stats = { water: 0, settle: 0, instant: 0, failed: null };
  function notes(panel) { return Array.from(panel.querySelectorAll('.ch06-reading h3, .ch06-reading > p, .ch06-plate figcaption')); }
  function place(img) {
    var r = img.getBoundingClientRect(), s = studies.getBoundingClientRect();
    layer.style.left = (r.left - s.left) + 'px'; layer.style.top = (r.top - s.top) + 'px';
    layer.style.width = r.width + 'px'; layer.style.height = r.height + 'px';
  }
  // Native notes follow the rendered reveal: they rise as the water carries the image.
  function follow(p) {
    if (!arriving) return;
    notes(arriving).forEach(function (el, i) {
      var q = Math.max(0, Math.min(1, (p - i * .12) / .76));
      el.style.opacity = String(q); el.style.transform = 'translateY(' + ((1 - q) * RISE).toFixed(2) + 'px)';
    });
  }
  function rest() {
    if (arriving) notes(arriving).forEach(function (el) { el.style.opacity = ''; el.style.transform = ''; });
    arriving = null; layer.hidden = true;
  }
  // Born showing the vessel on screen now; created as soon as all three have loaded,
  // so the first change does not pay for setup.
  function ensureRenderer(showing) {
    if (renderer || stats.failed || !window.XIWaterTransitions || !loaded()) return renderer;
    renderer = XIWaterTransitions.create(canvas, images, {
      kind: KIND, initial: showing, requestFrame: requestFrame, cancelFrame: cancelFrame,
      reduced: function () { return !waterAllowed(); },
      // The engine also presents after an idle resize; only a running handoff ends here.
      present: function () { if (renderer && renderer.stats().running) rest(); },
      onProgress: follow,
      commit: function () {},
      status: function (message) { if (/unavailable/.test(message)) stats.failed = message; }
    });
    return renderer;
  }
  function settle(panel) {
    // The quiet path: the vessel and its notes rise into place on CSS transitions.
    panel.classList.remove('is-settling'); panel.classList.add('is-arriving');
    void panel.offsetWidth;
    requestFrame(function () { panel.classList.remove('is-arriving'); panel.classList.add('is-settling'); });
  }
  function change(to) {
    var from = current;
    if (from === to) return;
    ensureRenderer(from); current = to;
    var panel = panels[to];
    if (MA.reduced.now() || colors.matches) { if (renderer) renderer.change(to); rest(); stats.instant++; return; }
    if (waterAllowed() && renderer && !stats.failed) {
      rest(); place(images[to]); layer.hidden = false; renderer.resize();
      arriving = panel; follow(0); renderer.change(to);
      if (!stats.failed && renderer.stats().running) { stats.water++; return; }
      rest(); // the engine settled at once (failure or a hidden tab): fall through to the quiet path
    } else if (renderer) renderer.change(to); // keep the engine's notion of the current vessel true
    settle(panel); stats.settle++;
  }
  var mo = new MutationObserver(function () { var v = visibleIndex(); if (v >= 0) change(v); });
  panels.forEach(function (p) { mo.observe(p, { attributes: true, attributeFilter: ['hidden'] }); });
  var offReduced = MA.reduced.onChange(function (r) { if (r) { if (renderer) renderer.settle(); rest(); } });

  MA.vessels = {
    stats: function () { var e = renderer ? renderer.stats() : {}; return { kind: KIND, current: current, water: stats.water, settle: stats.settle, instant: stats.instant, failed: stats.failed, ready: !!e.ready, running: !!e.running, phase: e.phase || 'idle', layerHidden: layer.hidden }; },
    dispose: function () { mo.disconnect(); warm.disconnect(); offReduced(); if (renderer) renderer.dispose(true); layer.remove(); }
  };
})();
