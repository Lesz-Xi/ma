/* Ma — original XI Reed. Exact tip, bounded lean; shared input and frame owners. */
(function(){
  'use strict';
  var MA=window.MA;
  if(!MA||!MA.pointer||!MA.frame)return;
  var fine=matchMedia('(hover:hover) and (pointer:fine) and (min-width:900px)'),contrast=matchMedia('(forced-colors:active)');
  var cursor=document.createElement('div');cursor.className='ma-reed-cursor';cursor.setAttribute('aria-hidden','true');
  cursor.innerHTML='<svg width="32" height="32" viewBox="0 0 32 32"><g class="ma-reed-lean"><path class="ma-reed-form" d="M16 16 Q20 20 20 28 Q17 27 16 16Z" fill="currentColor"/></g></svg>';
  document.body.appendChild(cursor);
  var point=null,lastPointer=null,refreshJob=null,dead=false,lean=0,targeting=false,pressed=false;
  var protectedTargets='input,textarea,select,[contenteditable]';
  function allowed(){return !dead&&fine.matches&&!contrast.matches&&!MA.reduced.now()&&!document.hidden;}
  function state(name,on){if(on)cursor.classList.add(name);else cursor.classList.remove(name);}
  function hide(){
    if(refreshJob!==null)MA.frame.remove(refreshJob);refreshJob=null;
    point=null;lastPointer=null;lean=0;targeting=pressed=false;
    cursor.style.setProperty('--reed-angle','0deg');
    state('is-visible',false);state('is-target',false);state('is-pressed',false);
    document.documentElement.classList.remove('ma-reed-active');
    // Cursor visibility never clears the separate water wake or click ripples.
  }
  function target(p){
    var el=p.target;
    if(el.closest('[data-cursor-card],a,button,[role="button"],[role="tab"],label'))return true;
    var text=el.closest('h1,h2,h3,h4,h5,h6,p,figcaption,dt,dd,li');if(!text)return false;
    var range=document.createRange();range.selectNodeContents(text);
    return Array.from(range.getClientRects()).some(function(r){return p.clientX>=r.left-2&&p.clientX<=r.right+2&&p.clientY>=r.top-2&&p.clientY<=r.bottom+2;});
  }
  function update(p,moving){
    if(!allowed()||!p.inside||p.pointerType==='touch'||!p.target||document.activeElement.matches(protectedTargets)||String(getSelection())){hide();return;}
    if(p.target.closest(protectedTargets)){hide();lastPointer=p;return;}
    if(point&&moving){
      var dx=p.clientX-point.x,dy=p.clientY-point.y,n=Math.hypot(dx,dy);
      if(n>.5){lean=dx/n*-16;cursor.style.setProperty('--reed-angle',lean.toFixed(1)+'deg');}
    }
    point={x:p.clientX,y:p.clientY};lastPointer=p;targeting=target(p);pressed=!!(p.buttons&1);
    cursor.style.transform='translate3d('+(point.x-16)+'px,'+(point.y-16)+'px,0)';
    state('is-visible',true);state('is-target',targeting);state('is-pressed',pressed);
    document.documentElement.classList.add('ma-reed-active');
  }
  var subscription=MA.pointer.add(document.documentElement,function(p){update(p,true);});
  function onScroll(){
    if(!lastPointer||refreshJob!==null)return;
    refreshJob=MA.frame.add(function(){
      MA.frame.remove(refreshJob);refreshJob=null;if(!lastPointer)return;
      update(Object.assign({},lastPointer,{target:document.elementFromPoint(lastPointer.clientX,lastPointer.clientY)}),false);
    });
  }
  var listeners=[];
  function listen(el,name,fn,options){el.addEventListener(name,fn,options);listeners.push(function(){el.removeEventListener(name,fn,options);});}
  listen(window,'scroll',onScroll,{passive:true});listen(window,'resize',hide);listen(window,'blur',hide);
  listen(window,'pointerdown',function(e){
    if(e.button!==0||(e.target&&e.target.closest(protectedTargets))){hide();return;}
    if(allowed()&&point){pressed=true;state('is-pressed',true);if(lastPointer)lastPointer=Object.assign({},lastPointer,{buttons:1});}
  },{passive:true});
  listen(window,'pointerup',function(){pressed=false;state('is-pressed',false);if(lastPointer)lastPointer=Object.assign({},lastPointer,{buttons:0});},{passive:true});
  listen(window,'pointercancel',hide);listen(window,'keydown',hide);
  listen(document,'focusin',function(e){if(e.target&&e.target.closest(protectedTargets))hide();});
  listen(document,'visibilitychange',hide);listen(document.documentElement,'pointerleave',hide);
  listen(document,'selectionchange',function(){if(String(getSelection()))hide();});
  listen(fine,'change',hide);listen(contrast,'change',hide);
  var unsubscribe=MA.reduced.onChange(hide);
  MA.reedCursor={stats:function(){return{visible:!!point,lean:lean,targeting:targeting,pressed:pressed,refreshing:refreshJob!==null};},dispose:function(){if(dead)return;hide();dead=true;MA.pointer.remove(subscription);unsubscribe();listeners.forEach(function(fn){fn();});cursor.remove();}};
})();
