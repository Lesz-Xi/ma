/* Ma variant of Flying Media Scroll. Authored CSS planes, no hidden geometry.
 * All positions are functions of MA.scroll. No private ticker or smoothing. */
(function(){
 'use strict';
 var MA=window.MA;if(!MA)return;
 function clamp(x){return Math.max(0,Math.min(1,x));}
 function cubic(x,x1,y1,x2,y2){
  function axis(t,a,b){var s=1-t;return 3*s*s*t*a+3*s*t*t*b+t*t*t;}
  var lo=0,hi=1,t=x;
  for(var i=0;i<16;i++){t=(lo+hi)/2;if(axis(t,x1,x2)<x)lo=t;else hi=t;}
  return axis(t,y1,y2);
 }
 function sample(progress,index,width,height,count){
  // Span derives from the actual count: every object has the same depth score
  // and the last petal leaves exactly at the shared endpoint.
  count=Math.max(1,Math.floor(count||12));
  var span=.5+(count-1)*.101,t=clamp(progress)*span-index*.101,q=clamp(t/.5);
  var fade=clamp(t/.22),entry=(1-Math.cos(fade*Math.PI))/2,exit=clamp((t-.36)/.14);
  var z=(-2+2.6*cubic(q,.446,.05,.551,.95))*width;
  var scale=1/(1-z/width),panel=width*.21,side=index%2?-1:1;
  // Compensated lateral position keeps the inner edge outside the type lane.
  var screenX=side*(width*.25+24+panel*scale/2);
  var y=[-.20,.17,.28,-.25,-.06,.12,-.23,.24,.04,-.28,.15,-.08][index%12]*height;
  return{opacity:progress<=0||progress>=1||t<0||t>=.5?0:entry*(1-exit),blur:12*(1-entry)+8*exit,z:z,x:screenX/scale,y:y/scale};
 }
 function attach(root){
  if(root.__maFlight)return root.__maFlight;
  var panels=Array.from(root.querySelectorAll('[data-flight-panel]')),images=Array.from(root.querySelectorAll('img'));
  var fine=matchMedia('(min-width:1000px) and (min-height:700px) and (hover:hover) and (pointer:fine)'),forced=matchMedia('(forced-colors:active)');
  var active=false,dead=false,failed=false,job=null,top=0,travel=1,w=1,h=1,last=null,updates=0,progress=0,clean=[];
  var note=root.querySelector('.ma-flight-failure');
  function allowed(){return !dead&&!failed&&fine.matches&&!forced.matches&&!MA.reduced.now();}
  // The local Chrome probe can miss a change on the shell's early-created MQL
  // after dynamic styles are installed. A post-parse observer forwards only a
  // genuinely stale preference to the SAME bus; no polling or second reducer.
  function bindPreference(){
   if(dead)return;
   var query=matchMedia('(prefers-reduced-motion: reduce)');
   function sync(){if(document.documentElement.dataset.reduced!==String(query.matches))MA.reduced._q.dispatchEvent(new Event('change'));}
   listen(query,'change',sync);sync();
  }
  function clear(){panels.forEach(function(p){p.style.transform='';p.style.opacity='';p.style.filter='';p.style.pointerEvents='';});last=null;}
  function measure(){var r=root.getBoundingClientRect();top=r.top+window.scrollY;w=innerWidth;h=innerHeight;travel=Math.max(1,r.height-h);last=null;}
  function draw(){
   if(dead||document.hidden||!active)return;
   var offset=MA.scroll.y-top;
   // Native scroll positions round to pixels; retire the end plane exactly.
   var p=offset<=.5?0:offset>=travel-.5?1:clamp(offset/travel);if(p===last)return;last=p;progress=p;
   panels.forEach(function(panel,i){var s=sample(p,i,w,h,panels.length);panel.style.transform='translate(-50%,-50%) translate3d('+s.x+'px,'+s.y+'px,'+s.z+'px)';panel.style.opacity=String(s.opacity);panel.style.filter=s.blur>.01?'blur('+s.blur+'px)':'none';panel.style.pointerEvents=s.opacity>.12&&s.blur<8?'auto':'none';});updates++;
  }
  function reconcile(){
   if(dead)return;
   var next=allowed()&&images.every(function(i){return i.complete&&i.naturalWidth>0;});
   // Do not insert a long sticky passage beneath an already-reading visitor.
   if(next&&!active&&root.getBoundingClientRect().top<0)next=false;
   if(next!==active){active=next;root.classList.toggle('is-flying',active);clear();MA.scroll.refresh();}
   measure();draw();
  }
  function queue(){if(dead||job!==null||document.hidden)return;job=MA.frame.add(function(){MA.frame.remove(job);job=null;reconcile();});}
  function listen(el,event,fn){el.addEventListener(event,fn);clean.push(function(){el.removeEventListener(event,fn);});}
  images.forEach(function(i){listen(i,'load',queue);listen(i,'error',function(){failed=true;if(note)note.hidden=false;reconcile();});});
  listen(window,'resize',queue);listen(fine,'change',reconcile);listen(forced,'change',reconcile);
  listen(document,'visibilitychange',function(){if(document.hidden){if(job!==null)MA.frame.remove(job);job=null;}else queue();});
  clean.push(MA.scroll.subscribe(draw));clean.push(MA.reduced.onChange(reconcile));
  if(document.readyState==='loading')listen(document,'DOMContentLoaded',bindPreference);else bindPreference();
  var io=new IntersectionObserver(function(records){if(records.some(function(r){return r.isIntersecting;})){images.forEach(function(i){i.loading='eager';});queue();}},{rootMargin:'120% 0px'});io.observe(root);
  var ro=new ResizeObserver(queue);ro.observe(document.querySelector('#ma-main')||root);ro.observe(root);
  if(document.fonts)document.fonts.ready.then(queue,queue);
  var api={stats:function(){return{enabled:active,failed:failed,progress:progress,updates:updates,pending:job!==null,panels:panels.length};},dispose:function(){dead=true;if(job!==null)MA.frame.remove(job);job=null;clean.forEach(function(f){f();});io.disconnect();ro.disconnect();root.classList.remove('is-flying');clear();delete root.__maFlight;}};
  root.__maFlight=api;reconcile();return api;
 }
 MA.endingFlight={attach:attach,sample:sample};
 var instance=null;MA.chapters.register('ch12',{mount:function(root){instance=attach(root);return instance;},unmount:function(){if(instance)instance.dispose();instance=null;}});
})();
