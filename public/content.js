(() => {
  const c=window.normalizeSiteContent(window.SITE_CONTENT||structuredClone(window.SITE_DEFAULTS));window.SITE_CONTENT=c;
  const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],text=(s,value)=>{const el=typeof s==='string'?q(s):s;if(el)el.textContent=value??''};
  const el=(tag,className,value)=>{const node=document.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=value;return node};
  document.title=c.meta.title;q('meta[name="description"]').content=c.meta.description;
  const root=document.documentElement;root.style.setProperty('--accent',c.meta.accent);root.style.setProperty('--grain-opacity',c.effects.grainOpacity);root.style.setProperty('--grain-reduced-opacity',c.effects.grainOpacity*.5294);root.style.setProperty('--video-scale',c.effects.videoScale+'%');root.style.setProperty('--video-dim',c.effects.videoDim/100);
  root.style.setProperty('--site-cursor','url('+JSON.stringify(c.effects.cursor)+')');
  text('.brand h1',c.hero.brand);text('.brand p',c.hero.agency);text('.intro',c.hero.intro);text('footer .details span:nth-child(1)',c.hero.footerLocation);text('footer .details span:nth-child(2)',c.hero.footerSince);
  const panels={};
  const services=q('.services');
  services.replaceChildren();
  services.hidden=!c.hero.services.length;
  function serviceDivider(src){
    const line=el('img');
    line.src='assets/'+src;
    line.alt='';
    return line;
  }
  c.hero.services.forEach((service,i)=>{
    const label=el('span','fx',service.title);
    label.setAttribute('role','listitem');
    services.append(serviceDivider(i===0?'line0.svg':'line1.svg'),label);
  });
  if(c.hero.services.length)services.append(serviceDivider('line1.svg'));

  const nav=q('.navigation'),stickyNav=q('.sticky-navigation');
  nav.replaceChildren();
  function addNavigationLink(label,target,active=false){
    if (!target || c.visibility[target==='selected-works'?'works':target]===false) return;
    const link=el('a',active?'active fx':'fx',label);
    link.href='#'+target;
    nav.append(link);
    stickyNav.append(link.cloneNode(true));
  }
  addNavigationLink(c.hero.worksLabel,'selected-works',true);
  c.hero.navigation.forEach(item=>addNavigationLink(item.label,window.heroNavigationTarget(item)));
  const thumbs=q('.thumbnails');thumbs.replaceChildren();thumbs.classList.toggle('many-slides',c.hero.slides.length>5);
  c.hero.slides.forEach((slide,i)=>{const button=el('button','thumb'+(i===c.hero.initialSlide?' selected':''));button.dataset.project=i;button.setAttribute('aria-label',slide.title);button.setAttribute('aria-pressed',String(i===c.hero.initialSlide));const image=el('img');image.src=window.heroSlideMedia(slide).poster;image.alt='';button.append(image);thumbs.append(button)});
  const initial=c.hero.slides[c.hero.initialSlide]||c.hero.slides[0];q('#project').src=window.heroSlideMedia(initial).poster;
  const card=q('.project-card'),cardImage=card.querySelector('img');cardImage.src=window.heroSlideMedia(initial).poster;cardImage.alt=initial.title;card.setAttribute('aria-label','Посмотреть '+initial.title);
  for (const group of all('.social-links')) {
    group.replaceChildren();
    for (const item of c.hero.socials) {
      if (!item.label.trim()) continue;
      const link=el(item.url?'a':'span','',item.label);
      if (item.url) {
        link.href=item.url;
        link.target='_blank';
        link.rel='noopener noreferrer';
      }
      group.append(link);
    }
  }
  const siteFooter=q('.site-footer');
  if(siteFooter){
    const email=siteFooter.querySelector('.site-footer-email');
    if(c.contacts.email){
      const address=c.contacts.email.replace(/^mailto:/i,'');
      email.href='mailto:'+address;
      email.textContent=address;
    }
    if(c.contacts.telegram){
      siteFooter.querySelector('.site-footer-telegram').href=c.contacts.telegram;
      siteFooter.querySelector('.site-footer-cta').href=c.contacts.telegram;
    }

  }
  text('.principles-label .fx',c.principles.label);const parts=all('.principles-statement>.fx');[c.principles.before,c.principles.highlight,c.principles.after].forEach((value,i)=>text(parts[i],value));
  text('.principles-description',c.principles.description);text('.principles-name',c.principles.name);text('.principles-role',c.principles.role);text('.principles-founder blockquote',c.principles.quote);q('.principles-portrait img').src=c.principles.portrait;q('.principles-portrait img').alt=c.principles.name;
  const directionTemplate=q('.principles-directions button').cloneNode(true);q('.principles-directions').replaceChildren();c.principles.directions.forEach(item=>{const button=directionTemplate.cloneNode(true);text(button.querySelector('span'),item.label);button.dataset.panel=item.title;panels[item.title]=item.body;q('.principles-directions').append(button)});
  const workTemplate=q('.work').cloneNode(true),workList=q('#selected-works'),footer=workList.querySelector('.works-all');all('.work').forEach(node=>node.remove());
  c.works.items.filter(item=>item.visible).forEach((item,index)=>{const article=workTemplate.cloneNode(true);article.dataset.work=index;const title=article.querySelector('.work-title');title.id='work-title-'+(index+1);article.setAttribute('aria-labelledby',title.id);text(title,item.title);text(article.querySelector('.work-client'),item.client);text(article.querySelector('.work-index .fx'),item.category);text(article.querySelector('.work-number'),item.number);text(article.querySelector('.work-description'),item.description);text(article.querySelector('.work-duration'),item.duration);const image=article.querySelector('.work-preview');image.src=item.preview;image.alt=item.previewAlt||item.title;const video=article.querySelector('video');video.dataset.src=item.video;video.setAttribute('aria-label','Видео проекта '+item.title);const link=article.querySelector('.work-case-link');link.dataset.caseIndex=index;link.dataset.caseUrl=item.caseUrl;text(link,c.works.caseLabel);article.querySelector('.work-play').setAttribute('aria-label','Воспроизвести видео '+item.title);workList.insertBefore(article,footer)});
  text('.works-all .fx',c.works.allLabel);text('.contact-link',c.contacts.buttonLabel);q('.contact-link').href=c.contacts.telegram||('mailto:'+c.contacts.email);text('.panel-content .eyebrow',c.hero.brand+' / '+c.hero.agency);
  const processSection=q('#process');
  if(processSection&&c.process){
    text('.process-label .fx',c.process.label);
    const titles=all('.process-headline>.fx');text(titles[0],c.process.titleAccent);text(titles[1],c.process.title);
    text('.process-summary-term',c.process.term);
    const cost=c.process.cost;
    const split=cost.indexOf(':')+1;
    text('.process-cost-label',split ? cost.slice(0,split) : cost);
    text('.process-cost-value',split ? cost.slice(split).trim().replace(/(\d)\s+(?=\d)/g,'$1\u00a0') : '');
    const bg=q('.process-bg img');if(bg&&c.process.background)bg.src=c.process.background;
    const cardTemplate=q('.process-card');
    if(cardTemplate&&Array.isArray(c.process.steps)){
      const track=q('.process-track');
      track.replaceChildren();
      c.process.steps.forEach((step,index)=>{
        const card=cardTemplate.cloneNode(true);
        card.dataset.step=index;
        card.querySelectorAll('.process-card-face').forEach(face=>{
          text(face.querySelector('.process-index'),step.index);
          text(face.querySelector('.process-card-title'),step.title);
          text(face.querySelector('.process-card-copy'),step.body);
          text(face.querySelector('.process-card-days'),step.days);
        });
        track.append(card);
      });
    }
    processSection.hidden=!c.visibility.process;
  }
  const aboutSection=q('#about');
  if(aboutSection){
    aboutSection.hidden=!c.visibility.about;
    aboutSection.style.setProperty('--about-accent',c.about.accent);
    const portrait=aboutSection.querySelector('.about-photo img');portrait.src=c.about.image;portrait.alt=c.about.imageAlt;
    aboutSection.querySelectorAll('[data-about]').forEach(node=>{node.textContent=c.about[node.dataset.about]??''});
  }
  const faqSection=q('#faq');
  if(faqSection&&c.faq){
    text('.faq-title',c.faq.title);
    const itemTemplate=q('.faq-item');
    if(itemTemplate&&Array.isArray(c.faq.items)){
      const list=q('.faq-list');
      list.replaceChildren();
      c.faq.items.forEach((item,index)=>{
        const row=itemTemplate.cloneNode(true);
        row.dataset.faqIndex=index;
        text(row.querySelector('.faq-question'),item.question);
        text(row.querySelector('.faq-answer'),item.answer);
        const trigger=row.querySelector('.faq-trigger');
        if(trigger){
          trigger.setAttribute('aria-expanded','false');
          const panel=row.querySelector('.faq-panel');
          if(panel){panel.id='faq-panel-'+index;trigger.setAttribute('aria-controls',panel.id)}
        }
        list.append(row);
      });
    }
    faqSection.hidden=!c.visibility.faq;
  }
  q('#principles').hidden=!c.visibility.principles;workList.hidden=!c.visibility.works;
  window.SITE_PANELS=panels;
})();
