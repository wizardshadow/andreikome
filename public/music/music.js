(() => {
  const TRACKS = [
    { id: '2-flames', title: '2 Flames', src: '2-flames.mp3', duration: 108.792 },
    { id: 'fall-in-love', title: 'Fall In Love', src: 'fall-in-love.mp3', duration: 91.68 },
    { id: 'whole-world', title: 'Whole World', src: 'whole-world.mp3', duration: 70.621 },
  ];

  const audio = document.querySelector('#audio');
  const list = document.querySelector('#track-list');
  const titleCurrent = document.querySelector('#title-current');
  const titleNext = document.querySelector('#title-next');
  const barLabel = document.querySelector('#bar-label');
  const timeNow = document.querySelector('#time-now');
  const timeTotal = document.querySelector('#time-total');
  const seek = document.querySelector('#seek');
  const wave = document.querySelector('#wave');
  const btnToggle = document.querySelector('#btn-toggle');
  const btnPrev = document.querySelector('#btn-prev');
  const btnNext = document.querySelector('#btn-next');
  const btnMute = document.querySelector('#btn-mute');
  const playAll = document.querySelector('#play-all');
  const grain = document.querySelector('#grain');

  let index = 0;
  let seeking = false;
  let waveSeeds = [];

  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (sec) => {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const s = Math.floor(sec);
    return `${Math.floor(s / 60)}:${pad(s % 60)}`;
  };
  const numLabel = (i) => `1–${i + 1}`;
  const titleLabel = (i) => `${pad(i + 1)}—${TRACKS[i].title.toUpperCase()}`;

  function buildWaveSeeds(trackIndex) {
    // Deterministic faux waveform per track for seek UI.
    let seed = (trackIndex + 1) * 9973;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const bars = 96;
    waveSeeds = Array.from({ length: bars }, (_, i) => {
      const envelope = 0.35 + 0.65 * Math.sin((i / bars) * Math.PI);
      return Math.max(0.12, Math.min(1, (0.25 + rand() * 0.75) * envelope));
    });
  }

  function drawWave(progress = 0) {
    if (!wave) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const cssW = wave.clientWidth || 280;
    const cssH = 36;
    wave.width = Math.floor(cssW * ratio);
    wave.height = Math.floor(cssH * ratio);
    const ctx = wave.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const gap = 2;
    const barW = Math.max(2, (cssW - gap * (waveSeeds.length - 1)) / waveSeeds.length);
    const mid = cssH / 2;
    const activeUntil = progress * waveSeeds.length;
    waveSeeds.forEach((amp, i) => {
      const h = Math.max(3, amp * (cssH - 6));
      const x = i * (barW + gap);
      const y = mid - h / 2;
      ctx.fillStyle = i < activeUntil ? '#e10600' : 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, y, barW, h);
    });
  }

  function renderList() {
    list.replaceChildren();
    TRACKS.forEach((track, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'music-track' + (i === index ? ' is-active' : '');
      btn.dataset.index = String(i);
      btn.innerHTML = `
        <span class="music-track-icon" aria-hidden="true">
          ${i === index && !audio.paused
            ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>'
            : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>'}
        </span>
        <span class="music-track-num">${numLabel(i)}</span>
        <span class="music-track-title">${track.title}</span>
        <span class="music-track-time">${fmt(track.duration)}</span>`;
      btn.addEventListener('click', () => {
        if (i === index) toggle();
        else load(i, true);
      });
      list.append(btn);
    });
  }

  function syncChrome() {
    const track = TRACKS[index];
    const next = TRACKS[(index + 1) % TRACKS.length];
    titleCurrent.textContent = titleLabel(index);
    titleNext.textContent = titleLabel((index + 1) % TRACKS.length);
    barLabel.textContent = `${numLabel(index)} ${track.title.toUpperCase()}`;
    timeTotal.textContent = fmt(audio.duration || track.duration);
    document.title = `${track.title} — ANDREIKO Music`;
    document.body.classList.toggle('is-playing', !audio.paused);
    renderList();
  }

  function load(i, autoplay = false) {
    index = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
    const track = TRACKS[index];
    audio.src = track.src;
    seek.value = '0';
    timeNow.textContent = '0:00';
    buildWaveSeeds(index);
    drawWave(0);
    syncChrome();
    if (autoplay) {
      audio.play().catch(() => {});
    }
  }

  function toggle() {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  playAll.addEventListener('click', () => load(0, true));
  btnToggle.addEventListener('click', toggle);
  btnPrev.addEventListener('click', () => load(index - 1, !audio.paused));
  btnNext.addEventListener('click', () => load(index + 1, true));
  btnMute.addEventListener('click', () => {
    audio.muted = !audio.muted;
    btnMute.style.opacity = audio.muted ? '0.4' : '0.85';
  });

  seek.addEventListener('pointerdown', () => { seeking = true; });
  seek.addEventListener('pointerup', () => { seeking = false; });
  seek.addEventListener('input', () => {
    const duration = audio.duration || TRACKS[index].duration;
    const t = (Number(seek.value) / 1000) * duration;
    timeNow.textContent = fmt(t);
    drawWave(Number(seek.value) / 1000);
  });
  seek.addEventListener('change', () => {
    const duration = audio.duration || TRACKS[index].duration;
    audio.currentTime = (Number(seek.value) / 1000) * duration;
    seeking = false;
  });

  audio.addEventListener('play', syncChrome);
  audio.addEventListener('pause', syncChrome);
  audio.addEventListener('loadedmetadata', () => {
    timeTotal.textContent = fmt(audio.duration || TRACKS[index].duration);
  });
  audio.addEventListener('timeupdate', () => {
    if (seeking) return;
    const duration = audio.duration || TRACKS[index].duration || 1;
    const progress = Math.min(1, audio.currentTime / duration);
    seek.value = String(Math.round(progress * 1000));
    timeNow.textContent = fmt(audio.currentTime);
    drawWave(progress);
  });
  audio.addEventListener('ended', () => load(index + 1, true));

  // Film grain overlay
  if (grain) {
    const ctx = grain.getContext('2d');
    const tile = 128;
    const frames = Array.from({ length: 6 }, () => {
      const c = document.createElement('canvas');
      c.width = c.height = tile;
      const g = c.getContext('2d');
      const img = g.createImageData(tile, tile);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() < 0.5 ? 0 : 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 70 + Math.floor(Math.random() * 140);
      }
      g.putImageData(img, 0, 0);
      return ctx.createPattern(c, 'repeat');
    });
    const paint = () => {
      grain.width = Math.min(innerWidth, 1920);
      grain.height = Math.min(innerHeight, 1080);
      const x = Math.floor(Math.random() * tile);
      const y = Math.floor(Math.random() * tile);
      ctx.setTransform(1, 0, 0, 1, -x, -y);
      ctx.fillStyle = frames[Math.floor(Math.random() * frames.length)];
      ctx.fillRect(0, 0, grain.width + tile, grain.height + tile);
    };
    paint();
    setInterval(paint, 90);
    addEventListener('resize', paint, { passive: true });
  }

  addEventListener('resize', () => {
    const duration = audio.duration || TRACKS[index].duration || 1;
    drawWave(Math.min(1, (audio.currentTime || 0) / duration));
  }, { passive: true });

  addEventListener('keydown', (event) => {
    if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (event.code === 'Space') {
      event.preventDefault();
      toggle();
    } else if (event.code === 'ArrowRight') load(index + 1, true);
    else if (event.code === 'ArrowLeft') load(index - 1, true);
  });

  load(0, false);
  drawWave(0);
})();
