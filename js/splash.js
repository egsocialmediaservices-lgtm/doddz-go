/* ================================================================
   المقدمة (Intro) — لوجو Doddz Go
   ------------------------------------------------------------
   خفيفة ومتكررة:
     1) مفيش فيديو خالص — اللوجو صورة WebP/PNG جاهزة بتُرسم فورًا.
     2) بتظهر كل ما الموقع يتفتح من أول وجديد (Tab/متصفح جديد).
        جوه نفس التاب بنستعمل sessionStorage، فالتنقل بين صفحات الموقع
        أو الرجوع بزرار الرجوع ما يعيدش المقدمة.
     3) بتقفل نفسها بعد ~1.6 ثانية (أو ضغطة/Escape فورًا) — مفيش انتظار.
     4) «تقليل الحركة» → اللوجو ثابت ونص ثانية وكفاية.
   مفيش أي منطق تجاري هنا — واجهة بس.
================================================================ */
(function () {
  'use strict';

  var SESSION_KEY = 'doddz_intro_open';   // بتتحط في التاب الحالي بس
  var AUTO_ENTER_MS = 1650;               // مدة المقدمة وهي بتلعب
  var REDUCED_ENTER_MS = 650;             // لو المستخدم كره الحركة
  var root = document.documentElement;
  var intro = document.getElementById('intro');

  function seenThisSession() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; }
  }
  function markSeen() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* تصفح خاص */ }
  }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // مفيش مقدمة في الصفحة دي، أو التاب ده شافها قبل كده
  if (!intro || !root.classList.contains('intro-on') || seenThisSession()) {
    if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
    window.DoddzIntro = { show: function () {}, hide: function () {} };
    return;
  }
  markSeen();

  var logo = intro.querySelector('.intro-logo');
  var skip = intro.querySelector('.intro-skip');
  var bar  = intro.querySelector('.intro-bar i');
  var timer = 0;
  var leaving = false;

  function enter() {
    if (leaving) return;
    leaving = true;
    window.clearTimeout(timer);
    root.classList.remove('intro-on');
    intro.classList.add('is-entering');
    window.setTimeout(function () {
      if (intro.parentNode) intro.parentNode.removeChild(intro);
      try { window.scrollTo(0, 0); } catch (e) {}
    }, 520);
  }

  // شريط التقدم بيعدّي مرة واحدة مع مدة المقدمة
  if (bar) {
    var ms = reducedMotion() ? REDUCED_ENTER_MS : AUTO_ENTER_MS;
    // transform بدل width = شغل أقل على الجهاز (بيتمّ في طبقة الرسم)
    bar.style.transitionDuration = ms + 'ms';
    window.setTimeout(function () { bar.style.transform = 'scaleX(1)'; }, 40);
  }

  timer = window.setTimeout(enter, reducedMotion() ? REDUCED_ENTER_MS : AUTO_ENTER_MS);

  if (logo) {
    logo.addEventListener('click', enter);
    logo.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); enter(); }
    });
  }
  if (skip) skip.addEventListener('click', function (ev) { ev.stopPropagation(); enter(); });

  intro.addEventListener('click', function (ev) {
    if (ev.target.closest && ev.target.closest('.intro-logo, .intro-skip')) return;
    enter();
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') enter(); });

  window.DoddzIntro = {
    // للمطور: DoddzIntro.clear() وبعدها reload = المقدمة تظهر تاني في نفس التاب
    clear: function () { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} }
  };
})();
