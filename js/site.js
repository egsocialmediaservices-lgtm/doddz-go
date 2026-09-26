// ================================================================
// DODDZ SITE NAV — التنقل بين الأقسام + توست عام + ربط البانرات
// ================================================================

const SECTION_LABELS_SITE = {
  electronics: 'إلكترونيات',
  mobiles: 'موبايلات',
  laptops: 'لاب توب',
  fashion: 'أزياء',
  shoes: 'أحذية',
  watches: 'ساعات وإكسسوارات',
  home: 'المنزل',
  pets: 'مستلزمات الحيوانات',
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
// ------------------------------------------------
const SECTION_SCROLL_ALIASES = {
  electronics: 'sell',
  mobiles: 'tech',
  laptops: 'tech',
  shoes: 'fashion',
  watches: 'fashion',
  sports: 'sell',
  beauty: 'fashion',
  books: 'home',
  barber_supplies: 'sell'
};

function scrollToSection(sectionId) {
  if (SECTION_SCROLL_ALIASES[sectionId]) {
    sectionId = SECTION_SCROLL_ALIASES[sectionId];
  }

  // نلغي أي نتائج بحث مفتوحة عشان القسم الأصلي يبان
  if (typeof clearSearchResults === 'function') clearSearchResults();

  if (!sectionId) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const target = document.getElementById('section-' + sectionId);
  if (!target) return;

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
    const openEntry = () => document.getElementById('seller-entry-overlay')?.classList.add('open');
    if (window.DoddzAccount?.whenReady) {
      window.DoddzAccount.whenReady().then(() => {
        if (window.DoddzAccount.isLoggedIn()) window.DoddzAccount.open();
        else openEntry();
      });
    } else {
      openEntry();
    }
    history.replaceState({}, '', location.pathname);
  });
}


document.getElementById('top-register-visitor')?.addEventListener('click', (e) => {
  e.preventDefault();
  const signup = document.getElementById('seller-signup-overlay');
  const type = document.getElementById('ss-type');
  if (type) type.value = 'visitor';
  if (signup) {
    signup.classList.add('open');
    // hide business fields optional - leave as is
  } else {
    document.getElementById('seller-entry-overlay')?.classList.add('open');
  }
});
