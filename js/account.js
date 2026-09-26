/* ================================================================
   DODDZ ACCOUNT — لوحة حساب الزائر
   مشترياتك / عنوانك / تعديل البيانات / تتبع طلب / خدمة العملاء / خروج
================================================================ */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);

  const state = {
    user: null,
    profile: null,
    role: null,
    ordersLoaded: false
  };

  const STAFF_ROLES = ['seller', 'merchant', 'service_provider', 'admin'];

  const STATUS_LABELS = {
    pending:   { label: 'قيد الانتظار', cls: 'pending' },
    confirmed: { label: 'مؤكد',         cls: 'confirmed' },
    shipping:  { label: 'جاري الشحن',   cls: 'shipping' },
    delivered: { label: 'تم التسليم',   cls: 'delivered' },
    cancelled: { label: 'ملغي',         cls: 'cancelled' }
  };

  function getClient() {
    return (typeof window !== 'undefined' && window.supabaseClient) || null;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (_) { return ''; }
  }

  function isLoggedIn() {
    return !!state.user;
  }

  // ── Header button + fab visibility ────────────────────────────
  function displayName() {
    if (!state.user) return null;
    const full = (state.profile && state.profile.display_name) ||
      localStorage.getItem('doddz_user_name') ||
      (state.user.email || '').split('@')[0];
    return full ? String(full).trim().split(' ')[0] : null;
  }

  function applyAuthUI() {
    const sub = $('#account-btn-sub');
    const label = $('#account-btn-label');
    if (state.user) {
      if (sub) sub.textContent = displayName() || 'حسابي';
      if (label) label.textContent = 'حسابي';
    } else {
      if (sub) sub.textContent = 'تسجيل دخول';
      if (label) label.textContent = 'حسابي';
    }

    // الأدمن بس اللي يشوف لوحة الأدمن — باقي الحسابات الإدارية لها لوحة البائع
    const role = state.user ? (state.role || localStorage.getItem('doddz_user_role') || 'visitor') : null;
    const isStaff = !!role && STAFF_ROLES.includes(role);
    const isAdmin = role === 'admin';

    const sellerFab = $('#seller-fab');
    // الزرار يفضل ظاهر لغير المسجلين (لأن منه بيتم تسجيل التجار والحلّاقين الجدد)،
    // وبيختفي لحساب الزائر المسجّل — اللي ليه يشتري ويستخدم الخدمات بس.
    if (sellerFab) sellerFab.style.display = (state.user && !isStaff) ? 'none' : '';

    const staffNav = $('#account-nav-staff');
    if (staffNav) staffNav.hidden = !isStaff;
    if (staffNav?.hidden && $('.account-nav-btn.active') === staffNav) switchTab('orders');

    const sellerBtn = $('#acc-open-seller');
    if (sellerBtn) sellerBtn.hidden = !isStaff;
    const adminBtn = $('#acc-open-admin');
    if (adminBtn) adminBtn.hidden = !isAdmin;
  }

  async function loadProfile() {
    const client = getClient();
    if (!client || !state.user) return;
    try {
      const { data } = await client
        .from('profiles')
        .select('role,display_name,phone,governorate,area,street,building,floor')
        .eq('id', state.user.id)
        .maybeSingle();
      state.profile = data || null;
      state.role = data?.role || localStorage.getItem('doddz_user_role') || 'visitor';
      if (data?.role) {
        try { localStorage.setItem('doddz_user_role', data.role); } catch (_) {}
      }
    } catch (_) {
      state.profile = null;
      state.role = localStorage.getItem('doddz_user_role') || 'visitor';
    }
  }

  // ── Panel open/close ──────────────────────────────────────────
  function open() {
    const overlay = $('#account-overlay');
    if (!overlay || !state.user) return;
    renderHead();
    fillAddressForm();
    fillSettingsForm();
    state.ordersLoaded = false;
    loadOrders();
    overlay.classList.add('open');
  }

  function close() {
    $('#account-overlay')?.classList.remove('open');
  }

  function renderHead() {
    const name = (state.profile && state.profile.display_name) ||
      localStorage.getItem('doddz_user_name') || 'زائر';
    const email = state.user?.email || '';
    $('#account-user-name').textContent = name;
    $('#account-user-email').textContent = email;
    $('#account-avatar').textContent = (name || '؟').trim().slice(0, 1);
  }

  function switchTab(tab) {
    document.querySelectorAll('.account-nav-btn[data-account-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.accountTab === tab);
    });
    document.querySelectorAll('.account-view').forEach(view => {
      view.classList.toggle('active', view.id === 'account-view-' + tab);
    });
    if (tab === 'orders' && !state.ordersLoaded) loadOrders();
  }

  // ── مشترياتك ─────────────────────────────────────────────────
  async function loadOrders() {
    const client = getClient();
    const box = $('#account-orders-list');
    if (!box || !client || !state.user) return;
    box.innerHTML = '<div class="account-orders-empty">جاري تحميل طلباتك...</div>';

    const { data, error } = await client
      .from('orders')
      .select('id,status,total,delivery_fee,items_subtotal,payment_method,customer_area,customer_address,created_at,order_items(product_name,quantity,unit_price,line_total,product_image)')
      .eq('customer_user_id', state.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('[Account] loadOrders:', error);
      box.innerHTML = '<div class="account-orders-empty">تعذر تحميل الطلبات حاليًا.<br/>جرّب تاني بعد قليل.</div>';
      return;
    }
    state.ordersLoaded = true;

    if (!data || !data.length) {
      box.innerHTML = '<div class="account-orders-empty">لسه مفيش طلبات من حسابك.<br/>أي طلب هتعمله وانت مسجّل دخولك هيظهر هنا.</div>';
      return;
    }

    box.innerHTML = data.map(o => {
      const st = STATUS_LABELS[o.status] || { label: o.status || '—', cls: 'pending' };
      const ref = String(o.id || '').slice(-8).toUpperCase();
      const items = (o.order_items || []).map(it => `
        <div class="account-order-item">
          ${it.product_image ? `<img src="${esc(it.product_image)}" alt="" loading="lazy"/>` : ''}
          <span>${esc(it.product_name)}</span>
          <span class="qty">×${Number(it.quantity) || 1}</span>
          <span class="line">${Number(it.line_total || 0).toLocaleString()} ج.م</span>
        </div>
      `).join('');
      return `
        <div class="account-order">
          <button type="button" class="account-order-head" data-order-toggle="${esc(o.id)}">
            <span class="account-order-ref">#${ref}</span>
            <span class="account-order-date">${fmtDate(o.created_at)}</span>
            <span class="account-order-badge ${st.cls}">${st.label}</span>
            <span class="account-order-total">${Number(o.total || 0).toLocaleString()} ج.م</span>
          </button>
          <div class="account-order-details" id="account-order-details-${esc(o.id)}" hidden>
            ${items || '<div class="account-order-item">لا توجد تفاصيل</div>'}
            <div class="account-order-meta">
              <span>الدفع: ${o.payment_method === 'cash' ? 'عند الاستلام' : esc(o.payment_method || '—')}</span>
              ${o.customer_area ? `<span>المنطقة: ${esc(o.customer_area)}</span>` : ''}
              ${o.customer_address ? `<span>العنوان: ${esc(o.customer_address)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── عنوانك ───────────────────────────────────────────────────
  function fillAddressForm() {
    const p = state.profile || {};
    if ($('#acc-governorate')) $('#acc-governorate').value = p.governorate || '';
    if ($('#acc-area')) $('#acc-area').value = p.area || '';
    if ($('#acc-street')) $('#acc-street').value = p.street || '';
    if ($('#acc-building')) $('#acc-building').value = p.building || '';
    if ($('#acc-floor')) $('#acc-floor').value = p.floor || '';
  }

  function showMsg(el, text, ok) {
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    el.classList.toggle('ok', !!ok);
    el.classList.toggle('error', !ok);
  }

  async function saveAddress() {
    const client = getClient();
    const msg = $('#acc-address-msg');
    if (!client || !state.user) return;
    const payload = {
      id: state.user.id,
      governorate: $('#acc-governorate').value.trim() || null,
      area:        $('#acc-area').value.trim() || null,
      street:      $('#acc-street').value.trim() || null,
      building:    $('#acc-building').value.trim() || null,
      floor:       $('#acc-floor').value.trim() || null
    };
    const btn = $('#acc-address-save');
    btn.disabled = true;
    const { error } = await client.from('profiles').upsert([payload], { onConflict: 'id' });
    btn.disabled = false;
    if (error) {
      console.warn('[Account] saveAddress:', error);
      showMsg(msg, 'تعذر حفظ العنوان. جرّب تاني.', false);
      return;
    }
    state.profile = { ...(state.profile || {}), ...payload };
    showMsg(msg, 'تم حفظ العنوان — هيتملّى تلقائيًا في الطلبات الجاية ✓', true);
  }

  // ── تعديل البيانات ───────────────────────────────────────────
  function fillSettingsForm() {
    const p = state.profile || {};
    if ($('#acc-display-name')) $('#acc-display-name').value = p.display_name || localStorage.getItem('doddz_user_name') || '';
    if ($('#acc-phone')) $('#acc-phone').value = p.phone || localStorage.getItem('doddz_user_phone') || '';
    if ($('#acc-email')) $('#acc-email').value = state.user?.email || '';
  }

  async function saveSettings() {
    const client = getClient();
    const msg = $('#acc-settings-msg');
    if (!client || !state.user) return;

    const name = $('#acc-display-name').value.trim();
    const phone = $('#acc-phone').value.trim();
    const newEmail = $('#acc-email').value.trim();
    const pw1 = $('#acc-password').value;
    const pw2 = $('#acc-password2').value;

    if (!name) return showMsg(msg, 'الاسم مطلوب', false);
    if (phone && !/^01[0-9]{9}$/.test(phone)) return showMsg(msg, 'رقم الموبايل غير صحيح (01xxxxxxxxx)', false);
    if (pw1 || pw2) {
      if (pw1.length < 6) return showMsg(msg, 'كلمة المرور الجديدة لازم 6 أحرف على الأقل', false);
      if (pw1 !== pw2) return showMsg(msg, 'كلمتا المرور غير متطابقتين', false);
    }
    if (newEmail && newEmail !== state.user.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
      return showMsg(msg, 'صيغة الإيميل غير صحيحة', false);
    }

    const btn = $('#acc-settings-save');
    btn.disabled = true;
    const notes = [];

    const { error: profErr } = await client.from('profiles').upsert([{
      id: state.user.id,
      display_name: name,
      phone: phone || null
    }], { onConflict: 'id' });
    if (profErr) {
      console.warn('[Account] saveSettings profile:', profErr);
      btn.disabled = false;
      return showMsg(msg, 'تعذر حفظ البيانات. جرّب تاني.', false);
    }
    state.profile = { ...(state.profile || {}), display_name: name, phone };
    try { localStorage.setItem('doddz_user_name', name); } catch (_) {}
    try { phone ? localStorage.setItem('doddz_user_phone', phone) : localStorage.removeItem('doddz_user_phone'); } catch (_) {}

    if (newEmail && newEmail !== state.user.email) {
      const { error: mailErr } = await client.auth.updateUser({ email: newEmail });
      if (mailErr) {
        console.warn('[Account] updateUser email:', mailErr);
        notes.push('تعذر تغيير الإيميل (' + (mailErr.message || '') + ')');
      } else {
        notes.push('تم إرسال رابط تأكيد للإيميل الجديد — التغيير هيتم بعد التأكيد');
      }
    }

    if (pw1) {
      const { error: pwErr } = await client.auth.updateUser({ password: pw1 });
      if (pwErr) {
        console.warn('[Account] updateUser password:', pwErr);
        notes.push('تعذر تغيير كلمة المرور — سجّل دخولك من جديد وحاول تاني');
      } else {
        notes.push('تم تغيير كلمة المرور');
        $('#acc-password').value = '';
        $('#acc-password2').value = '';
      }
    }

    btn.disabled = false;
    renderHead();
    applyAuthUI();
    const failed = notes.some(n => n.startsWith('تعذر'));
    showMsg(msg, notes.length ? notes.join(' — ') : 'تم حفظ بياناتك ✓', !failed);
  }

  // ── تتبع طلب ─────────────────────────────────────────────────
  async function trackOrder() {
    const client = getClient();
    const msg = $('#acc-track-msg');
    const resultBox = $('#acc-track-result');
    if (!client) return;
    const ref = $('#acc-track-ref').value.trim();
    const phone = $('#acc-track-phone').value.trim();
    if (!ref) return showMsg(msg, 'اكتب رقم الأوردر (الرقم المرجعي)', false);
    if (!/^01[0-9]{9}$/.test(phone)) return showMsg(msg, 'اكتب رقم الموبايل المستخدم في الطلب (01xxxxxxxxx)', false);
    showMsg(msg, '', true);
    msg.classList.remove('show');
    resultBox.innerHTML = '<div class="account-orders-empty">جاري البحث...</div>';

    const btn = $('#acc-track-btn');
    btn.disabled = true;
    const { data, error } = await client.rpc('track_order', { p_order_id: ref, p_phone: phone });
    btn.disabled = false;

    if (error) {
      console.warn('[Account] trackOrder:', error);
      resultBox.innerHTML = '';
      return showMsg(msg, 'تعذر البحث حاليًا. جرّب تاني بعد قليل.', false);
    }
    if (!data) {
      resultBox.innerHTML = '';
      return showMsg(msg, 'مفيش طلب بالبيانات دي — تأكد من رقم الأوردر ورقم الموبايل', false);
    }

    const st = STATUS_LABELS[data.status] || { label: data.status || '—', cls: 'pending' };
    const items = (data.items || []).map(it => `
      <div class="account-order-item">
        <span>${esc(it.product_name)}</span>
        <span class="qty">×${Number(it.quantity) || 1}</span>
        <span class="line">${Number(it.line_total || 0).toLocaleString()} ج.م</span>
      </div>
    `).join('');

    resultBox.innerHTML = `
      <div class="account-track-card">
        <div class="account-track-status-row">
          <span class="account-track-ref">#${esc(data.ref || ref)}</span>
          <span class="account-order-badge ${st.cls}">${st.label}</span>
          <span class="account-order-total">${Number(data.total || 0).toLocaleString()} ج.م</span>
        </div>
        ${items}
        <div class="account-order-meta">
          <span>تاريخ الطلب: ${fmtDate(data.created_at)}</span>
          <span>الدفع: ${data.payment_method === 'cash' ? 'عند الاستلام' : esc(data.payment_method || '—')}</span>
          ${data.customer_area ? `<span>المنطقة: ${esc(data.customer_area)}</span>` : ''}
        </div>
      </div>
    `;
  }

  // ── تسجيل الخروج ─────────────────────────────────────────────
  async function logout() {
    const client = getClient();
    if (client) {
      try { await client.auth.signOut(); } catch (_) {}
    }
    try {
      localStorage.removeItem('doddz_user_role');
      localStorage.removeItem('doddz_user_name');
      localStorage.removeItem('doddz_user_phone');
    } catch (_) {}
    close();
  }

  // ── Auth state ────────────────────────────────────────────────
  async function refreshSession() {
    const client = getClient();
    if (!client) return;
    try {
      const { data } = await client.auth.getSession();
      state.user = data?.session?.user || null;
    } catch (_) {
      state.user = null;
    }
    if (state.user) {
      await loadProfile();
    } else {
      state.profile = null;
      state.role = null;
    }
    applyAuthUI();
  }

  function wire() {
    $('#account-close')?.addEventListener('click', close);
    $('#account-overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) close();
    });
    document.querySelectorAll('.account-nav-btn[data-account-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.accountTab));
    });
    $('#account-orders-list')?.addEventListener('click', (e) => {
      const head = e.target.closest('[data-order-toggle]');
      if (!head) return;
      const details = document.getElementById('account-order-details-' + head.dataset.orderToggle);
      if (details) details.hidden = !details.hidden;
    });
    $('#acc-address-save')?.addEventListener('click', saveAddress);
    $('#acc-settings-save')?.addEventListener('click', saveSettings);
    $('#acc-track-btn')?.addEventListener('click', trackOrder);
    $('#account-logout-btn')?.addEventListener('click', logout);
    $('#acc-open-seller')?.addEventListener('click', () => {
      close();
      if (window.DoddzSeller?.open) { window.DoddzSeller.open(); return; }
      $('#seller-fab')?.click();
    });
    $('#acc-open-admin')?.addEventListener('click', () => {
      close();
      window.DoddzAdmin?.open?.();
    });

    const client = getClient();
    if (client) {
      client.auth.onAuthStateChange((_event, session) => {
        state.user = session?.user || null;
        if (state.user) {
          loadProfile().then(applyAuthUI);
        } else {
          state.profile = null;
          state.role = null;
          applyAuthUI();
        }
      });
    }
    refreshSession().finally(() => resolveReady());
  }

  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });

  document.addEventListener('DOMContentLoaded', wire);

  window.DoddzAccount = {
    open,
    close,
    isLoggedIn,
    displayName,
    whenReady: () => ready,
    getUser: () => state.user,
    getProfile: () => state.profile
  };
})();
