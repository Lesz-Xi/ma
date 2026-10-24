/* Public Composition: progressive enhancement of the companion's third stem.
   Native buttons provide pointer, touch, Enter and Space with one activation path. */
(function () {
  'use strict';
  var MA=window.MA;if(!MA)return;
  var states=new WeakMap();
  MA.chapters.register('ch03',{
    mount:function(root,ctx){
      if(states.has(root))return states.get(root);
      var plate=root.querySelector('.ch03-plate'),drawing=root.querySelector('.ch03-drawn');
      var buttons=Array.from(root.querySelectorAll('.ch03-stem,.ch03-let-go'));
      var before=root.querySelector('.ch03-state--before'),after=root.querySelector('.ch03-state--after');
      var live=root.querySelector('.ch03-live'),third=root.querySelector('.ch03-third'),image=root.querySelector('.ch03-image');
      if(!plate||!drawing||buttons.length!==2||!before||!after||!third||!image)return;
      var done=plate.classList.contains('is-removed'),clean=[],timer=null,ready=false,dead=false,bound=false;
      var forced=matchMedia('(forced-colors: active)');
      function listen(el,event,fn){el.addEventListener(event,fn);clean.push(function(){el.removeEventListener(event,fn);});}
      function settle(){clearTimeout(timer);timer=null;third.style.visibility='hidden';plate.classList.remove('is-rippling');}
      function quiet(){return ctx.reduced.now()||forced.matches||document.hidden;}
      function remove(){
        if(done||!ready)return;done=true;
        plate.classList.add('is-removed');plate.classList.remove('is-stem-hovered');
        var keyboard=buttons.indexOf(document.activeElement)!==-1;
        before.hidden=true;after.hidden=false;
        buttons.forEach(function(button){button.disabled=true;button.hidden=true;});
        if(quiet())settle();else{
          plate.classList.add('is-rippling');
          timer=setTimeout(settle,window.MA_EDITION.motion.compositionDuration);
        }
        // Only transfer focus when its activated control is being removed.
        if(keyboard){after.tabIndex=-1;after.focus({preventScroll:true});}
        else if(live)live.textContent='The third stem is released. The bud and leaf now have room between them.';
      }
      function enhance(){
        if(dead||ready||!image.naturalWidth)return;ready=true;
        if(done)return;
        third.style.visibility='';
        drawing.hidden=false;drawing.removeAttribute('hidden');
        before.hidden=false;after.hidden=true;
        buttons.forEach(function(button){button.hidden=false;if(bound)return;listen(button,'click',remove);
          listen(button,'pointerenter',function(){if(!done&&!quiet())plate.classList.add('is-stem-hovered');});
          listen(button,'pointerleave',function(){plate.classList.remove('is-stem-hovered');});
        });
        bound=true;
        plate.classList.add('is-interactive');
      }
      // No orphan handle over a failed image. The completed composition's meaning remains.
      function failure(){ready=false;settle();before.hidden=true;after.hidden=false;drawing.setAttribute('hidden','');buttons.forEach(function(b){b.hidden=true;});}
      listen(image,'load',enhance);listen(image,'error',failure);
      listen(document,'visibilitychange',function(){if(document.hidden&&done)settle();});
      listen(forced,'change',function(){if(forced.matches&&done)settle();});
      clean.push(ctx.reduced.onChange(function(reduced){if(reduced&&done)settle();}));
      if(image.complete)enhance();
      var state={remove:remove,stats:function(){return{ready:ready,done:done,animating:timer!==null};},dispose:function(){
        dead=true;settle();clean.forEach(function(off){off();});failure();plate.classList.remove('is-interactive');states.delete(root);
      }};
      states.set(root,state);MA.signature=state;return state;
    },
    unmount:function(root){var state=states.get(root);if(state)state.dispose();}
  });
})();
