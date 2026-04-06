/**
 * main.js — NOMAD STUDIO
 * Loader · Lenis · GSAP · Works scroll · Char shuffle · Nav
 */
(function () {
  'use strict';

  /* ── iOS viewport height fix ────────────────────── */
  const setVh = () =>
    document.documentElement.style.setProperty('--svh', window.innerHeight + 'px');
  setVh();
  window.addEventListener('resize', setVh, { passive: true });

  /* ── Loader ─────────────────────────────────────── */
  const loaderEl   = document.getElementById('loader');
  const barFill    = document.getElementById('loaderBarFill');
  let   barProgress = 0;

  // Animate bar to 100% then hide
  function runLoader() {
    const id = setInterval(() => {
      barProgress = Math.min(barProgress + Math.random() * 18, 100);
      if (barFill) barFill.style.width = barProgress + '%';
      if (barProgress >= 100) {
        clearInterval(id);
        setTimeout(() => {
          if (loaderEl) loaderEl.classList.add('done');
          startEntranceAnim();
        }, 300);
      }
    }, 60);
  }

  if (document.readyState === 'complete') {
    runLoader();
  } else {
    window.addEventListener('load', runLoader);
  }

  /* ── GSAP + ScrollTrigger ───────────────────────── */
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  /* ── Lenis smooth scroll ────────────────────────── */
  let lenis;
  if (typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.2,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    if (typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
    }
  }

  /* ── Character shuffle ──────────────────────────── */
  const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@./:-';
  function shuffleText(el) {
    const orig  = el.textContent;
    let   frame = 0;
    const steps = orig.length * 4;
    const id = setInterval(() => {
      el.textContent = orig.split('').map((ch, i) => {
        if (ch === ' ') return ' ';
        if (frame > i * 4) return ch;
        return POOL[Math.floor(Math.random() * POOL.length)];
      }).join('');
      if (++frame > steps) { clearInterval(id); el.textContent = orig; }
    }, 28);
  }

  document.querySelectorAll('.shuffle').forEach(el => {
    el.addEventListener('mouseenter', () => shuffleText(el));
  });

  /* ── Hero entrance (runs after loader hides) ────── */
  function startEntranceAnim() {
    const tl = gsap.timeline();
    tl.to('.hero-line', {
      y: '0%',
      duration: 1.5,
      ease: 'power4.out',
      stagger: 0.12,
    });
    tl.to('.hero-desc', {
      opacity: 1,
      duration: 1,
      ease: 'power3.out',
    }, '-=0.7');
  }

  /* ── Mobile nav ─────────────────────────────────── */
  const burger  = document.getElementById('burger');
  const mobMenu = document.getElementById('mobMenu');
  let   navOpen = false;

  function toggleNav() {
    navOpen = !navOpen;
    burger ?.classList.toggle('open', navOpen);
    mobMenu?.classList.toggle('open', navOpen);
    if (lenis) navOpen ? lenis.stop() : lenis.start();
  }

  burger?.addEventListener('click', toggleNav);
  mobMenu?.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => { navOpen && toggleNav(); })
  );

  /* ── Works scroll sequence ──────────────────────── */
  const worksScroll = document.getElementById('worksScroll');
  const works       = window.WORKS || [];
  const N           = works.length;

  const elIdx    = document.getElementById('wIdx');
  const elTitle  = document.getElementById('wTitle');
  const elClient = document.getElementById('wClient');
  const elType   = document.getElementById('wType');
  const elDate   = document.getElementById('wDate');

  let lastShown = -1;

  function swapMeta(i) {
    if (i === lastShown) return;
    lastShown = i;
    const w = works[i];
    if (!w) return;

    const animate = (el, val) => {
      if (!el) return;
      gsap.to(el, {
        opacity: 0, y: -10, duration: 0.15,
        onComplete() {
          el.textContent = val;
          gsap.to(el, { opacity: 1, y: 0, duration: 0.2 });
        }
      });
    };

    animate(elIdx,    String(i + 1).padStart(2, '0'));
    animate(elTitle,  w.title);
    animate(elClient, w.client);
    animate(elType,   w.type);
    animate(elDate,   w.date);
  }

  // Initialise with first work
  if (works.length) swapMeta(0);

  function tickWorks() {
    if (!worksScroll) return;
    const rect     = worksScroll.getBoundingClientRect();
    const scrolled = -rect.top;
    const total    = worksScroll.offsetHeight - window.innerHeight;
    const progress = Math.max(0, Math.min(1, scrolled / total));

    const raw      = progress * N;
    const idxA     = Math.min(Math.floor(raw), N - 1);
    const within   = raw - idxA;

    // Transition occupies the last 30% of each work's slot
    const FADE_START = 0.70;
    let blend = 0;
    let idxB  = idxA;
    if (within > FADE_START && idxA < N - 1) {
      blend = (within - FADE_START) / (1 - FADE_START);
      idxB  = idxA + 1;
    }

    // Update Three.js
    window.__works3?.set(idxA, idxB, blend);

    // Update meta when dominant image flips
    swapMeta(blend > 0.5 ? idxB : idxA);
  }

  if (worksScroll) {
    window.addEventListener('scroll', tickWorks, { passive: true });
    lenis?.on('scroll', tickWorks);
    tickWorks();
  }

  /* ── Back to top ────────────────────────────────── */
  document.getElementById('backTop')?.addEventListener('click', () => {
    lenis ? lenis.scrollTo(0, { duration: 1.5 }) : window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ── Anchor scroll ──────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#') { e.preventDefault(); return; }
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis
        ? lenis.scrollTo(target, { offset: -80, duration: 1.4 })
        : target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ── ScrollTrigger reveals ──────────────────────── */
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {

    // Suptitles
    gsap.utils.toArray('.suptitle').forEach(el =>
      gsap.from(el, {
        opacity: 0, y: 20, duration: .9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%' },
      })
    );

    // Identity headline
    gsap.from('.identity-headline', {
      opacity: 0, y: 50, duration: 1.3, ease: 'power4.out',
      scrollTrigger: { trigger: '.identity-headline', start: 'top 80%' },
    });

    // Identity image
    gsap.from('.identity-img-box', {
      opacity: 0, scale: .97, duration: 1.2, ease: 'power3.out',
      scrollTrigger: { trigger: '.identity-img-box', start: 'top 82%' },
    });

    // Identity body text
    gsap.from(['.identity-body p', '.identity-quote'], {
      opacity: 0, y: 30, duration: .9, ease: 'power3.out', stagger: .12,
      scrollTrigger: { trigger: '.identity-body', start: 'top 82%' },
    });

    // Services headline
    gsap.from('.services-headline', {
      opacity: 0, y: 40, duration: 1.1, ease: 'power4.out',
      scrollTrigger: { trigger: '.services-headline', start: 'top 82%' },
    });

    // Service rows
    gsap.from('.service-row', {
      opacity: 0, y: 24, duration: .75, ease: 'power3.out', stagger: .08,
      scrollTrigger: { trigger: '.services-list', start: 'top 80%' },
    });

    // Services visual
    gsap.from('.services-visual', {
      opacity: 0, scale: .96, duration: 1.2, ease: 'power3.out',
      scrollTrigger: { trigger: '.services-visual', start: 'top 82%' },
    });

    // Clients marquee reveal
    gsap.from('.clients .suptitle', {
      opacity: 0, y: 20, duration: .9, ease: 'power3.out',
      scrollTrigger: { trigger: '.clients', start: 'top 88%' },
    });
    gsap.from('.clients-track-wrap', {
      opacity: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.clients-track-wrap', start: 'top 90%' },
    });

    // Footer bg text scale-in
    gsap.from('.footer-bg-text', {
      opacity: 0, scale: .92, duration: 1.6, ease: 'power4.out',
      scrollTrigger: { trigger: '.footer', start: 'top 80%' },
    });

    // Footer columns
    gsap.from('.footer-col', {
      opacity: 0, y: 30, duration: .9, ease: 'power3.out', stagger: .1,
      scrollTrigger: { trigger: '.footer-body', start: 'top 85%' },
    });
  }

})();
