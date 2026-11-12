const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!<>-_[]{}—+=*';
function originalText(el){
  return el.dataset.original||el.getAttribute('aria-label')||el.textContent;
}
function appendSpace(target,char=' '){
  // Space must be a real letter node — flex/grid drop bare whitespace text nodes.
  const span=document.createElement('span');span.className='letter space';span.dataset.char=char===' '? '\u00a0':char;
  const glyph=document.createElement('span');glyph.className='glyph';glyph.textContent=span.dataset.char;
  span.append(glyph);span.setAttribute('aria-hidden','true');target.append(span);
}
function prepare(el){
  if(el.dataset.ready==='1'&&el.querySelector('.letter'))return;
  const text=originalText(el);
  el.dataset.original=text;el.setAttribute('aria-label',text);el.dataset.ready='1';el.textContent='';
  text.split(/(\s+)/u).filter(Boolean).forEach(token=>{
    if(/^\s+$/u.test(token)){
      const gap=document.createElement('span');gap.className='word space-word';
      [...token].forEach(c=>appendSpace(gap,c===' '?'\u00a0':c));
      el.append(gap);return;
    }
    const word=document.createElement('span');word.className='word';
    [...token].forEach(c=>{
      const span=document.createElement('span');span.className='letter';span.dataset.char=c;
      const glyph=document.createElement('span');glyph.className='glyph';glyph.textContent=c;
      span.append(glyph);span.setAttribute('aria-hidden','true');word.append(span);
    });
    el.append(word);
  });
}
function settleReveal(el){
  if(!el)return;
  if(el._timer){clearInterval(el._timer);el._timer=null}
  const original=originalText(el);
  el.dataset.original=original;
  el.setAttribute('aria-label',original);
  // Restore plain text so letter spans never leave layout offset after hover.
  el.textContent=original;
  el.dataset.ready='';
  const done=el._finishReveal;el._finishReveal=null;done?.();
}
function reveal(el,delay=0,duration=null){
  // Never rebuild from mid-scramble DOM — original stays in data-original/aria-label.
  if(el.dataset.ready==='1'&&!el.querySelector('.letter')&&el.dataset.original){
    el.dataset.ready='';
  }
  prepare(el);clearInterval(el._timer);el._timer=null;
  const prev=el._finishReveal;el._finishReveal=null;prev?.();
  if(reduced){settleReveal(el);return Promise.resolve()}
  const letters=[...el.querySelectorAll('.letter')];
  const step=duration===null?14:Math.max(0,(duration-140)/Math.max(1,letters.length-1));
  const total=duration??(letters.length*14+170);
  letters.forEach(span=>{const glyph=span.firstElementChild;if(glyph)glyph.textContent='\u00a0';span.classList.remove('flash')});
  return new Promise(resolve=>{
    el._finishReveal=resolve;const start=performance.now()+delay;
    el._timer=setInterval(()=>{
      const t=performance.now()-start;
      letters.forEach((span,i)=>{
        const original=span.dataset.char,glyph=span.firstElementChild;if(!glyph)return;
        const progress=t-i*step;
        if(original===' '||original==='\u00a0'){glyph.textContent='\u00a0';span.classList.remove('flash');return}
        if(progress<0){glyph.textContent='\u00a0';span.classList.remove('flash')}
        else if(progress<140){glyph.textContent=chars[Math.floor(Math.random()*chars.length)];span.classList.add('flash')}
        else{glyph.textContent=original;span.classList.remove('flash')}
      });
      if(t>=total){
        clearInterval(el._timer);el._timer=null;
        letters.forEach(span=>{const glyph=span.firstElementChild;if(glyph)glyph.textContent=span.dataset.char||'';span.classList.remove('flash')});
        el._finishReveal=null;resolve();
      }
    },16);
  });
}
// Reveal layers sequentially; the first screen defaults to 160 ms per layer.
async function revealLayer(layer,duration=window.SITE_CONTENT.effects.heroTextMs){
  const texts=layer.matches('.fx')?[layer]:[...layer.querySelectorAll('.fx')];
  const ready=texts.map(el=>reveal(el,0,duration));
  layer.style.visibility='visible';
  if(!reduced){
    const animation=layer.animate([{opacity:0},{opacity:1}],{duration,easing:'ease-out'});
    await Promise.all([...ready,animation.finished]);
  }else await Promise.all(ready);
}
let enabled=true,unlocked=false,lastSound=0;try{enabled=localStorage.getItem('andreiko-sound')!=='off'}catch{}
const taps=Array.from({length:5},(_,i)=>{let a=new Audio(`assets/tap_0${i+1}.mp3`);a.volume=.15;a.preload='auto';return a});
function sound(){if(!enabled||!unlocked)return;if(performance.now()-lastSound<65)return;lastSound=performance.now();const a=taps[Math.floor(Math.random()*taps.length)].cloneNode();a.volume=.15;a.play().catch(()=>{})}
const soundBtn=document.querySelector('.sound');
function updateSound(){soundBtn.dataset.ready='';soundBtn.textContent=enabled?'Звук [ вкл ]':'Звук [ выкл ]';soundBtn.setAttribute('aria-pressed',enabled);soundBtn.setAttribute('aria-label',enabled?'Выключить звук':'Включить звук');prepare(soundBtn)}
soundBtn.onclick=()=>{enabled=!enabled;try{localStorage.setItem('andreiko-sound',enabled?'on':'off')}catch{}updateSound()};

