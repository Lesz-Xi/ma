/* Ma Waterline v2: native controls, delegated input, one demand-driven shared-frame job. */
(function(){
  'use strict';
  var MA=window.MA;if(!MA)return;
  if(MA.waterline)MA.waterline.dispose();
  var frame=null,pending=null,dead=false,clean=[];
  var contrast=window.matchMedia('(forced-colors: active)');
  function still(){return MA.reduced.now()||contrast.matches;}
  function target(node){return node&&node.closest?node.closest('[data-waterline]'):null;}
  function cancel(){if(frame!==null)MA.frame.remove(frame);frame=null;pending=null;}
  // Original Waterline geometry from XIDemos.waterControls.bind; shared Ma scheduler.
  function position(el,x){
    el.style.setProperty('--water-x',x+'%');
    var path=el.querySelector('[data-waterline-path]');
    if(path){var px=Math.max(14,Math.min(86,x));path.setAttribute('d','M0 16 C'+(px-24)+' 16 '+(px-10)+' 6 '+px+' 6 C'+(px+10)+' 6 '+(px+24)+' 16 100 16');}
  }
  function flush(){
    MA.frame.remove(frame);frame=null;
    var p=pending;pending=null;if(dead||still()||!p||!p.el.isConnected||p.el.disabled)return;
    var rect=p.el.getBoundingClientRect();position(p.el,Math.max(0,Math.min(100,(p.x-rect.left)/Math.max(1,rect.width)*100)));
  }
  function pointer(e){
    var el=target(e.target);if(!el||el.disabled||e.pointerType==='touch'||still())return;
    pending={el:el,x:e.clientX};if(frame===null)frame=MA.frame.add(flush);
  }
  function listen(el,event,fn){el.addEventListener(event,fn,{passive:true});clean.push(function(){el.removeEventListener(event,fn);});}
  listen(document,'pointerover',pointer);listen(document,'pointermove',pointer);
  listen(document,'focusin',function(e){var el=target(e.target);if(el)position(el,50);});
  listen(document,'visibilitychange',function(){if(document.hidden)cancel();});
  listen(contrast,'change',cancel);clean.push(MA.reduced.onChange(cancel));
  // Selection follows existing scroll state; this module never initiates or blocks scroll.
  var nav=Array.from(document.querySelectorAll('.ma-nav [data-waterline]'));
  function selection(){
    var active=null;
    nav.forEach(function(link){var section=document.getElementById(link.getAttribute('href').slice(1));if(section&&section.getBoundingClientRect().top<=window.innerHeight*.35)active=link;});
    nav.forEach(function(link){if(link===active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
  }
  clean.push(MA.scroll.subscribe(selection));selection();
  function dispose(){if(dead)return;dead=true;cancel();clean.forEach(function(f){f();});document.querySelectorAll('[data-waterline]').forEach(function(el){el.style.removeProperty('--water-x');});nav.forEach(function(el){el.removeAttribute('aria-current');});}
  MA.waterline={dispose:dispose};
})();
