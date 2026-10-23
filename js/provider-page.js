// ================================================================
// DODDZ PROVIDER PAGE — صفحة النشاط المستقلة لـ(لمعها / انامل / كسبني)
// ----------------------------------------------------------------
// ملف واحد بيخدم ثلاث صفحات:
//   carwash.html   ?id=…   ← carwash_profiles   (لمعها)
//   handmade.html  ?id=…   ← handmade_profiles  (انامل)
//   merchant.html  ?id=…   ← merchant_profiles  (كسبني)
// الصفحة بتحدد القسم من <body data-provider-section="…">.
//
// * البيانات بتتقرا من SectionsStore (نفس مصدر كروت الرئيسية) — و SectionsStore
//   نفسه بيطبّق فلتر RLS: الزائر شايف النشاطات المعتمدة بس.
// * مفيش حجز في الأقسام دي: جدول barber_bookings مربوط بـbarber_profiles بس،
//   فبدل «احجز الآن» فيه «واتساب / اتصال».
// * التقييمات هي هي منطق صفحة الصالون بالظبط (provider_reviews +
//   provider_approved_reviews + submit_provider_review) — الدوال بتاعتها
//   عامة لكل الأقسام الأربعة، بنغيّر REV_SECTION بس.
// * مفيش أي قرار أمان في المتصفح: كل الصلاحيات في Supabase (RLS + SECURITY DEFINER).
// ================================================================
(function () {
  'use strict';

  const SECTIONS = {
    carwash:   { table: 'carwash_profiles',   label: 'لمعها', entity: 'مغسلة سيارات',   file: 'carwash.html',   homeWord: 'خدمة منزلية' },
    handmade:  { table: 'handmade_profiles',  label: 'انامل', entity: 'ورشة هاند ميد',  file: 'handmade.html',  homeWord: 'توصيل للبيت' },
    merchants: { table: 'merchant_profiles',  label: 'كسبني', entity: 'متجر',           file: 'merchant.html',  homeWord: 'توصيل للبيت' }
  };

  const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const SVC_PREVIEW = 5;
  const REV_PREVIEW = 3;

  // ── أدوات صغيرة ──────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(v) { return Number(v || 0).toLocaleString(); }

  function starsHtml(rating) {
    const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    let html = '<span class="bp-stars" aria-label="' + Number(rating || 0).toFixed(1) + '">';
    for (let i = 1; i <= 5; i++) html += '<span class="bp-star' + (i <= r ? ' on' : '') + '">★</span>';
    return html + '</span>';
  }

  // الأعمدة دي jsonb: ممكن توصل كائن أو نص JSON (حسب الكاش/النسخة)
  function obj(v) {
    if (v && typeof v === 'object') return v;
    if (typeof v === 'string' && v.trim()) {
      try { const p = JSON.parse(v); return (p && typeof p === 'object') ? p : {}; } catch (_) {}
    }
    return {};
  }
  function arr(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch (_) {}
    }
    return [];
  }

  function waLink(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    return 'https://wa.me/' + (digits.startsWith('0') ? '2' + digits : digits);
  }

  // ── تحديد القسم من الصفحة نفسها ─────────────────────────────
  function detectCode() {
    const fromBody = (document.body && document.body.dataset.providerSection) || '';
    if (SECTIONS[fromBody]) return fromBody;
    const file = (location.pathname.split('/').pop() || '').replace(/\.html?$/i, '').toLowerCase();
    if (SECTIONS[file]) return file;
    if (file === 'merchants') return 'merchants';
    const fromQuery = new URLSearchParams(location.search).get('section') || '';
    return SECTIONS[fromQuery] ? fromQuery : null;
  }

  const CODE = detectCode();
  const META = SECTIONS[CODE] || null;
  const PID  = (new URLSearchParams(location.search).get('id') || '').trim();

  let provider = null;   // الصف بعد التطبيع

  /* ================================================================
     قراءة النشاط: SectionsStore (نفس مصدر الرئيسية) → fallback مباشر
  ================================================================ */
  function normalize(row) {
    const hs = obj(row.home_service);
    return {
      id: String(row.id),
      name: row.name || META.entity,
      ownerName: row.owner_name || '',
      phone: row.phone || '',
      area: row.area || '',
      governorate: row.governorate || '',
      address: row.address || '',
      description: row.description || '',
      logoUrl: row.logo_url || '',
      coverUrl: row.cover_url || '',
      services: arr(row.services),
      home: {
        enabled: !!hs.enabled,
        areas: arr(hs.areas),
        travelFee: Number(hs.travelFee) || 0,
        extraFee: Number(hs.extraFee) || 0,
        note: hs.note || ''
      },
      hours: obj(row.hours),
      location: obj(row.location),
      workDays: arr(row.work_days).map(Number),
      workStart: Number(row.work_start),
      workEnd: Number(row.work_end),
      rating: Number(row.rating) || 0,
      reviewsCount: Number(row.reviews_count) || 0,
      featured: !!row.is_featured,
      status: row.status || '',
      cancelPolicy: row.cancel_policy || ''
    };
  }

  async function loadProvider() {
    if (!META || !PID) return null;

    // 1) SectionsStore: بيكون حمّل الجدول بالفعل للرئيسية + فيه كاش محلي
    try {
      if (window.SectionsStore && SectionsStore.whenReady) {
        await SectionsStore.whenReady();
        if (SectionsStore.approved) {
          const rows = await SectionsStore.approved(CODE);
          const hit = (rows || []).find(r => String(r.id) === PID);
          if (hit) return normalize(hit);
        }
        const all = SectionsStore.all ? await SectionsStore.all(CODE) : [];
        const any = (all || []).find(r => String(r.id) === PID);
        if (any && any.status === 'approved') return normalize(any);
        if (any) return null;              // موجود بس مش معتمد → نفس رسالة «مش موجود»
      }
    } catch (err) {
      console.warn('[ProviderPage] SectionsStore:', err);
    }

    // 2) fallback: قراءة الصف مباشرة (RLS بيرفض أي حاجة غير معتمدة للزائر)
    const c = window.supabaseClient;
    if (c) {
      try {
        const { data, error } = await c.from(META.table)
          .select('*').eq('id', PID).eq('status', 'approved').maybeSingle();
        if (!error && data) return normalize(data);
        if (error) console.warn('[ProviderPage] direct read:', error);
      } catch (err) { console.warn('[ProviderPage] direct read:', err); }
    }
    return null;
  }

  /* ================================================================
     المواعيد — hours jsonb لو معبّأ، وإلا work_days/work_start/work_end
  ================================================================ */
  function hoursForDay(day) {
    const keys = Object.keys(provider.hours || {});
    if (keys.length) {
      const d = provider.hours[String(day)] || provider.hours[day] || null;
      if (!d || d.open === false) return null;
      const from = Number(d.from), to = Number(d.to);
      if (Number.isFinite(from) && Number.isFinite(to)) return { from, to };
      return null;
    }
    if (!provider.workDays.length) return null;
    if (provider.workDays.indexOf(day) === -1) return null;
    if (!Number.isFinite(provider.workStart) || !Number.isFinite(provider.workEnd)) return null;
    return { from: provider.workStart, to: provider.workEnd };
  }

  function fmtHour(h) {
    const n = Number(h);
    if (!Number.isFinite(n)) return '';
    const hh = ((Math.round(n) % 24) + 24) % 24;
    const suffix = hh < 12 ? 'ص' : 'م';
    let d = hh % 12; if (d === 0) d = 12;
    return d + ' ' + suffix;
  }

  function dayLabel(day) {
    const range = hoursForDay(day);
    return range ? (fmtHour(range.from) + ' – ' + fmtHour(range.to)) : 'مغلق';
  }

  function areaText() {
    const pool = [provider.area, provider.governorate, provider.location.address,
                  provider.address, provider.home.areas[0]];
    for (const v of pool) { const s = String(v || '').trim(); if (s) return s; }
    return '';
  }

  /* ================================================================
     الرسم
  ================================================================ */
  function renderHeader() {
    const cover = $('bp-cover');
    if (cover) {
      if (provider.coverUrl) {
        cover.innerHTML = '<img class="bp-cover-img" src="' + esc(provider.coverUrl) + '" alt="' + esc(provider.name) + '"/>';
        cover.style.backgroundImage = '';
      } else {
        cover.innerHTML = '<span class="bp-cover-mark" aria-hidden="true">' + (CODE === 'carwash' ? '🚿' : CODE === 'handmade' ? '🧵' : '🛍️') + '</span>';
        cover.style.backgroundImage = '';
      }
    }
    const av = $('bp-avatar');
    if (av) {
      av.innerHTML = provider.logoUrl
        ? '<img src="' + esc(provider.logoUrl) + '" alt="' + esc(provider.name) + '"/>'
        : '<span class="bp-avatar-fallback">' + esc(String(provider.name || 'ن').trim().slice(0, 1)) + '</span>';
    }
    const nameEl = $('bp-name');
    if (nameEl) nameEl.textContent = provider.name;

    const area = $('bp-area');
    if (area) {
      const txt = areaText();
      area.textContent = txt ? '📍 ' + txt : '';
      area.hidden = !txt;
    }
    const today = $('bp-today');
    if (today) {
      const d = new Date().getDay();
      const open = hoursForDay(d);
      const hasAny = DAYS_AR.some((_, i) => !!hoursForDay(i));
      today.textContent = hasAny ? '🕘 اليوم ' + DAYS_AR[d] + ' · ' + dayLabel(d) : '';
      today.hidden = !hasAny;
    }
    const chip = $('bp-home-chip');
    if (chip) chip.hidden = !provider.home.enabled;

    const feat = $('bp-featured');
    if (feat) feat.hidden = !provider.featured;

    const bio = $('bp-bio');
    if (bio) { bio.textContent = provider.description || ''; bio.hidden = !provider.description; }

    const rating = $('bp-rating');
    if (rating) {
      rating.innerHTML = starsHtml(provider.rating) +
        '<span class="bp-rating-num">' + provider.rating.toFixed(1) + '</span>';
    }
    const rev = $('bp-reviews');
    if (rev) rev.textContent = provider.reviewsCount + ' تقييم';
    const svc = $('bp-services-count');
    if (svc) svc.textContent = provider.services.length + ' خدمات';

    // التواصل بدل الحجز
    const wa = $('bp-wa'), call = $('bp-call'), contact = $('bp-contact-panel');
    const waUrl = waLink(provider.phone);
    if (contact) contact.hidden = !provider.phone;
    if (wa) {
      if (waUrl) { wa.href = waUrl; wa.target = '_blank'; wa.rel = 'noopener'; wa.hidden = false; }
      else wa.hidden = true;
    }
    if (call) {
      if (provider.phone) { call.href = 'tel:' + esc(provider.phone); call.textContent = '📞 ' + provider.phone; call.hidden = false; }
      else call.hidden = true;
    }
    const owner = $('bp-owner');
    if (owner) {
      owner.textContent = provider.ownerName ? 'المسؤول: ' + provider.ownerName : '';
      owner.hidden = !provider.ownerName;
    }
    const backLink = $('bp-back-link');
    if (backLink) backLink.href = 'index.html?section=' + encodeURIComponent(CODE);
  }

  const openSvcGroups = new Set();

  function serviceRow(s) {
    const name = s.name || s.title || 'خدمة';
    const dur = Number(s.durationMin) || Number(s.duration_min) || 0;
    const price = Number(s.price) || 0;
    return `
      <div class="bp-service">
        <div>
          <div class="bp-service-name">${esc(name)}</div>
          <div class="bp-service-meta">${dur ? dur + ' دقيقة' : 'حسب الاتفاق'}${s.description ? ' · ' + esc(s.description) : ''}</div>
        </div>
        <div class="bp-service-price">${price ? money(price) + ' ج.م' : 'بسعر الخدمة'}</div>
      </div>`;
  }

  function serviceGroups() {
    const known = { hair: 'عناية بالشعر', beard: 'عناية بالذقن', skin: 'عناية بالبشرة', other: 'خدمات أخرى' };
    const order = [], buckets = {};
    provider.services.forEach(s => {
      const key = s.category && known[s.category] ? s.category : 'other';
      if (!buckets[key]) { buckets[key] = []; order.push(key); }
      buckets[key].push(s);
    });
    if (!order.length) return [];
    const preferred = ['hair', 'beard', 'skin', 'other'].filter(k => buckets[k]);
    const multi = preferred.length > 1 || (preferred[0] && preferred[0] !== 'other');
    return preferred.map(k => ({
      key: k,
      label: multi ? known[k] : 'الخدمات والأسعار',
      items: buckets[k]
    }));
  }

  function renderServices() {
    const list = $('bp-services-list');
    const panel = $('bp-services-panel');
    if (!list) return;
    const groups = serviceGroups();
    if (!groups.length) {
      if (panel) panel.hidden = true;
      list.innerHTML = '';
      return;
    }
    if (panel) panel.hidden = false;
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
            <div class="bp-svc-rest"${isOpen ? '' : ' hidden'}>${g.items.slice(SVC_PREVIEW).map(serviceRow).join('')}</div>
            <button type="button" class="bp-svc-more" data-svc-more="${esc(g.key)}" aria-expanded="${isOpen ? 'true' : 'false'}">
              ${isOpen ? 'عرض أقل' : 'المزيد (' + hiddenCount + ' خدمة)'}
              <span class="bp-svc-more-arrow" aria-hidden="true">${isOpen ? '▲' : '▼'}</span>
            </button>` : ''}
        </div>`;
    }).join('');
  }

  function renderHours() {
    const panel = $('bp-hours-panel'), box = $('bp-hours'),
          more = $('bp-hours-more'), week = $('bp-hours-week');
    if (!panel) return;
    const today = new Date().getDay();
    if (!DAYS_AR.some((_, i) => !!hoursForDay(i))) {
      panel.hidden = true;
      if (box) box.innerHTML = '';
      if (more) { more.hidden = true; if (week) week.innerHTML = ''; }
      return;
    }
    panel.hidden = false;
    const line = (day) => `
      <div class="bp-hour-line${day === today ? ' today' : ''}${hoursForDay(day) ? '' : ' closed'}">
        <span class="bp-hour-day">${esc(DAYS_AR[day])}${day === today ? ' <em class="bp-today-tag">اليوم</em>' : ''}</span>
        <span class="bp-hour-time">${esc(dayLabel(day))}</span>
      </div>`;
    if (box) {
      box.innerHTML = line(today) +
        '<div class="bp-hour-foot">المواعيد دي معلنة من صاحب النشاط — أي تغيير بيوصلك هنا مباشرة.</div>';
    }
    if (more && week) {
      week.innerHTML = DAYS_AR.map((_, i) => i).filter(i => i !== today).map(line).join('');
      more.hidden = false;
      more.open = false;
    }
  }

  function renderLocation() {
    const panel = $('bp-loc-panel');
    if (!panel) return;
    const loc = provider.location || {};
    const addr = loc.address || provider.address || areaText();
    const has = addr || loc.mapUrl || (loc.lat && loc.lng);
    if (!has) { panel.hidden = true; return; }
    panel.hidden = false;
    const a = $('bp-loc-address');
    if (a) a.textContent = addr || (loc.lat + ',' + loc.lng);
    const n = $('bp-loc-note');
    if (n) { n.textContent = loc.note || ''; n.hidden = !loc.note; }
    const link = $('bp-loc-map');
    if (link) {
      const url = loc.mapUrl || loc.map_url
        || (loc.lat && loc.lng
          ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loc.lat + ',' + loc.lng)
          : (addr ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr) : ''));
      link.hidden = !url;
      if (url) link.href = url;
    }
  }

  function renderHomeService() {
    const panel = $('bp-home-panel');
    if (!panel) return;
    if (!provider.home.enabled) { panel.hidden = true; return; }
    panel.hidden = false;
    const note = $('bp-home-note');
    if (note) {
      note.textContent = provider.home.note ||
        (CODE === 'carwash'
          ? 'المغسلة بتوصل لعندك في المناطق المتاحة — كل اللي عليك تختَر «خدمة منزلية» وقت التواصل.'
          : CODE === 'handmade'
            ? 'الورشة بتجهّز الشغل وتوصّله للبيت في المناطق المتاحة.'
            : 'المتجر بيوصّل الطلبات للبيت في المناطق المتاحة.');
    }
    const meta = $('bp-home-meta');
    if (meta) {
      const rows = [];
      if (provider.home.areas.length) rows.push('<div class="bp-stat">المناطق: ' + esc(provider.home.areas.join('، ')) + '</div>');
      if (provider.home.travelFee) rows.push('<div class="bp-stat">رسوم الانتقال: ' + money(provider.home.travelFee) + ' ج.م</div>');
      if (provider.home.extraFee) rows.push('<div class="bp-stat">رسوم إضافية: ' + money(provider.home.extraFee) + ' ج.م</div>');
      meta.innerHTML = rows.join('');
    }
  }

  function renderPolicy() {
    const panel = $('bp-policy-panel');
    const el = $('bp-policy');
    if (!panel || !el) return;
    if (!provider.cancelPolicy) { panel.hidden = true; el.textContent = ''; return; }
    panel.hidden = false;
    el.textContent = provider.cancelPolicy;
  }

  /* ── منتجات النشاط (تاجر/ورشة) — من products.provider_id ───── */
  async function renderProducts() {
    const panel = $('bp-products-panel'), box = $('bp-products');
    if (!panel || !box) return;
    const c = window.supabaseClient;
    if (!c) { panel.hidden = true; return; }
    panel.hidden = true;
    box.innerHTML = '';
    try {
      const { data, error } = await c.from('products')
        .select('id,name,price,old_price,primary_image,section,rating,reviews_count')
        .eq('provider_id', provider.id)
        .eq('status', 'approved')
        .order('is_best_seller', { ascending: false })
        .limit(12);
      if (error || !data || !data.length) return;
      panel.hidden = false;
      box.innerHTML = data.map(p => {
        const img = p.primary_image
          ? '<img src="' + esc(p.primary_image) + '" alt="" loading="lazy"/>'
          : '<span class="pv-prod-emoji" aria-hidden="true">📦</span>';
        const off = Number(p.old_price) > Number(p.price) && Number(p.price) > 0
          ? '<s class="pv-prod-was">' + money(p.old_price) + '</s>' : '';
        return `
          <a class="pv-prod" href="product.html?id=${encodeURIComponent(p.id)}">
            <span class="pv-prod-img">${img}</span>
            <span class="pv-prod-name">${esc(p.name)}</span>
            <span class="pv-prod-price">${money(p.price)} ج.م ${off}</span>
          </a>`;
      }).join('');
    } catch (err) {
      console.warn('[ProviderPage] products:', err);
    }
  }

  /* ================================================================
     تقييمات الزوار — نفس منطق صفحة الصالون، القسم بيتغيّر بس
  ================================================================ */
  let revRows = [], revOpenAll = false, revFormOpen = false,
      revStarPick = 0, revJustSent = false, revTableReady = true,
      authUser = null, myReview = null;

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

  function renderReviewSummary() {
    const el = $('bp-rev-summary');
    if (!el) return;
    const avg = Number(provider.rating || 0);
    const cnt = Math.max(Number(provider.reviewsCount || 0), revRows.length);
    if (!cnt) {
      el.innerHTML = '<span class="bp-rev-sum-empty">لسه مفيش تقييمات معتمدة لهذا النشاط.</span>';
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
      </div>`).join('') + (hidden ? `
      <button type="button" class="bp-svc-more bp-rev-more" data-rev-more aria-expanded="${revOpenAll ? 'true' : 'false'}">
        ${revOpenAll ? 'عرض أقل' : 'عرض كل التقييمات (' + revRows.length + ')'}
        <span class="bp-svc-more-arrow" aria-hidden="true">${revOpenAll ? '▲' : '▼'}</span>
      </button>` : '');
  }

  const MY_REVIEW_LABEL = {
    pending:  'تقييمك وصل — قيد مراجعة الإدارة',
    approved: 'تقييمك منشور ✓',
    rejected: 'تقييمك اترفض — تقدر تعدّله وتبعت تاني'
  };

  function starPickerHtml() {
    return [1, 2, 3, 4, 5].map(i =>
      '<button type="button" class="bp-rev-star' + (i <= revStarPick ? ' on' : '') +
      '" data-rev-star="' + i + '" aria-label="' + i + ' من 5">★</button>').join('');
  }

  function renderReviewForm() {
    const box = $('bp-rev-form');
    if (!box) return;

    if (!authUser) {
      box.innerHTML = `
        <div class="bp-rev-gate">
          <p class="bp-panel-note" style="margin:0 0 10px;">عشان نظهر تقييمات حقيقية بس، التقييم متاح للحسابات المسجّلة في Doddz Go.</p>
          <a class="bk-btn primary bp-rev-login-link" href="index.html">سجّل دخولك من «حسابي» وارجع تقيم</a>
        </div>`;
      return;
    }
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
      box.innerHTML = revTableReady
        ? '<button type="button" class="bp-svc-more bp-rev-open" id="bp-rev-open">＋ أضّف تقييمك وتجربتك مع النشاط</button>'
        : '';
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
        <textarea id="bp-rev-comment" class="bp-rev-input" rows="3" maxlength="400"
          placeholder="مثال: الشغل نظيف والمواعيد محترمة">${esc((myReview && myReview.comment) || '')}</textarea>
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

  async function loadReviews() {
    const list = $('bp-rev-list');
    if (!list) return;
    const c = supa();
    if (!c) { list.innerHTML = '<p class="bp-rev-empty">السحابة مقفولة دلوقتي — جرّب بعد شوية.</p>'; return; }
    list.innerHTML = '<p class="bp-rev-empty">جارِ تحميل التقييمات…</p>';
    const { data, error } = await c.rpc('provider_approved_reviews', {
      p_section: CODE, p_provider_id: provider.id
    });
    if (error) {
      console.warn('[ProviderPage] provider_approved_reviews:', error);
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

  async function loadMyReview() {
    const c = supa();
    if (!c || !authUser || !revTableReady) { myReview = null; return; }
    const { data, error } = await c.from('provider_reviews')
      .select('id,rating,comment,status,admin_notes,created_at')
      .eq('section', CODE)
      .eq('provider_id', provider.id)
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (error) { console.warn('[ProviderPage] my review:', error); myReview = null; return; }
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
      p_section: CODE, p_provider_id: provider.id, p_rating: revStarPick, p_comment: comment || null
    });
    if (btn) { btn.disabled = false; btn.textContent = 'إرسال للإدارة'; }
    if (error) {
      console.warn('[ProviderPage] submit_provider_review:', error);
      return revError(error.message || 'تعذر إرسال التقييم — جرّب تاني');
    }
    if (data && data.success === false) return revError(data.error || 'تعذر إرسال التقييم');
    myReview = { id: data && data.id, rating: revStarPick, comment, status: (data && data.status) || 'pending', admin_notes: null };
    revFormOpen = false;
    revJustSent = true;
    renderReviewForm();
    setTimeout(() => { revJustSent = false; }, 4000);
  }

  async function initReviews() {
    const c = supa();
    if (c) {
      try {
        const { data } = await c.auth.getSession();
        authUser = (data && data.session && data.session.user) || null;
      } catch (_) { authUser = null; }
      try {
        c.auth.onAuthStateChange((_e, session) => {
          authUser = (session && session.user) || null;
          revFormOpen = false;
          loadMyReview().then(renderReviewForm);
        });
      } catch (_) { /* نسخة قديمة من supabase-js */ }
    }
    await loadReviews();
    await loadMyReview();
    renderReviewSummary();
    renderReviewForm();
  }

  /* ================================================================
     الأحداث + التشغيل
  ================================================================ */
  function wire() {
    document.addEventListener('click', (e) => {
      const more = e.target.closest('[data-svc-more]');
      if (more) {
        const key = more.dataset.svcMore;
        if (openSvcGroups.has(key)) openSvcGroups.delete(key); else openSvcGroups.add(key);
        renderServices();
        return;
      }
      const star = e.target.closest('[data-rev-star]');
      if (star) { revStarPick = Number(star.dataset.revStar) || 0; refreshStarPickUi(); revError(''); return; }
      if (e.target.closest('#bp-rev-open') || e.target.closest('#bp-rev-edit')) {
        revFormOpen = true;
        revStarPick = (myReview && myReview.rating) || 0;
        renderReviewForm();
        return;
      }
      if (e.target.closest('#bp-rev-cancel')) { revFormOpen = false; renderReviewForm(); return; }
      if (e.target.closest('#bp-rev-send')) { submitReview(); return; }
      if (e.target.closest('[data-rev-more]')) { revOpenAll = !revOpenAll; renderReviewsList(); return; }
    });
  }

  function showNotFound() {
    const nf = $('pv-not-found');
    if (nf) {
      nf.hidden = false;
      nf.textContent = META
        ? 'النشاط غير موجود أو غير معتمد للعرض.'
        : 'الصفحة دي مخصوصة لأقسام لمعها / انامل / كسبني.';
    }
    const back = $('bp-back-link');
    if (back) back.href = 'index.html';
  }

  async function boot() {
    wire();
    if (!META || !PID) { showNotFound(); return; }
    provider = await loadProvider();
    if (!provider) { showNotFound(); return; }

    document.title = provider.name + ' — ' + META.label + ' | Doddz Go';
    const crumb = $('bp-crumb');
    if (crumb) crumb.textContent = META.label;
    const content = $('pv-content');
    if (content) content.hidden = false;

    renderHeader();
    renderServices();
    renderHours();
    renderLocation();
    renderHomeService();
    renderPolicy();
    renderProducts();
    initReviews();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
