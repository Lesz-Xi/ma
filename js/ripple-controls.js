/* The Lab's Ripple Letters, promoted onto native Ma controls. */
(function(){
  'use strict';
  var MA=window.MA,engine=window.XIDemos&&window.XIDemos.waterHover;
  if(!MA||!engine)return;
  if(MA.rippleControls)MA.rippleControls.dispose();
  var entries=[],dead=false;
  // Adapt one-shot requests to the existing persistent MA frame owner.
  var clock=engine.createClock(function(fn){
    var id=MA.frame.add(function(t){MA.frame.remove(id);fn(t);});return id;
  },function(id){MA.frame.remove(id);});
  var style=document.createElement('style');
  style.textContent=engine.css+'\n'+
    '[data-ripple-label]{display:inline-block;min-width:0;max-width:100%;font:inherit;letter-spacing:inherit}'+
    '#ma-main .ch06-choices [data-ripple-control] span{margin:0;font:inherit}'+
    '#ma-main .ch06-choices [data-ripple-control] .wh-char,#ma-main .ch06-choices [data-ripple-control] .wh-word{display:inline-block}';
  document.head.appendChild(style);
  function discover(){
    if(dead)return;
    document.querySelectorAll('[data-ripple-label]').forEach(function(label){
      var control=label.closest('a,button');
      if(!control||entries.some(function(e){return e.label===label;}))return;
      try{
        var binding=engine.bind(label,{kind:'ripple',target:control,clock:clock,isReduced:function(){return MA.reduced.now();}});
        control.setAttribute('data-ripple-control','');entries.push({label:label,control:control,binding:binding});
      }catch(error){console.warn('[Ma ripple] Native label retained',error);}
    });
  }
  var offReduced=MA.reduced.onChange(function(){entries.forEach(function(e){e.binding.settle();});});
  document.addEventListener('ma:ready',discover);discover();
  function dispose(){
    if(dead)return;dead=true;document.removeEventListener('ma:ready',discover);offReduced();
    entries.forEach(function(e){e.binding.dispose();e.control.removeAttribute('data-ripple-control');});entries=[];style.remove();
  }
  MA.rippleControls={dispose:dispose,count:function(){return entries.length;}};
})();
