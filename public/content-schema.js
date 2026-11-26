(() => {
  window.normalizeSiteContent = input => {
    const defaults=window.SITE_DEFAULTS;
    const about = {...defaults.about, ...input.about};
    if (about.image === 'assets/principles/artur.png') {
      about.image = defaults.about.image;
    }
    return {...input, about, visibility:{...defaults.visibility,...input.visibility}};
  };
})();
