(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Film grain — ensure canvas exists on every page.
  let canvas = document.querySelector('#grain');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'grain';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
  }
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const tileSize = 256;
    const grainFrames = Array.from({ length: 8 }, () => {
      const tile = document.createElement('canvas');
      tile.width = tile.height = tileSize;
      const tileContext = tile.getContext('2d');
      const pixels = tileContext.createImageData(tileSize, tileSize);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const value = Math.random() < 0.5 ? 0 : 255;
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
        pixels.data[i + 3] = 80 + Math.floor(Math.random() * 176);
      }
      tileContext.putImageData(pixels, 0, 0);
      return ctx.createPattern(tile, 'repeat');
    });
    function drawGrain() {
      const x = Math.floor(Math.random() * tileSize);
      const y = Math.floor(Math.random() * tileSize);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, -x, -y);
      ctx.fillStyle = grainFrames[Math.floor(Math.random() * grainFrames.length)];
      ctx.fillRect(0, 0, canvas.width + tileSize, canvas.height + tileSize);
    }
    function sizeGrain() {
      canvas.width = Math.min(innerWidth, 2560);
      canvas.height = Math.min(innerHeight, 1600);
      drawGrain();
    }
    sizeGrain();
    addEventListener('resize', sizeGrain, { passive: true });
    let grainTimer = null;
    function syncGrain() {
      if (grainTimer !== null) {
        clearInterval(grainTimer);
        grainTimer = null;
      }
      if (!document.hidden && !reduced) {
        drawGrain();
        grainTimer = setInterval(drawGrain, 80);
      }
    }
    document.addEventListener('visibilitychange', syncGrain);
    syncGrain();
  }

  // Inertial wheel scrolling (smooth scroll feel).
  function initKineticScroll() {
    if (reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let target = scrollY;
    let position = scrollY;
    let frame = 0;
    let lastFrame = 0;
    const limit = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      position = target = scrollY;
    }
    function tick(now) {
      const dt = Math.min(50, Math.max(1, now - lastFrame));
      lastFrame = now;
      target = Math.max(0, Math.min(limit(), target));
      const distance = target - position;
      if (Math.abs(distance) < 0.5) {
        position = target;
        window.scrollTo({ top: target, behavior: 'instant' });
        frame = 0;
        return;
      }
      position += distance * (1 - Math.exp(-dt / 180));
      window.scrollTo({ top: position, behavior: 'instant' });
      frame = requestAnimationFrame(tick);
    }
    addEventListener(
      'wheel',
      (event) => {
        if (
          event.defaultPrevented ||
          !event.cancelable ||
          event.ctrlKey ||
          event.metaKey ||
          Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
          !event.deltaY
        )
          return;
        if (document.documentElement.classList.contains('loading') || document.querySelector('dialog[open]'))
          return;
        for (let el = event.target; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
          if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
          const overflow = getComputedStyle(el).overflowY;
          if (
            /auto|scroll/.test(overflow) &&
            el.scrollHeight > el.clientHeight &&
            ((event.deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight) ||
              (event.deltaY < 0 && el.scrollTop > 0))
          )
            return;
        }
        const max = limit();
        if (max === 0) return;
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
        if (!frame) position = target = scrollY;
        else if (Math.sign(delta) !== Math.sign(target - position)) target = position;
        if ((delta < 0 && scrollY <= 0) || (delta > 0 && scrollY >= max)) return;
        event.preventDefault();
        target = Math.max(0, Math.min(max, target + delta));
        if (!frame) {
          lastFrame = performance.now();
          frame = requestAnimationFrame(tick);
        }
      },
      { passive: false }
    );
    addEventListener('pointerdown', stop, { passive: true });
    addEventListener('touchstart', stop, { passive: true });
    addEventListener('keydown', stop);
    addEventListener('resize', stop, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
    });
  }
  initKineticScroll();

  // Pixel cursor trail.
  function initPixelCursor() {
    if (reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const trail = document.createElement('canvas');
    trail.className = 'cursor-trail';
    trail.setAttribute('aria-hidden', 'true');
    document.body.append(trail);
    const context = trail.getContext('2d');
    if (!context) {
      trail.remove();
      return;
    }
    let particles = [];
    let frame = 0;
    let previous = null;
    const lifetime = 252;
    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      particles = [];
      previous = null;
      context.clearRect(0, 0, innerWidth, innerHeight);
    }
    function resize() {
      reset();
      const ratio = Math.min(devicePixelRatio || 1, 2);
      trail.width = Math.ceil(innerWidth * ratio);
      trail.height = Math.ceil(innerHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    function draw(now) {
      context.clearRect(0, 0, innerWidth, innerHeight);
      particles = particles.filter((pixel) => now - pixel.born < lifetime);
      context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff4500';
      for (const pixel of particles) {
        context.globalAlpha = 0.65 * Math.pow(1 - Math.max(0, now - pixel.born) / lifetime, 2);
        context.fillRect(pixel.x, pixel.y, pixel.size, pixel.size);
      }
      context.globalAlpha = 1;
      frame = particles.length ? requestAnimationFrame(draw) : 0;
    }
    addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse') return;
        const point = { x: event.clientX, y: event.clientY };
        if (previous) {
          const dx = point.x - previous.x;
          const dy = point.y - previous.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 5) return;
          const count = Math.min(5, Math.floor(distance / 5));
          const now = performance.now();
          for (let i = 0; i < count; i++) {
            const t = i / count;
            particles.push({
              x: Math.round((previous.x + dx * t) / 2) * 2,
              y: Math.round((previous.y + dy * t) / 2) * 2,
              size: Math.random() < 0.7 ? 2 : 3,
              born: now,
            });
          }
          particles = particles.slice(-24);
          if (!frame) frame = requestAnimationFrame(draw);
        }
        previous = point;
      },
      { passive: true }
    );
    document.addEventListener('pointerout', (event) => {
      if (!event.relatedTarget) reset();
    });
    addEventListener('blur', reset);
    addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) reset();
    });
    resize();
  }
  initPixelCursor();
})();
