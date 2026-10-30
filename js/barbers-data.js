// ================================================================
// BarberStore — P0 listing/profile + P1 bookings (local + optional Supabase)
// Status: pending | approved | rejected — only approved shown to customers
// Phase 1 (2026-10-13): فريق المحل + ألبوم الصور + مواعيد كل يوم + اللوكيشن
//                        + حجز بأكتر من خدمة واختيار الفني
// ================================================================
const BarberStore = (() => {
  const STORAGE_BARBERS = 'doddz_barbers_v2';
  const STORAGE_BOOKINGS = 'doddz_barber_bookings_v1';
  const STORAGE_TEAM = 'doddz_barber_team_v1';
  const STORAGE_MEDIA = 'doddz_barber_media_v1';

  // مواعيد أسبوعية بصيغة hours jsonb — للـSEED المحلي (احتياطي أوفلاين)
  function _seedHours(openDays, from, to) {
    const h = {};
    for (let d = 0; d < 7; d++) h[String(d)] = { open: openDays.includes(d), from, to };
    return h;
  }

  const MAX_TEAM = 12;      // نفس السقف في supabase/08-barber-team-booking.sql
  const MAX_GALLERY = 20;   // صور الألبوم (غير الكفر والبروفيل)
  const MAX_SAMPLES = 20;   // صور العينات

  const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  // قايمة خدمات جاهزة يدي عليها صاحب الصالون بضغطة، و يعدّل سعرها ومدتها.
  // category للحاجة التانية (تقسيم الخدمات: شعر / بشرة / عناية).
  const SERVICE_PRESETS = [
    { key: 'hair', label: 'عناية بالشعر', items: [
      { name: 'قص شعر', durationMin: 30, price: 120 },
      { name: 'قص شعر بالماكينة', durationMin: 20, price: 90 },
      { name: 'شعر + ذقن', durationMin: 45, price: 180 },
      { name: 'استشوار', durationMin: 25, price: 90 },
      { name: 'حلاقة أطفال', durationMin: 25, price: 90 },
      { name: 'غسول وشطف', durationMin: 20, price: 70 },
      { name: 'صبغ كولوني', durationMin: 30, price: 150 }
    ]},
    { key: 'beard', label: 'عناية بالذقن', items: [
      { name: 'تهذيب ذقن', durationMin: 20, price: 80 },
      { name: 'ذقن ملكي بالموس', durationMin: 30, price: 120 },
      { name: 'زيت وعناية باللحية', durationMin: 20, price: 100 }
    ]},
    { key: 'skin', label: 'عناية بالبشرة', items: [
      { name: 'تنظيف بشرة', durationMin: 40, price: 160 },
      { name: 'بخار وماسك وجه', durationMin: 30, price: 130 },
      { name: 'تقشير', durationMin: 30, price: 140 },
      { name: 'إزالة شعر بالشمع', durationMin: 25, price: 110 }
    ]}
  ];

  // «قصها» بتتغذى من Supabase بس (barber_profiles) — مفيش قايمة تجريبية جاهزة.
  // المحلات التجريبية (barber_01..barber_04) اتشالت من القاعدة ومن كاش الجهاز
  // (شوف supabase/13-remove-demo-data.sql).
  const SEED = [];

  // معرّفات قديمة كانت تجريبية ولسه مخزّنة في كاش أجهزة فتحت الموقع قبل كده —
  // بتنمسح من الكاش أول ما الصفحة تتفتح عشان ما ترجّعش محلات اتقفلت.
  // (نفس اللي في supabase/13-remove-demo-data.sql — سيب بس صالون بشري)
  const RETIRED_IDS = [
    'barber_01', 'barber_02', 'barber_03', 'barber_04',
    'srv_f7d9de9b32b946a0a72600d3f7d75c07'   // صالون قصها التجريبي
  ];

  let barbers = [];
  let bookings = [];
  let team = [];   // صفوف barber_team (كل الحلاقين)
  let media = [];  // صفوف barber_media (gallery / sample)

  function clampInt(v, min, max, fallback) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  /** مواعيد يوم واحد من الأعمدة القديمة (workDays / workStart / workEnd) */
  function _legacyDayHours(b, day) {
    const days = Array.isArray(b.workDays) ? b.workDays : [0, 1, 2, 3, 4, 5, 6];
    return {
      open: days.includes(day),
      from: clampInt(b.workStart, 0, 23, 10),
      to: clampInt(b.workEnd, 1, 24, 21)
    };
  }

  /**
   * مواعيد يوم — الـhours jsonb هو المصدر الأساسي:
   *   {"0":{"open":true,"from":10,"to":22}, ...}  (0 = الأحد)
   * و لو اليوم مش موجود فيه (بيانات قديمة) نرجع للأعمدة القديمة.
   */
  function dayHours(b, day) {
    if (!b) return { open: false, from: 10, to: 21 };
    const raw = b.hours && typeof b.hours === 'object' && !Array.isArray(b.hours) ? b.hours : null;
    const v = raw ? raw[String(day)] : null;
    if (!v || typeof v !== 'object') return _legacyDayHours(b, day);
    const from = clampInt(v.from, 0, 23, 10);
    let to = clampInt(v.to, 1, 24, 21);
    if (to <= from) to = Math.min(24, from + 1);
    return { open: !!v.open, from, to };
  }

  /** شكل موحّد لـ7 أيام — للوحة الحلاق وصفحة الصالون */
  function hoursView(b) {
    return DAYS_AR.map((label, i) => ({
      day: i,
      label,
      open: dayHours(b, i).open,
      from: dayHours(b, i).from,
      to: dayHours(b, i).to
    }));
  }

  function normalizeLocation(raw) {
    const l = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
      address: String(l.address || '').trim(),
      lat: l.lat === '' || l.lat == null ? '' : String(l.lat),
      lng: l.lng === '' || l.lng == null ? '' : String(l.lng),
      // في القاعدة possible map_url — بنقبلك الاتنين
      mapUrl: String(l.mapUrl || l.map_url || '').trim(),
      note: String(l.note || '').trim()
    };
  }

  /**
   * تصنيف الخدمة بالحرفة. لو الصف جاي من السحابة بدون category (الخدمات القديمة)
   * بنحاول نستنتجها من الاسم أو من قايمة الخدمات الجاهزة، والباقي 'other'.
   */
  function inferServiceCategory(name) {
    const n = String(name || '').toLowerCase().trim();
    if (!n) return 'other';
    const preset = SERVICE_PRESETS.find(g => g.items.some(it => String(it.name).trim().toLowerCase() === n));
    if (preset) return preset.key;
    if (/(بشرة|ماسك|بخار|تقشير|شمع|بوميس|فيلر|كير|cure|skin|facial)/.test(n)) return 'skin';
    if (/(ذقن|لحية|بيارد|beard|شارب|mus|مواس)/.test(n)) return 'beard';
    if (/(شعر|قص|حلاقة|حلاق|استشوار|سيشوار|صبغ|كولوني|ماكينة|fade|haircut|cuts|ستايل|تصفيف|kids|اطفال)/.test(n)) return 'hair';
    return 'other';
  }

  function normalizeBarber(b) {
    if (!b || typeof b !== 'object') return b;
    if (!b.homeService || typeof b.homeService !== 'object') {
      b.homeService = {
        enabled: false,
        areas: [],
        travelFee: 0,
        extraFee: 0,
        note: ''
      };
    } else {
      b.homeService.enabled = !!b.homeService.enabled;
      b.homeService.areas = Array.isArray(b.homeService.areas) ? b.homeService.areas : [];
      b.homeService.travelFee = Number(b.homeService.travelFee) || 0;
      b.homeService.extraFee = Number(b.homeService.extraFee) || 0;
      b.homeService.note = b.homeService.note || '';
    }
    b.avatarUrl = b.avatarUrl || '';
    b.coverUrl = b.coverUrl || '';
    if (b.avatar && String(b.avatar).startsWith('http') && !b.avatarUrl) b.avatarUrl = b.avatar;
    if (!b.hours || typeof b.hours !== 'object' || Array.isArray(b.hours)) b.hours = {};
    b.location = normalizeLocation(b.location);
    // الصفوف القديمة في barber_profiles اتسجلت قبل ما نضيف category — نستنتجها هنا
    if (Array.isArray(b.services)) {
      b.services.forEach(s => {
        if (s && typeof s === 'object' && !String(s.category || '').trim()) {
          s.category = inferServiceCategory(s.name);
        }
      });
    }
    return b;
  }

  /**
   * أول مرة على جهاز جديد (أو أوفلاين): الفريق جه من الـSEED المحلي،
   * عشان صفحة الصالون/Hجز يبان فيهم اختيار الفني من غير ما يكون الجدول اتشغّل.
   * أول ما السحابة ترجع، refreshTeam() بتستبدل الكاش بصفوف barber_team الحقيقية.
   */
  function _seedTeamFromCatalog() {
    const out = [];
    SEED.forEach(b => {
      (b.team || []).forEach((m, i) => {
        out.push({
          id: m.id || ('tmr_' + b.id + '_' + i),
          profileId: String(b.id),
          name: m.name || b.name,
          title: m.title || 'صاحب الصالون',
          photoUrl: m.photoUrl || '',
          isOwner: !!m.isOwner,
          active: m.active !== false,
          sortOrder: Number.isFinite(Number(m.sortOrder)) ? Number(m.sortOrder) : i
        });
      });
      delete b.team;
    });
    return out;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_BARBERS);
      barbers = raw ? JSON.parse(raw) : null;
    } catch { barbers = null; }
    // كنّا بنخطّط محلات تجريبية في الكاش — بتتمسح أول ما الصفحة تتفتح
    if (Array.isArray(barbers)) {
      barbers = barbers.filter(b => b && RETIRED_IDS.indexOf(String(b.id)) === -1);
    }
    if (!Array.isArray(barbers) || !barbers.length) {
      barbers = JSON.parse(JSON.stringify(SEED));
      persistBarbers();
    } else {
      // ترقية البيانات القديمة + دمج homeService من الـ seed لو ناقص
      const seedMap = Object.fromEntries(SEED.map(s => [s.id, s]));
      barbers = barbers.map(b => {
        normalizeBarber(b);
        const seed = seedMap[b.id];
        if (seed && seed.homeService && (b.homeService.enabled === false && !b.homeService.areas.length)) {
          if (seed.homeService.enabled) b.homeService = JSON.parse(JSON.stringify(seed.homeService));
        }
        return b;
      });
      persistBarbers();
    }
    try {
      const rawB = localStorage.getItem(STORAGE_BOOKINGS);
      bookings = rawB ? JSON.parse(rawB) : [];
    } catch { bookings = []; }
    try {
      const rawT = localStorage.getItem(STORAGE_TEAM);
      team = rawT ? JSON.parse(rawT) : [];
    } catch { team = []; }
    try {
      const rawM = localStorage.getItem(STORAGE_MEDIA);
      media = rawM ? JSON.parse(rawM) : [];
    } catch { media = []; }
    if (!Array.isArray(team)) team = [];
    team = team.filter(m => m && RETIRED_IDS.indexOf(String(m.profileId)) === -1);
    if (!Array.isArray(media)) media = [];
    // أول تشغيل: فريق من الـSEED المحلي (فاضي دلوقتي — barber_team هو المصدر)
    if (!team.length) {
      team = _seedTeamFromCatalog();
      persistTeam();
      barbers.forEach(b => { if (b && b.team) delete b.team; });
      persistBarbers();
    }
    // كتالوج «قصها» من Supabase (barber_profiles) → حالات barber_status القديمة
    // → إعادة رسم. لو الجدول لسه مترفعش، الـSEED المحلي يفضل شغال.
    syncCatalogFromSupabase().then(() => pullBarberStatuses()).then(() => {
      try {
        if (typeof renderBarbersSection === 'function') renderBarbersSection();
      } catch (_) {}
    });
    // فريق المحل وألبوم الصور — سحب خفيف، والصفحة بتطلب اللي محتاجه بالـid
    refreshTeam();
    refreshMedia();
    // مزامنة الحجوزات من السحابة — بتشتغل بس لو فيه جلسة مسجّلة (أدمن/حلاق)
    refreshBookings();
  }

  function persistBarbers() {
    localStorage.setItem(STORAGE_BARBERS, JSON.stringify(barbers));
  }
  function persistBookings() {
    localStorage.setItem(STORAGE_BOOKINGS, JSON.stringify(bookings));
  }
  function persistTeam() {
    localStorage.setItem(STORAGE_TEAM, JSON.stringify(team));
  }
  function persistMedia() {
    localStorage.setItem(STORAGE_MEDIA, JSON.stringify(media));
  }

  function getAll() { return barbers.slice(); }
  function getApproved() {
    return barbers.filter(b => b.status === 'approved');
  }
  function getPending() {
    return barbers.filter(b => b.status === 'pending');
  }
  function getById(id) {
    return barbers.find(b => b.id === id) || null;
  }
  function getFeatured() {
    return getApproved().filter(b => b.isFeatured);
  }

  // ================================================================
  // كتالوج الحلاقين من Supabase — جدول barber_profiles (قسم «قصها»)
  //   قبل كده القائمة كانت localStorage بس، فحلاق جديد من جهاز الأدمن
  //   ما يوصلش للعميل. دلوقتي القاعدة هي المصدر الوحيد (الـSEED بقى فاضي).
  // ================================================================
  const BARBER_TABLE = 'barber_profiles';

  function _rowToBarber(r) {
    const b = {
      id: r.id,
      userId: r.user_id || '',
      name: r.name || '',
      area: r.area || '',
      governorate: r.governorate || '',
      bio: r.bio || r.description || '',
      phone: r.phone || '',
      avatar: '',
      avatarUrl: r.avatar_url || r.logo_url || '',
      coverUrl: r.cover_url || '',
      rating: Number(r.rating || 0),
      reviewsCount: Number(r.reviews_count || 0),
      isFeatured: !!r.is_featured,
      status: r.status || 'pending',
      workDays: Array.isArray(r.work_days) ? r.work_days : [0, 1, 2, 3, 4, 5, 6],
      workStart: Number(r.work_start != null ? r.work_start : 10),
      workEnd: Number(r.work_end != null ? r.work_end : 22),
      slotMinutes: Number(r.slot_minutes != null ? r.slot_minutes : 30),
      cancelPolicy: r.cancel_policy || '',
      hours: r.hours && typeof r.hours === 'object' && !Array.isArray(r.hours) ? r.hours : {},
      location: normalizeLocation(r.location),
      services: Array.isArray(r.services) ? r.services : []
    };
    if (r.home_service && typeof r.home_service === 'object' && !Array.isArray(r.home_service)) {
      b.homeService = r.home_service;
    }
    return normalizeBarber(b);
  }

  /** يسحب أنشطة «قصها» من Supabase ويادمجها في القائمة المحلية */
  async function syncCatalogFromSupabase() {
    const client = getSupabase();
    if (!client) return { ok: false, count: 0, error: 'لا يوجد اتصال' };
    try {
      const { data, error } = await client.from(BARBER_TABLE)
        .select('*')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(300);
      if (error) return { ok: false, count: 0, error: error.message };
      const rows = data || [];
      if (!rows.length) return { ok: true, count: 0, changed: 0 };
      let changed = 0;
      rows.forEach((r) => {
        const nb = _rowToBarber(r);
        const i = barbers.findIndex(b => String(b.id) === String(nb.id));
        if (i === -1) { barbers.push(nb); changed++; return; }
        const keep = barbers[i];
        // القاعدة بتغلب على المحلي في البيانات العامة، والحسابات المحلية تتورّث
        barbers[i] = {
          ...keep,
          ...nb,
          services: nb.services.length ? nb.services : (keep.services || []),
          homeService: (r.home_service && Object.keys(r.home_service).length) ? nb.homeService : keep.homeService,
          hours: (r.hours && Object.keys(r.hours).length) ? nb.hours : (keep.hours || {}),
          location: (r.location && Object.keys(r.location).length) ? nb.location : (keep.location || nb.location)
        };
        normalizeBarber(barbers[i]);
        changed++;
      });
      if (changed) {
        persistBarbers();
        try { if (typeof renderBarbersSection === 'function') renderBarbersSection(); } catch (_) {}
        // صفحة الصالون/lوحة الحلاق يسمعوا الخبر ويعيدوا الرسم ببيانات القاعدة
        announce('catalog', null);
      }
      return { ok: true, count: rows.length, changed };
    } catch (err) {
      return { ok: false, count: 0, error: err?.message || String(err) };
    }
  }

  /** حفظ تعديلات الحلاق (خدمات / خدمة منزلية / مواعيد) في جدول القسم */
  async function pushCatalogField(barberId, fields) {
    const client = getSupabase();
    if (!client) return { ok: false, error: 'لا يوجد اتصال' };
    const patch = {};
    if (fields.services !== undefined) patch.services = fields.services;
    if (fields.homeService !== undefined) patch.home_service = fields.homeService;
    if (fields.workDays !== undefined) patch.work_days = fields.workDays;
    if (fields.workStart !== undefined) patch.work_start = fields.workStart;
    if (fields.workEnd !== undefined) patch.work_end = fields.workEnd;
    if (fields.slotMinutes !== undefined) patch.slot_minutes = fields.slotMinutes;
    if (fields.cancelPolicy !== undefined) patch.cancel_policy = fields.cancelPolicy;
    if (fields.hours !== undefined) patch.hours = fields.hours;
    if (fields.location !== undefined) patch.location = fields.location;
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.area !== undefined) patch.area = fields.area;
    if (fields.bio !== undefined) patch.bio = fields.bio;
    if (fields.phone !== undefined) patch.phone = fields.phone;
    if (fields.avatarUrl !== undefined) patch.avatar_url = fields.avatarUrl;
    if (fields.coverUrl !== undefined) patch.cover_url = fields.coverUrl;
    patch.updated_at = new Date().toISOString();
    if (Object.keys(patch).length <= 1) return { ok: true, skipped: true };
    try {
      const { error } = await client.from(BARBER_TABLE).update(patch).eq('id', String(barberId));
      if (error) return { ok: false, error: error.message };
      await syncCatalogFromSupabase();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  function setStatus(id, status) {
    const b = getById(id);
    if (!b) return { success: false, error: 'غير موجود' };
    b.status = status;
    persistBarbers();
    // مزامنة للحالة على السحابة عشان الموبايل وأي جهاز تاني
    pushBarberStatus(id, status);
    return { success: true, barber: b };
  }

  function getSupabase() {
    return window.supabaseClient || null;
  }

  async function pushBarberStatus(barberId, status) {
    const client = getSupabase();
    if (!client) return;
    try {
      const { error } = await client.from('barber_status').upsert([{
        barber_id: String(barberId),
        status: String(status),
        updated_at: new Date().toISOString()
      }], { onConflict: 'barber_id' });
      if (error) console.warn('[Barbers] cloud status push:', error.message || error);
    } catch (e) {
      console.warn('[Barbers] cloud status push failed', e);
    }
  }

  async function pullBarberStatuses() {
    const client = getSupabase();
    if (!client) return;
    try {
      const { data, error } = await client.from('barber_status').select('barber_id,status');
      if (error) {
        console.warn('[Barbers] cloud status pull:', error.message || error);
        return;
      }
      if (!Array.isArray(data) || !data.length) return;
      let changed = false;
      data.forEach(row => {
        const b = barbers.find(x => String(x.id) === String(row.barber_id));
        if (b && row.status && b.status !== row.status) {
          b.status = row.status;
          changed = true;
        }
      });
      if (changed) persistBarbers();
    } catch (e) {
      console.warn('[Barbers] cloud status pull failed', e);
    }
  }

  // ================================================================
  // فريق المحل + ألبوم الصور + مواعيد الأيام + اللوكيشن
  //   الجداول: barber_team / barber_media (شوف supabase/08-barber-team-booking.sql)
  //   الصور نفسها على Storage (js/media-upload.js) — هنا بنخزن الرابط بس.
  //   الكاش المحلي (localStorage) يخلي الصفحة تفتح أوفلاين، والقاعدة هي المصدر.
  // ================================================================
  const TEAM_TABLE = 'barber_team';
  const MEDIA_TABLE = 'barber_media';

  function _newId(prefix) {
    return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  /** أي شاشة تانية (صفحة الصالون / لوحة الحلاق) تعيد رسم نفسها بعد تغيير */
  function announce(kind, profileId) {
    try {
      document.dispatchEvent(new CustomEvent('doddz:barber-data', {
        detail: { kind, profileId: String(profileId || '') }
      }));
    } catch (_) {}
  }

  /** رسائل القاعدة بالعربي — التريجرات بيرموا رسائل عربية جاهزة */
  function _dbError(error, fallback) {
    const msg = String(error?.message || error || '');
    if (error?.code === '23505') return 'فيه سجل مطابق دلوقتي — حدّث الصفحة واختار تاني';
    if (/row-level security|permission denied|not authorized/i.test(msg)) {
      return 'لازم تكون مسجّل دخول بحساب صاحب الصالون';
    }
    if (/failed to fetch|networkerror/i.test(msg)) return 'تعذر الاتصال بالإنترنت، جرّب تاني';
    return msg || fallback;
  }

  function _rowToMember(r) {
    return {
      id: String(r.id),
      profileId: String(r.profile_id),
      name: r.name || '',
      title: r.title || '',
      photoUrl: r.photo_url || '',
      isOwner: !!r.is_owner,
      active: r.active !== false,
      sortOrder: Number(r.sort_order) || 0
    };
  }

  function _memberToRow(m) {
    return {
      id: m.id,
      profile_id: m.profileId,
      name: m.name,
      title: m.title || null,
      photo_url: m.photoUrl || null,
      is_owner: !!m.isOwner,
      active: m.active !== false,
      sort_order: Number(m.sortOrder) || 0,
      updated_at: new Date().toISOString()
    };
  }

  function _rowToMedia(r) {
    return {
      id: String(r.id),
      profileId: String(r.profile_id),
      kind: r.kind === 'sample' ? 'sample' : 'gallery',
      url: r.url || '',
      caption: r.caption || '',
      active: r.active !== false,
      sortOrder: Number(r.sort_order) || 0
    };
  }

  function _mediaToRow(x) {
    return {
      id: x.id,
      profile_id: x.profileId,
      kind: x.kind === 'sample' ? 'sample' : 'gallery',
      url: x.url,
      caption: x.caption || null,
      active: x.active !== false,
      sort_order: Number(x.sortOrder) || 0,
      updated_at: new Date().toISOString()
    };
  }

  /** سحب الفريق — بالكلي أو لصالون واحد؛ بيرجّع الكاش لو مفيش اتصال */
  async function refreshTeam(profileId) {
    const client = getSupabase();
    if (!client) return getTeam(profileId, true);
    try {
      let q = client.from(TEAM_TABLE)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(500);
      if (profileId) q = q.eq('profile_id', String(profileId));
      const { data, error } = await q;
      if (error) {
        console.warn('[Barbers] team pull:', error.message || error);
        return getTeam(profileId, true);
      }
      const rows = (data || []).map(_rowToMember);
      if (profileId) {
        const pid = String(profileId);
        team = team.filter(t => String(t.profileId) !== pid).concat(rows);
      } else {
        team = rows;
      }
      persistTeam();
      announce('team', profileId);
    } catch (e) {
      console.warn('[Barbers] team pull failed', e);
    }
    return getTeam(profileId, true);
  }

  /** الفريق المخزّن لصالون — المرشّح للمالك بيشمل المتوقف */
  function getTeam(profileId, includeInactive) {
    const list = profileId
      ? team.filter(t => String(t.profileId) === String(profileId))
      : team.slice();
    const visible = includeInactive ? list : list.filter(t => t.active !== false);
    return visible
      .slice()
      .sort((a, b) => (a.isOwner === b.isOwner
        ? ((Number(a.sortOrder) - Number(b.sortOrder)) || String(a.name).localeCompare(String(b.name), 'ar'))
        : (a.isOwner ? -1 : 1)));
  }

  /** للعرض: لو لسه مفيش صفوف في القاعدة، صاحب الصالون نفسه هو الفريق */
  function teamForRender(profileId) {
    const list = getTeam(profileId);
    if (list.length) return list;
    const b = getById(profileId);
    if (!b) return [];
    return [{
      id: '',
      profileId: String(profileId),
      name: b.name,
      title: 'صاحب الصالون',
      photoUrl: b.avatarUrl || '',
      isOwner: true,
      active: true,
      sortOrder: 0,
      synthetic: true
    }];
  }

  /** صانع القرار في الحجز: فريق فيه حد؟ (غير مالك الواحد ما يحتاجش يختار فني) */
  function hasTeamChoice(profileId) {
    return getTeam(profileId).length >= 2;
  }

  /** إضافة / تعديل عضو — الكتابة للقاعدة أولًا عشان الكاش ما يكذبش */
  async function saveTeamMember(profileId, member) {
    const pid = String(profileId || '');
    const b = getById(pid);
    if (!b) return { success: false, error: 'الصالون غير موجود' };

    const name = String(member?.name || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 40) {
      return { success: false, error: 'اسم العضو لازم يكون من ٢ لـ٤٠ حرف' };
    }
    const idx = member?.id ? team.findIndex(t => String(t.id) === String(member.id) && String(t.profileId) === pid) : -1;
    const isNew = idx === -1;
    if (isNew && getTeam(pid, true).length >= MAX_TEAM) {
      return { success: false, error: 'الفريق اكتمل — الحد الأقصى ' + MAX_TEAM + ' أعضاء' };
    }

    const m = {
      id: member?.id || _newId('tmr_'),
      profileId: pid,
      name,
      title: String(member?.title || '').trim().slice(0, 40),
      photoUrl: String(member?.photoUrl || '').trim(),
      isOwner: !!member?.isOwner,
      active: member?.active !== false,
      sortOrder: Number.isFinite(Number(member?.sortOrder)) ? Number(member.sortOrder) : (isNew ? getTeam(pid, true).length : 0)
    };

    const client = getSupabase();
    if (!client) {
      // أوفلاين: نخزّن محليًا ونقول للمستخدم إن ده كاش بس
      if (isNew) team.push(m); else team[idx] = { ...team[idx], ...m };
      if (m.isOwner) team.forEach(t => { if (String(t.profileId) === pid && t.id !== m.id) t.isOwner = false; });
      persistTeam();
      announce('team', pid);
      return { success: true, member: m, offline: true };
    }

    try {
      // صاحب واحد بس لكل صالون (فهرس فريد في القاعدة) — ننزّل القديم الأول
      const prevOwner = m.isOwner
        ? team.find(t => String(t.profileId) === pid && t.isOwner && String(t.id) !== String(m.id))
        : null;
      if (prevOwner) {
        const { error: e2 } = await client.from(TEAM_TABLE)
          .update({ is_owner: false, updated_at: new Date().toISOString() })
          .eq('profile_id', pid).eq('id', prevOwner.id);
        if (e2) return { success: false, error: _dbError(e2, 'تعذر نقل ملكية الفريق') };
      }

      const row = _memberToRow(m);
      if (isNew) {
        const { error } = await client.from(TEAM_TABLE).insert([row]);
        if (error) return { success: false, error: _dbError(error, 'تعذر إضافة العضو') };
      } else {
        const { data, error } = await client.from(TEAM_TABLE).update(row).eq('id', m.id).select('id');
        if (error) return { success: false, error: _dbError(error, 'تعذر تعديل العضو') };
        if (!data || !data.length) {
          // العضو موجود في الكاش بس (اتعمل أوفلاين) — نرفعه للقاعدة
          const { error: e3 } = await client.from(TEAM_TABLE).insert([row]);
          if (e3) return { success: false, error: _dbError(e3, 'تعذر رفع العضو للسحابة') };
        }
      }
      if (prevOwner) {
        const po = team.find(t => String(t.id) === String(prevOwner.id));
        if (po) po.isOwner = false;
      }
      await refreshTeam(pid);
      return { success: true, member: m };
    } catch (err) {
      return { success: false, error: _dbError(err, 'تعذر حفظ عضو الفريق') };
    }
  }

  /** حذف عضو — الحذف الحقيقي متاح لمالك النشاط في سياسة RLS */
  async function deleteTeamMember(id) {
    const row = team.find(t => String(t.id) === String(id));
    const client = getSupabase();
    if (client) {
      try {
        const { error } = await client.from(TEAM_TABLE).delete().eq('id', String(id));
        if (error) return { success: false, error: _dbError(error, 'تعذر حذف العضو') };
      } catch (err) {
        return { success: false, error: _dbError(err, 'تعذر حذف العضو') };
      }
    }
    team = team.filter(t => String(t.id) !== String(id));
    persistTeam();
    announce('team', row?.profileId);
    return { success: true };
  }

  /** ترتيب أعضاء الفريق (السحب/الفل) — بنكتب sort_order بس */
  async function reorderTeam(profileId, orderedIds) {
    const pid = String(profileId || '');
    const ids = (orderedIds || []).map(String);
    team.forEach(t => {
      if (String(t.profileId) === pid) {
        const i = ids.indexOf(String(t.id));
        t.sortOrder = i === -1 ? 999 : i;
      }
    });
    persistTeam();
    announce('team', pid);
    const client = getSupabase();
    if (!client) return { success: true, offline: true };
    try {
      for (let i = 0; i < ids.length; i++) {
        const { error } = await client.from(TEAM_TABLE)
          .update({ sort_order: i, updated_at: new Date().toISOString() })
          .eq('profile_id', pid).eq('id', ids[i]);
        if (error) return { success: false, error: _dbError(error, 'تعذر ترتيب الفريق') };
      }
      await refreshTeam(pid);
      return { success: true };
    } catch (err) {
      return { success: false, error: _dbError(err, 'تعذر ترتيب الفريق') };
    }
  }

  // ── ألبوم الصور وصور العينات ─────────────────────────────────
  async function refreshMedia(profileId) {
    const client = getSupabase();
    if (!client) return getMedia(profileId, 'gallery');
    try {
      let q = client.from(MEDIA_TABLE)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(600);
      if (profileId) q = q.eq('profile_id', String(profileId));
      const { data, error } = await q;
      if (error) {
        console.warn('[Barbers] media pull:', error.message || error);
        return getMedia(profileId, 'gallery');
      }
      const rows = (data || []).map(_rowToMedia);
      if (profileId) {
        const pid = String(profileId);
        media = media.filter(x => String(x.profileId) !== pid).concat(rows);
      } else {
        media = rows;
      }
      persistMedia();
      announce('media', profileId);
    } catch (e) {
      console.warn('[Barbers] media pull failed', e);
    }
    return getMedia(profileId, 'gallery');
  }

  function getMedia(profileId, kind, includeInactive) {
    const k = kind === 'sample' ? 'sample' : 'gallery';
    let list = profileId
      ? media.filter(x => String(x.profileId) === String(profileId))
      : media.slice();
    list = list.filter(x => x.kind === k);
    if (!includeInactive) list = list.filter(x => x.active !== false);
    return list.slice().sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
  }

  function mediaCount(profileId, kind) {
    return getMedia(profileId, kind, true).length;
  }

  /** إضافة صورة للألبوم — url من DoddzMedia.uploadImage */
  async function addMedia(profileId, item) {
    const pid = String(profileId || '');
    const kind = item?.kind === 'sample' ? 'sample' : 'gallery';
    const limit = kind === 'sample' ? MAX_SAMPLES : MAX_GALLERY;
    const url = String(item?.url || '').trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
      return { success: false, error: 'رابط الصورة غير صحيح' };
    }
    if (mediaCount(pid, kind) >= limit) {
      return { success: false, error: 'الحد الأقصى ' + limit + ' صورة' };
    }
    const x = {
      id: item?.id || _newId('med_'),
      profileId: pid,
      kind,
      url,
      caption: String(item?.caption || '').trim().slice(0, 80),
      active: true,
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : mediaCount(pid, kind)
    };
    const client = getSupabase();
    if (!client) {
      media.push(x);
      persistMedia();
      announce('media', pid);
      return { success: true, media: x, offline: true };
    }
    try {
      const { error } = await client.from(MEDIA_TABLE).insert([_mediaToRow(x)]);
      if (error) return { success: false, error: _dbError(error, 'تعذر إضافة الصورة') };
      await refreshMedia(pid);
      return { success: true, media: x };
    } catch (err) {
      return { success: false, error: _dbError(err, 'تعذر إضافة الصورة') };
    }
  }

  /** تعديل caption أو إخفاء/إظهار صورة */
  async function updateMedia(id, fields) {
    const row = media.find(x => String(x.id) === String(id));
    if (!row) return { success: false, error: 'الصورة مش موجودة' };
    const patch = { ...row };
    if (fields?.caption !== undefined) patch.caption = String(fields.caption).trim().slice(0, 80);
    if (fields?.active !== undefined) patch.active = !!fields.active;
    if (fields?.sortOrder !== undefined) patch.sortOrder = Number(fields.sortOrder) || 0;
    const client = getSupabase();
    if (client) {
      try {
        const r = _mediaToRow(patch);
        const { error } = await client.from(MEDIA_TABLE)
          .update({
            caption: r.caption,
            active: r.active,
            sort_order: r.sort_order,
            updated_at: r.updated_at
          })
          .eq('id', String(id));
        if (error) return { success: false, error: _dbError(error, 'تعذر تعديل الصورة') };
      } catch (err) {
        return { success: false, error: _dbError(err, 'تعذر تعديل الصورة') };
      }
    }
    const i = media.findIndex(x => String(x.id) === String(id));
    if (i !== -1) media[i] = patch;
    persistMedia();
    announce('media', row.profileId);
    return { success: true, media: patch };
  }

  async function deleteMedia(id) {
    const row = media.find(x => String(x.id) === String(id));
    const client = getSupabase();
    if (client) {
      try {
        const { error } = await client.from(MEDIA_TABLE).delete().eq('id', String(id));
        if (error) return { success: false, error: _dbError(error, 'تعذر حذف الصورة') };
      } catch (err) {
        return { success: false, error: _dbError(err, 'تعذر حذف الصورة') };
      }
    }
    // نشيل الملف من Storage كمان عشان ما يفضلش مساحة ضايعة
    const uploader = window.DoddzMedia;
    if (row && uploader && uploader.isHosted && uploader.isHosted(row.url)) {
      try { await uploader.removeImage(row.url); } catch (_) {}
    }
    media = media.filter(x => String(x.id) !== String(id));
    persistMedia();
    announce('media', row?.profileId);
    return { success: true };
  }

  // ── مواعيد كل يوم + اللوكيشن ─────────────────────────────────
  /**
   * days: مصفوفة 7 عناصر [{day, open, from, to}] (0 = الأحد)
   * opts.slotMinutes: مدة الجلسة اللي بيتبني عليها قايمة الأوقات
   * بنخزّنها في hours/jsonb، وبزامن الأعمدة القديمة (workDays/workStart/workEnd)
   * عشان أي شاشة قديمة تفضل صح.
   */
  async function saveHours(profileId, days, opts) {
    const b = getById(profileId);
    if (!b) return { success: false, error: 'الصالون غير موجود' };
    const hours = {};
    const list = Array.isArray(days) ? days : [];
    for (let d = 0; d < 7; d++) {
      const src = list.find(x => Number(x?.day) === d) || list[d];
      const fallback = _legacyDayHours(b, d);
      const open = src ? !!src.open : fallback.open;
      let from = clampInt(src?.from, 0, 23, fallback.from);
      let to = clampInt(src?.to, 1, 24, fallback.to);
      if (to <= from) to = Math.min(24, from + 1);
      hours[String(d)] = { open, from, to };
    }
    const openDays = Object.keys(hours).filter(d => hours[d].open).map(Number);
    const workStart = openDays.length ? Math.min(...openDays.map(d => hours[String(d)].from)) : b.workStart;
    const workEnd = openDays.length ? Math.max(...openDays.map(d => hours[String(d)].to)) : b.workEnd;
    const slotMinutes = Number.isFinite(Number(opts && opts.slotMinutes))
      ? clampInt(opts.slotMinutes, 10, 120, b.slotMinutes || 30)
      : (Number(b.slotMinutes) || 30);

    b.hours = hours;
    b.slotMinutes = slotMinutes;
    b.workDays = openDays.sort((x, y) => x - y);
    b.workStart = workStart;
    b.workEnd = workEnd;
    persistBarbers();
    announce('hours', profileId);
    if (!getSupabase()) return { success: true, hours, slotMinutes, offline: true };
    const res = await pushCatalogField(profileId, {
      hours, workDays: b.workDays, workStart, workEnd, slotMinutes
    });
    if (!res.ok) return { success: false, error: res.error || 'تعذر حفظ المواعيد' };
    return { success: true, hours, slotMinutes };
  }

  /** location: {address, lat, lng, mapUrl, note} */
  async function saveLocation(profileId, loc) {
    const b = getById(profileId);
    if (!b) return { success: false, error: 'الصالون غير موجود' };
    const location = normalizeLocation(loc);
    const lat = location.lat === '' ? NaN : Number(location.lat);
    const lng = location.lng === '' ? NaN : Number(location.lng);
    if ((Number.isFinite(lat) || Number.isFinite(lng)) && !(Number.isFinite(lat) && Number.isFinite(lng))) {
      return { success: false, error: 'لازم خط العرض والطول مع بعض، أو سيّبهم فاضيين' };
    }
    if (Number.isFinite(lat) && (lat < -90 || lat > 90)) return { success: false, error: 'خط العرض غير صحيح' };
    if (Number.isFinite(lng) && (lng < -180 || lng > 180)) return { success: false, error: 'خط الطول غير صحيح' };
    if (!location.address && !location.mapUrl && !Number.isFinite(lat)) {
      // فورم فاضي = مسح العنوان (مسموح بس لو فيه عنوان محفوظ فعلًا)
      const had = b.location && (b.location.address || b.location.mapUrl || b.location.lat);
      if (!had) return { success: false, error: 'اكتب العنوان أو حط رابط الخريطة' };
      b.location = {};
      persistBarbers();
      announce('location', profileId);
      if (!getSupabase()) return { success: true, location: {}, offline: true };
      const cleared = await pushCatalogField(profileId, { location: {} });
      if (!cleared.ok) return { success: false, error: cleared.error || 'تعذر حذف العنوان' };
      return { success: true, location: {}, cleared: true };
    }
    b.location = location;
    if (location.address && !b.address) b.address = location.address;
    persistBarbers();
    announce('location', profileId);
    if (!getSupabase()) return { success: true, location, offline: true };
    const res = await pushCatalogField(profileId, { location });
    if (!res.ok) return { success: false, error: res.error || 'تعذر حفظ اللوكيشن' };
    return { success: true, location };
  }

  /** نص المواعيد الجاهز للعرض: «١٠ ص – ١٠ م» أو «مغلق» — وبالإنجليزي AM/PM */
  function _langEn() {
    try { return !!(window.DoddzI18n && DoddzI18n.getLang() === 'en'); } catch (_) { return false; }
  }

  function formatHour(h) {
    const n = clampInt(h, 0, 24, 10);
    const hh24 = n % 24;
    const twelve = hh24 % 12 === 0 ? 12 : hh24 % 12;
    if (_langEn()) return `${twelve} ${hh24 < 12 ? 'AM' : 'PM'}`;
    const period = hh24 < 12 ? 'ص' : 'م';
    return `${twelve} ${period}`;
  }

  function dayHoursLabel(b, day) {
    if (!b) return '';
    const d = dayHours(b, day);
    return d.open ? `${formatHour(d.from)} – ${formatHour(d.to)}` : 'مغلق';
  }

  /** ملخص أسبوع: 「السبت: ١٠ ص – ١٠ م」 وكل يوم في سطر */
  function weekHoursText(b) {
    if (!b) return '';
    return DAYS_AR.map((label, i) => `${label}: ${dayHoursLabel(b, i)}`);
  }

  // ── حجوزات الحلاقين على Supabase ─────────────────────────────
  const BOOKINGS_TABLE = 'barber_bookings';

  function _toSupabaseBooking(b) {
    return {
      id: b.id,
      barber_id: b.barberId,
      barber_name: b.barberName,
      // الأعمدة القديمة بتفضل تتعبّى (مجموع السعر والمدة) — لشاشات الأدمن القديمة
      service_id: b.serviceId,
      service_name: b.serviceName,
      duration_min: b.durationMin,
      price: b.price,
      // الجديد: الخدمات المختارة (واحدة أو أكتر) + الفني المختار
      services: Array.isArray(b.services) ? b.services : [],
      member_id: b.memberId || null,
      member_name: b.memberName || null,
      customer_user_id: b.customerUserId || null,
      travel_fee: b.travelFee,
      extra_fee: b.extraFee,
      total_price: b.totalPrice,
      location_type: b.locationType,
      address: b.address,
      customer_area: b.customerArea,
      customer_name: b.customerName,
      customer_phone: b.customerPhone,
      date: b.date,
      time: b.time,
      notes: b.notes,
      status: b.status,
      created_at: b.createdAt
    };
  }

  function _fromSupabaseBooking(r) {
    const list = Array.isArray(r.services) ? r.services : [];
    return {
      id: r.id,
      barberId: r.barber_id,
      barberName: r.barber_name,
      serviceId: r.service_id,
      serviceName: r.service_name,
      durationMin: r.duration_min,
      price: r.price,
      services: list,
      serviceNames: list.length ? list.map(s => s?.name).filter(Boolean) : (r.service_name ? [r.service_name] : []),
      memberId: r.member_id || '',
      memberName: r.member_name || '',
      customerUserId: r.customer_user_id || '',
      travelFee: r.travel_fee,
      extraFee: r.extra_fee,
      totalPrice: r.total_price,
      locationType: r.location_type,
      address: r.address,
      customerArea: r.customer_area,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      date: r.date,
      time: typeof r.time === 'string' ? r.time.slice(0, 5) : r.time,
      notes: r.notes,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  /** جلب كل الحجوزات من السحابة للكاش المحلي — للأدمن/الحلاق المسجّلين فقط */
  async function refreshBookings() {
    const client = getSupabase();
    if (!client) return bookings.slice();
    try {
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session) return bookings.slice();
      const { data, error } = await client
        .from(BOOKINGS_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) {
        console.warn('[Barbers] bookings pull:', error.message || error);
        return bookings.slice();
      }
      bookings = (data || []).map(_fromSupabaseBooking);
      persistBookings();
    } catch (e) {
      console.warn('[Barbers] bookings pull failed', e);
    }
    return bookings.slice();
  }

  /**
   * صفوف المحجوز في يوم (الكاش المحلي + السحابة) على شكل [{time, memberId}].
   * بندمج الاتنين لأن الكاش بيكون فيه آخر حجز عملناه من نفس الجهاز، والسحابة
   * فيها حجوزات الأجهزة التانية.
   */
  async function fetchBookedSlots(barberId, dateStr) {
    const rows = bookings
      .filter(x => x.barberId === barberId && x.date === dateStr && x.status !== 'cancelled')
      .map(x => ({
        time: x.time,
        memberId: x.memberId ? String(x.memberId) : '',
        durationMin: Number(x.durationMin) || 0
      }));
    const client = getSupabase();
    if (!client) return rows;
    try {
      const { data, error } = await client
        .from(BOOKINGS_TABLE)
        .select('time,member_id,status,duration_min')
        .eq('barber_id', barberId)
        .eq('date', dateStr)
        .neq('status', 'cancelled');
      if (error) {
        console.warn('[Barbers] booked-slots pull:', error.message || error);
        return rows;
      }
      (data || []).forEach(r => rows.push({
        time: typeof r.time === 'string' ? r.time.slice(0, 5) : r.time,
        memberId: r.member_id ? String(r.member_id) : '',
        durationMin: Number(r.duration_min) || 0
      }));
    } catch (e) {
      console.warn('[Barbers] booked-slots pull failed', e);
    }
    return rows;
  }

  /** 'HH:MM' → دقائق من أول اليوم (لو جات دقائق حرفيًا اتستخدمت) */
  function _toMin(t) {
    if (typeof t === 'number') return t;
    const [h, m] = String(t || '0:0').split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  }

  /**
   * قاعدة الإشغال: كل فني ليه كرسي واحد.
   *   - حجز باسم فني معين = يشغل الفني ده بس.
   *   - حجز «أقرب فني متاح» (member_id فاضي) = مشغل فني مجهول، فبنحسبه على أي واحد.
   * عشان كده الصالون اللي فيه ٣ فنيين يقدر ياخد ٣ حجوزات في نفس الساعة.
   * الإشغال بيحسب **المدة**: حجز ٥٠ دقيقة على ١١:٠٠ يقفل ١١:٠٠ و١١:٣٠ على نفس الفني.
   */
  function _occupancy(rows, slotStartMin, slotDurMin, memberIds) {
    const dur = Number(slotDurMin) || 30;
    const slotEnd = slotStartMin + dur;
    const taken = new Set();
    let unassigned = 0;
    (rows || []).forEach(r => {
      if (!r) return;
      const start = _toMin(r.time);
      const len = Number(r.durationMin) || dur;   // لو المدة مسجلة، بندّ على مدة الحجز القديم
      const overlaps = start < slotEnd && start + len > slotStartMin;
      if (!overlaps) return;
      if (r.memberId) taken.add(String(r.memberId));
      else unassigned++;
    });
    return { taken, unassigned, capacity: (memberIds || []).length || 1 };
  }

  /** Slot مفتوح للفني ده؟ (memberId فاضي = أقرب فني متاح) */
  function _slotOpen(memberId, occ) {
    if (memberId) {
      if (occ.taken.has(String(memberId))) return false;
      const free = Math.max(0, occ.capacity - occ.taken.size);
      return occ.unassigned < free;
    }
    return occ.taken.size + occ.unassigned < occ.capacity;
  }

  function getService(barberId, serviceId) {
    const b = getById(barberId);
    if (!b) return null;
    return (b.services || []).find(s => s.id === serviceId) || null;
  }

  /** أكتر من خدمة في الحجز الواحد — بنرجع اللي موجود بس */
  function getServices(barberId, serviceIds) {
    const b = getById(barberId);
    if (!b) return [];
    const ids = (serviceIds || []).map(String);
    return (b.services || []).filter(s => ids.includes(String(s.id)));
  }

  /** مجموع المدة والسعر لاختيارات الزبون */
  function summarizeServices(list) {
    const items = (list || []).map(s => ({
      id: s.id,
      name: s.name,
      durationMin: Number(s.durationMin) || 30,
      price: Number(s.price) || 0,
      category: s.category || ''
    }));
    return {
      items,
      durationMin: items.reduce((a, s) => a + s.durationMin, 0),
      price: items.reduce((a, s) => a + s.price, 0),
      // '، ' بدل ' + ' لأن في خدمات اسمها أصلا «شعر + ذقن»
      label: items.map(s => s.name).join('، ')
    };
  }

  /** Generate available time slots for a date — async: يقرأ المحجوز من السحابة */
  async function getSlots(barberId, dateStr, memberId, opts) {
    const b = getById(barberId);
    if (!b) return [];
    const date = new Date(dateStr + 'T12:00:00');
    if (Number.isNaN(date.getTime())) return [];
    const day = date.getDay(); // 0 Sun
    const dh = dayHours(b, day);
    if (!dh.open) return [];

    const mid = memberId && memberId !== 'any' && memberId !== 'owner-any' ? String(memberId) : '';
    const memberIds = getTeam(barberId).map(t => String(t.id)).filter(Boolean);
    const durationMin = Math.max(0, Number(opts?.durationMin) || 0);

    const rows = await fetchBookedSlots(barberId, dateStr);

    const slots = [];
    const start = dh.from;
    const end = dh.to;
    const step = b.slotMinutes || 30;
    for (let h = start; h < end; h++) {
      for (let m = 0; m < 60; m += step) {
        if (h === end - 1 && m + step > 60) break;
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const totalMin = h * 60 + m;
        if (totalMin + step > end * 60) continue;
        const occ = _occupancy(rows, totalMin, durationMin || step, memberIds);
        let available = _slotOpen(mid, occ);
        let reason = available ? '' : 'busy';
        // لو الخدمات المختارة تاخد وقت أطول من وقت الصالون في اليوم ده
        if (available && durationMin > step && totalMin + durationMin > end * 60) {
          available = false;
          reason = 'too_long';
        }
        slots.push({ time, available, reason });
      }
    }

    // disable past slots if today
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (dateStr === todayStr) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      return slots.map(s => {
        const [hh, mm] = s.time.split(':').map(Number);
        const past = hh * 60 + mm <= nowMin + 30;
        if (past && s.available) return { ...s, available: false, reason: 'past' };
        return { ...s, available: s.available && !past };
      });
    }
    return slots;
  }

  /**
   * إنشاء حجز — بيدعم أكتر من خدمة في الحجز الواحد + اختيار الفني.
   * payload: { barberId, serviceIds[] | serviceId, memberId?, date, time,
   *            customerName, customerPhone, locationType, address, notes }
   */
  async function createBooking(payload) {
    const b = getById(payload.barberId);
    if (!b || b.status !== 'approved') {
      return { success: false, error: 'الحلاق غير متاح للحجز' };
    }
    if (!payload.customerName || !payload.customerPhone || !payload.date || !payload.time) {
      return { success: false, error: 'بيانات الحجز غير مكتملة' };
    }
    if (!/^01[0-9]{9}$/.test(payload.customerPhone)) {
      return { success: false, error: 'رقم الموبايل غير صحيح' };
    }

    // ١) الخدمات المختارة (قديمة = serviceId، جديدة = serviceIds)
    const requested = (Array.isArray(payload.serviceIds) && payload.serviceIds.length)
      ? payload.serviceIds
      : (payload.serviceId ? [payload.serviceId] : []);
    if (!requested.length) return { success: false, error: 'اختَر خدمة واحدة على الأقل' };
    const picked = getServices(payload.barberId, requested);
    if (picked.length !== requested.length) {
      return { success: false, error: 'في خدمة مش موجودة في القايمة، حدّث الصفحة واختار تاني' };
    }
    const sum = summarizeServices(picked);
    if (!sum.durationMin) return { success: false, error: 'مدة الخدمة غير محددة — كلّم صاحب الصالون' };

    // ٢) الفني: '' / 'any' = أقرب فني متاح
    const wantMember = payload.memberId && payload.memberId !== 'any' ? String(payload.memberId) : '';
    let memberName = '';
    if (wantMember) {
      let members = getTeam(payload.barberId);
      if (!members.length) members = (await refreshTeam(payload.barberId)).filter(t => t.active !== false);
      const m = members.find(t => String(t.id) === wantMember);
      if (!m) return { success: false, error: 'الفني المختار غير متاح دلوقتي' };
      memberName = String(payload.memberName || m.name || '').trim();
    }

    const locationType = payload.locationType === 'home' ? 'home' : 'salon';
    const hs = b.homeService || {};
    if (locationType === 'home') {
      if (!hs.enabled) return { success: false, error: 'الحلاق لا يقدّم خدمة منزلية' };
      if (!(payload.address || '').trim()) return { success: false, error: 'العنوان مطلوب للخدمة المنزلية' };
    }

    const client = getSupabase();
    if (!client) return { success: false, error: 'تعذر الاتصال بالخادم، حاول تاني بعد قليل' };

    const slots = await getSlots(payload.barberId, payload.date, wantMember, { durationMin: sum.durationMin });
    const slot = slots.find(s => s.time === payload.time);
    if (!slot) return { success: false, error: 'الموعد غير متاح، اختَر وقت آخر' };
    if (!slot.available) {
      const msg = slot.reason === 'too_long'
        ? 'المدة المطلوبة (' + sum.durationMin + ' دقيقة) بتخلص بعد مواعيد الصالون في اليوم ده'
        : 'الموعد غير متاح، اختَر وقت آخر';
      return { success: false, error: msg };
    }

    const travelFee = locationType === 'home' ? (Number(hs.travelFee) || 0) : 0;
    const extraFee = locationType === 'home' ? (Number(hs.extraFee) || 0) : 0;
    const totalPrice = sum.price + travelFee + extraFee;

    let customerUserId = payload.customerUserId || null;
    if (!customerUserId) {
      try {
        const { data } = await client.auth.getSession();
        customerUserId = data?.session?.user?.id || null;
      } catch (_) {}
    }

    const booking = {
      id: 'bk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      barberId: payload.barberId,
      barberName: b.name,
      // الأعمدة القديمة: أول خدمة + المجموع، عشان شاشات الأدمن القديمة تفضل مقروءة
      serviceId: sum.items[0].id,
      serviceName: sum.label,
      durationMin: sum.durationMin,
      price: sum.price,
      services: sum.items,
      serviceNames: sum.items.map(s => s.name),
      memberId: wantMember,
      memberName,
      customerUserId,
      travelFee,
      extraFee,
      totalPrice,
      locationType,
      address: locationType === 'home' ? String(payload.address).trim() : null,
      customerArea: locationType === 'home' ? (String(payload.customerArea || '').trim() || null) : null,
      customerName: payload.customerName.trim(),
      customerPhone: payload.customerPhone.trim(),
      date: payload.date,
      time: payload.time,
      notes: (payload.notes || '').trim() || null,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const { error } = await client.from(BOOKINGS_TABLE).insert([_toSupabaseBooking(booking)]);
    if (error) {
      // الـunique index بيمنع حجزين لنفس الفني في نفس الموعد حتى لو اتقدموا مع بعض
      if (error.code === '23505' || /duplicate key/i.test(error.message || '')) {
        return { success: false, error: 'الموعد ده اتحجز للتو، اختَر وقت آخر' };
      }
      console.error('[Barbers] booking insert failed:', error);
      return { success: false, error: 'تعذر إرسال الحجز، جرّب تاني' };
    }

    bookings.unshift(booking);
    persistBookings();
    return { success: true, booking };
  }

  function getBookings() { return bookings.slice(); }
  function getBookingsByBarber(barberId) {
    return bookings.filter(x => x.barberId === barberId);
  }

  async function updateBookingStatus(id, status) {
    const client = getSupabase();
    if (!client) return { success: false, error: 'تعذر الاتصال بالخادم، حاول تاني بعد قليل' };
    const updatedAt = new Date().toISOString();
    const { error } = await client
      .from(BOOKINGS_TABLE)
      .update({ status, updated_at: updatedAt })
      .eq('id', id);
    if (error) {
      console.error('[Barbers] booking update failed:', error);
      return { success: false, error: 'تعذر تحديث الحجز — تأكد إنك مسجّل دخول' };
    }
    const row = bookings.find(x => x.id === id);
    if (row) {
      row.status = status;
      row.updatedAt = updatedAt;
      persistBookings();
    }
    return { success: true, booking: row || { id, status } };
  }

  function cancelBooking(id) {
    return updateBookingStatus(id, 'cancelled');
  }

  function getByUserId(userId) {
    if (!userId) return null;
    return barbers.find(b => b.userId && String(b.userId) === String(userId)) || null;
  }

  function updateHomeService(barberId, settings) {
    const b = getById(barberId);
    if (!b) return { success: false, error: 'الحلاق غير موجود' };
    normalizeBarber(b);
    b.homeService = {
      enabled: !!settings.enabled,
      areas: String(settings.areas || '')
        .split(/[,،]/)
        .map(s => s.trim())
        .filter(Boolean),
      travelFee: Number(settings.travelFee) || 0,
      extraFee: Number(settings.extraFee) || 0,
      note: String(settings.note || '').trim()
    };
    persistBarbers();
    return { success: true, barber: b };
  }

  function updateServices(barberId, services) {
    const b = getById(barberId);
    if (!b) return { success: false, error: 'الحلاق غير موجود' };
    if (!Array.isArray(services) || !services.length) {
      return { success: false, error: 'أضف خدمة واحدة على الأقل' };
    }
    b.services = services.map((s, i) => ({
      id: s.id || ('s' + (i + 1)),
      name: String(s.name || '').trim(),
      durationMin: Number(s.durationMin) || 30,
      price: Number(s.price) || 0,
      description: String(s.description || '').trim(),
      // الحرفة/التصنيف: 'hair' | 'beard' | 'skin' | '' — المرحلة التانية بتعرضه
      category: String(s.category || '').trim()
    })).filter(s => s.name);
    if (!b.services.length) return { success: false, error: 'أضف خدمة واحدة على الأقل' };
    persistBarbers();
    return { success: true, barber: b };
  }

  function linkUser(barberId, userId) {
    const b = getById(barberId);
    if (!b) return { success: false, error: 'غير موجود' };
    b.userId = userId;
    persistBarbers();
    return { success: true, barber: b };
  }

  function updateProfile(barberId, fields) {
    const b = getById(barberId);
    if (!b) return { success: false, error: 'الحلاق غير موجود' };
    if (fields.avatarUrl !== undefined) b.avatarUrl = fields.avatarUrl || '';
    if (fields.coverUrl !== undefined) b.coverUrl = fields.coverUrl || '';
    if (fields.avatar !== undefined) b.avatar = fields.avatar || '';
    if (fields.name !== undefined) b.name = String(fields.name || '').trim() || b.name;
    if (fields.bio !== undefined) b.bio = String(fields.bio || '').trim();
    b.updatedAt = new Date().toISOString();
    persistBarbers();
    return { success: true, barber: b };
  }



  /** إنشاء/تحديث حلاق من طلب انضمام بعد موافقة الأدمن */
  function upsertFromApplication(app) {
    if (!app) return { success: false, error: 'لا يوجد طلب' };
    const phone = (app.phone || '').trim();
    const name = (app.full_name || app.fullName || '').trim();
    if (!name) return { success: false, error: 'الاسم مطلوب' };

    // reuse by phone if exists
    let existing = barbers.find(b => b.phone && phone && b.phone === phone);
    if (existing) {
      existing.name = name;
      existing.status = 'approved';
      existing.bio = app.description || existing.bio || '';
      if (app.business_name) existing.area = existing.area || app.business_name;
      existing.updatedAt = new Date().toISOString();
      if (app.userId) existing.userId = app.userId;
      persistBarbers();
      return { success: true, barber: existing, created: false };
    }

    const id = 'barber_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const barber = {
      id,
      userId: app.userId || null,
      name,
      area: app.business_name || app.area || 'مصر',
      bio: app.description || 'حلاق معتمد عبر Doddz Go',
      avatar: '', avatarUrl: '', coverUrl: '',
      rating: 5,
      reviewsCount: 0,
      isFeatured: false,
      status: 'approved',
      phone: phone || null,
      workDays: [0, 1, 2, 3, 4, 5],
      workStart: 10,
      workEnd: 21,
      slotMinutes: 30,
      cancelPolicy: 'يمكن الإلغاء قبل الموعد بـ 3 ساعات.',
      services: [
        { id: 's1', name: 'حلاقة شعر', durationMin: 30, price: 100, description: '', category: 'hair' },
        { id: 's2', name: 'ذقن', durationMin: 20, price: 70, description: '', category: 'beard' },
        { id: 's3', name: 'شعر + ذقن', durationMin: 45, price: 150, description: '', category: 'hair' }
      ],
      hours: {},
      location: normalizeLocation(null),
      createdAt: new Date().toISOString()
    };
    normalizeBarber(barber);
    barbers.unshift(barber);
    persistBarbers();
    return { success: true, barber, created: true };
  }


  load();

  return {
    // ثوابت
    DAYS_AR,
    SERVICE_PRESETS,
    MAX_TEAM,
    MAX_GALLERY,
    MAX_SAMPLES,

    // الكتالوج
    getApproved,
    getPending,
    getById,
    getAll: () => barbers.slice(),
    listAll: () => barbers.slice(),
    getByUserId,
    getFeatured,
    offersHome: (id) => {
      const b = getById(id);
      return !!(b && b.homeService && b.homeService.enabled);
    },
    setStatus,
    pullBarberStatuses,
    pushBarberStatus,
    syncCatalogFromSupabase,
    pushCatalogField,
    normalizeBarber,

    // مواعيد الأيام + اللوكيشن
    dayHours,
    hoursView,
    dayHoursLabel,
    weekHoursText,
    formatHour,
    saveHours,
    saveLocation,

    // فريق المحل
    refreshTeam,
    getTeam,
    teamForRender,
    hasTeamChoice,
    saveTeamMember,
    deleteTeamMember,
    reorderTeam,

    // ألبوم الصور + العينات
    refreshMedia,
    getMedia,
    mediaCount,
    addMedia,
    updateMedia,
    deleteMedia,

    // الخدمات والحجز
    getService,
    getServices,
    summarizeServices,
    getSlots,
    createBooking,
    getBookings,
    getBookingsByBarber,
    refreshBookings,
    updateBookingStatus,
    cancelBooking,
    upsertFromApplication,
    updateHomeService,
    updateServices,
    updateProfile,
    linkUser,
    reload: load
  };
})();

window.BarberStore = BarberStore;
