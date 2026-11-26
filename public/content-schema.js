(() => {
  window.normalizeSiteContent = input => {
    const defaults=window.SITE_DEFAULTS;
    return {...input,about:{...defaults.about,...input.about},visibility:{...defaults.visibility,...input.visibility}};
  };
})();
