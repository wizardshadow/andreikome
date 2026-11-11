(() => {
  const section=document.querySelector('#selected-works');
  if(!section)return;
  const cards=[...section.querySelectorAll('.work')];
  const states=cards.map(card=>({card,frame:card.querySelector('.work-media'),image:card.querySelector('.work-preview'),video:card.querySelector('.work-video'),canvas:card.querySelector('.work-pixels'),inView:false,nearby:false,revision:0,raf:0,phase:'poster',textStarted:false}));
  const transitionDuration=window.SITE_CONTENT.effects.videoTransitionMs,videoScale=window.SITE_CONTENT.effects.videoScale/100;
  function setPhase(state,phase){state.phase=phase;state.frame.dataset.videoState=phase}
  function drawVideo(state,progress,entering){
    const {canvas,video,frame}=state,context=canvas.getContext('2d');
    if(!context||!video.videoWidth||!video.videoHeight)return false;
    const bounds=frame.getBoundingClientRect();if(!bounds.width||!bounds.height)return false;
    const block=1+47*Math.pow(entering?1-progress:progress,2);
    canvas.width=Math.max(1,Math.ceil(bounds.width*videoScale/block));canvas.height=Math.max(1,Math.ceil(bounds.height*videoScale/block));
    const scale=Math.max(canvas.width/video.videoWidth,canvas.height/video.videoHeight);
    const width=video.videoWidth*scale,height=video.videoHeight*scale;
    context.drawImage(video,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
    // Clear whole pixel cells, leaving the parallax poster visible underneath.
    const coverage=entering?progress:1-progress;
    if(coverage<1){
      const cell=Math.max(1,Math.round(8/block));
      for(let y=0;y<canvas.height;y+=cell)for(let x=0;x<canvas.width;x+=cell){
        const seed=((Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0)/4294967296;
        if(seed>coverage)context.clearRect(x,y,cell,cell);
      }
    }
    return true;
  }
  function transition(state,entering,revision){
    cancelAnimationFrame(state.raf);state.video.style.opacity='0';state.canvas.hidden=false;
    const start=performance.now();setPhase(state,entering?'assembling':'dissolving');
    function frame(now){
      if(revision!==state.revision)return;
      const progress=Math.min(1,Math.max(0,(now-start)/transitionDuration));
      try{if(!drawVideo(state,progress,entering)){finish();return}}catch{finish();return}
      if(progress<1)state.raf=requestAnimationFrame(frame);else finish();
    }
    function finish(){
      if(revision!==state.revision)return;
      state.canvas.hidden=true;state.raf=0;
      state.video.style.opacity=entering?'1':'0';
      if(!entering){state.video.pause();state.video.currentTime=0}
      setPhase(state,entering?'playing':'poster');
    }
    state.raf=requestAnimationFrame(frame);
  }
  async function showVideo(state,manual=false){
    if(state.inView&&!manual)return;
    for(const other of states)if(other!==state&&other.inView)hideVideo(other);
    state.inView=true;const revision=++state.revision;
    cancelAnimationFrame(state.raf);
    if(reduced&&!manual){state.frame.classList.add('manual-play');return}
    const video=state.video;video.muted=true;
    if(!video.getAttribute('src')){video.src=video.dataset.src;video.load()}
    setPhase(state,'loading');
    try{
      await video.play();
      if(revision!==state.revision){if(!state.inView)video.pause();return}
      if(document.hidden||!state.inView){hideVideo(state,true);return}
      state.frame.classList.remove('manual-play');state.frame.classList.add('is-video-active');
      if(reduced){state.canvas.hidden=true;video.style.opacity='1';setPhase(state,'playing')}
      else transition(state,true,revision);
    }catch{
      if(revision!==state.revision)return;
      state.video.style.opacity='0';state.canvas.hidden=true;
      state.frame.classList.remove('is-video-active');state.frame.classList.add('manual-play');setPhase(state,'poster');
    }
  }
  function hideVideo(state,immediate=false){
    state.inView=false;const revision=++state.revision;
    cancelAnimationFrame(state.raf);state.video.pause();state.frame.classList.remove('manual-play','is-video-active');
    if(immediate||reduced||state.video.readyState<2||state.phase==='poster'||state.phase==='loading'){
      state.canvas.hidden=true;state.video.style.opacity='0';setPhase(state,'poster');return;
    }
    transition(state,false,revision);
  }
  async function revealWork(state){
    if(state.textStarted)return;state.textStarted=true;
    const layers=[...state.card.querySelectorAll('[data-work-text]')];
    try{await document.fonts.ready;await Promise.all(layers.map((layer,i)=>{
      const texts=layer.matches('.fx')?[layer]:[...layer.querySelectorAll('.fx')];
      const ready=texts.map(el=>reveal(el,i*70,window.SITE_CONTENT.effects.workTextMs));layer.style.visibility='visible';return Promise.all(ready);
    }))}finally{state.card.classList.remove('text-pending')}
  }
  // Only the closest frame inside the central focus zone may play.
  function updateFocus(){
    let focused=null,best=Infinity;
    if(!document.hidden&&!document.querySelector('dialog[open]'))for(const state of states){
      const bounds=state.frame.getBoundingClientRect();
      const visible=Math.max(0,Math.min(bounds.bottom,innerHeight)-Math.max(bounds.top,0));
      const distance=Math.abs(bounds.top+bounds.height/2-innerHeight/2);
      if(bounds.height>0&&visible/bounds.height>=.6&&distance<=innerHeight*.22&&distance<best){focused=state;best=distance}
    }
    for(const state of states)if(state!==focused&&state.inView)hideVideo(state);
    if(focused&&!focused.inView)showVideo(focused);
  }
  let parallaxFrame=0;
  function updateViewport(){
    parallaxFrame=0;
    for(const state of states){
      if(reduced||!state.nearby)continue;
      const bounds=state.frame.getBoundingClientRect();
      const progress=Math.max(-1,Math.min(1,(innerHeight/2-bounds.top-bounds.height/2)/((innerHeight+bounds.height)/2)));
      const shift=progress*bounds.height*50/643;
      state.image.style.setProperty('--parallax-shift',`${shift.toFixed(2)}px`);
      state.image.style.setProperty('--parallax-scale',String(1+2*Math.abs(shift)/Math.max(1,bounds.height)));
    }
    updateFocus();
  }
  function scheduleParallax(){if(!parallaxFrame)parallaxFrame=requestAnimationFrame(updateViewport)}
  if('IntersectionObserver' in window){
    const textObserver=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){const state=states.find(s=>s.card===entry.target);if(state)revealWork(state);textObserver.unobserve(entry.target)}
    },{rootMargin:'0px 0px -8% 0px',threshold:0});
    const videoObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){
        const state=states.find(s=>s.frame===entry.target);state.nearby=entry.isIntersecting;

      }
      scheduleParallax();
    },{threshold:[0,.15,.4]});
    for(const state of states){
      if(!reduced){state.card.querySelectorAll('.fx').forEach(prepare);state.card.classList.add('text-pending')}
      textObserver.observe(state.card);videoObserver.observe(state.frame);
      state.frame.querySelector('.work-play').onclick=()=>showVideo(state,true);
    }
  }else for(const state of states){state.frame.classList.add('manual-play');state.frame.querySelector('.work-play').onclick=()=>showVideo(state,true)}
  window.addEventListener('scroll',scheduleParallax,{passive:true});window.addEventListener('resize',scheduleParallax,{passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){for(const state of states)hideVideo(state,true)}
    else scheduleParallax();
  });
  const dialog=document.querySelector('#works-dialog'),body=dialog.querySelector('.works-detail-body');
  function openCase(index){
    dialog.querySelectorAll('video').forEach(v=>v.pause());body.replaceChildren();
    const state=states[index],title=document.createElement('h2'),copy=document.createElement('p'),video=document.createElement('video');
    title.id='works-dialog-title';title.textContent=(state.card.querySelector('.work-title').getAttribute('aria-label')||state.card.querySelector('.work-title').textContent);title.className='fx';
    copy.textContent=state.card.querySelector('.work-description').getAttribute('aria-label')||state.card.querySelector('.work-description').textContent;video.src=state.video.dataset.src;video.controls=true;video.muted=true;video.playsInline=true;video.preload='metadata';video.poster=state.image.src;
    body.append(title,copy,video);if(!dialog.open)dialog.showModal();updateFocus();reveal(title,0,600);
  }
  section.querySelectorAll('[data-case-index]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.caseUrl){window.open(button.dataset.caseUrl,'_blank','noopener,noreferrer');return}openCase(Number(button.dataset.caseIndex))}));
  section.querySelector('.works-all').onclick=()=>{
    body.replaceChildren();const title=document.createElement('h2'),list=document.createElement('div');title.id='works-dialog-title';title.textContent='Все кейсы';title.className='fx';list.className='works-collection';
    states.forEach((state,index)=>{const button=document.createElement('button');button.type='button';button.textContent=(state.card.querySelector('.work-title').getAttribute('aria-label')||state.card.querySelector('.work-title').textContent)+' ↗';button.onclick=()=>openCase(index);button.addEventListener('pointerenter',()=>sound());list.append(button)});
    body.append(title,list);dialog.showModal();updateFocus();reveal(title,0,600);
  };
  dialog.addEventListener('close',()=>{dialog.querySelectorAll('video').forEach(video=>video.pause());scheduleParallax()});
  document.querySelector('#works').onclick=()=>section.scrollIntoView({behavior:reduced?'instant':'smooth'});
})();
