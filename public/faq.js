(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const section=document.querySelector('#faq');
  if(!section)return;
  const list=section.querySelector('.faq-list');

  function setOpen(item,open){
    const trigger=item.querySelector('.faq-trigger');
    const panel=item.querySelector('.faq-panel');
    if(!trigger||!panel)return;
    item.classList.toggle('is-open',open);
    trigger.setAttribute('aria-expanded',open?'true':'false');
    const answer=panel.querySelector('.faq-answer');
    if(open){
      panel.hidden=false;
      if(reduced){panel.style.height='auto';panel.style.opacity='1'}
      else{
        const h=panel.scrollHeight;
        panel.style.height='0px';
        panel.style.opacity='0';
        requestAnimationFrame(()=>{
          panel.style.height=h+'px';
          panel.style.opacity='1';
        });
        const done=event=>{
          if(event.propertyName&&event.propertyName!=='height')return;
          if(item.classList.contains('is-open'))panel.style.height='auto';
          panel.removeEventListener('transitionend',done);
        };
        panel.addEventListener('transitionend',done);
      }
      if(answer&&!reduced&&typeof reveal==='function'){
        const len=(answer.dataset.original||answer.textContent||'').length;
        reveal(answer,0,Math.max(320,Math.min(900,160+len*8)));
      }
    }else{
      if(answer&&typeof settleReveal==='function')settleReveal(answer);
      if(reduced){panel.hidden=true;panel.style.height='';panel.style.opacity='';return}
      const h=panel.scrollHeight;
      panel.style.height=h+'px';
      panel.getBoundingClientRect();
      panel.style.height='0px';
      panel.style.opacity='0';
      const done=event=>{
        if(event.propertyName&&event.propertyName!=='height')return;
        if(!item.classList.contains('is-open')){
          panel.hidden=true;
          panel.style.height='';
          panel.style.opacity='';
        }
        panel.removeEventListener('transitionend',done);
      };
      panel.addEventListener('transitionend',done);
    }
  }

  function closeOthers(except){
    list.querySelectorAll('.faq-item.is-open').forEach(item=>{
      if(item!==except)setOpen(item,false);
    });
  }

  list.addEventListener('click',event=>{
    const trigger=event.target.closest('.faq-trigger');
    if(!trigger||!list.contains(trigger))return;
    const item=trigger.closest('.faq-item');
    const open=!item.classList.contains('is-open');
    closeOthers(item);
    setOpen(item,open);
  });

  function intro(){
    if(typeof prepare==='function')section.querySelectorAll('.fx').forEach(el=>prepare(el));
    const steps=[section.querySelector('.faq-header'),...list.querySelectorAll('.faq-item')];
    if(reduced||!('IntersectionObserver' in window)||typeof reveal!=='function'){
      steps.forEach(el=>{if(el)el.style.visibility='visible'});
      return;
    }
    section.classList.add('is-pending');
    const observer=new IntersectionObserver(async entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      try{
        const title=section.querySelector('.faq-title');
        const other=window.SITE_CONTENT?.effects?.principlesOtherMs||600;
        if(title){
          section.querySelector('.faq-header').style.visibility='visible';
          if(typeof revealLayer==='function')await revealLayer(title,other);
          else await reveal(title,0,other);
        }
        for(const item of list.querySelectorAll('.faq-item')){
          item.style.visibility='visible';
          const q=item.querySelector('.faq-question');
          if(q)await reveal(q,0,Math.min(700,220+(q.textContent||'').length*10));
        }
      }finally{section.classList.remove('is-pending')}
    },{threshold:0.12,rootMargin:'0px 0px -8% 0px'});
    observer.observe(section);
  }
  intro();
})();
