/* Whole → detail → whole. A native control changes one source image's framing.
 * CSS owns the finite transform; existing water owns only its stationary wrapper. */
(function(){
 'use strict';
 var MA=window.MA;if(!MA)return;
 function attach(root){
  if(root.__maCloser)return root.__maCloser;
  var image=root.querySelector('.ma-close-image'),button=root.querySelector('button'),note=root.querySelector('.ma-close-failure');
  var whole=root.querySelector('[data-close-label="whole"]'),detail=root.querySelector('[data-close-label="detail"]');
  var wholeCaption=root.querySelector('[data-close-caption="whole"]'),detailCaption=root.querySelector('[data-close-caption="detail"]');
  var forced=matchMedia('(forced-colors:active)'),dead=false,close=false,ready=false,timer=null,clean=[];
  var alt=image.getAttribute('alt');
  function waterReset(){if(MA.water)MA.water.reset();}
  function finish(){if(timer!==null)clearTimeout(timer);timer=null;root.classList.remove('is-framing');waterReset();}
  function labels(){button.setAttribute('aria-pressed',String(close));whole.hidden=close;detail.hidden=!close;wholeCaption.hidden=close;detailCaption.hidden=!close;image.setAttribute('alt',close?'A closer framing of the same Spring study, showing the white blossom and its gold centre.':alt);}
  function toggle(){
   if(dead||!ready)return;
   waterReset();if(timer!==null)clearTimeout(timer);timer=null;
   var animate=!MA.reduced.now()&&!forced.matches&&!document.hidden;
   root.classList.toggle('is-framing',animate);close=!close;root.classList.toggle('is-close',close);labels();
   // A bounded fail-safe for missing transitionend or an interrupted compositor.
   if(animate)timer=setTimeout(finish,760);else finish();
  }
  function loaded(){if(dead)return;ready=image.complete&&image.naturalWidth>0;button.hidden=!ready;if(ready)note.hidden=true;}
  function failed(){if(dead)return;ready=false;close=false;button.hidden=true;note.hidden=false;root.classList.remove('is-close');finish();labels();}
  function listen(el,event,fn){el.addEventListener(event,fn);clean.push(function(){el.removeEventListener(event,fn);});}
  listen(button,'click',toggle);listen(image,'load',loaded);listen(image,'error',failed);
  listen(image,'transitionend',function(e){if(e.propertyName==='transform')finish();});
  listen(document,'visibilitychange',function(){if(document.hidden)finish();});listen(forced,'change',function(){if(forced.matches)finish();});
  clean.push(MA.reduced.onChange(function(reduced){if(reduced)finish();}));
  // An offscreen section never keeps a pending framing cleanup alive.
  var io=new IntersectionObserver(function(rows){if(rows[0].isIntersecting){image.loading='eager';}else finish();});io.observe(root);
  if(image.complete){if(image.naturalWidth)loaded();else failed();}
  var api={stats:function(){return{ready:ready,close:close,framing:root.classList.contains('is-framing'),pending:timer!==null};},dispose:function(){dead=true;finish();clean.forEach(function(f){f();});io.disconnect();close=false;root.classList.remove('is-close');labels();button.hidden=true;delete root.__maCloser;}};
  root.__maCloser=api;return api;
 }
 MA.endingCloser={attach:attach};var instance=null;
 MA.chapters.register('ch13',{mount:function(root){instance=attach(root);return instance;},unmount:function(){if(instance)instance.dispose();instance=null;}});
})();
