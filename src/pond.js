/* public/pond.js — Arrival's pond: koi wander, grass sways in place, stone holds.
 * Two koi (sumi, kohaku) beneath, pampas rising from a cluster of pale stones
 * that hides its roots, a few stray stones out in the water. Haste disturbs all
 * but the stone; stillness brings one koi near. One canvas inside .ch01-hero (so
 * it shares the hero's scroll parallax), beneath the reading. Shares MA.frame
 * (gated on #ch01: rests offscreen and on hidden tabs), MA.pointer, MA.reduced.
 * The koi and stones are washi (Chief, 19 October): generated fibres and grain fixed to
 * each body, hand-cut edges, the kohaku's vermilion torn and laid on top (chigiri-e).
 * ?pond-art=drawn shows the earlier drawn placeholders, for comparison or rollback.
 */
(function () {
  'use strict';
  var MA = window.MA, section = document.getElementById('ch01');
  var host = section && section.querySelector('.ch01-hero');
  var canvas = host && host.querySelector('.ch01-pond');
  if (!MA || !MA.frame || !MA.pointer || !canvas) return;
  var g = canvas.getContext('2d');
  if (!g) { canvas.remove(); return; }
  var DEBUG = /[?&]pond-debug\b/.test(location.search);
  var PAPER = !/[?&]pond-art=drawn\b/.test(location.search);
  var forced = matchMedia('(forced-colors: active)');
  var TAU = Math.PI * 2, N = 14, S = 22;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrap(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function rel(el, pad) {
    if (!el) return null;
    var a = el.getBoundingClientRect(), b = host.getBoundingClientRect();
    if (!a.width || !a.height) return null;
    return { x0: a.left - b.left - pad, y0: a.top - b.top - pad, x1: a.right - b.left + pad, y1: a.bottom - b.top + pad };
  }

  /* ——— koi ——— */
  /* Half-width along the body (0 nose → 1 peduncle), as a share of the widest point. */
  var PROFILE = [[0, .5], [.07, .8], [.18, .97], [.3, 1], [.46, .86], [.62, .62], [.78, .42], [.9, .3], [1, .24]];
  function profile(s) {
    for (var i = 1; i < PROFILE.length; i++) {
      if (s <= PROFILE[i][0]) {
        var a = PROFILE[i - 1], b = PROFILE[i], t = (s - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * ease(t);
      }
    }
    return PROFILE[PROFILE.length - 1][1];
  }
  /* Two characters, two natures. The sumi swims toward its work and keeps its course;
   * the white koi with red lips (kuchibeni, the lipstick koi) is the one that loves,
   * and the one that comes near when you are still. Persimmon stays small and muted. */
  var KINDS = {
    sumi: { body: '#34322d', fin: 'rgba(52,50,45,.74)', ray: 'rgba(245,243,237,.1)', ridge: 'rgba(255,255,255,.075)',
      rim: 'rgba(0,0,0,.16)', eye: 'rgba(236,232,220,.7)', depth: .75, scale: 1, patches: [] },
    kohaku: { body: '#fcfbf7', fin: 'rgba(252,251,247,.9)', ray: 'rgba(48,47,41,.08)', ridge: 'rgba(255,255,255,.16)',
      rim: 'rgba(48,47,41,.075)', eye: 'rgba(48,47,41,.75)', depth: .45, scale: 1.08, red: '#c45c3d',
      lips: { s: .012, u: 0, rs: .03, ru: .62 }, patches: [{ s: .17, u: .05, rs: .075, ru: .7 }, { s: .4, u: -.2, rs: .12, ru: .95 }, { s: .64, u: .28, rs: .075, ru: .78 }] }
  };

  var W = 1, H = 1, dpr = 1, L = 150, bounds = null, keepOut = [], stones = [], fish = [], stems = [], leaves = [];
  var spec = null, root = { x: 0, y: 0 }, Hs = 600, us = 1;
  var started = false, job = null, last = 0, clock = 0, dead = false, surfaced = 0;
  var ptr = { x: 0, y: 0, inside: false, speed: 0, t: 0, still: Infinity, type: 'mouse' };
  var circle = null, nextCircle = 18, curious = null, greet = null, returning = null, gust = null, nextGust = 6;
  var stats = { frames: 0, late: 0, intervals: [], startles: 0, spreads: 0, holds: 0, greets: 0, curious: 0, circles: 0, gusts: 0, partings: 0, maxBend: 0, drawMs: 0 };

  function Fish(kind, seed) {
    this.k = KINDS[kind]; this.kind = kind; this.seed = seed;
    this.x = 0; this.y = 0; this.h = 0; this.v = 0; this.e = .3; this.phase = seed * 3;
    this.beat = true; this.beatT = .8 + seed; this.beatI = .5;
    this.fear = 0; this.flee = 0; this.fleeX = 0; this.fleeY = 0; this.cool = 0; this.lastScare = -10;
    this.chain = []; for (var i = 0; i < N; i++) this.chain.push({ x: 0, y: 0 });
    this.r = []; for (i = 0; i < N; i++) this.r.push({ x: 0, y: 0, tx: 1, ty: 0, w: 0 });
  }
  Fish.prototype.len = function () { return L * this.k.scale; };
  Fish.prototype.place = function (x, y, h) {
    this.x = x; this.y = y; this.h = h;
    var seg = this.len() * .78 / (N - 1);
    for (var i = 0; i < N; i++) { this.chain[i].x = x - Math.cos(h) * seg * i; this.chain[i].y = y - Math.sin(h) * seg * i; }
  };
  /* Follow-the-leader spine with a bend limit: turns curve the whole body. */
  Fish.prototype.follow = function () {
    var c = this.chain, seg = this.len() * .78 / (N - 1), MAXB = .3;
    c[0].x = this.x; c[0].y = this.y;
    for (var i = 1; i < N; i++) {
      var back = i === 1 ? this.h + Math.PI : Math.atan2(c[i - 1].y - c[i - 2].y, c[i - 1].x - c[i - 2].x);
      var cur = Math.atan2(c[i].y - c[i - 1].y, c[i].x - c[i - 1].x);
      var a = back + clamp(wrap(cur - back), -MAXB, MAXB);
      c[i].x = c[i - 1].x + Math.cos(a) * seg; c[i].y = c[i - 1].y + Math.sin(a) * seg;
    }
  };
  /* Rendered spine: the travelling wave grows toward the tail; the head barely yaws. */
  Fish.prototype.shape = function () {
    var c = this.chain, r = this.r, len = this.len(), amp = len * (.022 + .085 * this.e + .04 * this.fear), hw = len * .105;
    for (var i = 0; i < N; i++) {
      var s = i / (N - 1), a = c[Math.max(0, i - 1)], b = c[Math.min(N - 1, i + 1)];
      var tx = a.x - b.x, ty = a.y - b.y, tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      var off = amp * Math.pow(s, 1.5) * Math.sin(this.phase - TAU * .85 * s);
      r[i].x = c[i].x - ty * off; r[i].y = c[i].y + tx * off; r[i].w = hw * profile(s);
    }
    for (i = 0; i < N; i++) {
      a = r[Math.max(0, i - 1)]; b = r[Math.min(N - 1, i + 1)];
      tx = a.x - b.x; ty = a.y - b.y; tl = Math.hypot(tx, ty) || 1; r[i].tx = tx / tl; r[i].ty = ty / tl;
    }
  };
  /* A point in body space: s along the spine, u across it (−1 right … 1 left). */
  Fish.prototype.at = function (s, u) {
    var f = clamp(s, 0, 1) * (N - 1), i = Math.min(N - 2, Math.floor(f)), t = f - i, a = this.r[i], b = this.r[i + 1];
    var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, tx = a.tx + (b.tx - a.tx) * t, ty = a.ty + (b.ty - a.ty) * t;
    var w = (a.w + (b.w - a.w) * t) * u;
    return { x: x - ty * w, y: y + tx * w };
  };

  /* ——— grass ——— */
  /* Pampas: dx and height in units of the study's height, lean and curve in radians
   * (negative leans toward the open water), plume share, tone, wind phase. */
  var STEMS = [[-.03, .95, -.2, -.1, .31, 0, .3], [-.01, .84, -.06, -.07, .28, 1, 1.7], [0, .99, -.32, -.12, .32, 0, 2.9],
    [.016, .72, .05, .04, .27, 1, 4.1], [.026, .88, -.08, -.03, .3, 0, 5.3], [-.024, .63, -.44, -.1, .26, 1, .9], [.032, .78, .07, .05, .28, 0, 3.6]];
  /* Blades: dx, length, angle off upright, arch, width share. Those beneath the caption
   * start nearly flat and droop, as pampas leaves do. */
  var LEAVES = [[-.01, .44, -.5, -.95, 1], [.005, .5, -.2, -.62, .9], [.02, .3, 1.3, .55, .85], [-.02, .32, -.82, -1.1, .8],
    [.025, .34, 1.32, .6, .95], [0, .24, 1.42, .45, .75], [-.03, .27, -1.05, -1.2, .7]];
  /* Plume palette per tone: ivory light, champagne, beige, the shade inside the panicle. */
  var PLUME = [[[248, 244, 234], [237, 228, 207], [223, 208, 178], [201, 184, 150]],
    [[244, 238, 225], [231, 219, 194], [215, 198, 164], [190, 171, 135]]];
  var STEM_TONE = [[166, 160, 121], [208, 196, 163]]; // olive at the root → straw beneath the plume
  var BLADE_TONE = [[[141, 146, 104], [173, 170, 128], [210, 199, 162]], [[152, 154, 112], [182, 176, 136], [216, 205, 170]]];
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }
  function rng(seed) {
    return function () {
      seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function Stem(def, i) {
    this.def = def; this.i = i; this.t = 0; this.w = 0;
    this.k = 7 + (1 - def[1]) * 10 + hash(i) * 3; // shorter stems are stiffer
    this.wm = .058 * (.85 + hash(i + 9) * .3);
    this.pts = []; for (var j = 0; j <= S; j++) this.pts.push({ x: 0, y: 0, a: 0 });
  }
  Stem.prototype.base = function () { return { x: root.x + this.def[0] * Hs, y: root.y }; };
  Stem.prototype.build = function () {
    var d = this.def, b = this.base(), seg = d[1] * Hs / S, x = b.x, y = b.y, p = this.pts;
    p[0].x = x; p[0].y = y; p[0].a = -Math.PI / 2 + d[2];
    for (var j = 1; j <= S; j++) {
      var s = j / S, a = -Math.PI / 2 + d[2] + (d[3] + this.t) * Math.pow(s, 1.7);
      x += Math.cos(a) * seg; y += Math.sin(a) * seg; p[j].x = x; p[j].y = y; p[j].a = a;
    }
  };
  Stem.prototype.plumeCentre = function () { return this.pts[Math.round(S * (1 - this.def[4] * .45))]; };
  function breeze(st) {
    var ph = st.def[6], x = st.pts[S].x || 0;
    return .045 * Math.sin(clock * .55 + x * .006 + ph) + .022 * Math.sin(clock * 1.27 + ph * 2) - .015;
  }
  function gustAt(x) {
    if (!gust) return 0;
    var front = gust.x0 + gust.dir * gust.speed * (clock - gust.start), d = (x - front) / (140 * us);
    return gust.dir * gust.strength * Math.exp(-d * d);
  }
  function stepGrass(dt) {
    if (!gust && clock > nextGust && spec) {
      var dir = Math.random() < .5 ? -1 : 1;
      gust = { dir: dir, start: clock, speed: 300 * us, strength: .1 + Math.random() * .08,
        x0: dir > 0 ? spec.x0 - 220 * us : spec.x1 + 220 * us, end: dir > 0 ? spec.x1 + 260 * us : spec.x0 - 260 * us };
      stats.gusts++;
    }
    if (gust && gust.dir * (gust.x0 + gust.dir * gust.speed * (clock - gust.start) - gust.end) > 0) { gust = null; nextGust = clock + 9 + Math.random() * 7; }
    var moving = ptr.inside && clock - ptr.t < .12 && ptr.speed > 60;
    stems.forEach(function (st) {
      var target = breeze(st) + gustAt(st.pts[S].x);
      if (moving) {
        // The hand's air parts the plumes: each leans away from the cursor.
        var c = st.plumeCentre(), dx = c.x - ptr.x, d = Math.hypot(dx, c.y - ptr.y), R = Hs * .3;
        if (d < R) { st.w += Math.sign(dx || 1) * clamp(ptr.speed / 700, 0, 1.6) * Math.pow(1 - d / R, 2) * 25 * dt; st.parted = clock; }
      }
      st.w += (-st.k * (st.t - target) - 2.2 * st.w) * dt;
      st.t += st.w * dt;
      stats.maxBend = Math.max(stats.maxBend, Math.abs(st.t));
      st.build();
    });
  }

  /* ——— layout ——— */
  function measure() {
    var r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    L = clamp(W * .095, 74, 158);
    var header = document.getElementById('ma-header'), top = header ? header.offsetHeight : 80;
    bounds = { x0: L * .25, y0: top + L * .45, x1: W - L * .25, y1: H - L * .2 };
    keepOut = [rel(host.querySelector('.ch01-reading'), L * .16), rel(host.querySelector('.ch01-caption'), L * .08)].filter(Boolean);
    spec = rel(host.querySelector('.ch01-specimen'), 0);
    Hs = spec ? spec.y1 - spec.y0 : H * .7; us = Hs / 650;
    // The roots stand near where the study's stem met the paper, a little toward the water,
    // and always a clear step left of the caption so no stem or blade crosses it.
    var cap = rel(host.querySelector('.ch01-caption'), 0);
    root = spec ? { x: spec.x0 + (spec.x1 - spec.x0) * .56, y: spec.y0 + Hs * .965 } : { x: W * .78, y: H * .88 };
    if (cap) root.x = Math.min(root.x, cap.x0 - Math.max(Hs * .1, 40));
    root.y = Math.min(root.y, H - 30 * us);
    if (!stems.length) { stems = STEMS.map(function (d, i) { return new Stem(d, i); }); }
    stems.forEach(function (st) { st.build(); st.sprite = plumeSprite(st); });
    placeStones();
    fish.forEach(function (f) {
      if (f.x < bounds.x0 || f.x > bounds.x1 || f.y < bounds.y0 || f.y > bounds.y1 || inKeepOut(f.x, f.y))
        f.place.apply(f, spot(f.seed));
    });
    if (MA.reduced.now()) pose();
  }
  /* Stems and blades above the roots; the flat bed of stones around them. */
  function clump() { return [{ x: root.x - Hs * .05, y: root.y - Hs * .25, rx: Hs * .22, ry: Hs * .38 }, { x: root.x - Hs * .012, y: root.y + Hs * .014, rx: Hs * .235, ry: Hs * .095 }]; }
  function inKeepOut(x, y) {
    return keepOut.some(function (k) { return x > k.x0 && x < k.x1 && y > k.y0 && y < k.y1; });
  }
  /* Preferred open water, by layout; the first free candidate wins. */
  function spot(seed) {
    var wide = W >= 900, prefs = wide ?
      (seed < .5 ? [[.5, .72, -.6], [.5, .45, -.3], [.6, .84, -.9]] : [[.88, .86, Math.PI + .5], [.7, .6, 2.6], [.9, .4, 2]]) :
      (seed < .5 ? [[.3, .86, -.4], [.2, .7, 0]] : [[.78, .95, 2.8], [.8, .75, 2.4]]);
    for (var i = 0; i < prefs.length; i++) {
      var x = clamp(prefs[i][0] * W, bounds.x0, bounds.x1), y = clamp(prefs[i][1] * H, bounds.y0, bounds.y1);
      if (!inKeepOut(x, y) && !stones.some(function (s) { return Math.hypot(x - s.x, y - s.y) < s.r + L * .4; })) return [x, y, prefs[i][2]];
    }
    return [(bounds.x0 + bounds.x1) / 2, bounds.y1 - L * .4, 0];
  }
  /* Stone rings the grass: a circle seen in perspective around the roots, larger in
   * front and drawn over the blades, smaller behind and drawn under the stems. A few
   * more at the roots hide where the stems stand. No stone sits out in the water. */
  var ROOTS = [[-7, 4, 12, 0], [13, 1, 10, 0], [-22, 9, 8, 1], [3, 12, 9, 0], [22, 10, 7, 2]];
  function ring() { return { x: root.x - Hs * .012, y: root.y + Hs * .014, rx: Hs * .19, ry: Hs * .052 }; }
  function placeStones() {
    var list = [], n = 22, o = ring();
    for (var i = 0; i < n; i++) {
      var a = (i + (hash(i + 40) - .5) * .45) / n * TAU + .2, depth = Math.sin(a), k = 1 + (hash(i + 70) - .5) * .14;
      var r = Math.max(2.4, (5.5 + 4.5 * hash(i + 11)) * us * (.7 + .55 * (depth + 1) / 2));
      list.push({ x: o.x + Math.cos(a) * o.rx * k, y: o.y + Math.sin(a) * o.ry * k, r: r, tone: i % 7 === 3 ? 1 : i % 5 === 2 ? 2 : 0, front: depth > -.2 });
    }
    ROOTS.forEach(function (d) { list.push({ x: root.x + d[0] * us, y: root.y + d[1] * us, r: Math.max(2.6, d[2] * us), tone: d[3], front: true }); });
    stones = list.filter(function (st) { return st.x > bounds.x0 && st.x < bounds.x1 && st.y < H - st.r * 1.5; })
      .map(function (st, i) { st.cluster = true; st.sprite = stoneSprite(st.r, i, st.tone); return st; })
      .sort(function (a, b) { return a.y - b.y; });
  }
  /* ——— paper (the default; ?pond-art=drawn for the placeholders) ——— */
  /* Washi, generated once and tiled: long kozo fibres in two inks (pale strands show on
   * dyed paper, faint grey ones on white), a fine grain, and a slow mottle where the
   * sheet is thicker or the dye uneven. Drawn at twice the density it is shown, so the
   * fibres keep their size and stay crisp on any screen. */
  var WASHI = 256, washi = null;
  function makeWashi() {
    if (washi) return washi;
    // Many short, fine, curling fibres, as kozo paper has. The long ones kozo also has were
    // cut (Chief, 22 October): at a koi's size they read as strokes, scratches or cracks.
    var r = rng(4127), fib = [], edge = [];
    for (var i = 0; i < 1500; i++) fib.push({ x: r() * WASHI, y: r() * WASHI, a: r() * TAU, len: 2.5 + Math.pow(r(), 1.8) * 12, bend: (r() - .5) * 1.8, w: .22 + r() * .3, o: r() * .7 });
    for (i = 0; i < 150; i++) { r(); r(); r(); r(); r(); r(); r(); } // keep the stream: the edge and grain stay as approved
    // The torn rim: dense short fibres, drawn along an edge they read as a feathered tear.
    for (i = 0; i < 2600; i++) edge.push({ x: r() * WASHI, y: r() * WASHI, a: r() * TAU, len: 1.2 + r() * 3.6, bend: (r() - .5) * 1.4, w: .3 + r() * .4, o: r() });
    function sheet(paint) {
      var c = document.createElement('canvas'); c.width = c.height = WASHI * 2;
      var t = c.getContext('2d'); t.scale(2, 2); t.lineCap = 'round'; paint(t); return c;
    }
    function fibres(t, ink, lo, hi, list) {
      (list || fib).forEach(function (f) {
        t.strokeStyle = 'rgba(' + ink + ',' + (lo + f.o * (hi - lo)).toFixed(3) + ')'; t.lineWidth = f.w;
        for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) { // every edge wraps: the sheet tiles seamlessly
          var x = f.x + ox * WASHI, y = f.y + oy * WASHI;
          t.beginPath(); t.moveTo(x, y);
          t.quadraticCurveTo(x + Math.cos(f.a + f.bend) * f.len * .5, y + Math.sin(f.a + f.bend) * f.len * .5, x + Math.cos(f.a) * f.len, y + Math.sin(f.a) * f.len);
          t.stroke();
        }
      });
    }
    var light = sheet(function (t) { fibres(t, '255,252,244', .08, .34); });
    var dark = sheet(function (t) { fibres(t, '92,84,70', .04, .16); });
    var fringe = sheet(function (t) { fibres(t, '252,247,238', .35, .95, edge); });
    var grain = sheet(function (t) {
      for (var i = 0; i < 46; i++) { // mottle
        var x = r() * WASHI, y = r() * WASHI, rad = 18 + r() * 52, a = .025 + r() * .045;
        for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
          var gr = t.createRadialGradient(x + ox * WASHI, y + oy * WASHI, 0, x + ox * WASHI, y + oy * WASHI, rad);
          gr.addColorStop(0, 'rgba(72,66,54,' + a.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(72,66,54,0)');
          t.fillStyle = gr; t.fillRect(x + ox * WASHI - rad, y + oy * WASHI - rad, rad * 2, rad * 2);
        }
      }
      t.setTransform(1, 0, 0, 1, 0, 0); // grain at full density
      var img = t.getImageData(0, 0, WASHI * 2, WASHI * 2), d = img.data;
      for (var k = 0; k < d.length; k += 4) {
        var n = r();
        if (n > .82) { d[k] = 60; d[k + 1] = 54; d[k + 2] = 44; d[k + 3] = Math.max(d[k + 3], Math.round((n - .82) * 120)); }
      }
      t.putImageData(img, 0, 0);
    });
    washi = { light: light, dark: dark, grain: grain, fringe: fringe };
    return washi;
  }
  /* A pattern fixed to the paper, not the screen: it turns and travels with what it
   * covers, pivoting on the anchor (x, y); (ox, oy) picks a different part of the sheet. */
  function paperFill(ctx, sheet, x, y, angle, ox, oy) {
    var pat = ctx.createPattern(sheet, 'repeat');
    if (pat && pat.setTransform && window.DOMMatrix) pat.setTransform(new DOMMatrix().translate(x, y).rotate(angle * 180 / Math.PI).translate(ox || 0, oy || 0).scale(.5));
    return pat;
  }

  var STONE_TONES = [['#fbfaf6', '#e9e6de', '#cdc8bd'], ['#f3f2ef', '#dfddd7', '#b9b6ae'], ['#f5f1ea', '#e3dbcf', '#c3b8a8']];
  function stoneSprite(radius, seed, tone) {
    var pad = radius * 2.2, size = Math.ceil((radius + pad) * 2 * dpr), c = document.createElement('canvas');
    c.width = c.height = size;
    var s = c.getContext('2d'), m = size / 2, cx = m / dpr, cy = m / dpr, rot = hash(seed + 3) * Math.PI, stretch = 1.04 + hash(seed) * .14;
    s.setTransform(dpr, 0, 0, dpr, 0, 0);
    var path = new Path2D(), k = PAPER ? 26 : 12, pts = [];
    for (var i = 0; i < k; i++) {
      var a = i / k * TAU, j = 1 + .07 * Math.sin(a * 2 + seed * 1.7) + .04 * Math.sin(a * 3 + seed);
      if (PAPER) j += .022 * Math.sin(a * 7 + seed * 2.3) + .014 * Math.sin(a * 13 + seed * 4.1); // cut by hand
      var ex = Math.cos(a) * radius * j * stretch, ey = Math.sin(a) * radius * j * (2 - stretch) * .92;
      pts.push({ x: cx + ex * Math.cos(rot) - ey * Math.sin(rot), y: cy + ex * Math.sin(rot) + ey * Math.cos(rot) });
    }
    // A smooth closed curve through the midpoints: rounded, never pointed.
    path.moveTo((pts[k - 1].x + pts[0].x) / 2, (pts[k - 1].y + pts[0].y) / 2);
    for (i = 0; i < k; i++) { var nx = pts[(i + 1) % k]; path.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + nx.x) / 2, (pts[i].y + nx.y) / 2); }
    path.closePath();
    var t = STONE_TONES[tone || 0];
    s.save(); s.shadowColor = 'rgba(48,47,41,.24)'; s.shadowBlur = radius * .9 * dpr;
    s.shadowOffsetX = radius * .22 * dpr; s.shadowOffsetY = radius * .38 * dpr;
    if (PAPER) {
      // Matte paper: one tone, a little lighter where the sheet faces the light, no gloss.
      var flat = s.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      flat.addColorStop(0, t[0]); flat.addColorStop(1, t[1]);
      s.fillStyle = flat; s.fill(path); s.restore();
      var w = makeWashi(), ox = hash(seed + 9) * WASHI, oy = hash(seed + 11) * WASHI, rotp = hash(seed + 13) * TAU;
      s.save(); s.clip(path);
      s.fillStyle = paperFill(s, w.grain, cx, cy, rotp, ox, oy); s.globalAlpha = .85; s.fillRect(0, 0, size / dpr, size / dpr);
      s.fillStyle = paperFill(s, w.dark, cx, cy, rotp, ox, oy); s.globalAlpha = .45; s.fillRect(0, 0, size / dpr, size / dpr);
      s.restore();
      s.save(); s.strokeStyle = paperFill(s, w.dark, cx, cy, rotp, ox, oy); s.globalAlpha = .9; s.lineWidth = Math.max(1, radius * .09); s.stroke(path); s.restore(); // the torn rim
      return { canvas: c, half: m / dpr };
    }
    var grad = s.createRadialGradient(cx - radius * .35, cy - radius * .4, radius * .1, cx, cy, radius * 1.25);
    grad.addColorStop(0, t[0]); grad.addColorStop(.6, t[1]); grad.addColorStop(1, t[2]);
    s.fillStyle = grad; s.fill(path); s.restore();
    return { canvas: c, half: m / dpr };
  }

  /* ——— koi behaviour ——— */
  function lookAhead(f) { var d = f.len() * .35 + f.v * .6; return { x: f.x + Math.cos(f.h) * d, y: f.y + Math.sin(f.h) * d }; }
  function avoid(f) {
    var q = lookAhead(f), ax = 0, ay = 0, R = L * .9, w;
    if (q.x < bounds.x0 + R) ax += Math.pow((bounds.x0 + R - q.x) / R, 2) * 1.6;
    if (q.x > bounds.x1 - R) ax -= Math.pow((q.x - bounds.x1 + R) / R, 2) * 1.6;
    if (q.y < bounds.y0 + R) ay += Math.pow((bounds.y0 + R - q.y) / R, 2) * 1.6;
    if (q.y > bounds.y1 - R) ay -= Math.pow((q.y - bounds.y1 + R) / R, 2) * 1.6;
    keepOut.forEach(function (k) {
      if (greet && greet.fish === f) return; // homecoming: she may enter the reading's open water
      var nx = clamp(q.x, k.x0, k.x1), ny = clamp(q.y, k.y0, k.y1), dx = q.x - nx, dy = q.y - ny, d = Math.hypot(dx, dy);
      if (d === 0) { dx = q.x - (k.x0 + k.x1) / 2; dy = q.y - (k.y0 + k.y1) / 2; d = Math.hypot(dx, dy) || 1; ax += dx / d * 3; ay += dy / d * 3; }
      else if (d < R) { w = Math.pow((R - d) / R, 2) * 2.4; ax += dx / d * w; ay += dy / d * w; }
    });
    // The clump (blades, the stems below the plumes, the stones at the roots) is one
    // obstacle: koi go around it and pass only beneath the plumes.
    clump().forEach(function (cl) {
      var cx = q.x - cl.x, cy = q.y - cl.y, dn = Math.hypot(cx / cl.rx, cy / cl.ry);
      if (dn < 1.6) { w = (1.6 - dn) / 1.6 * 4; var cd = Math.hypot(cx, cy) || 1; ax += cx / cd * w; ay += cy / cd * w; }
    });
    stones.forEach(function (s) {
      if (s.cluster) return;
      var dx = q.x - s.x, dy = q.y - s.y, d = Math.hypot(dx, dy) || 1, gap = d - s.r - f.len() * .3, reach = L * .75;
      if (gap < reach) { w = Math.pow((reach - gap) / reach, 2) * 1.8 * clamp(s.r / (9 * us), .45, 1.2); ax += dx / d * w; ay += dy / d * w; }
    });
    fish.forEach(function (o) {
      if (o === f || (circle && circle.pair.indexOf(f) > -1 && circle.pair.indexOf(o) > -1)) return;
      [o.chain[0], o.chain[6]].forEach(function (p) {
        var dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d < L) { w = Math.pow(1 - d / L, 2); ax += dx / d * w; ay += dy / d * w; }
      });
    });
    if (f.fear > 0 && ptr.inside) {
      var dx = q.x - ptr.x, dy = q.y - ptr.y, d = Math.hypot(dx, dy) || 1, reach = L * 2.2;
      if (d < reach) { w = Math.pow(1 - d / reach, 2) * 2.5 * f.fear; ax += dx / d * w; ay += dy / d * w; }
    }
    if (f.flee > 0) { ax += f.fleeX * 2; ay += f.fleeY * 2; }
    return { x: ax, y: ay };
  }
  function startle(f, strength, px, py) {
    if (f.cool > 0 && strength < .95) return;
    var dx = f.chain[4].x - px, dy = f.chain[4].y - py;
    // C-start: turn the short way off the threat, then bolt.
    var away = Math.atan2(dy, dx), side = wrap(away - f.h), dir = f.h + clamp(side, -2.2, 2.2);
    f.fleeX = Math.cos(dir); f.fleeY = Math.sin(dir);
    f.fear = Math.max(f.fear, strength); f.flee = .55 + .6 * strength; f.e = 1; f.cool = .6;
    f.v = Math.max(f.v, f.len() * (1 + .8 * strength));
    if (curious && curious.fish === f) curious = null;
    if (greet && greet.fish === f) greet = null; // haste still scatters her
    if (circle && circle.pair.indexOf(f) > -1) circle = null;
    stats.startles++;
  }
  function bodyDistance(f, x, y) {
    var best = Infinity;
    for (var i = 0; i < N; i += 3) best = Math.min(best, Math.hypot(f.r[i].x - x, f.r[i].y - y) - f.r[i].w);
    return Math.max(0, best);
  }
  function sense(f) {
    if (!ptr.inside || clock - ptr.t > .12) return;
    var d = bodyDistance(f, ptr.x, ptr.y), len = f.len();
    if (d < len * .12 && ptr.speed > 40) startle(f, 1, ptr.x, ptr.y);
    else if (d < len * .75 && ptr.speed > 160) startle(f, .85, ptr.x, ptr.y);
    else if (d < len * 1.35 && ptr.speed > 520) startle(f, .7, ptr.x, ptr.y);
  }
  function considerCuriosity() {
    if (greet) { curious = null; return; } // the homecoming comes first, briefly
    var still = ptr.inside && ptr.type !== 'touch' && clock - ptr.still > 1.6 && !inKeepOut(ptr.x, ptr.y);
    if (!still) { curious = null; return; }
    if (curious) return;
    var best = null, bd = Infinity;
    fish.forEach(function (f) {
      if (!f.k.lips || f.fear > .05 || clock - f.lastScare < 3.5) return; // only the love koi comes near
      var d = Math.hypot(f.x - ptr.x, f.y - ptr.y);
      if (d < bd && d < L * 6) { bd = d; best = f; }
    });
    if (best) { curious = { fish: best, since: clock }; if (circle && circle.pair.indexOf(best) > -1) circle = null; stats.curious++; }
  }
  function considerCircle() {
    if (circle) { if (clock > circle.until) { circle.pair.forEach(function (f) { f.h += f === circle.pair[0] ? .5 : -.5; }); circle = null; nextCircle = clock + 26 + Math.random() * 14; } return; }
    if (clock < nextCircle || fish.length < 2) return;
    var a = fish[0], b = fish[1];
    if (a.fear > .02 || b.fear > .02 || (curious && (curious.fish === a || curious.fish === b))) return;
    var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d > L * 1.5 || inKeepOut(cx, cy) || cx < bounds.x0 + L || cx > bounds.x1 - L || cy < bounds.y0 + L || cy > bounds.y1 - L) return;
    var turn = (Math.cos(a.h) * (b.y - a.y) - Math.sin(a.h) * (b.x - a.x)) > 0 ? 1 : -1;
    circle = { pair: [a, b], x: cx, y: cy, sense: turn, until: clock + 5 + Math.random() * 1.5 };
    stats.circles++;
  }
  function step(f, dt) {
    f.cool = Math.max(0, f.cool - dt); f.flee = Math.max(0, f.flee - dt);
    if (f.fear > 0) { f.fear = Math.max(0, f.fear - dt / 2.6); f.lastScare = clock; }
    // Pulses: a few tail beats, then a long glide.
    f.beatT -= dt;
    if (f.beatT <= 0) {
      f.beat = !f.beat;
      // The sumi keeps its course: steadier beats, shorter glides.
      var steady = f.kind === 'sumi';
      f.beatT = f.beat ? (steady ? .9 : .7) + Math.random() * .8 : (steady ? 1.1 : 1.6) + Math.random() * (steady ? 1.2 : 2.6);
      f.beatI = (steady ? .48 : .38) + Math.random() * (steady ? .32 : .4);
    }
    var eT = f.beat ? f.beatI : .04, omega, len = f.len();
    var aim = null, A = avoid(f), mode = 'cruise';
    if (greet && greet.fish === f) {
      // Homecoming: she swims to the water beside the last line, then turns to face it.
      mode = 'greeting';
      // Along the line: first to a point further along it, then gliding in to the words.
      if (greet.stage && Math.hypot(greet.stage.x - f.x, greet.stage.y - f.y) < len * .5) greet.stage = null;
      var goal = greet.stage || greet;
      var hx = goal.x - f.x, hy = goal.y - f.y, hd = Math.hypot(hx, hy) || 1, near = greet.stage ? 0 : len * .5;
      if (hd > near) { aim = { x: hx / hd, y: hy / hd }; eT = hd > near * 2.5 ? .95 : .3; }
      else {
        // Arrived: she stays a little while, facing the words, then swims on.
        if (!greet.arrived) { greet.arrived = clock; greet.until = Math.min(greet.until, clock + 5); }
        var lx = greet.lx - f.x, ly = greet.ly - f.y, ld = Math.hypot(lx, ly) || 1; aim = { x: lx / ld, y: ly / ld }; eT = 0; f.v *= Math.exp(-2.4 * dt); }
    } else if (circle && circle.pair.indexOf(f) > -1) {
      mode = 'circle';
      var rx = f.x - circle.x, ry = f.y - circle.y, rd = Math.hypot(rx, ry) || 1, r0 = len * .6;
      var tx = -ry / rd * circle.sense, ty = rx / rd * circle.sense, k = (r0 - rd) / r0 * 1.3;
      aim = { x: tx + rx / rd * k, y: ty + ry / rd * k }; eT = .42;
    } else if (curious && curious.fish === f) {
      mode = 'curious';
      var gx = ptr.x - f.x, gy = ptr.y - f.y, gd = Math.hypot(gx, gy) || 1, stop = len * .62;
      aim = { x: gx / gd, y: gy / gd };
      // Purposeful while far, easing as it arrives, a slow drift at the hand.
      eT = gd > stop * 2.2 ? .85 : gd > stop ? .2 : 0;
      if (gd <= stop) f.v *= Math.exp(-2.2 * dt);
    }
    if (f.fear > 0) eT = Math.max(eT, .45 + .55 * f.fear);
    f.e += (eT - f.e) * Math.min(1, (eT > f.e ? 3.5 : 1.2) * dt);
    var al = Math.hypot(A.x, A.y), wander = .32 * Math.sin(clock * .19 + f.seed * 7) + .22 * Math.sin(clock * .083 + f.seed * 13) + .12 * Math.sin(clock * .41 + f.seed * 3);
    var vx = Math.cos(f.h), vy = Math.sin(f.h);
    if (aim) { vx += aim.x * 1.6; vy += aim.y * 1.6; }
    vx += A.x; vy += A.y;
    var target = Math.atan2(vy, vx), steer = (aim || al > .001) ? wrap(target - f.h) * 2.3 : 0;
    omega = wander * (1 - Math.min(1, al + (aim ? .8 : 0))) + steer;
    var max = .55 + 1.5 * f.e + 4.5 * f.fear + (mode === 'greeting' ? 1 : 0); // she turns toward home decisively
    f.h = wrap(f.h + clamp(omega, -max, max) * dt);
    var vT = len * (.09 + .52 * f.e + f.fear * (f.flee > 0 ? 1.7 : .55));
    if (mode === 'greeting') vT = eT === 0 ? len * .02 : vT + len * .6; // she comes home with purpose
    if (mode === 'curious') vT = eT === 0 ? len * .03 : vT + len * .3 * Math.min(1, (Math.hypot(ptr.x - f.x, ptr.y - f.y) - len) / (len * 2));
    f.v += (vT - f.v) * Math.min(1, (vT > f.v ? 2.6 : .6) * dt);
    f.x += Math.cos(f.h) * f.v * dt; f.y += Math.sin(f.h) * f.v * dt;
    var slack = len * .2;
    f.x = clamp(f.x, bounds.x0 - slack, bounds.x1 + slack); f.y = clamp(f.y, bounds.y0 - slack, bounds.y1 + slack);
    f.phase += TAU * (.55 + 2.6 * f.e + 1.5 * f.fear) * dt;
    f.follow(); f.shape();
    f.mode = f.fear > .05 ? 'startled' : mode;
  }

  /* ——— drawing ——— */
  function smooth(path, pts, start) {
    if (start) path.moveTo(pts[0].x, pts[0].y); else path.lineTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length - 1; i++) {
      path.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    path.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }
  /* Shadow on the floor: the shape drawn far off-canvas, only its shadow lands. */
  function shadow(alpha, blur, ox, oy, paint) {
    var off = 10000;
    g.save();
    g.shadowColor = 'rgba(48,47,41,' + alpha + ')'; g.shadowBlur = blur * dpr;
    g.shadowOffsetX = (off + ox) * dpr; g.shadowOffsetY = oy * dpr;
    g.translate(-off, 0); g.fillStyle = g.strokeStyle = '#000'; paint();
    g.restore();
  }
  function bodyPath(f) {
    var r = f.r, left = [], right = [], p = new Path2D();
    for (var i = 0; i < N; i++) {
      // Paper: each side cut by hand, a little unevenly, and the same cut every frame.
      var cl = PAPER ? 1 + .035 * Math.sin(i * 2.7 + f.seed * 5) + .02 * Math.sin(i * 5.3 + f.seed * 9) : 1;
      var cr = PAPER ? 1 + .035 * Math.sin(i * 2.3 + f.seed * 7) + .02 * Math.sin(i * 4.9 + f.seed * 3) : 1;
      left.push({ x: r[i].x - r[i].ty * r[i].w * cl, y: r[i].y + r[i].tx * r[i].w * cl });
      right.push({ x: r[i].x + r[i].ty * r[i].w * cr, y: r[i].y - r[i].tx * r[i].w * cr });
    }
    smooth(p, left, true);
    right.reverse(); smooth(p, right, false);
    var n = r[0], k = n.w * 1.35;
    p.bezierCurveTo(right[N - 1].x + n.tx * k, right[N - 1].y + n.ty * k, left[0].x + n.tx * k, left[0].y + n.ty * k, left[0].x, left[0].y);
    p.closePath();
    return p;
  }
  function finPath(f, s, side, length, width, spread) {
    var base = f.at(s, side * .82), seg = f.r[Math.round(s * (N - 1))];
    var a = Math.atan2(-seg.ty, -seg.tx) - side * spread;
    var tip = { x: base.x + Math.cos(a) * length, y: base.y + Math.sin(a) * length };
    var nx = -Math.sin(a) * width * side, ny = Math.cos(a) * width * side, p = new Path2D();
    p.moveTo(base.x, base.y);
    p.bezierCurveTo(base.x + nx * 1.4 + Math.cos(a) * length * .3, base.y + ny * 1.4 + Math.sin(a) * length * .3,
      tip.x + nx * .9, tip.y + ny * .9, tip.x, tip.y);
    p.quadraticCurveTo(base.x + Math.cos(a) * length * .45 - nx * .2, base.y + Math.sin(a) * length * .45 - ny * .2, base.x, base.y);
    return p;
  }
  function tailPath(f) {
    var a = f.r[N - 2], b = f.r[N - 1], len = f.len();
    var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    var flex = .35 * Math.sin(f.phase - TAU * .85 - .7) * (.3 + f.e);
    var c = Math.cos(flex), s = Math.sin(flex), ux = dx * c - dy * s, uy = dx * s + dy * c;
    var nx = -uy, ny = ux, reach = len * .24, spread = len * (.1 + .02 * (1 - f.e)), p = new Path2D();
    var t1 = { x: b.x + ux * reach + nx * spread, y: b.y + uy * reach + ny * spread };
    var t2 = { x: b.x + ux * reach - nx * spread, y: b.y + uy * reach - ny * spread };
    var notch = { x: b.x + ux * reach * .62, y: b.y + uy * reach * .62 };
    p.moveTo(b.x + nx * b.w * .9, b.y + ny * b.w * .9);
    p.quadraticCurveTo(b.x + ux * reach * .5 + nx * spread * 1.1, b.y + uy * reach * .5 + ny * spread * 1.1, t1.x, t1.y);
    p.quadraticCurveTo(notch.x + nx * spread * .25, notch.y + ny * spread * .25, notch.x, notch.y);
    p.quadraticCurveTo(notch.x - nx * spread * .25, notch.y - ny * spread * .25, t2.x, t2.y);
    p.quadraticCurveTo(b.x + ux * reach * .5 - nx * spread * 1.1, b.y + uy * reach * .5 - ny * spread * 1.1, b.x - nx * b.w * .9, b.y - ny * b.w * .9);
    p.closePath();
    return { path: p, base: b, ux: ux, uy: uy, nx: nx, ny: ny, reach: reach, spread: spread };
  }
  function patchPath(f, q, seed) {
    var p = new Path2D(), pts = [];
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * TAU, j = 1 + .16 * Math.sin(a * 3 + seed) + .08 * Math.sin(a * 5 + seed * 2);
      pts.push(f.at(q.s + Math.cos(a) * q.rs * j, q.u + Math.sin(a) * q.ru * j));
    }
    p.moveTo((pts[0].x + pts[11].x) / 2, (pts[0].y + pts[11].y) / 2);
    for (i = 0; i < 12; i++) { var n = pts[(i + 1) % 12]; p.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + n.x) / 2, (pts[i].y + n.y) / 2); }
    p.closePath();
    return p;
  }
  function drawFish(f, alpha) {
    var k = f.k, len = f.len(), u = len / 150, spread = .95 - .45 * f.e + .15 * Math.sin(f.phase * .5);
    var body = bodyPath(f), tail = tailPath(f);
    var fins = [finPath(f, .2, 1, len * .23, len * .07, spread), finPath(f, .2, -1, len * .23, len * .07, spread),
      finPath(f, .52, 1, len * .11, len * .04, spread * .8), finPath(f, .52, -1, len * .11, len * .04, spread * .8)];
    var sh = 6 + 10 * k.depth;
    g.save(); g.globalAlpha = alpha;
    shadow((.17 - .05 * k.depth) * alpha, (10 + 12 * k.depth) * u, sh * .55 * u, sh * u, function () {
      g.fill(body); g.fill(tail.path); fins.forEach(function (p) { g.fill(p); });
    });
    g.fillStyle = k.fin; fins.forEach(function (p) { g.fill(p); }); g.fill(tail.path);
    // Fin rays are a pen's idea of a tail; cut paper has no drawn lines (Chief, 22 October).
    if (!PAPER) {
      g.strokeStyle = k.ray; g.lineWidth = Math.max(.6, .7 * u);
      for (var i = -2; i <= 2; i++) {
        g.beginPath(); g.moveTo(tail.base.x, tail.base.y);
        g.lineTo(tail.base.x + tail.ux * tail.reach * .82 + tail.nx * tail.spread * i * .42, tail.base.y + tail.uy * tail.reach * .82 + tail.ny * tail.spread * i * .42);
        g.stroke();
      }
    }
    g.fillStyle = k.body; g.fill(body);
    if (PAPER) { paperKoi(f, alpha, body, tail, fins, u); g.restore(); return; }
    g.save(); g.clip(body);
    k.patches.forEach(function (q, i) { g.fillStyle = k.red; g.globalAlpha = alpha * .92; g.fill(patchPath(f, q, f.seed * 5 + i)); });
    if (k.lips) { g.fillStyle = k.red; g.globalAlpha = alpha * .96; g.fill(patchPath(f, k.lips, 9)); }
    g.globalAlpha = alpha;
    // Paper volume: a soft ridge along the spine and a darker rim inside the edge.
    var spine = new Path2D(); smooth(spine, f.r.slice(0, N - 2), true);
    g.strokeStyle = k.ridge; g.lineWidth = len * .07; g.lineCap = 'round'; g.stroke(spine);
    g.strokeStyle = k.rim; g.lineWidth = len * .05; g.stroke(body);
    g.restore();
    [1, -1].forEach(function (side) { var e = f.at(.065, side * .62); g.fillStyle = k.eye; g.beginPath(); g.arc(e.x, e.y, Math.max(1, len * .011), 0, TAU); g.fill(); });
    g.restore();
  }
  /* The koi as washi: the body and fins are one sheet each; the kohaku's vermilion is
   * separate pieces laid on top, each with a hairline shadow; the sumi is dyed paper whose
   * pale fibres show. No gloss: the ridge and rim of the placeholder go. The grain is
   * fixed to the body (anchored a third of the way down the spine, turning with it), so it
   * never slides as the koi swims. */
  var PAPER_RED = '#c8593a';
  function paperKoi(f, alpha, body, tail, fins, u) {
    var k = f.k, w = makeWashi(), len = f.len(), a = f.r[4], ang = Math.atan2(a.ty, a.tx), seedX = f.seed * 61, sumi = !k.red;
    var all = new Path2D(); all.addPath(body); all.addPath(tail.path); fins.forEach(function (p) { all.addPath(p); });
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    f.r.forEach(function (q) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); });
    var pad = len * .38; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    function sheet(c) { return paperFill(g, c, a.x, a.y, ang, seedX, 0); }
    g.save(); g.clip(body);
    if (!sumi) {
      k.patches.concat(k.lips ? [k.lips] : []).forEach(function (q, i) {
        var piece = patchPath(f, q, q === k.lips ? 9 : f.seed * 5 + i);
        g.save();
        g.shadowColor = 'rgba(48,47,41,' + (.3 * alpha).toFixed(3) + ')'; g.shadowBlur = 1.4 * u * dpr;
        g.shadowOffsetX = .5 * u * dpr; g.shadowOffsetY = .8 * u * dpr;
        g.fillStyle = PAPER_RED; g.globalAlpha = alpha * (q === k.lips ? .96 : .94); g.fill(piece);
        g.restore();
        // Torn, not cut: the dyed sheet's pale core shows as a feathered rim (chigiri-e).
        g.save(); g.globalAlpha = alpha * .8; g.lineWidth = Math.max(1.2, 2.4 * u); g.strokeStyle = sheet(w.fringe); g.stroke(piece); g.restore();
      });
    }
    g.restore();
    // Grain and fibres over every sheet: body, fins and tail.
    g.save(); g.clip(all);
    // On the dyed sumi the fibres stay soft (strong, they read as crackle); the mottle carries it.
    g.globalAlpha = alpha * (sumi ? .9 : .8); g.fillStyle = sheet(w.grain); g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.globalAlpha = alpha * (sumi ? .32 : .75); g.fillStyle = sheet(sumi ? w.light : w.dark); g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.restore();
    // The edge: the dyed sumi is torn, its pale core feathering the rim; the white kohaku
    // is cut, and only a faint grey of fibres marks where the sheet ends.
    g.save(); g.globalAlpha = alpha * (sumi ? .8 : .55); g.lineWidth = Math.max(1.3, (sumi ? 2.8 : 1.6) * u);
    g.strokeStyle = sheet(sumi ? w.fringe : w.dark); g.stroke(body);
    if (sumi) {
      // The fins and tail tear only where they show: their rim stops at the body's edge, so it
      // never draws a pale line across the body where they join it.
      var outside = new Path2D(); outside.rect(x0, y0, x1 - x0, y1 - y0); outside.addPath(body);
      g.clip(outside, 'evenodd'); fins.forEach(function (p) { g.stroke(p); }); g.stroke(tail.path);
    }
    g.restore();
    [1, -1].forEach(function (side) { var e = f.at(.065, side * .62); g.fillStyle = k.eye; g.beginPath(); g.arc(e.x, e.y, Math.max(1, len * .011), 0, TAU); g.fill(); });
  }
  /* Blades: tapered, with a slight belly, drying toward the tip; a faint midrib. */
  function leafShape(d, sway) {
    var b = { x: root.x + d[0] * Hs, y: root.y }, len = d[1] * Hs, n = 14, seg = len / n, x = b.x, y = b.y, left = [], right = [], mid = [];
    var w0 = Hs * .0078 * d[4];
    for (var j = 0; j <= n; j++) {
      var s = j / n, a = -Math.PI / 2 + d[2] + (d[3] + sway) * Math.pow(s, 1.5);
      var hw = w0 * Math.pow(1 - s, .8) * (.72 + .28 * Math.sin(Math.PI * Math.min(1, s * 1.8))) + .25;
      if (j) { x += Math.cos(a) * seg; y += Math.sin(a) * seg; }
      mid.push({ x: x, y: y });
      left.push({ x: x - Math.sin(a) * hw, y: y + Math.cos(a) * hw }); right.push({ x: x + Math.sin(a) * hw, y: y - Math.cos(a) * hw });
    }
    var p = new Path2D(); smooth(p, left, true); right.reverse(); smooth(p, right, false); p.closePath();
    var rib = new Path2D(); smooth(rib, mid.slice(1, Math.round(n * .75)), true);
    return { path: p, rib: rib, base: b, tip: mid[n] };
  }
  /* Stems taper from the root to the plume. */
  function stemShape(st) {
    var j0 = Math.round(S * (1 - st.def[4])), p = st.pts, l = [], r = [], w0 = 1.15 * us, w1 = .42 * us;
    for (var j = 0; j <= j0 + 1; j++) {
      var w = w0 + (w1 - w0) * j / (j0 + 1), a = p[j].a;
      l.push({ x: p[j].x - Math.sin(a) * w, y: p[j].y + Math.cos(a) * w }); r.push({ x: p[j].x + Math.sin(a) * w, y: p[j].y - Math.cos(a) * w });
    }
    var path = new Path2D(); smooth(path, l, true); r.reverse(); smooth(path, r, false); path.closePath();
    return { path: path, j0: j0 };
  }
  /* A plume is a panicle: branches leave the rachis steeply and carry tufts of fine
   * fibres that flow toward the tip, densest at the core, wisps escaping the edge, no
   * outline. Drawn once per layout into its own canvas, then carried by the swaying stem. */
  function plumeSprite(st) {
    var d = st.def, R = rng(4099 + st.i * 7919), pal = PLUME[d[5]], i, u, q, w;
    var Lp = d[1] * d[4] * Hs, wm = st.wm * Hs;
    var lean = d[2] + d[3] * Math.pow(1 - d[4] / 2, 1.7);
    var droop = wm * (.3 + R() * .4) * (lean < 0 ? -1 : 1); // the tip nods the way the stem leans
    var pad = wm * 1.3 + 18 * us, cw = Math.ceil(wm * 2 + pad * 2 + Math.abs(droop)), ch = Math.ceil(Lp + pad * 2);
    var c = document.createElement('canvas'); c.width = Math.ceil(cw * dpr); c.height = Math.ceil(ch * dpr);
    var s = c.getContext('2d'); s.setTransform(dpr, 0, 0, dpr, 0, 0); s.lineCap = 'round';
    var bx = cw / 2 - droop / 2, by = ch - pad;
    function axis(t) {
      return { x: bx + droop * Math.pow(t, 2.2), y: by - t * Lp, a: Math.atan2(-Lp, droop * 2.2 * Math.pow(Math.max(t, .001), 1.2)) };
    }
    function width(t) { t = clamp(t, 0, 1); return wm * Math.pow(Math.sin(Math.PI * Math.pow(t, .68)), .8) * (1 - .12 * t); }
    function outline(k) {
      var p = new Path2D(), l = [], r = [];
      for (var n = 0; n <= 24; n++) {
        var e = axis(n / 24), h = width(n / 24) * k, nx = -Math.sin(e.a), ny = Math.cos(e.a);
        l.push({ x: e.x + nx * h, y: e.y + ny * h }); r.push({ x: e.x - nx * h, y: e.y - ny * h });
      }
      smooth(p, l, true); r.reverse(); smooth(p, r, false); p.closePath(); return p;
    }
    function soft(path, color, radius, ox, oy) { // a blurred fill: the shape off-canvas, only its shadow lands
      var off = 10000; s.save(); s.shadowColor = color; s.shadowBlur = radius * dpr;
      s.shadowOffsetX = (off + (ox || 0)) * dpr; s.shadowOffsetY = (oy || 0) * dpr; s.translate(-off, 0); s.fillStyle = '#000'; s.fill(path); s.restore();
    }
    function fibre(x, y, a, len, bend, color, alpha, lw) {
      s.strokeStyle = rgba(color, alpha); s.lineWidth = lw; s.beginPath(); s.moveTo(x, y);
      s.quadraticCurveTo(x + Math.cos(a) * len * .5 - Math.sin(a) * bend, y + Math.sin(a) * len * .5 + Math.cos(a) * bend, x + Math.cos(a) * len, y + Math.sin(a) * len);
      s.stroke();
    }
    // Its shadow on the paper, in the page's light, then a soft body with no edge.
    var sx = 3 * us, sy = 6 * us, cr = Math.cos(-lean), sr = Math.sin(-lean);
    soft(outline(.85), 'rgba(48,47,41,.045)', 12 * us, sx * cr - sy * sr, sx * sr + sy * cr);
    soft(outline(.9), rgba(pal[1], .42), wm * .6);
    soft(outline(.5), rgba(pal[2], .24), wm * .35);
    // Core density: short fibres along the rachis, pointing to the tip.
    for (i = 0; i < 120; i++) {
      u = Math.pow(R(), .85) * .97; q = axis(u); w = width(u);
      fibre(q.x + (R() - .5) * w * .3, q.y, q.a + (R() - .5) * .5, w * (.5 + .7 * R()), (R() - .5) * w * .25, pal[R() < .3 ? 3 : 2], .14 + .2 * R(), (.45 + .35 * R()) * us);
    }
    // Branches and their tufts; the left side catches the light.
    var B = 22;
    for (var b = 0; b < B; b++) {
      u = .03 + .92 * (b + R() * .7) / B; q = axis(u); w = width(u);
      var side = (b % 2 ? 1 : -1) * (R() < .15 ? -1 : 1), th = .3 + R() * .28, ba = q.a + side * th;
      var lb = Math.min(Lp * .42, w * (.85 + R() * .45) / Math.sin(th));
      var mx = q.x + Math.cos(ba - side * .12) * lb * .55, my = q.y + Math.sin(ba - side * .12) * lb * .55;
      var ex = q.x + Math.cos(ba) * lb, ey = q.y + Math.sin(ba) * lb;
      s.strokeStyle = rgba(pal[3], .2); s.lineWidth = .5 * us; s.beginPath(); s.moveTo(q.x, q.y); s.quadraticCurveTo(mx, my, ex, ey); s.stroke();
      var nf = 18 + Math.floor(R() * 10);
      for (var f = 0; f < nf; f++) {
        var t = .1 + .9 * R(), it = 1 - t;
        var px = it * it * q.x + 2 * it * t * mx + t * t * ex, py = it * it * q.y + 2 * it * t * my + t * t * ey;
        var fa = ba + (R() - .5) * .85 - side * .15 * R(), fl = lb * (.2 + .28 * R()) * (1.15 - .45 * t);
        var light = side < 0 ? R() < .7 : R() < .35;
        fibre(px, py, fa, fl, (R() - .5) * fl * .35, light ? pal[0] : pal[R() < .35 ? 2 : 1], light ? .24 + .34 * R() : .18 + .3 * R(), (.4 + .4 * R()) * us);
      }
    }
    // Loose wisps past the edge, and a fine tip.
    for (i = 0; i < 18; i++) {
      u = .08 + .9 * R(); q = axis(u); w = width(u); var sd = R() < .5 ? -1 : 1;
      fibre(q.x - Math.sin(q.a) * sd * w * .7, q.y + Math.cos(q.a) * sd * w * .7, q.a + sd * (.35 + .4 * R()), w * (.7 + .8 * R()) + 5 * us, sd * w * (.15 + .2 * R()),
        pal[R() < .6 ? 0 : 1], .14 + .18 * R(), (.35 + .3 * R()) * us);
    }
    q = axis(1);
    for (i = 0; i < 7; i++) fibre(q.x, q.y + 3 * us, q.a + (R() - .5) * .5, (6 + 7 * R()) * us, (R() - .5) * 4 * us, pal[1], .25 + .2 * R(), .45 * us);
    // The rachis shows only near the base, fading upward.
    var r0 = axis(0), r1 = axis(.55), grad = s.createLinearGradient(r0.x, r0.y, r1.x, r1.y);
    grad.addColorStop(0, rgba(pal[3], .55)); grad.addColorStop(1, rgba(pal[3], 0));
    s.strokeStyle = grad; s.lineWidth = .8 * us; s.beginPath(); s.moveTo(r0.x, r0.y);
    for (i = 1; i <= 12; i++) { q = axis(.55 * i / 12); s.lineTo(q.x, q.y); }
    s.stroke();
    return { canvas: c, w: cw, h: ch, bx: bx, by: by };
  }
  function drawPlume(st, j0) {
    var sp = st.sprite; if (!sp) return;
    var P = st.pts[j0], T = st.pts[S];
    g.save(); g.translate(P.x, P.y); g.rotate(Math.atan2(T.y - P.y, T.x - P.x) + Math.PI / 2);
    g.drawImage(sp.canvas, -sp.bx, -sp.by, sp.w, sp.h); g.restore();
  }
  function drawGrass() {
    var sway = stems.reduce(function (a, st) { return a + st.t; }, 0) / Math.max(1, stems.length);
    var blades = LEAVES.map(function (d) { return leafShape(d, sway * .35); });
    var shapes = stems.map(stemShape);
    shadow(.1, 9 * us, 5 * us, 8 * us, function () {
      blades.forEach(function (b) { g.fill(b.path); });
      shapes.forEach(function (sh) { g.fill(sh.path); });
    });
    blades.forEach(function (b, i) {
      var tone = BLADE_TONE[i % 2], grad = g.createLinearGradient(b.base.x, b.base.y, b.tip.x, b.tip.y);
      grad.addColorStop(0, rgba(tone[0], .95)); grad.addColorStop(.55, rgba(tone[1], .95)); grad.addColorStop(1, rgba(tone[2], .9));
      g.fillStyle = grad; g.fill(b.path);
      g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = .5 * us; g.stroke(b.rib);
    });
    var order = stems.map(function (st, i) { return i; }).sort(function (a, b) { return stems[b].def[1] - stems[a].def[1]; });
    order.forEach(function (i) {
      var st = stems[i], sh = shapes[i], top = st.pts[sh.j0], grad = g.createLinearGradient(root.x, root.y, top.x, top.y);
      grad.addColorStop(0, rgba(STEM_TONE[0], 1)); grad.addColorStop(1, rgba(STEM_TONE[1], 1));
      g.fillStyle = grad; g.fill(sh.path);
      drawPlume(st, sh.j0);
    });
  }
  function draw() {
    var t0 = performance.now();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    var order = fish.slice().sort(function (a, b) { return b.k.depth - a.k.depth; });
    order.forEach(function (f, i) { drawFish(f, ease((surfaced - i * .55) / 2.2)); });
    function stone(st) { g.drawImage(st.sprite.canvas, st.x - st.sprite.half, st.y - st.sprite.half, st.sprite.half * 2, st.sprite.half * 2); }
    stones.forEach(function (st) { if (!st.front) stone(st); });
    drawGrass();
    stones.forEach(function (st) { if (st.front) stone(st); });
    if (DEBUG) debug();
    stats.drawMs = performance.now() - t0;
  }
  function debug() {
    g.save(); g.lineWidth = 1; g.strokeStyle = 'rgba(196,92,61,.5)'; g.setLineDash([4, 4]);
    g.strokeRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
    keepOut.forEach(function (k) { g.strokeRect(k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0); });
    if (spec) g.strokeRect(spec.x0, spec.y0, spec.x1 - spec.x0, spec.y1 - spec.y0);
    g.setLineDash([]);
    if (ptr.inside) { g.beginPath(); g.arc(ptr.x, ptr.y, L * .75, 0, TAU); g.stroke(); }
    g.fillStyle = 'rgba(48,47,41,.8)'; g.font = '12px ui-monospace,monospace';
    fish.forEach(function (f) { g.fillText(f.kind + ' · ' + f.mode, f.x + 8, f.y - 12); });
    var s = MA.pond.stats();
    g.fillText('fps ' + s.fps + ' · p95 ' + s.p95 + 'ms · late ' + s.late + ' · draw ' + s.drawMs + 'ms · ptr ' + Math.round(ptr.speed) + 'px/s · gust ' + (gust ? 'on' : 'off'), bounds.x0, H - 10);
    g.restore();
  }

  /* ——— reduced motion: the pair rests in one composed curve, the grass upright, drawn once ——— */
  function pose() {
    if (!bounds || fish.length < 2) return;
    var c = spot(0), cx = c[0], cy = c[1], r = L * .55;
    fish.forEach(function (f, i) {
      var start = i * Math.PI, seg = f.len() * .78 / (N - 1);
      for (var j = 0; j < N; j++) {
        var a = start - (j * seg) / r;
        f.chain[j].x = cx + Math.cos(a) * r; f.chain[j].y = cy + Math.sin(a) * r;
      }
      f.x = f.chain[0].x; f.y = f.chain[0].y; f.h = start + Math.PI / 2; f.e = 0; f.fear = 0; f.phase = 0; f.mode = 'rest'; f.shape();
    });
    stems.forEach(function (st) { st.t = 0; st.w = 0; st.build(); });
    surfaced = 9; draw();
  }

  /* ——— clock ——— */
  function tick(time) {
    if (dead) return;
    var dt = last ? Math.min(1 / 30, (time - last) / 1000) : 1 / 60;
    if (last) {
      var gap = time - last; stats.intervals.push(gap); if (stats.intervals.length > 240) stats.intervals.shift();
      if (gap > 20) stats.late++;
    }
    last = time; clock += dt; surfaced += dt; stats.frames++;
    if (ptr.inside && clock - ptr.t > .1) { ptr.speed *= Math.exp(-12 * dt); if (ptr.speed < 25 && ptr.still > clock) ptr.still = clock; }
    if (returning && performance.now() - returning > 1100) { returning = null; beginGreet(); }
    if (greet && clock > greet.until) greet = null;
    considerCuriosity(); considerCircle();
    fish.forEach(function (f) { sense(f); step(f, dt); });
    stepGrass(dt);
    draw();
  }
  function run() {
    if (dead || job !== null || MA.reduced.now() || forced.matches) return;
    last = 0; job = MA.frame.add(tick, section);
  }
  function halt() { if (job !== null) { MA.frame.remove(job); job = null; } }

  var sub = MA.pointer.add(host, function (p) {
    if (p.pointerType === 'touch') return; // a finger has its own grammar: see touch() below
    var x = p.x * W, y = p.y * H, now = clock;
    if (p.inside && !ptr.inside) { ptr.speed = 0; ptr.still = Infinity; }
    if (ptr.inside && p.inside) {
      var dt = Math.max(.008, (performance.now() - (ptr.ms || 0)) / 1000), d = Math.hypot(x - ptr.x, y - ptr.y);
      ptr.speed = ptr.speed * .5 + Math.min(4000, d / dt) * .5;
    }
    ptr.x = x; ptr.y = y; ptr.inside = p.inside; ptr.t = now; ptr.ms = performance.now(); ptr.type = p.pointerType || 'mouse';
    if (ptr.speed >= 25) ptr.still = Infinity;
    if (ptr.still === Infinity && ptr.speed < 25) ptr.still = now;
    if (!p.inside) { curious = null; ptr.speed = 0; }
  });
  /* A press (or a quick tap) scatters every fish within reach and parts the grass. */
  function press(e) {
    if (e.button > 0 || !started || MA.reduced.now()) return;
    if (e.pointerType === 'touch') { touch(e); return; }
    scatter(e.clientX, e.clientY);
  }
  function scatter(cx, cy) {
    var r = host.getBoundingClientRect(), x = cx - r.left, y = cy - r.top, hit = false;
    fish.forEach(function (f) {
      var d = bodyDistance(f, x, y);
      if (d < L * 2.2) { startle(f, d < L * .9 ? 1 : .75, x, y); hit = true; }
    });
    stems.forEach(function (st) {
      var c = st.plumeCentre(), d = Math.hypot(c.x - x, c.y - y), R = Hs * .5;
      if (d < R) { st.w += Math.sign(c.x - x || 1) * 1.6 * (1 - d / R); st.parted = clock; hit = true; }
    });
    if (hit) stats.spreads++;
  }
  /* A finger: a quick tap is haste and scatters, on lift; held still for a moment it is
   * stillness, and the love koi comes to it; lifted, she drifts away. A finger that moves
   * is scrolling and means nothing to the koi. */
  var finger = null, HOLD = 450, SLOP = 10;
  function touch(e) {
    var r = host.getBoundingClientRect();
    if (finger) release();
    finger = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), held: false,
      timer: setTimeout(function () {
        if (!finger || finger.moved) return;
        finger.held = true; stats.holds++;
        ptr.x = finger.x - r.left; ptr.y = finger.y - r.top; ptr.inside = true; ptr.type = 'hold'; ptr.speed = 0;
        ptr.t = clock; ptr.still = clock - 1; // a held finger has already been still a while
      }, HOLD) };
  }
  function fingerMove(e) {
    if (!finger || e.pointerId !== finger.id) return;
    if (Math.hypot(e.clientX - finger.x, e.clientY - finger.y) > SLOP) { finger.moved = true; release(); }
  }
  function fingerUp(e) {
    if (!finger || e.pointerId !== finger.id) return;
    var quick = !finger.held && !finger.moved && performance.now() - finger.t < 350, x = finger.x, y = finger.y;
    release();
    if (quick && e.type === 'pointerup') scatter(x, y);
  }
  function release() {
    if (!finger) return;
    clearTimeout(finger.timer);
    if (finger.held) { ptr.inside = false; ptr.speed = 0; ptr.still = Infinity; curious = null; }
    finger = null;
  }
  host.addEventListener('pointerdown', press, { passive: true });
  host.addEventListener('pointermove', fingerMove, { passive: true });
  host.addEventListener('pointerup', fingerUp, { passive: true });
  host.addEventListener('pointercancel', fingerUp, { passive: true });

  /* The return: a reader who chooses "Return to the beginning" from the end of the work
   * comes home to the pond, and the love koi comes to the last line, "So do you.", for a
   * few seconds. Arriving any other way changes nothing. */
  function beginGreet() {
    if (!started || MA.reduced.now() || forced.matches || job === null) return;
    var sec = section.getBoundingClientRect();
    if (sec.top < -H * .5 || sec.top > innerHeight * .5) return; // not home after all
    var love = fish.filter(function (f) { return f.k.lips; })[0], sub = host.querySelector('.ch01-sub'), read = keepOut[0];
    if (!love || !sub || !read) return;
    // The last real text in the line (a text effect may wrap it in spans).
    var walk = document.createTreeWalker(sub, NodeFilter.SHOW_TEXT), text = null, n;
    while ((n = walk.nextNode())) if (n.textContent.trim() && !(n.parentElement && n.parentElement.closest('[aria-hidden="true"]'))) text = n;
    if (!text) return;
    var range = document.createRange();
    range.setStart(text, Math.max(0, text.textContent.length - 10)); range.setEnd(text, text.textContent.length);
    var rects = range.getClientRects(), line = rects[rects.length - 1], b = host.getBoundingClientRect();
    if (!line) return;
    var lx = line.right - b.left, ly = line.top + line.height / 2 - b.top;
    // Just after the last word, in the open water the short line leaves; where the line
    // runs to the edge (narrow screens), just below the reading instead.
    var x = lx + L * .55, y = ly, stage = { x: x + L * 1.5, y: ly };
    if (stage.x > bounds.x1 - L * .3) { x = clamp(lx - L * .4, bounds.x0 + L * .4, bounds.x1 - L * .4); y = read.y1 + L * .45; stage = null; }
    y = clamp(y, bounds.y0, bounds.y1);
    if (circle && circle.pair.indexOf(love) > -1) circle = null;
    curious = null; love.fear = 0; love.flee = 0;
    greet = { fish: love, x: x, y: y, lx: lx, ly: ly, stage: stage, until: clock + 13, arrived: 0 };
    stats.greets++;
  }
  function onReturn(e) {
    var a = e.target.closest && e.target.closest('a[href="#ch01"]');
    if (a && a.closest('#ch11') && e.button === 0) returning = performance.now();
  }
  document.addEventListener('click', onReturn, true);

  function start() {
    if (started || dead) return;
    started = true;
    section.setAttribute('data-pond', '');
    measure();
    if (MA.reduced.now()) { pose(); return; }
    run();
  }
  function init() {
    fish = [new Fish('sumi', .17), new Fish('kohaku', .71)];
    measure();
    fish.forEach(function (f) { f.place.apply(f, spot(f.seed)); f.follow(); f.shape(); });
    // Wait for the opening bloom to hand over the page; never longer than 7s.
    if (!document.getElementById('veil')) { start(); return; }
    var mo = new MutationObserver(function () { if (!document.getElementById('veil')) { mo.disconnect(); start(); } });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); start(); }, 7000);
  }
  var ro = window.ResizeObserver ? new ResizeObserver(function () { if (started) { measure(); if (!job) draw(); } }) : null;
  if (ro) { ro.observe(host); var reading = host.querySelector('.ch01-reading'); if (reading) ro.observe(reading); }
  var offReduced = MA.reduced.onChange(function (reduce) {
    if (!started) return;
    if (reduce) { halt(); pose(); } else run();
  });
  forced.addEventListener('change', function () { if (forced.matches) halt(); else run(); });

  /* Grass points inside the caption's own box (unpadded): stems, and blade centrelines. */
  var hitSources = [];
  function captionHits() {
    var c = rel(host.querySelector('.ch01-caption'), 0), n = 0, who = '';
    hitSources = [];
    if (!c) return 0;
    function hit(x, y) { if (x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1) { n++; if (hitSources.indexOf(who) < 0) hitSources.push(who); } }
    stems.forEach(function (st, i) { who = 'stem ' + i; st.pts.forEach(function (p) { hit(p.x, p.y); }); });
    stones.forEach(function (st, i) { who = 'stone ' + i; if (st.x + st.r > c.x0 && st.x - st.r < c.x1 && st.y + st.r > c.y0 && st.y - st.r < c.y1) hit(c.x0 + 1, c.y0 + 1); });
    LEAVES.forEach(function (d, i) {
      who = 'blade ' + i;
      var x = root.x + d[0] * Hs, y = root.y, seg = d[1] * Hs / 12;
      for (var j = 1; j <= 12; j++) { var a = -Math.PI / 2 + d[2] + d[3] * Math.pow(j / 12, 1.5); x += Math.cos(a) * seg; y += Math.sin(a) * seg; hit(x, y); }
    });
    return n;
  }
  MA.pond = {
    stats: function () {
      var iv = stats.intervals.slice().sort(function (a, b) { return a - b; });
      var mean = iv.length ? iv.reduce(function (a, b) { return a + b; }, 0) / iv.length : 0;
      return { running: job !== null, started: started, frames: stats.frames, fps: mean ? Math.round(1000 / mean) : 0,
        p95: iv.length ? Math.round(iv[Math.floor(iv.length * .95)] * 10) / 10 : 0, late: stats.late,
        drawMs: Math.round(stats.drawMs * 100) / 100, art: PAPER ? 'paper' : 'drawn', startles: stats.startles, spreads: stats.spreads, holds: stats.holds, greets: stats.greets, greet: greet ? { x: greet.x, y: greet.y, lx: greet.lx, ly: greet.ly, arrived: !!greet.arrived } : null, holding: !!(finger && finger.held),
        curious: stats.curious, circles: stats.circles, gusts: stats.gusts, maxBend: Math.round(stats.maxBend * 1000) / 1000, L: L, dpr: dpr, Hs: Hs,
        fish: fish.map(function (f) { return { kind: f.kind, x: f.x, y: f.y, h: f.h, v: f.v, mode: f.mode || 'cruise', fear: f.fear }; }),
        stems: stems.map(function (s) { var c = s.plumeCentre(); return { bend: s.t, rate: s.w, root: s.base(), tip: { x: s.pts[S].x, y: s.pts[S].y }, plume: { x: c.x, y: c.y } }; }),
        stones: stones.map(function (s) { return { x: s.x, y: s.y, r: s.r, front: s.front }; }), ring: ring(), keepOut: keepOut.slice(), root: root, clump: clump(), captionHits: captionHits(), captionHitSources: hitSources.slice() };
    },
    dispose: function () {
      dead = true; halt(); release(); document.removeEventListener('click', onReturn, true); MA.pointer.remove(sub); host.removeEventListener('pointerdown', press);
      host.removeEventListener('pointermove', fingerMove); host.removeEventListener('pointerup', fingerUp); host.removeEventListener('pointercancel', fingerUp);
      if (ro) ro.disconnect(); offReduced(); section.removeAttribute('data-pond'); g.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (started) measure(); });
  init();
})();