function easeOutCubic(t){return 1-Math.pow(1-t,3)}
function prepareLoaderText(el){
  if(el.dataset.ready)return el._loaderChars||[];
  const text=el.textContent;el.dataset.ready='1';el.setAttribute('aria-label',text);el.textContent='';
  const nodes=[];
  [...text].forEach(c=>{
    if(c===' '){el.append(' ');return}
    const span=document.createElement('span');span.className='preloader-char';span.dataset.char=c;span.textContent=c;el.append(span);nodes.push(span);
  });
  el._loaderChars=nodes;return nodes;
}
function decodeLoaderText(el,{delay=100,withCursor=true}={}){
  const nodes=prepareLoaderText(el);el.classList.add('is-ready');
  if(withCursor)el.classList.add('is-typing');
  if(reduced){nodes.forEach(n=>n.textContent=n.dataset.char);el.classList.remove('is-typing');return Promise.resolve()}
  nodes.forEach(n=>n.textContent='\u00a0');
  const step=28,scramble=140,total=delay+nodes.length*step+scramble;
  const start=performance.now();
  return new Promise(resolve=>{
    const tick=now=>{
      const t=now-start;
      nodes.forEach((span,i)=>{
        const progress=t-delay-i*step;
        if(progress<0){span.textContent='\u00a0';span.classList.remove('is-flash')}
        else if(progress<scramble){span.textContent=chars[Math.floor(Math.random()*chars.length)];span.classList.add('is-flash')}
        else{span.textContent=span.dataset.char;span.classList.remove('is-flash')}
      });
      if(t<total)requestAnimationFrame(tick);
      else{el.classList.remove('is-typing');resolve()}
    };
    requestAnimationFrame(tick);
  });
}
function startStatusScroller(root){
  const list=root.querySelector('.preloader-items');
  const items=[...root.querySelectorAll('.preloader-item')];
  if(!list||!items.length)return()=>{};
  if(reduced){
    items.forEach((item,i)=>item.classList.toggle('is-active',i===0));
    return()=>{};
  }
  let frame=0,start=performance.now(),cycle=3000,stopped=false;
  const markActive=()=>{
    const wrap=list.parentElement;if(!wrap)return;
    const mid=wrap.getBoundingClientRect().top+wrap.offsetHeight/2;
    items.forEach(item=>{
      const box=item.getBoundingClientRect();
      const center=box.top+box.height/2;
      const active=Math.abs(center-mid)<=box.height;
      item.classList.toggle('is-active',active);
    });
  };
  const step=now=>{
    if(stopped)return;
    const elapsed=(now-start)%cycle;
    const y=-(elapsed/cycle)*50;
    list.style.transform=`translate3d(0,${y}%,0)`;
    markActive();
    frame=requestAnimationFrame(step);
  };
  frame=requestAnimationFrame(step);
  return()=>{stopped=true;cancelAnimationFrame(frame)};
}
function animateProgress(el,targetGetter,{minMs=2800,maxMs=10000}={}){
  return new Promise(resolve=>{
    const start=performance.now();
    const tick=now=>{
      const elapsed=now-start;
      const asset=Math.min(1,Math.max(0,targetGetter()));
      const time=easeOutCubic(Math.min(1,elapsed/minMs));
      let value=Math.min(.97,time*.72+asset*.25);
      if((asset>=1&&elapsed>=minMs)||elapsed>=maxMs)value=1;
      el.textContent=value>=1?'( done )':`( ${Math.round(value*100)}% )`;
      if(value>=1)resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function runEmotionPreloader(){
  const root=document.querySelector('.preloader');
  if(!root)return;
  const progressEl=root.querySelector('.preloader-progress');
  const textEl=root.querySelector('.preloader-text');
  const stopScroll=startStatusScroller(root);
  decodeLoaderText(textEl,{delay:100,withCursor:true});

  let assetProgress=0;
  const images=[...document.querySelectorAll('.hero img')];
  const fontsReady=Promise.allSettled([
    document.fonts.load('700 96px Benzin'),
    document.fonts.load('600 16px Sonko'),
    document.fonts.load('400 16px Sonko'),
    document.fonts.load('500 12px "IBM Plex Mono"')
  ]).then(()=>{assetProgress=Math.max(assetProgress,.55)});
  const imagesReady=Promise.allSettled(images.map(img=>img.decode().catch(()=>{}))).then(()=>{assetProgress=Math.max(assetProgress,.9)});
  Promise.all([fontsReady,imagesReady]).then(()=>{assetProgress=1});

  if(reduced){
    progressEl.textContent='( done )';
    assetProgress=1;
  }else{
    await animateProgress(progressEl,()=>assetProgress,{minMs:2800,maxMs:10000});
  }
  clearTimeout(window._loaderFallback);
  await wait(reduced?0:400);
  stopScroll();
  root.dataset.phase='done';
  const loadingBits=[...root.querySelectorAll('.preloader-item,.preloader-progress,.preloader-text')];
  await Promise.all(loadingBits.map(el=>el.animate([
    {opacity:1,transform:'scale(1)'},
    {opacity:0,transform:'scale(1.05)'}
  ],{duration:reduced?1:280,fill:'forwards',easing:'ease'}).finished.catch(()=>{})));
}
async function dismissPreloader(){
  const root=document.querySelector('.preloader');
  if(!root)return;
  root.classList.add('is-exit');
  await wait(reduced?0:280);
  document.documentElement.classList.remove('loading');
  root.remove();
}
// Reveal the page after the branded Emotion-style loader finishes (no audio gate).
async function bootSite(){
  const hero=document.querySelector('.hero');hero.inert=true;
  const brand=[hero.querySelector('.brand h1'),hero.querySelector('.brand p')];
  const blocks=[...hero.querySelectorAll('.intro,.services,.navigation,.sound,footer')]
    .sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return ar.top-br.top||ar.left-br.left});
  const layers=[...brand,...blocks];
  const sliderLayers=[...hero.querySelectorAll('.thumbnails,.project-card')];
  [...layers,...sliderLayers].forEach(el=>{el.style.visibility='hidden'});
  try{await runEmotionPreloader()}catch(error){console.error(error);clearTimeout(window._loaderFallback)}
  updateSound();
  await dismissPreloader();
  try{
    await Promise.all([assembleFirstSlide(),revealLayer(hero.querySelector('.project-card'))]);
    document.documentElement.classList.remove('slide-pending');
    for(const layer of layers)await revealLayer(layer);
    await assembleThumbnails();
  }
  finally{hero.inert=false;document.documentElement.classList.remove('slide-pending')}
}
document.addEventListener('pointerdown',()=>{unlocked=true},{once:true});document.addEventListener('keydown',()=>{unlocked=true},{once:true});
document.querySelectorAll('button,a').forEach(el=>{el.addEventListener('pointerenter',()=>{sound();if(el.classList.contains('fx'))reveal(el)});el.addEventListener('focus',()=>{if(el.classList.contains('fx'))reveal(el)})});
updateSound();
const thumbs=[...document.querySelectorAll('.thumb')],project=document.querySelector('#project'),card=document.querySelector('.project-card'),viewer=document.querySelector('#viewer');let current=window.SITE_CONTENT.hero.initialSlide;
const pixelCanvas=document.createElement('canvas');pixelCanvas.className='pixel-transition';pixelCanvas.hidden=true;pixelCanvas.setAttribute('aria-hidden','true');project.after(pixelCanvas);
const pixelContext=pixelCanvas.getContext('2d');
const slideSources=window.SITE_CONTENT.hero.slides.map(slide=>slide.image);
const slideImages=new Map();let slideRequest=0,slideFrame=0;
function loadSlide(src){if(!slideImages.has(src)){const image=new Image();image.src=src;const ready=image.decode().then(()=>image).catch(error=>{slideImages.delete(src);throw error});slideImages.set(src,ready)}return slideImages.get(src)}
function drawPixels(image,blockSize){
  const {width,height}=project.getBoundingClientRect();
  pixelCanvas.width=Math.max(1,Math.ceil(width/blockSize));pixelCanvas.height=Math.max(1,Math.ceil(height/blockSize));
  const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight);
  const cropWidth=width/scale,cropHeight=height/scale;
  pixelContext.fillStyle='#000';pixelContext.fillRect(0,0,pixelCanvas.width,pixelCanvas.height);
  pixelContext.drawImage(image,(image.naturalWidth-cropWidth)/2,(image.naturalHeight-cropHeight)/2,cropWidth,cropHeight,0,0,pixelCanvas.width,pixelCanvas.height);
}
async function assembleFirstSlide(){
  if(reduced||!pixelContext)return;
  let image;try{image=await loadSlide(project.src)}catch{return}
  const start=performance.now();
  drawPixels(image,64);pixelCanvas.hidden=false;
  await new Promise(resolve=>{
    function frame(now){
      const progress=Math.min(1,(now-start)/window.SITE_CONTENT.effects.heroSlideMs);
      if(progress>=1){pixelCanvas.hidden=true;slideFrame=0;resolve();return}
      drawPixels(image,1+63*Math.pow(1-progress,2));
      slideFrame=requestAnimationFrame(frame);
    }
    slideFrame=requestAnimationFrame(frame);
  });
}
// Resolve the thumbnail switcher from coarse pixels after all hero text.
async function assembleThumbnails(){
  const switcher=document.querySelector('.thumbnails');
  if(reduced){switcher.style.visibility='visible';return}
  const previews=[];
  try{
    for(const button of thumbs){
      const image=button.querySelector('img');if(!image.naturalWidth)continue;
      const bounds=button.getBoundingClientRect(),imageBounds=image.getBoundingClientRect();
      if(!bounds.width||!bounds.height)continue;
      const surface=document.createElement('canvas'),context=surface.getContext('2d');
      if(!context)continue;
      surface.className='thumbnail-pixels';surface.setAttribute('aria-hidden','true');
      button.append(surface);
      previews.push({surface,context,image,bounds,imageBounds,visibility:image.style.visibility});
      image.style.visibility='hidden';
    }
    function render(progress){
      const block=1+15*Math.pow(1-progress,2);
      for(const {surface,context,image,bounds,imageBounds} of previews){
        surface.width=Math.max(1,Math.ceil(bounds.width/block));surface.height=Math.max(1,Math.ceil(bounds.height/block));
        context.setTransform(surface.width/bounds.width,0,0,surface.height/bounds.height,0,0);
        context.drawImage(image,imageBounds.left-bounds.left,imageBounds.top-bounds.top,imageBounds.width,imageBounds.height);
      }
    }
    render(0);switcher.style.visibility='visible';
    if(previews.length)await new Promise(resolve=>{
      const start=performance.now();
      function frame(now){const progress=Math.min(1,(now-start)/window.SITE_CONTENT.effects.heroPreviewMs);render(progress);if(progress<1)requestAnimationFrame(frame);else resolve()}
      requestAnimationFrame(frame);
    });
  }finally{
    for(const {surface,image,visibility} of previews){image.style.visibility=visibility;surface.remove()}
    switcher.style.visibility='visible';
  }
}
function updateSelection(index){thumbs.forEach((b,i)=>{b.classList.toggle('selected',i===index);b.setAttribute('aria-pressed',i===index)});const slide=window.SITE_CONTENT.hero.slides[index],img=card.querySelector('img');img.src=slide.cardImage||slide.image;img.style.cssText=slide.cardCrop?'':'width:100%;height:100%;left:0;top:0;object-fit:cover';card.setAttribute('aria-label','Посмотреть '+slide.title)}
async function choose(index){
  const request=++slideRequest;
  cancelAnimationFrame(slideFrame);pixelCanvas.hidden=true;project.style.visibility='';
  if(index===current)return;
  let outgoing,incoming;
  try{[outgoing,incoming]=await Promise.all([loadSlide(project.src),loadSlide(slideSources[index])])}catch{return}
  if(request!==slideRequest)return;
  current=index;updateSelection(index);
  if(reduced||!pixelContext){project.src=incoming.src;return}
  drawPixels(outgoing,1);pixelCanvas.hidden=false;project.style.visibility='hidden';project.src=incoming.src;
  const start=performance.now();
  function frame(now){
    if(request!==slideRequest)return;
    const progress=Math.min(1,(now-start)/window.SITE_CONTENT.effects.slideMs);
    if(progress>=1){pixelCanvas.hidden=true;project.style.visibility='';slideFrame=0;return}
    // Break the old slide into blocks, switch at the peak, then resolve the new one.
    const intensity=Math.sin(Math.PI*progress);
    drawPixels(progress<.5?outgoing:incoming,1+63*intensity*intensity);
    slideFrame=requestAnimationFrame(frame);
  }
  slideFrame=requestAnimationFrame(frame);
}
thumbs.forEach((b,i)=>b.onclick=()=>choose(i));
function view(){viewer.querySelector('img').src=slideSources[current];viewer.showModal()}card.onclick=view;document.querySelector('#works').onclick=()=>{thumbs[0].focus();thumbs.forEach((el,i)=>el.animate([{transform:'translateY(0)'},{transform:'translateY(-10px)'},{transform:'translateY(0)'}],{duration:450,delay:i*60}))};
const panel=document.querySelector('#panel');const copy={'Кто я такой':'ANDREIKO. Worldwide working. Est. 2009.','Как я работаю':'Смыслы, тексты, внимание к деталям. Только ручная работа. Без шаблонов.','С кем я работаю':'Для основателей, которые любят то, что создают.','Контакты':'Обсудим ваш проект.','Разработка стратегий':'Стратегия — отправная точка проекта.','Брендинг и айдентика':'Смыслы и внимание к деталям.','Сайты и лендинги':'Только ручная работа. Без шаблонов.','Маркетинг и продажи':'Обсудим задачи вашего бизнеса.','Реклама':'Обсудим задачи вашего бизнеса.'};Object.assign(copy,window.SITE_PANELS||{});function openPanel(title,text){panel.querySelector('h2').dataset.ready='';panel.querySelector('h2').textContent=title;panel.querySelector('.panel-copy').textContent=text;panel.showModal();panel.querySelectorAll('.fx').forEach(el=>reveal(el));reveal(panel.querySelector('h2'))}document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>openPanel(b.dataset.panel,copy[b.dataset.panel]));document.querySelectorAll('[data-social]').forEach(b=>b.onclick=()=>{if(b.dataset.url){window.open(b.dataset.url,'_blank','noopener,noreferrer');return}openPanel(b.dataset.social,'Связаться с '+window.SITE_CONTENT.principles.name+' можно в Telegram.')});document.querySelectorAll('dialog').forEach(d=>{d.querySelector('.close').onclick=()=>d.close();d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}})});
// Measure rendered word rows, retaining responsive wrapping and accent spans.
async function revealStatementLines(layer){
  const rows=[];
  for(const word of layer.querySelectorAll('.word')){
    const top=word.getBoundingClientRect().top;
    let row=rows.find(row=>Math.abs(row.top-top)<2);
    if(!row){row={top,letters:[]};rows.push(row)}
    row.letters.push(...word.querySelectorAll('.letter'));
  }
  rows.sort((a,b)=>a.top-b.top);
  if(reduced||!rows.length){layer.style.visibility='visible';return}
  const duration=window.SITE_CONTENT.effects.principlesMainMs,slot=duration/rows.length;
  for(const row of rows)for(const letter of row.letters){letter.firstElementChild.textContent='\u00a0';letter.classList.remove('flash')}
  layer.style.visibility='visible';
  await new Promise(resolve=>{
    const start=performance.now();
    function frame(now){
      const elapsed=now-start;
      rows.forEach((row,index)=>{
        const local=elapsed-index*slot;
        row.letters.forEach((letter,i)=>{
          const glyph=letter.firstElementChild,offset=i/Math.max(1,row.letters.length-1)*slot*.35;
          if(local<offset){glyph.textContent='\u00a0';letter.classList.remove('flash')}
          else if(local<slot&&local-offset<slot*.6){glyph.textContent=chars[Math.floor(Math.random()*chars.length)];letter.classList.add('flash')}
          else{glyph.textContent=letter.dataset.char;letter.classList.remove('flash')}
        });
      });
      if(elapsed<duration)requestAnimationFrame(frame);else resolve();
    }
    requestAnimationFrame(frame);
  });
}
// Start the second screen's text sequence once it enters the viewport.
function initPrinciplesIntro(){
  const section=document.querySelector('#principles');
  if(!section||reduced||!('IntersectionObserver' in window))return;
  const steps=[...section.querySelectorAll('[data-principles-step]')];
  section.querySelectorAll('.fx').forEach(prepare);
  section.classList.add('is-pending');
  const observer=new IntersectionObserver(async entries=>{
    if(!entries.some(entry=>entry.isIntersecting))return;
    observer.disconnect();
    try{
      await document.fonts.ready;
      const statement=section.querySelector('.principles-statement');
      const description=section.querySelector('.principles-description');
      await revealStatementLines(statement);
      await revealLayer(description,window.SITE_CONTENT.effects.principlesDescriptionMs);
      await Promise.all(steps.filter(step=>step!==statement&&step!==description).map(step=>revealLayer(step,window.SITE_CONTENT.effects.principlesOtherMs)));
    }finally{section.classList.remove('is-pending')}
  },{threshold:0,rootMargin:'0px 0px -15% 0px'});
  observer.observe(section);
}
initPrinciplesIntro();
// Cached film-grain tiles: animate without regenerating a full-screen ImageData.
const canvas=document.querySelector('#grain'),ctx=canvas.getContext('2d');
if(ctx){
  const tileSize=256;
  const grainFrames=Array.from({length:8},()=>{
    const tile=document.createElement('canvas');tile.width=tile.height=tileSize;
    const tileContext=tile.getContext('2d');const pixels=tileContext.createImageData(tileSize,tileSize);
    for(let i=0;i<pixels.data.length;i+=4){
      const value=Math.random()<.5?0:255;
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;
      pixels.data[i+3]=80+Math.floor(Math.random()*176);
    }
    tileContext.putImageData(pixels,0,0);return ctx.createPattern(tile,'repeat');
  });
  function drawGrain(){
    const x=Math.floor(Math.random()*tileSize),y=Math.floor(Math.random()*tileSize);
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(1,0,0,1,-x,-y);
    ctx.fillStyle=grainFrames[Math.floor(Math.random()*grainFrames.length)];
    ctx.fillRect(0,0,canvas.width+tileSize,canvas.height+tileSize);
  }
  function sizeGrain(){canvas.width=Math.min(innerWidth,2560);canvas.height=Math.min(innerHeight,1600);drawGrain()}
  sizeGrain();window.addEventListener('resize',sizeGrain,{passive:true});
  let grainTimer=null;
  function syncGrain(){
    if(grainTimer!==null){clearInterval(grainTimer);grainTimer=null}
    if(!document.hidden&&!reduced){drawGrain();grainTimer=setInterval(drawGrain,80)}
  }
  document.addEventListener('visibilitychange',syncGrain);syncGrain();
}

