/* Original Ma water text scores. DOM text, one caller-owned clock, no idle simulation. */
(function(global){
  'use strict';
  const NS=global.XIDemos=global.XIDemos||{};
  const specs={
    waterline:{name:'Waterline',duration:1900,note:'A shallow crest lifts through the words, leaving a clear surface.'},
    capillary:{name:'Capillary Ink',duration:2100,note:'Ink climbs each word as water travels through a slender stem.'},
    ripple:{name:'Ripple Script',duration:2000,note:'A single reading opens from the centre, with a soft outward recoil.'},
    undertow:{name:'Undertow',duration:1800,note:'Words drift against the current, then find their exact resting place.'},
    meniscus:{name:'Meniscus',duration:2000,note:'A gently curved baseline relaxes into a quiet, level sentence.'},
    rainfall:{name:'Rainfall',duration:2200,note:'Words arrive in scattered drops; every landing softens into stillness.'},
    confluence:{name:'Confluence',duration:1900,note:'Two currents meet in the middle and resolve into one thought.'},
    reflection:{name:'Reflection',duration:2100,note:'An inverted trace recedes as the words emerge above the water.'},
    silk:{name:'Silk Current',duration:2200,note:'A low, travelling fold passes through the sentence and releases it.'},
    dewpoint:{name:'Dewpoint',duration:2200,note:'Small clear openings gather across the words, then become one reading.'},
    backwash:{name:'Backwash',duration:2300,note:'A sheet of water draws back from the far edge, uncovering the words in its wake.'},
    eddy:{name:'Eddy',duration:2400,note:'Words follow a small curling current, unwinding gently into their resting places.'},
    springwell:{name:'Springwell',duration:2300,note:'A narrow opening wells up from within the sentence, lifting and releasing the words.'}
  };
  const clamp=x=>Math.max(0,Math.min(1,x));
  const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const fmt=x=>Number(x.toFixed(4));
  function score(kind,p,i,n){
    p=clamp(p);const u=n>1?i/(n-1):.5,dist=Math.abs(u-.5)*2,seed=((i*37+13)%101)/101;
    let lag=u*.26;
    if(kind==='ripple')lag=dist*.3;
    if(kind==='confluence')lag=(1-dist)*.24;
    if(kind==='rainfall'||kind==='dewpoint')lag=seed*.38;
    if(kind==='backwash')lag=(1-u)*.28;
    if(kind==='eddy')lag=u*.18;
    if(kind==='springwell')lag=dist*.22;
    const q=clamp((p-lag)/(1-lag)),e=ease(q),tail=1-e;
    let x=0,y=0,rotate=0,skew=0,sx=1,sy=1,opacity=ease(q/.52),clip='none',echo=0;
    if(kind==='waterline'){y=.12*tail;opacity=1;}
    if(kind==='capillary'){clip=`inset(${fmt(105*(1-e))}% -8% -18% -8%)`;y=.12*tail;opacity=1;}
    if(kind==='ripple'){y=-Math.sin(q*Math.PI*2)*.15*tail;sx=sy=1-.12*tail;}
    if(kind==='undertow'){x=.65*tail;y=Math.sin(q*Math.PI)*.1;skew=-7*tail;}
    if(kind==='meniscus'){y=(.36-dist*.65)*tail;rotate=(u-.5)*9*tail;opacity=ease(p/.7);}
    if(kind==='rainfall'){y=-.9*tail+Math.sin(q*Math.PI*2)*.13*tail;sy=1-Math.sin(q*Math.PI)*.08;}
    if(kind==='confluence'){x=(u-.5)*1.25*tail;y=.06*Math.sin(q*Math.PI);}
    if(kind==='reflection'){y=.28*tail;echo=Math.sin(q*Math.PI)*.19;}
    if(kind==='silk'){y=Math.sin(q*Math.PI*2)*.24*tail;skew=Math.sin(q*Math.PI*2)*9*tail;sx=1+.05*Math.sin(q*Math.PI)*tail;}
    if(kind==='dewpoint'){clip=`circle(${fmt(e*150)}% at ${fmt(30+seed*40)}% 60%)`;sx=sy=.96+.04*e;opacity=1;}
    if(kind==='backwash'){x=-.2*tail;y=.045*Math.sin(q*Math.PI);opacity=1;}
    if(kind==='eddy'){
      // One shrinking arc, never a spinning glyph or a perpetual orbit.
      const angle=q*Math.PI*1.4+u*.8;
      x=.3*tail*Math.cos(angle);y=.24*tail*Math.sin(angle);
      rotate=6*tail*Math.sin(angle);sx=sy=1-.06*tail;
    }
    if(kind==='springwell'){y=.3*tail-.12*Math.sin(q*Math.PI);sy=1-.16*tail;x=(u-.5)*.1*tail;opacity=1;}
    if(p===1)return {transform:'none',opacity:1,clip:'none',echo:0};
    return {transform:`translate(${fmt(x)}em,${fmt(y)}em) rotate(${fmt(rotate)}deg) skewX(${fmt(skew)}deg) scale(${fmt(sx)},${fmt(sy)})`,opacity:fmt(opacity),clip,echo:fmt(echo)};
  }
  function boundary(kind,p){
    if(p>=1)return 'none';
    if(kind==='ripple')return `circle(${fmt(ease(p)*150)}% at 50% 50%)`;
    if(kind==='springwell')return `ellipse(85% ${fmt(ease(p)*115)}% at 50% 72%)`;
    if(kind==='backwash'){
      const points=[],edge=110-125*ease(p),bend=5*Math.sin(p*Math.PI);
      for(let i=0;i<=24;i++){const y=i/24;points.push(`${fmt(edge+Math.sin(y*Math.PI*2+p*2)*bend)}% ${fmt(y*100)}%`);}
      return `polygon(${points.join(',')},115% 100%,115% 0%)`;
    }
    if(kind!=='waterline')return 'none';
    const points=[],base=112-130*ease(p),amp=5*Math.sin(p*Math.PI);
    for(let i=0;i<=24;i++){const x=i/24;points.push(`${fmt(x*100)}% ${fmt(base+Math.sin(x*Math.PI*2-p*3)*amp)}%`);}
    return `polygon(${points.join(',')},100% 120%,0% 120%)`;
  }
  const css=`
.wr-visual{display:block;position:relative;overflow:visible}
.wr-word{position:relative;display:inline-block;transform-origin:50% 70%;white-space:pre-wrap;max-width:100%;overflow-wrap:anywhere;vertical-align:baseline}
.wr-echo{position:absolute;left:0;top:85%;transform:scaleY(-.68);transform-origin:center;pointer-events:none;user-select:none;opacity:0}
.wr-accessible{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media(prefers-reduced-motion:reduce),(forced-colors:active){.wr-visual,.wr-word{transform:none!important;opacity:1!important;clip-path:none!important}.wr-echo{display:none!important}}
`;
  // Leaf only: no structured controls or interactive descendants may be split.
  function bind(el,{kind='waterline'}={}){
    if(!specs[kind])throw new Error('Unknown water text score: '+kind);
    if(el.children.length)throw new Error('Water text requires a plain-text leaf.');
    const original=el.textContent,parts=original.split(/(\s+)/),words=parts.filter(s=>s&&!/^\s+$/.test(s));
    if(words.length>160)throw new Error('Water text is bounded to 160 words per leaf.');
    const visual=document.createElement('span');visual.className='wr-visual';visual.setAttribute('aria-hidden','true');
    const accessible=document.createElement('span');accessible.className='wr-accessible';accessible.textContent=original;
    const nodes=[],echoes=[];
    parts.forEach(part=>{
      if(!part||/^\s+$/.test(part)){visual.append(document.createTextNode(part));return;}
      const word=document.createElement('span');word.className='wr-word';word.textContent=part;visual.append(word);nodes.push(word);
      if(kind==='reflection'){const echo=document.createElement('span');echo.className='wr-echo';echo.textContent=part;word.append(echo);echoes.push(echo);}
    });
    el.replaceChildren(accessible,visual);let disposed=false;
    function render(p){if(disposed)return;p=Number.isFinite(p)?clamp(p):1;visual.style.clipPath=boundary(kind,p);nodes.forEach((word,i)=>{const s=score(kind,p,i,nodes.length);word.style.transform=s.transform;word.style.opacity=s.opacity;word.style.clipPath=s.clip;if(echoes[i])echoes[i].style.opacity=s.echo;});}
    render(1);
    return {render,dispose(){if(disposed)return;disposed=true;el.textContent=original;}};
  }
  NS.waterText={specs,score,boundary,bind,css};
})(window);
