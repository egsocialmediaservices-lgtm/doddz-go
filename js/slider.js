// ================================================================
// Hero Slider v3 — 9 سلايدات صور
// ----------------------------------------------------------------
// • شغّال على أي عدد سلايدات (`#slider .slide`) — نفس الـAPI القديم
//   (goToSlide / nextSlide / prevSlide) فالـHTML ما بيتكسرش.
// • بيحدّّث شريط الشرح تحت الصورة `.slider-caption` من
//   `data-cap-tag / data-cap-title / data-cap-sub / data-cap-cta`
//   وبيحوّل زرار الـCTA لنفس وجهة السلايد.
// • تحميل كسول حقيقي: الصور اللي عليها `data-src` بتتنزل بس لما
//   السلايد يبقى الحالي أو اللي بعده — فالأول فتحًا 3 صور بدل 9.
// • الأوتوبلاي بيقف لما المستخدم يتفاعل (ماوس / لمس / كيبورد / تركيز)
//   وبيكمّل بعد ما يسيب السلايدر.
// ================================================================
(function () {
  let current = 0;
  let timer = null;
  let locked = false;
  let paused = false;                 // المستخدم بيتفرج دلوقتي
  const INTERVAL = 6500;              // 9 سلايدات → وقت أقل شوية لكل واحدة
  const TRANSITION_MS = 700;
  const RESUME_MS = 12000;            // بعد أي تفاعل: استئناف بعد 12 ثانية

  function root() { return document.getElementById('slider'); }
  function slides() { return Array.from(document.querySelectorAll('#slider .slide')); }
  function dots() { return Array.from(document.querySelectorAll('#slider .dot')); }

  // ── تحميل الصور عند الحاجة ────────────────────────────────────
  function ensureLoaded(el) {
    if (!el) return;
    el.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.getAttribute('data-src');
      img.removeAttribute('data-src');
      if (img.dataset.srcset) { img.srcset = img.dataset.srcset; img.removeAttribute('data-srcset'); }
    });
  }
  function warmNeighbours(i) {
    const list = slides();
    if (!list.length) return;
    const n = list.length;
    ensureLoaded(list[i]);
    ensureLoaded(list[(i + 1) % n]);
    ensureLoaded(list[(i - 1 + n) % n]);
  }

  // كل الصور تتم تنزيلها في وقت الفراغ — عشان القفزة بالنقاط ما تسيبش
  // إطار فاضي. على بيانات موفّرة / شبكة بطينة بنسيب التحميل الكسول كما هو.
  function idlePrefetch() {
    const c = navigator.connection || {};
    if (c.saveData || /2g/.test(c.effectiveType || '')) return;
    const run = () => slides().forEach(ensureLoaded);
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
    else window.setTimeout(run, 2500);
  }

  // ── شريط الشرح ────────────────────────────────────────────────
  function syncCaption(el) {
    const box = document.getElementById('slider-caption');
    if (!box || !el) return;
    const tag = box.querySelector('.sc-tag');
    const title = box.querySelector('.sc-title');
    const sub = box.querySelector('.sc-sub');
    const cta = box.querySelector('.sc-cta');

    box.classList.add('is-swapping');
    window.setTimeout(() => {
      const tagText = el.dataset.capTag || '';
      if (tag) {
        tag.textContent = tagText;
        tag.style.display = tagText ? '' : 'none';
      }
      if (title) title.textContent = el.dataset.capTitle || '';
      if (sub) sub.textContent = el.dataset.capSub || '';
      // النص والسهم جوّه الزرار — السهم بيولّده js/icons.js لوحده
      const ctaLabel = cta && cta.querySelector('.sc-cta-label');
      if (ctaLabel) ctaLabel.textContent = el.dataset.capCta || 'شوف';
      if (cta) {
        cta.setAttribute('href', el.getAttribute('href') || '#');
        if (el.dataset.section) cta.setAttribute('data-section', el.dataset.section);
        else cta.removeAttribute('data-section');
        cta.setAttribute('aria-label', (el.dataset.capCta || 'شوف') + ' — ' + (el.dataset.capTitle || ''));
      }
      box.classList.remove('is-swapping');
    }, 180);
  }

  // ── التنقّل ───────────────────────────────────────────────────
  function goSlide(n) {
    const list = slides();
    const dotList = dots();
    if (!list.length || locked) return;
    locked = true;

    const next = ((n % list.length) + list.length) % list.length;
    if (next === current) { locked = false; return; }

    const prevEl = list[current];
    const nextEl = list[next];

    ensureLoaded(nextEl);

    list.forEach((s, i) => {
      s.classList.remove('active', 'is-entering', 'is-leaving');
      if (i !== next && i !== current) s.classList.add('is-idle');
    });
    dotList.forEach((d, i) => {
      d.classList.toggle('active', i === next);
      d.setAttribute('aria-selected', i === next ? 'true' : 'false');
    });

    prevEl.classList.remove('is-idle');
    prevEl.classList.add('is-leaving');
    prevEl.setAttribute('aria-hidden', 'true');
    nextEl.classList.remove('is-idle');
    nextEl.classList.add('active', 'is-entering');
    nextEl.removeAttribute('aria-hidden');

    current = next;
    syncCaption(nextEl);

    window.setTimeout(() => {
      prevEl.classList.remove('is-leaving', 'active');
      prevEl.classList.add('is-idle');
      nextEl.classList.remove('is-entering');
      locked = false;
      warmNeighbours(current);
    }, TRANSITION_MS);
  }

  function nextSlide() { goSlide(current + 1); }
  function prevSlide() { goSlide(current - 1); }
  function goToSlide(n) { goSlide(n); }

  // ── الأوتوبلاي ────────────────────────────────────────────────
  function startAuto() {
    stopAuto();
    if (paused) return;
    if (slides().length < 2) return;
    timer = window.setInterval(nextSlide, INTERVAL);
  }
  function stopAuto() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  let resumeTimer = 0;
  function userTouched() {
    paused = true;
    stopAuto();
    window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(() => {
      paused = false;
      if (!document.hidden) startAuto();
    }, RESUME_MS);
  }

  function init() {
    const list = slides();
    if (!list.length) return;

    list.forEach((s, i) => {
      if (i === 0) {
        s.classList.add('active');
        s.classList.remove('is-idle');
        s.removeAttribute('aria-hidden');
      } else {
        s.classList.add('is-idle');
        s.classList.remove('active');
        s.setAttribute('aria-hidden', 'true');
      }
    });
    dots().forEach((d, i) => {
      d.classList.toggle('active', i === 0);
      d.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      d.setAttribute('role', 'tab');
    });
    current = 0;

    warmNeighbours(0);
    syncCaption(list[0]);
    if (document.readyState === 'complete') idlePrefetch();
    else window.addEventListener('load', idlePrefetch, { once: true });

    const el = root();
    if (el) {
      el.addEventListener('mouseenter', () => { paused = true; stopAuto(); });
      el.addEventListener('mouseleave', () => { paused = false; startAuto(); });

      // تفاعل = راحة: أسهم، نقاط، ضغط على السلايد
      el.querySelectorAll('.slider-arrow, .dot').forEach(b => {
        b.addEventListener('click', userTouched);
        b.addEventListener('keydown', userTouched);
      });
      el.addEventListener('click', (e) => {
        if (e.target.closest('.slide')) userTouched();
      });

      // كيبورد لما التركيز جوه السلايدر
      el.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { userTouched(); nextSlide(); e.preventDefault(); }   // RTL: يسار = التالي
        if (e.key === 'ArrowRight') { userTouched(); prevSlide(); e.preventDefault(); }
      });

      // Touch swipe (مثل سكرول الأقسام)
      let startX = 0, startY = 0, tracking = false;
      el.addEventListener('touchstart', (e) => {
        if (!e.changedTouches.length) return;
        startX = e.changedTouches[0].clientX;
        startY = e.changedTouches[0].clientY;
        tracking = true;
        paused = true;
        stopAuto();
      }, { passive: true });

      el.addEventListener('touchend', (e) => {
        if (!tracking || !e.changedTouches.length) { tracking = false; return; }
        tracking = false;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          // RTL: سحب لليسار = التالي، لليمين = السابق
          if (dx < 0) nextSlide(); else prevSlide();
        }
        window.clearTimeout(resumeTimer);
        resumeTimer = window.setTimeout(() => {
          paused = false;
          if (!document.hidden) startAuto();
        }, RESUME_MS);
      }, { passive: true });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAuto();
      else if (!paused) startAuto();
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