// Inertial wheel scrolling; touch and nested scroll areas keep native behavior.
function initKineticScroll(){
  if(reduced||!matchMedia('(hover: hover) and (pointer: fine)').matches)return;
  let target=scrollY,position=scrollY,frame=0,lastFrame=0;
  const limit=()=>Math.max(0,document.documentElement.scrollHeight-innerHeight);
  function stop(){cancelAnimationFrame(frame);frame=0;position=target=scrollY}
  function tick(now){
    const dt=Math.min(50,Math.max(1,now-lastFrame));lastFrame=now;
    target=Math.max(0,Math.min(limit(),target));
    const distance=target-position;
    if(Math.abs(distance)<.5){position=target;window.scrollTo({top:target,behavior:'instant'});frame=0;return}
    position+=distance*(1-Math.exp(-dt/180));
    window.scrollTo({top:position,behavior:'instant'});
    frame=requestAnimationFrame(tick);
  }
  window.addEventListener('wheel',event=>{
    if(event.defaultPrevented||!event.cancelable||event.ctrlKey||event.metaKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY)return;
    if(document.documentElement.classList.contains('loading')||document.querySelector('dialog[open]'))return;
    for(let el=event.target;el&&el!==document.body&&el!==document.documentElement;el=el.parentElement){
      if(el.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))return;
      const overflow=getComputedStyle(el).overflowY;
      if(/auto|scroll/.test(overflow)&&el.scrollHeight>el.clientHeight&&((event.deltaY>0&&el.scrollTop+el.clientHeight<el.scrollHeight)||(event.deltaY<0&&el.scrollTop>0)))return;
    }
    const max=limit();if(max===0)return;
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
    if(!frame)position=target=scrollY;
    else if(Math.sign(delta)!==Math.sign(target-position))target=position;
    if((delta<0&&scrollY<=0)||(delta>0&&scrollY>=max))return;
    event.preventDefault();target=Math.max(0,Math.min(max,target+delta));
    if(!frame){lastFrame=performance.now();frame=requestAnimationFrame(tick)}
  },{passive:false});
  window.addEventListener('pointerdown',stop,{passive:true});
  window.addEventListener('touchstart',stop,{passive:true});
  window.addEventListener('keydown',stop);
  window.addEventListener('resize',stop,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
}
initKineticScroll();

