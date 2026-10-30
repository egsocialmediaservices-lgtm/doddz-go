/* ================================================================
   المقدمة (Intro) — فيديو لوجو Doddz Go
   ------------------------------------------------------------
     1) الفيديو (images/doddz-intro.mp4 ≈ ٣.٨ ثانية) بيشتغل من أول
        ما الموقع يتفتح، وأول ما يخلص نفسه الموقع بيتفتح.
     2) بتظهر كل ما الموقع يتفتح من أول وجديد (Tab/متصفح جديد).
        جوه نفس التاب بنستعمل sessionStorage، فالتنقل بين صفحات الموقع
        أو الرجوع بزرار الرجوع ما يعيدش المقدمة.
     3) مفيش زرار «تخطي» — أي ضغطة على المقدمة أو Escape = دخول فوري.
     4) لو الفيديو اتحمّلش أو المتصفح منع التشغيل التلقائي، صورة اللوجو
        بتفضل باينة والموقع بيدخل بعد ~1.6 ثانية عادي — مفيش شاشة معلّقة.
     5) «تقليل الحركة» (prefers-reduced-motion) → صورة اللوجو بس، نص ثانية.
   مفيش أي منطق تجاري هنا — واجهة بس.
================================================================ */
(function () {
  'use strict';

  var SESSION_KEY = 'doddz_intro_open';   // بتتحط في التاب الحالي بس
  var IMG_ENTER_MS = 1650;                // مدة المقدمة وهي صورة (بلا فيديو)
  var REDUCED_ENTER_MS = 650;             // لو المستخدم كره الحركة
  var VIDEO_PAD_MS = 700;                 // هامش بعد نهاية الفيديو قبل الدخول
  var VIDEO_MAX_MS = 7000;                // أقصى انتظار لو حدث ended ما جاش
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

  var logo  = intro.querySelector('.intro-logo');
  var video = intro.querySelector('.intro-video');
  var bar   = intro.querySelector('.intro-bar i');
  var timer = 0;   // عدّاد الدخول بعد ما نعرف المدة
  var watch = 0;   // حارس أقصى مدة (لو الفيديو ما جاش خالص)
  var leaving = false;

  function enter() {
    if (leaving) return;
    leaving = true;
    window.clearTimeout(timer);
    window.clearTimeout(watch);
    root.classList.remove('intro-on');
    intro.classList.add('is-entering');
    if (video) { try { video.pause(); } catch (e) {} }
    window.setTimeout(function () {
      if (intro.parentNode) intro.parentNode.removeChild(intro);
      try { window.scrollTo(0, 0); } catch (e) {}
    }, 520);
  }

  // شريط التقدم بيعدّي مرة واحدة مع مدة العرض
  function runBar(ms) {
    if (!bar) return;
    // transform بدل width = شغل أقل على الجهاز (بيتمّ في طبقة الرسم)
    bar.style.transitionDuration = ms + 'ms';
    window.setTimeout(function () { bar.style.transform = 'scaleX(1)'; }, 40);
  }

  function videoDuration() {
    var d = video && isFinite(video.duration) ? video.duration : 0;
    return d > 0 ? d * 1000 : 3850;                  // مدة الفيديو المعروفة احتياطيًا
  }

  // المقدمة بقت في وضع الفيديو؟ (الـclass بيتحط أول ما إطار فعلي يبان)
  function inVideoMode() { return intro.classList.contains('is-video'); }

  // من غير فيديو (تقليل حركة / المتصفح منع التشغيل / الملف اتلف) = صورة اللوجو
  function imageMode(ms) {
    if (leaving || inVideoMode()) return;
    if (video) { try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {} }
    window.clearTimeout(watch);
    window.clearTimeout(timer);
    runBar(ms);
    timer = window.setTimeout(enter, ms);
  }

  // «الفيديو شغال»: اللوجو يمشي والفيديو يبان، والدخول بعد مدة الفيديو
  function markPlaying() {
    if (leaving || inVideoMode()) return;
    intro.classList.add('is-video');
    var ms = videoDuration() + VIDEO_PAD_MS;
    window.clearTimeout(watch);
    window.clearTimeout(timer);
    runBar(ms);
    timer = window.setTimeout(enter, ms);            // احتياطي لو حدث ended ما جاش
  }

  if (!video || reducedMotion()) {
    imageMode(reducedMotion() ? REDUCED_ENTER_MS : IMG_ENTER_MS);
  } else {
    // ⚠️ الفيديو عليه autoplay في الـHTML والسكربت ده بيتنفّذ defer —
    //    ممكن يكون بدأ قبل ما الـlisteners تتوصّل، فعلامة «بدأنا» بتتاخد
    //    من حالة العنصر نفسه مش من حدث playing لوحده.
    var already = !!(video.readyState >= 2 && !video.paused);

    video.addEventListener('playing', markPlaying);
    video.addEventListener('timeupdate', markPlaying);   // احتياطي لو playing فاتنا
    video.addEventListener('ended', enter);
    video.addEventListener('error', function () { if (!already) imageMode(IMG_ENTER_MS); });

    if (video.ended) {
      enter();
    } else if (already) {
      markPlaying();
    } else {
      var p = null;
      try { p = video.play(); } catch (e) { p = null; }
      if (p && typeof p.then === 'function') {
        p.then(function () {
          // لو مفيش إطار باين خلال ٢.٥ ثانية → نرجع لصورة اللوجو
          window.setTimeout(function () {
            if (!inVideoMode() && !leaving) imageMode(IMG_ENTER_MS);
          }, 2500);
        }).catch(function () {
          if (!inVideoMode() && !leaving) imageMode(IMG_ENTER_MS);
        });
      }
    }
    // أقصى مدة للمقدمة حتى لو حصل أي حاجة غريبة في التشغيل
    watch = window.setTimeout(function () {
      if (!inVideoMode()) imageMode(IMG_ENTER_MS);
      else enter();
    }, VIDEO_MAX_MS);
  }

  if (logo) {
    logo.addEventListener('click', enter);
    logo.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); enter(); }
    });
  }

  intro.addEventListener('click', function () { enter(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') enter(); });

  window.DoddzIntro = {
    // للمطور: DoddzIntro.clear() وبعدها reload = المقدمة تظهر تاني في نفس التاب
    clear: function () { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} }
  };
})();
