(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const section = document.querySelector('#cases');
  if (!section) return;

  const list = section.querySelector('.cases-list');
  if (!list) return;

  const bindRow = (row) => {
    const video = row.querySelector('.cases-video');
    const src = video?.dataset.src;
    if (!video || !src || reduced) return;
    const enter = () => {
      if (!video.src) video.src = src;
      video.play().catch(() => {});
      row.classList.add('is-hover');
    };
    const leave = () => {
      video.pause();
      row.classList.remove('is-hover');
    };
    row.addEventListener('pointerenter', enter);
    row.addEventListener('pointerleave', leave);
    row.addEventListener('focusin', enter);
    row.addEventListener('focusout', leave);
  };

  const observe = new MutationObserver(() => {
    [...list.querySelectorAll('.cases-row')].forEach((row) => {
      if (row.dataset.bound) return;
      row.dataset.bound = '1';
      bindRow(row);
    });
  });
  observe.observe(list, { childList: true });
  [...list.querySelectorAll('.cases-row')].forEach((row) => {
    row.dataset.bound = '1';
    bindRow(row);
  });
})();
