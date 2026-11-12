(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Key off pointer quality — headless Chrome reports hover:none.
  const coarse=matchMedia('(pointer: coarse)').matches;
  const section=document.querySelector('#process');
  if(!section)return;
  const rail=section.querySelector('.process-rail');
  const track=section.querySelector('.process-track');
  const cards=[...section.querySelectorAll('.process-card')];
  const SLICES=8;
  const TEXT_SEL='.process-card-base .process-index,.process-card-base .process-card-title,.process-card-base .process-card-copy,.process-card-base .process-card-days';

  let x=0,vx=0,dragging=false,lastX=0,lastT=0,raf=0,moved=0;
  let pressCard=null,tapped=null,wheelTimer=0;

  function maxOffset(){
    return Math.max(0,track.scrollWidth-rail.clientWidth);
  }
  function stride(){
    if(!cards.length)return 1;
    const gap=parseFloat(getComputedStyle(track).columnGap||getComputedStyle(track).gap)||0;
    return Math.max(1,cards[0].offsetWidth+gap);
  }
  function nearestSnap(){
    const max=maxOffset();
    const s=stride();
    let best=0,bestDist=Infinity;
    const candidates=new Set([0,-max]);
    for(let i=0;i<cards.length;i++)candidates.add(Math.max(-max,Math.min(0,-i*s)));
    for(const candidate of candidates){
      const dist=Math.abs(candidate-x);
      if(dist<bestDist){bestDist=dist;best=candidate}
    }
    return best;
  }
  function rubber(value){
    const max=maxOffset();
    if(value>0)return value*0.32;
    if(value<-max)return -max+(value+max)*0.32;
    return value;
  }
  function applyTransform(){
    track.style.transform=`translate3d(${x}px,0,0)`;
  }
  function stopRaf(){
    if(raf){cancelAnimationFrame(raf);raf=0}
  }
  function tick(){
    if(dragging){raf=0;return}
    const max=maxOffset();
    const target=nearestSnap();
    if(Math.abs(vx)>0.45){
      x+=vx;
      vx*=0.945;
      // Soft magnetic pull toward snap while coasting.
      x+=(target-x)*0.04;
      if(x>0){x*=0.55;vx*=0.55}
      else if(x<-max){x+=(-max-x)*0.4;vx*=0.55}
    }else{
      vx*=0.72;
      const dx=target-x;
      if(Math.abs(dx)<0.35&&Math.abs(vx)<0.04){
        x=target;vx=0;applyTransform();raf=0;return;
      }
      // Smooth settle into snap — no hard stop.
      x+=dx*0.18;
    }
    applyTransform();
    raf=requestAnimationFrame(tick);
  }
  function startSettle(){
    if(reduced){
      x=nearestSnap();
      vx=0;
      applyTransform();
      return;
    }
    stopRaf();
    raf=requestAnimationFrame(tick);
  }

  function onPointerDown(event){
    if(event.button!=null&&event.button!==0)return;
    dragging=true;moved=0;rail.classList.add('is-dragging');
    vx=0;stopRaf();
    lastX=event.clientX;lastT=performance.now();
    pressCard=event.target.closest?.('.process-card')||null;
    rail.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event){
    if(!dragging)return;
    const now=performance.now();
    const dx=event.clientX-lastX;
    const dt=Math.max(1,now-lastT);
    moved+=Math.abs(dx);
    x=rubber(x+dx);
    vx=dx/dt*16;
    lastX=event.clientX;lastT=now;
    applyTransform();
  }
  function onPointerUp(event){
    if(!dragging)return;
    dragging=false;rail.classList.remove('is-dragging');
    try{rail.releasePointerCapture?.(event.pointerId)}catch{}
    if(coarse&&moved<=8&&pressCard){
      const turnOn=tapped!==pressCard;
      if(tapped&&tapped!==pressCard)setHover(tapped,false);
      tapped=turnOn?pressCard:null;
      setHover(pressCard,turnOn);
    }
    pressCard=null;
    // Always settle smoothly (inertia + snap), never hard-stop.
    startSettle();
  }
  rail.addEventListener('pointerdown',onPointerDown);
  rail.addEventListener('pointermove',onPointerMove);
  rail.addEventListener('pointerup',onPointerUp);
  rail.addEventListener('pointercancel',onPointerUp);
  rail.addEventListener('lostpointercapture',()=>{dragging=false;rail.classList.remove('is-dragging');pressCard=null});
  rail.addEventListener('wheel',event=>{
    if(Math.abs(event.deltaX)<Math.abs(event.deltaY)&&!event.shiftKey)return;
    event.preventDefault();
    stopRaf();
    x=rubber(x-(event.deltaX||event.deltaY));
    vx=0;
    applyTransform();
    clearTimeout(wheelTimer);
    wheelTimer=setTimeout(startSettle,90);
  },{passive:false});
  window.addEventListener('resize',()=>{
    x=Math.min(0,Math.max(-maxOffset(),x));
    applyTransform();
    startSettle();
  },{passive:true});

  function buildSlices(card){
    const hover=card.querySelector('.process-card-hover');
    if(!hover||hover.dataset.slicesReady)return hover;
    hover.dataset.slicesReady='1';
    hover.replaceChildren();
    if(reduced){
      hover.classList.add('is-plain');
      return hover;
    }
    const wrap=document.createElement('div');
    wrap.className='process-card-slices';
    wrap.dataset.orientation='vertical';
    wrap.style.setProperty('--slices',String(SLICES));
    for(let i=0;i<SLICES;i++){
      const slice=document.createElement('div');
      slice.className='process-card-slice';
      const fill=document.createElement('span');
      const delay=(i%2?0.04:0)+(i*0.03);
      fill.style.transition=`transform .55s cubic-bezier(.19,1,.22,1) ${delay}s, opacity .45s ease ${delay}s`;
      fill.style.transform=`translate3d(0,${i%2?'-110%':'110%'},0)`;
      slice.append(fill);
      wrap.append(slice);
    }
    hover.append(wrap);
    return hover;
  }

  function setHover(card,on){
    buildSlices(card);
    card.classList.toggle('is-hover',on);
    if(!reduced){
      card.querySelectorAll('.process-card-slice>span').forEach((fill,i)=>{
        fill.style.transform=on?'translate3d(0,0,0)':`translate3d(0,${i%2?'-110%':'110%'},0)`;
        fill.style.opacity=on?'1':'0';
      });
    }
    if(on&&!reduced&&typeof reveal==='function'){
      card.querySelectorAll(TEXT_SEL).forEach(el=>{
        el.dataset.ready='';
        reveal(el,0,220);
      });
    }
  }

  cards.forEach(card=>{
    buildSlices(card);
    if(!coarse){
      card.addEventListener('pointerenter',()=>{if(!dragging)setHover(card,true)});
      card.addEventListener('pointerleave',()=>setHover(card,false));
    }
  });
  document.addEventListener('pointerdown',event=>{
    if(!tapped)return;
    if(tapped.contains(event.target))return;
    setHover(tapped,false);
    tapped=null;
  });

  applyTransform();

  function intro(){
    const steps=[...section.querySelectorAll('[data-process-step]')];
    if(typeof prepare==='function')section.querySelectorAll('.fx').forEach(el=>prepare(el));
    if(reduced||!('IntersectionObserver' in window)||typeof revealLayer!=='function'){
      steps.forEach(step=>step.style.visibility='visible');
      return;
    }
    section.classList.add('is-pending');
    const observer=new IntersectionObserver(async entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      try{
        const headline=section.querySelector('.process-headline');
        const label=section.querySelector('.process-label');
        const railStep=section.querySelector('.process-rail');
        const summary=section.querySelector('.process-summary');
        const other=window.SITE_CONTENT?.effects?.principlesOtherMs||600;
        const main=window.SITE_CONTENT?.effects?.principlesMainMs||1000;
        if(label)await revealLayer(label,other);
        if(headline)await revealLayer(headline,main);
        if(railStep){
          railStep.style.visibility='visible';
          if(!reduced)await railStep.animate([{opacity:0,transform:'translate3d(40px,0,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:700,easing:'ease-out'}).finished.catch(()=>{});
        }
        if(summary)await revealLayer(summary,other);
      }finally{section.classList.remove('is-pending')}
    },{threshold:0,rootMargin:'0px 0px -12% 0px'});
    observer.observe(section);
  }
  intro();
})();
