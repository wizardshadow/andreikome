(() => {
  // Keep the original CMS fields compatible with already published slides.
  window.heroSlideMedia = slide => /\.mp4(?:[?#]|$)/i.test(slide.image)
    ? {video:slide.image, poster:slide.thumbnail}
    : {video:'', poster:slide.image};
  window.normalizeSiteContent = input => {
    const defaults=window.SITE_DEFAULTS;
    const about = {...defaults.about, ...input.about};
    if (about.image === 'assets/principles/artur.png') {
      about.image = defaults.about.image;
    }
    return {...input, about, visibility:{...defaults.visibility,...input.visibility}};
  };
})();
