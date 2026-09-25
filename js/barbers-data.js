// ================================================================
// BarberStore — P0 listing/profile + P1 bookings (local + optional Supabase)
// Status: pending | approved | rejected — only approved shown to customers
// ================================================================
const BarberStore = (() => {
  const STORAGE_BARBERS = 'doddz_barbers_v2';
  const STORAGE_BOOKINGS = 'doddz_barber_bookings_v1';

  const SEED = [
    {
      id: 'barber_01',
      name: 'كريم فيصل',
      area: 'المعادي',
      bio: 'حلاق رجالي بخبرة +10 سنين. قصات حديثة وعناية بالذقن.',
      avatar: '', avatarUrl: '', coverUrl: '', avatarUrl: '', coverUrl: '',
      rating: 4.9,
      reviewsCount: 128,
      isFeatured: true,
      status: 'approved',
      phone: '01011112222',
      workDays: [0, 1, 2, 3, 4, 5], // Sun-Fri
      workStart: 10,
      workEnd: 21,
      slotMinutes: 30,
      cancelPolicy: 'يمكن الإلغاء قبل الموعد بـ 3 ساعات.',
      homeService: {
        enabled: true,
        areas: ['المعادي', 'المقطم', 'دار السلام'],
        travelFee: 40,
        extraFee: 0,
        note: 'الحلاق بيجي لحد البيت في المناطق المحددة.'
      },
      services: [
        { id: 's1', name: 'حلاقة شعر', durationMin: 30, price: 120, description: 'قص وتصفيف' },
        { id: 's2', name: 'ذقن', durationMin: 20, price: 80, description: 'تهذيب وشكل' },
        { id: 's3', name: 'شعر + ذقن', durationMin: 45, price: 180, description: 'باقة كاملة' },
        { id: 's4', name: 'حلاقة أطفال', durationMin: 25, price: 90, description: 'حتى 12 سنة' }
      ]
    },
    {
      id: 'barber_02',
      name: 'أحمد نادي',
      area: 'مدينة نصر',
      bio: 'متخصص في الـ Fade والقصات العصرية.',
      avatar: '', avatarUrl: '', coverUrl: '', avatarUrl: '', coverUrl: '',
      rating: 4.7,
      reviewsCount: 86,
      isFeatured: true,
      status: 'approved',
      phone: '01022223333',
      workDays: [0, 1, 2, 3, 4, 6],
      workStart: 12,
      workEnd: 22,
      slotMinutes: 30,
      cancelPolicy: 'الإلغاء مجاني قبل 6 ساعات.',
      homeService: {
        enabled: true,
        areas: ['مدينة نصر', 'مصر الجديدة', 'التجمع'],
        travelFee: 50,
        extraFee: 20,
        note: 'متاح خدمة منزلية بمناطق شرق القاهرة.'
      },
      services: [
        { id: 's1', name: 'Skin Fade', durationMin: 40, price: 150, description: '' },
        { id: 's2', name: 'حلاقة كلاسيك', durationMin: 30, price: 110, description: '' },
        { id: 's3', name: 'ستايلينج', durationMin: 20, price: 70, description: 'تصفيف بالمنتجات' }
      ]
    },
    {
      id: 'barber_03',
      name: 'محمود سعيد',
      area: 'الزمالك',
      bio: 'صالون هادئ وخدمة سريعة بدون انتظار طويل.',
      avatar: '', avatarUrl: '', coverUrl: '',
      rating: 4.6,
      reviewsCount: 54,
      isFeatured: false,
      status: 'approved',
      phone: '01033334444',
      workDays: [1, 2, 3, 4, 5, 6],
      workStart: 11,
      workEnd: 20,
      slotMinutes: 30,
      cancelPolicy: 'يمكن تعديل الموعد مرة واحدة مجاناً.',
      homeService: {
        enabled: false,
        areas: [],
        travelFee: 0,
        extraFee: 0,
        note: ''
      },
      services: [
        { id: 's1', name: 'حلاقة شعر', durationMin: 30, price: 130, description: '' },
        { id: 's2', name: 'ذقن ملكي', durationMin: 25, price: 95, description: '' },
        { id: 's3', name: 'شعر + ذقن', durationMin: 50, price: 200, description: '' }
      ]
    },
    {
      id: 'barber_04',
      name: 'يوسف حسام',
      area: 'التجمع',
      bio: 'حلاق جديد — في انتظار موافقة الإدارة.',
      avatar: '', avatarUrl: '', coverUrl: '',
      rating: 0,
      reviewsCount: 0,
      isFeatured: false,
      status: 'pending',
      phone: '01044445555',
      workDays: [0, 1, 2, 3, 4],
      workStart: 10,
      workEnd: 18,
      slotMinutes: 30,
      cancelPolicy: 'حسب الاتفاق.',
      services: [
        { id: 's1', name: 'حلاقة شعر', durationMin: 30, price: 100, description: '' }
      ]
    }
  ];

  let barbers = [];
  let bookings = [];

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
      b.avatarUrl = b.avatarUrl || '';
      b.coverUrl = b.coverUrl || '';
      if (b.avatar && String(b.avatar).startsWith('http') && !b.avatarUrl) b.avatarUrl = b.avatar;
    }
    return b;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_BARBERS);
      barbers = raw ? JSON.parse(raw) : null;
    } catch { barbers = null; }
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
    // مزامنة الحالات من السحابة (إيقاف/تفعيل يظهر على كل الأجهزة)
    pullBarberStatuses().then(() => {
      try {
        if (typeof renderBarbersSection === 'function') renderBarbersSection();
      } catch (_) {}
    });
    // مزامنة الحجوزات من السحابة — بتشتغل بس لو فيه جلسة مسجّلة (أدمن/حلاق)
    refreshBookings();
  }

  function persistBarbers() {
    localStorage.setItem(STORAGE_BARBERS, JSON.stringify(barbers));
  }
  function persistBookings() {
    localStorage.setItem(STORAGE_BOOKINGS, JSON.stringify(bookings));
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

  // ── حجوزات الحلاقين على Supabase ─────────────────────────────
  const BOOKINGS_TABLE = 'barber_bookings';

  function _toSupabaseBooking(b) {
    return {
      id: b.id,
      barber_id: b.barberId,
      barber_name: b.barberName,
      service_id: b.serviceId,
      service_name: b.serviceName,
      duration_min: b.durationMin,
      price: b.price,
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
    return {
      id: r.id,
      barberId: r.barber_id,
      barberName: r.barber_name,
      serviceId: r.service_id,
      serviceName: r.service_name,
      durationMin: r.duration_min,
      price: r.price,
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

  /** المواعيد المحجوزة لحلاق في يوم معيّن — من السحابة + الكاش المحلي */
  async function fetchBookedTimes(barberId, dateStr) {
    const local = bookings
      .filter(x => x.barberId === barberId && x.date === dateStr && x.status !== 'cancelled')
      .map(x => x.time);
    const client = getSupabase();
    if (!client) return new Set(local);
    try {
      const { data, error } = await client
        .from(BOOKINGS_TABLE)
        .select('time,status')
        .eq('barber_id', barberId)
        .eq('date', dateStr)
        .neq('status', 'cancelled');
      if (error) {
        console.warn('[Barbers] booked-times pull:', error.message || error);
        return new Set(local);
      }
      const remote = (data || []).map(r => (typeof r.time === 'string' ? r.time.slice(0, 5) : r.time));
      return new Set([...local, ...remote]);
    } catch (e) {
      console.warn('[Barbers] booked-times pull failed', e);
      return new Set(local);
    }
  }

  function getService(barberId, serviceId) {
    const b = getById(barberId);
    if (!b) return null;
    return (b.services || []).find(s => s.id === serviceId) || null;
  }

  /** Generate available time slots for a date — async: يقرأ المحجوز من السحابة */
  async function getSlots(barberId, dateStr) {
    const b = getById(barberId);
    if (!b) return [];
    const date = new Date(dateStr + 'T12:00:00');
    if (Number.isNaN(date.getTime())) return [];
    const day = date.getDay(); // 0 Sun
    if (!(b.workDays || []).includes(day)) return [];

    const booked = await fetchBookedTimes(barberId, dateStr);

    const slots = [];
    const start = b.workStart || 10;
    const end = b.workEnd || 20;
    const step = b.slotMinutes || 30;
    for (let h = start; h < end; h++) {
      for (let m = 0; m < 60; m += step) {
        if (h === end - 1 && m + step > 60) break;
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const totalMin = h * 60 + m;
        if (totalMin + step > end * 60) continue;
        slots.push({ time, available: !booked.has(time) });
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
        return { ...s, available: s.available && !past };
      });
    }
    return slots;
  }

  async function createBooking(payload) {
    const b = getById(payload.barberId);
    if (!b || b.status !== 'approved') {
      return { success: false, error: 'الحلاق غير متاح للحجز' };
    }
    const service = getService(payload.barberId, payload.serviceId);
    if (!service) return { success: false, error: 'الخدمة غير موجودة' };
    if (!payload.customerName || !payload.customerPhone || !payload.date || !payload.time) {
      return { success: false, error: 'بيانات الحجز غير مكتملة' };
    }
    if (!/^01[0-9]{9}$/.test(payload.customerPhone)) {
      return { success: false, error: 'رقم الموبايل غير صحيح' };
    }

    const locationType = payload.locationType === 'home' ? 'home' : 'salon';
    const hs = b.homeService || {};
    if (locationType === 'home') {
      if (!hs.enabled) return { success: false, error: 'الحلاق لا يقدّم خدمة منزلية' };
      if (!(payload.address || '').trim()) return { success: false, error: 'العنوان مطلوب للخدمة المنزلية' };
    }

    const client = getSupabase();
    if (!client) return { success: false, error: 'تعذر الاتصال بالخادم، حاول تاني بعد قليل' };

    const slots = await getSlots(payload.barberId, payload.date);
    const slot = slots.find(s => s.time === payload.time);
    if (!slot || !slot.available) {
      return { success: false, error: 'الموعد غير متاح، اختَر وقت آخر' };
    }

    const travelFee = locationType === 'home' ? (Number(hs.travelFee) || 0) : 0;
    const extraFee = locationType === 'home' ? (Number(hs.extraFee) || 0) : 0;
    const servicePrice = Number(service.price) || 0;
    const totalPrice = servicePrice + travelFee + extraFee;

    const booking = {
      id: 'bk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      barberId: payload.barberId,
      barberName: b.name,
      serviceId: service.id,
      serviceName: service.name,
      durationMin: service.durationMin,
      price: servicePrice,
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
      // الـunique index بيمنع حجزين لنفس الموعد حتى لو اتقدموا في نفس اللحظة
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
      description: String(s.description || '').trim()
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
        { id: 's1', name: 'حلاقة شعر', durationMin: 30, price: 100, description: '' },
        { id: 's2', name: 'ذقن', durationMin: 20, price: 70, description: '' },
        { id: 's3', name: 'شعر + ذقن', durationMin: 45, price: 150, description: '' }
      ],
      createdAt: new Date().toISOString()
    };
    barbers.unshift(barber);
    persistBarbers();
    return { success: true, barber, created: true };
  }


  load();

  return {
    getAll,
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
    getService,
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
