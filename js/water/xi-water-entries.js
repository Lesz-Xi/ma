/* Shared Ma arrival geometry. Lab and template use the same shapes and timing. */
(function(global){
  'use strict';
  const NS=global.XIDemos=global.XIDemos||{};
  const specs={
    drop:{name:'First Drop',duration:2400,note:'One point becomes a pool. Two fine ripples carry the arrival outward.'},
    tide:{name:'Quiet Tide',duration:2600,note:'A shallow waterline rises, leaving the composition quietly behind it.'},
    capillary:{name:'Capillary',duration:2700,note:'A slender seam gathers vertically, then parts into open space.'},
    tension:{name:'Surface Tension',duration:2500,note:'A low oval stretches across the paper, then releases into a clear surface.'}
  };
  const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);},fmt=x=>Number(x.toFixed(3));
  function ellipse(cx,cy,rx,ry){return `M${fmt(cx-rx)} ${fmt(cy)}a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(rx*2)} 0a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(-rx*2)} 0Z`;}
  function geometry(kind,p,w,h){
    p=clamp(p);const t=ease((p-.12)/.8),cx=w*.5,cy=h*.5,far=Math.hypot(w,h)*.53;
    let opening='M0 0Z',rim='',echo='';
    if(kind==='drop'){
      const r=far*t;opening=ellipse(cx,cy,r,r);rim=opening;
      if(p>.22&&p<.96){const q=ease((p-.22)/.74);echo=ellipse(cx,cy,far*q*.84,far*q*.84)+ellipse(cx,cy,far*q*.67,far*q*.67);}
    }else if(kind==='tide'){
      let line='';for(let i=0;i<=72;i++){const x=i/72,y=h*(1.03-1.08*t+Math.sin(t*Math.PI)*(.023*Math.sin(x*Math.PI*2+t*2)+.008*Math.sin(x*13-t*3)));line+=(i?'L':'M')+fmt(x*w)+' '+fmt(y);}
      rim=line;opening=line+'L'+w+' '+h+'L0 '+h+'Z';
    }else if(kind==='capillary'){
      const grow=ease(p/.38),spread=ease((p-.32)/.62),half=w*.62*spread;
      let left='';for(let i=0;i<=72;i++){const v=i/72,y=cy+(v-.5)*h*1.04*grow,x=cx+Math.sin(v*5.4-spread*2)*w*.025*Math.sin(spread*Math.PI);left+=(i?'L':'M')+fmt(x-half)+' '+fmt(y);}
      // Reverse the second edge with its own ordered sample list.
      const edge=[];for(let i=72;i>=0;i--){const v=i/72,y=cy+(v-.5)*h*1.04*grow,x=cx+Math.sin(v*5.4-spread*2)*w*.025*Math.sin(spread*Math.PI);edge.push(fmt(x+half)+' '+fmt(y));}
      opening=left+'L'+edge.join('L')+'Z';rim=left+'M'+edge.join('L');
    }else if(kind==='tension'){
      const rx=far*(.12+.88*t),ry=far*t*t;opening=ellipse(cx,cy,rx,ry);rim=opening;
      if(p>.25&&p<.95)echo=ellipse(cx,cy,rx*.92,ry*.82);
    }
    if(p<=.12&&kind!=='capillary')opening='M0 0Z';
    if(p>=1){opening=`M0 0H${w}V${h}H0Z`;rim='';echo='';}
    return{opening,rim,echo,mark:1-ease((p-.1)/.24),edge:Math.sin(clamp(p)*Math.PI)*.28,echoAlpha:Math.sin(clamp((p-.2)/.8)*Math.PI)*.12};
  }
  NS.waterEntries={specs,geometry};
})(window);
