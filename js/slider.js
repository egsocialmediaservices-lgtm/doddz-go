// ================================================================
// Hero Slider — swipe like sections, longer read time, no arrows
// ================================================================
(function () {
  let current = 0;
  let timer = null;
  let locked = false;
  const INTERVAL = 8500; // وقت أطول لقراءة السلايد
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

      // Touch swipe (مثل سكرول الأقسام)
      let startX = 0;
      let startY = 0;
      let tracking = false;

      root.addEventListener('touchstart', (e) => {
        if (!e.changedTouches.length) return;
        startX = e.changedTouches[0].clientX;
        startY = e.changedTouches[0].clientY;
        tracking = true;
        stopAuto();
      }, { passive: true });

      root.addEventListener('touchmove', (e) => {
        if (!tracking || !e.changedTouches.length) return;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        // لو السحب أفقي أوضح من الرأسي → منع سكرول الصفحة شوية
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
          // لا نمنع افتراضيًا هنا (passive) — الاعتماد على touchend
        }
      }, { passive: true });

      root.addEventListener('touchend', (e) => {
        if (!tracking || !e.changedTouches.length) return;
        tracking = false;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          // RTL: سحب لليسار = التالي، لليمين = السابق
          if (dx < 0) nextSlide();
          else prevSlide();
        }
        startAuto();
      }, { passive: true });
    }

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
