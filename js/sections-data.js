/* ================================================================
   DODDZ SECTIONS STORE — الأقسام الأربعة في Supabase
   قصها / لمعها / انامل / كسبني  →  جدول مستقل لكل قسم
   (barber_profiles / carwash_profiles / handmade_profiles / merchant_profiles)

   المسار ده بيشمل:
     - قراءة الأنشطة المعتمدة للعرض للعملاء + نشاط الحساب الحالي للوحة البائع
     - تسجيل نشاط جديد عن طريق rpc('register_provider_section')
     - إكمال التسجيل المعلّق أول ما المستخدم يسجّل دخول
     - اعتماد/رفض الأدمن عن طريق rpc('set_provider_status')

   كل حاجة هنا client-side بس: الصلاحيات الحقيقية في Supabase
   (RLS + trg_guard_* + فحص is_admin() جوه الدوال).
================================================================ */
(function () {
  'use strict';

  const SECTIONS = {
    barbers: {
      code: 'barbers', table: 'barber_profiles', label: 'قصها',
      entity: 'صالون حلاقة', aliases: ['barber', 'barbers', 'حلاق', 'صالون']
    },
    carwash: {
      code: 'carwash', table: 'carwash_profiles', label: 'لمعها',
      entity: 'مغسلة سيارات', aliases: ['carwash', 'مغسلة']
    },
    handmade: {
      code: 'handmade', table: 'handmade_profiles', label: 'انامل',
      entity: 'ورشة هند ميد', aliases: ['handmade', 'هند ميد', 'هاند ميد']
    },
    merchants: {
      code: 'merchants', table: 'merchant_profiles', label: 'كسبني',
      entity: 'متجر', aliases: ['merchant', 'merchants', 'تاجر']
    }
  };

  const CACHE_KEY = 'doddz_sections_v1';
  const PENDING_KEY = 'doddz_pending_registration_v1';

  const state = {
    rows: {},        // { [sectionCode]: [row, ...] } — المعتمد + صفي أنا
    me: null,        // صف نشاط الحساب الحالي
    loading: false
  };

  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });

  function client() {
    return (typeof window !== 'undefined' && window.supabaseClient) || null;
  }

  function section(code) {
    const key = normalizeSection(code);
    return key ? SECTIONS[key] : null;
  }

  /** أي تسمية في المشروع (barber / barbers / قصها / حلاق) → كود القسم الرسمي */
  function normalizeSection(input) {
    if (!input) return null;
    const v = String(input).trim().toLowerCase();
    if (SECTIONS[v]) return v;
    const arabic = { 'قصها': 'barbers', 'لمعها': 'carwash', 'انامل': 'handmade', 'كسبني': 'merchants' };
    if (arabic[v]) return arabic[v];
    for (const key of Object.keys(SECTIONS)) {
      if ((SECTIONS[key].aliases || []).some(a => v === a || v.indexOf(a) !== -1)) return key;
    }
    return null;
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function writeCache(payload) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch (_) {}
  }

  // ── تحميل أنشطة الأقسام ──────────────────────────────────────
  async function load(code) {
    const sec = section(code);
    const db = client();
    if (!sec) return [];
    if (state.rows[sec.code] && state.rows[sec.code].length) return state.rows[sec.code];

    if (!db) {
      const cached = readCache();
      state.rows[sec.code] = (cached && cached[sec.code]) || [];
      return state.rows[sec.code];
    }

    try {
      const { data, error } = await db.from(sec.table)
        .select('*')
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false })
        .order('name', { ascending: true })
        .limit(200);

      if (error) throw error;
      state.rows[sec.code] = data || [];
      const cache = readCache() || {};
      cache[sec.code] = state.rows[sec.code];
      writeCache(cache);
      return state.rows[sec.code];
    } catch (err) {
      console.warn('[Sections] load ' + sec.code + ':', err);
      const cached = readCache();
      state.rows[sec.code] = (cached && cached[sec.code]) || [];
      return state.rows[sec.code];
    }
  }

  /** للواجهة: الأنشطة المعتمدة بس */
  async function approved(code) {
    const rows = await load(code);
    return rows.filter(r => r.status === 'approved');
  }

  async function all(code) {
    return load(code);
  }

  // ── نشاط الحساب الحالي ───────────────────────────────────────
  async function myProvider() {
    const db = client();
    if (!db) return null;
    try {
      const { data: sess } = await db.auth.getSession();
      const uid = sess?.user?.id;
      if (!uid) { state.me = null; return null; }

      const codes = Object.keys(SECTIONS);
      for (const code of codes) {
        const { data, error } = await db.from(SECTIONS[code].table)
          .select('*').eq('user_id', uid).maybeSingle();
        if (error) continue;
        if (data) {
          state.me = { section: code, row: data };
          try { localStorage.setItem('doddz_user_category', code); } catch (_) {}
          return state.me;
        }
      }
      state.me = null;
      return null;
    } catch (err) {
      console.warn('[Sections] myProvider:', err);
      return null;
    }
  }

  function mySection() {
    return (state.me && state.me.section) ||
      (() => { try { return normalizeSection(localStorage.getItem('doddz_user_category')); } catch (_) { return null; } })();
  }

  // ── تسجيل نشاط جديد (يشتغل فورًا بحالة pending) ──────────────
  async function register(payload) {
    const db = client();
    const code = normalizeSection(payload && payload.section);
    if (!db) return { success: false, error: 'تعذر الاتصال بالخادم' };
    if (!code) return { success: false, error: 'قسم غير معروف' };
    if (!payload.name) return { success: false, error: 'اسم النشاط مطلوب' };

    try {
      const { data, error } = await db.rpc('register_provider_section', {
        p_section: code,
        p_name: payload.name,
        p_owner_name: payload.ownerName || null,
        p_phone: payload.phone || null,
        p_governorate: payload.governorate || null,
        p_area: payload.area || null,
        p_address: payload.address || null,
        p_description: payload.description || null,
        p_logo_url: payload.logoUrl || null,
        p_services: Array.isArray(payload.services) ? JSON.parse(JSON.stringify(payload.services)) : null
      });
      if (error) throw error;

      const row = typeof data === 'string' ? JSON.parse(data) : (data || {});
      state.rows[code] = [];           // ي إعادة التحميل عشان الصف الجديد يطلع
      await load(code);
      await myProvider();
      try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
      return { success: true, result: row, section: code };
    } catch (err) {
      console.error('[Sections] register:', err);
      return { success: false, error: err?.message || 'تعذر تسجيل النشاط' };
    }
  }

  /**
   * تسجيل الطلب (قبل ما يبقى فيه جلسة) — بيخزن البيانات لحد أول دخول
   * فـ signup_requests بيعملها js/seller.js، وإحنا بنسيب نسخة محلية
   * عشان نكمّل التسجيل أوتوماتيك بعد اللوجين.
   */
  function stashPendingRegistration(payload) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(payload)); } catch (_) {}
  }

  function pendingRegistration() {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  /** بعد أي تسجيل دخول: لو فيه تسجيل معلّق أو طلب من غير نشاط → أكمله */
  async function completePendingRegistration() {
    const db = client();
    if (!db) return null;
    try {
      const { data: sess } = await db.auth.getSession();
      const uid = sess?.user?.id;
      if (!uid) return null;

      const existing = await myProvider();
      if (existing) return existing;

      let payload = pendingRegistration();
      if (!payload) {
        const { data: reqs } = await db.from('signup_requests')
          .select('category,full_name,phone,business_name,description,user_id')
          .eq('user_id', uid)
          .is('provider_id', null)
          .order('created_at', { ascending: false })
          .limit(1);
        const req = reqs && reqs[0];
        if (!req) return null;
        payload = {
          section: normalizeSection(req.category),
          name: req.business_name || req.full_name,
          ownerName: req.full_name,
          phone: req.phone,
          description: req.description
        };
      }
      if (!payload || !normalizeSection(payload.section)) return null;

      const r = await register(payload);
      return r.success ? r : null;
    } catch (err) {
      console.warn('[Sections] completePendingRegistration:', err);
      return null;
    }
  }

  // ── تعديل نشاطي ──────────────────────────────────────────────
  async function saveMyProvider(fields) {
    const db = client();
    const code = mySection();
    const sec = section(code);
    const me = state.me && state.me.row;
    if (!db || !sec || !me) return { success: false, error: 'مفيش نشاط مرتبط بالحساب ده' };

    const patch = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.owner_name !== undefined) patch.owner_name = fields.owner_name;
    if (fields.phone !== undefined) patch.phone = fields.phone;
    if (fields.governorate !== undefined) patch.governorate = fields.governorate;
    if (fields.area !== undefined) patch.area = fields.area;
    if (fields.address !== undefined) patch.address = fields.address;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.bio !== undefined && code === 'barbers') patch.bio = fields.bio;
    if (fields.logo_url !== undefined) patch.logo_url = fields.logo_url;
    if (fields.avatar_url !== undefined && code === 'barbers') patch.avatar_url = fields.avatar_url;
    if (fields.cover_url !== undefined) patch.cover_url = fields.cover_url;
    if (fields.services !== undefined) patch.services = fields.services;
    if (fields.home_service !== undefined) patch.home_service = fields.home_service;
    if (fields.work_days !== undefined) patch.work_days = fields.work_days;
    if (fields.work_start !== undefined) patch.work_start = fields.work_start;
    if (fields.work_end !== undefined) patch.work_end = fields.work_end;
    if (fields.slot_minutes !== undefined) patch.slot_minutes = fields.slot_minutes;
    if (fields.cancel_policy !== undefined) patch.cancel_policy = fields.cancel_policy;
    patch.updated_at = new Date().toISOString();

    try {
      const { data, error } = await db.from(sec.table)
        .update(patch).eq('id', me.id).select('*').maybeSingle();
      if (error) throw error;
      state.me = { section: code, row: data || { ...me, ...patch } };
      state.rows[code] = [];
      await load(code);
      return { success: true, row: state.me.row };
    } catch (err) {
      console.error('[Sections] saveMyProvider:', err);
      return { success: false, error: err?.message || 'تعذر حفظ النشاط' };
    }
  }

  // ── اعتماد / رفض من لوحة الأدمن ──────────────────────────────
  async function setStatus(code, id, status) {
    const db = client();
    const sec = section(code);
    if (!db || !sec) return { success: false, error: 'قسم غير معروف' };
    try {
      const { data, error } = await db.rpc('set_provider_status', {
        p_section: sec.code, p_id: String(id), p_status: status
      });
      if (error) throw error;
      state.rows[sec.code] = [];
      await load(sec.code);
      return { success: true, result: data };
    } catch (err) {
      console.error('[Sections] setStatus:', err);
      return { success: false, error: err?.message || 'تعذر تغيير الحالة' };
    }
  }

  /** الأدمن: كل أنشطة الأقسام الأربعة في نداء واحد لكل قسم */
  async function loadAll() {
    const out = {};
    for (const code of Object.keys(SECTIONS)) {
      state.rows[code] = [];
      out[code] = await load(code);
    }
    return out;
  }

  async function init() {
    await Promise.all(Object.keys(SECTIONS).map(load));
    const db = client();
    if (db) {
      try {
        const { data } = await db.auth.getSession();
        if (data?.session) await myProvider();
      } catch (_) {}
    }
    resolveReady();
  }

  document.addEventListener('DOMContentLoaded', () => { init(); });

  window.SectionsStore = {
    SECTIONS,
    normalizeSection,
    section,
    load,
    loadAll,
    approved,
    all,
    myProvider,
    myProviderInfo: () => state.me,
    mySection,
    register,
    stashPendingRegistration,
    pendingRegistration,
    completePendingRegistration,
    saveMyProvider,
    setStatus,
    whenReady: () => ready
  };
})();
