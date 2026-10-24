/* Temporary visual scene for a Rainfield handoff. Text stays browser-rendered.
 * Only visible chapter roots are copied; no live IDs, listeners or controls survive.
 * Transparent media plates feed the same optics as the Lab. Never capture the DOM
 * into an image: the text layer and the refracted image layer stay independent. */
(function(){
  'use strict';
  var MA=window.MA;if(!MA)return;
  var cache=new Map();
  Object.entries((window.XIDemos&&XIDemos.waterSectionAssets)||{}).forEach(function(pair){
    var image=new Image();image.src=pair[1];cache.set(pair[0],image);
  });
  function frozenStyle(style,copy){
    var rules=[];
    for(var i=0;i<style.length;i++){var key=style[i];rules.push(key+':'+style.getPropertyValue(key)+'!important');}
    copy.style.cssText=rules.join(';');
    copy.style.setProperty('animation','none','important');copy.style.setProperty('transition','none','important');
    copy.style.setProperty('pointer-events','none','important');
    // Remove identity and behavior hooks before attaching the visual copy.
    Array.from(copy.attributes).forEach(function(a){if(a.name!=='style'&&a.name!=='src'&&a.name!=='width'&&a.name!=='height'&&a.name!=='viewBox'&&a.name!=='d'&&a.name!=='fill'&&a.name!=='stroke'&&a.name!=='stroke-width'&&a.name!=='xmlns')copy.removeAttribute(a.name);});
    return style;
  }
  function capture(options){
    options=options||{};
    // Capture complete readings on both sides of the navigation handoff.
    if(MA.textWater)MA.textWater.settleVisible();
    var w=innerWidth,h=innerHeight,scale=Math.min(1.5,window.devicePixelRatio||1,1600/w,Math.sqrt(1500000/(w*h)));
    var y=window.scrollY;
    document.querySelectorAll('.ch02-studies').forEach(function(el){if(el.__lens&&el.__lens.settleForNavigation)el.__lens.settleForNavigation();});
    var layer=document.createElement('div');layer.className='ma-rainfield-source';layer.setAttribute('aria-hidden','true');layer.inert=true;
    layer.style.background=getComputedStyle(document.documentElement).getPropertyValue('--ground').trim();
    // Preserve sticky layout in an inert, stationary scrollport at the old offset.
    var plane=document.createElement('div');plane.style.cssText='position:relative;width:100%;height:'+document.documentElement.scrollHeight+'px';layer.appendChild(plane);
    var plate=document.createElement('canvas');plate.width=Math.max(1,Math.round(w*scale));plate.height=Math.max(1,Math.round(h*scale));
    var ink=plate.getContext('2d'),mediaCount=0,painted=new Map();
    if(ink)ink.setTransform(scale,0,0,scale,0,0);
    function visible(r){return r.width>0&&r.height>0&&r.bottom>0&&r.top<h&&r.left+r.width>0&&r.left<w;}
    function bitmap(source){
      if(painted.has(source))return painted.get(source);
      var image=null;
      if(source.tagName==='IMG'){
        var key=source.getAttribute('data-asset')||(source.getAttribute('src')||'').split('/').pop();
        var safe=cache.get(key);
        if(safe&&safe.complete&&safe.naturalWidth)image=safe;
        else if((source.currentSrc||source.src||'').startsWith('data:')&&source.complete)image=source;
      }
      painted.set(source,image);return image;
    }
    function media(source,style,r){
      if(!ink||!visible(r)||style.display==='none'||style.visibility==='hidden')return;
      var image=bitmap(source);if(!image)return;
      var iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;if(!iw||!ih)return;
      var cover=style.objectFit==='cover',contain=style.objectFit==='contain',fit=cover?Math.max(r.width/iw,r.height/ih):Math.min(r.width/iw,r.height/ih);
      var dw=cover||contain?iw*fit:r.width,dh=cover||contain?ih*fit:r.height;
      var pos=(style.objectPosition||'50% 50%').split(' '),px=parseFloat(pos[0])/100,py=parseFloat(pos[1]||pos[0])/100;
      if(!Number.isFinite(px))px=.5;if(!Number.isFinite(py))py=.5;
      var x=r.left+(r.width-dw)*px,y=r.top+(r.height-dh)*py;
      ink.save();ink.beginPath();ink.rect(r.left,r.top,r.width,r.height);ink.clip();
      var opacity=1,ancestor=source;
      while(ancestor&&ancestor!==document.body){opacity*=Number(getComputedStyle(ancestor).opacity);ancestor=ancestor.parentElement;}
      ink.globalAlpha=opacity;
      // Spring's authored feather is retained in the bitmap used for refraction.
      if(source.closest('.ch04-spring')){
        var tile=document.createElement('canvas');tile.width=Math.max(1,Math.round(r.width*scale));tile.height=Math.max(1,Math.round(r.height*scale));
        var g=tile.getContext('2d');g.drawImage(image,(x-r.left)*scale,(y-r.top)*scale,dw*scale,dh*scale);g.globalCompositeOperation='destination-in';
        var vertical=g.createLinearGradient(0,0,0,tile.height);vertical.addColorStop(0,'transparent');vertical.addColorStop(.1,'black');vertical.addColorStop(1,'black');g.fillStyle=vertical;g.fillRect(0,0,tile.width,tile.height);
        var horizontal=g.createLinearGradient(0,0,tile.width,0);horizontal.addColorStop(0,'transparent');horizontal.addColorStop(.09,'black');horizontal.addColorStop(.91,'black');horizontal.addColorStop(1,'transparent');g.fillStyle=horizontal;g.fillRect(0,0,tile.width,tile.height);
        ink.drawImage(tile,r.left,r.top,r.width,r.height);
      }else ink.drawImage(image,x,y,dw,dh);
      ink.restore();mediaCount++;
    }
    function copyTree(source){
      if(source.nodeType!==1)return source.cloneNode(false);
      if(source.matches('script,style,.ma-section-optics,.ma-section-rim,.ch02-lens-canvas'))return null;
      var style=getComputedStyle(source);if(style.display==='none'||style.visibility==='hidden')return null;
      var copy=source.cloneNode(false);frozenStyle(style,copy);
      if(source.tagName==='CANVAS'){
        var image=bitmap(source);if(image){copy.width=image.width;copy.height=image.height;copy.getContext('2d').drawImage(image,0,0);}
      }
      if('value' in source)copy.value=source.value;if('checked' in source)copy.checked=source.checked;
      Array.from(source.childNodes).forEach(function(child){var next=copyTree(child);if(next)copy.appendChild(next);});
      return copy;
    }
    var roots=Array.from(document.querySelectorAll('#ma-main > .ma-ch,#ma-main > [data-mount] > .ma-ch,#ma-footer'));
    roots.forEach(function(source){
      var r=source.getBoundingClientRect();if(!visible(r))return;
      source.querySelectorAll('img,canvas').forEach(function(el){
        // Hidden fallback media and decorative graphics never enter the optical plate.
        if(el.closest('[hidden]')||el.classList.contains('ma-section-optics'))return;
        media(el,getComputedStyle(el),el.getBoundingClientRect());
      });
      if(options.mediaOnly)return;
      var copy=copyTree(source);if(!copy)return;
      Object.entries({position:'absolute',left:r.left+'px',top:(r.top+y)+'px',width:r.width+'px',height:r.height+'px',margin:'0',transform:'none',filter:'none','clip-path':'none'}).forEach(function(pair){copy.style.setProperty(pair[0],pair[1],'important');});
      plane.appendChild(copy);
    });
    return{element:layer,plate:plate,mediaCount:mediaCount,activate:function(){layer.scrollTop=y;},dispose:function(){layer.remove();plate.width=1;plate.height=1;}};
  }
  MA.rainScene={capture:capture};
})();
