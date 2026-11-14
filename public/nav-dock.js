(() => {
  const dock = document.querySelector('#site-dock');
  if (!dock) return;
  const isCasePage = document.body.classList.contains('case-page');
  const hero = document.querySelector('.hero');

  function sync() {
    if (isCasePage) {
      dock.hidden = false;
      dock.classList.add('is-visible');
      return;
    }
    const threshold = hero ? hero.offsetHeight * 0.55 : 420;
    const show = scrollY > threshold;
    dock.hidden = !show;
    dock.classList.toggle('is-visible', show);
  }

  addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  sync();

  dock.querySelectorAll('[data-dock-contact]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const panelBtn = document.querySelector('.navigation [data-panel="Контакты"],.navigation [data-panel="[ Контакты ]"]');
      const onHome = location.pathname === '/' || location.pathname.endsWith('/index.html') || location.pathname === '';
      if (panelBtn && onHome) {
        event.preventDefault();
        panelBtn.click();
      }
    });
  });
})();
