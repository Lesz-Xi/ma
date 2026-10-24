/* Ma's one-shot bloom → hold → Capillary. Shared XI Lab reveal, local 1s hold. */
(function () {
  'use strict';
  var MA = window.MA, veil = document.getElementById('veil');
  if (!veil) return;
  var engine = window.XIDemos && window.XIDemos.waterEntries;
  if (!MA || !engine) { veil.remove(); return; }
  var forced = window.matchMedia('(forced-colors: active)');
  var done = false, preparing = false, job = null, deadline = null, offReduced = null;
  var listeners = [], width = 1, height = 1, progress = 0, start = null;
  // Give the flower one extra second without slowing its opening motion.
  // Shift the reveal and fade together; Capillary itself still takes 2.7s.
  var score = window.MA_EDITION && MA_EDITION.motion;
  var hold = score ? score.entryHold : 1000, revealDuration = engine.specs.capillary.duration;
  var duration = hold + revealDuration, elapsed = 0, mark = veil.querySelector('.ma-entry-flower');
  var petals = mark ? Array.from(mark.querySelectorAll('[data-entry-petal]')).map(function (node) {
    return { node: node, turn: Number(node.getAttribute('data-turn')),
      fold: Number(node.getAttribute('data-fold')), delay: Number(node.getAttribute('data-delay')) };
  }) : [];
  // The bloom pivot belongs to the asset, not to this clock: each Paper flower
  // declares its own centre. 493 226 was GH-0's; HX-0 declares 500 508.
  var pivot = (mark && mark.getAttribute('data-center') || '493 226').split(/\s+/);
  function ease(value) {
    var t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }
  function listen(target, event, fn, options) {
    target.addEventListener(event, fn, options);
    listeners.push(function () { target.removeEventListener(event, fn, options); });
  }
  function finish() {
    if (done) return;
    done = true;
    if (job !== null) MA.frame.remove(job);
    clearTimeout(deadline);
    listeners.splice(0).forEach(function (off) { off(); });
    if (offReduced) offReduced();
    veil.remove();
  }
  MA.entryWater = { dispose: finish };
  if (MA.reduced.now() || forced.matches || document.hidden) { finish(); return; }

  // An inverse mask removes the paper instead of clipping/moving the live page.
  // Header, focus, browser restoration and Rainfield keep their own ownership.
  function svg(tag, attrs, parent) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    if (parent) parent.appendChild(node);
    return node;
  }
  var layer = svg('svg', { 'class': 'ma-entry-water', 'aria-hidden': 'true', focusable: 'false' });
  var defs = svg('defs', {}, layer);
  var mask = svg('mask', { id: 'ma-drop-opening', maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse', 'mask-type': 'luminance' }, defs);
  var field = svg('rect', { fill: 'white' }, mask);
  var opening = svg('path', { fill: 'black' }, mask);
  var sheet = svg('rect', { 'class': 'ma-entry-sheet', mask: 'url(#ma-drop-opening)' }, layer);
  var rim = svg('path', { 'class': 'ma-entry-rim' }, layer);
  var echo = svg('path', { 'class': 'ma-entry-rim ma-entry-echo' }, layer);
  veil.prepend(layer);
  function paint() {
    var g = engine.geometry('capillary', progress, width, height);
    opening.setAttribute('d', g.opening);
    rim.setAttribute('d', g.rim);
    rim.style.opacity = String(g.edge);
    echo.setAttribute('d', g.echo);
    echo.style.opacity = String(g.echoAlpha);
    if (mark) mark.style.opacity = String(1 - ease((elapsed - hold - 850) / 400));
    petals.forEach(function (petal) {
      var rest = 1 - ease((elapsed - 150 - petal.delay) / 650);
      var scale = 1 - petal.fold * rest;
      // Each petal and its shading move as one; the yellow centre stays fixed.
      petal.node.setAttribute('transform', 'translate(' + pivot[0] + ' ' + pivot[1] + ') rotate(' +
        (petal.turn * rest).toFixed(4) + ') scale(' + scale.toFixed(5) +
        ') translate(-' + pivot[0] + ' -' + pivot[1] + ')');
    });
  }
  function measure() {
    width = Math.max(1, window.innerWidth); height = Math.max(1, window.innerHeight);
    layer.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    [mask, field, sheet].forEach(function (node) {
      node.setAttribute('x', 0); node.setAttribute('y', 0);
      node.setAttribute('width', width); node.setAttribute('height', height);
    });
    paint();
  }
  measure();
  veil.classList.add('is-ready');
  function tick(time) {
    if (done) return;
    try {
      if (start === null) start = time;
      elapsed = Math.max(0, time - start);
      progress = Math.max(0, Math.min(1, (elapsed - hold) / revealDuration));
      paint();
      if (elapsed >= duration) finish();
    } catch (_) { finish(); }
  }
  function prepare() {
    if (done || preparing) return;
    preparing = true;
    var visibleImages = Array.from(document.querySelectorAll('#ma-main img')).filter(function (image) {
      var r = image.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight && r.width > 0 && r.height > 0;
    });
    var ready = visibleImages.map(function (image) {
      if (image.decode) return image.decode();
      if (image.complete) return image.naturalWidth ? Promise.resolve() : Promise.reject();
      return new Promise(function (resolve, reject) {
        listen(image, 'load', resolve, { once: true });
        listen(image, 'error', reject, { once: true });
      });
    });
    if (document.fonts) ready.push(document.fonts.ready);
    Promise.all(ready).then(function () {
      if (done) return;
      clearTimeout(deadline);
      measure();
      deadline = setTimeout(finish, duration + 500);
      job = MA.frame.add(tick);
    }).catch(finish);
  }
  // Loading never wins over intent, and late readiness never resurrects a cover.
  listen(document, 'ma:ready', prepare, { once: true });
  listen(window, 'resize', measure, { passive: true });
  ['wheel', 'touchstart', 'pointerdown'].forEach(function (event) {
    listen(window, event, finish, { passive: true, capture: true });
  });
  listen(window, 'keydown', function (e) {
    if (['Tab', 'Escape', 'Enter', ' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].indexOf(e.key) !== -1) finish();
  }, true);
  listen(window, 'pagehide', finish);
  listen(document, 'visibilitychange', function () { if (document.hidden) finish(); });
  listen(forced, 'change', function () { if (forced.matches) finish(); });
  offReduced = MA.reduced.onChange(function (reduce) { if (reduce) finish(); });
  deadline = setTimeout(finish, 1500);
})();
