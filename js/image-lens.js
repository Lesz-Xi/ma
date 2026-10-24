/* Ma study handoff — Stillpoint, shared with XI Lab. Scroll chooses the image;
 * time completes the reveal. Native figures own mobile, reduced motion and failure.
 * Keep the public imageLens hook so existing chapter and cursor contracts survive.
 */
(function(){
  'use strict';
  function attach(root){
    if(root.__lens)return root.__lens;
    var section=root.closest('.ma-ch'),figures=Array.from(root.querySelectorAll('figure'));
    var images=figures.map(function(f){return f.querySelector('img');});
    var fine=matchMedia('(hover:hover) and (pointer:fine) and (min-width:900px)');
    var colors=matchMedia('(forced-colors:active)');
    var canvas=document.createElement('canvas');canvas.className='ch02-lens-canvas';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');root.appendChild(canvas);
    var renderer=null,dead=false,failed=false,reason=null,visible=false,queued=null,changes=0,layoutFrame=null;
    var score=window.MA_EDITION&&MA_EDITION.motion;
    function allowed(){return !dead&&!failed&&fine.matches&&!colors.matches&&!MA.reduced.now()&&(!score||innerHeight>=score.naturalBelowHeight);}
    var captionWeights=[],captionFrom=null;
    function present(i){
      captionWeights=figures.map(function(f,n){f.style.opacity='';f.classList.toggle('is-current',i===n);return i===n?1:0;});
      captionFrom=null;root.classList.remove('is-lens-moving');
    }
    function followReveal(progress,target){
      // Canvas owns the images while moving. Native captions share its eased
      // progress, including the captured blend when the reader reverses midway.
      if(!captionFrom)captionFrom=captionWeights.slice();
      root.classList.add('is-lens-moving');
      captionWeights=figures.map(function(f,n){
        var opacity=(captionFrom[n]||0)*(1-progress)+(n===target?progress:0);
        f.style.opacity=String(opacity);return opacity;
      });
    }
    function desired(){
      var r=section.getBoundingClientRect(),travel=Math.max(1,r.height-innerHeight*.82);
      // The incoming shoreline must finish before the first study can turn.
      // Add reading room in scroll distance, not a timer or a second damping loop.
      var hold=Math.min(innerHeight*.55,travel*.25);
      var position=Math.max(0,Math.min(travel-hold,innerHeight*.18-r.top-hold)),step=(travel-hold)/images.length;
      if(!renderer)return Math.min(images.length-1,Math.floor(position/step));
      // A small spatial deadband stops trackpad bounce from restarting a reveal.
      // Large jumps still select the latest image immediately, in either direction.
      var next=renderer.stats().target,edge=Math.min(18,step*.08);
      while(next<images.length-1&&position>=(next+1)*step+edge)next++;
      while(next>0&&position<next*step-edge)next--;
      return next;
    }
    // One-shot adapter into Ma's sole animation scheduler.
    function requestFrame(fn){var id=MA.frame.add(function(t){MA.frame.remove(id);fn(t);});return id;}
    function cancelFrame(id){MA.frame.remove(id);}
    function release(permanent){
      if(queued!==null)cancelFrame(queued);queued=null;
      if(layoutFrame!==null)cancelFrame(layoutFrame);layoutFrame=null;
      // Temporary releases (reduced motion, capability flips) must NOT kill the GL
      // context: the same canvas is re-initialized on restore, and a lost context
      // can never be re-created on one element. Permanent release only on detach/fail.
      if(renderer)renderer.dispose(!!permanent);renderer=null;canvas.hidden=true;
      root.classList.remove('is-lens-ready','is-lens-moving');section.classList.remove('has-image-lens');
      figures.forEach(function(f){f.style.opacity='';f.classList.remove('is-current');});
      captionWeights=[];captionFrom=null;
    }
    function fail(message){failed=true;reason=message;release(true);}
    function update(){
      if(!allowed()){if(renderer)release();return;}
      if(!renderer){init();return;}
      var i=desired();
      if(document.hidden||!visible){
        var state=renderer.stats();
        if(state.running)renderer.settle();
        if(state.target!==i)renderer.replay(i,i);
        return;
      }
      if(renderer.stats().target!==i){captionFrom=captionWeights.slice();renderer.change(i);changes++;}
      root.classList.toggle('is-lens-moving',!!renderer&&renderer.stats().running);
    }
    function queueUpdate(){if(queued===null&&!dead)queued=requestFrame(function(){queued=null;update();});}
    function init(){
      if(renderer||!allowed()||!images.every(function(i){return i.complete&&i.naturalWidth;}))return;
      // A late resource must not turn an already-read natural passage into a pin.
      if(score&&section.getBoundingClientRect().top<0)return;
      if(!window.XIWaterTransitions){fail('Water transition runtime unavailable');return;}
      // Establish the enhanced geometry before the renderer measures its textures.
      root.classList.add('is-lens-ready');section.classList.add('has-image-lens');
      var next=XIWaterTransitions.create(canvas,images,{kind:'stillpoint',initial:desired(),
        reduced:function(){return !allowed();},present:present,onProgress:followReveal,status:onStatus,commit:function(){},
        requestFrame:requestFrame,cancelFrame:cancelFrame});
      // Status also announces ordinary settling; only a failed renderer rolls back.
      if(next.stats().failed||failed){next.dispose(true);release();return;}
      renderer=next;queueUpdate();
    }
    function onStatus(message){if(message.indexOf('unavailable')!==-1)fail(message);}
    function resize(){
      if(layoutFrame!==null||dead)return;
      layoutFrame=requestFrame(function(){layoutFrame=null;if(renderer)renderer.resize();else init();queueUpdate();});
    }
    var io=new IntersectionObserver(function(records){visible=records[0].isIntersecting;if(score&&visible)images.forEach(function(image){image.loading='eager';});update();},{rootMargin:score?'100% 0px':'80px'});io.observe(root);
    var listeners=[];function listen(n,k,fn,o){n.addEventListener(k,fn,o);listeners.push(function(){n.removeEventListener(k,fn,o);});}
    var scrollOff=MA.scroll&&MA.scroll.subscribe?MA.scroll.subscribe(update):null;
    if(!scrollOff)listen(window,'scroll',queueUpdate,{passive:true});
    listen(window,'resize',resize,{passive:true});listen(fine,'change',update);listen(colors,'change',update);listen(document,'visibilitychange',update);
    images.forEach(function(i){listen(i,'load',init);});
    var ro=new ResizeObserver(resize);ro.observe(root);
    var reducedOff=MA.reduced.onChange(update);
    root.__lens={settleForNavigation:function(){if(renderer)renderer.settle();},stats:function(){var info=renderer?renderer.stats():{};return Object.assign({},info,{kind:'stillpoint',ready:!!renderer&&info.ready,running:!!info.running,failed:failed,reason:reason,changes:changes});},detach:function(){dead=true;release(true);if(scrollOff)scrollOff();listeners.forEach(function(fn){fn();});io.disconnect();ro.disconnect();reducedOff();canvas.remove();delete root.__lens;}};
    init();return root.__lens;
  }
  MA.imageLens={attach:attach};
})();
