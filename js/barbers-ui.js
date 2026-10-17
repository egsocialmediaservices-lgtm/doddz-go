// ================================================================
// Barber listing on homepage + nav wiring
//  - كارت الصالون بيورّي الكفر (coverUrl) زي صورة البروفايل بالظبط
//  - شارة «منزلي» للصالونات اللي عندها خدمة منزلية مفعّلة
//  - فلتر المناطق بيتبني من مناطق الصالونات المعتمدة نفسها
//    (مش قايمة ثابتة) — عشان أي حلاق يغيّر منطقته تظهر فورًا
// ================================================================
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  /** منطقة الصالون للعرض: المنطقة > المحافظة > أول منطقة منزلية > العنوان */
  function areaLabel(b) {
    if (!b) return '';
    const pool = [
      b.area,
      b.governorate,
      (b.homeService && Array.isArray(b.homeService.areas) ? b.homeService.areas[0] : ''),
      (b.location && b.location.address) || ''
    ];
    for (const v of pool) {
      const s = String(v || '').trim();
      if (s) return s;
    }
    return '';
  }

  /** كل المناطق اللي الحلاق بيغطيها (منطقته + المناطق المنزلية) للفلترة */
  function areaPool(b) {
    const list = [b && b.area, b && b.governorate];
    const hs = (b && b.homeService && b.homeService.areas) || [];
    if (Array.isArray(hs)) list.push(...hs);
    return list.map(normArea).filter(Boolean);
  }

  function normArea(s) {
    return String(s || '')
      .replace(/[،,.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/^(منطقة|حي|قسم|ج)\s+/, '');
  }

  /** مطابقة مرنة: «مدينة نصر» = «مدينة نصر - القاهرة» والعكس */
  function areaMatches(b, area) {
    const target = normArea(area);
    if (!target) return true;
    return areaPool(b).some(v => v === target || v.includes(target) || target.includes(v));
  }

  function renderBarberCard(b) {
    const servicesPreview = (b.services || []).slice(0, 3).map(s => s.name).join(' · ') || 'خدمات متعددة';
    const area = areaLabel(b);
    const cover = String(b.coverUrl || '').trim();
    const badges = [];
    if (b.isFeatured) badges.push('<span class="barber-card-badge">مميز</span>');
    if (b.homeService && b.homeService.enabled) badges.push('<span class="barber-card-badge home">خدمة منزلية</span>');
    const coverStyle = cover
      ? ' style="background-image:url(&quot;' + esc(cover) + '&quot;)"'
      : '';
    return `
      <article class="barber-card" data-barber-id="${esc(b.id)}" role="button" tabindex="0">
        <div class="barber-card-cover${cover ? ' has-cover' : ''}"${coverStyle}>
          ${badges.join('')}
          <div class="barber-card-avatar">${b.avatarUrl ? `<img src="${esc(b.avatarUrl)}" alt="">` : esc((b.name || 'ص').slice(0, 1))}</div>
        </div>
        <div class="barber-card-body">
          <div class="barber-card-name">${esc(b.name)}</div>
          ${area ? `<div class="barber-card-area">📍 ${esc(area)}</div>` : ''}
          <div class="barber-card-meta">
            <span class="stars">★ ${Number(b.rating || 0).toFixed(1)}</span>
            <span>(${b.reviewsCount || 0} تقييم)</span>
            <span>${(b.services || []).length} خدمات</span>
          </div>
          <div class="barber-card-services">${esc(servicesPreview)}</div>
          <button type="button" class="barber-card-btn" data-open-barber="${esc(b.id)}">عرض الصالون والحجز</button>
        </div>
      </article>
    `;
  }

  function getFilter() {
    const active = document.querySelector('.barber-filter-chip.active');
    return active ? active.dataset.filter : 'all';
  }

  function listBarbers() {
    if (typeof BarberStore === 'undefined') return [];
    let list = BarberStore.getApproved();
    const f = getFilter();
    if (f === 'featured') list = list.filter(b => b.isFeatured);
    else if (f === 'home') list = list.filter(b => b.homeService && b.homeService.enabled);
    else if (f && f !== 'all') list = list.filter(b => areaMatches(b, f));
    return list;
  }

  function renderBarbersSection() {
    const grid = document.getElementById('barbers-grid');
    if (!grid) return;
    const list = listBarbers();
    if (!list.length) {
      grid.innerHTML = '<div class="search-results-empty" style="grid-column:1/-1">لا يوجد حلاقين متاحين حالياً</div>';
      return;
    }
    grid.innerHTML = list.map(renderBarberCard).join('');
  }

  /**
   * رقائق المناطق — بتتعمل من بيانات الصالونات المعتمدة نفسها.
   * بيتمسك أي chip عليه data-filter مش من (الكل/مميز/خدمة منزلية) ويتبديل.
   */
  function renderAreaChips() {
    const box = document.getElementById('barber-area-chips');
    if (!box || typeof BarberStore === 'undefined') return;
    const counts = new Map();
    BarberStore.getApproved().forEach(b => {
      const seen = new Set();
      areaPool(b).forEach(v => {
        if (!v || v.length < 2 || seen.has(v)) return;
        seen.add(v);
        counts.set(v, (counts.get(v) || 0) + 1);
      });
    });
    // رجّع الاسم زي ما الحلاق كتبه (أول نسخة تتقابل) للعرض الحلو
    const pretty = new Map();
    BarberStore.getApproved().forEach(b => {
      [b.area, ...(((b.homeService && b.homeService.areas) || []))].forEach(raw => {
        const k = normArea(raw);
        if (k && !pretty.has(k)) pretty.set(k, String(raw || '').trim());
      });
    });
    const areas = [...counts.keys()]
      .sort((a, b) => (counts.get(b) - counts.get(a)) || a.localeCompare(b, 'ar'))
      .slice(0, 10);
    box.innerHTML = areas.map(a => {
      const active = getFilter() === a ? ' active' : '';
      return `<button type="button" class="barber-filter-chip${active}" data-filter="${esc(a)}">${esc(pretty.get(a) || a)}</button>`;
    }).join('');
  }

  function openBarber(id) {
    window.location.href = 'barber.html?id=' + encodeURIComponent(id);
  }

  function wire() {
    const grid = document.getElementById('barbers-grid');
    if (grid) {
      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-open-barber]');
        const card = e.target.closest('[data-barber-id]');
        const id = btn?.dataset.openBarber || card?.dataset.barberId;
        if (id) openBarber(id);
      });
    }

    document.addEventListener('click', (e) => {
      const chip = e.target.closest('.barber-filter-chip');
      if (!chip) return;
      document.querySelectorAll('.barber-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderBarbersSection();
    });
  }

  function renderAll() {
    renderAreaChips();
    renderBarbersSection();
  }

  function boot() {
    wire();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();   // السكريات اتحمّلت بعد ما الـDOM خلص (defer/في آخر الصفحة)
  }
  // أي تحديث من السحابة (كتالوج/خدمة منزلية) يعيد بناء الرقائق والكروت
  document.addEventListener('doddz:barber-data', renderAll);

  window.renderBarbersSection = renderAll;
  window.BarberAreaFilter = { areaLabel, areaMatches, normArea };
})();
