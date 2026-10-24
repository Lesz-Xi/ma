/* Direction-aware navigation, driven by Ma's existing scroll position. */
(function(){
  'use strict';
  var MA=window.MA,header=document.getElementById('ma-header'),footer=document.getElementById('ma-footer');
  if(!MA||!header)return;
  if(MA.headerScroll)MA.headerScroll.dispose();
  var previous=MA.scroll.y,turn=previous,direction=0,threshold=Infinity,dead=false,job=null,clean=[];
  function listen(el,type,fn,options){el.addEventListener(type,fn,options);clean.push(function(){el.removeEventListener(type,fn,options);});}
  function show(){header.removeAttribute('data-scroll-hidden');}
  function update(){
    if(dead)return;
    var y=Math.max(0,MA.scroll.y),delta=y-previous;previous=y;
    var footerRect=footer&&footer.getBoundingClientRect();
    // Keep the way back available throughout the footer, regardless of direction.
    var atFooter=footerRect&&footerRect.top<window.innerHeight&&footerRect.bottom>0;
    if(atFooter||y<threshold||header.contains(document.activeElement)){
      show();direction=0;turn=y;return;
    }
    // Anchor/history jumps are navigation, not a downward reading gesture.
    if(Math.abs(delta)>window.innerHeight*.65||(MA.sectionWater&&MA.sectionWater.stats().navigating)){
      show();direction=0;turn=y;return;
    }
    if(Math.abs(delta)<.1)return;
    var next=delta>0?1:-1;
    if(next!==direction){direction=next;turn=y-delta;}
    if(direction<0&&turn-y>=6)show();
    if(direction>0&&y-turn>=18)header.setAttribute('data-scroll-hidden','');
  }
  function measure(){
    var second=document.getElementById('ch02');
    threshold=second?Math.max(96,second.getBoundingClientRect().top+window.scrollY-window.innerHeight+32):Infinity;
    update();
  }
  function queueMeasure(){if(dead||job!==null)return;job=MA.frame.add(function(){MA.frame.remove(job);job=null;measure();});}
  function dispose(){if(dead)return;dead=true;clean.forEach(function(off){off();});if(job!==null)MA.frame.remove(job);observer.disconnect();show();}
  clean.push(MA.scroll.subscribe(update));
  listen(document,'ma:ready',queueMeasure);
  listen(window,'resize',queueMeasure,{passive:true});
  listen(header,'focusin',show);
  // Focus stays available even when the header is visually outside the viewport.
  listen(document,'keydown',function(e){if(e.key==='Tab')show();},true);
  listen(window,'pageshow',function(){show();previous=MA.scroll.y;direction=0;turn=previous;queueMeasure();});
  var observer=new ResizeObserver(queueMeasure),hero=document.getElementById('ch01');
  if(hero)observer.observe(hero);
  listen(document,'ma:ready',function(){var el=document.getElementById('ch01');if(el)observer.observe(el);});
  if(document.fonts)document.fonts.ready.then(queueMeasure);
  MA.headerScroll={dispose:dispose};
  measure();
})();
