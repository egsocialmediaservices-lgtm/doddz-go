/* ================================================================
   DODDZ SECTIONS UI — كروت أنشطة الأقسام على الصفحة الرئيسية
   لمعها (مغاسل) / انامل (هند ميد) / كسبني (متاجر)
   المصدر: Supabase → carwash_profiles / handmade_profiles / merchant_profiles
   (قسم «قصها» لييه صفحة ملف وحجز: js/barbers-ui.js + barber.html)
================================================================ */
(function () {
  const SECTIONS = ['carwash', 'handmade', 'merchants'];

  const CONTAINER = {
    carwash: 'section-carwash',
    handmade: 'section-handmade',
    merchants: 'section-merchants'
  };

  // صفحة الملف المستقلة لكل قسم (نفس فكرة barber.html للحلاقين)
  const PROFILE_PAGE = {
    carwash: 'carwash.html',
    handmade: 'handmade.html',
    merchants: 'merchant.html'
  };

  function providerLink(row, code) {
    const page = PROFILE_PAGE[code];
    if (!page || !row || row.id == null) return '';
    return page + '?id=' + encodeURIComponent(String(row.id));
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function waLink(phone) {
    const p = String(phone || '').replace(/\D/g, '');
    if (!p) return '';
    const intl = p.startsWith('0') ? '2' + p : p;
    return 'https://wa.me/' + intl;
  }

  /** عدد منتجات التاجر من كتالوج الموقع (ProductStore) */
  function productCount(row) {
    if (typeof ProductStore === 'undefined' || !ProductStore.getAll) return 0;
    const id = String(row.id);
    try {
      return ProductStore.getAll().filter(p => {
        const st = p.status || 'approved';
        if (st !== 'approved' && st !== 'active' && st !== 'published') return false;
        return String(p.provider_id || '') === id;
      }).length;
    } catch (_) { return 0; }
  }

  function servicesPreview(row) {
    const list = Array.isArray(row.services) ? row.services : [];
    if (!list.length) return 'خدمات متنوعة';
    return list.slice(0, 3).map(s => (s && (s.name || s.title)) || '').filter(Boolean).join(' · ') || 'خدمات متنوعة';
  }

  function priceFrom(row) {
    const list = Array.isArray(row.services) ? row.services : [];
    const prices = list.map(s => Number(s && s.price)).filter(n => n > 0);
    if (!prices.length) return '';
    return 'يبدأ من ' + Math.min(...prices).toLocaleString('ar-EG') + ' ج';
  }

  function card(row, code) {
    const label = (window.SectionsStore && SectionsStore.section(code) && SectionsStore.section(code).entity) || 'نشاط';
    const count = code === 'merchants' ? productCount(row) : 0;
    const wa = waLink(row.phone);
    const link = providerLink(row, code);
    return `
      <div class="pcard pcard-provider" data-provider="${esc(row.id)}" data-section="${code}"
           ${link ? 'data-provider-link="' + esc(link) + '" tabindex="-1"' : ''}
           style="background:#2a2a3d;border-color:#3a3a5c;">
        <div class="pcard-img" style="display:flex;align-items:center;justify-content:center;font-size:34px;">
          ${row.logo_url || row.cover_url
            ? `<img src="${esc(row.logo_url || row.cover_url)}" alt="${esc(row.name)}" style="width:100%;height:100%;object-fit:cover;"/>`
            : (code === 'carwash' ? '🚗' : code === 'handmade' ? '🧵' : '🏬')}
        </div>
        <div class="pcard-body">
          <div class="pcard-cat" style="color:#ff6b4a;">${esc(label)}</div>
          ${link
            ? `<a class="pcard-name pcard-provider-name" href="${esc(link)}" style="color:#fff;">${esc(row.name)}</a>`
            : `<div class="pcard-name" style="color:#fff;">${esc(row.name)}</div>`}
          <div class="pcard-cat" style="color:#aaa;">${esc(row.area || row.governorate || '—')}</div>
          <div class="pcard-stars">
            <span class="stars">★ ${Number(row.rating || 0).toFixed(1)}</span>
            <span class="stars-count" style="color:#aaa;">(${Number(row.reviews_count || 0)} تقييم)</span>
          </div>
          <div class="pcard-price">
            <span class="price-now" style="color:#ff6b4a;">${esc(priceFrom(row) || (count ? count + ' منتج' : 'شوف الملف'))}</span>
          </div>
          <div style="font-size:12px;color:#c9c9de;margin:2px 0 8px;">${esc(servicesPreview(row))}</div>
          ${row.phone ? `<a class="pcard-btn" href="${esc(wa || ('tel:' + row.phone))}" target="_blank" rel="noopener"
              style="display:inline-block;text-align:center;text-decoration:none;color:#fff;background:var(--coral,#ff6b4a);border-radius:10px;padding:8px 12px;">تواصل ${esc(row.phone)}</a>` : ''}
        </div>
      </div>`;
  }

  function mount(code, html) {
    const el = document.getElementById(CONTAINER[code]);
    if (!el) return;
    const holderId = 'providers-' + code;
    let holder = document.getElementById(holderId);
    if (!holder) {
      holder = document.createElement('div');
      holder.id = holderId;
      holder.setAttribute('data-providers-holder', code);
      // display:contents → كروت القسم تتمشي مع ترتيب .products-scroll الأفقي
      holder.style.display = 'contents';
      el.appendChild(holder);
    }
    holder.innerHTML = html;
  }

  /** فيه منتجات معروضة في القسم ده فعلًا؟ (من ProductStore) */
  function hasProductCards(code) {
    const el = document.getElementById(CONTAINER[code]);
    if (!el) return false;
    return !!el.querySelector('.pcard:not([data-provider])');
  }

  function renderEmpty(code) {
    if (hasProductCards(code)) { mount(code, ''); return; }   // ما نمسحش منتجات موجودة
    mount(code, `<div class="search-results-empty" style="min-width:220px;color:#bbb;display:flex;align-items:center;">لسه مفيش أنشطة معتمدة في هذا القسم — سجّل نشاطك من زر «حسابي»</div>`);
  }

  async function renderSection(code) {
    const el = document.getElementById(CONTAINER[code]);
    if (!el || !window.SectionsStore) return;
    let rows = [];
    try { rows = await SectionsStore.approved(code); } catch (_) { rows = []; }
    if (!rows.length) { renderEmpty(code); announceRendered(); return; }
    mount(code, rows.map(r => card(r, code)).join(''));
    announceRendered();
  }

  function renderAll() {
    SECTIONS.forEach(renderSection);
  }

  /** يبلّغ الواجهة إن محتوى الأقسام اتحدّث (تستخدمه products-data.js لإخفاء الصفوف الفاضية) */
  function announceRendered() {
    try { window.dispatchEvent(new Event('doddz:sections-rendered')); } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    openProfileOnCardClick();
    if (window.SectionsStore && SectionsStore.whenReady) {
      SectionsStore.whenReady().then(renderAll);
    } else {
      renderAll();
    }
  });

  /**
   * الضغط على أي حتة في كارت النشاط بيفتح صفحة الملف الخاصة بيه
   * (carwash.html / handmade.html / merchant.html?id=…) — زي صفحة الصالون بالظبط.
   * زرار «تواصل» (a) بيكمل شغله عادي، والكارت اللي ملهوش صفحة بيتجاهل.
   */
  function openProfileOnCardClick() {
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (e.target.closest('a, button')) return;          // الوصلة الأصلية تتنفّذ عادي
      const card = e.target.closest('.pcard-provider[data-provider-link]');
      if (!card) return;
      const url = card.getAttribute('data-provider-link');
      if (!url) return;
      window.location.href = url;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest && e.target.closest('.pcard-provider[data-provider-link]');
      if (!card || e.target.closest('a, button')) return;
      e.preventDefault();
      window.location.href = card.getAttribute('data-provider-link');
    });
  }

  window.DoddzSectionsUI = { renderAll, renderSection };
})();
