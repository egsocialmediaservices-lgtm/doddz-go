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

  /* المنطقة الحقيقية للصالون: المنطقة > المحافظة > أول منطقة منزلية > عنوان اللوكيشن
     (من غير شرطة — لو مفيش منطقة مسجّلة السطر ده بيتخفي خالص) */
  function areaText() {
    if (!barber) return '';
    const pool = [
      barber.area,
      barber.governorate,
      (barber.homeService && Array.isArray(barber.homeService.areas) ? barber.homeService.areas[0] : ''),
      (barber.location && barber.location.address) || ''
    ];
    for (const v of pool) {
      const s = String(v || '').trim();
      if (s) return s;
    }
    return '';
  }

  /* ميعاد النهاردة بس — يبان فوق جنب الاسم */
  function todayHoursText() {
    if (!barber || typeof BarberStore === 'undefined' || !BarberStore.dayHours) return '';
    const day = new Date().getDay();          // 0 = الأحد
    const label = (BarberStore.DAYS_AR && BarberStore.DAYS_AR[day]) ? BarberStore.DAYS_AR[day] : 'اليوم';
    const d = BarberStore.dayHours(barber, day);
    if (!d || !d.open) {
      // الصالون مساعِد مواعيده بس مقفل النهاردة — نقولها بدل ما السطر يفضل فاضي
      const anyOpen = BarberStore.hoursView ? BarberStore.hoursView(barber).some(x => x.open) : false;
      return anyOpen ? '🕘 اليوم ' + label + ' · مغلق' : '';
    }
    const range = BarberStore.dayHoursLabel ? BarberStore.dayHoursLabel(barber, day) : '';
    return '🕘 اليوم ' + label + (range ? ' · ' + range : '');
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
    renderMetaRow();
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
    renderHomePanel();
    buildServiceOptions();
    buildMemberOptions();
    buildAreaSelect();
  }

  /* المنطقة + ميعاد النهاردة + شارة الخدمة المنزلية — فوق جنب الاسم */
  function renderMetaRow() {
    const area = $('bp-area');
    if (area) {
      const txt = areaText();
      area.textContent = txt ? '📍 ' + txt : '';
      area.hidden = !txt;
    }
    const today = $('bp-today');
    if (today) {
      const t = todayHoursText();
      today.textContent = t;
      today.hidden = !t;
    }
    const chip = $('bp-home-chip');
    if (chip) chip.hidden = !homeEnabled();
  }

  /* أكتر من 5 خدمات في القسم الواحد → أول 5 بس + زرار «المزيد»
     عشان قايمة الخدمات ما تطوّلش صفحة الصالون وتاخّد مساحة من الصفحة.
     الحالة المفتوحة بتفضل محفوظة حتى بعد إعادة الرسم (تعديل من اللوحة). */
  const SVC_PREVIEW = 5;
  const openSvcGroups = new Set();

  function serviceRow(s) {
    return `
      <div class="bp-service">
        <div>
          <div class="bp-service-name">${esc(s.name)}</div>
          <div class="bp-service-meta">${s.durationMin} دقيقة${s.description ? ' · ' + esc(s.description) : ''}</div>
        </div>
        <div class="bp-service-price">${money(s.price)} ج.م</div>
      </div>
    `;
  }

  function renderServicePanel() {
    const list = $('bp-services-list');
    if (!list) return;
    const groups = groupedServices();
    if (!groups.length) { list.innerHTML = '<p style="color:#888">لا توجد خدمات</p>'; return; }
    list.innerHTML = groups.map(g => {
      const hiddenCount = Math.max(0, g.items.length - SVC_PREVIEW);
      const isOpen = hiddenCount > 0 && openSvcGroups.has(g.key);
      return `
      <div class="bp-svc-group${isOpen ? ' open' : ''}" data-svc-group="${esc(g.key)}">
        <div class="bp-svc-group-title">
          <span>${esc(g.label)}</span>
          <span class="bp-svc-count">${g.items.length}</span>
        </div>
        ${g.items.slice(0, SVC_PREVIEW).map(serviceRow).join('')}
        ${hiddenCount ? `
          <div class="bp-svc-rest"${isOpen ? '' : ' hidden'}>
            ${g.items.slice(SVC_PREVIEW).map(serviceRow).join('')}
          </div>
          <button type="button" class="bp-svc-more" data-svc-more="${esc(g.key)}" aria-expanded="${isOpen ? 'true' : 'false'}">
            ${isOpen ? 'عرض أقل' : 'المزيد (' + hiddenCount + ' خدمة)'}
            <span class="bp-svc-more-arrow" aria-hidden="true">${isOpen ? '▲' : '▼'}</span>
          </button>
        ` : ''}
      </div>
    `;
    }).join('');
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
  /* الزائر شايف مواعيد النهاردة بس — باقي الأيام الاختياري تحت */
  function renderHoursPanel() {
    const panel = $('bp-hours-panel');
    const box = $('bp-hours');
    const more = $('bp-hours-more');
    const week = $('bp-hours-week');
    if (!panel || !box || !BarberStore.hoursView) { if (panel) panel.hidden = true; return; }
    const view = BarberStore.hoursView(barber);
    const anyOpen = view.some(d => d.open);
    if (!anyOpen) {
      panel.hidden = true;
      box.innerHTML = '';
      if (more) { more.hidden = true; if (week) week.innerHTML = ''; }
      return;
    }
    panel.hidden = false;
    const today = new Date().getDay();   // 0 = الأحد — نفس ترقيم الموقع
    const line = (d) => `
      <div class="bp-hour-line${d.day === today ? ' today' : ''}${d.open ? '' : ' closed'}">
        <span class="bp-hour-day">${esc(d.label)}${d.day === today ? ' <em class="bp-today-tag">اليوم</em>' : ''}</span>
        <span class="bp-hour-time">${d.open ? esc(BarberStore.dayHoursLabel(barber, d.day)) : 'مغلق'}</span>
      </div>`;
    const t = view.find(d => d.day === today);
    box.innerHTML = (t ? line(t) : '') +
      '<div class="bp-hour-foot">' + (t && t.open ? 'المواعيد دي هي الأساس في بناء الأوقات المتاحة للحجز.' : 'الصالون مغلق النهاردة — اختَر يوم تاني من الحجز.') + '</div>';
    const rest = view.filter(d => d.day !== today);
    if (more && week) {
      week.innerHTML = rest.map(line).join('');
      more.hidden = false;
      more.open = false;
    }
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

  /* ── الخدمة المنزلية ──────────────────────────────────────── */
  /* أهم جزء: الزائر مش هيلاقي خيار «خدمة منزلية» غير لو الصالون فعّلها فعلًا.
     قبل كده الزرار كان فاضل hidden في HTML مهما صاحب الصالون فعّل الخدمة. */
  function renderHomePanel() {
    const opt = $('bk-opt-home');
    const on = homeEnabled();
    if (opt) opt.hidden = !on;
    if (!on) {
      if (state.locationType === 'home') {
        state.locationType = null;
        if ($('bk-next-1')) $('bk-next-1').disabled = true;
        document.querySelectorAll('[data-location]').forEach(el => el.classList.remove('selected'));
      }
    }
    const hint = $('bk-home-option-hint');
    if (hint && on) {
      const hs = barber.homeService || {};
      const parts = [];
      if (Array.isArray(hs.areas) && hs.areas.length) parts.push('المناطق: ' + hs.areas.slice(0, 6).join('، '));
      const fee = (Number(hs.travelFee) || 0) + (Number(hs.extraFee) || 0);
      if (fee > 0) parts.push('رسوم الانتقال ' + money(fee) + ' ج.م');
      hint.textContent = parts.length ? parts.join(' · ') : 'الحلاق يجي لحد البيت';
    }

    const panel = $('bp-home-panel');
    if (!panel) return;
    if (!on) { panel.hidden = true; return; }
    panel.hidden = false;
    const hs = barber.homeService || {};
    const note = $('bp-home-note');
    if (note) {
      note.textContent = hs.note || 'الصالون بيوصل لحد بيتك في المناطق المتاحة — اختَر «خدمة منزلية» في خطوة المكان من قايمة الحجز.';
    }
    const meta = $('bp-home-meta');
    if (meta) {
      const rows = [];
      if (Array.isArray(hs.areas) && hs.areas.length) {
        rows.push('<div class="bp-stat">المناطق: ' + esc(hs.areas.join('، ')) + '</div>');
      }
      rows.push('<div class="bp-stat">رسوم الانتقال: ' + money(hs.travelFee) + ' ج.م</div>');
      if (Number(hs.extraFee) > 0) rows.push('<div class="bp-stat">رسوم إضافية: ' + money(hs.extraFee) + ' ج.م</div>');
      meta.innerHTML = rows.join('');
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

  /* ================================================================
     تقييمات الزوار — provider_reviews
     ----------------------------------------------------------------
     * الزائر بيبعت تقييمه لدالة submit_provider_review → بيروح 'pending'.
     * القايمة العامة بتتقرا من provider_approved_reviews (المعتمد بس).
     * كل الصلاحيات في Supabase (RLS + SECURITY DEFINER) — المتصفح
       بيعبّر عن النية بس، ومفيش أي قرار أمان هنا.
     * لو الجدول لسه ما اتنفّذش (supabase/10-staff-requests-and-reviews.sql)
       الصفحة تكمّل شغل عادي وتقول ملاحظة واضحة بدل ما تقع.
  ================================================================ */
  const REV_SECTION  = 'barbers';
  const REV_PREVIEW  = 3;
  let revRows        = [];      // المعتمدة
  let revOpenAll     = false;
  let revFormOpen    = false;
  let revStarPick    = 0;
  let revJustSent    = false;
  let revTableReady  = true;    // false لو SQL لسه ما اتنفّذش
  let authUser       = null;
  let myReview       = null;

  function supa() { return window.supabaseClient || null; }

  function revError(msg) {
    const el = $('bp-rev-error');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('show', !!msg);
  }

  function revDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch (_) { return ''; }
  }

  /* المتوسط والعدد: من عمودات النشاط المعتمدة، وبنتيجة القايمة لو هي الأحدث */
  function renderReviewSummary() {
    const el = $('bp-rev-summary');
    if (!el) return;
    const avg = Number(barber && barber.rating || 0);
    const cnt = Math.max(Number(barber && barber.reviewsCount || 0), revRows.length);
    if (!cnt) {
      el.innerHTML = '<span class="bp-rev-sum-empty">لسه مفيش تقييمات معتمدة لهذا الصالون.</span>';
      return;
    }
    el.innerHTML =
      '<span class="bp-rev-sum-avg">' + starsHtml(avg) + '<b>' + avg.toFixed(1) + '</b></span>' +
      '<span class="bp-rev-sum-count">بناءً على ' + cnt + ' تقييم معتمد من زوار Doddz Go</span>';
  }

  function renderReviewsList() {
    const list = $('bp-rev-list');
    if (!list) return;
    if (!revRows.length) {
      list.innerHTML = '<p class="bp-rev-empty">أول تقييم معتمد هيظهر هنا بعد مراجعة الإدارة.</p>';
      return;
    }
    const hidden = Math.max(0, revRows.length - REV_PREVIEW);
    const shown = revOpenAll ? revRows : revRows.slice(0, REV_PREVIEW);
    list.innerHTML = shown.map(r => `
      <div class="bp-rev-item">
        <div class="bp-rev-head">
          <span class="bp-rev-name">${esc(r.reviewer || 'زائر Doddz Go')}</span>
          <span class="bp-rev-date">${esc(revDate(r.created_at))}</span>
        </div>
        <div class="bp-rev-line">${starsHtml(r.rating)}</div>
        ${r.comment ? '<p class="bp-rev-comment">' + esc(r.comment) + '</p>' : ''}
      </div>
    `).join('') + (hidden ? `
      <button type="button" class="bp-svc-more bp-rev-more" data-rev-more aria-expanded="${revOpenAll ? 'true' : 'false'}">
        ${revOpenAll ? 'عرض أقل' : 'عرض كل التقييمات (' + revRows.length + ')'}
        <span class="bp-svc-more-arrow" aria-hidden="true">${revOpenAll ? '▲' : '▼'}</span>
      </button>
    ` : '');
  }

  const MY_REVIEW_LABEL = {
    pending:  'تقييمك وصل — قيد مراجعة الإدارة',
    approved: 'تقييمك منشور ✓',
    rejected: 'تقييمك اترفض — تقدر تعدّله وتبعت تاني'
  };

  function starPickerHtml() {
    return [1, 2, 3, 4, 5].map(i =>
      '<button type="button" class="bp-rev-star' + (i <= revStarPick ? ' on' : '') +
      '" data-rev-star="' + i + '" aria-label="' + i + ' من 5">★</button>'
    ).join('');
  }

  function renderReviewForm() {
    const box = $('bp-rev-form');
    if (!box) return;

    // الزائر من غير حساب: الحقول محتاجة user_id، فالمنطق كله في Supabase
    if (!authUser) {
      box.innerHTML = `
        <div class="bp-rev-gate">
          <p class="bp-panel-note" style="margin:0 0 10px;">عشان نظهر تقييمات حقيقية بس، التقييم متاح للحسابات المسجّلة في Doddz Go.</p>
          <a class="bk-btn primary bp-rev-login-link" href="index.html">سجّل دخولك من «حسابي» وارجع تقيم</a>
        </div>`;
      return;
    }

    // عنده مراجعة مسجّلة وهو مش في وضع التعديل → بطاقة حالته
    if (!revFormOpen && myReview) {
      box.innerHTML = `
        <div class="bp-rev-mine ${esc(myReview.status)}">
          <div class="bp-rev-mine-head">
            <strong>${esc(MY_REVIEW_LABEL[myReview.status] || 'تقييمك مسجّل')}</strong>
            ${starsHtml(myReview.rating)}
          </div>
          ${myReview.comment ? '<p class="bp-rev-comment">' + esc(myReview.comment) + '</p>' : ''}
          ${myReview.admin_notes ? '<p class="bp-rev-note">رد الإدارة: ' + esc(myReview.admin_notes) + '</p>' : ''}
          <button type="button" class="bp-rev-edit" id="bp-rev-edit">تعديل تقييمي</button>
        </div>`;
      return;
    }

    if (!revFormOpen) {
      if (!revTableReady) { box.innerHTML = ''; return; }
      box.innerHTML = '<button type="button" class="bp-svc-more bp-rev-open" id="bp-rev-open">＋ أضّف تقييمك وتجربتك مع الصالون</button>';
      return;
    }

    box.innerHTML = `
      <div class="bp-rev-fields">
        ${revJustSent ? '<p class="bp-rev-ok">تم إرسال تقييمك للإدارة — هيظهر هنا بعد الاعتماد ✓</p>' : ''}
        <label class="bp-rev-label">تقييمك بالنجوم</label>
        <div class="bp-rev-pick" id="bp-rev-pick">
          ${starPickerHtml()}
          <span class="bp-rev-pick-num" id="bp-rev-pick-num">${revStarPick ? revStarPick + ' / 5' : 'اختَر عدد النجوم'}</span>
        </div>
        <label class="bp-rev-label" for="bp-rev-comment">تعليقك (اختياري)</label>
        <textarea id="bp-rev-comment" class="bp-rev-input" rows="3" maxlength="400" placeholder="مثال: قص ظريف والموعد اتلتزم بيه">${esc((myReview && myReview.comment) || '')}</textarea>
        <div class="bp-rev-error" id="bp-rev-error"></div>
        <div class="bk-actions">
          <button type="button" class="bk-btn secondary" id="bp-rev-cancel">إلغاء</button>
          <button type="button" class="bk-btn primary" id="bp-rev-send">إرسال للإدارة</button>
        </div>
        <p class="bp-rev-note">تقييمك بيروح للإدارة الأول وبعدين يظهر لكل الزوار. لو عدّلته بعد النشر بيرجع للمراجعة من أول.</p>
      </div>`;
  }

  function refreshStarPickUi() {
    document.querySelectorAll('#bp-rev-pick .bp-rev-star').forEach(el => {
      el.classList.toggle('on', Number(el.dataset.revStar) <= revStarPick);
    });
    const num = $('bp-rev-pick-num');
    if (num) num.textContent = revStarPick ? revStarPick + ' / 5' : 'اختَر عدد النجوم';
  }

  /* المعتمدة بس — ولو الجدول لسه ما اتعملش بنقفل التبويب بهدوء */
  async function loadReviews() {
    const list = $('bp-rev-list');
    if (!list) return;
    const c = supa();
    if (!c) { list.innerHTML = '<p class="bp-rev-empty">السحابة مقفولة دلوقتي — جرّب بعد شوية.</p>'; return; }
    list.innerHTML = '<p class="bp-rev-empty">جارِ تحميل التقييمات…</p>';
    const { data, error } = await c.rpc('provider_approved_reviews', {
      p_section: REV_SECTION, p_provider_id: String(barber.id)
    });
    if (error) {
      console.warn('[BarberPage] provider_approved_reviews:', error);
      revTableReady = false;
      revRows = [];
      list.innerHTML = '<p class="bp-rev-empty">التقييمات لسه متفعّلة في المشروع — شغّل <b>supabase/10-staff-requests-and-reviews.sql</b> في SQL Editor.</p>';
      renderReviewSummary();
      return;
    }
    revTableReady = true;
    revRows = data || [];
    renderReviewSummary();
    renderReviewsList();
  }

  /* مراجعة الحساب الحالي (أي حالة) — عشان الزرار ميتكررش */
  async function loadMyReview() {
    const c = supa();
    if (!c || !authUser || !revTableReady) { myReview = null; return; }
    const { data, error } = await c
      .from('provider_reviews')
      .select('id,rating,comment,status,admin_notes,created_at')
      .eq('section', REV_SECTION)
      .eq('provider_id', String(barber.id))
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (error) {
      console.warn('[BarberPage] my review:', error);
      myReview = null;
      return;
    }
    myReview = data || null;
  }

  async function submitReview() {
    const c = supa();
    if (!c) return revError('الاتصال بالسحابة مقفول دلوقتي — جرّب بعد شوية');
    if (!revStarPick) return revError('اختَر عدد النجوم الأول');
    const comment = ($('bp-rev-comment') ? $('bp-rev-comment').value : '').trim();
    const btn = $('bp-rev-send');
    if (btn) { btn.disabled = true; btn.textContent = 'جارِ الإرسال…'; }
    const { data, error } = await c.rpc('submit_provider_review', {
      p_section: REV_SECTION,
      p_provider_id: String(barber.id),
      p_rating: revStarPick,
      p_comment: comment || null
    });
    if (btn) { btn.disabled = false; btn.textContent = 'إرسال للإدارة'; }
    if (error) {
      console.warn('[BarberPage] submit_provider_review:', error);
      return revError(error.message || 'تعذر إرسال التقييم — جرّب تاني');
    }
    if (data && data.success === false) return revError(data.error || 'تعذر إرسال التقييم');
    myReview = { id: data && data.id, rating: revStarPick, comment, status: (data && data.status) || 'pending', admin_notes: null };
    revFormOpen = false;
    revJustSent = true;
    renderReviewForm();
    setTimeout(() => { revJustSent = false; }, 4000);
  }

  function onReviewClick(e) {
    const star = e.target.closest('[data-rev-star]');
    if (star) { revStarPick = Number(star.dataset.revStar) || 0; refreshStarPickUi(); revError(''); return; }
    if (e.target.closest('#bp-rev-open')) {
      revFormOpen = true; revStarPick = (myReview && myReview.rating) || 0;
      renderReviewForm();
      const ta = $('bp-rev-comment'); if (ta && myReview) ta.value = myReview.comment || '';
      return;
    }
    if (e.target.closest('#bp-rev-edit')) {
      revFormOpen = true; revStarPick = (myReview && myReview.rating) || 0;
      renderReviewForm();
      return;
    }
    if (e.target.closest('#bp-rev-cancel')) { revFormOpen = false; renderReviewForm(); return; }
    if (e.target.closest('#bp-rev-send')) { submitReview(); return; }
  }

  /* الدخول بيتم من المتجر (index.html) — هنا بنسمع تغيير الحالة بس */
  async function initReviews() {
    const c = supa();
    if (c) {
      try {
        const { data } = await c.auth.getSession();
        authUser = (data && data.session && data.session.user) || null;
      } catch (_) { authUser = null; }
      try {
        c.auth.onAuthStateChange((_event, session) => {
          authUser = (session && session.user) || null;
          revFormOpen = false;
          loadMyReview().then(renderReviewForm);
        });
      } catch (_) { /* النسخة القديمة من supabase-js */ }
    }
    await loadReviews();
    await loadMyReview();
    renderReviewSummary();
    renderReviewForm();
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

    // قايمة الخدمات: «المزيد» / «عرض أقل» لكل مجموعة (لو أكتر من 5 خدمات)
    $('bp-services-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-svc-more]');
      if (!btn) return;
      const key = btn.dataset.svcMore;
      if (openSvcGroups.has(key)) openSvcGroups.delete(key);
      else openSvcGroups.add(key);
      renderServicePanel();
    });

    // تقييمات الزوار: النجوم / فتح النموذج / الإرسال (تفويض — المحتوى بيتبني من JS)
    $('bp-rev-form')?.addEventListener('click', onReviewClick);
    $('bp-rev-list')?.addEventListener('click', (e) => {
      if (!e.target.closest('[data-rev-more]')) return;
      revOpenAll = !revOpenAll;
      renderReviewsList();
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

    renderMetaRow();
    renderTeamPanel();
    renderHoursPanel();
    renderLocationPanel();
    renderMediaPanels();
    renderHomePanel();
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
    initReviews();
    document.addEventListener('doddz:barber-data', onDataChanged);
  });
})();
