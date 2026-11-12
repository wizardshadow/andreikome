(() => {
  const c=window.SITE_CONTENT||structuredClone(window.SITE_DEFAULTS);window.SITE_CONTENT=c;
  const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],text=(s,value)=>{const el=typeof s==='string'?q(s):s;if(el)el.textContent=value??''};
  const el=(tag,className,value)=>{const node=document.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=value;return node};
  document.title=c.meta.title;q('meta[name="description"]').content=c.meta.description;
  const root=document.documentElement;root.style.setProperty('--accent',c.meta.accent);root.style.setProperty('--grain-opacity',c.effects.grainOpacity);root.style.setProperty('--grain-reduced-opacity',c.effects.grainOpacity*.5294);root.style.setProperty('--video-scale',c.effects.videoScale+'%');root.style.setProperty('--video-inset',(100-c.effects.videoScale)/2+'%');root.style.setProperty('--video-dim',c.effects.videoDim/100);
  root.style.setProperty('--site-cursor','url('+JSON.stringify(c.effects.cursor)+')');
  text('.brand h1',c.hero.brand);text('.brand p',c.hero.agency);text('.intro',c.hero.intro);text('footer .details span:nth-child(1)',c.hero.footerLocation);text('footer .details span:nth-child(2)',c.hero.footerSince);
  const panels={};
  q('.services').replaceChildren();
  c.hero.services.forEach((service,i)=>{const line=el('img');line.src='assets/'+(i===0?'line0.svg':'line1.svg');line.alt='';const button=el('button','fx',service.title);button.dataset.panel=service.title;panels[service.title]=service.body;q('.services').append(line,button)});
  const endLine=el('img');endLine.src='assets/line1.svg';endLine.alt='';q('.services').append(endLine);
  const nav=q('.navigation');nav.replaceChildren();const works=el('button','active fx',c.hero.worksLabel);works.id='works';nav.append(works);
  c.hero.navigation.forEach(item=>{const button=el('button','fx',item.label);button.dataset.panel=item.title;panels[item.title]=item.body;nav.append(button)});
  const thumbs=q('.thumbnails');thumbs.replaceChildren();thumbs.classList.toggle('many-slides',c.hero.slides.length>5);
  c.hero.slides.forEach((slide,i)=>{const button=el('button','thumb'+(slide.thumbnailCrop?' crop':'')+(i===c.hero.initialSlide?' selected':''));button.dataset.project=i;button.setAttribute('aria-label',slide.title);button.setAttribute('aria-pressed',String(i===c.hero.initialSlide));const image=el('img');image.src=slide.thumbnail||slide.image;image.alt=slide.thumbnailAlt||slide.title;button.append(image);thumbs.append(button)});
  const initial=c.hero.slides[c.hero.initialSlide]||c.hero.slides[0];q('#project').src=initial.image;
  const card=q('.project-card'),cardImage=card.querySelector('img');cardImage.src=initial.cardImage||initial.image;cardImage.alt=initial.title;if(!initial.cardCrop)cardImage.style.cssText='width:100%;height:100%;left:0;top:0;object-fit:cover';card.setAttribute('aria-label','Посмотреть '+initial.title);
  q('.socials').replaceChildren();c.hero.socials.forEach(item=>{const button=el('button','fx',item.label);button.dataset.social=item.label;if(item.url)button.dataset.url=item.url;q('.socials').append(button)});
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
    text('.process-summary-term',c.process.term);text('.process-summary-cost',c.process.cost);
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
