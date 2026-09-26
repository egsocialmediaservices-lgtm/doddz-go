// ================================================================
// PRODUCT MANAGER — Admin UI wired to ProductStore's public API only
// لا يلمس Cart System ولا renderCard() ولا تصميم المتجر
// ================================================================
(function () {
  const $ = (sel) => document.querySelector(sel);

  const fab       = $('#adm-fab');
  const overlay   = $('#adm-overlay');
  const closeBtn  = $('#adm-close');
  const tabList   = $('#adm-tab-list');
  const tabForm   = $('#adm-tab-form');
  const tabOrders = $('#adm-tab-orders');
  const viewList  = $('#adm-view-list');
  const viewForm  = $('#adm-view-form');
  const viewOrders = $('#adm-view-orders');
  const ordersSearchInput  = $('#adm-orders-search');
  const ordersStatusFilter = $('#adm-orders-status-filter');
  const ordersRefreshBtn   = $('#adm-orders-refresh-btn');
  const ordersStatsEl      = $('#adm-orders-stats');
  const ordersListEl       = $('#adm-orders-list');
  const tabRequests   = $('#adm-tab-requests');
  const viewRequests  = $('#adm-view-requests');
  const requestsStatusFilter = $('#adm-requests-status-filter');
  const requestsRefreshBtn   = $('#adm-requests-refresh-btn');
  const requestsStatsEl      = $('#adm-requests-stats');
  const requestsListEl       = $('#adm-requests-list');
  const searchEl  = $('#adm-search');
  const tbody     = $('#adm-tbody');
  const statsEl   = $('#adm-stats');
  const form      = $('#adm-form');
  const errorsEl  = $('#adm-errors');
  const cancelBtn = $('#adm-cancel-btn');
  const toastEl   = $('#adm-toast');
  const imagesInput = $('#f-images');
  const imagePreviews = $('#f-image-previews');
  const importBtn = $('#adm-import-btn');
  const templateBtn = $('#adm-template-btn');
  const importInput = $('#adm-import-input');
  const previewWrap = $('#adm-import-preview');
  const previewTbody = $('#adm-import-preview-body');
  const previewSummaryEl = $('#adm-import-summary');
  const selectAllBtn = $('#adm-select-all-btn');
  const clearSelectionBtn = $('#adm-clear-selection-btn');
  const importSelectedBtn = $('#adm-import-selected-btn');

  // ── Bulk delete (يحل محل زرار "إعادة تعيين المتجر" القديم) ──
  const bulkDeleteBtn         = $('#adm-bulk-delete-btn');
  const bulkBar               = $('#adm-bulk-bar');
  const bulkSelectAll         = $('#adm-bulk-select-all');
  const bulkCount             = $('#adm-bulk-count');
  const bulkDeleteSelectedBtn = $('#adm-bulk-delete-selected-btn');
  const bulkCancelBtn         = $('#adm-bulk-cancel-btn');
  const thCheck               = $('#adm-th-check');

  // ── Admin login (Supabase Auth) ──────────────────────────────
  const loginOverlay   = $('#adm-login-overlay');
  const loginForm      = $('#adm-login-form');
  const loginEmail     = $('#adm-login-email');
  const loginPassword  = $('#adm-login-password');
  const loginErrors    = $('#adm-login-errors');
  const loginSubmitBtn = $('#adm-login-submit');
  const loginCancelBtn = $('#adm-login-cancel');
  const logoutBtn      = $('#adm-logout-btn');

  function getSupabaseClient() {
    return (typeof window !== 'undefined' && window.supabaseClient) ? window.supabaseClient : null;
  }

  let productImages = [];
  let primaryImageIndex = 0;
  let csvPreviewRows = [];
  /** @type {Map<string, File>} اسم ملف zip (صغير) -> ملف zip من الجهاز */
  let csvLocalZips = new Map();
  let lastCsvRawRecords = [];
  let bulkMode = false;
  const selectedForDelete = new Set();

  const SECTION_LABELS = {
    electronics: 'إلكترونيات',
    mobiles: 'موبايلات',
    laptops: 'لاب توب',
    fashion: 'أزياء',
    shoes: 'أحذية',
    watches: 'ساعات وإكسسوارات',
    home: 'المنزل',
    pets: 'مستلزمات الحيوانات',
    toys: 'الألعاب',
    sports: 'الرياضة',
    beauty: 'الجمال والعناية',
    kids: 'الأطفال',
    books: 'الكتب',
    barber_supplies: 'مستلزمات حلاقة للمحلات بالجملة',
    services: 'خدمات',
    barbers: 'قصها',
    carwash: 'لمعها',
    handmade: 'انامل',
    merchants: 'كسبني',
    bestsellers: 'الأكثر مبيعاً',
    new: 'وصل حديثاً',
    sell: 'عروض عامة',
    tech: 'تكنولوجيا'
  };
  const BADGE_LABELS = {
    best: '<span class="adm-badge-tag adm-badge-best">الأكثر مبيعاً</span>',
    new:  '<span class="adm-badge-tag adm-badge-new">جديد</span>',
    sale: '<span class="adm-badge-tag adm-badge-sale">خصم</span>'
  };
  // تسميات معروفة لمصادر المنتج — أي مصدر مش موجود هنا (مثلاً مصدر استيراد جديد)
  // بيتعرض باسمه الخام زي ما هو بدل ما يتلخبط كـ"Doddz".
  const SOURCE_LABELS = {
    doddz: 'Doddz', merchant: 'كسبني — تاجر', affiliate: 'أفلييت'
  };
  function sourceLabel(source) {
    return SOURCE_LABELS[source] || source || 'Doddz';
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  /** Re-render both the storefront (via the existing initProducts) and the admin list */
  function refreshEverything() {
    if (typeof initProducts === 'function') initProducts();
    renderList();
  }

  async function openModal() {
    const client = getSupabaseClient();
    if (!client) {
      toast('تعذر الاتصال بخدمة تسجيل الدخول، حاول تاني بعد قليل');
      return;
    }
    const { data } = await client.auth.getSession();
    if (data?.session) {
      showAdminPanel();
    } else {
      showLoginOverlay();
    }
  }

  function showAdminPanel() {
    overlay.classList.add('open');
    switchTab('list');
    renderList();
  }

  function showLoginOverlay() {
    loginErrors.classList.remove('show');
    loginErrors.innerHTML = '';
    loginForm.reset();
    loginOverlay.classList.add('open');
  }

  function closeLoginOverlay() {
    loginOverlay.classList.remove('open');
  }
  function closeModal() { overlay.classList.remove('open'); }

  function switchTab(tab) {
    if (tab === 'barbers') {
      document.querySelectorAll('.adm-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === 'barbers'));
      document.querySelectorAll('.adm-view').forEach(x => x.classList.remove('active'));
      const view = $('#adm-view-barbers');
      if (view) view.classList.add('active');
      renderBarbersAdmin();
      return;
    }

    tabList.classList.toggle('active', tab === 'list');
    tabForm.classList.toggle('active', tab === 'form');
    tabOrders.classList.toggle('active', tab === 'orders');
    tabRequests.classList.toggle('active', tab === 'requests');
    const tabBarbersEl = $('#adm-tab-barbers');
    if (tabBarbersEl) tabBarbersEl.classList.toggle('active', tab === 'barbers');
    viewList.classList.toggle('active', tab === 'list');
    viewForm.classList.toggle('active', tab === 'form');
    viewOrders.classList.toggle('active', tab === 'orders');
    viewRequests.classList.toggle('active', tab === 'requests');
    const viewBarbers = $('#adm-view-barbers');
    if (viewBarbers) viewBarbers.classList.toggle('active', tab === 'barbers');
  }

  const REVIEW_STATUS_LABELS = {
    pending:  { label: 'قيد المراجعة', cls: 'pending' },
    approved: { label: 'مقبول',        cls: 'delivered' },
    rejected: { label: 'مرفوض',        cls: 'cancelled' }
  };

  const LISTING_TYPE_INFO = {
    physical:   { label: 'منتج',  bg: '#f1f5f9', color: '#334155' },
    service:    { label: 'خدمة',  bg: '#e0e7ff', color: '#3730a3' },
    classified: { label: 'إعلان', bg: '#fef3c7', color: '#92400e' },
    digital:    { label: 'رقمي',  bg: '#ede9fe', color: '#5b21b6' },
    course:     { label: 'كورس', bg: '#dcfce7', color: '#166534' }
  };

  function renderList() {
    const query    = searchEl.value.trim();
    const products = query ? ProductStore.search(query) : ProductStore.getAll();

    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="${bulkMode ? 10 : 9}"><div class="adm-empty">لا توجد منتجات مطابقة</div></td></tr>`;
    } else {
      tbody.innerHTML = products.map(p => {
        const statusInfo = REVIEW_STATUS_LABELS[p.status] || { label: p.status || '—', cls: 'pending' };
        const isPending = p.status === 'pending';
        const rawType = (p.productType || 'physical').toLowerCase();
        const typeInfo = LISTING_TYPE_INFO[rawType] || LISTING_TYPE_INFO.physical;
        const isNonInventory = rawType === 'service' || rawType === 'classified';
        const displayStock = isNonInventory ? '—' : (p.stock ?? 0);
        return `
        <tr>
          ${bulkMode ? `<td class="adm-bulk-col"><input type="checkbox" data-bulk-select="${p.id}" ${selectedForDelete.has(String(p.id)) ? 'checked' : ''}></td>` : ''}
          <td>
            ${p.image || '📦'} ${p.name}
            <span style="display:inline-block; font-size:11px; padding:2px 8px; border-radius:12px; font-weight:700; background:${typeInfo.bg}; color:${typeInfo.color}; margin-inline-start:6px;">${typeInfo.label}</span>
          </td>
          <td>${p.category || '—'}</td>
          <td>${SECTION_LABELS[p.section] || p.section}</td>
          <td>${(p.price || 0).toLocaleString()} ج</td>
          <td>${displayStock}</td>
          <td>${p.badge ? BADGE_LABELS[p.badge] || '' : '—'}</td>
          <td>${sourceLabel(p.source)}</td>
          <td><span class="adm-order-badge ${statusInfo.cls}">${statusInfo.label}</span></td>
          <td>
            <div class="adm-row-actions">
              ${isPending ? `
                <button class="adm-icon-btn" data-approve="${p.id}" title="قبول">✅</button>
                <button class="adm-icon-btn" data-reject="${p.id}" title="رفض">❌</button>
              ` : ''}
              <button class="adm-icon-btn" data-edit="${p.id}" title="تعديل">✏️</button>
              <button class="adm-icon-btn" data-delete="${p.id}" title="حذف">🗑️</button>
            </div>
          </td>
        </tr>
      `;
      }).join('');
    }

    const stats = ProductStore.stats();
    statsEl.textContent = `الإجمالي: ${stats.total} منتج`;
    updateBulkCount();
  }

  // ── Bulk delete helpers ─────────────────────────────────────
  function updateBulkCount() {
    if (!bulkCount) return;
    bulkCount.textContent = `${selectedForDelete.size} محدد`;
  }

  function enterBulkMode() {
    bulkMode = true;
    selectedForDelete.clear();
    bulkBar.hidden = false;
    if (thCheck) thCheck.style.display = '';
    bulkSelectAll.checked = false;
    switchTab('list');
    renderList();
  }

  function exitBulkMode() {
    bulkMode = false;
    selectedForDelete.clear();
    bulkBar.hidden = true;
    if (thCheck) thCheck.style.display = 'none';
    renderList();
  }

  function updateImagesCount() {
    const el = $('#f-images-count');
    if (el) el.textContent = `${productImages.length} / 5`;
  }

  function renderImagePreviews() {
    updateImagesCount();
    if (!imagePreviews) return;
    if (!productImages.length) {
      imagePreviews.innerHTML = '';
      return;
    }
    imagePreviews.innerHTML = productImages.map((src, index) => {
      const previewSrc = (typeof ProductStore !== 'undefined' && ProductStore.getImageSrc)
        ? (ProductStore.getImageSrc(src) || '')
        : (src instanceof Blob ? URL.createObjectURL(src) : (src || ''));
      return `
      <div class="adm-image-preview ${index === primaryImageIndex ? 'primary' : ''}">
        <img src="${previewSrc}" alt="معاينة ${index + 1}">
        <button type="button" class="adm-image-remove" data-remove-image="${index}" title="حذف">×</button>
        <label class="adm-image-primary"><input type="radio" name="primary-image" value="${index}" ${index === primaryImageIndex ? 'checked' : ''}> أساسية</label>
      </div>`;
    }).join('');
  }

  async function addImageFiles(fileList) {
    const files = Array.from(fileList || []).filter(f => f && f.type && f.type.startsWith('image/'));
    if (!files.length) {
      toast('اختَر ملفات صور فقط');
      return;
    }
    const availableSlots = 5 - productImages.length;
    if (!availableSlots) {
      toast('تم الوصول للحد الأقصى: 5 صور');
      return;
    }
    const accepted = files.slice(0, availableSlots);
    if (files.length > accepted.length) toast('تمت إضافة أول الصور حتى الحد 5 فقط');
    try {
      const blobs = await Promise.all(accepted.map(readImageFile));
      productImages.push(...blobs);
      if (productImages.length && primaryImageIndex >= productImages.length) primaryImageIndex = 0;
      renderImagePreviews();
      toast(`تم إضافة ${blobs.length} صورة من جهازك`);
    } catch (err) {
      console.error(err);
      toast('تعذّر قراءة إحدى الصور');
    }
  }

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

  function ensureProductTypeOptions() {
    const select = document.getElementById('f-productType');
    if (!select) return;
    if (!select.querySelector('option[value="classified"]')) {
      const opt = document.createElement('option');
      opt.value = 'classified';
      opt.textContent = 'إعلان';
      select.appendChild(opt);
    }
  }

  /** إخفاء/إظهار حقل المخزون بناءً على نوع المنتج المختار */
  function _updateStockFieldVisibility() {
    const pType = ($('#f-productType')?.value || 'physical').toLowerCase();
    const stockField = document.getElementById('f-stock-field');
    const stockInput = document.getElementById('f-stock');
    if (!stockField || !stockInput) return;
    const isNonInventory = pType === 'service' || pType === 'classified';
    stockField.style.display = isNonInventory ? 'none' : '';
    if (isNonInventory) {
      stockInput.removeAttribute('required');
      stockInput.value = '';
    } else {
      stockInput.setAttribute('required', '');
    }
  }

  function clearForm() {
    form.reset();
    productImages = [];
    primaryImageIndex = 0;
    renderImagePreviews();
    ensureProductTypeOptions();
    $('#f-id').value = '';
    $('#f-section').value = 'sell';
    $('#f-productType').value = 'physical';
    $('#f-source').value = 'doddz';
    errorsEl.classList.remove('show');
    errorsEl.innerHTML = '';
    _updateStockFieldVisibility();
  }

  function fillForm(p) {
    ensureProductTypeOptions();
    $('#f-id').value            = p.id;
    $('#f-name').value          = p.name || '';
    $('#f-category').value      = p.category || '';
    $('#f-subcategory').value   = p.subcategory || '';
    $('#f-section').value       = p.section || 'sell';
    $('#f-price').value         = p.price ?? '';
    $('#f-oldPrice').value      = p.oldPrice ?? '';
    $('#f-taagerCost').value    = p.taagerCost ?? '';
    $('#f-stock').value         = p.stock ?? 0;
    $('#f-productType').value   = p.productType || 'physical';
    $('#f-source').value        = p.source || 'doddz';
    _updateStockFieldVisibility();
    productImages               = [p.imageUrl, ...(p.images || [])].filter(Boolean)
      .filter((src, index, list) => list.indexOf(src) === index).slice(0, 5);
    primaryImageIndex           = productImages.indexOf(p.imageUrl);
    if (primaryImageIndex < 0) primaryImageIndex = 0;
    imagesInput.value           = '';
    renderImagePreviews();
    $('#f-colors').value        = (p.colors || []).join(', ');
    $('#f-sizes').value         = (p.sizes || []).join(', ');
    $('#f-rating').value        = p.rating ?? '';
    $('#f-reviewsCount').value  = p.reviewsCount ?? '';
    $('#f-badge').value         = p.badge || '';
    $('#f-tags').value          = (p.tags || []).join(', ');
    $('#f-description').value   = p.description || '';
    $('#f-featured').checked     = !!p.featured;
    $('#f-isBestSeller').checked = !!p.isBestSeller;
    $('#f-isNew').checked        = !!p.isNew;
  }

  function readForm() {
    const pType = $('#f-productType').value || 'physical';
    let stockVal = $('#f-stock').value;
    if ((pType === 'service' || pType === 'classified') && (!stockVal || Number(stockVal) <= 0)) {
      stockVal = '1';
    }
    return {
      name:         $('#f-name').value,
      category:     $('#f-category').value,
      subcategory:  $('#f-subcategory').value,
      section:      $('#f-section').value,
      price:        $('#f-price').value,
      oldPrice:     $('#f-oldPrice').value || null,
      taagerCost:   $('#f-taagerCost').value,
      stock:        stockVal,
      productType:  pType,
      source:       $('#f-source').value,
      imageUrl:     productImages[primaryImageIndex] || null,
      images:       productImages.filter((_, index) => index !== primaryImageIndex),
      colors:       $('#f-colors').value,
      sizes:        $('#f-sizes').value,
      rating:       $('#f-rating').value,
      reviewsCount: $('#f-reviewsCount').value,
      badge:        $('#f-badge').value || null,
      tags:         $('#f-tags').value,
      description:  $('#f-description').value,
      featured:     $('#f-featured').checked,
      isBestSeller: $('#f-isBestSeller').checked,
      isNew:        $('#f-isNew').checked,
    };
  }

  const HEADER_ALIASES = {
    id: ['id', 'productid', 'product_id', 'معرفالمنتج', 'رقمالمنتج'],
    name: ['name', 'productname', 'product_name', 'اسمالمنتج', 'اسم المنتج', 'title'],
    price: ['price', 'السعر', 'سعر', 'productprice', 'product_price'],
    category: ['category', 'categoryname', 'category_name', 'التصنيف', 'تصنيف', 'productcategory', 'product_category'],
    subcategory: ['subcategory', 'sub_category', 'التصنيفالفرعي', 'التصنيف الفرعي', 'تصنيففرعي', 'undercategory'],
    section: ['section', 'storesection', 'site_section', 'القسم', 'قسم'],
    source: ['source', 'المصدر', 'مصدر', 'vendor', 'seller', 'productsource', 'product_source'],
    description: ['description', 'الوصف', 'productdescription', 'product_description'],
    stock: ['stock', 'المخزون', 'الكمية', 'quantity'],
    imagesZip: ['imageszip', 'images_zip', 'zip', 'imagezip', 'ملفzip', 'صورzip', 'مجلدالصور'],
    primaryImage: ['primaryimage', 'primary_image', 'الصورة', 'image', 'productimage', 'الصورةالرئيسية', 'الصورة الرئيسية', 'image1', 'صوره1', 'صورة1'],
    image2: ['image2', 'صوره2', 'صورة2'],
    image3: ['image3', 'صوره3', 'صورة3'],
    image4: ['image4', 'صوره4', 'صورة4'],
    image5: ['image5', 'صوره5', 'صورة5'],
    additionalImages: ['additionalimages', 'additional_images', 'صوراضافية', 'صورإضافية', 'additionalimage', 'images', 'صور إضافية', 'الصور الإضافية'],
    colors: ['colors', 'color', 'الألوان', 'الالوان', 'لون'],
    sizes: ['sizes', 'size', 'المقاسات', 'مقاس', 'المقاس'],
    rating: ['rating', 'التقييم', 'تقييم'],
    reviewsCount: ['reviewscount', 'reviews_count', 'reviewcount', 'عددالتقييمات', 'عدد التقييمات'],
    taagerUrl: ['taagerurl', 'taager_url', 'رابطtaager', 'رابط taager', 'taagerlink', 'taager link', 'sourceurl', 'source_url'],
    sourceProductId: ['sourceproductid', 'source_product_id', 'sourceproductid', 'رقمالمنتجالأصلي', 'المنتجالأصلي', 'taagerid'],
    sku: ['sku', 'الرقمالمخزون', 'stockcode'],
    brand: ['brand', 'العلامة', 'الماركة', 'brandname']
  };

  // ── تسميات القسم والمصدر — تقبل الكود الإنجليزي أو الاسم العربي في أي صيغة ──
  const SECTION_VALUE_MAP = {
    electronics:     ['electronics', 'الكترونيات', 'إلكترونيات'],
    mobiles:         ['mobiles', 'موبايلات', 'جوالات', 'هواتف'],
    laptops:         ['laptops', 'لابتوب', 'لاب توب', 'لابتوبات'],
    fashion:         ['fashion', 'ازياء', 'أزياء', 'ملابس'],
    shoes:           ['shoes', 'احذية', 'أحذية'],
    watches:         ['watches', 'ساعات', 'ساعاتواكسسوارات', 'ساعات وإكسسوارات'],
    home:            ['home', 'المنزل', 'منزل'],
    pets:            ['pets', 'حيوانات', 'مستلزماتالحيوانات', 'مستلزمات الحيوانات'],
    toys:            ['toys', 'الالعاب', 'الألعاب'],
    sports:          ['sports', 'الرياضة', 'رياضة'],
    beauty:          ['beauty', 'الجمال', 'الجمالوالعناية', 'الجمال والعناية'],
    kids:            ['kids', 'الاطفال', 'الأطفال'],
    books:           ['books', 'الكتب', 'كتب'],
    barber_supplies: ['barbersupplies', 'barber_supplies', 'مستلزماثحلاقة', 'مستلزمات حلاقة', 'مستلزماتحلاقةللمحلاتبالجملة'],
    services:        ['services', 'خدمات', 'خدمة'],
    barbers:         ['barbers', 'قصها', 'حلاقين', 'حلاقة'],
    carwash:         ['carwash', 'لمعها', 'مغاسل', 'مغاسلسيارات'],
    handmade:        ['handmade', 'انامل', 'هندميد', 'هاند ميد'],
    merchants:       ['merchants', 'كسبني', 'تجار', 'قسمالتجار'],
    bestsellers:     ['bestsellers', 'الأكثرمبيعا', 'الأكثرمبيعاً'],
    new:             ['new', 'جديد', 'وصلحديثا', 'وصلحديثاً'],
    sell:            ['sell', 'بيعأيشيء', 'بيع', 'عروضبيع', 'عروضبيعأيشيء', 'عروضعامة'],
    tech:            ['tech', 'تكنولوجيا', 'تكنولوجياوإكسسوارات']
  };
  const CSV_MAX_PRODUCTS = 100;
  const ALLOWED_SECTIONS = Object.keys(SECTION_VALUE_MAP);
  const SOURCE_VALUE_MAP = {
    doddz:     ['doddz', 'دودز'],
    merchant:  ['merchant', 'تاجر'],
    affiliate: ['affiliate', 'افليت', 'أفلييت', 'افيليت']
  };

  function resolveMappedValue(raw, map, fallback) {
    const normalized = normalizeCsvHeader(raw);
    if (!normalized) return fallback;
    for (const [code, variants] of Object.entries(map)) {
      if (variants.some(v => normalizeCsvHeader(v) === normalized)) return code;
    }
    return fallback;
  }

  /** يفصل قايمة بسيطة (ألوان/مقاسات) — بيقبل | أو , كفاصل، على عكس الصور اللي بتفضل | بس عشان الروابط ممكن تحتوي على فاصلة */
  function splitList(value) {
    if (!value && value !== 0) return [];
    return String(value)
      .split(/[|,]/)
      .map(item => item.trim())
      .filter(Boolean)
      .filter((item, index, arr) => arr.indexOf(item) === index);
  }

  function parseRatingValue(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(5, Math.max(0, parsed));
  }

  function normalizeCsvHeader(value) {
    return String(value || '')
      .replace(/\uFEFF/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s_\-]+/g, '')
      .replace(/[^\p{L}\p{N}]/gu, '');
  }

  function canonicalizeHeader(value) {
    const normalized = normalizeCsvHeader(value);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some(alias => normalizeCsvHeader(alias) === normalized)) return key;
    }
    return null;
  }

  function parseCsv(text) {
    const cleaned = String(text || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < cleaned.length; i += 1) {
      const char = cleaned[i];
      if (char === '"') {
        if (quoted && cleaned[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && cleaned[i + 1] === '\n') i += 1;
        row.push(cell);
        if (row.some(value => String(value).trim())) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }

    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }

    if (!rows.length) return [];

    const headerRow = rows[0].map(value => String(value || '').trim());
    return rows.slice(1).map(values => {
      const entry = {};
      headerRow.forEach((header, index) => {
        const key = canonicalizeHeader(header);
        if (!key) return;
        entry[key] = values[index] ?? '';
      });
      return entry;
    });
  }

  function splitImageList(value) {
    if (!value && value !== 0) return [];
    return String(value)
      .split('|')
      .map(item => String(item).trim())
      .filter(Boolean)
      .filter((item, index, arr) => arr.indexOf(item) === index);
  }

  function sanitizeImageValue(value) {
    if (!value && value !== 0) return '';
    return String(value).trim().replace(/^['"]|['"]$/g, '');
  }

  function parsePriceValue(value) {
    if (value === null || value === undefined || value === '') return null;
    const raw = String(value).trim();
    if (!raw) return null;
    let cleaned = raw.replace(/[^0-9,.-]/g, '');
    if (!cleaned) return null;
    cleaned = cleaned.replace(/\s+/g, '');
    if (cleaned.includes(',') && cleaned.includes('.')) {
      cleaned = cleaned.replace(/,/g, '');
    } else if (cleaned.includes(',')) {
      const lastCommaIndex = cleaned.lastIndexOf(',');
      const after = cleaned.slice(lastCommaIndex + 1);
      if (after.length === 2 || after.length === 1) {
        cleaned = cleaned.replace(/,/g, '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseStockValue(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
  }

  function resolveCategoryExists(categoryName, existingCategories = []) {
    const target = String(categoryName || '').trim();
    if (!target) return { exists: false, isNew: false };
    const exists = existingCategories.some(item => String(item || '').trim().toLowerCase() === target.toLowerCase());
    return { exists, isNew: !exists };
  }

  function findDuplicateMatch(record, existingProducts) {
    const id = String(record.id || '').trim();
    const sourceProductId = String(record.sourceProductId || '').trim();
    const taagerUrl = String(record.taagerUrl || '').trim();

    if (id && existingProducts.some(product => String(product.id || '').trim() === id)) {
      return { type: 'id', product: existingProducts.find(product => String(product.id || '').trim() === id) };
    }
    if (sourceProductId && existingProducts.some(product => String(product.sourceProductId || '').trim() === sourceProductId)) {
      return { type: 'sourceProductId', product: existingProducts.find(product => String(product.sourceProductId || '').trim() === sourceProductId) };
    }
    if (taagerUrl && existingProducts.some(product => String(product.taagerUrl || product.sourceUrl || '').trim() === taagerUrl)) {
      return { type: 'taagerUrl', product: existingProducts.find(product => String(product.taagerUrl || product.sourceUrl || '').trim() === taagerUrl) };
    }
    return null;
  }

  function makeImportRecord(raw, existingProducts) {
    const imagesZip = resolveZipName(raw);
    const httpImages = [
      sanitizeImageValue(raw.primaryImage ?? raw.primary_image ?? raw.image ?? raw.image1 ?? ''),
      sanitizeImageValue(raw.image2 ?? ''),
      sanitizeImageValue(raw.image3 ?? ''),
      sanitizeImageValue(raw.image4 ?? ''),
      sanitizeImageValue(raw.image5 ?? ''),
      ...splitImageList(raw.additionalImages ?? raw.additional_images ?? raw.images ?? '')
    ].filter(isHttpImageRef).filter((item, index, arr) => arr.indexOf(item) === index).slice(0, 5);

    const record = {
      id: String(raw.id ?? '').trim(),
      name: String(raw.name ?? '').trim(),
      price: raw.price ?? '',
      category: String(raw.category ?? '').trim(),
      subcategory: String(raw.subcategory ?? '').trim(),
      description: String(raw.description ?? '').trim(),
      stock: raw.stock ?? '',
      imagesZip,
      localImageNames: [],
      primaryImage: httpImages[0] || '',
      additionalImages: httpImages.slice(1),
      colors: splitList(raw.colors ?? ''),
      sizes: splitList(raw.sizes ?? ''),
      rating: parseRatingValue(raw.rating, 0),
      reviewsCount: parseStockValue(raw.reviewsCount, 0),
      taagerUrl: sanitizeImageValue(raw.taagerUrl ?? raw.taager_url ?? raw.sourceUrl ?? ''),
      sourceProductId: sanitizeImageValue(raw.sourceProductId ?? raw.source_product_id ?? ''),
      sku: sanitizeImageValue(raw.sku ?? ''),
      brand: sanitizeImageValue(raw.brand ?? ''),
      section: resolveMappedValue(raw.section, SECTION_VALUE_MAP, 'electronics'),
      source: resolveMappedValue(raw.source, SOURCE_VALUE_MAP, 'doddz')
    };

    const duplicateMatch = findDuplicateMatch(record, existingProducts);
    const warnings = [];
    const errors = [];
    const categoryCheck = resolveCategoryExists(record.category, existingProducts.map(product => product.category));
    if (categoryCheck.isNew && record.category) warnings.push('تصنيف جديد');

    if (!record.name) errors.push('اسم المنتج مطلوب');

    const priceNumber = parsePriceValue(record.price);
    if (priceNumber === null || Number.isNaN(priceNumber) || priceNumber <= 0) {
      errors.push('السعر غير صحيح');
    }

    if (!record.category) errors.push('التصنيف مطلوب');

    if (record.imagesZip) {
      if (!csvLocalZips.has(record.imagesZip)) {
        warnings.push('ملف ZIP غير محمّل: ' + record.imagesZip);
      }
    }

    const stockNumber = parseStockValue(record.stock, 0);
    const primaryUrl = record.primaryImage || '';
    const additionalOnly = record.additionalImages.filter(item => item !== primaryUrl);

    return {
      ...record,
      priceNumber,
      stockNumber,
      primaryImage: primaryUrl,
      additionalImages: additionalOnly,
      warnings,
      errors,
      duplicateMatch,
      status: duplicateMatch ? 'موجود بالفعل' : (errors.length ? 'خطأ' : (warnings.length ? 'تحذير' : 'مناسب')),
      selected: !(errors.length || duplicateMatch) || duplicateMatch
    };
  }


  function normalizeImageFileName(name) {
    return String(name || '')
      .trim()
      .replace(/^.*[\\/]/, '')
      .toLowerCase();
  }

  function isHttpImageRef(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
  }

  function resolveZipName(raw) {
    const v = String(raw.imagesZip ?? raw.images_zip ?? raw.zip ?? '').trim();
    if (!v) return '';
    let name = normalizeImageFileName(v);
    if (name && !name.endsWith('.zip')) name += '.zip';
    return name;
  }

  async function extractImagesFromZip(zipFile) {
    if (typeof JSZip === 'undefined') {
      throw new Error('مكتبة قراءة ZIP غير محمّلة — حدّث الصفحة');
    }
    const zip = await JSZip.loadAsync(zipFile);
    const entries = [];
    zip.forEach((relativePath, entry) => {
      if (entry.dir) return;
      const base = relativePath.split('/').pop() || '';
      if (base.startsWith('.')) return;
      if (!/\.(jpe?g|png|webp|gif)$/i.test(base)) return;
      entries.push({ path: relativePath, entry, base });
    });
    // ترتيب أبجدي عشان image1, image2...
    entries.sort((a, b) => a.base.localeCompare(b.base, 'en', { numeric: true }));
    const blobs = [];
    for (const item of entries.slice(0, 5)) {
      const buf = await item.entry.async('blob');
      const type = /\.png$/i.test(item.base) ? 'image/png'
        : /\.webp$/i.test(item.base) ? 'image/webp'
        : /\.gif$/i.test(item.base) ? 'image/gif'
        : 'image/jpeg';
      blobs.push(new Blob([buf], { type }));
    }
    return blobs;
  }

  function updateCsvImagesStatus() {
    const el = $('#adm-import-images-status');
    if (!el) return;
    const n = csvLocalZips.size;
    el.textContent = n
      ? `تم تحميل ${n} ملف ZIP — اكتب نفس الاسم في عمود imagesZip`
      : 'حد 100 منتج · عمود imagesZip = اسم ملف zip لكل منتج';
  }

  function buildCsvTemplate() {
    // imagesZip: اسم ملف zip على جهازك يحتوي صور هذا المنتج (حتى 5 صور)
    const header = [
      'name', 'price', 'category', 'section', 'stock', 'description',
      'imagesZip', 'sku', 'brand', 'colors', 'sizes'
    ].join(',');
    const example = [
      'سماعة بلوتوث لاسلكية',
      '799',
      'إلكترونيات',
      'electronics',
      '25',
      '"سماعة مريحة بجودة صوت عالية"',
      'samaa-photos.zip',
      'SKU-EAR-001',
      'SoundMax',
      'أسود|أبيض',
      ''
    ].join(',');
    return '\uFEFF' + header + '\r\n' + example;
  }

  function downloadCsvTemplate() {
    const blob = new Blob([buildCsvTemplate()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'doddz_csv_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('تم تحميل قالب CSV');
  }

  function ensureDuplicateModal() {
    let modal = document.getElementById('adm-duplicate-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'adm-duplicate-modal';
    modal.className = 'adm-duplicate-modal';
    modal.innerHTML = `
      <div class="adm-duplicate-dialog">
        <h4>موجود بالفعل</h4>
        <p id="adm-duplicate-message">هذا المنتج موجود بالفعل في المتجر.</p>
        <div class="adm-duplicate-actions">
          <button type="button" class="adm-btn secondary" data-dup-action="skip">تخطي</button>
          <button type="button" class="adm-btn secondary" data-dup-action="update">تحديث المنتج الموجود</button>
          <button type="button" class="adm-btn" data-dup-action="copy">إنشاء نسخة جديدة</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.classList.remove('open');
        resolveDuplicateChoice(null);
      }
    });
    modal.querySelectorAll('[data-dup-action]').forEach(button => {
      button.addEventListener('click', (event) => {
        const action = event.currentTarget.dataset.dupAction;
        modal.classList.remove('open');
        resolveDuplicateChoice(action);
      });
    });
    return modal;
  }

  let resolveDuplicateChoice = () => {};

  function askDuplicateAction(productName) {
    return new Promise((resolve) => {
      const modal = ensureDuplicateModal();
      const message = modal.querySelector('#adm-duplicate-message');
      if (message) message.textContent = `"${productName || 'المنتج'}" موجود بالفعل. اختر الإجراء المطلوب.`;
      resolveDuplicateChoice = resolve;
      modal.classList.add('open');
    });
  }

  /** بيتحقق بس إن الرابط شكله صالح ويرجّعه زي ما هو — من غير تحميل أو تحويل
   *  لـbase64. الروابط الخارجية (من الموردين أو أي مصدر) بتفضل لينكات مباشرة،
   *  وده أخف وأسرع وأثبت (تحميل الصورة عن طريق fetch() غالباً بيترفض بسبب CORS
   *  حتى لو الصورة نفسها بتتفتح عادي في وسم <img>). */
  async function prepareImageUrl(imageUrl, warningList) {
    const url = sanitizeImageValue(imageUrl);
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) return url;
    return url;
  }

  async function buildPreviewFromCsv(records) {
    const existingProducts = ProductStore.getAll();
    const rows = [];

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const normalized = {
        id: String(record.id ?? '').trim(),
        name: String(record.name ?? '').trim(),
        price: record.price ?? '',
        category: String(record.category ?? '').trim(),
        subcategory: String(record.subcategory ?? '').trim(),
        description: String(record.description ?? '').trim(),
        stock: record.stock ?? '',
        primaryImage: sanitizeImageValue(record.primaryImage ?? record.primary_image ?? record.image ?? ''),
        additionalImages: splitImageList(record.additionalImages ?? record.additional_images ?? record.images ?? ''),
        colors: record.colors ?? '',
        sizes: record.sizes ?? '',
        rating: record.rating ?? '',
        reviewsCount: record.reviewsCount ?? record.reviews_count ?? '',
        taagerUrl: sanitizeImageValue(record.taagerUrl ?? record.taager_url ?? record.sourceUrl ?? ''),
        sourceProductId: sanitizeImageValue(record.sourceProductId ?? record.source_product_id ?? ''),
        sku: sanitizeImageValue(record.sku ?? ''),
        brand: sanitizeImageValue(record.brand ?? ''),
        section: record.section ?? '',
        source: record.source ?? ''
      };

      const row = makeImportRecord(normalized, existingProducts);
      const warnings = [...row.warnings];
      const errors = [...row.errors];

      const primaryValue = row.primaryImage || row.additionalImages[0] || '';
      const additionalOnly = row.additionalImages.filter(item => item !== primaryValue);
      const imageWarnings = [];
      const finalPrimary = await prepareImageUrl(primaryValue, imageWarnings);
      const finalAdditional = [];
      for (const image of additionalOnly) {
        const converted = await prepareImageUrl(image, imageWarnings);
        if (converted) finalAdditional.push(converted);
      }

      row.primaryImage = finalPrimary;
      row.additionalImages = finalAdditional;
      row.warningText = [...warnings, ...imageWarnings].join(' • ') || '—';
      row.errorsText = errors.join(' • ') || '—';
      row.status = row.duplicateMatch ? 'موجود بالفعل' : (errors.length ? 'خطأ' : (warnings.length || imageWarnings.length ? 'تحذير' : 'مناسب'));
      row.statusClass = row.duplicateMatch ? 'duplicate' : (errors.length ? 'error' : (warnings.length || imageWarnings.length ? 'warning' : 'success'));
      row.selected = true;
      if (errors.length) row.selected = false;

      rows.push(row);
    }

    csvPreviewRows = rows;
    renderImportPreview();
  }

  function renderImportPreview() {
    if (!csvPreviewRows.length) {
      previewWrap.hidden = true;
      previewWrap.setAttribute('hidden', 'hidden');
      return;
    }

    previewWrap.hidden = false;
    previewWrap.removeAttribute('hidden');

    const totals = {
      total: csvPreviewRows.length,
      valid: csvPreviewRows.filter(row => !row.errors.length && !row.duplicateMatch).length,
      warning: csvPreviewRows.filter(row => row.warningText !== '—' && !row.errors.length).length,
      error: csvPreviewRows.filter(row => row.errors.length).length,
      primary: csvPreviewRows.filter(row => row.primaryImage).length,
      additional: csvPreviewRows.reduce((sum, row) => sum + row.additionalImages.length, 0)
    };

    previewSummaryEl.innerHTML = `
      <div class="adm-import-stat">إجمالي المنتجات<strong>${totals.total}</strong></div>
      <div class="adm-import-stat">المنتجات الصحيحة<strong>${totals.valid}</strong></div>
      <div class="adm-import-stat">بها تحذيرات<strong>${totals.warning}</strong></div>
      <div class="adm-import-stat">بها أخطاء<strong>${totals.error}</strong></div>
      <div class="adm-import-stat">صور أساسية<strong>${totals.primary}</strong></div>
      <div class="adm-import-stat">صور إضافية<strong>${totals.additional}</strong></div>
    `;

    if (!previewTbody) return;
    previewTbody.innerHTML = csvPreviewRows.map((row, index) => `
      <tr>
        <td><input type="checkbox" data-preview-select="${index}" ${row.selected ? 'checked' : ''} ${row.errors.length ? 'disabled' : ''}></td>
        <td>${row.name || '—'}</td>
        <td>${row.priceNumber ? row.priceNumber.toLocaleString() : '—'}</td>
        <td>${row.category || '—'}</td>
        <td>${row.subcategory || '—'}</td>
        <td>${SECTION_LABELS[row.section] || row.section || '—'}</td>
        <td>${row.stockNumber ?? 0}</td>
        <td>${row.primaryImage ? `<img class="adm-preview-image" src="${ProductStore.getImageSrc(row.primaryImage) || row.primaryImage}" alt="${row.name || 'صورة'}">` : '—'}</td>
        <td>${row.additionalImages.length}</td>
        <td>${sourceLabel(row.source)}</td>
        <td><span class="adm-import-badge ${row.statusClass}">${row.status}</span></td>
        <td>${row.warningText === '—' ? '—' : row.warningText}</td>
      </tr>
    `).join('') || '<tr><td colspan="12" class="adm-preview-empty">لا توجد منتجات في المعاينة</td></tr>';
  }

  async function loadCsvFile(file) {
    const text = await file.text();
    if (!text || !text.trim()) throw new Error('الملف فارغ');
    let records;
    if (file.name.toLowerCase().endsWith('.json')) {
      const parsed = JSON.parse(text);
      records = Array.isArray(parsed) ? parsed : (parsed.products || []);
    } else {
      records = parseCsv(text);
    }

    if (!Array.isArray(records) || !records.length) {
      throw new Error('لا توجد بيانات CSV صالحة للاستيراد');
    }

    if (records.length > CSV_MAX_PRODUCTS) {
      throw new Error('الحد الأقصى للاستيراد هو ' + CSV_MAX_PRODUCTS + ' منتج في الملف الواحد (الملف يحتوي ' + records.length + ')');
    }

    lastCsvRawRecords = records;
    await buildPreviewFromCsv(records);
  }

  async function importSelectedFromPreview() {
    const selectedIndexes = Array.from(document.querySelectorAll('[data-preview-select]'))
      .filter(input => input.checked)
      .map(input => Number(input.dataset.previewSelect));

    if (!selectedIndexes.length) {
      toast('يرجى تحديد منتج واحد على الأقل');
      return;
    }

    const summary = { success: 0, updated: 0, skipped: 0, failed: 0 };

    for (const index of selectedIndexes) {
      const row = csvPreviewRows[index];
      if (!row) continue;

      if (row.errors.length) {
        summary.failed += 1;
        continue;
      }

      if (row.duplicateMatch) {
        const action = await askDuplicateAction(row.name || 'المنتج');
        if (action === 'skip') {
          summary.skipped += 1;
          continue;
        }
        if (action === 'copy') {
          row.id = ProductStore.generateId();
        }
      }

      const productId = row.id || ProductStore.generateId();
      let imageUrl = row.primaryImage || '';
      let images = [...(row.additionalImages || [])];

      // فك ZIP المنتج ورفع الصور (حتى 5)
      if (row.imagesZip) {
        const client = getSupabaseClient();
        if (!client) {
          summary.failed += 1;
          continue;
        }
        const zipFile = csvLocalZips.get(row.imagesZip);
        if (!zipFile) {
          summary.failed += 1;
          continue;
        }
        try {
          let blobs = await extractImagesFromZip(zipFile);
          if (!blobs.length) {
            summary.failed += 1;
            continue;
          }
          // ضغط/توحيد اختياري عبر readImageFile لو الملف خام من zip
          blobs = await Promise.all(blobs.map(async (b) => {
            try {
              const file = new File([b], 'img.jpg', { type: b.type || 'image/jpeg' });
              return await readImageFile(file);
            } catch {
              return b;
            }
          }));
          const uploadResult = await ProductStore.uploadProductImages(client, {
            blobs: blobs.slice(0, 5),
            primaryIndex: 0,
            productId
          });
          imageUrl = uploadResult.primaryUrl || imageUrl;
          images = [...(uploadResult.additionalUrls || []), ...images].filter(Boolean);
        } catch (upErr) {
          console.error('[Admin CSV] zip images', upErr);
          summary.failed += 1;
          continue;
        }
      }

      const payload = {
        id: productId,
        name: row.name,
        category: row.category,
        subcategory: row.subcategory || '',
        description: row.description,
        price: row.priceNumber,
        stock: row.stockNumber,
        imageUrl: imageUrl || '',
        images: images || [],
        colors: row.colors || [],
        sizes: row.sizes || [],
        rating: row.rating || 0,
        reviewsCount: row.reviewsCount || 0,
        source: row.source || 'doddz',
        sourceProductId: row.sourceProductId || null,
        sourceUrl: row.taagerUrl || null,
        taagerUrl: row.taagerUrl || null,
        sku: row.sku || null,
        brand: row.brand || null,
        taagerCost: 0,
        section: row.section || 'electronics',
        productType: 'physical',
        status: 'approved'
      };

      const existing = row.duplicateMatch ? ProductStore.getById(String(row.duplicateMatch.product.id)) : null;
      const result = existing && row.duplicateMatch && (row.duplicateMatch.type === 'id' || row.duplicateMatch.type === 'sourceProductId' || row.duplicateMatch.type === 'taagerUrl')
        ? await ProductStore.update(String(existing.id), payload)
        : await ProductStore.save(payload);

      if (!result.success) {
        summary.failed += 1;
        continue;
      }

      if (existing && row.duplicateMatch) summary.updated += 1; else summary.success += 1;
    }

    await ProductStore.flush(); // ننتظر لحد ما كل المنتجات تتخزن فعلياً في IndexedDB قبل ما نكمل
    refreshEverything();
    toast(`تم الاستيراد بنجاح: ${summary.success} — تم التحديث: ${summary.updated} — تم التخطي: ${summary.skipped} — فشل: ${summary.failed}`);
    csvPreviewRows = [];
    renderImportPreview();
  }

  // ── ملحوظة: هنا كان في الأول بيستدعي importSelectedFromPreview() تلقائياً
  // فور اختيار الملف، وده كان يمنع المستخدم من مراجعة/تعديل التحديد قبل
  // الاستيراد الفعلي. دلوقتي الدالة بس بتحمّل الملف وتعرض المعاينة،
  // والمستخدم هو اللي يدوس "استيراد المحدد" لما يكون مطمن للجدول.
  async function importProducts(file) {
    await loadCsvFile(file);
  }

  // ── Orders tab ──────────────────────────────────────────────
  const ORDER_STATUS_LABELS = {
    pending:   { label: 'قيد الانتظار', cls: 'pending' },
    confirmed: { label: 'مؤكد',         cls: 'confirmed' },
    shipping:  { label: 'جاري الشحن',   cls: 'shipping' },
    delivered: { label: 'تم التسليم',   cls: 'delivered' },
    cancelled: { label: 'ملغي',         cls: 'cancelled' }
  };

  let ordersCache = [];

  async function loadOrders() {
    const client = getSupabaseClient();
    if (!client) {
      ordersListEl.innerHTML = `<div class="adm-empty">تعذر الاتصال بالخادم</div>`;
      return;
    }

    ordersListEl.innerHTML = `<div class="adm-empty">جارِ التحميل...</div>`;

    const { data, error } = await client
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Admin] فشل تحميل الطلبات:', error);
      ordersListEl.innerHTML = `<div class="adm-empty">تعذر تحميل الطلبات — تأكد إنك مسجّل دخول كأدمن.</div>`;
      return;
    }

    ordersCache = data || [];
    renderOrders();
  }

  function renderOrders() {
    const query  = ordersSearchInput.value.trim().toLowerCase();
    const status = ordersStatusFilter.value;

    let filtered = ordersCache;
    if (status) filtered = filtered.filter(order => order.status === status);
    if (query) {
      filtered = filtered.filter(order =>
        (order.customer_name || '').toLowerCase().includes(query) ||
        (order.customer_phone || '').includes(query)
      );
    }

    ordersStatsEl.textContent = `الإجمالي: ${filtered.length} طلب`;

    if (!filtered.length) {
      ordersListEl.innerHTML = `<div class="adm-empty">لا توجد طلبات مطابقة</div>`;
      return;
    }

    ordersListEl.innerHTML = filtered.map(order => {
      const items = order.order_items || [];
      const statusInfo = ORDER_STATUS_LABELS[order.status] || { label: order.status, cls: 'pending' };
      const dateLabel = order.created_at ? new Date(order.created_at).toLocaleString('ar-EG') : '—';
      const ref = String(order.id).slice(-8).toUpperCase();

      return `
        <div class="adm-order-card">
          <div class="adm-order-head" data-toggle-order="${order.id}">
            <div class="adm-order-head-main">
              <strong>#${ref}</strong>
              <span class="adm-order-customer">${order.customer_name || '—'}</span>
              <span class="adm-order-date">${dateLabel}</span>
            </div>
            <div class="adm-order-head-side">
              <span class="adm-order-total">${(order.total || 0).toLocaleString()} ج</span>
              <span class="adm-order-badge ${statusInfo.cls}">${statusInfo.label}</span>
              <span class="adm-order-caret">▾</span>
            </div>
          </div>
          <div class="adm-order-details" id="adm-order-details-${order.id}" hidden>
            <div class="adm-order-info-grid">
              <div><strong>الموبايل:</strong> ${order.customer_phone || '—'}</div>
              <div><strong>المنطقة:</strong> ${order.customer_area || '—'}</div>
              <div class="full"><strong>العنوان:</strong> ${order.customer_address || '—'}</div>
              ${order.customer_notes ? `<div class="full"><strong>ملاحظات:</strong> ${order.customer_notes}</div>` : ''}
              <div><strong>طريقة الدفع:</strong> ${order.payment_method === 'cash' ? 'عند الاستلام' : (order.payment_method || '—')}</div>
            </div>

            <table class="adm-order-items-table">
              <thead>
                <tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td>${item.product_name || '—'}</td>
                    <td>${item.quantity}</td>
                    <td>${(item.unit_price || 0).toLocaleString()} ج</td>
                    <td>${(item.line_total || 0).toLocaleString()} ج</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="adm-order-totals">
              <span>الشحن: ${(order.delivery_fee || 0).toLocaleString()} ج</span>
              <strong>الإجمالي: ${(order.total || 0).toLocaleString()} ج</strong>
            </div>

            <div class="adm-order-status-row">
              <label>تغيير الحالة:</label>
              <select class="adm-order-status-select" data-order-status="${order.id}">
                ${Object.entries(ORDER_STATUS_LABELS).map(([value, info]) =>
                  `<option value="${value}" ${order.status === value ? 'selected' : ''}>${info.label}</option>`
                ).join('')}
              </select>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Signup requests tab ─────────────────────────────────────
  const REQUEST_TYPE_LABELS = {
    merchant: 'كسبني — تاجر',
    service_provider: 'مقدم خدمة',
    barber: 'قصها — حلاق',
    handmade: 'انامل — هند ميد',
    carwash: 'لمعها — مغاسل',
    ac_tech: 'فني تكييف',
    cleaning: 'فني نظافة',
    plumbing: 'سباكة',
    electrical: 'كهرباء',
    other_service: 'خدمات أخرى'
  };
  const REQUEST_STATUS_LABELS = {
    pending:  { label: 'قيد الانتظار', cls: 'pending' },
    approved: { label: 'مقبول',        cls: 'delivered' },
    rejected: { label: 'مرفوض',        cls: 'cancelled' }
  };

  let requestsCache = [];

  async function loadRequests() {
    const client = getSupabaseClient();
    if (!client) {
      requestsListEl.innerHTML = `<div class="adm-empty">تعذر الاتصال بالخادم</div>`;
      return;
    }

    requestsListEl.innerHTML = `<div class="adm-empty">جارِ التحميل...</div>`;

    const { data, error } = await client
      .from('signup_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Admin] فشل تحميل طلبات الانضمام:', error);
      requestsListEl.innerHTML = `<div class="adm-empty">تعذر تحميل الطلبات — تأكد إنك مسجّل دخول كأدمن.</div>`;
      return;
    }

    requestsCache = data || [];
    renderRequests();
  }

  function renderRequests() {
    const status = requestsStatusFilter.value;
    const filtered = status ? requestsCache.filter(r => r.status === status) : requestsCache;

    requestsStatsEl.textContent = `الإجمالي: ${filtered.length} طلب`;

    if (!filtered.length) {
      requestsListEl.innerHTML = `<div class="adm-empty">لا توجد طلبات مطابقة</div>`;
      return;
    }

    requestsListEl.innerHTML = filtered.map(req => {
      const statusInfo = REQUEST_STATUS_LABELS[req.status] || { label: req.status, cls: 'pending' };
      let typeLabel = REQUEST_TYPE_LABELS[req.request_type] || req.request_type;
      const codeMatch = String(req.description || '').match(/code:([a-z_]+)/i);
      if (codeMatch && REQUEST_TYPE_LABELS[codeMatch[1]]) {
        typeLabel = REQUEST_TYPE_LABELS[codeMatch[1]];
      } else if (codeMatch) {
        typeLabel = codeMatch[1];
      }
      const dateLabel = req.created_at ? new Date(req.created_at).toLocaleString('ar-EG') : '—';

      const approvalBox = req.status === 'pending' ? `
        <div class="adm-request-approve-box">
          <p class="adm-request-approve-hint">
            ١) انسخ الإيميل: <code>${req.email}</code><br/>
            ٢) روح Supabase → Authentication → Add user، واعمل الحساب بيه (فعّل Auto Confirm)<br/>
            ٣) الصق الـ UUID بتاعه هنا وأكد
          </p>
          <div class="adm-request-approve-row">
            <input type="text" class="adm-request-uuid-input" data-request-uuid-input="${req.id}" placeholder="الصق الـUUID هنا"/>
            <button type="button" class="adm-btn" data-approve-request="${req.id}">✅ تأكيد وربط الحساب</button>
          </div>
          <button type="button" class="adm-btn danger" data-reject-request="${req.id}" style="margin-top:8px;">❌ رفض الطلب</button>
        </div>
      ` : '';

      return `
        <div class="adm-order-card">
          <div class="adm-order-head" data-toggle-request="${req.id}">
            <div class="adm-order-head-main">
              <strong>${req.full_name}</strong>
              <span class="adm-order-date">${typeLabel} · ${dateLabel}</span>
            </div>
            <div class="adm-order-head-side">
              <span class="adm-order-badge ${statusInfo.cls}">${statusInfo.label}</span>
              <span class="adm-order-caret">▾</span>
            </div>
          </div>
          <div class="adm-order-details" id="adm-request-details-${req.id}" hidden>
            <div class="adm-order-info-grid">
              <div><strong>الإيميل:</strong> ${req.email}</div>
              <div><strong>الموبايل:</strong> ${req.phone}</div>
              ${req.business_name ? `<div class="full"><strong>النشاط:</strong> ${req.business_name}</div>` : ''}
              ${req.description ? `<div class="full"><strong>نبذة:</strong> ${req.description}</div>` : ''}
            </div>
            ${approvalBox}
          </div>
        </div>
      `;
    }).join('');
  }

  async function approveRequest(requestId) {
    const client = getSupabaseClient();
    if (!client) return;

    const input = document.querySelector(`[data-request-uuid-input="${requestId}"]`);
    const uuid = input ? input.value.trim() : '';
    if (!uuid) {
      toast('من فضلك الصق الـUUID بتاع الحساب اللي عملته أولاً');
      return;
    }

    const request = requestsCache.find(r => String(r.id) === String(requestId));
    if (!request) return;

    const { error: profileError } = await client
      .from('profiles')
      .upsert([{
        id: uuid,
        role: 'seller',
        provider_type: request.request_type,
        display_name: request.full_name
      }], { onConflict: 'id' });

    if (profileError) {
      console.error('[Admin] فشل ربط الحساب:', profileError);
      toast('تعذر ربط الحساب — تأكد إن الـUUID صحيح ومطابق لحساب موجود فعلاً في Supabase Auth');
      return;
    }

    const { error: requestError } = await client
      .from('signup_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', requestId);

    if (requestError) {
      console.error('[Admin] فشل تحديث حالة الطلب:', requestError);
      toast('تم ربط الحساب لكن تعذر تحديث حالة الطلب');
    } else {
      // لو التخصص حلاق: أضفه لقائمة الحلاقين المعتمدين (بدون تغيير باقي النظام)
      const descCode = String(request.description || '').match(/code:([a-z_]+)/i);
      const isBarberApp = request.request_type === 'barber' || (descCode && descCode[1] === 'barber');
      if (isBarberApp && typeof BarberStore !== 'undefined' && BarberStore.upsertFromApplication) {
        const pub = BarberStore.upsertFromApplication({
          full_name: request.full_name,
          phone: request.phone,
          description: request.description,
          business_name: request.business_name,
          userId: uuid
        });
        if (pub.success) {
          toast('تم قبول الطلب وربط الحساب + ظهور الحلاق في القائمة ✅');
          if (typeof renderBarbersSection === 'function') renderBarbersSection();
          if (typeof renderBarbersAdmin === 'function') renderBarbersAdmin();
        } else {
          toast('تم قبول الطلب وربط الحساب ✅');
        }
      } else {
        toast('تم قبول الطلب وربط الحساب ✅');
      }
    }
    loadRequests();
  }

  async function rejectRequest(requestId) {
    if (!confirm('متأكد من رفض طلب الانضمام ده؟')) return;
    const client = getSupabaseClient();
    if (!client) return;

    const { error } = await client
      .from('signup_requests')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) {
      console.error('[Admin] فشل رفض الطلب:', error);
      toast('تعذر رفض الطلب');
      return;
    }
    toast('تم رفض الطلب');
    loadRequests();
  }

  // ── Events ──────────────────────────────────────────────────
  fab.addEventListener('click', openModal);

  // مدخل بديل لو زرار الأدمن مخفي عن الحساب ده: index.html?admin=1
  if (new URLSearchParams(location.search).get('admin') === '1') {
    document.addEventListener('DOMContentLoaded', openModal);
  }
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const client = getSupabaseClient();
    if (!client) return;

    const email    = loginEmail.value.trim();
    const password = loginPassword.value;

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'جارِ الدخول...';
    const { error } = await client.auth.signInWithPassword({ email, password });
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = 'دخول';

    if (error) {
      loginErrors.innerHTML = '• البريد الإلكتروني أو كلمة المرور غير صحيحة';
      loginErrors.classList.add('show');
      return;
    }

    closeLoginOverlay();
    showAdminPanel();
  });

  loginCancelBtn.addEventListener('click', closeLoginOverlay);

  logoutBtn.addEventListener('click', async () => {
    const client = getSupabaseClient();
    if (client) await client.auth.signOut();
    closeModal();
    toast('تم تسجيل الخروج');
  });

  tabList.addEventListener('click', () => switchTab('list'));
  tabForm.addEventListener('click', () => { clearForm(); switchTab('form'); });

  // ── Barbers approval + bookings (P0/P1) ─────────────────────
  async function renderBarbersAdmin() {
    const tbody = $('#adm-barbers-tbody');
    const bookingsBody = $('#adm-bookings-tbody');
    if (!tbody || typeof BarberStore === 'undefined') return;

    const all = BarberStore.getAll();
    if (!all.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="adm-empty">لا يوجد حلاقين</td></tr>';
    } else {
      tbody.innerHTML = all.map(b => {
        const statusLabel = b.status === 'approved' ? 'معتمد' : b.status === 'pending' ? 'قيد المراجعة' : 'مرفوض';
        const cls = b.status === 'approved' ? 'delivered' : b.status === 'pending' ? 'pending' : 'cancelled';
        const actions = b.status === 'pending' ? `
          <button type="button" class="adm-icon-btn" data-barber-approve="${b.id}" title="موافقة">✅</button>
          <button type="button" class="adm-icon-btn" data-barber-reject="${b.id}" title="رفض">✕</button>
        ` : b.status === 'approved' ? `
          <button type="button" class="adm-icon-btn" data-barber-reject="${b.id}" title="إيقاف">⏸</button>
        ` : `
          <button type="button" class="adm-icon-btn" data-barber-approve="${b.id}" title="إعادة تفعيل">✅</button>
        `;
        return `<tr>
          <td>${b.avatar || ''} <strong>${b.name}</strong></td>
          <td>${b.area || '—'}</td>
          <td><span class="adm-order-badge ${cls}">${statusLabel}</span></td>
          <td>${(b.services || []).length}</td>
          <td class="adm-row-actions">${actions}</td>
        </tr>`;
      }).join('');
    }

    if (bookingsBody) {
      bookingsBody.innerHTML = '<tr><td colspan="7" class="adm-empty">جاري تحميل الحجوزات...</td></tr>';
      const bookings = (await BarberStore.refreshBookings()).slice(0, 30);
      if (!bookings.length) {
        bookingsBody.innerHTML = '<tr><td colspan="7" class="adm-empty">لا توجد حجوزات بعد</td></tr>';
      } else {
        bookingsBody.innerHTML = bookings.map(bk => {
          const cls = bk.status === 'pending' ? 'pending' : bk.status === 'confirmed' ? 'delivered' : 'cancelled';
          const label = bk.status === 'pending' ? 'قيد التأكيد' : bk.status === 'confirmed' ? 'مؤكد' : 'ملغي';
          const loc = bk.locationType === 'home' ? '🏠 منزلي' : '🏪 صالون';
          return `<tr>
            <td>${bk.id.slice(-8)}</td>
            <td>${bk.barberName}</td>
            <td>${bk.customerName}<br><small>${bk.customerPhone}</small></td>
            <td>${bk.date} ${bk.time}<br><small>${loc}</small></td>
            <td>${bk.serviceName}${bk.totalPrice != null ? '<br><small>' + Number(bk.totalPrice).toLocaleString() + ' ج' : ''}</small></td>
            <td><span class="adm-order-badge ${cls}">${label}</span></td>
            <td class="adm-row-actions">
              ${bk.status === 'pending' ? `<button type="button" class="adm-icon-btn" data-booking-confirm="${bk.id}">✓</button>` : ''}
              ${bk.status !== 'cancelled' ? `<button type="button" class="adm-icon-btn" data-booking-cancel="${bk.id}">✕</button>` : ''}
            </td>
          </tr>`;
        }).join('');
      }
    }
  }


  tabOrders.addEventListener('click', () => { switchTab('orders'); loadOrders(); });
  tabRequests.addEventListener('click', () => { switchTab('requests'); loadRequests(); });
  cancelBtn.addEventListener('click', () => switchTab('list'));

  ordersSearchInput.addEventListener('input', renderOrders);
  ordersStatusFilter.addEventListener('change', renderOrders);
  ordersRefreshBtn.addEventListener('click', loadOrders);

  requestsStatusFilter.addEventListener('change', renderRequests);
  requestsRefreshBtn.addEventListener('click', loadRequests);

  requestsListEl.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle-request]');
    if (toggle) {
      const details = document.getElementById(`adm-request-details-${toggle.dataset.toggleRequest}`);
      if (details) details.hidden = !details.hidden;
      return;
    }
    const approveBtn = e.target.closest('[data-approve-request]');
    if (approveBtn) { approveRequest(approveBtn.dataset.approveRequest); return; }
    const rejectBtn = e.target.closest('[data-reject-request]');
    if (rejectBtn) { rejectRequest(rejectBtn.dataset.rejectRequest); return; }
  });

  ordersListEl.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle-order]');
    if (!toggle) return;
    const details = document.getElementById(`adm-order-details-${toggle.dataset.toggleOrder}`);
    if (details) details.hidden = !details.hidden;
  });

  ordersListEl.addEventListener('change', async (e) => {
    const select = e.target.closest('[data-order-status]');
    if (!select) return;
    const orderId = select.dataset.orderStatus;
    const newStatus = select.value;
    const client = getSupabaseClient();
    if (!client) return;

    select.disabled = true;
    const { error } = await client
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    select.disabled = false;

    if (error) {
      console.error('[Admin] فشل تحديث حالة الطلب:', error);
      toast('تعذر تحديث حالة الطلب');
      return;
    }

    const order = ordersCache.find(o => String(o.id) === String(orderId));
    if (order) order.status = newStatus;
    toast('تم تحديث حالة الطلب');
    renderOrders();
  });

  searchEl.addEventListener('input', renderList);

  templateBtn?.addEventListener('click', downloadCsvTemplate);
  importBtn?.addEventListener('click', () => importInput?.click());

  const importImagesBtn = $('#adm-import-images-btn');
  const importImagesInput = $('#adm-import-images-input');
  importImagesBtn?.addEventListener('click', () => importImagesInput?.click());
  importImagesInput?.addEventListener('change', () => {
    const files = Array.from(importImagesInput.files || []);
    let added = 0;
    files.forEach(file => {
      let key = normalizeImageFileName(file.name);
      if (!key) return;
      if (!key.endsWith('.zip')) key += '.zip';
      csvLocalZips.set(key, file);
      added += 1;
    });
    updateCsvImagesStatus();
    if (lastCsvRawRecords.length) {
      buildPreviewFromCsv(lastCsvRawRecords).catch((err) => console.error(err));
    }
    toast(added ? `تم ربط ${csvLocalZips.size} ملف ZIP` : 'اختَر ملفات zip');
    importImagesInput.value = '';
  });

  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try { await importProducts(file); }
    catch (error) {
      errorsEl.innerHTML = `• تعذّر الاستيراد: ${error.message}`;
      errorsEl.classList.add('show');
    }
    importInput.value = '';
  });
  selectAllBtn?.addEventListener('click', () => {
    document.querySelectorAll('[data-preview-select]').forEach(input => {
      if (!input.disabled) input.checked = true;
    });
  });
  clearSelectionBtn?.addEventListener('click', () => {
    document.querySelectorAll('[data-preview-select]').forEach(input => {
      if (!input.disabled) input.checked = false;
    });
  });
  importSelectedBtn?.addEventListener('click', async () => {
    await importSelectedFromPreview();
  });

  previewTbody?.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-preview-select]');
    if (!checkbox) return;
    checkbox.checked = !!checkbox.checked;
  });

  imagesInput?.addEventListener('change', async () => {
    await addImageFiles(imagesInput.files);
    imagesInput.value = '';
  });


  imagePreviews.addEventListener('click', (e) => {
    const removeIndex = e.target.closest('[data-remove-image]')?.dataset.removeImage;
    if (removeIndex === undefined) return;
    productImages.splice(Number(removeIndex), 1);
    if (primaryImageIndex >= productImages.length) primaryImageIndex = Math.max(0, productImages.length - 1);
    renderImagePreviews();
  });

  imagePreviews.addEventListener('change', (e) => {
    if (e.target.name === 'primary-image') {
      primaryImageIndex = Number(e.target.value);
      renderImagePreviews();
    }
  });

  // ── Bulk delete events ──────────────────────────────────────
  bulkDeleteBtn.addEventListener('click', () => {
    if (bulkMode) exitBulkMode(); else enterBulkMode();
  });

  bulkCancelBtn.addEventListener('click', exitBulkMode);

  bulkSelectAll.addEventListener('change', () => {
    const query = searchEl.value.trim();
    const products = query ? ProductStore.search(query) : ProductStore.getAll();
    if (bulkSelectAll.checked) {
      products.forEach(p => selectedForDelete.add(String(p.id)));
    } else {
      selectedForDelete.clear();
    }
    renderList();
  });

  tbody.addEventListener('change', (e) => {
    const checkbox = e.target.closest('[data-bulk-select]');
    if (!checkbox) return;
    const id = checkbox.dataset.bulkSelect;
    if (checkbox.checked) selectedForDelete.add(String(id));
    else selectedForDelete.delete(String(id));
    updateBulkCount();
  });

  bulkDeleteSelectedBtn.addEventListener('click', async () => {
    if (!selectedForDelete.size) {
      toast('يرجى تحديد منتج واحد على الأقل');
      return;
    }
    if (!confirm(`هيتم حذف ${selectedForDelete.size} منتج نهائياً. متأكد؟`)) return;

    let success = 0, failed = 0;
    for (const id of selectedForDelete) {
      const result = await ProductStore.remove(id);
      if (result.success) success++; else failed++;
    }
    await ProductStore.flush();
    exitBulkMode();
    refreshEverything();
    toast(`تم حذف ${success} منتج${failed ? ' — فشل حذف ' + failed : ''}`);
  });

  tbody.addEventListener('click', async (e) => {
    const editId    = e.target.closest('[data-edit]')?.dataset.edit;
    const deleteId  = e.target.closest('[data-delete]')?.dataset.delete;
    const approveId = e.target.closest('[data-approve]')?.dataset.approve;
    const rejectId  = e.target.closest('[data-reject]')?.dataset.reject;

    if (editId) {
      const p = ProductStore.getById(editId);
      if (!p) return;
      fillForm(p);
      switchTab('form');
    }
    if (deleteId) {
      const p = ProductStore.getById(deleteId);
      if (!confirm(`حذف "${p ? p.name : deleteId}"؟`)) return;
      const result = await ProductStore.remove(deleteId);
      if (result.success) {
        refreshEverything();
        toast('تم حذف المنتج');
      } else {
        toast(result.errors.join(' — '));
      }
    }
    if (approveId) {
      const result = await ProductStore.update(approveId, { status: 'approved' });
      if (result.success) {
        await ProductStore.flush();
        refreshEverything();
        toast('تم قبول المنتج ✅');
      } else {
        toast(result.errors.join(' — '));
      }
    }
    if (rejectId) {
      if (!confirm('متأكد من رفض المنتج ده؟')) return;
      const result = await ProductStore.update(rejectId, { status: 'rejected' });
      if (result.success) {
        await ProductStore.flush();
        refreshEverything();
        toast('تم رفض المنتج');
      } else {
        toast(result.errors.join(' — '));
      }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const client  = getSupabaseClient();
    if (!client) { toast('تعذر الاتصال بالخادم'); return; }

    const existingId = $('#f-id').value.trim();
    const isEdit     = !!existingId;

    // توليد / قراءة الـ Product ID قبل أي رفع
    const productId = existingId || ProductStore.generateId();

    // قراءة الـ form — payload.imageUrl و payload.images ممكن يحتووا Blobs أو URLs
    const rawPayload = readForm();

    // ── فصل الـ Blobs الجديدة عن الـ URLs الموجودة ──────────────
    // productImages array: صور مرتبة كما يراها المستخدم
    // نبني قائمة كاملة (primary في الأول) لأغراض الرفع
    const orderedImages = [
      productImages[primaryImageIndex] || null,
      ...productImages.filter((_, i) => i !== primaryImageIndex)
    ].filter(Boolean);

    const newBlobs       = orderedImages.filter(img => img instanceof Blob);
    const existingUrls   = orderedImages.filter(img => typeof img === 'string' && img.startsWith('http'));

    // ── رفع الصور الجديدة (Blobs) إلى Storage ───────────────────
    let primaryUrl   = null;
    let additionalUrls = [];
    let uploadedPaths  = [];

    if (newBlobs.length) {
      const submitBtnEl = e.target.querySelector('[type="submit"]') || e.target.querySelector('button');
      const originalText = submitBtnEl?.textContent || '';
      if (submitBtnEl) { submitBtnEl.disabled = true; submitBtnEl.textContent = 'جارِ رفع الصور...'; }
      errorsEl.classList.remove('show');
      errorsEl.innerHTML = '';

      try {
        // primaryIndex بالنسبة للـ Blobs: الـ Blob الأول في القائمة هو الأساسي
        const uploadResult = await ProductStore.uploadProductImages(client, {
          blobs: newBlobs,
          primaryIndex: 0,
          productId
        });
        primaryUrl     = uploadResult.primaryUrl;
        additionalUrls = uploadResult.additionalUrls;
        uploadedPaths  = uploadResult._uploadedPaths || [];
      } catch (uploadErr) {
        if (submitBtnEl) { submitBtnEl.disabled = false; submitBtnEl.textContent = originalText; }
        errorsEl.innerHTML = `• ${uploadErr.message}`;
        errorsEl.classList.add('show');
        return;
      }

      if (submitBtnEl) { submitBtnEl.disabled = true; submitBtnEl.textContent = 'جارِ الحفظ...'; }
    }

    // ── تجميع الـ URLs النهائية ───────────────────────────────────
    // الترتيب: primary أولاً، ثم الإضافية الجديدة، ثم الـ URLs القديمة
    // (الصورة الأساسية هي أول صورة في orderedImages)
    const firstExistingIsOriginalPrimary = (
      orderedImages[0] &&
      typeof orderedImages[0] === 'string' &&
      orderedImages[0].startsWith('http')
    );

    if (!primaryUrl && firstExistingIsOriginalPrimary) {
      primaryUrl = orderedImages[0];
      // الـ existingUrls الإضافية (بعد الأولى)
      additionalUrls = [...additionalUrls, ...existingUrls.slice(1)];
    } else {
      additionalUrls = [...additionalUrls, ...existingUrls];
    }

    // ── بناء الـ payload النهائي بـ URLs فقط ──────────────────────
    const payload = {
      ...rawPayload,
      id:       productId,
      status:   'approved',
      imageUrl: primaryUrl   || null,
      images:   additionalUrls.filter(Boolean),
    };

    // ── حفظ المنتج ───────────────────────────────────────────────
    const result = isEdit
      ? await ProductStore.update(productId, payload)
      : await ProductStore.save(payload);

    const submitBtnEl2 = e.target.querySelector('[type="submit"]') || e.target.querySelector('button');
    if (submitBtnEl2) { submitBtnEl2.disabled = false; submitBtnEl2.textContent = isEdit ? '💾 حفظ التعديلات' : '➕ إضافة المنتج'; }

    if (!result.success) {
      // فشل INSERT — cleanup الصور التي تم رفعها في هذه العملية
      if (uploadedPaths.length && client) {
        try {
          await client.storage.from('product-images').remove(uploadedPaths);
          console.info('[Admin] Cleanup: removed', uploadedPaths.length, 'orphan file(s) after failed product save');
        } catch (cleanupErr) {
          console.error('[Admin] Cleanup after failed save:', cleanupErr);
        }
      }
      errorsEl.innerHTML = result.errors.map(err => `• ${err}`).join('<br/>');
      errorsEl.classList.add('show');
      return;
    }

    await ProductStore.flush();
    refreshEverything();
    toast(isEdit ? 'تم تحديث المنتج' : 'تم إضافة المنتج');
    switchTab('list');
  });

  // إخفاء/إظهار حقل المخزون عند تغيير نوع المنتج
  document.getElementById('f-productType')?.addEventListener('change', _updateStockFieldVisibility);

  // Initial default values for a fresh "add" form
  clearForm();

  const tabBarbers = $('#adm-tab-barbers');
  tabBarbers?.addEventListener('click', () => switchTab('barbers'));
  $('#adm-barbers-refresh')?.addEventListener('click', renderBarbersAdmin);
  $('#adm-barbers-tbody')?.addEventListener('click', (e) => {
    const approve = e.target.closest('[data-barber-approve]');
    const reject = e.target.closest('[data-barber-reject]');
    if (approve && typeof BarberStore !== 'undefined') {
      BarberStore.setStatus(approve.dataset.barberApprove, 'approved');
      if (typeof renderBarbersSection === 'function') renderBarbersSection();
      toast('تم اعتماد الحلاق');
      renderBarbersAdmin();
      if (typeof renderBarbersSection === 'function') renderBarbersSection();
    }
    if (reject && typeof BarberStore !== 'undefined') {
      BarberStore.setStatus(reject.dataset.barberReject, 'rejected');
      if (typeof renderBarbersSection === 'function') renderBarbersSection();
      toast('تم رفض/إيقاف الحلاق');
      renderBarbersAdmin();
      if (typeof renderBarbersSection === 'function') renderBarbersSection();
    }
  });
  $('#adm-bookings-tbody')?.addEventListener('click', async (e) => {
    const conf = e.target.closest('[data-booking-confirm]');
    const canc = e.target.closest('[data-booking-cancel]');
    if (conf && typeof BarberStore !== 'undefined') {
      const r = await BarberStore.updateBookingStatus(conf.dataset.bookingConfirm, 'confirmed');
      if (!r.success) { toast(r.error || 'تعذر تأكيد الحجز'); return; }
      toast('تم تأكيد الحجز');
      renderBarbersAdmin();
    }
    if (canc && typeof BarberStore !== 'undefined') {
      const r = await BarberStore.cancelBooking(canc.dataset.bookingCancel);
      if (!r.success) { toast(r.error || 'تعذر إلغاء الحجز'); return; }
      toast('تم إلغاء الحجز');
      renderBarbersAdmin();
    }
  });

  // ── رفع سريع: حتى 30 صورة → 30 منتج ─────────────────────────
  const qbOverlay = $('#adm-quick-batch-overlay');
  const qbBtn = $('#adm-quick-batch-btn');
  const qbStart = $('#qb-start-btn');
  const qbCancel = $('#qb-cancel-btn');
  const qbErrors = $('#qb-errors');

  qbBtn?.addEventListener('click', () => {
    qbOverlay?.classList.add('open');
    if (qbErrors) { qbErrors.classList.remove('show'); qbErrors.innerHTML = ''; }
  });
  qbCancel?.addEventListener('click', () => qbOverlay?.classList.remove('open'));
  qbOverlay?.addEventListener('click', (e) => {
    if (e.target === qbOverlay) qbOverlay.classList.remove('open');
  });

  qbStart?.addEventListener('click', async () => {
    const client = getSupabaseClient();
    if (!client) { toast('تعذر الاتصال'); return; }
    const files = Array.from($('#qb-images')?.files || []).slice(0, 30);
    if (!files.length) {
      if (qbErrors) { qbErrors.innerHTML = '• اختَر صورة واحدة على الأقل'; qbErrors.classList.add('show'); }
      return;
    }
    const section = $('#qb-section')?.value || 'kids';
    const category = ($('#qb-category')?.value || 'عام').trim();
    const price = Number($('#qb-price')?.value) || 100;
    qbStart.disabled = true;
    qbStart.textContent = 'جارِ الرفع...';
    let ok = 0, fail = 0;
    for (const file of files) {
      try {
        const productId = ProductStore.generateId();
        const blob = await readImageFile(file);
        const upload = await ProductStore.uploadProductImages(client, {
          blobs: [blob], primaryIndex: 0, productId
        });
        const name = String(file.name || 'منتج')
          .replace(/\.[^.]+$/, '')
          .replace(/[_-]+/g, ' ')
          .trim() || 'منتج جديد';
        const result = await ProductStore.save({
          id: productId,
          name,
          category,
          section,
          price,
          stock: 1,
          description: '',
          imageUrl: upload.primaryUrl || null,
          images: upload.additionalUrls || [],
          source: 'doddz',
          productType: 'physical',
          status: 'approved'
        });
        if (result.success) ok += 1; else fail += 1;
      } catch (err) {
        console.error(err);
        fail += 1;
      }
    }
    await ProductStore.flush();
    refreshEverything();
    qbStart.disabled = false;
    qbStart.textContent = 'بدء الرفع';
    qbOverlay?.classList.remove('open');
    toast(`تم: ${ok} منتج — فشل: ${fail}`);
  });

})();
