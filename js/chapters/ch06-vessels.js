/* ch06-vessels · local progressive enhancement; no rAF, globals, scroll or ctx subscriptions. */
(function () {
  'use strict';
  var instances = new WeakMap();
  var ma = window.MA;
  if (!ma || !ma.chapters) return;

  function snapshot(node, names) {
    var values = names.map(function (name) { return [name, node.getAttribute(name)]; });
    return function () {
      values.forEach(function (pair) {
        if (pair[1] === null) node.removeAttribute(pair[0]);
        else node.setAttribute(pair[0], pair[1]);
      });
    };
  }

  ma.chapters.register('ch06', {
    mount: function (root) {
      if (instances.has(root)) return instances.get(root);
      var controls = root.querySelector('[data-vessel-controls]');
      var status = root.querySelector('[data-vessel-status]');
      var buttons = Array.from(root.querySelectorAll('[data-vessel-choice]'));
      var panels = Array.from(root.querySelectorAll('[data-vessel-panel]'));
      if (!controls || !status || buttons.length !== 3 || panels.length !== 3) return null;
      if (!buttons.every(function (button) {
        return panels.some(function (panel) { return panel.getAttribute('data-vessel-panel') === button.getAttribute('data-vessel-choice'); });
      })) return null;

      var restore = [snapshot(root, ['data-vessels-ready']), snapshot(controls, ['hidden'])];
      var cleanup = [];
      var statusBefore = status.textContent;
      var active = 0;
      buttons.forEach(function (button) { restore.push(snapshot(button, ['aria-selected', 'tabindex'])); });
      panels.forEach(function (panel) { restore.push(snapshot(panel, ['hidden', 'role', 'aria-labelledby', 'tabindex'])); });

      function select(index, focus, announce) {
        active = index;
        var choice = buttons[index].getAttribute('data-vessel-choice');
        buttons.forEach(function (button, i) {
          button.setAttribute('aria-selected', String(i === index));
          button.setAttribute('tabindex', i === index ? '0' : '-1');
        });
        panels.forEach(function (panel) {
          var selected = panel.getAttribute('data-vessel-panel') === choice;
          panel.hidden = !selected;
          panel.setAttribute('role', 'tabpanel');
          panel.setAttribute('tabindex', '0');
          panel.setAttribute('aria-labelledby', 'ch06-tab-' + panel.getAttribute('data-vessel-panel'));
        });
        if (focus) buttons[index].focus();
        if (announce) status.textContent = (buttons[index].getAttribute('aria-label') || buttons[index].textContent).replace(/\s+/g, ' ').trim() + ' study selected.';
      }
      function onClick(event) {
        var button = event.target instanceof Element ? event.target.closest('[data-vessel-choice]') : null;
        var index = buttons.indexOf(button);
        if (index >= 0) select(index, false, true);
      }
      function onKey(event) {
        if (buttons.indexOf(event.target) < 0) return;
        var index = active;
        if (event.key === 'ArrowRight') index = (active + 1) % buttons.length;
        else if (event.key === 'ArrowLeft') index = (active + buttons.length - 1) % buttons.length;
        else if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = buttons.length - 1;
        else return;
        event.preventDefault();
        select(index, true, true);
      }
      controls.addEventListener('click', onClick);
      controls.addEventListener('keydown', onKey);
      cleanup.push(function () {
        controls.removeEventListener('click', onClick);
        controls.removeEventListener('keydown', onKey);
      });

      panels.forEach(function (panel) {
        var image = panel.querySelector('img');
        var fallback = panel.querySelector('[data-media-fallback]');
        if (!image || !fallback) return;
        restore.push(snapshot(fallback, ['hidden']));
        function loaded() { fallback.hidden = image.naturalWidth > 0; }
        function failed() { fallback.hidden = false; }
        image.addEventListener('load', loaded);
        image.addEventListener('error', failed);
        cleanup.push(function () { image.removeEventListener('load', loaded); image.removeEventListener('error', failed); });
        if (image.complete) loaded();
      });
      root.setAttribute('data-vessels-ready', 'true');
      controls.hidden = false;
      select(0, false, false);

      var state = {
        dispose: function () {
          cleanup.forEach(function (fn) { fn(); });
          restore.forEach(function (fn) { fn(); });
          status.textContent = statusBefore;
          instances.delete(root);
        }
      };
      instances.set(root, state);
      return state;
    },
    unmount: function (root) {
      var state = instances.get(root);
      if (state) state.dispose();
    }
  });
})();
