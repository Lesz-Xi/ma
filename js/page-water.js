/* Ma — one screen-space optical wake, independently authored.
 * Native DOM is the scene: SVG displacement refracts images AND reading text.
 * Gentle advected wake + expanding annular refraction, both independently authored.
 * Optical response only, not a Navier–Stokes or cloth simulation.
 * No duplicate text, screenshot of the page, painted trail, or second rAF owner.
 */
(function () {
  'use strict';
  var NS='http://www.w3.org/2000/svg', LIMIT=18, RADIUS=96, STEP=1/60, SEED_GAP=38, RIPPLE_LIFE=2.15;
  var contrast=matchMedia('(forced-colors:active)');
  var fine=matchMedia('(hover:hover) and (pointer:fine) and (min-width:900px)');
  var svg=document.createElementNS(NS,'svg'), defs=document.createElementNS(NS,'defs');
  svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');
  svg.style.cssText='position:fixed;pointer-events:none;overflow:hidden';svg.appendChild(defs);document.body.appendChild(svg);
  var map=document.createElement('canvas'),g=map.getContext('2d',{willReadFrequently:true});
  var w=0,h=0,nx=0,ny=0,dx,dy,ax,ay,outX,outY,clickX,clickY,pixels,peak=0,previous=null,frameId=null,last=0,acc=0;
  var entries=[],visible=[],protectedRects=[],dead=false,failed=!g,frames=0,strokes=0,maxPeak=0,totalMs=0,worstMs=0;
  var clicks=[],clickSeeds=0,CLICK_LIFE=1650;
  var ripples=[],travel=0,lastInput=0,rippleSeeds=0,cursorLens=null,layoutDirty=true,wake=false,wakeRendered=false;
  var lastScrollAt=0,scrollEndTimer=null,SCROLL_QUIET=170;
  var controls='a,button,input,textarea,select,[contenteditable]';
  var artworkOnly=!!(window.MA_EDITION&&MA_EDITION.motion.artworkOnly);
  var readingHover=!!(artworkOnly&&MA_EDITION.motion.textHover);
  // Public main can restore the original page-click response independently of
  // hover coverage. Article and original defaults keep their existing policies.
  var pageClicks=!!(artworkOnly&&MA_EDITION.motion.pageClickRipples&&document.getElementById('ma-main'));
  var hoverSurfaces='[data-water-artwork]'+(readingHover?', [data-water-reading]':'');
  var surfaces=artworkOnly?hoverSurfaces:'.ma-ch,#ma-footer,#ma-header,#ma-rail';
  function node(tag,attrs,parent){var n=document.createElementNS(NS,tag);Object.keys(attrs).forEach(function(k){n.setAttribute(k,attrs[k]);});parent.appendChild(n);return n;}
  function allowed(){return !dead&&!failed&&!contrast.matches&&fine.matches&&!MA.reduced.now()&&!document.hidden&&!(document.activeElement&&document.activeElement.matches('input,textarea,select,[contenteditable]'));}
  function resetWake(){
    last=0;acc=0;peak=0;previous=null;ripples=[];travel=0;lastInput=0;wake=false;wakeRendered=false;
    if(dx){dx.fill(0);dy.fill(0);outX.fill(0);outY.fill(0);}
  }
  function queue(){if(frameId===null&&allowed())frameId=MA.frame.add(tick);}
  function clear(){
    if(frameId!==null)MA.frame.remove(frameId);frameId=null;resetWake();clicks=[];cursorLens=null;layoutDirty=true;
    detachFilters();visible=[];
  }
  // Restore every chapter's own filter state. A feDisplacementMap left on a chapter
  // forces a full re-raster of that subtree on every repaint — at rest and, worse,
  // on every scroll frame of the Lenis glide. Filters may only live while this
  // module is actively rendering into a stationary page.
  function detachFilters(){
    entries.forEach(function(e){e.root.style.filter=e.original;});
  }
  function resize(){
    clear();w=innerWidth;h=innerHeight;nx=Math.max(32,Math.min(240,Math.ceil(w/7)));ny=Math.max(24,Math.min(160,Math.ceil(h/7)));
    map.width=nx;map.height=ny;var n=nx*ny;dx=new Float32Array(n);dy=new Float32Array(n);ax=new Float32Array(n);ay=new Float32Array(n);outX=new Float32Array(n);outY=new Float32Array(n);clickX=new Float32Array(n);clickY=new Float32Array(n);if(g)pixels=g.createImageData(nx,ny);
  }
  function register(){
    document.querySelectorAll(surfaces).forEach(function(root){
      if(entries.some(function(e){return e.root===root;}))return;
      var id='ma-water-'+entries.length, f=node('filter',{id:id,filterUnits:'userSpaceOnUse',primitiveUnits:'userSpaceOnUse','color-interpolation-filters':'sRGB'},defs);
      var img=node('feImage',{preserveAspectRatio:'none',result:'map'},f);
      var transfer=node('feComponentTransfer',{in:'map',result:'centered'},f);
      ['R','G'].forEach(function(c){node('feFunc'+c,{type:'linear',slope:1,intercept:-.5/255},transfer);});
      var reading=readingHover&&root.hasAttribute('data-water-reading');
      var strength=reading?Math.max(0,Math.min(1,Number(MA_EDITION.motion.textHoverStrength)||.55)):1;
      node('feDisplacementMap',{in:'SourceGraphic',in2:'centered',scale:LIMIT*2*strength,xChannelSelector:'R',yChannelSelector:'G',result:'refracted'},f);
      {
        // Blue carries a soft reading-lens mask; red/green own displacement.
        node('feColorMatrix',{in:'map',type:'matrix',values:'0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 0',result:'lens-mask'},f);
        var light=node('feComponentTransfer',{in:'refracted',result:'brightened'},f);
        ['R','G','B'].forEach(function(c){node('feFunc'+c,{type:'linear',slope:1.08},light);});
        node('feComposite',{in:'brightened',in2:'lens-mask',operator:'in',result:'lit-lens'},f);
        var merge=node('feMerge',{},f);node('feMergeNode',{in:'refracted'},merge);node('feMergeNode',{in:'lit-lens'},merge);
      }
      entries.push({root:root,original:root.style.filter,filter:f,img:img,id:id});
    });
  }
  function prepare(){
    register();visible=[];protectedRects=[];layoutDirty=false;
    entries.forEach(function(e){var r=e.root.getBoundingClientRect();if(r.bottom<=0||r.top>=h){e.root.style.filter=e.original;return;}
      // Restrict temporary filter allocation to the visible portion, not a tall chapter.
      var x=Math.max(-28,-r.left-28),y=Math.max(-28,-r.top-28);
      e.filter.setAttribute('x',x);e.filter.setAttribute('y',y);e.filter.setAttribute('width',Math.min(r.width+56,w+56));e.filter.setAttribute('height',Math.min(r.height+56,h+56));
      e.img.setAttribute('x',-r.left);e.img.setAttribute('y',-r.top);e.img.setAttribute('width',w);e.img.setAttribute('height',h);visible.push(e);
      e.root.querySelectorAll(controls).forEach(function(c){var b=c.getBoundingClientRect();if(b.bottom>0&&b.top<h)protectedRects.push(b);});
    });
  }
  function sample(a,x,y){
    x=Math.max(0,Math.min(nx-1,x));y=Math.max(0,Math.min(ny-1,y));var ix=Math.floor(x),iy=Math.floor(y),jx=Math.min(nx-1,ix+1),jy=Math.min(ny-1,iy+1),fx=x-ix,fy=y-iy;
    return(a[iy*nx+ix]*(1-fx)+a[iy*nx+jx]*fx)*(1-fy)+(a[jy*nx+ix]*(1-fx)+a[jy*nx+jx]*fx)*fy;
  }
  function step(){
    var decay=Math.exp(-2.8*STEP);peak=0;
    for(var y=0;y<ny;y++)for(var x=0;x<nx;x++){
      var i=y*nx+x,sx=x-dx[i]*STEP*3*(nx-1)/w,sy=y-dy[i]*STEP*3*(ny-1)/h;
      var l=y*nx+Math.max(0,x-1),r=y*nx+Math.min(nx-1,x+1),u=Math.max(0,y-1)*nx+x,d=Math.min(ny-1,y+1)*nx+x;
      ax[i]=(sample(dx,sx,sy)*.94+(dx[l]+dx[r]+dx[u]+dx[d])*.015)*decay;
      ay[i]=(sample(dy,sx,sy)*.94+(dy[l]+dy[r]+dy[u]+dy[d])*.015)*decay;
      peak=Math.max(peak,Math.hypot(ax[i],ay[i]));
    }
    var s=dx;dx=ax;ax=s;s=dy;dy=ay;ay=s;
  }
  function impulse(px,py,vx,vy){
    var minX=Math.max(0,Math.floor((px-RADIUS)/w*(nx-1))),maxX=Math.min(nx-1,Math.ceil((px+RADIUS)/w*(nx-1)));
    var minY=Math.max(0,Math.floor((py-RADIUS)/h*(ny-1))),maxY=Math.min(ny-1,Math.ceil((py+RADIUS)/h*(ny-1)));
    for(var y=minY;y<=maxY;y++)for(var x=minX;x<=maxX;x++){
      var qx=(x/(nx-1)*w-px)/RADIUS,qy=(y/(ny-1)*h-py)/RADIUS,r2=qx*qx+qy*qy;if(r2>=1)continue;
      // A directional core with opposing shoulders gives a curved wake, not a disc.
      var k=Math.exp(-r2*3.6)*(1-r2)*(1-r2),cross=vx*qy-vy*qx,i=y*nx+x;
      dx[i]+=(vx*.26-qy*cross*2.8)*k;dy[i]+=(vy*.26+qx*cross*2.8)*k;
      var n=Math.hypot(dx[i],dy[i]);if(n>11){dx[i]*=11/n;dy[i]*=11/n;n=11;}peak=Math.max(peak,n);
    }
  }
  function seed(px,py,vx,vy,time){
    var length=Math.hypot(vx,vy)||1;
    ripples.push({x:px,y:py,ux:vx/length,uy:vy/length,t:time});
    if(ripples.length>18)ripples.shift();rippleSeeds++;
  }
  function compose(time){
    outX.set(dx);outY.set(dy);
    ripples=ripples.filter(function(r){return time-r.t<RIPPLE_LIFE*1000;});
    ripples.forEach(function(r){
      var age=Math.max(0,(time-r.t)/1000),life=age/RIPPLE_LIFE;
      // An eased beginning and tail: a ridge emerges, travels, then dissolves.
      var attack=1-Math.exp(-age*15),tail=Math.pow(1-life,2);
      var amplitude=6.8*attack*tail,front=15+age*66,width=17+age*5;
      var drift=14*(1-Math.exp(-age*2)),cx=r.x+r.ux*drift,cy=r.y+r.uy*drift;
      var support=front+width*3;
      var x0=Math.max(0,Math.floor((cx-support)/w*(nx-1))),x1=Math.min(nx-1,Math.ceil((cx+support)/w*(nx-1)));
      var y0=Math.max(0,Math.floor((cy-support)/h*(ny-1))),y1=Math.min(ny-1,Math.ceil((cy+support)/h*(ny-1)));
      for(var y=y0;y<=y1;y++)for(var x=x0;x<=x1;x++){
        var qx=x/(nx-1)*w-cx,qy=y/(ny-1)*h-cy,distance=Math.hypot(qx,qy);if(distance<1||distance>support)continue;
        var band=(distance-front)/width;
        // Opposite refractions on the crest's two shoulders produce depth in
        // existing grain/edges. Nothing bright or opaque is painted over them.
        var lens=Math.sin(band*1.9)*Math.exp(-band*band*.65)*amplitude;
        var side=(qx*r.uy-qy*r.ux)/distance;
        var curl=lens*.28*side,i=y*nx+x;
        outX[i]+=qx/distance*lens-qy/distance*curl;
        outY[i]+=qy/distance*lens+qx/distance*curl;
      }
    });
    // A bounded convex lens refracts the original DOM beneath the glass silhouette.
    // It shares the water map and scheduler; a stationary lens needs no animation.
    if(cursorLens){
      var c=cursorLens;
      for(var y=Math.max(0,Math.floor((c.y-c.ry)/h*(ny-1)));y<=Math.min(ny-1,Math.ceil((c.y+c.ry)/h*(ny-1)));y++){
        for(var x=Math.max(0,Math.floor((c.x-c.rx)/w*(nx-1)));x<=Math.min(nx-1,Math.ceil((c.x+c.rx)/w*(nx-1)));x++){
          var qx=(x/(nx-1)*w-c.x)/c.rx,qy=(y/(ny-1)*h-c.y)/c.ry,r2=qx*qx+qy*qy;
          if(r2>=1)continue;
          var gain=c.strength*Math.pow(1-r2,1.2),i=y*nx+x;
          if(c.zoom){
            var reading=readingLens(x/(nx-1)*w,y/(ny-1)*h);
            // Sample toward the center for magnification, never away from it.
            // Suppress the travelling wake inside the reading area for clear type.
            outX[i]=outX[i]*(1-reading.mask)+reading.x;
            outY[i]=outY[i]*(1-reading.mask)+reading.y;
          }else{outX[i]-=qx*gain;outY[i]-=qy*gain;}
        }
      }
    }
    peak=0;
    for(var i=0;i<outX.length;i++){
      var n=Math.hypot(outX[i],outY[i]),soft=n?LIMIT*Math.tanh(n/LIMIT)/n:1;
      outX[i]*=soft;outY[i]*=soft;peak=Math.max(peak,n*soft);
    }
    maxPeak=Math.max(maxPeak,peak);
  }
  // Clicks are a bounded, isotropic field separate from the directional hover wake.
  // Keeping them separate lets controls retain stable hit areas while their pixels ripple.
  function composeClicks(time){
    clickX.fill(0);clickY.fill(0);
    clicks=clicks.filter(function(r){return time-r.t<CLICK_LIFE;});
    clicks.forEach(function(r){
      var age=Math.max(0,(time-r.t)/1000),life=age/(CLICK_LIFE/1000);
      // More legible crests, with the same finite lifetime and displacement ceiling.
      var amplitude=8.4*(1-Math.exp(-(age+.012)*24))*Math.pow(1-life,1.6);
      var front=14+age*84,width=9.5+age*3.5,support=front+width*3;
      for(var y=Math.max(0,Math.floor((r.y-support)/h*(ny-1)));y<=Math.min(ny-1,Math.ceil((r.y+support)/h*(ny-1)));y++){
        for(var x=Math.max(0,Math.floor((r.x-support)/w*(nx-1)));x<=Math.min(nx-1,Math.ceil((r.x+support)/w*(nx-1)));x++){
          var qx=x/(nx-1)*w-r.x,qy=y/(ny-1)*h-r.y,d=Math.hypot(qx,qy);if(d<1||d>support)continue;
          var a=(d-front)/width,b=(d-front+22)/width;
          var wave=(Math.sin(a*1.8)*Math.exp(-a*a*.8)+.58*Math.sin(b*1.8)*Math.exp(-b*b*.8))*amplitude;
          var i=y*nx+x;clickX[i]+=qx/d*wave;clickY[i]+=qy/d*wave;
        }
      }
    });
  }
  function click(e){
    if(artworkOnly&&!pageClicks&&(!e.target||!e.target.closest('[data-water-artwork]')||e.target.closest('#ch03')))return;
    // Page clicks share the existing map and leaf compositors, not a second
    // page-sized renderer. Keep actions, editing and the signature autonomous.
    // Only the three explicitly marked vessel tabs share their native selection
    // with the original circular wave. Other controls keep sole click ownership.
    var vesselClick=pageClicks&&e.target&&e.target.closest('button[data-vessel-choice][data-water-click]');
    if(pageClicks&&(!e.target||e.pointerType==='touch'||e.target.closest('.ch03-media')||(!vesselClick&&e.target.closest(controls+',label,[role="button"],[role="tab"]'))))return;
    if(e.button!==0||e.detail===0||e.ctrlKey||e.metaKey||e.altKey||!allowed()||String(getSelection()))return;
    if(e.target&&e.target.closest('input,textarea,select,[contenteditable]'))return;
    var now=performance.now();
    // Do not attach chapter filters during the accepted scroll glide.
    if(now-lastScrollAt<SCROLL_QUIET)return;
    clicks.push({x:e.clientX,y:e.clientY,t:now});if(clicks.length>4)clicks.shift();clickSeeds++;
    layoutDirty=true;queue();
  }
  function readingLens(x,y){
    var c=cursorLens;if(!c||!c.zoom)return{x:0,y:0,mask:0};
    var qx=x-c.x,qy=y-c.y;
    if(Math.abs(qx)>=c.rx||Math.abs(qy)>=c.ry)return{x:0,y:0,mask:0};
    var r=Math.hypot(qx/c.rx,qy/c.ry);
    var edge=Math.max(0,Math.min(1,(r-.72)/.28)),mask=1-edge*edge*(3-2*edge);
    var k=(1-1/c.zoom)*mask;
    return{x:qx*k,y:qy*k,mask:mask};
  }
  function draw(){
    var magnifying=cursorLens&&cursorLens.zoom,bytes=pixels.data;
    for(var i=0;i<dx.length;i++){
      var ox=outX[i],oy=outY[i];
      var mask=0;
      // Bubble can magnify a control's pixels while its DOM hit area stays fixed.
      // Other treatments continue to leave controls optically untouched.
      if(magnifying){
        var x=i%nx/(nx-1)*w,y=Math.floor(i/nx)/(ny-1)*h,reading=readingLens(x,y);mask=reading.mask;
        if((ox||oy||mask)&&protectedRects.some(function(r){return x>=r.left-12&&x<=r.left+r.width+12&&y>=r.top-12&&y<=r.bottom+12;})){ox=reading.x;oy=reading.y;}
      }
      if(!magnifying&&(ox||oy)){
        var px=i%nx/(nx-1)*w,py=Math.floor(i/nx)/(ny-1)*h;
        if(protectedRects.some(function(r){return px>=r.left-12&&px<=r.left+r.width+12&&py>=r.top-12&&py<=r.bottom+12;})){ox=0;oy=0;}
      }
      // Add click refraction after the reading-lens protection, including material canvases.
      ox+=clickX[i];oy+=clickY[i];
      var length=Math.hypot(ox,oy),cap=length>LIMIT?LIMIT/length:1;ox*=cap;oy*=cap;
      bytes[i*4]=Math.round(128-ox/LIMIT*127);bytes[i*4+1]=Math.round(128-oy/LIMIT*127);bytes[i*4+2]=Math.round(mask*255);bytes[i*4+3]=255;
    }
    g.putImageData(pixels,0,0);
    // Neutralize functional targets while retaining one continuous field around them.
    var url=map.toDataURL('image/png');visible.forEach(function(e){e.img.setAttribute('href',url);e.root.style.filter='url(#'+e.id+')';});
  }
  function tick(t){
    if(!allowed()){clear();return;}
    // The page is gliding: stay out of the compositor entirely. The scroll-end
    // timer re-queues one render once the page is stationary again.
    if(performance.now()-lastScrollAt<SCROLL_QUIET){
      var live=frameId;frameId=null;
      if(live!==null)MA.frame.remove(live);
      detachFilters();return;
    }
    var start=performance.now();
    if(layoutDirty)prepare();
    if(wake){
      var elapsed=last?Math.max(0,(t-last)/1000):STEP,bounded=Math.min(elapsed,.05);
      if(elapsed>bounded){var extra=Math.exp(-2.8*(elapsed-bounded));for(var i=0;i<dx.length;i++){dx[i]*=extra;dy[i]*=extra;}}
      acc+=bounded;last=t;
      while(acc>=STEP){step();acc-=STEP;}
      // The 2.8s ceiling is anchored to the wake's FIRST rendered frame: under a
      // slow renderer the debut frame can land seconds after the last input, and
      // the wake must still appear once before it is allowed to time out.
      if(wakeRendered&&t-lastInput>2800)resetWake();
    }
    compose(t);composeClicks(t);
    try{draw();if(wake)wakeRendered=true;frames++;var cost=performance.now()-start;totalMs+=cost;worstMs=Math.max(worstMs,cost);}catch(e){failed=true;clear();return;}
    // At settle, a live stationary lens keeps its frame of glass; without one the
    // page returns to a completely unfiltered rest state.
    if(!wake&&!clicks.length){
      if(!cursorLens){detachFilters();visible=[];}
      MA.frame.remove(frameId);frameId=null;
    }
  }
  var sub=MA.pointer.add(document.documentElement,function(p){
    if(!allowed()||p.pointerType==='touch'||!p.inside||String(getSelection())){clear();return;}
    // Composition opts in at its shared media wrapper: image and stem stay registered.
    // Clicks remain excluded above; controls remain protected below.
    if(artworkOnly&&(!p.target||!p.target.closest(hoverSurfaces))){previous=null;return;}
    if(p.buttons){previous=null;return;}
    if(p.target&&p.target.closest(controls)){resetWake();if(cursorLens)queue();return;}
    var now=performance.now(),x=p.clientX,y=p.clientY;
    // Pause guard: long gaps restart the trail baseline. 1000ms, not event-rate
    // assumptions — under heavy render load (software GL, filter re-rasters) moves
    // can arrive hundreds of ms apart mid-stroke, and dist>180 already kills jumps.
    if(!previous||now-previous.t>1000){previous={x:x,y:y,t:now};travel=0;return;}
    var vx=x-previous.x,vy=y-previous.y,dist=Math.hypot(vx,vy);previous={x:x,y:y,t:now};
    if(dist<.2)return;if(dist>180){clear();previous={x:x,y:y,t:now};return;}
    // Pointer drifting while the page glides seeds nothing — wake coordinates are
    // screen-space and the content is moving; seeding here only buys filter frames
    // on scrolling chapters (the sticky-scroll defect).
    if(now-lastScrollAt<SCROLL_QUIET){travel=0;return;}
    if(frameId===null)layoutDirty=true;
    // Resample by arc length, independently of the pointing device's event rate.
    var next=SEED_GAP-travel;
    while(next<=dist){seed(x-vx+vx*next/dist,y-vy+vy*next/dist,vx,vy,now);next+=SEED_GAP;}
    travel=(travel+dist)%SEED_GAP;lastInput=now;wake=true;
    var n=Math.max(1,Math.ceil(dist/12));
    for(var i=0;i<n;i++)impulse(x-vx*(1-(i+.5)/n),y-vy*(1-(i+.5)/n),vx/n,vy/n);
    strokes++;queue();
  });
  function setLens(lens){
    cursorLens=allowed()?lens:null;
    if(dead||failed)return;
    if(!cursorLens){if(clicks.length&&allowed()){queue();return;}clear();return;}
    // A lens update landing mid-glide is deferred; the scroll-end timer renders
    // the latest lens once over stationary content.
    if(performance.now()-lastScrollAt<SCROLL_QUIET){layoutDirty=true;return;}
    // Coalesce high-frequency input and radius updates into one map per frame.
    if(frameId===null)layoutDirty=true;
    queue();
  }
  function onScroll(){
    lastScrollAt=performance.now();
    if(!allowed()){clear();return;}
    // Content moves beneath a stationary screen-space lens. Detach every filter
    // NOW so the glide never pays feDisplacementMap re-rasters; discard old wake
    // coordinates; re-render the lens once, after the page stops moving.
    resetWake();clicks=[];layoutDirty=true;detachFilters();
    if(frameId!==null){MA.frame.remove(frameId);frameId=null;}
    if(scrollEndTimer!==null)clearTimeout(scrollEndTimer);
    scrollEndTimer=setTimeout(function(){
      scrollEndTimer=null;
      if(!allowed()){clear();return;}
      layoutDirty=true;
      if(cursorLens)queue();
    },SCROLL_QUIET+20);
  }
  var listeners=[];function listen(target,event,fn,options){target.addEventListener(event,fn,options);listeners.push(function(){target.removeEventListener(event,fn,options);});}
  listen(window,'resize',resize);listen(window,'scroll',onScroll,{passive:true});listen(document,'visibilitychange',clear);
  listen(window,'pointerdown',function(e){if(e.button!==0)clear();},{passive:true});listen(window,'click',click,{passive:true,capture:true});listen(window,'blur',clear);listen(document,'focusin',function(e){if(e.target&&e.target.matches('input,textarea,select,[contenteditable]'))clear();});listen(document,'selectionchange',function(){if(String(getSelection()))clear();});
  listen(document.documentElement,'pointerleave',function(){previous=null;});listen(fine,'change',clear);listen(contrast,'change',clear);
  var unsubscribe=MA.reduced.onChange(clear);resize();
  MA.water={reset:clear,setLens:setLens,stats:function(){return{active:frameId!==null,lens:!!cursorLens,failed:failed,frames:frames,strokes:strokes,peak:peak,maxPeak:maxPeak,ripples:ripples.length,clickRipples:clicks.length,clickSeeds:clickSeeds,rippleSeeds:rippleSeeds,grid:[nx,ny],fieldBytes:dx.byteLength*8+(pixels?pixels.data.byteLength:0),filtered:visible.map(function(e){return e.root.id;}),meanMs:frames?totalMs/frames:0,worstMs:worstMs};},sample:function(x,y){return{x:sample(outX,x/w*(nx-1),y/h*(ny-1)),y:sample(outY,x/w*(nx-1),y/h*(ny-1))};},dispose:function(){clear();dead=true;if(scrollEndTimer!==null){clearTimeout(scrollEndTimer);scrollEndTimer=null;}MA.pointer.remove(sub);unsubscribe();listeners.forEach(function(fn){fn();});svg.remove();entries=[];map.width=map.height=1;}};
})();
