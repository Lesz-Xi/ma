/* XI water transitions — Ma optics and seven authored variations.
 * Pixels are refracted; labels and semantic images remain native DOM.
 */
(function(global){
  'use strict';
  const NS=global.XIDemos=global.XIDemos||{demos:{},u:{}};
  const specs={
    lens:{name:'Ma Lens',duration:1250,settleDuration:1000,rippleLead:650,note:'One circular lens opens through the image, with overlapping Rain ripples through its finish.',number:0},
    tide:{name:'Tide',duration:1150,note:'A shallow waterline rises, bending the image along its edge.',number:1},
    current:{name:'Silk Current',duration:1300,note:'A fine diagonal current carries one image into the next.',number:2},
    eddy:{name:'Eddy',duration:1400,note:'A quiet turning ripple opens outward and releases its tension.',number:3},
    rain:{name:'Rain',duration:1450,note:'Small circular arrivals meet until the whole surface has changed.',number:4},
    confluence:{name:'Confluence',duration:1200,settleDuration:1000,rippleLead:650,note:'Two lenses meet, merge, and release Rain ripples through the arriving image.',number:5},
    undertow:{name:'Undertow',duration:1150,settleDuration:1000,rippleLead:650,note:'A low current draws the image downward, with overlapping circular ripples through its finish.',number:6},
    stillpoint:{name:'Stillpoint',duration:1250,settleDuration:1000,rippleLead:650,note:'A fine seam opens into still water. Circular Rain ripples settle the surface.',number:7}
  };
  const VS='precision highp float;attribute vec2 a;varying vec2 uv;void main(){uv=a;gl_Position=vec4(a*2.-1.,0.,1.);}';
  // One shared Rain field: reveal masks and post-arrival optics cannot drift apart.
  const RIPPLES=`
float ridge(float d,float width){float band=d/width;return exp(-band*band);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 rainField(vec2 point,float p){
 float mask=0.;vec2 shift=vec2(0.);
   for(int y=0;y<3;y++)for(int x=0;x<3;x++){
     vec2 cell=vec2(float(x),float(y));float seed=hash(cell+2.);
     vec2 center=(cell+.5+vec2(seed-.5,hash(cell+8.)-.5)*.38)/3.;
     vec2 d=(point-center)*vec2(aspect,1.);float r=length(d);
     float arrival=clamp((p-seed*.22)/.78,0.,1.);
     float radius=mix(-.03,length(vec2(aspect,1.))*.46,arrival);
     float distance=r-radius;
     mask=max(mask,(1.-smoothstep(-.018,.018,distance))*step(.001,arrival));
     shift+=d/max(r,.001)/vec2(aspect,1.)*ridge(distance,.048)*sin(arrival*3.14159265)*.011;
   }
 return vec3(mask,shift);
}
`;
  // Reuse Rain's circular ridges on the incoming image before reveal easing finishes.
  const RETURN=`
uniform float returnProgress;
uniform vec2 pixelStep;
vec2 returningUV(vec2 point){
 float t=clamp(returnProgress,0.,1.);
 if(t<=0.||t>=1.)return point;
 float p=1.-pow(1.-t,3.);
 vec2 ripple=rainField(point,p).yz;
 // Gentle onset and a zero-slope release; preserve Rain's spatial pattern.
 float release=smoothstep(0.,.08,t)*(1.-smoothstep(.72,1.,t));
 // Match Rain at card scale; cap growth on oversized page previews.
 float scale=min(1.,900.*pixelStep.y);
 return clamp(point-ripple*strength*release*scale,vec2(0.),vec2(1.));
}
`;
  // Preserve the original Ma reveal; overlap Rain optics with its easing tail.
  const LENS=`precision highp float;varying vec2 uv;uniform sampler2D beforeImage;uniform sampler2D afterImage;uniform float progress;uniform float aspect;uniform float strength;uniform float kind;${RIPPLES}${RETURN}void main(){if(progress>=1.){gl_FragColor=texture2D(afterImage,returningUV(uv));return;}vec2 d=(uv-.5)*vec2(aspect,1.);float r=length(d);float edge=.024;float radius=mix(-edge, length(vec2(aspect,1.))*.55,progress);float mask=1.-smoothstep(radius-edge,radius+edge,r);float rim=exp(-pow(abs((r-radius)/.12),2.));float bend=sin(progress*3.14159265)*rim*.13*strength;vec2 axis=d/max(r,.001);vec2 shift=axis/vec2(aspect,1.)*bend;vec2 incoming=clamp(returningUV(uv)-shift,vec2(0.),vec2(1.));vec2 outgoing=clamp(uv+shift*.34,vec2(0.),vec2(1.));vec3 a=texture2D(beforeImage,outgoing).rgb;vec3 b=texture2D(afterImage,incoming).rgb;gl_FragColor=vec4(mix(a,b,mask),1.);}`;
  const FLOW=`precision highp float;
varying vec2 uv;
uniform sampler2D beforeImage,afterImage;
uniform float progress,aspect,strength,kind;
const float PI=3.14159265;
${RIPPLES}${RETURN}
void main(){
 if(progress<=0.){gl_FragColor=texture2D(beforeImage,uv);return;}
 if(progress>=1.){gl_FragColor=texture2D(afterImage,returningUV(uv));return;}
 float p=progress,envelope=sin(p*PI),mask=0.;vec2 shift=vec2(0.);
 if(kind<1.5){
   float wave=sin(uv.x*5.2+p*2.4)*.035+sin(uv.x*11.-p*3.)*.012;
   float distance=uv.y-(mix(-.12,1.12,p)+wave*envelope);
   mask=1.-smoothstep(-.024,.024,distance);
   float crest=ridge(distance,.095)*envelope;
   shift=vec2(cos(uv.x*5.2+p*2.4)*.008, .046)*crest;
 }else if(kind<2.5){
   float lane=uv.x*.67+(1.-uv.y)*.33;
   float curve=sin(uv.y*7.-p*3.)*.037*envelope;
   float distance=lane+curve-mix(-.12,1.12,p);
   mask=1.-smoothstep(-.035,.035,distance);
   float crest=ridge(distance,.12)*envelope;
   shift=vec2(.045,-.017)*crest+vec2(.009*sin(uv.y*17.-p*4.),.005*cos(uv.x*11.))*crest;
 }else if(kind<3.5){
   vec2 d=(uv-.5)*vec2(aspect,1.);float r=length(d),angle=r>.0001?atan(d.y,d.x):0.;
   float radius=mix(-.05,length(vec2(aspect,1.))*.57,p);
   float distance=r-radius+sin(angle*2.-p*4.)*.035*envelope;
   mask=1.-smoothstep(-.025,.025,distance);
   float crest=ridge(distance,.12)*envelope;
   vec2 axis=d/max(.001,r);
   shift=(axis*.035+vec2(-axis.y,axis.x)*.065)*crest/vec2(aspect,1.);
 }else if(kind<4.5){
   vec3 rain=rainField(uv,p);mask=rain.x;shift=rain.yz;
 }else if(kind<5.5){
   vec2 a=(uv-vec2(.28,.5))*vec2(aspect,1.),b=(uv-vec2(.72,.5))*vec2(aspect,1.);
   float radius=mix(-.04,length(vec2(aspect,1.))*.64,p);
   float ra=length(a),rb=length(b),da=ra-radius,db=rb-radius;
   mask=max(1.-smoothstep(-.026,.026,da),1.-smoothstep(-.026,.026,db));
   vec2 pressure=a/max(ra,.001)*ridge(da,.09)+b/max(rb,.001)*ridge(db,.09);
   shift=pressure/vec2(aspect,1.)*.033*envelope;
 }else if(kind<6.5){
   float front=mix(1.12,-.12,p);
   float distance=uv.y-front+sin(uv.x*6.+p*2.)*.045*envelope;
   mask=smoothstep(-.027,.027,distance);
   float fold=ridge(distance,.14)*envelope;
   shift=vec2(sin(uv.x*6.+p*2.)*.009,-.068)*fold;
 }else{
   float seam=.5+sin(uv.x*5.-p*2.)*.025*envelope;
   float distance=abs(uv.y-seam)-mix(-.04,.58,p);
   mask=1.-smoothstep(-.022,.022,distance);
   float fold=ridge(distance,.075)*envelope;
   shift=vec2(sin(uv.x*8.)*.005,sign(uv.y-seam)*.033)*fold;
 }
 shift*=strength;
 vec3 a=texture2D(beforeImage,clamp(uv+shift*.34,vec2(0.),vec2(1.))).rgb;
 vec3 b=texture2D(afterImage,clamp(returningUV(uv)-shift,vec2(0.),vec2(1.))).rgb;
 gl_FragColor=vec4(mix(a,b,mask),1.);
}`;
  function create(canvas,images,options){
    const spec=specs[options.kind]||specs.lens;
    const requestFrame=options.requestFrame||requestAnimationFrame,cancelFrame=options.cancelFrame||cancelAnimationFrame;
    let gl=null,program=null,buffer=null,textures=[],snapshot=null,shaders=[],loc={},ready=false,dead=false,failed=false,reason=null;
    let current=options.initial||0,target=current,from=null,running=false,start=0,frame=0,progress=1,interruptions=0,renderFrames=0,uploads=0,returnProgress=0,phase='idle';
    let durationScale=options.durationScale||1,strength=options.strength==null?1:options.strength,pw=0,ph=0,cssW=1,cssH=1;
    const reduced=()=>options.reduced();
    function stop(){if(frame)cancelFrame(frame);frame=0;}
    function present(){canvas.hidden=true;options.present(target);current=target;running=false;progress=1;returnProgress=1;phase='idle';}
    function settle(){stop();present();}
    function release(){
      stop();ready=false;
      if(gl){textures.forEach(t=>gl.deleteTexture(t));if(snapshot)gl.deleteTexture(snapshot);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));}
      textures=[];snapshot=null;buffer=null;program=null;shaders=[];
    }
    function fail(error){failed=true;reason=String(error.message||error);release();present();options.status('Water transition unavailable · '+reason);}
    function texture(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
    function resize(){
      if(!ready||dead)return;
      try{
        const r=canvas.parentElement.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1300000/Math.max(1,r.width*r.height)));
        cssW=Math.max(1,r.width);cssH=Math.max(1,r.height);
        const nextW=Math.max(1,Math.round(r.width*dpr)),nextH=Math.max(1,Math.round(r.height*dpr));
        if(nextW===pw&&nextH===ph)return;
        pw=nextW;ph=nextH;canvas.width=pw;canvas.height=ph;gl.viewport(0,0,pw,ph);
        const prep=document.createElement('canvas'),g=prep.getContext('2d');if(!g)throw Error('Image preparation unavailable');prep.width=pw;prep.height=ph;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        images.forEach((img,i)=>{const ratio=Math.max(pw/img.naturalWidth,ph/img.naturalHeight),sw=pw/ratio,sh=ph/ratio;g.clearRect(0,0,pw,ph);g.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,0,0,pw,ph);gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,prep);uploads++;});
        prep.width=prep.height=1;
        if(gl.getError()!==gl.NO_ERROR)throw Error('Image texture upload failed');
        // Resize the same optical handoff; never skip straight to its destination.
        if(running)render(progress);else present();
      }catch(e){fail(e);}
    }
    function init(){
      if(dead||failed||ready||reduced()||!images.every(i=>i.complete&&i.naturalWidth))return;
      try{
        gl=canvas.getContext('webgl',{alpha:false,depth:false,stencil:false,antialias:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL unavailable');
        program=gl.createProgram();[VS,spec.number===0?LENS:FLOW].forEach((code,i)=>{const shader=gl.createShader(i?gl.FRAGMENT_SHADER:gl.VERTEX_SHADER);shaders.push(shader);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);});
        gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
        ['beforeImage','afterImage','progress','aspect','strength','kind','returnProgress','pixelStep'].forEach(k=>loc[k]=gl.getUniformLocation(program,k));
        buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
        textures=images.map(texture);snapshot=texture();ready=true;resize();
      }catch(e){fail(e);}
    }
    function render(p){
      gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,from);gl.uniform1i(loc.beforeImage,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures[target]);gl.uniform1i(loc.afterImage,1);gl.uniform1f(loc.progress,p);gl.uniform1f(loc.aspect,pw/ph);gl.uniform1f(loc.strength,strength);gl.uniform1f(loc.kind,spec.number);gl.uniform1f(loc.returnProgress,returnProgress);gl.uniform2f(loc.pixelStep,1/cssW,1/cssH);gl.drawArrays(gl.TRIANGLES,0,6);if(gl.getError()!==gl.NO_ERROR)throw Error('Graphics draw failed');renderFrames++;
      // Native companions may follow the rendered reveal, not its longer ripple
      // tail. Optional: existing Lab consumers retain their commit-only behavior.
      if(options.onProgress)options.onProgress(p,target);
    }
    function tick(t){
      frame=0;if(dead)return;
      if(reduced()||document.hidden){settle();return;}
      try{
        const elapsed=Math.max(0,t-start),revealMs=spec.duration*durationScale,returnMs=(spec.settleDuration||0)*durationScale;
        const rippleStart=revealMs-(spec.rippleLead||0)*durationScale;
        const finishMs=Math.max(revealMs,rippleStart+returnMs);
        const q=Math.min(1,elapsed/revealMs);
        progress=1-Math.pow(1-q,3);
        returnProgress=returnMs?Math.max(0,Math.min(1,(elapsed-rippleStart)/returnMs)):1;
        const nextPhase=q<1?'revealing':'settling';
        if(nextPhase!==phase&&returnMs&&elapsed<finishMs)options.status('Settling · '+spec.name);
        phase=nextPhase;
        render(progress);
        if(elapsed>=finishMs){present();options.commit(target,{animated:true});}
        else frame=requestFrame(tick);
      }catch(e){fail(e);}
    }
    function change(i){
      if(dead||!Number.isInteger(i)||i<0||i>=images.length||i===target)return;
      if(!ready)init();
      if(!ready||reduced()||document.hidden){target=i;settle();options.commit(target,{animated:false});return;}
      try{
        if(running){
          const old=snapshot;snapshot=texture();gl.copyTexImage2D(gl.TEXTURE_2D,0,gl.RGB,0,0,pw,ph,0);gl.deleteTexture(old);if(gl.getError()!==gl.NO_ERROR)throw Error('Frame capture unavailable');from=snapshot;interruptions++;
        }else from=textures[current];
        target=i;start=performance.now();progress=0;returnProgress=0;phase='revealing';running=true;canvas.hidden=false;render(0);if(!frame)frame=requestFrame(tick);
      }catch(e){target=i;fail(e);}
    }
    const lost=e=>{e.preventDefault();if(!dead)fail(Error('Graphics context lost'));};canvas.addEventListener('webglcontextlost',lost);
    canvas.hidden=true;init();
    return{change,settle,resize,init,
      replay(a,b){if(dead||![a,b].every(i=>Number.isInteger(i)&&i>=0&&i<images.length))return;settle();current=target=a;present();change(b);},
      configure(o){settle();durationScale=Math.max(.65,Math.min(1.5,o.durationScale));strength=Math.max(0,Math.min(1.5,o.strength));},
      stats:()=>({ready,failed,reason,running,current,target,progress,returnProgress,phase,interruptions,renderFrames,uploads,size:[pw,ph],framePending:!!frame}),
      dispose(releaseContext=false){dead=true;release();canvas.removeEventListener('webglcontextlost',lost);canvas.hidden=true;if(releaseContext&&gl)gl.getExtension('WEBGL_lose_context')?.loseContext();}
    };
  }
  global.XIWaterTransitions=NS.waterTransitions={specs,create,shaders:{vertex:VS,lens:LENS,flow:FLOW,returning:RETURN,ripples:RIPPLES}};
})(window);
