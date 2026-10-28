/* ================================================================
   DODDZ GO — js/job-lock.js
   ------------------------------------------------------------
   قفل صفحة التوظيف:
   * الفني اللي بيفتح technician-apply.html بيتقفل التبويب بتاعه
     على الاستمارة — أي صفحة من المتجر تفتح في نفس التبويب بترجّعه
     للاستمارة على طول (لا رجوع للمتجر ولا تصفح).
   * القفل sessionStorage → بيربط بالتبويب الحالي بس، فالزبون اللي
     في تاب تاني ما يحسش بحاجة، وبيقفل نفسه لما التبويب يتقفل.
   * للفريق المطوّر: DoddzJobLock.release() من Console = فك القفل.
   مفيش أي منطق تجاري هنا — توجيه وبس.
================================================================ */
(function () {
  'use strict';

  var KEY = 'doddz_job_lock';
  var APPLY_PAGE = 'technician-apply.html';

  function read() {
    try { return sessionStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write() {
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* تصفح خاص */ }
  }
  function drop() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  // إحنا فين؟ صفحة الاستمارة ولا صفحة عادية من المتجر
  var onApply = (location.pathname || '').toLowerCase().indexOf(APPLY_PAGE) !== -1 ||
                (document.body && document.body.getAttribute('data-job-page') === '1');

  if (onApply) {
    write();
    window.DoddzJobLock = {
      locked: function () { return read() === '1'; },
      release: function () { drop(); return true; },
      relock:  function () { write(); return true; },
      key: KEY
    };
    return;
  }

  if (read() === '1') {
    location.replace(APPLY_PAGE + '?locked=1');
  }

  window.DoddzJobLock = {
    locked: function () { return read() === '1'; },
    // بتعمل reload عشان المتجر يشتغل طبيعي في التبويب ده تاني
    release: function () { drop(); location.reload(); return true; },
    relock:  function () { write(); location.replace(APPLY_PAGE); return true; },
    key: KEY
  };
})();
