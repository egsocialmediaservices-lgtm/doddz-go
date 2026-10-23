// ================================================================
// DODDZ SITE NAV — التنقل بين الأقسام + توست عام + ربط البانرات
// ================================================================

const SECTION_LABELS_SITE = {
  electronics: 'إلكترونيات',
  mobiles: 'موبايلات',
  laptops: 'اكسسوارات لاب توب',
  fashion: 'أزياء',
  shoes: 'أحذية',
  watches: 'ساعات وإكسسوارات',
  home: 'المنزل',
  toys: 'الألعاب',
  sports: 'الرياضة',
  beauty: 'الجمال والعناية',
  kids: 'الأطفال',
  books: 'الكتب',
  barber_supplies: 'مستلزمات حلاقة للمحلات بالجملة',
  services: 'خدمات',
  barbers: 'قصها',
  carwash: 'لمعها',
  handmade: 'انامل',
  merchants: 'كسبني',
  bestsellers: 'الأكثر مبيعاً',
  new: 'وصل حديثاً',
  sell: 'عروض عامة',
  tech: 'تكنولوجيا'
};

// ------------------------------------------------
// توست عام (يُستخدم لأي رسالة تأكيد/تنبيه بسيطة في الموقع كله)
// ------------------------------------------------
function showToast(msg) {
  let toast = document.getElementById('site-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'site-toast';
    toast.className = 'site-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(window._siteToastTimer);
  window._siteToastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// ------------------------------------------------
// التمرير لقسم معيّن في نفس الصفحة (بيراعي ارتفاع الهيدر الملتصق)
// كل قسم بقى ليه صف خاص به في index.html — مفيش أي "مرادفات"
// ------------------------------------------------
function isSectionRowEmpty(sectionId) {
  const box = document.getElementById('section-' + sectionId);
  if (!box) return true;
  const row = box.closest('.section-row') || box;
  if (row.hidden) return true;
  const holder = box.classList.contains('section-row') ? (box.querySelector('.barbers-grid, .products-scroll') || box) : box;
  return holder.querySelectorAll(':scope > *').length === 0;
}

function scrollToSection(sectionId) {
  // نلغي أي نتائج بحث مفتوحة عشان القسم الأصلي يبان
  if (typeof clearSearchResults === 'function') clearSearchResults();

  if (!sectionId) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const target = document.getElementById('section-' + sectionId);
  if (!target) return;

  // القسم فاضي (مفيش منتجات/أنشطة معتمدة) → واجهة النتائج بتعرض رسالة واضحة
  if (isSectionRowEmpty(sectionId) && typeof window.DoddzOpenSectionResults === 'function') {
    window.DoddzOpenSectionResults(sectionId);
    return;
  }

  const headerOffset = 112; // top-bar + header + nav-bar الملتصقين فوق
  const y = target.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top: y, behavior: 'smooth' });
}

// ------------------------------------------------
// تفعيل عنصر النافبار الصح
// ------------------------------------------------
function setActiveNav(sectionId) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', (item.dataset.section || '') === (sectionId || ''));
  });
}

// ------------------------------------------------
// ربط كل عنصر عليه data-section (نافبار، بانرات جانبية، أزرار السلايدر، البانرات الكبيرة)
// row-see-all مستثناة هنا لأنها بتتفتح كـ"عرض كل النتائج" عن طريق search.js
// ------------------------------------------------
function wireSectionLinks() {
  document.querySelectorAll('[data-section]:not(.row-see-all)').forEach(el => {
    el.addEventListener('click', () => {
      const section = el.dataset.section;
      setActiveNav(section);
      scrollToSection(section);
    });
  });

  // أزرار لسه محتاجة صفحة/فيتشر حقيقي (زي التسجيل كتاجر) — توست صريح بدل ما تكون ميتة
  document.querySelectorAll('[data-toast]').forEach(el => {
    el.addEventListener('click', () => showToast(el.dataset.toast));
  });
}

document.addEventListener('DOMContentLoaded', wireSectionLinks);


// حسابي → لو مسجّل دخولك: لوحة الحساب — غير كده: دخول/تسجيل
document.getElementById('account-btn')?.addEventListener('click', () => {
  if (window.DoddzAccount?.isLoggedIn()) {
    window.DoddzAccount.open();
    return;
  }
  const entry = document.getElementById('seller-entry-overlay');
  if (entry) {
    entry.classList.add('open');
    return;
  }
  // fallback
  document.getElementById('seller-fab')?.click();
});

// خدمة العملاء — شات بوت (لاحقًا)
document.getElementById('support-fab')?.addEventListener('click', () => {
  const panel = document.getElementById('support-chat-panel');
  if (panel) panel.hidden = false;
});
document.getElementById('support-chat-close')?.addEventListener('click', () => {
  const panel = document.getElementById('support-chat-panel');
  if (panel) panel.hidden = true;
});

if (new URLSearchParams(location.search).get('account') === '1') {
  document.addEventListener('DOMContentLoaded', () => {
    const openTrack = () => {
      if (window.DoddzAccount?.openGuest) window.DoddzAccount.openGuest('track');
      else document.getElementById('seller-entry-overlay')?.classList.add('open');
    };
    if (window.DoddzAccount?.whenReady) {
      window.DoddzAccount.whenReady().then(() => {
        if (window.DoddzAccount.isLoggedIn()) window.DoddzAccount.open();
        else openTrack();
      });
    } else {
      openTrack();
    }
    history.replaceState({}, '', location.pathname);
  });
}


// شريط الأخبار العلوي بيكرر نفس الرسالة أكتر من مرة → كل النسخ بنفس السلوك
document.querySelectorAll('.top-register-visitor').forEach((link) => {
  link.addEventListener('click', (e) => {
    const signup = document.getElementById('seller-signup-overlay');
    const entry = document.getElementById('seller-entry-overlay');
    if (!signup && !entry) return;   // الصفحة ملهاش نموذج تسجيل → السيّب اللينك يمشي
    e.preventDefault();
    const type = document.getElementById('ss-type');
    if (type) type.value = 'visitor';
    (signup || entry).classList.add('open');
  });
});