// Native SVG cursor stays precise; only its short pixel trail is animated.
function initPixelCursor(){
  if(reduced||!matchMedia('(hover: hover) and (pointer: fine)').matches)return;
  const trail=document.createElement('canvas');trail.className='cursor-trail';trail.setAttribute('aria-hidden','true');document.body.append(trail);
  const context=trail.getContext('2d');if(!context){trail.remove();return}
  let particles=[],frame=0,previous=null;
  const lifetime=252;
  function reset(){cancelAnimationFrame(frame);frame=0;particles=[];previous=null;context.clearRect(0,0,innerWidth,innerHeight)}
  function resize(){
    reset();const ratio=Math.min(devicePixelRatio||1,2);
    trail.width=Math.ceil(innerWidth*ratio);trail.height=Math.ceil(innerHeight*ratio);context.setTransform(ratio,0,0,ratio,0,0);
  }
  function draw(now){
    context.clearRect(0,0,innerWidth,innerHeight);
    particles=particles.filter(pixel=>now-pixel.born<lifetime);
    context.fillStyle='#ff4500';
    for(const pixel of particles){
      context.globalAlpha=.65*Math.pow(1-Math.max(0,now-pixel.born)/lifetime,2);
      context.fillRect(pixel.x,pixel.y,pixel.size,pixel.size);
    }
    context.globalAlpha=1;frame=particles.length?requestAnimationFrame(draw):0;
  }
  window.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse')return;
    const point={x:event.clientX,y:event.clientY};
    if(previous){
      const dx=point.x-previous.x,dy=point.y-previous.y,distance=Math.hypot(dx,dy);
      if(distance<5)return;
      const count=Math.min(5,Math.floor(distance/5)),now=performance.now();
      for(let i=0;i<count;i++){
        const t=i/count;
        particles.push({x:Math.round((previous.x+dx*t)/2)*2,y:Math.round((previous.y+dy*t)/2)*2,size:Math.random()<.7?2:3,born:now});
      }
      particles=particles.slice(-24);
      if(!frame)frame=requestAnimationFrame(draw);
    }
    previous=point;
  },{passive:true});
  document.addEventListener('pointerout',event=>{if(!event.relatedTarget)reset()});
  window.addEventListener('blur',reset);
  window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset()});
  resize();
}
initPixelCursor();

bootSite();
