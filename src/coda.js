/* public/coda.js — the coda: 間, one still line, and the space around it.
 * About ends: "The water is a response to your attention. Once it has answered, it
 * becomes still." The coda lets the reader feel that once more, with nothing else
 * around it. The line is the water's surface. It never moves on its own or on scroll.
 * A cursor crossing it plucks it like a string, harder the faster; a click or, on a
 * phone, a tap near it plucks it once. It rings and comes back to rest, and when it is
 * still the clock stops.
 * Sound, on by default (the fūrin at the top right turns it off): each touch is a drop into a suikinkutsu (水琴窟),
 * the garden's water koto, a buried jar that rings when water falls into it. The pitch
 * rises along the line in hirajōshi, the koto's own tuning, so the line can be played.
 * Gesture after Annnimate's Elastic Divider (library slug `elastic-divider`): our own
 * mechanism (a damped string with fixed ends on MA.frame) and our own code; nothing copied.
 * Flags: ?coda-sound=koto (a plucked koto string on the same tuning) · ?coda-debug
 * (exposes MA.coda.pluck and an offline renderer for proofs).
 */
(function () {
  'use strict';
  var MA = window.MA, root = document.getElementById('ma-coda');
  if (!MA || !MA.frame || !MA.pointer || !MA.reduced || !root) return;
  var svg = root.querySelector('.ma-coda-line'), path = svg && svg.querySelector('path');
  if (!path) return;
  var forced = matchMedia('(forced-colors: active)'), debug = /[?&]coda-debug\b/.test(location.search);
  var KIND = /[?&]coda-sound=koto\b/.test(location.search) ? 'koto' : 'suikin';
  // The string lives in index space (N segments), so it rings alike at every width.
  var N = 96, y = new Float64Array(N + 1), v = new Float64Array(N + 1), a = new Float64Array(N + 1);
  var TENSION = 18000;  // (segments/s)²: fundamental ≈ .7 Hz, a ripple crosses in about .7 s
  var DAMP = 4.2;       // the whole string rests in about 2.5 s
  var SOFT = 24;        // Kelvin–Voigt: fine ripples die first, the long swell last
  var SUB = 10, PRESS = .06; // a pluck eases in over 60 ms: a fingertip, not a blow
  var W = 1000, H = 96, mid = 48, MAXA = 34, job = null, last = 0, near = true;
  var prev = null, tap = null, presses = [], stats = { plucks: 0, frames: 0, settles: 0, maxAmp: 0 };

  /* — Sound — */
  // Hirajōshi on D (D · E♭ · G · A · B♭), ten notes rising from left to right.
  var HIRA = [0, 1, 5, 7, 8];
  function tuning(lowest) {
    var out = [], m = lowest - 1;
    while (out.length < 10) { m++; if (HIRA.indexOf(((m - 62) % 12 + 12) % 12) > -1) out.push(440 * Math.pow(2, (m - 69) / 12)); }
    return out;
  }
  function seeded(s) { return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  /* The space a voice rings in: a few close reflections (the jar's walls, or a room),
   * then a soft diffuse tail. Generated, so nothing is downloaded. */
  function space(ctx, secs, t60, early) {
    var sr = ctx.sampleRate, len = Math.floor(sr * secs), ir = ctx.createBuffer(2, len, sr);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch), rnd = seeded(ch ? 977 : 131), lp = 0;
      for (var i = 0; i < len; i++) { lp += (rnd() * 2 - 1 - lp) * .45; d[i] = lp * Math.exp(-6.91 * i / sr / t60); }
      early.forEach(function (e) { var k = Math.floor(e[0] * sr) + ch * 5; if (k < len) d[k] += e[1] * (ch ? -1 : 1); });
    }
    return ir;
  }
  // Suikinkutsu: a faint drip as the drop meets the water, then the jar's tone, its
  // fundamental beating slowly against a near twin, the upper partials fading first.
  var JAR = [[1, 1, 2.8], [1.0035, .45, 2.5], [2.01, .16, 1.1], [3.03, .07, .55], [4.17, .035, .28]];
  function drop(ctx, out, t, hz, vel) {
    var k = Math.pow(600 / hz, .3), oscs = [], end = t + .06;
    var d = ctx.createOscillator(), dg = ctx.createGain();
    d.frequency.setValueAtTime(hz * 2.2, t); d.frequency.exponentialRampToValueAtTime(hz * 3.3, t + .028);
    dg.gain.setValueAtTime(0, t); dg.gain.linearRampToValueAtTime(.05 * vel, t + .002); dg.gain.exponentialRampToValueAtTime(.0001, t + .045);
    d.connect(dg); dg.connect(out); d.start(t); d.stop(end); oscs.push(d);
    JAR.forEach(function (r) {
      var o = ctx.createOscillator(), g = ctx.createGain(), dec = r[2] * k * (.8 + .2 * vel), t0 = t + .012;
      o.frequency.value = hz * r[0];
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(r[1], t0 + .008); g.gain.exponentialRampToValueAtTime(.0001, t0 + .008 + dec);
      o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + .04 + dec);
      end = Math.max(end, t0 + .04 + dec); oscs.push(o);
    });
    return { oscs: oscs, end: end };
  }
  // Koto: a plucked string (Karplus–Strong), excited near the bridge as a tsume pick
  // would, with a lower note ringing longer. One buffer per note, made on first use.
  function string(ctx, hz) {
    var sr = ctx.sampleRate, len = Math.floor(sr * 3), buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
    var P = sr / hz, D = P - .5, Di = Math.floor(D), fr = D - Di, rho = Math.pow(.001, 1 / (hz * 2.6 * Math.pow(196 / hz, .45)));
    var rnd = seeded(Math.round(hz * 10)), n0 = Math.round(P), cut = Math.max(1, Math.round(P * .13)), exc = new Float32Array(n0), lp = 0, i, peak = 0;
    for (i = 0; i < n0; i++) { lp += (rnd() * 2 - 1 - lp) * .6; exc[i] = lp; }
    for (i = 0; i < len; i++) {
      var x = i < n0 ? exc[i] - (i >= cut ? exc[i - cut] : 0) : 0, j = i - Di;
      var ya = j >= 0 ? out[j] : 0, yb = j >= 1 ? out[j - 1] : 0, yc = j >= 2 ? out[j - 2] : 0;
      out[i] = x + rho * .5 * ((1 - fr) * ya + fr * yb + (1 - fr) * yb + fr * yc);
      peak = Math.max(peak, Math.abs(out[i]));
    }
    for (i = 0; i < len; i++) out[i] *= .8 / (peak || 1);
    return buf;
  }
  function instrument(kind, ctx) {
    var cache = {};
    return kind === 'koto' ? {
      kind: kind, notes: tuning(55), level: 1.8, // G3 … E♭5, the koto's own register
      strike: function (out, t, hz, vel) {
        var src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
        src.buffer = cache[hz] || (cache[hz] = string(ctx, hz));
        f.type = 'lowpass'; f.frequency.value = 1800 + 4200 * vel; f.Q.value = .5; // harder is brighter
        src.connect(f); f.connect(out); src.start(t);
        return { oscs: [src], end: t + src.buffer.duration };
      }
    } : {
      kind: kind, notes: tuning(67), level: .8, // G4 … E♭6, where a buried jar sings
      strike: function (out, t, hz, vel) { return drop(ctx, out, t, hz, vel); }
    };
  }
  function bus(ctx, kind) {
    var master = ctx.createGain(), comp = ctx.createDynamicsCompressor(), wet = ctx.createConvolver(), send = ctx.createGain();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .002; comp.release.value = .2;
    wet.buffer = kind === 'koto' ? space(ctx, 1.8, 1.4, [[.011, .3], [.019, .2]])
      : space(ctx, 2.8, 2.4, [[.004, .5], [.009, .35], [.015, .25], [.022, .18]]);
    send.gain.value = kind === 'koto' ? .22 : .5;
    send.connect(wet); wet.connect(master); master.connect(comp); comp.connect(ctx.destination);
    return { master: master, send: send };
  }
  function voiceInto(ctx, b, ins, t, i, vel, pan) {
    var out = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    out.gain.value = (.05 + .25 * vel) * ins.level;
    if (p) { p.pan.value = pan; out.connect(p); p.connect(b.master); p.connect(b.send); }
    else { out.connect(b.master); out.connect(b.send); }
    var vc = ins.strike(out, t, ins.notes[i], vel);
    vc.out = out;
    return vc;
  }
  /* Sound is on by default (Chief, 19 October: a dated exception to the house rule of
   * off by default). Browsers let a page sound only after the visitor's first click, tap
   * or key, so the wish (`pref`) and the running context are kept apart: the context is
   * created and resumed inside the first such gesture anywhere on the page, and a touch on
   * the line that arrives while it wakes is heard as soon as it answers. Hover alone cannot
   * wake it. Choosing quiet is remembered on this device. */
  function makeSound(kind, pref) {
    var AC = window.AudioContext || window.webkitAudioContext, ac = null, b = null, ins = null, UA = navigator.userActivation;
    var voices = [], lastAt = -1, notes = 0, lastNote = null, rest = null;
    function ensure() {
      if (ac || !AC) return;
      // Ambient where supported: it mixes with the visitor's own audio and keeps to the silent switch.
      try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* optional */ }
      ac = new AC(); b = bus(ac, kind); b.master.gain.value = pref ? .9 : 0; ins = instrument(kind, ac);
    }
    function running() { return pref && !!ac && ac.state === 'running'; }
    // Each call asks again (resume is idempotent), so a request made outside a gesture can
    // never stand in for the one made inside it.
    function wake() {
      if (!pref || !AC) return Promise.resolve(false);
      ensure();
      if (ac.state === 'running') return Promise.resolve(true);
      return ac.resume().then(function () { return !!ac && ac.state === 'running'; }, function () { return false; });
    }
    function retire(vc, t) {
      vc.out.gain.cancelScheduledValues(t); vc.out.gain.setTargetAtTime(0, t, .012);
      vc.oscs.forEach(function (o) { try { o.stop(t + .08); } catch (e) { /* already stopped */ } });
    }
    function now(at, vel) {
      var t = ac.currentTime;
      if (t - lastAt < .05) return false; // a trembling hand is one drop, not a hail
      lastAt = t;
      var i = Math.max(0, Math.min(9, Math.floor(at * 10))), vc = voiceInto(ac, b, ins, t + .005, i, vel, (at * 2 - 1) * .45), left = vc.oscs.length;
      vc.oscs.forEach(function (o) { o.onended = function () { if (--left) return; vc.out.disconnect(); var k = voices.indexOf(vc); if (k > -1) voices.splice(k, 1); }; });
      voices.push(vc); notes++;
      lastNote = { index: i, hz: Math.round(ins.notes[i] * 10) / 10, vel: Math.round(vel * 100) / 100 };
      while (voices.length > 8) retire(voices.shift(), t);
      return true;
    }
    return {
      available: function () { return !!AC; },
      on: running,
      wanted: function () { return pref && !!AC; },
      wake: wake,
      /* From the bell's own click (a gesture): resolves to whether sound is really running. */
      set: function (want) {
        pref = want;
        clearTimeout(rest);
        if (ac) { var t = ac.currentTime; b.master.gain.cancelScheduledValues(t); b.master.gain.setTargetAtTime(want ? .9 : 0, t, .03); }
        if (!want) { rest = setTimeout(function () { if (!pref && ac && ac.state === 'running') ac.suspend(); }, 400); return Promise.resolve(false); }
        return wake();
      },
      play: function (at, vel) {
        if (!pref || !AC) return false;
        if (ac && ac.state === 'running') return now(at, vel);
        if (UA && !UA.hasBeenActive) return false; // hover before any click, tap or key: silent, nothing created
        var asked = performance.now();
        wake().then(function (ok) { if (ok && performance.now() - asked < 500) now(at, vel); }); // later than that, it no longer belongs to the touch
        return false;
      },
      stats: function () { return { available: !!AC, kind: kind, wanted: pref, on: running(), state: ac ? ac.state : null, notes: notes, voices: voices.length, last: lastNote, tuning: tuning(kind === 'koto' ? 55 : 67).map(function (f) { return Math.round(f * 10) / 10; }) }; },
      dispose: function () { pref = false; clearTimeout(rest); if (ac) { try { ac.close(); } catch (e) { /* closing is best-effort */ } } ac = null; b = null; voices.length = 0; }
    };
  }
  var STORE = 'ma-coda-sound', quiet = false;
  try { quiet = localStorage.getItem(STORE) === 'off'; } catch (e) { /* storage may be blocked */ }
  var sound = makeSound(KIND, !quiet);

  /* — The line — */
  function allowed() { return near && !MA.reduced.now() && !forced.matches; }
  // Touch is answered when the line may move or sound is wanted: with reduced motion and
  // sound on, the drop is heard and the line stays still.
  function live() { return near && (allowed() || sound.wanted()); }
  function measure() {
    var r = svg.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); mid = H / 2; MAXA = Math.min(34, H * .42);
    svg.setAttribute('viewBox', '0 0 ' + W.toFixed(1) + ' ' + H.toFixed(1));
    draw();
  }
  function draw() {
    var step = W / N, d = 'M0 ' + mid.toFixed(2);
    for (var i = 1; i <= N; i++) d += ' L' + (i * step).toFixed(1) + ' ' + (mid + y[i]).toFixed(2);
    path.setAttribute('d', d);
  }
  function rest() { y.fill(0); v.fill(0); presses = []; draw(); halt(); }
  /* A pluck draws the line aside by `amp` px at x px along it, eased in over PRESS, then
   * lets it go: the dip splits into two ripples that run to the ends and back. */
  function pluck(x, amp) {
    if (!allowed() || !isFinite(amp) || !amp) return;
    var s = Math.max(2, Math.min(90, Math.max(24, W * .06)) / (W / N));
    presses.push({ c: Math.max(1, Math.min(N - 1, x / W * N)), s: s, amp: Math.max(-MAXA * .85, Math.min(MAXA * .85, amp)), t: 0, e: 0 });
    stats.plucks++; run();
  }
  /* One touch: heard (if sound is on) where it fell, as loud as it was hard, and seen. */
  function strike(x, amp) {
    sound.play(Math.max(0, Math.min(1, x / W)), Math.max(.15, Math.min(1, Math.abs(amp) / (MAXA * .85))));
    pluck(x, amp);
  }
  function ease(t) { return t >= 1 ? 1 : t * t * (3 - 2 * t); }
  function tick(time) {
    var dt = last ? Math.min(1 / 30, (time - last) / 1000) : 1 / 60, h = dt / SUB, i, s, peak = 0, speed = 0;
    last = time; stats.frames++;
    for (s = 0; s < SUB; s++) {
      for (var q = presses.length - 1; q >= 0; q--) {
        var pr = presses[q], e = ease((pr.t += h) / PRESS), de = (e - pr.e) * pr.amp; pr.e = e;
        for (i = 1; i < N; i++) { var k = (i - pr.c) / pr.s; y[i] += de * Math.exp(-.5 * k * k); }
        if (e >= 1) presses.splice(q, 1);
      }
      for (i = 1; i < N; i++) a[i] = TENSION * (y[i - 1] - 2 * y[i] + y[i + 1]) + SOFT * (v[i - 1] - 2 * v[i] + v[i + 1]) - DAMP * v[i];
      for (i = 1; i < N; i++) {
        v[i] += a[i] * h; y[i] += v[i] * h;
        if (y[i] > MAXA) { y[i] = MAXA; v[i] *= -.25; } else if (y[i] < -MAXA) { y[i] = -MAXA; v[i] *= -.25; }
      }
    }
    for (i = 1; i < N; i++) { peak = Math.max(peak, Math.abs(y[i])); speed = Math.max(speed, Math.abs(v[i])); }
    stats.maxAmp = Math.max(stats.maxAmp, peak);
    if (!presses.length && peak < .12 && speed < 1.5) { rest(); stats.settles++; return; } // still: the clock stops
    draw();
  }
  function run() { if (job === null) { last = 0; job = MA.frame.add(tick, root); } }
  function halt() { if (job !== null) { MA.frame.remove(job); job = null; } }

  /* A cursor crossing the line plucks it where it crossed, the way it went, harder the
   * faster. Moving near it without crossing leaves it alone. */
  var sub = MA.pointer.add(root, function (p) {
    if (p.pointerType !== 'mouse' || !live()) { prev = null; return; }
    var r = svg.getBoundingClientRect(), x = p.clientX - r.left, dyl = p.clientY - (r.top + mid), now = performance.now();
    if (!p.inside || x < 0 || x > W) { prev = null; return; }
    if (prev) {
      var dt = Math.max(.008, (now - prev.t) / 1000), vy = (p.clientY - prev.y) / dt;
      if ((prev.dy < 0) !== (dyl < 0)) { // a sample exactly on the line counts as below it
        var f = prev.dy === dyl ? 0 : prev.dy / (prev.dy - dyl), xc = prev.x - r.left + (p.clientX - prev.x) * f;
        strike(xc, (vy < 0 ? -1 : 1) * (3 + Math.min(2400, Math.abs(vy)) * .02));
      }
    }
    prev = { x: p.clientX, y: p.clientY, dy: dyl, t: now };
  });
  /* A click near the line plucks it at once; a tap (quick, still) plucks it on lift, so a
   * finger that lands here to scroll the page leaves it alone. */
  function nearLine(e) {
    var r = svg.getBoundingClientRect(), x = e.clientX - r.left, dyl = e.clientY - (r.top + mid);
    return x >= 0 && x <= W && Math.abs(dyl) <= 56 ? { x: x, dir: dyl < 0 ? 1 : -1 } : null;
  }
  function down(e) {
    if (e.button > 0 || !live() || (e.target.closest && e.target.closest('button'))) return;
    var hit = nearLine(e);
    if (!hit) return;
    if (e.pointerType === 'mouse') strike(hit.x, hit.dir * 18);
    else tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  }
  function up(e) {
    if (!tap || e.pointerId !== tap.id) return;
    var still = Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 10 && performance.now() - tap.t < 350, hit = nearLine(e);
    tap = null;
    if (still && hit && live()) strike(hit.x, hit.dir * 18);
  }
  function cancel() { tap = null; }
  root.addEventListener('pointerdown', down, { passive: true });
  root.addEventListener('pointerup', up, { passive: true });
  root.addEventListener('pointercancel', cancel, { passive: true });

  /* The first click, tap or key anywhere on the page wakes the sound, inside that gesture
   * (a finger counts when it lifts: touchstart is not yet a gesture). */
  function wakeOnGesture() {
    var u = navigator.userActivation;
    if (sound.wanted() && !sound.on() && (!u || u.isActive)) sound.wake();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { document.addEventListener(t, wakeOnGesture, { capture: true, passive: true }); });

  /* The fūrin, named "Sound", turns it off and on. Turning it on has a receipt: one drop at
   * the middle of the line, heard and seen, once the context is really running. */
  var btn = root.querySelector('.ma-coda-sound'), hint = root.querySelector('.ma-coda-hint'), pending = false;
  function show(on) {
    btn.setAttribute('aria-pressed', String(on)); btn.title = on ? 'Sound on' : 'Sound off';
    if (hint) hint.lastElementChild.textContent = on ? 'the sound off' : 'the sound on'; // "the bell turns" holds
  }
  function onSound() {
    if (pending) return;
    pending = true; hideHint();
    var want = btn.getAttribute('aria-pressed') !== 'true';
    try { if (want) localStorage.removeItem(STORE); else localStorage.setItem(STORE, 'off'); } catch (e) { /* storage may be blocked */ }
    sound.set(want).then(function (on) {
      pending = false;
      show(want); // the wish shows at once; a refused context still waits for a gesture
      if (on) { sound.play(.5, .45); pluck(W / 2, 8); }
    });
  }
  if (btn) {
    btn.hidden = false; // it means nothing without this script, so it waits for it
    if (!sound.available()) { btn.disabled = true; btn.setAttribute('aria-label', 'No audio here'); btn.title = 'No audio here'; btn.setAttribute('aria-pressed', 'false'); hint = null; }
    else { show(!quiet); btn.addEventListener('click', onSound); }
  }
  /* The hint: as the section arrives, a few handwritten words under the bell say what it
   * does, then fade, and the bell is wordless again. Once per arrival: it waits until the
   * section has left the view before it can speak again. */
  var hintTimer = null, hintReady = true;
  function hideHint() { clearTimeout(hintTimer); if (hint) hint.classList.remove('is-shown'); }
  function showHint() {
    if (!hint || !hintReady) return;
    hintReady = false; hint.hidden = false;
    void hint.offsetWidth; // start from the hidden state so the words rise in
    hint.classList.add('is-shown');
    clearTimeout(hintTimer); hintTimer = setTimeout(hideHint, 4800);
  }
  var hio = hint ? new IntersectionObserver(function (records) {
    var r = records[records.length - 1];
    if (r.intersectionRatio >= .6) showHint();
    else if (!r.isIntersecting) { hideHint(); hintReady = true; }
  }, { threshold: [0, .6] }) : null;
  if (hio) hio.observe(root);

  /* Out of view it is simply still again; it never resumes a ring on the way back. */
  var io = new IntersectionObserver(function (records) {
    near = records[records.length - 1].isIntersecting;
    if (!near) { prev = null; tap = null; rest(); }
    // Arriving after the page has been touched, the sound wakes now, so the first crossing is heard on time.
    else if (sound.wanted() && !sound.on() && navigator.userActivation && navigator.userActivation.hasBeenActive) sound.wake();
  });
  io.observe(root);
  var ro = window.ResizeObserver ? new ResizeObserver(measure) : null;
  if (ro) ro.observe(svg); else window.addEventListener('resize', measure);
  var offReduced = MA.reduced.onChange(function (r) { if (r) rest(); });

  MA.coda = {
    stats: function () {
      var peak = 0; for (var i = 1; i < N; i++) peak = Math.max(peak, Math.abs(y[i]));
      return { running: job !== null, plucks: stats.plucks, frames: stats.frames, settles: stats.settles, amp: Math.round(peak * 100) / 100, maxAmp: Math.round(stats.maxAmp * 100) / 100, width: Math.round(W) };
    },
    shape: function () { return Array.prototype.slice.call(y); },
    sound: sound.stats,
    dispose: function () {
      rest(); sound.dispose(); hideHint(); MA.pointer.remove(sub); io.disconnect(); if (hio) hio.disconnect(); if (ro) ro.disconnect(); offReduced();
      ['pointerdown', 'keydown', 'touchend'].forEach(function (t) { document.removeEventListener(t, wakeOnGesture, { capture: true }); });
      root.removeEventListener('pointerdown', down); root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', cancel);
      if (btn) btn.removeEventListener('click', onSound);
    }
  };
  if (debug) {
    MA.coda.pluck = pluck;
    /* Renders strikes offline with the same voice: [{ t, i, vel, pan }] → AudioBuffer. */
    MA.coda.render = function (kind, events, secs) {
      var O = window.OfflineAudioContext || window.webkitOfflineAudioContext, ctx = new O(2, Math.ceil(44100 * secs), 44100), b = bus(ctx, kind), ins = instrument(kind, ctx);
      b.master.gain.value = .9;
      events.forEach(function (e) { voiceInto(ctx, b, ins, e.t, e.i, e.vel, e.pan || 0); });
      return ctx.startRendering();
    };
  }
  measure();
})();
