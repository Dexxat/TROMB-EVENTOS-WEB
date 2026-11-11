/* Tromb — sliders de sección, galería principal y video en marco de celular. */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = n => String(n).padStart(2, '0');
  const listFrom = el => Array.from({ length: +el.dataset.count }, (_, i) => el.dataset.slides.replace('{n}', pad(i + 1)));

  /* ---------- Slideshows de sección (hero, escena, cards) ---------- */
  document.querySelectorAll('.slideshow').forEach((box, boxIndex) => {
    const srcs = listFrom(box);
    const slides = srcs.map((src, i) => {
      const img = document.createElement('img');
      img.className = 'slide';
      img.alt = '';
      img.decoding = 'async';
      img.loading = i === 0 ? 'eager' : 'lazy';
      if (i < 2) img.src = src; else img.dataset.src = src;
      box.append(img);
      return img;
    });
    if (!slides.length) return;
    slides[0].classList.add('is-active');
    if (slides.length < 2 || reduced) return;

    const interval = +box.dataset.interval || 4200;
    let index = 0, timer = 0, visible = false, busy = false;

    const ensure = i => { const img = slides[i]; img.loading = 'eager'; if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; } };
    // Solo avanza cuando la próxima foto ya está cargada: nunca queda un hueco vacío.
    const next = () => {
      if (busy) return;
      const target = (index + 1) % slides.length;
      const cur = slides[target];
      ensure(target);
      ensure((target + 1) % slides.length);
      const show = () => {
        busy = false;
        const prev = slides[index];
        slides.forEach(s => s.classList.remove('is-leaving'));
        prev.classList.remove('is-active');
        prev.classList.add('is-leaving');
        cur.classList.add('is-active');
        index = target;
      };
      if (cur.complete && cur.naturalWidth) return show();
      busy = true;
      cur.addEventListener('load', show, { once: true });
      cur.addEventListener('error', () => { busy = false; }, { once: true });
    };
    // Desfase inicial para que las tarjetas no cambien todas a la vez.
    let ready = false;
    const start = () => { if (ready && !timer && visible && !document.hidden) timer = setInterval(next, interval); };
    const stop = () => { clearInterval(timer); timer = 0; };
    setTimeout(() => { ready = true; start(); }, (boxIndex % 4) * 1100);

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { threshold: 0.15 }).observe(box);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  });

  /* ---------- Galería principal: "Lo que pasa cuando pasa" ---------- */
  const fg = document.getElementById('feature-gallery');
  if (fg) {
    const srcs = listFrom(fg);
    const wrap = document.getElementById('fg-slides');
    const thumbsBox = document.getElementById('fg-thumbs');
    const stage = document.getElementById('fg-stage');
    const countEl = document.getElementById('fg-count');
    const progress = document.getElementById('fg-progress');
    const DURATION = 5000;
    let index = 0, timer = 0, visible = false, hovering = false;

    const slides = srcs.map((src, i) => {
      const fig = document.createElement('figure');
      fig.className = 'fg-slide';
      fig.innerHTML = `<div class="fg-backdrop"></div><img alt="Evento de Tromb Producciones, foto ${i + 1} de ${srcs.length}" decoding="async">`;
      wrap.append(fig);
      return fig;
    });
    const thumbs = srcs.map((src, i) => {
      const b = document.createElement('button');
      b.className = 'fg-thumb';
      b.type = 'button';
      b.setAttribute('aria-label', `Ver foto ${i + 1}`);
      b.innerHTML = `<img src="${src}" alt="" loading="lazy" decoding="async">`;
      b.addEventListener('click', () => go(i));
      thumbsBox.append(b);
      return b;
    });
    const load = i => {
      const fig = slides[(i + slides.length) % slides.length];
      const img = fig.querySelector('img');
      if (!img.getAttribute('src')) {
        const src = srcs[(i + slides.length) % slides.length];
        img.src = src;
        fig.querySelector('.fg-backdrop').style.backgroundImage = `url('${src}')`;
      }
    };

    const restartProgress = () => {
      progress.style.transition = 'none';
      progress.style.transform = 'scaleX(0)';
      void progress.offsetWidth;
      if (timer) { progress.style.transition = `transform ${DURATION}ms linear`; progress.style.transform = 'scaleX(1)'; }
    };

    function go(i, dir) {
      const target = (i + slides.length) % slides.length;
      if (target === index && slides[index].classList.contains('is-active')) return;
      dir = dir || (target > index ? 1 : -1);
      fg.style.setProperty('--dir', dir);
      load(target); load(target + 1); load(target - 1);
      slides.forEach(s => s.classList.remove('is-leaving', 'from-left'));
      const prev = slides[index];
      prev.classList.remove('is-active');
      prev.classList.add('is-leaving');
      const cur = slides[target];
      cur.classList.toggle('from-left', dir < 0);
      cur.classList.add('is-active');
      thumbs[index].classList.remove('is-active');
      thumbs[target].classList.add('is-active');
      thumbs[target].removeAttribute('aria-current');
      thumbs[target].setAttribute('aria-current', 'true');
      thumbs[index].removeAttribute('aria-current');
      // Mantener la miniatura activa a la vista sin mover la página.
      const t = thumbs[target];
      thumbsBox.scrollTo({ left: t.offsetLeft - thumbsBox.clientWidth / 2 + t.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
      index = target;
      countEl.textContent = `${pad(index + 1)} / ${pad(slides.length)}`;
      if (timer) { stop(); start(); }
    }

    const start = () => {
      if (reduced || timer || !visible || hovering || document.hidden) return;
      timer = setInterval(() => go(index + 1, 1), DURATION);
      restartProgress();
    };
    const stop = () => { clearInterval(timer); timer = 0; restartProgress(); };

    load(0); load(1); load(-1);
    slides[0].classList.add('is-active');
    thumbs[0].classList.add('is-active');
    thumbs[0].setAttribute('aria-current', 'true');
    countEl.textContent = `01 / ${pad(slides.length)}`;

    document.getElementById('fg-prev').addEventListener('click', () => go(index - 1, -1));
    document.getElementById('fg-next').addEventListener('click', () => go(index + 1, 1));
    stage.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1, -1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1, 1); }
    });
    stage.addEventListener('mouseenter', () => { hovering = true; stop(); });
    stage.addEventListener('mouseleave', () => { hovering = false; start(); });

    let x0 = null;
    stage.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      x0 = null;
    });

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { threshold: 0.35 }).observe(stage);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }

  /* ---------- Video vertical en marco de celular ---------- */
  const video = document.getElementById('pv-video');
  if (video) {
    const device = document.getElementById('pv-device');
    const playBtn = document.getElementById('pv-play');
    const soundBtn = document.getElementById('pv-sound');
    let userStarted = false;
    video.muted = true;
    video.defaultMuted = true;

    const setPlaying = on => {
      device.classList.toggle('is-playing', on);
      playBtn.setAttribute('aria-label', on ? 'Pausar video' : 'Reproducir video');
    };
    const setMuted = m => {
      device.classList.toggle('is-muted', m);
      soundBtn.setAttribute('aria-pressed', String(!m));
      soundBtn.querySelector('span').textContent = m ? 'Activar sonido' : 'Silenciar';
    };
    const tryPlay = () => {
      if (reduced && !userStarted) return;
      video.play().catch(() => {
        if (!video.muted) { video.muted = true; setMuted(true); video.play().catch(() => {}); }
      });
    };

    setMuted(true);
    video.addEventListener('play', () => setPlaying(true));
    video.addEventListener('pause', () => setPlaying(false));
    playBtn.addEventListener('click', () => { userStarted = true; video.paused ? tryPlay() : video.pause(); });
    soundBtn.addEventListener('click', () => {
      userStarted = true;
      video.muted = !video.muted;
      setMuted(video.muted);
      if (!video.muted && video.paused) tryPlay();
    });
    new IntersectionObserver(([e]) => (e.isIntersecting ? tryPlay() : video.pause()), { threshold: 0.55 }).observe(device);
    document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
  }
})();

/* ---------- Por qué Tromb: personajes que entran desde los márgenes ---------- */
(() => {
  const cutouts = document.querySelectorAll('.cutout');
  if (!cutouts.length || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js-cutouts');
  // Las figuras están fuera de pantalla (translate), así que se observa su contenedor.
  cutouts.forEach(c => {
    const anchor = c.parentElement;
    const watch = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { c.classList.add('is-in'); watch.disconnect(); }
    }, { threshold: 0.25 });
    watch.observe(anchor);
  });
})();
