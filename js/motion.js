/* ============================================================
   Doddz Go — Motion & 3D   (js/motion.js)
   ------------------------------------------------------------
   يعمل مع css/motion.css. يضيف:
     1) ظهور متدرّج لعناصر الصفحة وهي بتدخل الشاشة (IntersectionObserver)
     2) ميلان ثلاثي الأبعاد 3D للكروت مع الماوس + لمعة بتتبع المؤشر
     3) عمق 3D للهيرو (parallax) وحركة Ken Burns للصورة
   ملاحظات:
     * لو المستخدم شغّل «تقليل الحركة» (prefers-reduced-motion) أو الـJS
       ما اشتغلش، الصفحة تظهر عادي من غير أي إخفاء.
     * الكروت بتتولّد بعد التحميل (من Supabase/الـstore)، فمفيش حاجة
       بتتراقب مرة واحدة بس — MutationObserver بيمسح أي عقدة جديدة.
   ============================================================ */
(function () {
  'use strict';

  const root    = document.documentElement;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse  = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  if (reduced) return;               // بلا أي حركة نهائيًا
  root.classList.add('mo-on');

  // عناصر بتظهر بتدرّج — والكروت كمان بتميل 3D
  const REVEAL_SEL = [
    // index.html
    '.row-header',
    '.barber-hero',
    '.barber-filters',
    '.promo-item',
    '.side-banner',
    '.big-banner',
    '.pcard',
    '.barber-card',
    // product.html
    '.pd-gallery',
    '.pd-info',
    '.pd-desc',
    '.pd-actions-row',
    // barber.html
    '.bp-header',
    '.bp-panel',
    '.bp-stats',
    '.bk-step',
    // policies.html
    '.pol-hero',
    '.pol-wrap > section',
    '.pol-faq',
    // أي عنصر يعايز الحركة يدويًا
    '[data-motion]'
  ].join(', ');

  const TILT_SEL = '.pcard, .big-banner, .side-banner, .barber-card';

  // ── 1) الظهور عند الدخول للشاشة ─────────────────────────────
  // ملاحظة: المتصفح بيتخطى الـobserver callback لو المستخدم عمل scroll
  // سريع، فأي عنصر عدّى من قدام العين وفضل فوقها ممكن يظل مخفي.
  // علشان كده بنعتبر «اتشاف» = داخل الشاشة أو تعدّاه لفوق، ومعانا
  // مسح احتياطي كل scroll (شوف sweepBelow) + شبكة أمان بعد 3.5 ثانية.
  function isPastOrInside(el) {
    const r = el.getBoundingClientRect();
    return r.top < (window.innerHeight || document.documentElement.clientHeight);
  }

  const io = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          const aboveViewport = en.boundingClientRect.top < 0;
          if (!en.isIntersecting && !aboveViewport) return;
          revealNow(en.target);
        });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 })
    : null;

  function revealNow(el) {
    if (!el.classList.contains('mo-in')) el.classList.add('mo-in');
    if (io) io.unobserve(el);
  }

  // مسح احتياطي وقت الـscroll — بيضمن إن مفيش هيحتاج فضل مخفي
  let sweepQueued = false;
  function sweepBelow() {
    if (sweepQueued) return;
    sweepQueued = true;
    requestAnimationFrame(() => {
      sweepQueued = false;
      document.querySelectorAll('.mo:not(.mo-in)').forEach((el) => {
        if (isPastOrInside(el)) revealNow(el);
      });
    });
  }
  window.addEventListener('scroll', sweepBelow, { passive: true });
  window.addEventListener('resize', sweepBelow, { passive: true });

  function staggerIndex(el) {
    const parent = el.parentElement;
    if (!parent) return 0;
    let i = 0;
    for (const sib of parent.children) {
      if (sib === el) break;
      if (sib.matches && sib.matches('.mo')) i += 1;
    }
    return Math.min(i, 9);
  }

  function markReveal(el) {
    if (el.dataset.moState) return;
    el.dataset.moState = '1';
    el.classList.add('mo');
    el.style.setProperty('--mo-delay', (staggerIndex(el) * 55) + 'ms');
    if (io) io.observe(el);
    else el.classList.add('mo-in');   // متصفح قديم: اظهار مباشر
    sweepBelow();                     // لو داخل الشاشة دلوقتي يظهر فورًا
  }

  function scan(scope) {
    const base = scope && scope.querySelectorAll ? scope : document;
    base.querySelectorAll(REVEAL_SEL).forEach(markReveal);
    base.querySelectorAll(TILT_SEL).forEach(attachTilt);
  }

  // ── 2) الميلان ثلاثي الأبعاد ────────────────────────────────
  const MAX_TILT = 7;   // درجة

  function attachTilt(el) {
    if (el.dataset.moTilt || coarse) return;
    el.dataset.moTilt = '1';

    el.classList.add('mo-tint-host');
    const tint = document.createElement('span');
    tint.className = 'mo-tint';
    tint.setAttribute('aria-hidden', 'true');
    el.appendChild(tint);

    el.addEventListener('pointermove', (e) => {
      if (!el.classList.contains('mo-in')) return;   // لسه ما ظهرش
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.classList.add('mo-tilting');
      el.style.setProperty('--mo-ry', ((px - 0.5) * 2 * MAX_TILT).toFixed(2) + 'deg');
      el.style.setProperty('--mo-rx', ((0.5 - py) * 2 * MAX_TILT).toFixed(2) + 'deg');
      tint.style.setProperty('--mo-mx', (px * 100).toFixed(1) + '%');
      tint.style.setProperty('--mo-my', (py * 100).toFixed(1) + '%');
    });

    const reset = () => {
      el.classList.remove('mo-tilting');
      el.style.removeProperty('--mo-rx');
      el.style.removeProperty('--mo-ry');
    };
    el.addEventListener('pointerleave', reset);
    el.addEventListener('pointercancel', reset);
    el.addEventListener('blur', reset);
  }

  // ── 3) عمق الهيرو (parallax) ────────────────────────────────
  function wireHeroParallax() {
    const hero = document.querySelector('.hero-layout');
    if (!hero || coarse) return;
    const clear = () => {
      hero.style.setProperty('--hero-x', '0');
      hero.style.setProperty('--hero-y', '0');
    };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      if (!r.width || !r.height) return;
      hero.style.setProperty('--hero-x', (((e.clientX - r.left) / r.width) - 0.5).toFixed(3));
      hero.style.setProperty('--hero-y', (((e.clientY - r.top) / r.height) - 0.5).toFixed(3));
    });
    hero.addEventListener('pointerleave', clear);
    clear();
  }

  // ── إعادة المسح بعد أي محتوى جديد (كروت Supabase/البحث) ────
  let queued = false;
  function rescanSoon() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(document); });
  }

  function start() {
    scan(document);
    wireHeroParallax();
    if ('MutationObserver' in window) {
      const target = document.querySelector('.content') || document.body;
      new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.addedNodes && m.addedNodes.length) { rescanSoon(); return; }
        }
      }).observe(target, { childList: true, subtree: true });
    }
    // شبكة أمان 1: أي عنصر داخل الشاشة ولسه مخفي يظهر بعد 3.5 ثانية
    setTimeout(sweepBelow, 3500);
    // شبكة أمان 2: بعد 9 ثواني مفيش أي عنصر يفضل مخفي إطلاقًا
    // (زي كروت الأشرطة الأفقية اللي ممكن المستخدم ما يوصلش لها)
    setTimeout(() => {
      document.querySelectorAll('.mo:not(.mo-in)').forEach(revealNow);
    }, 9000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.DoddzMotion = { refresh: scan, scan: rescanSoon };
})();
