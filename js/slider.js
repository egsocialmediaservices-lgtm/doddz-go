// ================================================================
// Hero Slider — smooth transitions + performance-friendly
// ================================================================
(function () {
  let current = 0;
  let timer = null;
  let locked = false;
  const INTERVAL = 5200;
  const TRANSITION_MS = 700;

  function slides() {
    return Array.from(document.querySelectorAll('#slider .slide'));
  }
  function dots() {
    return Array.from(document.querySelectorAll('#slider .dot'));
  }

  function goSlide(n) {
    const list = slides();
    const dotList = dots();
    if (!list.length || locked) return;
    locked = true;

    const next = ((n % list.length) + list.length) % list.length;
    if (next === current) {
      locked = false;
      return;
    }

    const prevEl = list[current];
    const nextEl = list[next];

    list.forEach((s, i) => {
      s.classList.remove('active', 'is-entering', 'is-leaving');
      if (i !== next && i !== current) s.classList.add('is-idle');
    });
    dotList.forEach((d, i) => d.classList.toggle('active', i === next));

    prevEl.classList.remove('is-idle');
    prevEl.classList.add('is-leaving');
    nextEl.classList.remove('is-idle');
    nextEl.classList.add('active', 'is-entering');

    current = next;

    window.setTimeout(() => {
      prevEl.classList.remove('is-leaving', 'active');
      prevEl.classList.add('is-idle');
      nextEl.classList.remove('is-entering');
      locked = false;
    }, TRANSITION_MS);
  }

  function nextSlide() { goSlide(current + 1); }
  function prevSlide() { goSlide(current - 1); }
  function goToSlide(n) { goSlide(n); }

  function startAuto() {
    stopAuto();
    if (slides().length < 2) return;
    timer = window.setInterval(nextSlide, INTERVAL);
  }
  function stopAuto() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function init() {
    const list = slides();
    if (!list.length) return;

    list.forEach((s, i) => {
      if (i === 0) {
        s.classList.add('active');
        s.classList.remove('is-idle');
      } else {
        s.classList.add('is-idle');
        s.classList.remove('active');
      }
    });
    dots().forEach((d, i) => d.classList.toggle('active', i === 0));
    current = 0;

    const root = document.getElementById('slider');
    if (root) {
      root.addEventListener('mouseenter', stopAuto);
      root.addEventListener('mouseleave', startAuto);
      root.addEventListener('focusin', stopAuto);
      root.addEventListener('focusout', startAuto);

      // Touch swipe
      let x0 = null;
      root.addEventListener('touchstart', (e) => {
        x0 = e.changedTouches[0].clientX;
        stopAuto();
      }, { passive: true });
      root.addEventListener('touchend', (e) => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 40) {
          // RTL: swipe right → previous visually depends; keep simple
          if (dx < 0) nextSlide();
          else prevSlide();
        }
        startAuto();
      }, { passive: true });
    }

    // Pause when tab hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAuto();
      else startAuto();
    });

    startAuto();
  }

  window.goToSlide = goToSlide;
  window.nextSlide = nextSlide;
  window.prevSlide = prevSlide;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
