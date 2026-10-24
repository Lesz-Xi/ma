(function () {
  'use strict';
  var lens = null;
  MA.chapters.register('ch02', {
    mount: function (root, ctx) {
      var studies = root.querySelector('[data-image-lens]');
      if (studies && ctx.imageLens) lens = ctx.imageLens.attach(studies);
      ctx.chapters.observeRail(root, 'Approach');
      return { lens: lens };
    },
    unmount: function () { if (lens) lens.detach(); lens = null; }
  });
})();
