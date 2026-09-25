// Barber profile + booking wizard (salon + Home Service)
(function () {
  const params = new URLSearchParams(window.location.search);
  const barberId = params.get('id');
  let barber = null;
  let step = 1;
  const state = {
    locationType: null, // salon | home
    serviceId: null,
    date: null,
    time: null,
    customerName: '',
    customerPhone: '',
    customerArea: '',
    address: '',
    notes: ''
  };

  function $(id) { return document.getElementById(id); }

  function showError(msg) {
    const el = $('bk-error');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('show', !!msg);
  }

  function starsHtml(rating) {
    const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    let html = '<span class="bp-stars" aria-label="'+Number(rating||0).toFixed(1)+'">';
    for (let i = 1; i <= 5; i++) {
      html += '<span class="bp-star'+(i<=r?' on':'')+'">★</span>';
    }
    html += '</span>';
    return html;
  }

  function homeEnabled() {
    return !!(barber && barber.homeService && barber.homeService.enabled);
  }

  function setStep(n) {
    step = n;
    for (let i = 1; i <= 5; i++) {
      const panel = $('bk-step-' + i);
      if (panel) panel.hidden = i !== n;
    }
    const success = $('bk-step-success');
    if (success) success.hidden = true;
    document.querySelectorAll('[data-step-ind]').forEach(el => {
      const s = Number(el.dataset.stepInd);
      el.classList.toggle('active', s === n);
      el.classList.toggle('done', s < n);
    });
    showError('');
  }

  function calcTotals() {
    const service = BarberStore.getService(barber.id, state.serviceId);
    const servicePrice = service ? Number(service.price) || 0 : 0;
    const hs = barber.homeService || {};
    const travelFee = state.locationType === 'home' ? (Number(hs.travelFee) || 0) : 0;
    const extraFee = state.locationType === 'home' ? (Number(hs.extraFee) || 0) : 0;
    return { service, servicePrice, travelFee, extraFee, total: servicePrice + travelFee + extraFee };
  }

  function renderProfile() {
    const av = $('bp-avatar');
    if (av) {
      const src = barber.avatarUrl || (barber.avatar && String(barber.avatar).startsWith('http') ? barber.avatar : '');
      if (src) {
        av.innerHTML = `<img src="${src}" alt="${barber.name || ''}"/>`;
      } else {
        const initials = (barber.name || 'ح').trim().slice(0, 1);
        av.innerHTML = `<span class="bp-avatar-fallback">${initials}</span>`;
      }
    }
    const cover = $('bp-cover');
    if (cover) {
      const csrc = barber.coverUrl || '';
      if (csrc) {
        cover.innerHTML = `<img class="bp-cover-img" src="${csrc}" alt=""/>`;
        cover.style.backgroundImage = '';
      } else {
        cover.innerHTML = '';
        cover.style.backgroundImage = 'linear-gradient(135deg, #0f766e 0%, #134e4a 45%, #0b1220 100%)';
      }
    }
    $('bp-name').textContent = barber.name;
    $('bp-area').textContent = barber.area || '—';
    $('bp-bio').textContent = barber.bio || '';
    const ratingEl = $('bp-rating');
    if (ratingEl) {
      ratingEl.innerHTML = starsHtml(barber.rating) +
        '<span class="bp-rating-num">'+Number(barber.rating||0).toFixed(1)+'</span>';
    }
    $('bp-reviews').textContent = (barber.reviewsCount || 0) + ' تقييم';
    $('bp-services-count').textContent = (barber.services || []).length + ' خدمات';
    $('bp-policy').textContent = barber.cancelPolicy || 'يمكن التواصل لإلغاء أو تعديل الموعد.';

    const list = $('bp-services-list');
    list.innerHTML = (barber.services || []).map(s => `
      <div class="bp-service">
        <div>
          <div class="bp-service-name">${s.name}</div>
          <div class="bp-service-meta">${s.durationMin} دقيقة${s.description ? ' · ' + s.description : ''}</div>
        </div>
        <div class="bp-service-price">${Number(s.price).toLocaleString()} ج.م</div>
      </div>
    `).join('') || '<p style="color:#888">لا توجد خدمات</p>';

    // Home service panel
    const homePanel = $('bp-home-panel');
    if (homeEnabled()) {
      homePanel.hidden = false;
      const hs = barber.homeService;
      $('bp-home-note').textContent = hs.note || 'الحلاق يقدّم خدمة منزلية في مناطق محددة.';
      const parts = [];
      if (hs.areas && hs.areas.length) parts.push(`<div class="bp-stat">المناطق: ${hs.areas.join(' · ')}</div>`);
      parts.push(`<div class="bp-stat">رسوم انتقال: ${Number(hs.travelFee || 0).toLocaleString()} ج.م</div>`);
      if (hs.extraFee) parts.push(`<div class="bp-stat">رسوم إضافية: ${Number(hs.extraFee).toLocaleString()} ج.م</div>`);
      $('bp-home-meta').innerHTML = parts.join('');
      $('bk-opt-home').hidden = false;
      const hint = $('bk-home-option-hint');
      if (hint) {
        hint.textContent = `رسوم انتقال ${Number(hs.travelFee || 0).toLocaleString()} ج.م` +
          (hs.extraFee ? ` + ${Number(hs.extraFee).toLocaleString()} إضافية` : '');
      }
    } else {
      homePanel.hidden = true;
      $('bk-opt-home').hidden = true;
    }

    const opts = $('bk-services-options');
    opts.innerHTML = (barber.services || []).map(s => `
      <button type="button" class="bk-option" data-service="${s.id}">
        <strong>${s.name}</strong>
        <span>${s.durationMin} د · ${Number(s.price).toLocaleString()} ج.م</span>
      </button>
    `).join('');

    // area select for home
    const areaSel = $('bk-area');
    if (areaSel) {
      const areas = (barber.homeService && barber.homeService.areas) || [];
      if (areas.length) {
        areaSel.innerHTML = areas.map(a => `<option value="${a}">${a}</option>`).join('');
      } else {
        areaSel.innerHTML = `<option value="${barber.area || ''}">${barber.area || '—'}</option>`;
      }
    }
  }

  async function renderSlots() {
    const box = $('bk-slots');
    const date = $('bk-date').value;
    state.date = date || null;
    state.time = null;
    $('bk-next-3').disabled = true;
    if (!date) {
      box.innerHTML = '<span style="color:#888;font-size:12px;font-weight:700;">اختَر التاريخ أولاً</span>';
      return;
    }
    box.innerHTML = '<span style="color:#888;font-size:12px;font-weight:700;">جاري تحميل المواعيد...</span>';
    const slots = await BarberStore.getSlots(barber.id, date);
    if ($('bk-date').value !== date) return; // المستخدم غيّر التاريخ أثناء التحميل
    if (!slots.length) {
      box.innerHTML = '<span style="color:#888;font-size:12px;font-weight:700;">لا يوجد مواعيد في هذا اليوم</span>';
      return;
    }
    box.innerHTML = slots.map(s => `
      <button type="button" class="bk-slot" data-time="${s.time}" ${s.available ? '' : 'disabled'}>${s.time}</button>
    `).join('');
  }

  function renderSummary() {
    const { service, servicePrice, travelFee, extraFee, total } = calcTotals();
    const locLabel = state.locationType === 'home' ? 'خدمة منزلية' : 'في الصالون';
    $('bk-summary').innerHTML = `
      <div><strong>الحلاق:</strong> ${barber.name}</div>
      <div><strong>المكان:</strong> ${locLabel}</div>
      <div><strong>الخدمة:</strong> ${service ? service.name : '—'}</div>
      <div><strong>الموعد:</strong> ${state.date} — ${state.time}</div>
      <div><strong>المدة:</strong> ${service ? service.durationMin + ' دقيقة' : '—'}</div>
      <div><strong>سعر الخدمة:</strong> ${servicePrice.toLocaleString()} ج.م</div>
      ${state.locationType === 'home' ? `<div><strong>رسوم انتقال:</strong> ${travelFee.toLocaleString()} ج.م</div>` : ''}
      ${state.locationType === 'home' && extraFee ? `<div><strong>رسوم إضافية:</strong> ${extraFee.toLocaleString()} ج.م</div>` : ''}
      <div><strong>الإجمالي:</strong> ${total.toLocaleString()} ج.م</div>
      ${state.locationType === 'home' ? `<div><strong>المنطقة:</strong> ${state.customerArea || '—'}</div>` : ''}
      ${state.locationType === 'home' ? `<div><strong>العنوان:</strong> ${state.address || '—'}</div>` : ''}
      <div><strong>الاسم:</strong> ${state.customerName}</div>
      <div><strong>الموبايل:</strong> ${state.customerPhone}</div>
      ${state.notes ? `<div><strong>ملاحظات:</strong> ${state.notes}</div>` : ''}
    `;
  }

  function wire() {
    $('bp-scroll-book')?.addEventListener('click', () => {
      $('booking-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Step 1: location
    document.querySelectorAll('[data-location]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.hidden) return;
        state.locationType = btn.dataset.location;
        document.querySelectorAll('[data-location]').forEach(el => el.classList.toggle('selected', el === btn));
        $('bk-next-1').disabled = !state.locationType;
      });
    });
    $('bk-next-1')?.addEventListener('click', () => {
      if (!state.locationType) return showError('اختَر مكان الخدمة');
      if (state.locationType === 'home' && !homeEnabled()) return showError('الخدمة المنزلية غير متاحة');
      setStep(2);
    });

    // Step 2: service
    $('bk-services-options')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-service]');
      if (!btn) return;
      state.serviceId = btn.dataset.service;
      document.querySelectorAll('#bk-services-options .bk-option').forEach(el => {
        el.classList.toggle('selected', el === btn);
      });
      $('bk-next-2').disabled = !state.serviceId;
    });
    $('bk-back-2')?.addEventListener('click', () => setStep(1));
    $('bk-next-2')?.addEventListener('click', () => {
      if (!state.serviceId) return showError('اختَر خدمة');
      setStep(3);
      const d = new Date();
      d.setDate(d.getDate() + 1);
      $('bk-date').value = d.toISOString().slice(0, 10);
      $('bk-date').min = new Date().toISOString().slice(0, 10);
      renderSlots();
    });

    // Step 3: date/time
    $('bk-date')?.addEventListener('change', renderSlots);
    $('bk-slots')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.bk-slot');
      if (!btn || btn.disabled) return;
      state.time = btn.dataset.time;
      document.querySelectorAll('.bk-slot').forEach(el => el.classList.toggle('selected', el === btn));
      $('bk-next-3').disabled = !state.time;
    });
    $('bk-back-3')?.addEventListener('click', () => setStep(2));
    $('bk-next-3')?.addEventListener('click', () => {
      if (!state.date || !state.time) return showError('اختَر تاريخ ووقت');
      const homeFields = $('bk-home-fields');
      if (homeFields) homeFields.hidden = state.locationType !== 'home';
      setStep(4);
    });

    // Step 4: customer
    $('bk-back-4')?.addEventListener('click', () => setStep(3));
    $('bk-next-4')?.addEventListener('click', () => {
      state.customerName = $('bk-name').value.trim();
      state.customerPhone = $('bk-phone').value.trim();
      state.notes = $('bk-notes').value.trim();
      state.customerArea = $('bk-area') ? $('bk-area').value : '';
      state.address = $('bk-address') ? $('bk-address').value.trim() : '';
      if (!state.customerName || !state.customerPhone) return showError('الاسم والموبايل مطلوبين');
      if (!/^01[0-9]{9}$/.test(state.customerPhone)) return showError('رقم الموبايل غير صحيح (01xxxxxxxxx)');
      if (state.locationType === 'home' && !state.address) return showError('العنوان مطلوب للخدمة المنزلية');
      renderSummary();
      setStep(5);
    });

    // Step 5: confirm
    $('bk-back-5')?.addEventListener('click', () => setStep(4));
    $('bk-confirm')?.addEventListener('click', async () => {
      const confirmBtn = $('bk-confirm');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'جارِ تأكيد الحجز...';
      const result = await BarberStore.createBooking({
        barberId: barber.id,
        serviceId: state.serviceId,
        locationType: state.locationType,
        date: state.date,
        time: state.time,
        customerName: state.customerName,
        customerPhone: state.customerPhone,
        customerArea: state.customerArea,
        address: state.address,
        notes: state.notes
      });
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'تأكيد الحجز';
      if (!result.success) return showError(result.error || 'فشل الحجز');
      for (let i = 1; i <= 5; i++) {
        const panel = $('bk-step-' + i);
        if (panel) panel.hidden = true;
      }
      $('bk-step-success').hidden = false;
      const bk = result.booking;
      $('bk-ref').textContent = 'رقم الحجز: ' + bk.id.slice(-8).toUpperCase();
      const msg = $('bk-success-msg');
      if (msg) {
        msg.textContent = bk.locationType === 'home'
          ? 'طلب خدمة منزلية قيد التأكيد. الحلاق هيتواصل معاك على رقمك.'
          : 'الحجز قيد التأكيد من الحلاق. هنتواصل معاك على رقمك.';
      }
      document.querySelectorAll('[data-step-ind]').forEach(el => el.classList.add('done'));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof BarberStore === 'undefined') {
      $('barber-not-found').hidden = false;
      return;
    }
    barber = BarberStore.getById(barberId);
    if (!barber || barber.status !== 'approved') {
      $('barber-not-found').hidden = false;
      return;
    }
    document.title = barber.name + ' — Doddz Go';
    $('barber-content').hidden = false;
    renderProfile();
    wire();
    setStep(1);
  });
})();
