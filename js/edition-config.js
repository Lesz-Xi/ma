window.MA_EDITION={"id":"public","title":"Ma \u2014 the space between","canonical":"https://www.odysxi.com/ma/","author":"XI","portfolio":"https://lesz25.com/","chapters":["ch01-arrival","ch02-philosophy","ch03-inspector","ch04-seasonal","ch06-vessels","ch07-spaces","ch12-passing","ch13-closer","ch11-about"],"font":{"selected":"Newsreader","reviewFace":"Newsreader","displayWeight":400,"descriptionFace":"Waiting for the Sunrise","descriptionApproved":true,"descriptionScope":"public chapter prose and captions","approved":true},"approvals":{"story":true,"browserRoute":true,"release":false},"motion":{"entryHold":0,"heroDuration":2200,"headingDuration":1100,"approachHeightVh":240,"naturalBelowWidth":900,"naturalBelowHeight":650,"navigationDuration":1800,"scrollWeight":0.8,"frameOnDemand":true,"artworkOnly":true,"textHover":false,"textHoverStrength":0.55,"pageClickRipples":true,"compositionDuration":1050,"rippleLetters":false,"navRippleLetters":true}};
/* A full refresh starts at Arrival. Ordinary links and history keep their destinations. */
(function () {
  'use strict';
  var navigation = window.performance && window.performance.getEntriesByType('navigation')[0];
  var reload = navigation ? navigation.type === 'reload' :
    window.performance && window.performance.navigation && window.performance.navigation.type === 1;
  if (!reload) return;
  var previous = history.scrollRestoration, done = false, ready = false, shown = false, settleFrame = null;
  function top() {
    if (done) return;
    if (window.MA && window.MA.scroll) window.MA.scroll.jump(0);
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
  function finish() {
    if (done) return;
    done = true;
    clearTimeout(deadline);
    if (settleFrame !== null) cancelAnimationFrame(settleFrame);
    document.removeEventListener('ma:ready', onReady);
    window.removeEventListener('pageshow', onShow);
    window.removeEventListener('pagehide', finish);
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (event) {
      window.removeEventListener(event, finish, true);
    });
    try { history.scrollRestoration = previous || 'auto'; } catch (_) {}
  }
  function settle() {
    if (done || !ready || !shown || settleFrame !== null) return;
    // Restoration can run after pageshow. Keep it manual through that turn.
    settleFrame = requestAnimationFrame(function () { top(); finish(); });
  }
  function onReady() { top(); ready = true; settle(); }
  function onShow() { top(); shown = true; settle(); }
  try {
    history.scrollRestoration = 'manual';
    // Replace the current entry, preserving query parameters and history state.
    if (location.hash) history.replaceState(history.state, '', location.href.split('#')[0]);
  } catch (_) { /* Native scrolling remains available if history is restricted. */ }
  top();
  document.addEventListener('ma:ready', onReady);
  window.addEventListener('pageshow', onShow);
  window.addEventListener('pagehide', finish);
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (event) {
    window.addEventListener(event, finish, { passive: true, capture: true });
  });
  var deadline = setTimeout(finish, 5500);
})();
