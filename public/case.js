(() => {
  const c = window.SITE_CONTENT || window.SITE_DEFAULTS || {};
  const params = new URLSearchParams(location.search);
  const pathSlug = location.pathname.split('/').filter(Boolean).pop();
  const slug = params.get('slug') || (pathSlug && pathSlug !== 'case.html' && pathSlug !== 'case' ? pathSlug : '');
  const items = c.cases?.items || [];
  const item = (slug && items.find((entry) => entry.slug === slug)) || items[0];

  const setText = (sel, value) => {
    document.querySelectorAll(sel).forEach((el) => {
      el.textContent = value || '';
    });
  };

  if (!item) {
    setText('[data-case-title-a]', 'Кейс');
    setText('[data-case-title-b]', 'не найден');
    return;
  }

  document.title = `${item.title} — ${c.meta?.title || 'ANDREIKO'}`;
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) descMeta.content = item.description || c.meta?.description || '';

  const words = String(item.title || '').trim().split(/\s+/).filter(Boolean);
  const titleA = words[0] || item.title || '';
  const titleB = words.slice(1).join(' ') || '';
  setText('[data-case-title-a]', titleA);
  setText('[data-case-title-b]', titleB || '\u00a0');

  const category = (item.category || '').toUpperCase();
  const badge = (item.badge || titleB || category || 'CASE').toUpperCase();
  setText('[data-case-category]', category);
  setText('[data-case-category-badge]', badge);
  setText('[data-case-client]', item.client || '');

  const description = item.description || '';
  setText('[data-case-description]', description);
  setText('[data-case-description-short]', description);

  const lead = item.lead || (description ? `О разработке проекта${item.client ? ` для ${item.client}` : ''}` : '');
  setText('[data-case-lead]', lead);

  const second =
    item.description2 ||
    'Мы проводим глубокий анализ бизнеса, философии и конкурентов, чтобы дизайн выделялся на рынке и работал на результат.';
  setText('[data-case-description-2]', second);

  const visualCopy =
    item.visualCopy ||
    description ||
    'Исходя из фирменного стиля клиента, мы выбрали динамичные и современные решения. Цветовая палитра и типографика должны были передать энергетику и креативный подход команды студии.';
  setText('[data-case-visual-copy]', visualCopy);

  if (item.date) setText('[data-case-date]', item.date);
  if (item.designDays) setText('[data-case-design-days]', item.designDays);
  if (item.codeDays) setText('[data-case-code-days]', item.codeDays);
  if (item.launchDays) setText('[data-case-launch-days]', item.launchDays);
  if (item.timelineNote) setText('[data-case-timeline-note]', item.timelineNote);

  const cover = document.querySelector('[data-case-cover]');
  if (cover) {
    cover.src = item.cover || 'assets/case/cover-hero.png';
    cover.alt = item.title || '';
  }

  const photo = document.querySelector('[data-case-photo]');
  if (photo) {
    photo.src = item.ideaPhoto || 'assets/case/idea-photo.png';
    photo.alt = item.title || '';
  }

  const phone = document.querySelector('[data-case-phone]');
  if (phone && item.phone) {
    phone.src = item.phone;
    phone.alt = item.title || '';
  }

  const tapes = document.querySelector('[data-case-tapes]');
  if (tapes && item.tapes) {
    tapes.src = item.tapes;
    tapes.alt = `${item.title || 'Кейс'} — мокапы`;
  }

  const grid = document.querySelector('[data-case-gallery]');
  if (grid) {
    grid.replaceChildren();
    const gallery = (item.gallery || []).filter(Boolean);
    if (!gallery.length && item.cover) gallery.push(item.cover);

    const makeImg = (src, index) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = `${item.title || 'Кейс'} — превью ${index + 1}`;
      img.loading = index ? 'lazy' : 'eager';
      return img;
    };

    let i = 0;
    while (i < gallery.length) {
      const remaining = gallery.length - i;
      if (remaining >= 3 && i > 0) {
        const pair = document.createElement('div');
        pair.className = 'case-screen-item is-pair';
        const left = document.createElement('div');
        left.append(makeImg(gallery[i], i));
        const right = document.createElement('div');
        right.append(makeImg(gallery[i + 1], i + 1));
        pair.append(left, right);
        grid.append(pair);
        i += 2;
        continue;
      }
      const frame = document.createElement('div');
      frame.className = 'case-screen-item is-wide';
      frame.append(makeImg(gallery[i], i));
      grid.append(frame);
      i += 1;
    }
  }

  const contact = document.querySelector('.case-end-cta');
  if (contact) {
    contact.href = c.contacts?.telegram || (c.contacts?.email ? `mailto:${c.contacts.email}` : '#');
    if (c.contacts?.buttonLabel) contact.textContent = c.contacts.buttonLabel;
  }
})();
