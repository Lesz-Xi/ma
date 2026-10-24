/* Ma Water Hover — readable native controls, one demand-driven clock. */
(function(global){
  'use strict';
  const NS=global.XIDemos=global.XIDemos||{demos:{},u:{}};
  const specs={
    tension:{name:'Surface Tension',note:'A shallow arch gathers beneath your pointer, then releases.'},
    capillary:{name:'Capillary Ink',note:'Ink rises through the letters, like water finding a stem.'},
    ripple:{name:'Ripple Letters',note:'One contact sends a soft crest out through the words.'},
    current:{name:'Undercurrent',note:'The letters drift sideways in a passing current, then find their place.'},
    reflection:{name:'Mirror Pool',note:'A quiet reflection forms below the words and recedes as you leave.'}
  };
  const css=`
.wh-bound{position:relative;isolation:isolate}
.wh-accessible{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important}
.wh-visual{white-space:pre-wrap;overflow-wrap:anywhere}
.wh-word{display:inline-block;max-width:100%;white-space:pre-wrap}
.wh-char{position:relative;display:inline-block;white-space:pre;transform-origin:50% 75%}
.wh-ink,.wh-reflection{position:absolute;inset:0;pointer-events:none}
.wh-ink{color:var(--wh-ink,currentColor);clip-path:inset(100% 0 0)}
.wh-capillary .wh-char{color:var(--wh-muted,currentColor)}
.wh-reflection{opacity:0;top:.82em;bottom:auto;transform:scaleY(-.48);transform-origin:center;mask-image:linear-gradient(transparent 12%,black 100%)}
.wh-bound:focus-visible{outline:2px solid currentColor;outline-offset:6px}
@media(prefers-reduced-motion:reduce),(forced-colors:active){.wh-char{transform:none!important}.wh-reflection{display:none!important}.wh-ink{clip-path:none!important}}
`;
  const owners=new WeakMap();
  function createClock(request,cancel){
    const active=new Set();let frame=null;
    function tick(t){frame=null;active.forEach(b=>{if(!b.step(t))active.delete(b);});if(active.size)frame=request(tick);}
    return {
      schedule(b){active.add(b);if(frame===null)frame=request(tick);},
      unschedule(b){active.delete(b);if(!active.size&&frame!==null){cancel(frame);frame=null;}}
    };
  }
  const defaultClock=createClock(fn=>requestAnimationFrame(fn),id=>cancelAnimationFrame(id));
  const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  function bind(el,options={}){
    const kind=options.kind||'tension',targetControl=options.target||el;
    const {schedule,unschedule}=options.clock||defaultClock;
    if(!specs[kind])throw new Error('Unknown water hover: '+kind);
    if(owners.has(el))throw new Error('Dispose the existing water hover before rebinding.');
    if(el.children.length)throw new Error('Bind a plain text label, not structured or interactive children.');
    const text=el.textContent;
    if(!text.trim()||Array.from(text).length>160)throw new Error('Use a nonempty label of at most 160 characters.');
    const original=Array.from(el.childNodes),originalClass=el.getAttribute('class');
    const node=(cls,copy)=>{const n=document.createElement('span');n.className=cls;if(copy!==undefined)n.textContent=copy;return n;};
    const accessible=node('wh-accessible',text),visual=node('wh-visual');visual.setAttribute('aria-hidden','true');
    const chars=[];
    const segment=global.Intl?.Segmenter?new global.Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
    text.split(/(\s+)/u).forEach(word=>{
      if(/^\s+$/u.test(word)){visual.append(document.createTextNode(word));return;}
      const wrap=node('wh-word');
      const glyphs=segment?Array.from(segment.segment(word),s=>s.segment):Array.from(word);
      glyphs.forEach(glyph=>{const c=node('wh-char',glyph);let ink=null,echo=null;
        if(kind==='capillary'){ink=node('wh-ink',glyph);c.append(ink);}
        if(kind==='reflection'){echo=node('wh-reflection',glyph);c.append(echo);}
        chars.push({c,ink,echo});wrap.append(c);
      });visual.append(wrap);
    });
    el.replaceChildren(accessible,visual);el.classList.add('wh-bound','wh-'+kind);
    const reduced=matchMedia('(prefers-reduced-motion:reduce)'),forced=matchMedia('(forced-colors:active)');
    let dead=false,hover=false,focus=false,visible=true,strength=0,target=0,origin=.5,aim=.5,last=null,start=null,pulse=false,touch=false;
    const listeners=[],still=()=>!!options.reduced||!!options.isReduced?.()||targetControl.disabled||reduced.matches||forced.matches||document.hidden||!visible;
    function listen(object,event,fn,opts){object.addEventListener(event,fn,opts);listeners.push(()=>object.removeEventListener(event,fn,opts));}
    function paint(age=0){chars.forEach(({c,ink,echo},i)=>{
      const x=chars.length===1?.5:i/(chars.length-1),d=x-origin;
      let y=0,dx=0,rotation=0;
      if(kind==='tension'){const lift=Math.exp(-d*d/ .065);y=-.105*lift*strength;rotation=-d*9*lift*strength;}
      if(kind==='capillary')ink.style.clipPath='inset('+((1-ease((strength-.18*x)/.82))*100).toFixed(2)+'% 0 0)';
      if(kind==='ripple'&&pulse){const phase=(age-Math.abs(d)*460)/900;if(phase>0&&phase<1)y=-.16*Math.sin(phase*Math.PI*2)*Math.pow(1-phase,1.2)*strength;}
      if(kind==='current'&&pulse){const phase=clamp((age-x*280)/1100),flow=Math.sin(Math.PI*phase);dx=.14*flow*Math.cos(Math.PI*x)*strength;rotation=-4*flow*Math.sin(Math.PI*x)*strength;y=.025*flow*strength;}
      if(kind==='reflection'){y=-.025*strength;echo.style.opacity=(.18*strength).toFixed(3);echo.style.transform='translateY('+(.07*(1-strength)).toFixed(4)+'em) scaleY(-.48)';}
      c.style.transform=(y||dx||rotation)?'translate('+dx.toFixed(4)+'em,'+y.toFixed(4)+'em) rotate('+rotation.toFixed(3)+'deg)':'none';
    });}
    function reset(){unschedule(binding);last=start=null;strength=target=0;pulse=touch=false;hover=focus=false;paint();if(still())chars.forEach(({ink})=>{if(ink)ink.style.clipPath='none';});}
    function begin(){if(dead||still())return;target=1;start=last=null;pulse=true;schedule(binding);options.onEngage?.();}
    function release(){if(dead||still()){reset();return;}target=(hover||focus)?1:0;schedule(binding);}
    const binding={step(t){
      if(dead||still()){reset();return false;}
      if(start===null)start=t;const dt=last===null?16:Math.min(64,Math.max(0,t-last));last=t;
      const age=t-start;
      if(touch&&age>800){touch=false;target=(hover||focus)?1:0;}
      strength+=(target-strength)*(1-Math.exp(-dt/(target?150:210)));
      origin+=(aim-origin)*(1-Math.exp(-dt/95));
      if(Math.abs(target-strength)<.001)strength=target;if(Math.abs(aim-origin)<.001)origin=aim;
      if(age>=1450)pulse=false;
      paint(age);
      const moving=strength!==target||origin!==aim||touch||((kind==='ripple'||kind==='current')&&pulse);
      if(!moving)last=null;
      return moving;
    },settle:reset,dispose(){if(dead)return;dead=true;unschedule(binding);listeners.forEach(f=>f());io?.disconnect();el.replaceChildren(...original);if(originalClass===null)el.removeAttribute('class');else el.setAttribute('class',originalClass);owners.delete(el);}};
    function locate(e){const r=targetControl.getBoundingClientRect();aim=clamp((e.clientX-r.left)/Math.max(1,r.width));}
    listen(targetControl,'pointerenter',e=>{if(e.pointerType==='touch')return;hover=true;locate(e);origin=aim;begin();});
    listen(targetControl,'pointermove',e=>{if(!hover||still()||kind!=='tension')return;locate(e);schedule(binding);},{passive:true});
    listen(targetControl,'pointerleave',()=>{hover=false;release();});
    listen(targetControl,'pointercancel',()=>{hover=false;release();});
    listen(targetControl,'focus',()=>{focus=true;if(!hover){aim=.5;begin();}});
    listen(targetControl,'blur',()=>{focus=false;release();});
    listen(targetControl,'pointerdown',e=>{if(e.pointerType!=='touch')return;locate(e);origin=aim;touch=true;begin();},{passive:true});
    [reduced,forced].forEach(m=>listen(m,'change',reset));listen(document,'visibilitychange',()=>{if(document.hidden)reset();});
    const io=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)reset();},{root:options.root||null}):null;io?.observe(targetControl);
    owners.set(el,binding);paint();if(still())reset();return binding;
  }
  NS.waterHover={specs,css,bind,createClock};
})(window);
