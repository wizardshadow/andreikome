(() => {
  const c = window.SITE_CONTENT || window.SITE_DEFAULTS;
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug') || location.pathname.split('/').filter(Boolean).pop();
  const items = c.cases?.items || [];
  const item = items.find((entry) => entry.slug === slug) || items[0];
  if (!item) {
    document.querySelector('[data-case-title]').textContent = 'Кейс не найден';
    return;
  }

  document.title = `${item.title} — ${c.meta?.title || 'ANDREIKO'}`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.content = item.description || c.meta?.description || '';

  const cover = document.querySelector('.case-cover-img');
  cover.src = item.cover || '';
  cover.alt = item.title || '';
  document.querySelector('[data-case-title]').textContent = item.title || '';
  document.querySelector('[data-case-category]').textContent = item.category || '';
  document.querySelector('[data-case-client]').textContent = item.client ? `Клиент [ ${item.client} ]` : '';
  document.querySelector('[data-case-description]').textContent = item.description || '';

  const grid = document.querySelector('[data-case-gallery]');
  grid.replaceChildren();
  (item.gallery || []).filter(Boolean).forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `${item.title} — превью ${index + 1}`;
    img.loading = index ? 'lazy' : 'eager';
    grid.append(img);
  });

  const contact = document.querySelector('.case-end-link');
  if (contact) contact.href = c.contacts?.telegram || (`mailto:${c.contacts?.email || ''}`);
})();
