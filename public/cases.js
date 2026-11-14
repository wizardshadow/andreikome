(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const section = document.querySelector('#cases');
  if (!section) return;

  const list = section.querySelector('.cases-list');
  const rows = [...list.querySelectorAll('.cases-row')];

  rows.forEach((row) => {
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
  });

  const navCases = document.querySelector('#nav-cases,[data-scroll="#cases"]');
  if (navCases) {
    navCases.addEventListener('click', (event) => {
      event.preventDefault();
      section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  }

  const worksAll = document.querySelector('.works-all');
  if (worksAll) {
    worksAll.addEventListener('click', () => {
      section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  }
})();
