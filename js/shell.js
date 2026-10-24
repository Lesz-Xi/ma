/* 間 Ma — shell core: the MA namespace + ctx contract (plan/shell-contract.md §3) */
(function () {
  'use strict';
  var MA = window.MA = window.MA || {};

  /* — reduced motion — */
  var reduced = {
    _q: window.matchMedia('(prefers-reduced-motion: reduce)'),
    _subs: [],
    now: function () { return this._q.matches; },
    onChange: function (fn) {
      this._subs.push(fn); fn(this._q.matches);
      var self = this;
      return function dispose() {
        var i = self._subs.indexOf(fn);
        if (i > -1) self._subs.splice(i, 1);
      };
    }
  };
  reduced._q.addEventListener('change', function () {
    document.documentElement.dataset.reduced = String(reduced._q.matches);
    reduced._subs.forEach(function (fn) { fn(reduced._q.matches); });
  });
  document.documentElement.dataset.reduced = String(reduced.now());
  MA.reduced = reduced;

  /* — frame: the single rAF scheduler, offscreen-paused — */
  var frame = (function () {
    var items = [], nextId = 1, raf = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        items.forEach(function (it) { if (it.root === e.target) it.visible = e.isIntersecting; });
      });
      schedule();
    }, { rootMargin: '10% 0px' });
    function schedule() {
      if (raf === null && !document.hidden && items.some(function(it){return it.visible;})) raf = requestAnimationFrame(loop);
    }
    function remove(id) {
      var it = items.find(function(item){return item.id === id;});
      if (!it) return;
      items = items.filter(function(item){return item.id !== id;});
      if (it.root && !items.some(function(item){return item.root === it.root;})) io.unobserve(it.root);
    }
    function loop(t) {
      raf = null;
      // Stable membership for this frame: removal cannot skip Lenis or run a peer twice.
      items.slice().forEach(function(it){
        if (it.visible && items.indexOf(it) !== -1) {
          try { it.fn(t); } catch (err) { console.error('[MA.frame]', err); remove(it.id); }
        }
      });
      schedule();
    }
    document.addEventListener('visibilitychange', function(){
      if (document.hidden && raf !== null) { cancelAnimationFrame(raf); raf = null; }
      else schedule();
    });
    return {
      add: function (fn, root) {
        // Global input/scroll work is never visibility-gated by a DOM surface.
        var it = { id: nextId++, fn: fn, root: root || null, visible: true };
        var existing = root && items.find(function(item){return item.root === root;});
        if (existing) it.visible = existing.visible;
        items.push(it);
        if (root && !existing) io.observe(root);
        schedule();return it.id;
      },
      remove: remove
    };
  })();
  MA.frame = frame;

  /* — pointer: shared bus, one listener total — */
  var pointer = (function () {
    var subs = [];
    var state = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
    window.addEventListener('pointermove', function (e) {
      var nx = e.clientX / window.innerWidth, ny = e.clientY / window.innerHeight;
      state.vx = nx - state.x; state.vy = ny - state.y;
      state.x = nx; state.y = ny;
      subs.forEach(function (s) {
        var r = s.root.getBoundingClientRect();
        var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (inside || s.wasInside) {
          s.fn({
            x: (e.clientX - r.left) / Math.max(r.width, 1),
            y: (e.clientY - r.top) / Math.max(r.height, 1),
            vx: state.vx, vy: state.vy, inside: inside, pointerType: e.pointerType,
            clientX: e.clientX, clientY: e.clientY, target: e.target, buttons: e.buttons
          });
        }
        s.wasInside = inside;
      });
    }, { passive: true });
    return {
      add: function (root, fn) { var s = { root: root, fn: fn, wasInside: false }; subs.push(s); return s; },
      remove: function (s) { var i = subs.indexOf(s); if (i > -1) subs.splice(i, 1); }
    };
  })();
  MA.pointer = pointer;

  /* — scroll: feather response; one authoritative position for all triggers — */
  var editionScore=window.MA_EDITION&&MA_EDITION.motion;
  var SCROLL_WEIGHT = .8; // XI Pro Feather: full-template default preserved.
  if(editionScore)SCROLL_WEIGHT=editionScore.scrollWeight;
  var scroll = { y: 0, progress: 0, _lenis: null };
  var scrollFrame = null, scrollSubscribers = [], nativeFrame = null, refreshFrame = null;
  function readScroll(y) {
    var changed = Math.abs(y-scroll.y) > .01;
    scroll.y = y;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    scroll.progress = max > 0 ? Math.min(y / max, 1) : 0;
    if (changed) notifyScroll();
  }
  function notifyScroll(){
    scrollSubscribers.slice().forEach(function(fn){try{fn(scroll);}catch(error){console.error('[MA.scroll subscriber]',error);}});
  }
  scroll.subscribe = function(fn){scrollSubscribers.push(fn);return function(){scrollSubscribers=scrollSubscribers.filter(function(f){return f!==fn;});};};
  // Navigation commits under the Rainfield veil. Synchronize native and smoothed
  // positions in the same frame; a stale Lenis target must not pull the page back.
  scroll.jump = function(y){
    y=Math.max(0,Math.min(y,Math.max(0,document.documentElement.scrollHeight-window.innerHeight)));
    if(scroll._lenis){
      try{scroll._lenis.resize();scroll._lenis.scrollTo(y,{immediate:true,force:true});}
      catch(error){
        var broken=scroll._lenis;scroll._lenis=null;
        if(scrollFrame!==null){frame.remove(scrollFrame);scrollFrame=null;}
        try{broken.destroy();}catch(ignored){}
        window.scrollTo({top:y,left:0,behavior:'instant'});
      }
    }else window.scrollTo({top:y,left:0,behavior:'instant'});
    readScroll(window.scrollY);notifyScroll();
  };
  // Lenis emits synchronously after setting scroll position. Triggers consume that
  // same frame, instead of waiting for a DOM scroll event and another animation frame.
  function nativeScroll(){
    if(scroll._lenis||nativeFrame!==null)return;
    nativeFrame=frame.add(function(){frame.remove(nativeFrame);nativeFrame=null;readScroll(window.scrollY);});
  }
  scroll.refresh = function(){
    if(refreshFrame!==null)return;
    refreshFrame=frame.add(function(){
      frame.remove(refreshFrame);refreshFrame=null;
      if(scroll._lenis)scroll._lenis.resize();
      readScroll(window.scrollY);notifyScroll();
    });
  };
  window.addEventListener('scroll', nativeScroll, { passive: true });
  window.addEventListener('resize',scroll.refresh,{passive:true});
  document.addEventListener('load',function(e){if(e.target.tagName==='IMG')scroll.refresh();},true);
  if(document.fonts)document.fonts.ready.then(scroll.refresh);
  reduced.onChange(function(isReduced){
    if (scrollFrame !== null) { frame.remove(scrollFrame); scrollFrame = null; }
    if (scroll._lenis) { scroll._lenis.destroy(); scroll._lenis = null; }
    if (window.Lenis && !isReduced) {
      scroll._lenis = new Lenis({ duration: SCROLL_WEIGHT, smoothWheel: true, syncTouch: false, autoRaf: false, anchors: false });
      scroll._lenis.on('scroll', function(e){readScroll(e.animatedScroll);});
      // Lenis integrates elapsed time. A demand-driven clock must not feed the
      // preceding idle gap into a fresh gesture and finish it in its first frame.
      var lenisTime=1;
      function wakeScroll(){
        if(scrollFrame!==null||!scroll._lenis)return;
        var lastTick=null;
        scrollFrame = frame.add(function(t){
        if(lastTick!==null)lenisTime+=Math.min(64,Math.max(0,t-lastTick));
        lastTick=t;
        try { scroll._lenis.raf(lenisTime); }
        catch (error) {
          // A broken smoothing clock must never leave its wheel interception alive.
          var broken = scroll._lenis;scroll._lenis = null;
          frame.remove(scrollFrame);scrollFrame = null;broken.destroy();
          console.warn('[MA.scroll] Native scrolling restored', error);
        }
        if(editionScore&&editionScore.frameOnDemand&&scroll._lenis&&!scroll._lenis.isScrolling){frame.remove(scrollFrame);scrollFrame=null;}
        });
      }
      // Input wakes Lenis; its own isScrolling state retires the public clock.
      // No independent animation loop and no work while the page has settled.
      if(editionScore&&editionScore.frameOnDemand)scroll._lenis.on('virtual-scroll',wakeScroll);
      wakeScroll();
    }
    readScroll(window.scrollY);
  });
  MA.scroll = scroll;

  /* — assets — */
  MA.assets = { url: function (name) { return 'assets/' + name; } };

  /* — chapters registry — */
  MA.chapters = (function () {
    var reg = {}, mounted = {};
    return {
      register: function (id, api) { reg[id] = api; },
      mount: function (id, root) {
        if (!root || mounted[id]) return;
        if (reg[id] && reg[id].mount) {
          try { mounted[id] = reg[id].mount(root, MA) || true; }
          catch (err) { console.error('[MA.chapters]', id, err); }
        }
      },
      unmount: function (id) {
        var root = document.getElementById(id);
        if (reg[id] && reg[id].unmount && root) {
          try { reg[id].unmount(root, MA); } catch (err) { console.error('[MA.chapters]', id, err); }
        }
        delete mounted[id];
      },
      _ctx: MA
    };
  })();

  /* — rail label; entry-water.js owns the one-shot arrival — */

  var railLabel = document.getElementById('ma-rail-label');
  var chapterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting && railLabel) {
        railLabel.style.opacity = '0';
        var label = e.target.getAttribute('data-rail');
        if (label === null) label = e.target.id; // Explicit empty label keeps the hero quiet.
        setTimeout(function () { railLabel.textContent = label; railLabel.style.opacity = '1'; }, 220);
      }
    });
  }, { threshold: 0.4 });
  var railObserved = [];
  MA.chapters.observeRail = function (root, label) {
    if (!railLabel || !root || railObserved.indexOf(root) > -1) return;
    railObserved.push(root);
    if (label !== null && label !== undefined) root.setAttribute('data-rail', label);
    chapterObserver.observe(root);
  };
})();
