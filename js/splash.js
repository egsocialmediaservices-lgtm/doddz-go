/* ================================================================
   المقدمة (Intro) — لوجو Doddz Go ثلاثي الأبعاد
   الشغل بتاعها بس:
     1) تشغّل فيديو اللوجو مرة واحدة (من غير loop) وتثبّته على آخر إطار.
     2) أي ضغطة على اللوجو (أو Enter/Space) = حركة دخول → الموقع.
     3) تكتب في localStorage إن الزائر شافها، فمتكررش معاه تاني.
     4) لو الفيديو ما اشتغلش أو المستخدم بيفضّل تقليل الحركة → صورة اللوجو الثابتة.
   مفيش أي منطق تجاري هنا — واجهة بس.
================================================================ */
(function () {
  'use strict';

  var KEY = 'doddz_intro_seen_v1';
  var root = document.documentElement;
  var intro = document.getElementById('intro');

  function readFlag() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function writeFlag() {
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* وضع التصفح الخاص */ }
  }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // مفيش مقدمة في الصفحة دي، أو الزائر شافها قبل كده
  if (!intro || !root.classList.contains('intro-on') || readFlag()) {
    if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
    window.DoddzIntro = { show: function () {}, hide: function () {} };
    return;
  }

  var video = intro.querySelector('.intro-media');
  var bar = intro.querySelector('.intro-bar i');
  var logo = intro.querySelector('.intro-logo');
  var skip = intro.querySelector('.intro-skip');
  var entering = false;
  var frozen = false;
  var started = false;

  // لو الفيديو ما اشتغلش (صيغة مش مدعومة / المتصفح بلوك التشغيل التلقائي) → صورة اللوجو الثابتة
  function useStill() {
    intro.classList.add('no-video');
  }

  function freeze() {
    if (frozen) return;
    frozen = true;
    intro.classList.add('is-frozen');
    if (bar) bar.style.width = '100%';
  }

  function enter() {
    if (entering) return;
    entering = true;
    writeFlag();
    root.classList.remove('intro-on');
    intro.classList.add('is-entering');
    if (video) { try { video.pause(); } catch (e) {} }
    window.setTimeout(function () {
      intro.classList.add('hide');
      if (intro.parentNode) intro.parentNode.removeChild(intro);
      try { window.scrollTo(0, 0); } catch (e) {}
    }, 640);
  }

  // ── الفيديو ────────────────────────────────────────────────
  if (video) {
    video.loop = false;                 // مرة واحدة بس
    video.setAttribute('playsinline', '');
    video.preload = 'auto';

    function tryPlay() {
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* المتصفح متأخر شوية — هنجرب تاني */ });
    }
    if (video.readyState >= 2) tryPlay();
    video.addEventListener('loadeddata', tryPlay, { once: true });
    video.addEventListener('canplay', tryPlay, { once: true });

    video.addEventListener('playing', function () { started = true; });
    video.addEventListener('timeupdate', function () {
      if (video.currentTime > 0.02) started = true;
      if (!bar || !video.duration) return;
      bar.style.width = Math.min(100, (video.currentTime / video.duration) * 100).toFixed(1) + '%';
    });
    video.addEventListener('error', useStill);
    video.addEventListener('ended', freeze);

    // بعد 3.8 ثانية: لو الحركة لسه ما بدأتش والفيديو مش خلص → نثبت على صورة اللوجو
    window.setTimeout(function () {
      if (!started && !video.ended) useStill();
    }, 3800);
    // ضمان إضافي: لو حدث 'ended' ما وصلش في متصفح معيّن → التثبيت بعد نهاية الفيديو
    window.setTimeout(freeze, 4600);
  } else {
    useStill();
    freeze();
  }

  if (reducedMotion()) {
    intro.classList.add('no-motion');
    useStill();
    freeze();
  }

  // ── التفاعل ────────────────────────────────────────────────
  if (logo) {
    logo.addEventListener('click', enter);
    logo.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
        ev.preventDefault();
        enter();
      }
    });
  }
  if (skip) skip.addEventListener('click', function (ev) { ev.stopPropagation(); enter(); });

  // أي ضغطة في أي حتة في المقدمة = دخول (غير الأجهزة اللوافية بتاعت النصوص)
  intro.addEventListener('click', function (ev) {
    if (ev.target.closest && (ev.target.closest('.intro-logo') || ev.target.closest('.intro-skip'))) return;
    enter();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') enter();
  });

  window.DoddzIntro = {
    hasSeen: readFlag,
    // لو عايز تشوف المقدمة تاني أثناء التطوير: DoddzIntro.clear() وبعدها reload
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
})();
