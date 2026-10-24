/* Selected XI water studies, bound to Ma's existing scroll and frame clocks.
 * Shoreline → approach; Silk Fold → seasons; Rainfield → real anchor navigation.
 * Native layout, focus, text, links and the Composition still remain authoritative.
 */
(function(){
  'use strict';
  var MA=window.MA,engine=window.XIDemos&&XIDemos.waterSections;
  if(!MA||!engine)return;
  var main=document.getElementById('ma-main');if(!main)return;
  if(MA.sectionWater)MA.sectionWater.dispose();
  var NS='http://www.w3.org/2000/svg',entries=[],clean=[],dead=false,job=null,dirty=true,serial=0;
  var contrast=matchMedia('(forced-colors:active)'),width=innerWidth,height=innerHeight,nav=null,navJob=null,navDeadline=null,lastError=null;
  var hero=null,heroInner=null,heroTransform='';
  function resetParallax(){if(heroInner)heroInner.style.transform=heroTransform;}
  function parallax(){
    if(nav)return;
    var shore=entries.find(function(e){return e.kind==='shoreline';});
    if(!heroInner||!shore)return;
    if(!allowed()||naturalSections()||width<900||hero.contains(document.activeElement)){resetParallax();return;}
    var p=clamp((MA.scroll.y+height-shore.top)/Math.max(1,height));
    var distance=Math.min(300,height*.35);
    heroInner.style.transform=p>0?'translate3d(0,'+(distance*p).toFixed(3)+'px,0)':heroTransform;
  }
  var definitions=node('svg',{'class':'ma-section-defs','aria-hidden':'true'},document.body);
  var defs=node('defs',{},definitions);
  function node(tag,attrs,parent){var el=document.createElementNS(NS,tag);Object.keys(attrs).forEach(function(k){el.setAttribute(k,attrs[k]);});if(parent)parent.appendChild(el);return el;}
  function listen(el,event,fn,options){el.addEventListener(event,fn,options);clean.push(function(){el.removeEventListener(event,fn,options);});}
  function hide(el,value){if(value)el.setAttribute('hidden','');else el.removeAttribute('hidden');}
  var score=window.MA_EDITION&&MA_EDITION.motion;
  function allowed(){return !dead&&!MA.reduced.now()&&!contrast.matches&&height>=280;}
  function naturalSections(){return score&&(width<score.naturalBelowWidth||height<score.naturalBelowHeight);}
  function clamp(v){return Math.max(0,Math.min(1,v));}
  function restore(e){e.root.style.clipPath=e.originalClip;e.canvas.hidden=true;hide(e.rim,true);e.active=false;}
  function release(e,permanent){if(e.optics)e.optics.dispose(!!permanent);e.optics=null;e.canvas.hidden=true;}
  function prepare(e){
    if(!allowed()||naturalSections()||e.loading||e.optics||e.failed||!e.near)return;
    e.loading=true;
    var assets=XIDemos.waterSectionAssets||{};
    Promise.all(e.images.map(function(img){return new Promise(function(resolve,reject){
      var texture=new Image();texture.onload=function(){resolve(texture);};texture.onerror=reject;
      var key=img.getAttribute('data-asset')||(img.getAttribute('src')||'').split('/').pop();
      texture.src=assets[key]||img.currentSrc||img.src;
    });})).then(function(images){
      e.loading=false;if(dead||!allowed())return;
      try{e.optics=engine.create(e.canvas,images,{kind:e.kind});}catch(error){e.failed=true;}
      queue(true);
    },function(){e.loading=false;e.failed=true;});
  }
  function discover(){
    if(!heroInner){hero=document.getElementById('ch01');heroInner=hero&&hero.querySelector('.ch01-hero');if(heroInner)heroTransform=heroInner.style.transform||'';}
    [['ch02','shoreline'],['ch04','silkfold']].forEach(function(choice){
      var root=document.getElementById(choice[0]);if(!root||entries.some(function(e){return e.root===root;}))return;
      var id='ma-section-clip-'+(++serial),clip=node('clipPath',{id:id,clipPathUnits:'userSpaceOnUse'},defs);
      var path=node('path',{},clip),canvas=document.createElement('canvas');canvas.className='ma-section-optics';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');root.appendChild(canvas);
      var rim=node('svg',{'class':'ma-section-rim','aria-hidden':'true',hidden:''},root);
      var light=node('path',{'class':'ma-water-light'},rim),edge=node('path',{'class':'ma-water-meniscus'},rim);
      var images=Array.from(root.querySelectorAll(choice[0]==='ch02'?'.ch02-study--line img':'.ch04-seasons img'));
      var e={root:root,kind:choice[1],id:id,clip:clip,path:path,canvas:canvas,rim:rim,light:light,edge:edge,images:images,optics:null,loading:false,failed:false,near:false,progress:1,active:false,originalClip:root.style.clipPath,arrived:false};
      root.setAttribute('data-section-water',e.kind);entries.push(e);ro.observe(root);io.observe(root);
      images.forEach(function(img){ro.observe(img);});
      listen(canvas,'webglcontextlost',function(event){event.preventDefault();e.failed=true;release(e);});
    });
  }
  function measure(){
    width=innerWidth;height=innerHeight;
    var header=document.getElementById('ma-header'),clearance=header?header.getBoundingClientRect().height+12:0;
    entries.forEach(function(e){
      var r=e.root.getBoundingClientRect();e.top=r.top+window.scrollY;e.w=r.width;e.h=r.height;e.vh=Math.min(height,r.height);
      e.travel=Math.max(1,height-Math.max(height*.1,clearance));
      e.rects=e.images.map(function(img){var b=img.getBoundingClientRect();return [(b.left-r.left)/r.width,(b.top-r.top)/e.vh,b.width/r.width,b.height/e.vh];});
      // Complete the opening before the heading reaches the header. Extending
      // Silk to the card centre would keep its title masked until it scrolls away.
      e.canvas.style.width=e.w+'px';e.canvas.style.height=e.vh+'px';e.rim.setAttribute('width',e.w);e.rim.setAttribute('height',e.vh);e.rim.setAttribute('viewBox','0 0 '+e.w+' '+e.vh);
    });dirty=false;
  }
  function paint(){
    if(dead||document.hidden)return;
    if(dirty){discover();measure();}
    parallax();
    entries.forEach(function(e){
      // Complete before the section reaches the fixed navigation. No layout reads
      // or spring lag in this path, and reverse scroll gives the identical boundary.
      var p=clamp((MA.scroll.y+height-e.top)/e.travel);e.progress=p;
      if(e.arrived&&Math.abs(MA.scroll.y-e.arrivalY)>.5)e.arrived=false;
      if(!allowed()||naturalSections()||nav||e.arrived||p<=0||p>=1||(document.activeElement!==e.root&&e.root.contains(document.activeElement))||!e.w||!e.vh){restore(e);return;}
      // Spend the whole physical scroll interval on the reveal, rather than
      // compressing it into the engine's middle 76 percent. One spatial clock.
      var opticalProgress=.12+.76*p;
      var d=engine.geometry(e.kind,opticalProgress,e.w,e.vh);
      // Only the first viewport is a boundary. Tall chapters keep their full flow.
      if(e.h>e.vh)d+='M0 '+e.vh+'H'+e.w+'V'+e.h+'H0Z';
      e.path.setAttribute('d',d);
      // The content and hairline share the exact seam: seasonal copy is only
      // visible inside the opening, never ahead of the fold.
      e.root.style.clipPath='url(#'+e.id+')';e.active=true;
      var contour=engine.contour(e.kind,opticalProgress,e.w,e.vh);
      [e.edge,e.light].forEach(function(path){path.setAttribute('d',contour);});
      e.rim.style.opacity=String(Math.sin(p*Math.PI));hide(e.rim,!contour);
      if(e.optics){
        var grounds=e.images.map(function(){return [245/255,243/255,237/255];}),painted=false;
        try{e.rects.forEach(function(rect,i){if(rect[2]<=0||rect[3]<=0||rect[1]>=1||rect[1]+rect[3]<=0)return;
          e.optics.draw({progress:opticalProgress,from:i,to:i,width:e.w,height:e.vh,rect:rect,grounds:grounds,strength:e.kind==='silkfold'?.55:.72,cover:true,clear:!painted,feather:e.images[i].closest('.ch04-spring')?[.1,.09,0,.09]:[0,0,0,0]});painted=true;
        });e.canvas.hidden=!painted;}catch(error){e.failed=true;release(e);}
      }else prepare(e);
    });
  }
  function queue(layout){dirty=dirty||layout===true;if(job!==null||dead||document.hidden)return;job=MA.frame.add(function(){MA.frame.remove(job);job=null;paint();});}
  var ro=new ResizeObserver(function(){queue(true);});
  var io=new IntersectionObserver(function(records){records.forEach(function(record){var e=entries.find(function(x){return x.root===record.target;});if(e){e.near=record.isIntersecting;prepare(e);}});},{rootMargin:'100% 0px'});
  ro.observe(main);
  // index.html inserts fragments asynchronously; built previews already contain them.
  var mo=new MutationObserver(function(records){if(records.some(function(r){return Array.from(r.addedNodes).some(function(n){return n.nodeType===1&&(n.matches('.ma-ch')||n.querySelector('.ma-ch'));});}))queue(true);});
  mo.observe(main,{childList:true,subtree:true});
  clean.push(MA.scroll.subscribe(paint));
  listen(window,'resize',function(){completeNavigation();queue(true);},{passive:true});
  listen(document,'load',function(e){if(e.target.tagName==='IMG'||e.target.tagName==='LINK')queue(true);},true);
  if(document.fonts)document.fonts.ready.then(function(){queue(true);});
  listen(document,'focusin',function(){queue();});listen(document,'focusout',function(){queue();});

  /* The Lab's exact field now reveals the live destination through the outgoing
   * native-text scene. Only real image pixels enter the shared optical shader. */
  var veil=document.createElement('div');veil.className='ma-rainfield-nav';veil.setAttribute('aria-hidden','true');veil.hidden=true;document.body.appendChild(veil);
  var DURATION=score?score.navigationDuration:1800;
  function targetY(target){
    var header=document.getElementById('ma-header'),gap=header?header.getBoundingClientRect().height+12:0;
    return Math.max(0,target.getBoundingClientRect().top+window.scrollY-(target.id==='ch01'?0:gap));
  }
  function jump(y){
    try{MA.scroll.jump(y);}catch(error){
      lastError='scroll: '+error.message;
      window.scrollTo({top:y,left:0,behavior:'instant'});MA.scroll.refresh();
    }
  }
  function land(n){
    if(n.landed||!n.target.isConnected)return;
    resetParallax();jump(targetY(n.target));n.landed=true;
    entries.forEach(function(e){e.arrived=e.root===n.target||e.root.contains(n.target);e.arrivalY=MA.scroll.y;});
  }
  function commit(n){
    if(n.committed||!n.target.isConnected)return;
    land(n);n.committed=true;
    recordNavigation(n);
    var old=n.target.getAttribute('tabindex');if(old===null)n.target.setAttribute('tabindex','-1');
    try{n.target.focus({preventScroll:true});}catch(error){lastError='focus: '+error.message;}
    finally{if(old===null)n.target.removeAttribute('tabindex');}
    dirty=true;
  }
  function recordNavigation(n){
    if(n.recorded)return;n.recorded=true;
    try{if(window.location.hash!==n.hash)history.pushState(null,'',n.hash);}catch(error){lastError='history: '+error.message;}
  }
  function inverseMask(path){
    // A self-contained SVG image keeps mask references independent of page hashes.
    // All five black paths are a UNION; intersections cannot close holes again.
    var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><defs><mask id="r" maskUnits="userSpaceOnUse" x="0" y="0" width="'+width+'" height="'+height+'"><rect width="100%" height="100%" fill="white"/><path d="'+path+'" fill="black"/></mask></defs><rect width="100%" height="100%" fill="white" mask="url(#r)"/></svg>';
    return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
  }
  function drawNavigation(t){
    if(!nav)return;
    try{
      var u=clamp((t-nav.start)/DURATION);
      // Gentle acceleration into the pools, then an unhurried ripple release.
      // Geometry and refraction always share this one eased progress value.
      var eased=u*u*(3-2*u),p=.12+.88*eased;nav.progress=p;
      if(u>=1){completeNavigation();return;}
      var mask=inverseMask(engine.geometry('rainfield',p,width,height));
      nav.source.element.style.maskImage=mask;nav.source.element.style.webkitMaskImage=mask;
      if(nav.optics)nav.optics.draw({progress:p,from:0,to:1,width:width,height:height,rect:[0,0,1,1],grounds:[[0,0,0],[0,0,0]],plates:true});
    }catch(error){lastError='navigation: '+error.message;completeNavigation();}
  }
  function finishNavigation(){
    if(!nav)return;
    if(navJob!==null)MA.frame.remove(navJob);navJob=null;
    if(navDeadline!==null)clearTimeout(navDeadline);navDeadline=null;
    var n=nav;nav=null;hide(veil,true);
    if(n.optics)n.optics.dispose(true);
    if(n.source)n.source.dispose();if(n.destination)n.destination.dispose();
    veil.replaceChildren();queue(true);
  }
  function completeNavigation(){
    try{if(nav)commit(nav);}catch(error){lastError='handoff: '+error.message;}
    finally{finishNavigation();}
  }
  function navigate(target,hash){
    finishNavigation();
    var n={target:target,hash:hash,landed:false,committed:false,progress:0};nav=n;
    if(!allowed()||!MA.rainScene||document.hidden||Math.abs(targetY(target)-window.scrollY)<2){completeNavigation();return;}
    try{
      jump(window.scrollY);if(MA.water)MA.water.reset();entries.forEach(restore);
      n.source=MA.rainScene.capture();veil.appendChild(n.source.element);hide(veil,false);n.source.activate();
      // The outgoing scene covers the move in this same JS task. No blank sheet.
      land(n);if(score)recordNavigation(n);n.destination=MA.rainScene.capture({mediaOnly:true});
      if(n.source.mediaCount||n.destination.mediaCount){
        var canvas=document.createElement('canvas');canvas.className='ma-rainfield-optics';veil.appendChild(canvas);
        try{n.optics=engine.create(canvas,[n.source.plate,n.destination.plate],{kind:'rainfield'});}
        catch(error){lastError='optics: '+error.message;canvas.remove();}
      }
      n.start=performance.now();
      navDeadline=setTimeout(completeNavigation,DURATION+400);
      drawNavigation(n.start);if(nav)navJob=MA.frame.add(drawNavigation);
    }catch(error){lastError='setup: '+error.message;completeNavigation();}
  }
  // Dismiss the temporary visual layer without activating a covered control.
  listen(veil,'pointerdown',completeNavigation);
  function click(event){
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    var a=event.target.closest&&event.target.closest('a[href]');if(!a||a.hasAttribute('download')||(a.target&&a.target!=='_self'))return;
    var url;try{url=new URL(a.href,window.location.href);}catch(error){return;}
    if(url.origin!==location.origin||url.pathname!==location.pathname||url.search!==location.search||!url.hash)return;
    var target;try{target=document.getElementById(decodeURIComponent(url.hash.slice(1)));}catch(error){return;}
    if(!target)return;
    event.preventDefault();navigate(target,url.hash);
  }
  listen(document,'click',click);
  // Explicit user input always wins over a pending jump, including during the cover.
  function resumeScroll(){entries.forEach(function(e){e.arrived=false;});finishNavigation();}
  listen(window,'wheel',resumeScroll,{passive:true});listen(window,'touchstart',resumeScroll,{passive:true});
  listen(document,'keydown',function(e){if(['Escape','Tab','ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].indexOf(e.key)!==-1)resumeScroll();});
  // Browser history owns its native restoration. Cancel a veil, never re-route it.
  listen(window,'popstate',finishNavigation);listen(window,'hashchange',function(){finishNavigation();queue(true);});
  function mode(){if(!allowed()){completeNavigation();entries.forEach(function(e){restore(e);release(e);});}else entries.forEach(prepare);queue(true);}
  listen(contrast,'change',mode);clean.push(MA.reduced.onChange(mode));
  listen(document,'visibilitychange',function(){
    if(document.hidden){completeNavigation();if(job!==null)MA.frame.remove(job);job=null;entries.forEach(restore);}
    else queue(true);
  });
  function dispose(){
    if(dead)return;finishNavigation();dead=true;if(job!==null)MA.frame.remove(job);job=null;
    resetParallax();clean.forEach(function(fn){fn();});ro.disconnect();io.disconnect();mo.disconnect();
    entries.forEach(function(e){restore(e);release(e,true);e.canvas.remove();e.rim.remove();e.root.removeAttribute('data-section-water');});definitions.remove();veil.remove();
  }
  MA.sectionWater={dispose:dispose,navigate:navigate,refresh:function(){queue(true);},stats:function(){return{navigating:!!nav,lastError:lastError,navigation:nav?{target:nav.target.id,committed:nav.committed,progress:nav.progress,optics:!!nav.optics}:null,sections:entries.map(function(e){return{id:e.root.id,kind:e.kind,progress:e.progress,active:e.active,optics:!!e.optics,failed:e.failed};})};}};
  queue(true);
})();
