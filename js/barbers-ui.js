// Barber listing on homepage + nav wiring
(function () {
  function renderBarberCard(b) {
    const servicesPreview = (b.services || []).slice(0, 3).map(s => s.name).join(' · ') || 'خدمات متعددة';
    const badges = [];
    if (b.isFeatured) badges.push('<span class="barber-card-badge">مميز</span>');
    if (b.homeService && b.homeService.enabled) badges.push('<span class="barber-card-badge home">منزلي</span>');
    const badge = badges.join('');
    return `
      <article class="barber-card" data-barber-id="${b.id}" role="button" tabindex="0">
        <div class="barber-card-cover">
          ${badge}
          <div class="barber-card-avatar">${b.avatarUrl ? `<img src="${b.avatarUrl}" alt="">` : (b.name || "ح").slice(0,1)}</div>
        </div>
        <div class="barber-card-body">
          <div class="barber-card-name">${b.name}</div>
          <div class="barber-card-area">${b.area || '—'}</div>
          <div class="barber-card-meta">
            <span class="stars">★ ${Number(b.rating || 0).toFixed(1)}</span>
            <span>(${b.reviewsCount || 0} تقييم)</span>
            <span>${(b.services || []).length} خدمات</span>
          </div>
          <div class="barber-card-services">${servicesPreview}</div>
          <button type="button" class="barber-card-btn" data-open-barber="${b.id}">عرض الملف والحجز</button>
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
    else if (f && f !== 'all') list = list.filter(b => (b.area || '').includes(f));
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

    document.querySelectorAll('.barber-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.barber-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderBarbersSection();
      });
    });

    // Nav item: section barbers uses data-section="barbers"
    // site.js already scrolls to #section-barbers-row via id mapping if we set ids correctly
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderBarbersSection();
    wire();
  });

  window.renderBarbersSection = renderBarbersSection;
})();
