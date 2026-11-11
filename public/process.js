(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const section=document.querySelector('#process');
  if(!section)return;
  const rail=section.querySelector('.process-rail');
  const track=section.querySelector('.process-track');
  const cards=[...section.querySelectorAll('.process-card')];

  function maxOffset(){
    return Math.max(0,track.scrollWidth-rail.clientWidth);
  }
  let x=0,vx=0,dragging=false,lastX=0,lastT=0,raf=0;

  function apply(){
    const max=maxOffset();
    x=Math.min(0,Math.max(-max,x));
    track.style.transform=`translate3d(${x}px,0,0)`;
  }
  function kinetic(){
    if(dragging)return;
    x+=vx;
    vx*=.92;
    apply();
    if(Math.abs(vx)>0.08)raf=requestAnimationFrame(kinetic);
    else{vx=0;raf=0}
  }
  function onPointerDown(event){
    if(event.button!=null&&event.button!==0)return;
    dragging=true;rail.classList.add('is-dragging');
    vx=0;if(raf){cancelAnimationFrame(raf);raf=0}
    lastX=event.clientX;lastT=performance.now();
    rail.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event){
    if(!dragging)return;
    const now=performance.now();
    const dx=event.clientX-lastX;
    const dt=Math.max(1,now-lastT);
    x+=dx;
    vx=dx/dt*16;
    lastX=event.clientX;lastT=now;
    apply();
  }
  function onPointerUp(event){
    if(!dragging)return;
    dragging=false;rail.classList.remove('is-dragging');
    try{rail.releasePointerCapture?.(event.pointerId)}catch{}
    if(!reduced&&Math.abs(vx)>0.4)raf=requestAnimationFrame(kinetic);
    else vx=0;
  }
  rail.addEventListener('pointerdown',onPointerDown);
  rail.addEventListener('pointermove',onPointerMove);
  rail.addEventListener('pointerup',onPointerUp);
  rail.addEventListener('pointercancel',onPointerUp);
  rail.addEventListener('lostpointercapture',()=>{dragging=false;rail.classList.remove('is-dragging')});
  rail.addEventListener('wheel',event=>{
    if(Math.abs(event.deltaX)<Math.abs(event.deltaY)&&!event.shiftKey)return;
    event.preventDefault();
    x-=event.deltaX||event.deltaY;
    vx=0;apply();
  },{passive:false});
  window.addEventListener('resize',()=>apply(),{passive:true});

  // Clip-path hover reveal (Tympanus-style) without background imagery — only card layers.
  function setClip(card,clientX,clientY,radius){
    const hover=card.querySelector('.process-card-hover');
    if(!hover)return;
    const box=card.getBoundingClientRect();
    const px=((clientX-box.left)/box.width)*100;
    const py=((clientY-box.top)/box.height)*100;
    hover.style.clipPath=`circle(${radius}px at ${px}% ${py}%)`;
  }
  cards.forEach(card=>{
    const hover=card.querySelector('.process-card-hover');
    if(!hover)return;
    if(reduced){
      card.addEventListener('pointerenter',()=>{hover.style.clipPath='inset(0)'});
      card.addEventListener('pointerleave',()=>{hover.style.clipPath='circle(0% at 50% 50%)'});
      return;
    }
    card.addEventListener('pointerenter',event=>setClip(card,event.clientX,event.clientY,Math.max(card.offsetWidth,card.offsetHeight)*1.2));
    card.addEventListener('pointermove',event=>setClip(card,event.clientX,event.clientY,Math.max(card.offsetWidth,card.offsetHeight)*1.25));
    card.addEventListener('pointerleave',event=>{
      const box=card.getBoundingClientRect();
      const px=((event.clientX-box.left)/box.width)*100;
      const py=((event.clientY-box.top)/box.height)*100;
      hover.style.transition='clip-path .45s ease';
      hover.style.clipPath=`circle(0% at ${px}% ${py}%)`;
      const clear=()=>{hover.style.transition='';hover.removeEventListener('transitionend',clear)};
      hover.addEventListener('transitionend',clear);
    });
  });

  // Inherit site-wide crypto/fx reveal on first intersection.
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
