/* Ma reading rhythm: Lab scores, native markup, the existing MA frame/scroll clocks. */
(function () {
  'use strict';
  var MA=window.MA, engine=window.XIDemos&&window.XIDemos.waterText;
  if(!MA||!engine)return;
  if(MA.textWater)MA.textWater.dispose();
  var choices={ch01:'dewpoint',ch02:'waterline',ch03:'undertow',ch04:'silk',ch05:'confluence',ch06:'meniscus',ch07:'undertow',ch08:'capillary',ch09:'confluence',ch10:'capillary',ch11:'meniscus'};
  var score=window.MA_EDITION&&MA_EDITION.motion;
  // Both editions retain the authored chapter techniques. Missing chapters are
  // skipped below; Shoreline/Silk text follows the section's progress, not a second clock.
  var entries=[],clean=[],job=null,dead=false,booted=false,fontReady=!document.fonts,fontFailed=false;
  var forced=window.matchMedia('(forced-colors: active)');
  var style=document.createElement('style');
  // Inline runs preserve authored BRs, emphasis and responsive line wrapping.
  style.textContent=engine.css+'\n.ma-text-run{display:inline;position:relative}.ma-text-run > .wr-visual{display:inline-block;max-width:100%;vertical-align:baseline}';
  document.head.appendChild(style);
  function listen(el,event,fn,options){el.addEventListener(event,fn,options);clean.push(function(){el.removeEventListener(event,fn,options);});}
  function allowed(){return !MA.reduced.now()&&!forced.matches&&!document.hidden;}
  function settle(e){
    if(e.done)return;e.done=true;e.start=null;
    e.parts.forEach(function(part){part.binding.dispose();part.wrapper.replaceWith(part.original);});
    e.parts=[];
  }
  function all(){entries.forEach(settle);stop();}
  function stop(){if(job!==null)MA.frame.remove(job);job=null;}
  function render(e,p){e.parts.forEach(function(part){part.binding.render(p);});if(p>=1)settle(e);}
  function discover(){
    if(dead||booted)return;booted=true;
    Object.keys(choices).forEach(function(id){
      var root=document.getElementById(id),title=root&&root.querySelector('h1,h2');
      // Public opt-ins have one native-block arrival owner, not two text clocks.
      if(!title||(title.hasAttribute&&title.hasAttribute('data-text-arrival')))return;
      var e={root:root,title:title,kind:choices[id],parts:[],start:null,done:false};entries.push(e);
      // Only text nodes in the chosen heading; never controls, cards, or prose.
      var walk=document.createTreeWalker(title,NodeFilter.SHOW_TEXT),nodes=[],n;
      while((n=walk.nextNode()))if(n.textContent.trim())nodes.push(n);
      try{
        nodes.forEach(function(original){
          var wrapper=document.createElement('span');wrapper.className='ma-text-run';wrapper.textContent=original.textContent;
          original.replaceWith(wrapper);
          try{e.parts.push({original:original,wrapper:wrapper,binding:engine.bind(wrapper,{kind:e.kind})});}
          catch(error){wrapper.replaceWith(original);throw error;}
        });
        if(allowed()&&!fontFailed)render(e,0);else settle(e);
      }catch(error){settle(e);}
    });
    queue();
  }
  function entryCovered(){var veil=document.getElementById('veil');return !!veil&&getComputedStyle(veil).display!=='none';}
  function tick(time){
    stop();if(dead)return;
    try{
      if(!allowed()){all();return;}
      if(!fontReady)return;
      var sections=MA.sectionWater?MA.sectionWater.stats():null;
      entries.forEach(function(e){
        if(e.done)return;
        var r=e.title.getBoundingClientRect();
        // A fast pass does not leave unreadable text when the reader returns.
        if(r.bottom<=0){settle(e);return;}
        if(r.top>=window.innerHeight){if(e.start!==null)settle(e);return;}
        if(e.root.id==='ch01'&&entryCovered())return;
        if(sections&&sections.navigating){settle(e);return;}
        var boundary=sections&&sections.sections.find(function(s){return s.id===e.root.id;});
        if(boundary&&boundary.active){
          // Shoreline and Silk Fold own this interval; no competing timed reveal.
          render(e,Math.max(0,Math.min(1,(boundary.progress-.2)/.62)));return;
        }
        if(e.start===null){
          if(r.top>window.innerHeight*.82)return;
          e.start=time;
        }
        var duration=score?(e.kind==='dewpoint'?score.heroDuration:score.headingDuration):(e.kind==='dewpoint'?engine.specs.dewpoint.duration:1100);
        render(e,Math.min(1,(time-e.start)/duration));
      });
      if(entries.some(function(e){return !e.done&&e.start!==null;}))queue();
    }catch(error){all();console.warn('[Ma text] Readable text restored',error);}
  }
  function queue(){if(dead||job!==null)return;job=MA.frame.add(tick);}
  function settleVisible(){
    entries.forEach(function(e){var r=e.title.getBoundingClientRect();if(r.bottom>0&&r.top<window.innerHeight)settle(e);});
  }
  function dispose(){if(dead)return;dead=true;all();clean.forEach(function(off){off();});observer.disconnect();clearTimeout(fontDeadline);style.remove();}
  MA.textWater={dispose:dispose,settleVisible:settleVisible,stats:function(){return entries.map(function(e){return{id:e.root.id,kind:e.kind,done:e.done};});}};
  clean.push(MA.scroll.subscribe(queue));
  clean.push(MA.reduced.onChange(function(reduced){if(reduced)all();}));
  listen(forced,'change',function(){if(forced.matches)all();});
  listen(document,'visibilitychange',function(){if(document.hidden)all();else queue();});
  listen(window,'resize',queue,{passive:true});
  listen(document,'focusin',function(event){entries.forEach(function(e){if(e.root.contains(event.target))settle(e);});});
  listen(document,'ma:ready',discover,{once:true});
  listen(window,'pagehide',dispose);
  // Entry's removal releases Dewpoint. No guessed timeout or second entry clock.
  var observer=new MutationObserver(function(){if(booted&&!entryCovered())queue();});
  observer.observe(document.body,{childList:true});
  var fontDeadline=setTimeout(function(){fontReady=true;fontFailed=true;all();},2500);
  if(document.fonts)document.fonts.ready.then(function(){if(dead)return;fontReady=true;clearTimeout(fontDeadline);queue();},function(){fontReady=true;fontFailed=true;clearTimeout(fontDeadline);all();});
  else clearTimeout(fontDeadline);
})();
