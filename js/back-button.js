// ================================================================
// DODDZ BACK BUTTON — زرار «رجوع» المشترك بين الصفحات
// ----------------------------------------------------------------
// بنستخدم <a class="back-btn" href="..."> في كل صفحة:
//   * لو المستخدم داخل من نفس الموقع (فيه تاريخ رجوع حقيقي) → history.back()
//     عشان يرجع بالظبط للمكان اللي كان فيه (نفس موضع السكرول في الرئيسية).
//   * لو فتح الصفحة مباشرة أو مفيش تاريخ → اللينك نفسه بيشتغل (href)
//     فيروح للقسم الصح في الرئيسية. يعني الزرار شغال حتى لو الـJS مقفول.
//
// الصفحة الوحيدة اللي بتحدّث الـhref ديناميكيًا هي product.html
// (حسب قسم المنتج) — شوف js/product-details.js.
// ================================================================
(function () {
  'use strict';

  function sameOriginSession() {
    try {
      if (!window.history || history.length <= 1) return false;
      const ref = document.referrer;
      if (!ref) return false;
      return new URL(ref, location.href).origin === location.origin;
    } catch (_) {
      return false;
    }
  }

  function wire() {
    const back = sameOriginSession();
    document.querySelectorAll('a.back-btn, button.back-btn').forEach((el) => {
      if (el.dataset.backWired === '1') return;
      el.dataset.backWired = '1';
      // بنوضّح للمستخدم إن الزرار هيرجّعه من جوه الجلسة
      if (back) el.dataset.backMode = 'history';
      el.addEventListener('click', (e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (!sameOriginSession()) return;          // سيّب الـhref يعمل شغله
        e.preventDefault();
        history.back();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
