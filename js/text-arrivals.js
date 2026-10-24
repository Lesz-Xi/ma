/* Public Ma: native-block arrivals. No split markup, private RAF or hover owner. */
(function () {
  'use strict';
  var MA=window.MA;if(!MA)return;
  if(MA.textArrivals)MA.textArrivals.dispose();
  var entries=[],clean=[],job=null,dead=false,booted=false,ready=!document.fonts,failed=false;
  var forced=matchMedia('(forced-colors: active)'),deadline=null;
  var properties=['opacity','transform','will-change'];
  function listen(el,event,fn){el.addEventListener(event,fn);clean.push(function(){el.removeEventListener(event,fn);});}
  function allowed(){return !MA.reduced.now()&&!forced.matches&&!document.hidden;}
  function stop(){if(job!==null)MA.frame.remove(job);job=null;}
  function settle(e){
    if(e.done)return;e.done=true;e.start=null;
    if(e.saved)properties.forEach(function(key){var s=e.saved[key];if(s.value)e.el.style.setProperty(key,s.value,s.priority);else e.el.style.removeProperty(key);});
  }
  function all(){entries.forEach(settle);stop();}
  function draw(e,p){
    // Exponential deceleration, exact native rest. Headings travel 14px; prose 6px.
    var eased=p===1?1:1-Math.pow(2,-10*p),tail=1-eased;
    e.el.style.opacity=String(.12+.88*eased);
    e.el.style.transform='translate3d(0,'+((e.kind==='heading'?14:6)*tail).toFixed(3)+'px,0)';
    if(p>=1)settle(e);
  }
  function discover(){
    if(dead||!booted||!ready||entries.length)return;
    document.querySelectorAll('[data-text-arrival]').forEach(function(el,index){
      var kind=el.getAttribute('data-text-arrival'),root=el.closest('.ma-ch');
      // Explicit reading leaves only. Never bind a control, media or live/status node.
      if(!root||!['heading','prose'].includes(kind)||!el.matches('h2,p')||el.querySelector('a,button,input,[aria-live],[role="status"]')||el.matches('[aria-live],[role="status"]'))return;
      var e={el:el,root:root,kind:kind,id:root.id+'-'+kind+'-'+index,start:null,done:false,saved:null};entries.push(e);
      if(failed||!allowed()){settle(e);return;}
      e.saved={};properties.forEach(function(key){e.saved[key]={value:el.style.getPropertyValue(key),priority:el.style.getPropertyPriority(key)};});
      draw(e,0);
    });
    queue();
  }
  function tick(time){
    stop();if(dead)return;
    try{
      if(!allowed()){all();return;}
      var sections=MA.sectionWater?MA.sectionWater.stats():null;
      entries.forEach(function(e){
        if(e.done)return;
        var r=e.el.getBoundingClientRect();
        if(r.bottom<=0||(e.start!==null&&r.top>=innerHeight)){settle(e);return;}
        if(r.top>=innerHeight)return;
        // Navigation's veil owns the destination. Never make the reader wait again.
        if(sections&&sections.navigating){settle(e);return;}
        if(e.start===null){
          if(r.top>innerHeight*.86)return;
          e.start=time;e.el.style.willChange='opacity, transform';
        }
        var duration=e.kind==='heading'?850:650;
        draw(e,Math.max(0,Math.min(1,(time-e.start)/duration)));
      });
      if(entries.some(function(e){return !e.done&&e.start!==null;}))queue();
    }catch(error){all();console.warn('[Ma arrivals] Native reading restored',error);}
  }
  function queue(){if(dead||!entries.length||job!==null||document.hidden||entries.every(function(e){return e.done;}))return;job=MA.frame.add(tick);}
  function dispose(){if(dead)return;dead=true;all();clearTimeout(deadline);clean.forEach(function(off){off();});}
  MA.textArrivals={dispose:dispose,stats:function(){return{pending:job!==null,entries:entries.map(function(e){return{id:e.id,section:e.root.id,kind:e.kind,done:e.done,active:e.start!==null};})};}};
  clean.push(MA.scroll.subscribe(queue));
  clean.push(MA.reduced.onChange(function(reduced){if(reduced)all();}));
  listen(forced,'change',function(){if(forced.matches)all();});
  listen(document,'visibilitychange',function(){if(document.hidden)all();else queue();});
  listen(window,'resize',queue);
  listen(document,'focusin',function(event){entries.forEach(function(e){if(e.root.contains(event.target))settle(e);});});
  listen(document,'selectionchange',function(){var selection=window.getSelection();if(selection&&!selection.isCollapsed)all();});
  listen(document,'ma:ready',function(){booted=true;discover();});
  listen(window,'pagehide',dispose);
  deadline=setTimeout(function(){ready=true;failed=true;discover();all();},2500);
  if(document.fonts)document.fonts.ready.then(function(){if(dead)return;ready=true;clearTimeout(deadline);discover();},function(){if(dead)return;ready=true;failed=true;clearTimeout(deadline);discover();all();});
  else clearTimeout(deadline);
})();
