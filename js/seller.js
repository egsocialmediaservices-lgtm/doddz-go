// ================================================================
// SELLER / MERCHANT PANEL — واجهة التاجر أو الزائر البائع
// ================================================================
// حساب البائع بيتعمله الأدمن يدوياً من Supabase (Authentication → Add user)،
// وبيتسجّل تلقائياً بدور "seller" في جدول profiles (الافتراضي).
// أي منتج يضيفه هنا بيتحط "قيد المراجعة" تلقائياً — مش بقرار من الكود ده،
// لكن بفرض من trigger على مستوى القاعدة نفسها (enforce_seller_product_insert)،
// يعني حتى لو حد عدّل الكود من عنده، النظام مش هيصدّقه.
// ================================================================
(function () {
  const $ = (sel) => document.querySelector(sel);

  const sellerFab = $('#seller-fab');
  if (!sellerFab) return; // الزرار مش موجود في الصفحة دي (مثلاً product.html)

  // ── Entry choice: دخول ولا طلب انضمام جديد ──────────────────
  const entryOverlay    = $('#seller-entry-overlay');
  const entryLoginBtn   = $('#seller-entry-login-btn');
  const entrySignupBtn  = $('#seller-entry-signup-btn');
  const entryCancelBtn  = $('#seller-entry-cancel');

  // ── Signup request form ──────────────────────────────────────
  const signupOverlay   = $('#seller-signup-overlay');
  const signupForm      = $('#seller-signup-form');
  const signupErrors    = $('#seller-signup-errors');
  const signupSubmitBtn = $('#seller-signup-submit');
  const signupCancelBtn = $('#seller-signup-cancel');
  const signupSuccessEl = $('#seller-signup-success');
  const signupDoneBtn   = $('#seller-signup-done');

  // ── Login overlay ───────────────────────────────────────────
  const loginOverlay   = $('#seller-login-overlay');
  const loginForm      = $('#seller-login-form');
  const loginEmail     = $('#seller-login-email');
  const loginPassword  = $('#seller-login-password');
  const loginErrors    = $('#seller-login-errors');
  const loginSubmitBtn = $('#seller-login-submit');
  const loginCancelBtn = $('#seller-login-cancel');

  // ── Panel ─────────────────────────────────────────────────────
  const panelOverlay   = $('#seller-overlay');
  const panelClose     = $('#seller-close');
  const logoutBtn      = $('#seller-logout-btn');
  const tabMine        = $('#seller-tab-mine');
  const tabAdd         = $('#seller-tab-add');
  const viewMine       = $('#seller-view-mine');
  const viewAdd        = $('#seller-view-add');
  const statsEl        = $('#seller-stats');
  const refreshBtn     = $('#seller-refresh-btn');
  const productsListEl = $('#seller-products-list');

  // ── Add-product form ─────────────────────────────────────────
  const form          = $('#seller-form');
  const errorsEl       = $('#seller-errors');
  const submitBtn      = $('#seller-submit-btn');
  const imagesInput    = $('#sf-images');
  const imagePreviews  = $('#sf-image-previews');

  let sellerImages = [];
  let primaryImageIndex = 0;
  let currentUserId = null;
  let currentProviderType = null;
  let currentCategory = null;      // barbers | carwash | handmade | merchants
  let currentProviderId = null;    // معرّف صف النشاط في جدول القسم

  function getClient() {
    return (typeof window !== 'undefined' && window.supabaseClient) ? window.supabaseClient : null;
  }

  function notify(msg) {
    if (typeof showToast === 'function') { showToast(msg); return; }
    alert(msg);
  }

  // ── فتح التدفق: لو فيه جلسة شغالة يفتح اللوحة على طول، غير كده شاشة الدخول ──
  async function openFlow() {
    const client = getClient();
    if (!client) { notify('تعذر الاتصال بالخادم، حاول تاني بعد قليل'); return; }
    const { data } = await client.auth.getSession();
    if (data?.session) {
      currentUserId = data.session.user.id;
      openPanel();
    } else {
      showEntryChoice();
    }
  }

  function showEntryChoice() { entryOverlay.classList.add('open'); }
  function closeEntryChoice() { entryOverlay.classList.remove('open'); }

  function showLogin() {
    loginErrors.classList.remove('show');
    loginErrors.innerHTML = '';
    loginForm.reset();
    loginOverlay.classList.add('open');
  }
  function closeLogin() { loginOverlay.classList.remove('open'); }

  function openPanel() {
    panelOverlay.classList.add('open');
    switchTab('mine');
    loadMyProducts();
    fetchProviderType();
    loadMyBiz();
  }
  function closePanel() { panelOverlay.classList.remove('open'); }

  /** نشاط الحساب من Supabase (جدول القسم) → يحدّد التابات الظاهرة */
  async function loadMyBiz() {
    const S = window.SectionsStore;
    if (!S) return null;
    try {
      if (S.whenReady) await S.whenReady();
      const me = await S.myProvider();
      if (me) {
        currentCategory = me.section;
        currentProviderId = (me.row && me.row.id) || null;
      } else {
        currentCategory = S.mySection ? S.mySection() : null;
        currentProviderId = null;
      }
    } catch (err) {
      console.warn('[Seller] loadMyBiz:', err);
    }
    applySectionTabs();
    renderMyBiz();
    return currentCategory;
  }

  /** تابات «حجوزاتي / خدماتي / الخدمة المنزلية» لأصحاب قسم قصها بس،
   *  و«نشاطي» لأي حساب ليه نشاط في قسم. */
  function applySectionTabs() {
    const isBarber = currentCategory === 'barbers';
    const barberOnly = [$('#seller-tab-barber-bookings'), $('#seller-tab-barber-services'), $('#seller-tab-barber-home')];
    barberOnly.forEach(el => { if (el) el.hidden = !isBarber; });
    const bizTab = $('#seller-tab-biz');
    if (bizTab) bizTab.hidden = !currentProviderId;
    if (!isBarber && panelOverlay?.classList.contains('open')) {
      const active = document.querySelector('.adm-tab.active');
      if (active && active.dataset.tab === 'barber-bookings') { switchTab('mine'); loadMyProducts(); }
    }
  }

  async function fetchProviderType() {
    const client = getClient();
    if (!client || !currentUserId) return;
    const { data, error } = await client
      .from('profiles')
      .select('provider_type')
      .eq('id', currentUserId)
      .single();
    if (error) { currentProviderType = null; return; }
    currentProviderType = data?.provider_type || null;
  }

  function switchTab(tab) {
    const tabs = {
      mine: $('#seller-tab-mine'),
      add: $('#seller-tab-add'),
      'barber-bookings': $('#seller-tab-barber-bookings'),
      'barber-services': $('#seller-tab-barber-services'),
      'barber-home': $('#seller-tab-barber-home'),
      biz: $('#seller-tab-biz')
    };
    const views = {
      mine: viewMine,
      add: viewAdd,
      'barber-bookings': $('#seller-view-barber-bookings'),
      'barber-services': $('#seller-view-barber-services'),
      'barber-home': $('#seller-view-barber-home'),
      biz: $('#seller-view-biz')
    };
    // الأقسام المخفية ما تتفعّlesh — لو المستخدم طلب تاب مقفول نرجع لمنتجاتي
    if (!tabs[tab]) tab = 'mine';
    Object.keys(tabs).forEach(k => {
      if (tabs[k]) tabs[k].classList.toggle('active', k === tab);
    });
    Object.keys(views).forEach(k => {
      if (views[k]) views[k].classList.toggle('active', k === tab);
    });
  }

  function resolveMyBarber() {
    if (typeof BarberStore === 'undefined') return null;
    if (currentUserId) {
      const byUser = BarberStore.getByUserId(currentUserId);
      if (byUser) return byUser;
    }
    // لو مفيش ربط userId: أول حلاق معتمد (تجربة محلية)
    const approved = BarberStore.getApproved();
    return approved[0] || null;
  }

  async function renderSellerBarberBookings() {
    const listEl = $('#seller-barber-bookings-list');
    const stats = $('#seller-barber-bookings-stats');
    if (!listEl || typeof BarberStore === 'undefined') return;
    const barber = resolveMyBarber();
    if (!barber) {
      listEl.innerHTML = '<div class="adm-empty">لا يوجد ملف حلاق مرتبط بحسابك بعد. بعد موافقة الأدمن على طلب «حلاق» هيظهر هنا.</div>';
      if (stats) stats.textContent = 'لا يوجد حلاق';
      return;
    }
    if (currentUserId && !barber.userId) {
      BarberStore.linkUser(barber.id, currentUserId);
    }
    await BarberStore.refreshBookings();
    const rows = BarberStore.getBookingsByBarber(barber.id);
    if (stats) stats.textContent = `${barber.name} · ${rows.length} حجز`;
    if (!rows.length) {
      listEl.innerHTML = '<div class="adm-empty">لسه مفيش حجوزات</div>';
      return;
    }
    listEl.innerHTML = rows.map(bk => {
      const loc = bk.locationType === 'home' ? '🏠 منزلي' : '🏪 صالون';
      const cls = bk.status === 'pending' ? 'pending' : bk.status === 'confirmed' ? 'delivered' : 'cancelled';
      const label = bk.status === 'pending' ? 'قيد التأكيد' : bk.status === 'confirmed' ? 'مؤكد' : 'ملغي';
      const total = bk.totalPrice != null ? bk.totalPrice : bk.price;
      return `<div class="adm-order-card">
        <div class="adm-order-head">
          <div class="adm-order-head-main">
            <strong>${bk.customerName}</strong>
            <span class="adm-order-date">${bk.date} ${bk.time} · ${loc} · ${bk.serviceName}</span>
            <span class="adm-order-date">${bk.customerPhone}${bk.address ? ' · ' + bk.address : ''} · ${Number(total || 0).toLocaleString()} ج</span>
          </div>
          <div class="adm-order-head-side">
            <span class="adm-order-badge ${cls}">${label}</span>
          </div>
        </div>
        <div class="adm-row-actions" style="padding:8px 12px;">
          ${bk.status === 'pending' ? `<button type="button" class="adm-btn" data-sb-confirm="${bk.id}">تأكيد</button>` : ''}
          ${bk.status !== 'cancelled' ? `<button type="button" class="adm-btn secondary" data-sb-cancel="${bk.id}">إلغاء</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  function renderSellerBarberServicesEditor() {
    const box = $('#seller-barber-services-editor');
    if (!box || typeof BarberStore === 'undefined') return;
    const barber = resolveMyBarber();
    if (!barber) {
      box.innerHTML = '<div class="adm-empty">لا يوجد ملف حلاق مرتبط</div>';
      return;
    }
    const services = barber.services || [];
    box.innerHTML = services.map((s, i) => `
      <div class="adm-form-grid" data-svc-row style="margin-bottom:10px;border:1px solid #eee;border-radius:10px;padding:10px;">
        <div class="adm-field"><label>الاسم</label><input type="text" data-svc-name value="${s.name || ''}"/></div>
        <div class="adm-field"><label>المدة (د)</label><input type="number" data-svc-duration min="5" value="${s.durationMin || 30}"/></div>
        <div class="adm-field"><label>السعر</label><input type="number" data-svc-price min="0" value="${s.price || 0}"/></div>
        <div class="adm-field"><label>وصف</label><input type="text" data-svc-desc value="${s.description || ''}"/></div>
        <input type="hidden" data-svc-id value="${s.id || ('s'+(i+1))}"/>
      </div>
    `).join('') || '<div class="adm-empty">لا توجد خدمات</div>';
  }

  function loadSellerBarberHomeForm() {
    const barber = resolveMyBarber();
    if (!barber || typeof BarberStore === 'undefined') return;
    const hs = barber.homeService || {};
    const en = $('#sb-home-enabled');
    if (en) en.checked = !!hs.enabled;
    const areas = $('#sb-home-areas');
    if (areas) areas.value = (hs.areas || []).join('، ');
    const tr = $('#sb-home-travel');
    if (tr) tr.value = hs.travelFee || 0;
    const ex = $('#sb-home-extra');
    if (ex) ex.value = hs.extraFee || 0;
    const note = $('#sb-home-note');
    if (note) note.value = hs.note || '';
  }


  // ── قايمة منتجاتي — استعلام مباشر بمنتجات صاحب الحساب فقط (مش عبر
  //    الكاش العام لـProductStore، عشان تفضل دقيقة ومحدّثة دايماً) ──
  const REVIEW_STATUS_LABELS = {
    pending:  { label: 'قيد المراجعة', cls: 'pending' },
    approved: { label: 'مقبول',        cls: 'delivered' },
    rejected: { label: 'مرفوض',        cls: 'cancelled' }
  };

  async function loadMyProducts() {
    const client = getClient();
    if (!client || !currentUserId) return;

    productsListEl.innerHTML = `<div class="adm-empty">جارِ التحميل...</div>`;

    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('owner_id', currentUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Seller] فشل تحميل منتجاتك:', error);
      productsListEl.innerHTML = `<div class="adm-empty">تعذر تحميل منتجاتك</div>`;
      return;
    }

    const products = data || [];
    statsEl.textContent = `الإجمالي: ${products.length} منتج`;

    if (!products.length) {
      productsListEl.innerHTML = `<div class="adm-empty">لسه معملتش أي منتج — دوس "➕ إضافة منتج"</div>`;
      return;
    }

    productsListEl.innerHTML = products.map(p => {
      const statusInfo = REVIEW_STATUS_LABELS[p.status] || { label: p.status || '—', cls: 'pending' };
      return `
        <div class="adm-order-card">
          <div class="adm-order-head">
            <div class="adm-order-head-main">
              <strong>${p.name}</strong>
              <span class="adm-order-date">${p.category || '—'} · ${(p.price || 0).toLocaleString()} ج</span>
            </div>
            <div class="adm-order-head-side">
              <span class="adm-order-badge ${statusInfo.cls}">${statusInfo.label}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── إضافة منتج ───────────────────────────────────────────────
  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const maxSide = 1000;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image conversion failed')), 'image/jpeg', 0.78);
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderImagePreviews() {
    imagePreviews.innerHTML = sellerImages.map((src, index) => `
      <div class="adm-image-preview ${index === primaryImageIndex ? 'primary' : ''}">
        <img src="${ProductStore.getImageSrc(src)}" alt="معاينة صورة ${index + 1}">
        <button type="button" class="adm-image-remove" data-remove-image="${index}" title="حذف الصورة">×</button>
        <label class="adm-image-primary"><input type="radio" name="seller-primary-image" value="${index}" ${index === primaryImageIndex ? 'checked' : ''}> أساسية</label>
      </div>`).join('');
  }

  function normalizeOfferingType(val) {
    if (val === 'service') return 'service';
    if (val === 'classified') return 'classified';
    return 'physical'; // 'product' أو أي قيمة أخرى تعامل كـ 'physical'
  }

  function initOfferingTypeSelect() {
    const offeringSelect = $('#sf-offering-type');
    if (!offeringSelect) return;
    if (!offeringSelect.querySelector('option[value="classified"]')) {
      const opt = document.createElement('option');
      opt.value = 'classified';
      opt.textContent = 'إعلان بيع';
      offeringSelect.appendChild(opt);
    }
  }

  function updateOfferingFields() {
    const offeringSelect = $('#sf-offering-type');
    if (!offeringSelect) return;
    const type = normalizeOfferingType(offeringSelect.value);
    const stockField = $('#sf-stock')?.closest('.adm-field');
    const nameLabel  = $('#sf-name')?.closest('.adm-field')?.querySelector('label');
    const imgLabel   = $('.adm-image-upload label');

    if (type === 'physical') {
      if (stockField) {
        stockField.style.display = '';
        $('#sf-stock')?.setAttribute('required', '');
      }
      if (nameLabel) nameLabel.textContent = 'اسم المنتج *';
      if (imgLabel)  imgLabel.textContent  = 'صور المنتج';
    } else if (type === 'service') {
      if (stockField) {
        stockField.style.display = 'none';
        $('#sf-stock')?.removeAttribute('required');
        const stockInput = $('#sf-stock');
        if (stockInput) stockInput.value = '';
      }
      if (nameLabel) nameLabel.textContent = 'اسم الخدمة *';
      if (imgLabel)  imgLabel.textContent  = 'صور الخدمة';
    } else if (type === 'classified') {
      if (stockField) {
        stockField.style.display = 'none';
        $('#sf-stock')?.removeAttribute('required');
        const stockInput = $('#sf-stock');
        if (stockInput) stockInput.value = '';
      }
      if (nameLabel) nameLabel.textContent = 'عنوان الإعلان *';
      if (imgLabel)  imgLabel.textContent  = 'صور الإعلان';
    }
  }

  function clearAddForm() {
    form.reset();
    sellerImages = [];
    primaryImageIndex = 0;
    renderImagePreviews();
    errorsEl.classList.remove('show');
    errorsEl.innerHTML = '';
    const offeringSelect = $('#sf-offering-type');
    if (offeringSelect) {
      offeringSelect.value = currentProviderType === 'service_provider' ? 'service' : 'product';
    }
    updateOfferingFields();
  }

  imagesInput?.addEventListener('change', async () => {
    const newFiles = Array.from(imagesInput.files || []);
    const availableSlots = 5 - sellerImages.length;
    if (!availableSlots) {
      notify('تم الوصول إلى الحد الأقصى: 5 صور');
      imagesInput.value = '';
      return;
    }
    const acceptedFiles = newFiles.slice(0, availableSlots);
    if (newFiles.length > acceptedFiles.length) notify('تمت إضافة أول 5 صور فقط');
    try {
      sellerImages.push(...await Promise.all(acceptedFiles.map(readImageFile)));
      renderImagePreviews();
    } catch {
      notify('تعذّر قراءة إحدى الصور');
    }
    imagesInput.value = '';
  });

  imagePreviews?.addEventListener('click', (e) => {
    const removeIndex = e.target.closest('[data-remove-image]')?.dataset.removeImage;
    if (removeIndex === undefined) return;
    sellerImages.splice(Number(removeIndex), 1);
    if (primaryImageIndex >= sellerImages.length) primaryImageIndex = Math.max(0, sellerImages.length - 1);
    renderImagePreviews();
  });

  imagePreviews?.addEventListener('change', (e) => {
    if (e.target.name === 'seller-primary-image') {
      primaryImageIndex = Number(e.target.value);
      renderImagePreviews();
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const client = getClient();
    if (!client) { notify('تعذر الاتصال بالخادم، حاول تاني بعد قليل'); return; }

    const rawOfferingType = $('#sf-offering-type')?.value;
    const offeringType    = normalizeOfferingType(rawOfferingType);
    const isPhysical      = offeringType === 'physical';
    const isService       = offeringType === 'service';

    const name        = $('#sf-name').value.trim();
    const category    = $('#sf-category').value.trim();
    const price       = $('#sf-price').value;
    const description = $('#sf-description').value.trim();

    // التحقق من الحقول الأساسية
    if (!name || !category || !price) {
      errorsEl.innerHTML = '• يرجى استكمال البيانات المطلوبة (الاسم، التصنيف، السعر)';
      errorsEl.classList.add('show');
      return;
    }

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      errorsEl.innerHTML = '• يرجى إدخال سعر صحيح أكبر من 0';
      errorsEl.classList.add('show');
      return;
    }

    // التحقق من المخزون: للمنتجات الفيزيائية فقط، وتمرير 1 كحل توافق مؤقت للأنواع الأخرى
    let stockValue = 1;
    if (isPhysical) {
      const rawStock = $('#sf-stock').value;
      if (rawStock === '' || isNaN(Number(rawStock)) || Number(rawStock) < 0) {
        errorsEl.innerHTML = '• يرجى إدخال كمية المخزون (0 أو أكبر)';
        errorsEl.classList.add('show');
        return;
      }
      stockValue = Math.max(0, Math.floor(Number(rawStock)));
    }

    // ── توليد Product ID قبل الرفع ────────────────────────────
    const productId = ProductStore.generateId();

    // ── رفع الصور إلى Storage (إن وجدت) ──────────────────────
    let primaryUrl     = null;
    let additionalUrls = [];
    let uploadedPaths  = [];

    submitBtn.disabled = true;
    errorsEl.classList.remove('show');
    errorsEl.innerHTML = '';

    if (sellerImages.length) {
      submitBtn.textContent = 'جارِ رفع الصور...';

      // نبني مصفوفة مرتبة: primary أولاً
      const orderedBlobs = [
        sellerImages[primaryImageIndex],
        ...sellerImages.filter((_, i) => i !== primaryImageIndex)
      ].filter(Boolean);

      try {
        const uploadResult = await ProductStore.uploadProductImages(client, {
          blobs: orderedBlobs,
          primaryIndex: 0,        // بعد ما رتبناهم، الأساسي هو دائماً index 0
          productId
        });
        primaryUrl     = uploadResult.primaryUrl;
        additionalUrls = uploadResult.additionalUrls;
        uploadedPaths  = uploadResult._uploadedPaths || [];
      } catch (uploadErr) {
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 إرسال للمراجعة';
        errorsEl.innerHTML = `• ${uploadErr.message}`;
        errorsEl.classList.add('show');
        return;
      }
    }

    submitBtn.textContent = 'جارِ الإرسال...';

    // ── بناء الـ payload بـ URLs فقط (لا Blobs) ودون إرسال ownerId ──
    const payload = {
      id: productId,
      name,
      category,
      price: priceNum,
      stock: stockValue,
      description,
      imageUrl: primaryUrl,
      images:   additionalUrls.filter(Boolean),
      section:  isService ? 'services' : 'sell',
      productType: offeringType,
      source: 'merchant',
      // المنتج يتبع نشاط صاحب الحساب في جدول القسم (لو مسجّل)
      providerId: currentProviderId || null,
      // القاعدة (trigger) هي التي تفرض: owner_id = auth.uid() و status = 'pending'
      status: 'pending'
    };

    const result = await ProductStore.save(payload);

    submitBtn.disabled = false;
    submitBtn.textContent = '📤 إرسال للمراجعة';

    if (!result.success) {
      // فشل INSERT — cleanup الصور التي تم رفعها في هذه العملية
      if (uploadedPaths.length) {
        try {
          await client.storage.from('product-images').remove(uploadedPaths);
          console.info('[Seller] Cleanup: removed', uploadedPaths.length, 'orphan file(s) after failed product save');
        } catch (cleanupErr) {
          console.error('[Seller] Cleanup after failed save:', cleanupErr);
        }
      }
      errorsEl.innerHTML = result.errors.map(err => `• ${err}`).join('<br/>');
      errorsEl.classList.add('show');
      return;
    }

    await ProductStore.flush();
    notify('تم إرسال إعلانك للمراجعة ✅');
    clearAddForm();
    switchTab('mine');
    loadMyProducts();
  });

  // ── Events ───────────────────────────────────────────────────
  sellerFab?.addEventListener('click', openFlow);
  window.DoddzSeller = { open: openFlow };

  // شاشة الاختيار (دخول ولا طلب انضمام)
  entryLoginBtn?.addEventListener('click', () => {
    closeEntryChoice();
    showLogin();
  });
  entrySignupBtn?.addEventListener('click', () => {
    closeEntryChoice();
    showSignupForm();
  });
  entryCancelBtn?.addEventListener('click', closeEntryChoice);
  entryOverlay?.addEventListener('click', (e) => { if (e.target === entryOverlay) closeEntryChoice(); });

  // فورم طلب الانضمام
  function showSignupForm() {
    signupErrors.classList.remove('show');
    signupErrors.innerHTML = '';
    signupForm.hidden = false;
    signupSuccessEl.hidden = true;
    signupForm.reset();
    signupOverlay.classList.add('open');
    setTimeout(updateSignupTypeUI, 0);
  }
  function closeSignupForm() { signupOverlay.classList.remove('open'); }

  signupCancelBtn?.addEventListener('click', closeSignupForm);
  signupOverlay?.addEventListener('click', (e) => { if (e.target === signupOverlay) closeSignupForm(); });
  signupDoneBtn?.addEventListener('click', closeSignupForm);

  
  function updateSignupTypeUI() {
    const type = ($('#ss-type')?.value || '');
    const isVisitor = type === 'visitor';
    document.querySelectorAll('.ss-provider-only').forEach(el => {
      el.style.display = isVisitor ? 'none' : '';
    });
    if (signupSubmitBtn) {
      signupSubmitBtn.textContent = isVisitor ? 'إنشاء الحساب' : 'إرسال الطلب';
    }
  }
  $('#ss-type')?.addEventListener('change', updateSignupTypeUI);

  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const client = getClient();
    if (!client) { notify('تعذر الاتصال بالخادم، حاول تاني بعد قليل'); return; }

    const requestType = $('#ss-type').value;
    const fullName    = $('#ss-name').value.trim();
    const email       = $('#ss-email').value.trim();
    const phone       = $('#ss-phone').value.trim();
    const password    = ($('#ss-password')?.value || '');
    const password2   = ($('#ss-password2')?.value || '');
    const business    = $('#ss-business').value.trim();
    const description = $('#ss-description').value.trim();

    signupErrors.classList.remove('show');
    signupErrors.innerHTML = '';

    if (!requestType) {
      signupErrors.innerHTML = '• اختَر نوع الحساب / التخصص';
      signupErrors.classList.add('show');
      return;
    }
    if (!fullName || !email || !phone) {
      signupErrors.innerHTML = '• من فضلك املأ الاسم والإيميل والموبايل';
      signupErrors.classList.add('show');
      return;
    }
    if (!/^01[0-9]{9}$/.test(phone)) {
      signupErrors.innerHTML = '• رقم الموبايل غير صحيح (لازم يبدأ بـ01 ويكون 11 رقم)';
      signupErrors.classList.add('show');
      return;
    }
    if (!password || password.length < 6) {
      signupErrors.innerHTML = '• كلمة المرور يجب ألا تقل عن 6 أحرف';
      signupErrors.classList.add('show');
      return;
    }
    if (password !== password2) {
      signupErrors.innerHTML = '• كلمتا المرور غير متطابقتين';
      signupErrors.classList.add('show');
      return;
    }

    signupSubmitBtn.disabled = true;
    signupSubmitBtn.textContent = (requestType === 'visitor') ? 'جارِ التسجيل...' : 'جارِ إرسال الطلب...';

    // إنشاء حساب Auth بكلمة المرور ثم إرسال طلب المراجعة للأدمن
    const { data: signData, error: signError } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          request_type: requestType
        }
      }
    });

    if (signError) {
      console.error('[Seller] signUp error:', signError);
      signupSubmitBtn.disabled = false;
      signupSubmitBtn.textContent = 'إرسال الطلب';
      const msg = signError.message || '';
      let ar = '• تعذر إنشاء الحساب. جرّب إيميل آخر أو تأكد من الاتصال.';
      if (/already|registered|exists/i.test(msg)) ar = '• هذا الإيميل مسجّل بالفعل — جرّب تسجيل الدخول.';
      if (/password/i.test(msg)) ar = '• كلمة المرور ضعيفة أو غير مقبولة.';
      signupErrors.innerHTML = ar;
      signupErrors.classList.add('show');
      return;
    }

    // الزائر: تسجيل مباشر بدون طلب موافقة — بيانات في Auth + profiles
    if (requestType === 'visitor') {
      const userId = signData?.user?.id || null;
      try {
        if (userId) {
          const { error: profileError } = await client.from('profiles').upsert([{
            id: userId,
            role: 'visitor',
            display_name: fullName,
            phone: phone || null
          }], { onConflict: 'id' });
          if (profileError) console.warn('[Visitor] profiles upsert:', profileError);
        }
      } catch (profileErr) {
        console.warn('[Visitor] profiles upsert:', profileErr);
      }
      // لو مفيش session (تأكيد إيميل مفعّل) نحاول الدخول مباشرة
      if (!signData?.session) {
        try {
          await client.auth.signInWithPassword({ email, password });
        } catch (_) {}
      }
      try {
        localStorage.setItem('doddz_user_role', 'visitor');
        localStorage.setItem('doddz_user_name', fullName);
        if (phone) localStorage.setItem('doddz_user_phone', phone);
      } catch (_) {}
      signupSubmitBtn.disabled = false;
      signupSubmitBtn.textContent = 'إنشاء الحساب';
      signupForm.hidden = true;
      if (signupSuccessEl) {
        signupSuccessEl.hidden = false;
        const titleEl = document.getElementById('seller-signup-success-title');
        const msgEl = document.getElementById('seller-signup-success-msg');
        if (titleEl) titleEl.textContent = 'تم التسجيل بنجاح';
        if (msgEl) {
          msgEl.textContent = 'حساب الزائر جاهز. تقدر تتسوق دلوقتي وتسجّل الدخول من «حسابي» بنفس الإيميل وكلمة المرور. (الشراء واستخدام الموقع فقط — بدون لوحة تاجر)';
        } else {
          signupSuccessEl.innerHTML = '<strong>تم التسجيل بنجاح</strong><p>تقدر تتسوق دلوقتي. سجّل الدخول من حسابي بنفس الإيميل وكلمة المرور.</p><button type="button" class="checkout-done-btn" id="seller-signup-done">تمام ✓</button>';
          document.getElementById('seller-signup-done')?.addEventListener('click', closeSignupForm);
        }
      } else {
        notify('تم تسجيل الزائر بنجاح');
        closeSignupForm();
      }
      return;
    }


    const SPECIALTY_LABELS = {
      merchant: 'كسبني',
      barber: 'قصها',
      handmade: 'انامل',
      carwash: 'لمعها',
      ac_tech: 'فني تكييف',
      cleaning: 'فني نظافة',
      plumbing: 'سباكة',
      electrical: 'كهرباء',
      other_service: 'خدمات أخرى',
      visitor: 'زائر',
      service_provider: 'مقدم خدمة'
    };
    const dbRequestType = requestType === 'merchant' ? 'merchant' : 'service_provider';
    const specialtyLabel = SPECIALTY_LABELS[requestType] || requestType;
    const descParts = [
      requestType !== 'merchant' ? `[تخصص: ${specialtyLabel} | code:${requestType}]` : null,
      description || null
    ].filter(Boolean);

    // ── الأقسام الأربعة في Supabase: جدول مستقل لكل قسم ──────────
    //   barber→قصها(barber_profiles) / carwash→لمعها / handmade→انامل / merchant→كسبني
    //   «خدمات أخرى» مالهوش قسم — يفضل طلب يدوي للأدمن.
    const Sections    = window.SectionsStore || null;
    const sectionCode = Sections ? Sections.normalizeSection(requestType) : null;
    const userId      = signData?.user?.id || null;

    // لو تأكيد الإيميل مفعّل signUp بيرجع بلا جلسة — بنحاول الدخول بنفس البيانات
    let session = signData?.session || null;
    if (!session && userId) {
      try {
        const again = await client.auth.signInWithPassword({ email, password });
        session = again?.data?.session || null;
      } catch (_) {}
    }

    const providerPayload = {
      section:   sectionCode,
      name:      business || fullName,
      ownerName: fullName,
      phone,
      description: description || null
    };

    // 1) فيه قسم + جلسة → النشاط يتسجل في جدول قسمه على طول (والدالة
    //    SQL بتعمل صف الطلب في signup_requests بنفسها).
    let registered = null;
    if (sectionCode && session && Sections) {
      registered = await Sections.register(providerPayload);
    }

    // 2) غير كده (مفيش قسم / مفيش جلسة / الدالة لسه مترفعِتش على السيرفر)
      //    → طلب كلاسيكي في signup_requests، مع category و user_id لو العمودين موجودين.
    if (!registered || !registered.success) {
      if (registered) console.warn('[Seller] register_provider_section:', registered.error);
      const baseRow = {
        request_type: dbRequestType,
        full_name: fullName,
        email,
        phone,
        business_name: business || null,
        description: descParts.length ? descParts.join('\n') : null,
        status: 'pending'
      };
      let reqError = null;
      if (sectionCode || userId) {
        const { error } = await client.from('signup_requests').insert([{
          ...baseRow, category: sectionCode || null, user_id: userId || null
        }]);
        reqError = error;
        // العمودين لسه مش موجودين في القاعدة (05-provider-sections.sql مترفعش)
        if (error && /category|user_id|provider_id|column|does not exist/i.test(error.message || '')) {
          console.warn('[Seller] signup_requests بدون أعمدة الأقسام:', error.message);
          reqError = (await client.from('signup_requests').insert([baseRow])).error;
        }
      } else {
        reqError = (await client.from('signup_requests').insert([baseRow])).error;
      }

      if (reqError) {
        console.error('[Seller] فشل إرسال طلب الانضمام:', reqError);
        signupSubmitBtn.disabled = false;
        signupSubmitBtn.textContent = 'إرسال الطلب';
        const detail = reqError.message || reqError.details || '';
        signupErrors.innerHTML = '• تم إنشاء الحساب، لكن تعذر إرسال طلب المراجعة' + (detail ? ': ' + detail : '') + '. تواصل مع الإدارة.';
        signupErrors.classList.add('show');
        return;
      }

      // مفيش جلسة (تأكيد الإيميل لسه) → نخزن الطلب محليًا لحد أول تسجيل دخول
      if (!session && sectionCode && Sections) {
        Sections.stashPendingRegistration({ ...providerPayload, email });
      }
    }

    // 3) الحساب يشتغل فورًا: الجلسة بتفضل مفتوحة واللوحة تفتح — والموافقة
    //    بتاعت الأدمن بتتحكم في الظهور للعملاء بس (status في جدول القسم).
    if (session) {
      currentUserId = userId || session.user.id;
      try {
        localStorage.setItem('doddz_user_role', 'visitor');
        localStorage.setItem('doddz_user_name', fullName);
        if (phone) localStorage.setItem('doddz_user_phone', phone);
        if (sectionCode) localStorage.setItem('doddz_user_category', sectionCode);
      } catch (_) {}
    } else {
      try { await client.auth.signOut(); } catch (_) {}
    }

    signupSubmitBtn.disabled = false;
    signupSubmitBtn.textContent = 'إرسال الطلب';

    signupForm.hidden = true;
    signupSuccessEl.hidden = false;
    const successTitle = document.getElementById('seller-signup-success-title');
    const successP = signupSuccessEl.querySelector('p');
    if (successTitle) successTitle.textContent = 'تم إنشاء حسابك ✓';
    if (successP) {
      successP.textContent = session
        ? `حسابك شغال دلوقتي${sectionCode ? ' ونشاطك اتسجل في قسم ' + specialtyLabel : ''}. تقدر تضيف منتجات وتدير خدماتك من لوحة البائع — النشاط بيظهر للعملاء بعد موافقة الإدارة.`
        : `تم إنشاء الحساب وإرسال طلبك لقسم ${specialtyLabel}. أكّد إيميلك وسجّل الدخول بنفس الإيميل وكلمة المرور — هيتم تسجيل نشاطك تلقائيًا في Supabase.`;
    }
    // زرار «تمام» يفتح لوحة البائع بدل ما يقفل بس
    const doneBtn = document.getElementById('seller-signup-done') || signupDoneBtn;
    if (doneBtn) {
      const newDone = doneBtn.cloneNode(true);
      doneBtn.parentNode.replaceChild(newDone, doneBtn);
      newDone.addEventListener('click', () => {
        closeSignupForm();
        if (session) openPanel(); else showLogin();
      });
    }
  });

  loginCancelBtn?.addEventListener('click', closeLogin);
  loginOverlay?.addEventListener('click', (e) => { if (e.target === loginOverlay) closeLogin(); });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const client = getClient();
    if (!client) return;

    const email    = loginEmail.value.trim();
    const password = loginPassword.value;

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'جارِ الدخول...';
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = 'دخول';

    if (error) {
      loginErrors.innerHTML = '• البريد الإلكتروني أو كلمة المرور غير صحيحة';
      loginErrors.classList.add('show');
      return;
    }

    currentUserId = data?.user?.id || null;
    // الدور + القسم من profiles — الزائر المالك لنشاط (category) له لوحة البائع
    let role = 'visitor';
    let category = null;
    try {
      const cols = 'role,display_name,category,provider_type';
      let { data: prof, error } = await client.from('profiles').select(cols).eq('id', currentUserId).maybeSingle();
      if (error && /category|provider_type/i.test(error.message || '')) {
        prof = (await client.from('profiles').select('role,display_name').eq('id', currentUserId).maybeSingle()).data;
      }
      if (prof?.role) role = prof.role;
      category = prof?.category || null;
      if (prof?.display_name) {
        try { localStorage.setItem('doddz_user_name', prof.display_name); } catch (_) {}
      }
    } catch (_) {
      role = localStorage.getItem('doddz_user_role') || 'visitor';
    }
    try {
      localStorage.setItem('doddz_user_role', role);
      if (category) localStorage.setItem('doddz_user_category', category);
    } catch (_) {}

    // لو التسجيل كان معلّق (تأكيد إيميل) → نشاطه يتسجل في Supabase دلوقتي
    const Sections = window.SectionsStore || null;
    if (Sections) {
      const done = await Sections.completePendingRegistration();
      if (done && !category) category = done.section || Sections.mySection();
      else if (!category) { const me = await Sections.myProvider(); category = me?.section || null; }
    }

    closeLogin();
    const isStaff = ['seller', 'merchant', 'service_provider', 'admin'].includes(role);
    if (!isStaff && !category) {
      notify('تم تسجيل الدخول كزائر — تقدر تتصفح وتشتري دلوقتي');
      window.DoddzAccount?.open?.();
      return;
    }
    openPanel();
  });

  panelClose?.addEventListener('click', closePanel);
  panelOverlay?.addEventListener('click', (e) => { if (e.target === panelOverlay) closePanel(); });

  tabMine?.addEventListener('click', () => { switchTab('mine'); loadMyProducts(); });
  tabAdd?.addEventListener('click', () => { clearAddForm(); switchTab('add'); });
  $('#seller-tab-barber-bookings')?.addEventListener('click', () => { switchTab('barber-bookings'); renderSellerBarberBookings(); });
  $('#seller-tab-barber-services')?.addEventListener('click', () => { switchTab('barber-services'); renderSellerBarberServicesEditor(); });
  $('#seller-tab-barber-home')?.addEventListener('click', () => { switchTab('barber-home'); loadSellerBarberHomeForm(); });

  $('#seller-barber-bookings-refresh')?.addEventListener('click', renderSellerBarberBookings);
  $('#seller-barber-bookings-list')?.addEventListener('click', async (e) => {
    const conf = e.target.closest('[data-sb-confirm]');
    const canc = e.target.closest('[data-sb-cancel]');
    if (conf && typeof BarberStore !== 'undefined') {
      const r = await BarberStore.updateBookingStatus(conf.dataset.sbConfirm, 'confirmed');
      if (!r.success) { notify(r.error || 'تعذر تأكيد الحجز'); return; }
      notify('تم تأكيد الحجز');
      renderSellerBarberBookings();
    }
    if (canc && typeof BarberStore !== 'undefined') {
      const r = await BarberStore.cancelBooking(canc.dataset.sbCancel);
      if (!r.success) { notify(r.error || 'تعذر إلغاء الحجز'); return; }
      notify('تم إلغاء الحجز');
      renderSellerBarberBookings();
    }
  });

  $('#seller-barber-add-service')?.addEventListener('click', () => {
    const box = $('#seller-barber-services-editor');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'adm-form-grid';
    div.setAttribute('data-svc-row', '');
    div.style.cssText = 'margin-bottom:10px;border:1px solid #eee;border-radius:10px;padding:10px;';
    div.innerHTML = `
      <div class="adm-field"><label>الاسم</label><input type="text" data-svc-name value=""/></div>
      <div class="adm-field"><label>المدة (د)</label><input type="number" data-svc-duration min="5" value="30"/></div>
      <div class="adm-field"><label>السعر</label><input type="number" data-svc-price min="0" value="100"/></div>
      <div class="adm-field"><label>وصف</label><input type="text" data-svc-desc value=""/></div>
      <input type="hidden" data-svc-id value="s_${Date.now()}"/>
    `;
    box.appendChild(div);
  });

  $('#seller-barber-save-services')?.addEventListener('click', () => {
    const barber = resolveMyBarber();
    const err = $('#seller-barber-services-errors');
    if (!barber || typeof BarberStore === 'undefined') {
      if (err) { err.innerHTML = '• لا يوجد ملف حلاق'; err.classList.add('show'); }
      return;
    }
    const rows = [...document.querySelectorAll('#seller-barber-services-editor [data-svc-row]')];
    const services = rows.map(row => ({
      id: row.querySelector('[data-svc-id]')?.value,
      name: row.querySelector('[data-svc-name]')?.value,
      durationMin: row.querySelector('[data-svc-duration]')?.value,
      price: row.querySelector('[data-svc-price]')?.value,
      description: row.querySelector('[data-svc-desc]')?.value
    }));
    const result = BarberStore.updateServices(barber.id, services);
    if (!result.success) {
      if (err) { err.innerHTML = '• ' + result.error; err.classList.add('show'); }
      return;
    }
    if (err) err.classList.remove('show');
    notify('تم حفظ الخدمات');
    if (BarberStore.pushCatalogField) BarberStore.pushCatalogField(barber.id, { services: (result.barber || barber).services || [] });
    renderSellerBarberServicesEditor();
    if (typeof renderBarbersSection === 'function') renderBarbersSection();
  });

  $('#seller-barber-save-home')?.addEventListener('click', () => {
    const barber = resolveMyBarber();
    const err = $('#seller-barber-home-errors');
    if (!barber || typeof BarberStore === 'undefined') {
      if (err) { err.innerHTML = '• لا يوجد ملف حلاق'; err.classList.add('show'); }
      return;
    }
    const result = BarberStore.updateHomeService(barber.id, {
      enabled: $('#sb-home-enabled')?.checked,
      areas: $('#sb-home-areas')?.value,
      travelFee: $('#sb-home-travel')?.value,
      extraFee: $('#sb-home-extra')?.value,
      note: $('#sb-home-note')?.value
    });
    if (!result.success) {
      if (err) { err.innerHTML = '• ' + result.error; err.classList.add('show'); }
      return;
    }
    if (err) err.classList.remove('show');
    notify('تم حفظ إعدادات الخدمة المنزلية');
    if (BarberStore.pushCatalogField) {
      BarberStore.pushCatalogField(barber.id, { homeService: (result.barber || barber).homeService });
    }
    if (typeof renderBarbersSection === 'function') renderBarbersSection();
  });

  refreshBtn?.addEventListener('click', loadMyProducts);

  logoutBtn?.addEventListener('click', async () => {
    const client = getClient();
    if (client) await client.auth.signOut();
    closePanel();
    notify('تم تسجيل الخروج');
  });

  // ── تهيئة نوع المعروض والحقول الديناميكية ────────────────────
  $('#sf-offering-type')?.addEventListener('change', updateOfferingFields);
  initOfferingTypeSelect();
  updateOfferingFields();


  // صور بروفايل الحلاق (غلاف + صورة شخصية)
  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  document.getElementById('sb-save-profile-photos')?.addEventListener('click', async () => {
    if (typeof BarberStore === 'undefined') return;
    const barberId = localStorage.getItem('doddz_barber_id') || (typeof currentBarberId !== 'undefined' ? currentBarberId : null);
    // try resolve barber linked to user email/name
    let b = null;
    if (currentUserId && BarberStore.getByUserId) {
      b = BarberStore.getByUserId(currentUserId);
    }
    if (!b && barberId && BarberStore.getById) b = BarberStore.getById(barberId);
    if (!b && BarberStore.getAll) {
      const list = BarberStore.getAll() || [];
      b = list.find(x => x.status === 'approved') || list[0];
    }
    if (!b) {
      notify('لا يوجد بروفايل حلاق مرتبط');
      return;
    }
    let avatarUrl = document.getElementById('sb-avatar-url')?.value?.trim() || b.avatarUrl || '';
    let coverUrl = document.getElementById('sb-cover-url')?.value?.trim() || b.coverUrl || '';
    const avFile = document.getElementById('sb-avatar-file')?.files?.[0];
    const cvFile = document.getElementById('sb-cover-file')?.files?.[0];
    try {
      if (avFile) avatarUrl = await fileToDataUrl(avFile);
      if (cvFile) coverUrl = await fileToDataUrl(cvFile);
      const res = BarberStore.updateProfile(b.id, { avatarUrl, coverUrl, avatar: '' });
      if (res.success && BarberStore.pushCatalogField) {
        BarberStore.pushCatalogField(b.id, { avatarUrl, coverUrl });
      }
      notify(res.success ? 'تم حفظ صور البروفايل' : (res.error || 'تعذر الحفظ'));
    } catch (err) {
      console.error(err);
      notify('تعذر حفظ الصور');
    }
  });


  // ================================================================
  // نشاطي — صف النشاط في جدول القسم (barber_profiles / carwash_profiles
  //          / handmade_profiles / merchant_profiles) عن طريق SectionsStore
  // ================================================================
  function bizStatusLine(row) {
    if (!row) return '';
    const label = (window.SectionsStore && SectionsStore.section(row.__section || SectionsStore.mySection())) || {};
    const map = {
      pending:  'نشاطك في قسم ' + (label.label || '') + ' «قيد مراجعة الإدارة» — شغال عندك دلوقتي وبيظهر للعملاء بعد الاعتماد.',
      approved: 'نشاطك معتمد في قسم ' + (label.label || '') + ' وبيظهر للعملاء على الموقع.',
      rejected: 'تم رفض نشاطك في قسم ' + (label.label || '') + ' — عدّل البيانات وتواصل مع الإدارة.'
    };
    return map[row.status] || '';
  }

  function renderMyBiz() {
    const S = window.SectionsStore;
    const box = {
      name: $('#sb-biz-name'), owner: $('#sb-biz-owner'), phone: $('#sb-biz-phone'),
      gov: $('#sb-biz-gov'), area: $('#sb-biz-area'), address: $('#sb-biz-address'),
      desc: $('#sb-biz-desc'), start: $('#sb-biz-start'), end: $('#sb-biz-end'),
      slot: $('#sb-biz-slot'), logo: $('#sb-biz-logo'), services: $('#sb-biz-services'),
      stats: $('#sb-biz-stats'), status: $('#sb-biz-status')
    };
    if (!box.name) return;
    if (!S) { if (box.status) box.status.textContent = 'js/sections-data.js غير محمّل'; return; }
    const me = S.myProviderInfo ? S.myProviderInfo() : null;
    const row = me && me.row;
    if (!row) {
      box.stats.textContent = 'مفيش نشاط مرتبط بالحساب ده';
      box.status.textContent = 'سجّل نشاطك من زر «حسابي» ← دخول كصاحب نشاط، وهيظهر هنا للتعديل.';
      return;
    }
    box.stats.textContent = 'نشاطي في قسم ' + ((S.section(me.section) || {}).label || me.section);
    box.status.textContent = bizStatusLine({ ...row, __section: me.section });
    box.name.value  = row.name || '';
    box.owner.value = row.owner_name || '';
    box.phone.value = row.phone || '';
    box.gov.value   = row.governorate || '';
    box.area.value  = row.area || '';
    box.address.value = row.address || '';
    box.desc.value  = row.description || row.bio || '';
    box.start.value = row.work_start != null ? row.work_start : 10;
    box.end.value   = row.work_end != null ? row.work_end : 22;
    box.slot.value  = row.slot_minutes != null ? row.slot_minutes : 30;
    box.logo.value  = row.logo_url || row.avatar_url || '';
    box.services.value = (Array.isArray(row.services) ? row.services : [])
      .map(s => `${s.name || ''} | ${s.durationMin || s.duration || 30} | ${s.price || 0}`).join('\n');
  }

  function parseBizServices(text) {
    return String(text || '').split('\n').map(line => line.trim()).filter(Boolean).map((line, i) => {
      const parts = line.split('|').map(x => x.trim());
      return {
        id: 'svc_' + (i + 1),
        name: parts[0] || ('خدمة ' + (i + 1)),
        durationMin: Number(parts[1]) || 30,
        price: Number(parts[2]) || 0,
        description: parts[3] || ''
      };
    });
  }

  async function saveMyBiz() {
    const S = window.SectionsStore;
    const err = $('#sb-biz-errors');
    if (err) { err.classList.remove('show'); err.innerHTML = ''; }
    if (!S) return;
    const name = ($('#sb-biz-name')?.value || '').trim();
    if (!name) {
      if (err) { err.innerHTML = '• اسم النشاط مطلوب'; err.classList.add('show'); }
      return;
    }
    const fields = {
      name,
      owner_name: ($('#sb-biz-owner')?.value || '').trim() || null,
      phone: ($('#sb-biz-phone')?.value || '').trim() || null,
      governorate: ($('#sb-biz-gov')?.value || '').trim() || null,
      area: ($('#sb-biz-area')?.value || '').trim() || null,
      address: ($('#sb-biz-address')?.value || '').trim() || null,
      description: ($('#sb-biz-desc')?.value || '').trim() || null,
      work_start: Number($('#sb-biz-start')?.value) || 10,
      work_end: Number($('#sb-biz-end')?.value) || 22,
      slot_minutes: Number($('#sb-biz-slot')?.value) || 30,
      logo_url: ($('#sb-biz-logo')?.value || '').trim() || null,
      services: parseBizServices($('#sb-biz-services')?.value)
    };
    const btn = $('#sb-biz-save');
    if (btn) { btn.disabled = true; btn.textContent = 'جارِ الحفظ...'; }
    const r = await S.saveMyProvider(fields);
    if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ نشاطي'; }
    if (!r.success) {
      if (err) { err.innerHTML = '• ' + (r.error || 'تعذر الحفظ'); err.classList.add('show'); }
      return;
    }
    if (S.mySection() === 'barbers' && typeof BarberStore !== 'undefined' && BarberStore.syncCatalogFromSupabase) {
      await BarberStore.syncCatalogFromSupabase();
      if (typeof renderBarbersSection === 'function') renderBarbersSection();
    }
    notify('تم حفظ بيانات نشاطك ✓');
    renderMyBiz();
  }

  $('#seller-tab-biz')?.addEventListener('click', () => { switchTab('biz'); renderMyBiz(); });
  $('#sb-biz-refresh')?.addEventListener('click', async () => {
    if (window.SectionsStore) { await SectionsStore.myProvider(); }
    renderMyBiz();
  });
  $('#sb-biz-save')?.addEventListener('click', saveMyBiz);
})();
