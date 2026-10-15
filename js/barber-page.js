// Barber profile + booking wizard (salon + Home Service)
// ملف الصالون للزائر: البيانات + الفريق + المواعيد + اللوكيشن + الألبوم + الحجز المتعدد
(function () {
  const params = new URLSearchParams(window.location.search);
  const barberId = params.get('id');
  let barber = null;
  let step = 1;
  const state = {
    locationType: null,   // salon | home
    serviceIds: [],       // اختيار متعدد
    memberId: '',         // '' = أقرب فني متاح
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

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(v) { return Number(v || 0).toLocaleString(); }

  function starsHtml(rating) {
    const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    let html = '<span class="bp-stars" aria-label="' + Number(rating || 0).toFixed(1) + '">';
    for (let i = 1; i <= 5; i++) html += '<span class="bp-star' + (i <= r ? ' on' : '') + '">★</span>';
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
    if (n === 2) syncStep2();
  }

  /* ================================================================
     الخدمات: تجميع بالحرفة (عناية بالشعر / بالذقن / بالبشرة / أخرى)
  ================================================================ */
  const CATEGORY_LABELS = { hair: 'عناية بالشعر', beard: 'عناية بالذقن', skin: 'عناية بالبشرة', other: 'خدمات أخرى' };

  function categoryLabel(key) {
    const presets = (window.BarberStore && BarberStore.SERVICE_PRESETS) || [];
    const g = presets.find(p => p.key === key);
    return g ? g.label : (CATEGORY_LABELS[key] || 'خدمات أخرى');
  }

  /** قايمة خدمات الصالون مقسّمة بالحرفة: [ {key, label, items:[service]} ] */
  function groupedServices() {
    const list = (barber && barber.services) || [];
    const order = [];
    const buckets = {};
    list.forEach(s => {
      const key = s.category && CATEGORY_LABELS[s.category] ? s.category : 'other';
      if (!buckets[key]) { buckets[key] = []; order.push(key); }
      buckets[key].push(s);
    });
    // ترتيب ثابت: شعر → ذقن → بشرة → أخرى
    const preferred = ['hair', 'beard', 'skin', 'other'].filter(k => buckets[k]);
    return preferred.map(k => ({ key: k, label: categoryLabel(k), items: buckets[k] }));
  }

  function serviceById(id) {
    return BarberStore.getService(barber.id, id);
  }

  function pickedServices() {
    return BarberStore.getServices(barber.id, state.serviceIds);
  }

  function calcTotals() {
    const items = pickedServices();
    const sum = BarberStore.summarizeServices(items);
    const servicePrice = sum.price;
    const durationMin = sum.durationMin;
    const hs = barber.homeService || {};
    const travelFee = state.locationType === 'home' ? (Number(hs.travelFee) || 0) : 0;
    const extraFee = state.locationType === 'home' ? (Number(hs.extraFee) || 0) : 0;
    return {
      items, servicePrice, durationMin, travelFee, extraFee,
      total: servicePrice + travelFee + extraFee,
      label: sum.label
    };
  }

  /* ================================================================
     عرض البروفايل
  ================================================================ */
  function renderProfile() {
    const av = $('bp-avatar');
    if (av) {
      const src = barber.avatarUrl || (barber.avatar && String(barber.avatar).startsWith('http') ? barber.avatar : '');
      if (src) av.innerHTML = '<img src="' + esc(src) + '" alt="' + esc(barber.name || '') + '"/>';
      else av.innerHTML = '<span class="bp-avatar-fallback">' + esc((barber.name || 'ح').trim().slice(0, 1)) + '</span>';
    }
    const cover = $('bp-cover');
    if (cover) {
      const csrc = barber.coverUrl || '';
      if (csrc) {
        cover.innerHTML = '<img class="bp-cover-img" src="' + esc(csrc) + '" alt=""/>';
        cover.style.backgroundImage = '';
      } else {
        cover.innerHTML = '';
        cover.style.backgroundImage = 'linear-gradient(135deg, #0e7490 0%, #155e75 45%, #05070d 100%)';
      }
    }
    $('bp-name').textContent = barber.name;
    $('bp-area').textContent = barber.area || '—';
    $('bp-bio').textContent = barber.bio || '';
    const ratingEl = $('bp-rating');
    if (ratingEl) {
      ratingEl.innerHTML = starsHtml(barber.rating) +
        '<span class="bp-rating-num">' + Number(barber.rating || 0).toFixed(1) + '</span>';
    }
    $('bp-reviews').textContent = (barber.reviewsCount || 0) + ' تقييم';
    $('bp-services-count').textContent = (barber.services || []).length + ' خدمات';
    $('bp-policy').textContent = barber.cancelPolicy || 'يمكن التواصل لإلغاء أو تعديل الموعد.';

    renderServicePanel();
    renderTeamPanel();
    renderHoursPanel();
    renderLocationPanel();
    renderMediaPanels();
    buildServiceOptions();
    buildMemberOptions();
    buildAreaSelect();
  }

  function renderServicePanel() {
    const list = $('bp-services-list');
    if (!list) return;
    const groups = groupedServices();
    if (!groups.length) { list.innerHTML = '<p style="color:#888">لا توجد خدمات</p>'; return; }
    list.innerHTML = groups.map(g => `
      <div class="bp-svc-group">
        <div class="bp-svc-group-title">${esc(g.label)}</div>
        ${g.items.map(s => `
          <div class="bp-service">
            <div>
              <div class="bp-service-name">${esc(s.name)}</div>
              <div class="bp-service-meta">${s.durationMin} دقيقة${s.description ? ' · ' + esc(s.description) : ''}</div>
            </div>
            <div class="bp-service-price">${money(s.price)} ج.م</div>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  /* ── الفريق ───────────────────────────────────────────────── */
  function renderTeamPanel() {
    const panel = $('bp-team-panel');
    const box = $('bp-team');
    if (!panel || !box) return;
    const members = BarberStore.getTeam(barber.id);
    if (!members.length) { panel.hidden = true; box.innerHTML = ''; return; }
    panel.hidden = false;
    const note = $('bp-team-note');
    if (note) {
      note.textContent = members.length >= 2
        ? 'ممكن تختار الفني اللي تحجز عنده وقت الحجز، أو تسيبها لأقرب فني متاح.'
        : 'الفني المتاح في الصالون.';
    }
    box.innerHTML = members.map(m => `
      <div class="bp-member-card${m.isOwner ? ' owner' : ''}">
        <div class="bp-member-photo">${memberPhoto(m, 58)}</div>
        <div class="bp-member-name">${esc(m.name)}</div>
        <div class="bp-member-title">${esc(m.title || (m.isOwner ? 'صاحب الصالون' : 'فني'))}</div>
      </div>
    `).join('');
  }

  function memberPhoto(m, size) {
    const src = m.photoUrl || (m.isOwner ? (barber.avatarUrl || '') : '');
    if (src && /^(https?:\/\/|\/|data:)/i.test(src)) {
      return '<img src="' + esc(src) + '" alt="' + esc(m.name) + '" style="width:' + size + 'px;height:' + size + 'px"/>';
    }
    return '<span class="bp-member-initial">' + esc(String(m.name || 'ف').trim().slice(0, 1)) + '</span>';
  }

  /* ── المواعيد ─────────────────────────────────────────────── */
  function renderHoursPanel() {
    const panel = $('bp-hours-panel');
    const box = $('bp-hours');
    if (!panel || !box || !BarberStore.hoursView) { if (panel) panel.hidden = true; return; }
    const view = BarberStore.hoursView(barber);
    const anyOpen = view.some(d => d.open);
    if (!anyOpen) { panel.hidden = true; box.innerHTML = ''; return; }
    panel.hidden = false;
    const today = new Date().getDay();   // 0 = الأحد — نفس ترقيم الموقع
    box.innerHTML = view.map(d => `
      <div class="bp-hour-line${d.day === today ? ' today' : ''}${d.open ? '' : ' closed'}">
        <span class="bp-hour-day">${esc(d.label)}${d.day === today ? ' <em class="bp-today-tag">اليوم</em>' : ''}</span>
        <span class="bp-hour-time">${d.open ? esc(BarberStore.dayHoursLabel(barber, d.day)) : 'مغلق'}</span>
      </div>
    `).join('') + '<div class="bp-hour-foot">هذه المواعيد هي الأساس في بناء الأوقات المتاحة للحجز.</div>';
  }

  /* ── اللوكيشن ─────────────────────────────────────────────── */
  function renderLocationPanel() {
    const panel = $('bp-loc-panel');
    if (!panel) return;
    const loc = barber.location || {};
    const has = loc.address || loc.mapUrl || (loc.lat && loc.lng);
    if (!has) { panel.hidden = true; return; }
    panel.hidden = false;
    $('bp-loc-address').textContent = loc.address || (loc.lat + ',' + loc.lng);
    const noteEl = $('bp-loc-note');
    if (noteEl) {
      noteEl.textContent = loc.note || '';
      noteEl.hidden = !loc.note;
    }
    const link = $('bp-loc-map');
    if (link) {
      const url = loc.mapUrl
        || (loc.lat && loc.lng
          ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loc.lat + ',' + loc.lng)
          : (loc.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loc.address) : ''));
      link.hidden = !url;
      if (url) link.href = url;
    }
  }

  /* ── الألبوم + العينات ────────────────────────────────────── */
  function renderMediaPanels() {
    ['gallery', 'sample'].forEach(kind => {
      const panel = $(kind === 'gallery' ? 'bp-gallery-panel' : 'bp-samples-panel');
      const box = $(kind === 'gallery' ? 'bp-gallery' : 'bp-samples');
      if (!panel || !box || !BarberStore.getMedia) { if (panel) panel.hidden = true; return; }
      const rows = BarberStore.getMedia(barber.id, kind);
      if (!rows.length) { panel.hidden = true; box.innerHTML = ''; return; }
      panel.hidden = false;
      box.innerHTML = rows.map(x => `
        <button type="button" class="bp-shot" data-shot="${esc(x.url)}" data-cap="${esc(x.caption || '')}">
          <img src="${esc(x.url)}" alt="${esc(x.caption || 'صورة من الصالون')}" loading="lazy"/>
          ${x.caption ? '<span class="bp-shot-cap">' + esc(x.caption) + '</span>' : ''}
        </button>
      `).join('');
    });
  }

  /* ── الـlightbox ──────────────────────────────────────────── */
  function openLightbox(src, cap) {
    const lb = $('bp-lightbox');
    if (!lb || !src) return;
    $('bp-lightbox-img').src = src;
    $('bp-lightbox-cap').textContent = cap || '';
    lb.hidden = false;
    document.body.classList.add('bp-lightbox-open');
  }

  function closeLightbox() {
    const lb = $('bp-lightbox');
    if (!lb) return;
    lb.hidden = true;
    document.body.classList.remove('bp-lightbox-open');
  }

  /* ================================================================
     خطوات الحجز
  ================================================================ */
  function buildServiceOptions() {
    const opts = $('bk-services-options');
    if (!opts) return;
    const groups = groupedServices();
    if (!groups.length) {
      opts.innerHTML = '<p style="color:#888;font-size:12.5px;font-weight:700;margin:0;">لا توجد خدمات مسجّلة لهذا الصالون.</p>';
      return;
    }
    opts.innerHTML = groups.map(g => `
      <div class="bk-svc-group">
        <div class="bk-svc-group-title">${esc(g.label)}</div>
        ${g.items.map(s => `
          <button type="button" class="bk-option bk-check" data-service="${esc(s.id)}" aria-pressed="false">
            <span class="bk-tick" aria-hidden="true"></span>
            <strong>${esc(s.name)}</strong>
            <span>${s.durationMin} د · ${money(s.price)} ج.م</span>
          </button>
        `).join('')}
      </div>
    `).join('');
  }

  function buildMemberOptions() {
    const field = $('bk-member-field');
    const box = $('bk-members');
    if (!field || !box) return;
    const members = BarberStore.getTeam ? BarberStore.getTeam(barber.id) : [];
    if (members.length < 2) {
      field.hidden = true;
      box.innerHTML = '';
      state.memberId = '';
      return;
    }
    field.hidden = false;
    box.innerHTML = `
      <button type="button" class="bk-member${state.memberId === '' ? ' selected' : ''}" data-member="">
        <span class="bk-member-any">أقرب فني متاح</span>
      </button>
      ${members.map(m => `
        <button type="button" class="bk-member${state.memberId === String(m.id) ? ' selected' : ''}" data-member="${esc(m.id)}">
          ${memberPhoto(m, 40)}
          <span class="bk-member-nm">${esc(m.name)}</span>
          <span class="bk-member-tl">${esc(m.title || (m.isOwner ? 'صاحب الصالون' : 'فني'))}</span>
        </button>
      `).join('')}
    `;
  }

  function buildAreaSelect() {
    const areaSel = $('bk-area');
    if (!areaSel) return;
    const areas = (barber.homeService && barber.homeService.areas) || [];
    areaSel.innerHTML = areas.length
      ? areas.map(a => '<option value="' + esc(a) + '">' + esc(a) + '</option>').join('')
      : '<option value="' + esc(barber.area || '') + '">' + esc(barber.area || '—') + '</option>';
  }

  function syncStep2() {
    document.querySelectorAll('#bk-services-options .bk-option').forEach(el => {
      const on = state.serviceIds.includes(el.dataset.service);
      el.classList.toggle('selected', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const next = $('bk-next-2');
    if (next) next.disabled = state.serviceIds.length === 0;
    renderPickedSummary();
  }

  /** شريط صغير تحت قايمة الخدمات: اختَرت إيه والمدة والإجمالي */
  function renderPickedSummary() {
    const box = $('bk-picked');
    if (!box) return;
    if (!state.serviceIds.length) { box.hidden = true; box.innerHTML = ''; return; }
    const t = calcTotals();
    const who = memberLabel();
    box.hidden = false;
    box.innerHTML = `
      <div class="bk-picked-row"><span>إجمالي المدة</span><strong>${t.durationMin} دقيقة</strong></div>
      <div class="bk-picked-row"><span>سعر الخدمات</span><strong>${money(t.servicePrice)} ج.م</strong></div>
      ${state.locationType === 'home' ? `<div class="bk-picked-row"><span>رسوم الانتقال${t.extraFee ? ' + إضافية' : ''}</span><strong>${money(t.travelFee + t.extraFee)} ج.م</strong></div>` : ''}
      <div class="bk-picked-row total"><span>الإجمالي</span><strong>${money(t.total)} ج.م</strong></div>
      <div class="bk-picked-row who"><span>الفني</span><strong>${esc(who)}</strong></div>
    `;
  }

  function memberLabel() {
    if (!state.memberId) return 'أقرب فني متاح';
    const m = (BarberStore.getTeam(barber.id) || []).find(x => String(x.id) === String(state.memberId));
    return m ? m.name : 'أقرب فني متاح';
  }

  async function renderSlots() {
    const box = $('bk-slots');
    const hint = $('bk-slots-hint');
    const date = $('bk-date').value;
    state.date = date || null;
    state.time = null;
    if ($('bk-next-3')) $('bk-next-3').disabled = true;
    if (!date) {
      box.innerHTML = '<span style="color:#888;font-size:12px;font-weight:700;">اختَر التاريخ أولاً</span>';
      if (hint) hint.textContent = '';
      return;
    }
    const t = calcTotals();
    if (hint) hint.textContent = t.durationMin ? '· المدة ' + t.durationMin + ' دقيقة · ' + memberLabel() : '';
    box.innerHTML = '<span style="color:#888;font-size:12px;font-weight:700;">جاري تحميل المواعيد...</span>';
    const slots = await BarberStore.getSlots(barber.id, date, state.memberId, { durationMin: t.durationMin });
    if (!$('bk-date') || $('bk-date').value !== date) return; // المستخدم غيّر التاريخ أثناء التحميل
    if (!slots.length) {
      const dh = BarberStore.dayHours ? BarberStore.dayHours(barber, new Date(date + 'T12:00:00').getDay()) : null;
      box.innerHTML = '<span style="color:#888;font-size:12px;font-weight:700;">' +
        (dh && !dh.open ? 'الصالون مغلق في اليوم ده' : 'لا يوجد مواعيد في هذا اليوم') + '</span>';
      return;
    }
    const reasonText = { busy: 'محجوز', too_long: 'المدة أكبر من وقت اليوم', past: 'فات' };
    box.innerHTML = slots.map(s => `
      <button type="button" class="bk-slot${s.available ? '' : ' gone'}" data-time="${esc(s.time)}" ${s.available ? '' : 'disabled'}
        title="${s.available ? '' : esc(reasonText[s.reason] || 'غير متاح')}">${esc(s.time)}</button>
    `).join('');
  }

  function renderSummary() {
    const t = calcTotals();
    const locLabel = state.locationType === 'home' ? 'خدمة منزلية' : 'في الصالون';
    $('bk-summary').innerHTML = `
      <div><strong>الصالون:</strong> ${esc(barber.name)}</div>
      <div><strong>المكان:</strong> ${esc(locLabel)}</div>
      <div><strong>الخدمات:</strong> ${esc(t.items.map(s => s.name).join('، ') || '—')}</div>
      <div><strong>الفني:</strong> ${esc(memberLabel())}</div>
      <div><strong>الموعد:</strong> ${esc(state.date)} — ${esc(state.time)}</div>
      <div><strong>المدة:</strong> ${t.durationMin} دقيقة</div>
      <div><strong>سعر الخدمات:</strong> ${money(t.servicePrice)} ج.م</div>
      ${state.locationType === 'home' ? `<div><strong>رسوم انتقال:</strong> ${money(t.travelFee)} ج.م</div>` : ''}
      ${state.locationType === 'home' && t.extraFee ? `<div><strong>رسوم إضافية:</strong> ${money(t.extraFee)} ج.م</div>` : ''}
      <div><strong>الإجمالي:</strong> ${money(t.total)} ج.م</div>
      ${state.locationType === 'home' ? `<div><strong>المنطقة:</strong> ${esc(state.customerArea || '—')}</div>` : ''}
      ${state.locationType === 'home' ? `<div><strong>العنوان:</strong> ${esc(state.address || '—')}</div>` : ''}
      <div><strong>الاسم:</strong> ${esc(state.customerName)}</div>
      <div><strong>الموبايل:</strong> ${esc(state.customerPhone)}</div>
      ${state.notes ? `<div><strong>ملاحظات:</strong> ${esc(state.notes)}</div>` : ''}
    `;
  }

  function wire() {
    $('bp-scroll-book')?.addEventListener('click', () => {
      $('booking-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // الألبوم → lightbox
    ['bp-gallery', 'bp-samples'].forEach(id => {
      $(id)?.addEventListener('click', (e) => {
        const shot = e.target.closest('[data-shot]');
        if (shot) openLightbox(shot.dataset.shot, shot.dataset.cap);
      });
    });
    $('bp-lightbox')?.addEventListener('click', (e) => {
      if (e.target === $('bp-lightbox') || e.target.closest('#bp-lightbox-close')) closeLightbox();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

    // الخطوة 1: المكان
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

    // الخطوة 2: خدمات متعددة + فني
    $('bk-services-options')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-service]');
      if (!btn) return;
      const id = btn.dataset.service;
      const i = state.serviceIds.indexOf(id);
      if (i === -1) state.serviceIds.push(id); else state.serviceIds.splice(i, 1);
      // لو المدة اتغيرت والاتفاق اتحجز في خطوة الموعد، الوقت القديم ممكن يبقى غير صالح
      state.time = null;
      syncStep2();
    });
    $('bk-members')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-member]');
      if (!btn) return;
      state.memberId = btn.dataset.member || '';
      state.time = null;
      buildMemberOptions();
      renderPickedSummary();
    });
    $('bk-back-2')?.addEventListener('click', () => setStep(1));
    $('bk-next-2')?.addEventListener('click', async () => {
      if (!state.serviceIds.length) return showError('اختَر خدمة واحدة على الأقل');
      setStep(3);
      const d = new Date();
      d.setDate(d.getDate() + 1);
      $('bk-date').value = d.toISOString().slice(0, 10);
      $('bk-date').min = new Date().toISOString().slice(0, 10);
      await renderSlots();
    });

    // الخطوة 3: التاريخ والوقت
    $('bk-date')?.addEventListener('change', () => renderSlots());
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

    // الخطوة 4: بيانات العميل
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

    // الخطوة 5: التأكيد
    $('bk-back-5')?.addEventListener('click', () => setStep(4));
    $('bk-confirm')?.addEventListener('click', async () => {
      const confirmBtn = $('bk-confirm');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'جارِ تأكيد الحجز...';
      const result = await BarberStore.createBooking({
        barberId: barber.id,
        serviceIds: state.serviceIds,
        memberId: state.memberId,
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
      if (!result.success) {
        showError(result.error || 'فشل الحجز');
        if (result.error && /الموعد|وقت/.test(result.error)) setStep(3);
        return;
      }
      for (let i = 1; i <= 5; i++) {
        const panel = $('bk-step-' + i);
        if (panel) panel.hidden = true;
      }
      $('bk-step-success').hidden = false;
      const bk = result.booking;
      $('bk-ref').textContent = 'رقم الحجز: ' + bk.id.slice(-8).toUpperCase();
      const msg = $('bk-success-msg');
      if (msg) {
        const who = bk.memberName ? ' مع ' + bk.memberName : '';
        msg.textContent = bk.locationType === 'home'
          ? 'طلب خدمة منزلية' + who + ' قيد التأكيد. الصالون هيتواصل معاك على رقمك.'
          : 'الحجز' + who + ' قيد التأكيد من الصالون. هنتواصل معاك على رقمك.';
      }
      document.querySelectorAll('[data-step-ind]').forEach(el => el.classList.add('done'));
    });
  }

  /** أي تحديث جوه BarberStore (فريق/صور/مواعيد من السحابة) يعيد رسم الأقسام */
  function onDataChanged(e) {
    if (!barber) return;
    const pid = e && e.detail && e.detail.profileId;
    if (pid && String(pid) !== String(barber.id)) return;

    // السحابة بتتغلب على النسخة المحلية: نعيد قراءة البروفايل ونرسم كل حاجة
    const fresh = BarberStore.getById(barber.id);
    if (fresh) {
      barber = fresh;
      const alive = (barber.services || []).map(s => String(s.id));
      const kept = state.serviceIds.filter(id => alive.includes(String(id)));
      const lost = kept.length !== state.serviceIds.length;
      state.serviceIds = kept;
      renderProfile();
      if (step === 2 || lost) syncStep2();
      if (step === 3) renderSlots();
      if (lost && !kept.length) setStep(2);
      return;
    }

    renderTeamPanel();
    renderHoursPanel();
    renderLocationPanel();
    renderMediaPanels();
    buildMemberOptions();
    if (step === 2) syncStep2();
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
    document.addEventListener('doddz:barber-data', onDataChanged);
  });
})();
