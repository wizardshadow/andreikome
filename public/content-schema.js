(() => {
  // Keep the original CMS fields compatible with already published slides.
  window.heroSlideMedia = slide => /\.mp4(?:[?#]|$)/i.test(slide.image)
    ? {video:slide.image, poster:slide.thumbnail}
    : {video:'', poster:slide.image};
  const sections = {
    'selected-works':'Работы', about:'Кто я такой', process:'Как я работаю',
    principles:'С кем я работаю', 'site-footer':'Контакты', faq:'FAQ'
  };
  window.heroNavigationSections = sections;
  window.heroNavigationTarget = item => {
    for (const value of [item.title, item.label]) {
      const name = value.trim().replace(/^\[\s*|\s*\]$/g, '').toLowerCase();
      if (Object.hasOwn(sections,name)) return name;
      const match = Object.keys(sections).find(id => sections[id].toLowerCase() === name);
      if (match) return match;
    }
    return '';
  };
  window.normalizeSiteContent = input => {
    const defaults=window.SITE_DEFAULTS;
    const about = {...defaults.about, ...input.about};
    if (about.image === 'assets/principles/artur.png') {
      about.image = defaults.about.image;
    }
    const hero = {...input.hero};
    hero.slides = hero.slides.map(slide => ({caseUrl:'', ...slide}));
    const legacySocials = ['x','threads','in','e-mail'];
    if (hero.socials.length === legacySocials.length &&
        hero.socials.every((item,i) => !item.url && item.label.toLowerCase() === legacySocials[i])) {
      hero.socials = ['IN','X','VK'].map(label => ({label,url:''}));
    }
    return {...input, hero, about, visibility:{...defaults.visibility,...input.visibility}};
  };
})();
