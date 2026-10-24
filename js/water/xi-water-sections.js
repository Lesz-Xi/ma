/* XI water section optics. Scroll is the only clock; this renderer never schedules frames.
   Shared signed fields drive native section masks and local image refraction. */
(function(global){
  'use strict';
  const NS=global.XIDemos=global.XIDemos||{demos:{},u:{}};
  const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x));
  const specs={
    shoreline:{name:'Shoreline',index:0,note:'A shallow waterline lifts the next section into view. A narrow crest bends the image as it passes.'},
    stillwater:{name:'Stillwater',index:1,note:'One quiet pool opens outward. Its circular rim carries a soft refraction, then releases the surface.'},
    silkfold:{name:'Silk Fold',index:2,note:'A slender, sinuous seam parts from the centre. The next composition rests beneath a folding sheet of water.'},
    confluence:{name:'Confluence',index:3,note:'Two curved currents approach from the sides. Their meeting leaves one fine ripple across the centre.'},
    slipstream:{name:'Slipstream',index:4,note:'A diagonal current carries the section through three close-set wakes. The image briefly follows their direction.'},
    rainfield:{name:'Rainfield',index:5,note:'Five small pools open at different depths. Circular ripples meet and leave the next section still.'},
    suspension:{name:'Suspension',index:6,note:'A water skin holds at the upper edge, bows under its own weight, then releases the next composition.'},
    mirrorband:{name:'Mirrorband',index:7,note:'A narrow reflection at the horizon opens equally upward and downward, then settles into one clear surface.'},
    capillarydelta:{name:'Capillary Delta',index:8,note:'Three fine channels descend through the paper, broaden, and join into one quiet field.'},
    undertow:{name:'Undertow',index:9,note:'A curved current draws the next section in from the right, with its wake held close to the edge.'}
  };
  const drops=[[.19,.24,0],[.73,.32,.08],[.46,.65,.035],[.88,.82,.13],[.12,.88,.18]];
  function phase(p){return clamp((clamp(p)-.12)/.76);}
  function pools(progress,w,h){
    const t=phase(progress),far=Math.hypot(w,h)*.79;
    return drops.map(([x,y,delay])=>({x:x*w,y:y*h,r:Math.max(0,-.025*h+(far+.025*h)*clamp((t-delay)/(1-delay)))}));
  }
  function radius(p,a,cx,cy){return Math.hypot(Math.max(cx,1-cx)*a,Math.max(cy,1-cy))+.05;}
  function boundary(kind,t,v,a){
    const e=Math.sin(t*Math.PI);
    if(kind==='shoreline')return 1.08-1.16*t+e*(Math.sin(v*TAU+t*2)*.033+Math.sin(v*TAU*2.1-t*2)*.009);
    if(kind==='silkfold')return .5+Math.sin(v*5.4-t*2)*.07*e;
    if(kind==='confluence')return .055*Math.sin(v*5.5+t*2)*e;
    if(kind==='suspension')return -.12+1.3*t+e*(.065*Math.sin(v*Math.PI)+.014*Math.sin(v*TAU*2+t));
    if(kind==='mirrorband')return .52+.028*Math.sin(v*5-t)*e;
    if(kind==='undertow')return 1.14-1.28*t+e*(.075*Math.sin(v*4.8+t)+.012*Math.sin(v*12-t));
    return 1.23-1.46*t-v*.24+Math.sin(v*5-t*2)*.025*e;
  }
  function channel(i,t,v){
    const base=[.18,.5,.82][i];
    return base+Math.sin(v*5.5+t*2+i*1.7)*.045*Math.sin(t*Math.PI);
  }
  function channelFront(i,t){return -.1+1.24*t-[0,.085,.045][i]*Math.sin(t*Math.PI);}
  function channelHalf(t){return -.018+.25*t;}
  // Points are in CSS pixels; circles use a height-normalized distance to stay round.
  function geometry(kind,progress,w,h){
    const t=phase(progress),a=w/h,fmt=x=>Number(x.toFixed(3)),pt=(x,y)=>fmt(x*w)+' '+fmt(y*h);
    if(t===0)return 'M0 0Z';
    if(t===1)return 'M0 0H'+w+'V'+h+'H0Z';
    function circle(x,y,r){r=Math.max(0,r)*h;return 'M'+fmt(x*w-r)+' '+fmt(y*h)+'a'+fmt(r)+' '+fmt(r)+' 0 1 0 '+fmt(2*r)+' 0a'+fmt(r)+' '+fmt(r)+' 0 1 0 '+fmt(-2*r)+' 0Z';}
    if(kind==='stillwater')return circle(.62,.52,-.04+(radius(t,a,.62,.52)+.04)*t);
    if(kind==='rainfield')return drops.map(([x,y,d])=>circle(x,y,Math.max(0,(-.025+(Math.hypot(a,1)*.79+.025)*clamp((t-d)/(1-d)))))).join('');
    const n=72;
    if(kind==='suspension'||kind==='mirrorband'){
      let d='M'+pt(0,kind==='suspension'?-0.2:boundary(kind,t,0,a)-(-.018+t*.64));
      for(let i=0;i<=n;i++){
        const v=i/n,b=boundary(kind,t,v,a);
        d+='L'+pt(v,kind==='suspension'?b:b-(-.018+t*.64));
      }
      if(kind==='suspension')return d+'L'+pt(1,-.2)+'Z';
      for(let i=n;i>=0;i--){const v=i/n;d+='L'+pt(v,boundary(kind,t,v,a)+(-.018+t*.64));}
      return d+'Z';
    }
    if(kind==='capillarydelta'){
      const half=channelHalf(t);if(half<=0)return 'M0 0Z';
      return [0,1,2].map(i=>{
        const front=channelFront(i,t),steps=Math.max(2,Math.round(n*Math.max(0,front)));
        let d='M'+pt(channel(i,t,0)-half,-.2);
        for(let j=0;j<=steps;j++){const v=front*j/steps;d+='L'+pt(channel(i,t,v)-half,v);}
        for(let j=steps;j>=0;j--){const v=front*j/steps;d+='L'+pt(channel(i,t,v)+half,v);}
        return d+'L'+pt(channel(i,t,0)+half,-.2)+'Z';
      }).join('');
    }
    if(kind==='undertow'){
      let d='M'+pt(1.2,0)+'L'+pt(boundary(kind,t,0,a),0);
      for(let i=1;i<=n;i++)d+='L'+pt(boundary(kind,t,i/n,a),i/n);
      return d+'L'+pt(1.2,1)+'Z';
    }
    if(kind==='shoreline'||kind==='slipstream'){
      let d='M'+pt(0,1.2)+'L'+pt(0,boundary(kind,t,0,a));
      for(let i=1;i<=n;i++)d+='L'+pt(i/n,boundary(kind,t,i/n,a));
      return d+'L'+pt(1,1.2)+'Z';
    }
    const half=-.015+t*.66;
    if(kind==='silkfold'){
      let d='M'+pt(boundary(kind,t,0,a)-half,0);
      for(let i=1;i<=n;i++)d+='L'+pt(boundary(kind,t,i/n,a)-half,i/n);
      for(let i=n;i>=0;i--)d+='L'+pt(boundary(kind,t,i/n,a)+half,i/n);
      return half<=0?'M0 0Z':d+'Z';
    }
    let left='M'+pt(-.2,0),right='M'+pt(1.2,0);
    for(let i=0;i<=n;i++){
      const v=i/n,b=boundary(kind,t,v,a);
      left+='L'+pt(half+b,v);right+='L'+pt(1-half+b,v);
    }
    return left+'L'+pt(-.2,1)+'Z'+right+'L'+pt(1.2,1)+'Z';
  }
  // Open contours for a hairline meniscus. Same field as the DOM mask and optics;
  // no rectangle closing strokes across the content or second motion clock.
  function contour(kind,progress,w,h){
    const t=phase(progress),a=w/h,pt=(x,y)=>(x*w).toFixed(3)+' '+(y*h).toFixed(3);
    if(t===0||t===1)return '';
    if(kind==='rainfield'||kind==='stillwater')return geometry(kind,progress,w,h);
    function line(xy){let d='';for(let i=0;i<=72;i++)d+=(i?'L':'M')+pt(...xy(i/72));return d;}
    if(kind==='shoreline'||kind==='slipstream')return line(v=>[v,boundary(kind,t,v,a)]);
    if(kind==='suspension')return line(v=>[v,boundary(kind,t,v,a)]);
    if(kind==='mirrorband'){
      const half=-.018+t*.64;if(half<=0)return '';
      return [-1,1].map(s=>line(v=>[v,boundary(kind,t,v,a)+s*half])).join('');
    }
    if(kind==='capillarydelta'){
      const half=channelHalf(t);if(half<=0)return '';
      return [0,1,2].map(i=>[-1,1].map(s=>{
        let d='';const front=Math.max(0,channelFront(i,t));
        for(let j=0;j<=72;j++){const v=front*j/72;d+=(j?'L':'M')+pt(channel(i,t,v)+s*half,v);}
        return d;
      }).join('')).join('');
    }
    if(kind==='undertow')return line(v=>[boundary(kind,t,v,a),v]);
    const half=-.015+t*.66;
    if(half<=0)return '';
    if(kind==='silkfold')return [-1,1].map(s=>line(v=>[boundary(kind,t,v,a)+s*half,v])).join('');
    return line(v=>[half+boundary(kind,t,v,a),v])+line(v=>[1-half+boundary(kind,t,v,a),v]);
  }
  const VS='attribute vec2 point;varying vec2 uv;void main(){uv=vec2(point.x,1.-point.y);gl_Position=vec4(point*2.-1.,0.,1.);}';
  const FS=`precision highp float;
    varying vec2 uv;uniform sampler2D sourceA,sourceB;
    uniform float progress,kind,aspect,strength,cover,plates;uniform vec4 rect,feather;
    uniform vec2 sizeA,sizeB,resolution;uniform vec3 groundA,groundB;
    const float PI=3.14159265359;
    float sat(float v){return clamp(v,0.,1.);}
    float ring(vec2 q,vec2 c,float r){return length((q-c)*vec2(aspect,1.))-r;}
    float drop(vec2 q,vec2 c,float delay,float t){return ring(q,c,max(0.,mix(-.025,length(vec2(aspect,1.))*.79,sat((t-delay)/(1.-delay)))));}
    float field(vec2 q,float t){
      float e=sin(t*PI);
      if(kind<.5){float b=1.08-1.16*t+e*(sin(q.x*6.283185+t*2.)*.033+sin(q.x*6.283185*2.1-t*2.)*.009);return b-q.y;}
      if(kind<1.5){float far=length(vec2(.62*aspect,.52))+.05;return ring(q,vec2(.62,.52),mix(-.04,far,t));}
      if(kind<2.5){float c=.5+sin(q.y*5.4-t*2.)*.07*e;return (abs(q.x-c)-(-.015+t*.66))*aspect;}
      if(kind<3.5){float b=.055*sin(q.y*5.5+t*2.)*e,breadth=-.015+t*.66;return min(q.x-breadth-b,1.-breadth+b-q.x)*aspect;}
      if(kind<4.5)return 1.23-1.46*t-q.x*.24+sin(q.x*5.-t*2.)*.025*e-q.y;
      if(kind<5.5){
        float d=drop(q,vec2(.19,.24),0.,t);
        d=min(d,drop(q,vec2(.73,.32),.08,t));d=min(d,drop(q,vec2(.46,.65),.035,t));
        d=min(d,drop(q,vec2(.88,.82),.13,t));return min(d,drop(q,vec2(.12,.88),.18,t));
      }
      if(kind<6.5){float b=-.12+1.3*t+e*(.065*sin(q.x*PI)+.014*sin(q.x*PI*4.+t));return q.y-b;}
      if(kind<7.5){float c=.52+.028*sin(q.x*5.-t)*e;return abs(q.y-c)-(-.018+t*.64);}
      if(kind<8.5){
        float half=-.018+.25*t;
        float c0=.18+sin(q.y*5.5+t*2.)*.045*e;
        float c1=.5+sin(q.y*5.5+t*2.+1.7)*.045*e;
        float c2=.82+sin(q.y*5.5+t*2.+3.4)*.045*e;
        float d0=max((abs(q.x-c0)-half)*aspect,q.y-(-.1+1.24*t));
        float d1=max((abs(q.x-c1)-half)*aspect,q.y-(-.1+1.24*t-.085*e));
        float d2=max((abs(q.x-c2)-half)*aspect,q.y-(-.1+1.24*t-.045*e));
        return min(d0,min(d1,d2));
      }
      float b=1.14-1.28*t+e*(.075*sin(q.y*4.8+t)+.012*sin(q.y*12.-t));return b-q.x;
    }
    vec3 samplePlate(sampler2D image,vec2 q,vec2 size,vec3 ground){
      vec2 local=(q-rect.xy)/rect.zw;
      vec2 area=rect.zw*resolution;
      float fit=mix(min(area.x/size.x,area.y/size.y),max(area.x/size.x,area.y/size.y),cover);
      vec2 extent=size*fit/area;vec2 p=(local-.5)/extent+.5;
      if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)return ground;
      return texture2D(image,p).rgb;
    }
    void main(){
      if(uv.x<rect.x||uv.x>rect.x+rect.z||uv.y<rect.y||uv.y>rect.y+rect.w)discard;
      float t=sat((progress-.12)/.76),d=field(uv,t);
      vec2 eps=1./resolution;
      vec2 n=vec2((field(uv+vec2(eps.x,0.),t)-field(uv-vec2(eps.x,0.),t))/aspect,field(uv+vec2(0.,eps.y),t)-field(uv-vec2(0.,eps.y),t));
      n/=max(length(n),.00001);
      float band=d/.04;float crest=exp(-band*band);
      float wake=sin(d*112.)*exp(-abs(d)*22.);
      float envelope=sin(t*PI);
      vec2 shift=n/vec2(aspect,1.)*(crest*.018+wake*.005)*envelope*strength;
      // A position-bound circular after-ripple overlaps the reveal's finish.
      float tail=sat((progress-.67)/.33);
      float r=length((uv-vec2(.62,.52))*vec2(aspect,1.));
      float tailBand=(r-tail*.95)/.11;
      float pulse=sin((r-tail*.95)*65.)*exp(-tailBand*tailBand)*sin(tail*PI)*.006;
      shift+=(uv-vec2(.62,.52))/max(r,.001)*pulse*strength;
      float m=t<=0.?0.:t>=1.?1.:1.-smoothstep(-.002,.002,d);
      // Navigation plates contain only real media at their viewport positions.
      // Native text remains in DOM layers; use the identical Rainfield optics.
      if(plates>.5){
        vec4 a=texture2D(sourceA,clamp(uv+shift*.4,0.,1.)),b=texture2D(sourceB,clamp(uv-shift,0.,1.));
        float alpha=mix(a.a,b.a,m);
        vec3 rgb=mix(a.rgb*a.a,b.rgb*b.a,m)/max(alpha,.00001);
        float glint=(crest*.022+wake*.012)*envelope*strength;
        gl_FragColor=vec4(clamp(rgb+glint,0.,1.),alpha);return;
      }
      vec3 a=samplePlate(sourceA,uv+shift*.4,sizeA,groundA),b=samplePlate(sourceB,uv-shift,sizeB,groundB);
      vec3 color=mix(a,b,m);float glint=(crest*.022+wake*.012)*envelope*strength;
      vec2 local=(uv-rect.xy)/rect.zw;
      float alpha=min(1.,local.y/max(feather.x,.00001))*min(1.,(1.-local.x)/max(feather.y,.00001))*min(1.,(1.-local.y)/max(feather.z,.00001))*min(1.,local.x/max(feather.w,.00001));
      gl_FragColor=vec4(clamp(color+glint,0.,1.),alpha);
    }`;
  function create(canvas,images,options={}){
    const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
    if(!gl)throw Error('WebGL unavailable');
    let dead=false,program,buffer;const shaders=[],textures=[];
    function cleanup(){textures.forEach(x=>gl.deleteTexture(x));shaders.forEach(x=>gl.deleteShader(x));if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}
    try{
      function compile(type,source){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
      program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VS));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);
      const point=gl.getAttribLocation(program,'point');gl.enableVertexAttribArray(point);gl.vertexAttribPointer(point,2,gl.FLOAT,false,0,0);
      images.forEach(img=>{const tex=gl.createTexture();textures.push(tex);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);let source=img;const cap=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE));if(Math.max(img.naturalWidth,img.naturalHeight)>cap){source=document.createElement('canvas');const scale=cap/Math.max(img.naturalWidth,img.naturalHeight);source.width=Math.max(1,Math.round(img.naturalWidth*scale));source.height=Math.max(1,Math.round(img.naturalHeight*scale));source.getContext('2d').drawImage(img,0,0,source.width,source.height);}gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);if(gl.getError()!==gl.NO_ERROR)throw Error('Texture upload failed');});
    }catch(e){cleanup();throw e;}
    const loc={};['sourceA','sourceB','progress','kind','aspect','strength','rect','sizeA','sizeB','resolution','groundA','groundB','cover','feather','plates'].forEach(k=>loc[k]=gl.getUniformLocation(program,k));
    let draws=0;
    return {
      draw({progress,from,to,width,height,rect,grounds,strength=1,cover=false,feather=[0,0,0,0],clear=true,plates=false}){
        if(dead||gl.isContextLost())return;
        const dpr=Math.min(global.devicePixelRatio||1,1.5,1600/width);
        const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
        gl.viewport(0,0,w,h);gl.useProgram(program);
        // Rectangles never overlap; preserve straight alpha for native-image edge masks.
        gl.disable(gl.BLEND);
        if(clear){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}
        [from,to].forEach((index,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[index]);gl.uniform1i(loc[i?'sourceB':'sourceA'],i);gl.uniform2f(loc[i?'sizeB':'sizeA'],images[index].naturalWidth||images[index].width,images[index].naturalHeight||images[index].height);gl.uniform3fv(loc[i?'groundB':'groundA'],grounds[index]);});
        gl.uniform1f(loc.plates,plates?1:0);
        gl.uniform1f(loc.progress,progress);gl.uniform1f(loc.kind,specs[options.kind].index);gl.uniform1f(loc.aspect,width/height);gl.uniform1f(loc.strength,strength);gl.uniform1f(loc.cover,cover?1:0);gl.uniform4fv(loc.feather,feather);gl.uniform2f(loc.resolution,width,height);gl.uniform4fv(loc.rect,rect);gl.drawArrays(gl.TRIANGLES,0,6);draws++;
      },
      stats(){return{draws,disposed:dead};},
      dispose(releaseContext=false){if(dead)return;dead=true;cleanup();if(releaseContext)gl.getExtension('WEBGL_lose_context')?.loseContext();}
    };
  }
  NS.waterSections={specs,phase,geometry,contour,pools,create};
})(window);
