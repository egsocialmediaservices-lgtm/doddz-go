// ================================================================
// DODDZ PRODUCT DATA LAYER — v1.1
// ================================================================
// source values:       'doddz' | 'merchant' | 'affiliate' | أي مصدر استيراد مستقبلي (مثال: 'aliexpress', 'noon'...)
// productType:         'physical' | 'digital' | 'course' | 'subscription' | 'service'
// badge values:        'best' | 'new' | 'sale' | null
// imageClass:          img-art | img-design | img-tech | img-dog | img-course
// section:             sell | pets | home | fashion | tech | merchants | bestsellers | new
// ── Import metadata (اختيارية — تتملى تلقائياً لو المنتج مستورد من مصدر خارجي) ──
// description:         نص وصف المنتج (string)
// images[]:             مصفوفة روابط/data-URIs لصور المنتج (أول 5 بحد أقصى)
// sourceProductId:      الـ ID الأصلي للمنتج عند مصدر الاستيراد (string | null)
// sourceUrl:            رابط صفحة المنتج الأصلية عند مصدر الاستيراد (string | null)
// ================================================================

const PRODUCTS = [

  // ── عروض بيع أي شيء ──────────────────────────────────────────
  {
    id: 'sell_001', section: 'sell',
    name: 'موبايل iPhone 13 مستعمل بحالة ممتازة',
    category: 'إلكترونيات', image: '📱', imageClass: 'img-art',
    price: 8500, oldPrice: 12000, discount: 29,
    rating: 5, reviewsCount: 45, badge: 'best',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'sell_002', section: 'sell',
    name: 'كنبة L شكل 5 أماكن حالة كويسة',
    category: 'أثاث', image: '🛋️', imageClass: 'img-design',
    price: 3200, oldPrice: 5000, discount: 36,
    rating: 4, reviewsCount: 18, badge: 'new',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'sell_003', section: 'sell',
    name: 'عجلة رياضية 26 بوصة مستعملة',
    category: 'رياضة', image: '🚲', imageClass: 'img-dog',
    price: 1800, oldPrice: null, discount: null,
    rating: 4, reviewsCount: 12, badge: null,
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'sell_004', section: 'sell',
    name: 'كاميرا Canon DSLR مع عدسة 18-55',
    category: 'تصوير', image: '📷', imageClass: 'img-tech',
    price: 6400, oldPrice: 8000, discount: 20,
    rating: 5, reviewsCount: 33, badge: 'sale',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'sell_005', section: 'sell',
    name: 'جاكيت جلد أصلي مقاس L بحالة ممتازة',
    category: 'ملابس', image: '👗', imageClass: 'img-course',
    price: 950, oldPrice: null, discount: null,
    rating: 4, reviewsCount: 7, badge: null,
    source: 'doddz', productType: 'physical'
  },

  // ── مستلزمات حيوانات ─────────────────────────────────────────
  {
    id: 'pets_001', section: 'pets',
    name: 'طوق جلد طبيعي فاخر مع اسم الحيوان',
    category: 'كلاب', image: '🐕', imageClass: 'img-dog',
    price: 195, oldPrice: null, discount: null,
    rating: 5, reviewsCount: 74, badge: 'best',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'pets_002', section: 'pets',
    name: 'رمل قطط ممتص للروائح 10 كيلو',
    category: 'قطط', image: '🐱', imageClass: 'img-dog',
    price: 120, oldPrice: 150, discount: 20,
    rating: 4, reviewsCount: 88, badge: 'new',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'pets_003', section: 'pets',
    name: 'قفص طيور كبير مع وعاء أكل ومشرب',
    category: 'طيور', image: '🦜', imageClass: 'img-dog',
    price: 350, oldPrice: 450, discount: 22,
    rating: 4, reviewsCount: 41, badge: null,
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'pets_004', section: 'pets',
    name: 'مجموعة ألعاب تفاعلية للكلاب 5 قطع',
    category: 'ألعاب', image: '🎾', imageClass: 'img-dog',
    price: 120, oldPrice: null, discount: null,
    rating: 5, reviewsCount: 103, badge: null,
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'pets_005', section: 'pets',
    name: 'سرير قطيفة مريح للحيوانات مقاس L',
    category: 'نوم', image: '🏠', imageClass: 'img-dog',
    price: 299, oldPrice: 380, discount: 21,
    rating: 4, reviewsCount: 59, badge: null,
    source: 'doddz', productType: 'physical'
  },

  // ── المنزل والديكور ───────────────────────────────────────────
  {
    id: 'home_001', section: 'home',
    name: 'طاولة قهوة خشب مع زجاج مقاوم',
    category: 'أثاث', image: '🛋️', imageClass: 'img-art',
    price: 1200, oldPrice: 1800, discount: 33,
    rating: 5, reviewsCount: 67, badge: 'best',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'home_002', section: 'home',
    name: 'طقم شموع عطرية مع حامل فاخر',
    category: 'ديكور', image: '🕯️', imageClass: 'img-design',
    price: 280, oldPrice: null, discount: null,
    rating: 4, reviewsCount: 44, badge: 'new',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'home_003', section: 'home',
    name: 'طقم أواني طهي تيفال 7 قطع',
    category: 'مطبخ', image: '🍳', imageClass: 'img-tech',
    price: 1450, oldPrice: 2000, discount: 27,
    rating: 5, reviewsCount: 92, badge: null,
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'home_004', section: 'home',
    name: 'طقم بشكير فندقي قطن مصري',
    category: 'حمام', image: '🛁', imageClass: 'img-course',
    price: 380, oldPrice: null, discount: null,
    rating: 4, reviewsCount: 38, badge: null,
    source: 'doddz', productType: 'physical'
  },

  // ── ملابس وأزياء ─────────────────────────────────────────────
  {
    id: 'fashion_001', section: 'fashion',
    name: 'فستان سواريه شيفون — ألوان متعددة',
    category: 'ستات', image: '👗', imageClass: 'img-art',
    price: 450, oldPrice: 650, discount: 31,
    rating: 5, reviewsCount: 156, badge: 'best',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'fashion_002', section: 'fashion',
    name: 'سنيكرز Nike Air Max مقاس 42',
    category: 'أحذية', image: '👟', imageClass: 'img-design',
    price: 1200, oldPrice: null, discount: null,
    rating: 4, reviewsCount: 89, badge: 'new',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'fashion_003', section: 'fashion',
    name: 'بدلة رسمية سليم فيت — أسود وكحلي',
    category: 'رجالي', image: '👔', imageClass: 'img-tech',
    price: 2800, oldPrice: 3500, discount: 20,
    rating: 5, reviewsCount: 72, badge: null,
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'fashion_004', section: 'fashion',
    name: 'شنطة يد جلد صناعي — بيج وأسود',
    category: 'اكسسوارات', image: '👒', imageClass: 'img-course',
    price: 560, oldPrice: 800, discount: 30,
    rating: 4, reviewsCount: 61, badge: 'sale',
    source: 'doddz', productType: 'physical'
  },

  // ── تكنولوجيا ─────────────────────────────────────────────────
  {
    id: 'tech_001', section: 'tech',
    name: 'سماعات لاسلكية بعزل الصوت الاحترافي',
    category: 'سماعات', image: '🎧', imageClass: 'img-tech',
    price: 899, oldPrice: 1200, discount: 25,
    rating: 5, reviewsCount: 312, badge: 'sale',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'tech_002', section: 'tech',
    name: 'لابتوب Dell i7 جيل 12 — 16GB RAM',
    category: 'لابتوب', image: '💻', imageClass: 'img-tech',
    price: 18500, oldPrice: 22000, discount: 16,
    rating: 5, reviewsCount: 55, badge: 'new',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'tech_003', section: 'tech',
    name: 'كيبورد ميكانيكي RGB للجيمرز',
    category: 'إكسسوارات', image: '⌨️', imageClass: 'img-tech',
    price: 550, oldPrice: null, discount: null,
    rating: 4, reviewsCount: 88, badge: null,
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'tech_004', section: 'tech',
    name: 'Samsung Galaxy S24 — 256GB',
    category: 'موبايل', image: '📱', imageClass: 'img-tech',
    price: 22000, oldPrice: 26000, discount: 15,
    rating: 5, reviewsCount: 178, badge: null,
    source: 'doddz', productType: 'physical'
  },

  // ── التجار — نوع خاص (merchant cards) ───────────────────────
  {
    id: 'merch_001', section: 'merchants',
    name: 'متجر الإلكترونيات الحديثة',
    category: 'تاجر موثق ✓', image: '🏪',
    imageStyle: 'background:linear-gradient(135deg,#ff6b4a22,#ff6b4a44)',
    price: null, oldPrice: null, discount: null,
    rating: 5, reviewsCount: 420,
    badge: null, productCount: '+850 منتج',
    source: 'merchant', productType: 'service'
  },
  {
    id: 'merch_002', section: 'merchants',
    name: 'Fashion House — ملابس عصرية',
    category: 'تاجر موثق ✓', image: '👗',
    imageStyle: 'background:linear-gradient(135deg,#2ed57322,#2ed57344)',
    price: null, oldPrice: null, discount: null,
    rating: 4, reviewsCount: 280,
    badge: null, productCount: '+320 منتج',
    source: 'merchant', productType: 'service'
  },
  {
    id: 'merch_003', section: 'merchants',
    name: 'Home Decor — أثاث وديكور',
    category: 'تاجر موثق ✓', image: '🏠',
    imageStyle: 'background:linear-gradient(135deg,#4facfe22,#4facfe44)',
    price: null, oldPrice: null, discount: null,
    rating: 5, reviewsCount: 195,
    badge: null, productCount: '+560 منتج',
    source: 'merchant', productType: 'service'
  },
  {
    id: 'merch_004', section: 'merchants',
    name: 'Pet World — كل حاجة لحيوانك',
    category: 'تاجر موثق ✓', image: '🐾',
    imageStyle: 'background:linear-gradient(135deg,#a29bfe22,#a29bfe44)',
    price: null, oldPrice: null, discount: null,
    rating: 4, reviewsCount: 144,
    badge: null, productCount: '+240 منتج',
    source: 'merchant', productType: 'service'
  },

  // ── الأكثر مبيعاً ────────────────────────────────────────────
  {
    id: 'best_001', section: 'bestsellers',
    name: 'iPhone 14 Pro 256GB — أسود',
    category: 'موبايل', image: '📱', imageClass: 'img-tech',
    price: 32000, oldPrice: 36000, discount: 11,
    rating: 5, reviewsCount: 512, badge: 'best',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'best_002', section: 'bestsellers',
    name: 'أكل كلاب Royal Canin 15 كيلو',
    category: 'حيوانات', image: '🐕', imageClass: 'img-dog',
    price: 850, oldPrice: 1100, discount: 23,
    rating: 5, reviewsCount: 389, badge: 'best',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'best_003', section: 'bestsellers',
    name: 'تيشيرت Oversized Unisex — 8 ألوان',
    category: 'ملابس', image: '👗', imageClass: 'img-art',
    price: 180, oldPrice: null, discount: null,
    rating: 4, reviewsCount: 267, badge: 'best',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'best_004', section: 'bestsellers',
    name: 'مرتبة اسفنج طبي 160×200 سم',
    category: 'منزل', image: '🛋️', imageClass: 'img-design',
    price: 3500, oldPrice: 4500, discount: 22,
    rating: 5, reviewsCount: 201, badge: 'best',
    source: 'doddz', productType: 'physical'
  },

  // ── وصل حديثاً ───────────────────────────────────────────────
  {
    id: 'new_001', section: 'new',
    name: 'PlayStation 5 Slim + دراعين + 3 العاب',
    category: 'جيمينج', image: '🎮', imageClass: 'img-tech',
    price: 28000, oldPrice: null, discount: null,
    rating: 5, reviewsCount: 88, badge: 'new',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'new_002', section: 'new',
    name: 'Adidas Samba OG — أبيض وأسود',
    category: 'أحذية', image: '👟', imageClass: 'img-course',
    price: 1800, oldPrice: null, discount: null,
    rating: 5, reviewsCount: 134, badge: 'new',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'new_003', section: 'new',
    name: 'مجموعة نباتات صناعية ديكور — 3 قطع',
    category: 'ديكور', image: '🕯️', imageClass: 'img-design',
    price: 320, oldPrice: null, discount: null,
    rating: 4, reviewsCount: 47, badge: 'new',
    source: 'doddz', productType: 'physical'
  },
  {
    id: 'new_004', section: 'new',
    name: 'برج قطط 5 طوابق مع أنفاق وألعاب',
    category: 'قطط', image: '🐱', imageClass: 'img-dog',
    price: 750, oldPrice: 950, discount: 21,
    rating: 5, reviewsCount: 29, badge: 'new',
    source: 'doddz', productType: 'physical'
  }

]; // end PRODUCTS

// ================================================================
// PRODUCT STORE — v2.0
// Supabase-first data layer for Doddz Go
// ================================================================
// Supabase is the source of truth. IndexedDB is only a local fallback/cache.
// The public read API remains synchronous after whenReady() resolves.
// ================================================================

const ProductStore = (() => {

  // ── Private constants ──────────────────────────────────────────
  const DB_NAME       = 'doddz_store';
  const DB_VERSION    = 1;
  const PRODUCTS_STORE = 'products';
  const META_STORE     = 'meta';
  const LS_KEY         = 'doddz_products';
  const LS_SEED_KEY    = 'doddz_store_seeded';
  const BACKUP_KEY     = 'doddz_products_backup_v1';
  const MIGRATION_KEY  = 'localStorage_migrated_v1';

  // ── Required fields for validation ────────────────────────────
  const REQUIRED = ['name', 'price', 'category', 'stock'];

  // ── Private helpers ────────────────────────────────────────────

  let cache = [];
  let db = null;
  let imageUrls = new Map();
  let persistQueue = Promise.resolve();
  let isReady = false;
  let readyResolve;
  const readyPromise = new Promise(resolve => { readyResolve = resolve; });

  function _openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PRODUCTS_STORE)) {
          database.createObjectStore(PRODUCTS_STORE, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(META_STORE)) {
          database.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function _request(storeName, mode, action) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function _allStored() {
    return _request(PRODUCTS_STORE, 'readonly', store => store.getAll());
  }

  function _meta(key) {
    return _request(META_STORE, 'readonly', store => store.get(key));
  }

  function _putMeta(key, value) {
    return _request(META_STORE, 'readwrite', store => store.put({ key, value }));
  }

  function _writeAll(products) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PRODUCTS_STORE, 'readwrite');
      const store = transaction.objectStore(PRODUCTS_STORE);
      store.clear();
      products.forEach(product => store.put(product));
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function _queuePersist() {
    const snapshot = cache.map(product => ({ ...product }));
    // مهم: الـ .catch لازم يبقى جزء من نفس السلسلة اللي بتتخزن في persistQueue،
    // عشان لو كتابة واحدة فشلت، السلسلة ترجع "resolved" وتكمل باقي الكتابات
    // بدل ما تفضل "rejected" للأبد وتوقف كل حفظ جاي بعدها.
    persistQueue = persistQueue
      .then(() => db ? _writeAll(snapshot) : undefined)
      .catch(error => console.error('[ProductStore] IndexedDB write failed:', error));
    return persistQueue;
  }

  /** ينتظر لحد ما كل الكتابات المعلّقة على IndexedDB تخلص فعلياً */
  function flush() {
    return persistQueue;
  }

  function _dataUrlToBlob(value) {
    if (typeof value === 'string' && imageUrls.has(value)) return imageUrls.get(value);
    if (typeof value !== 'string' || !value.startsWith('data:')) return value;
    const parts = value.split(',');
    const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const binary = atob(parts[1] || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function _arrayValue(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined || value === '') return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return value.split(',').map(item => item.trim()).filter(Boolean);
      }
    }
    return [];
  }

  // The only Supabase-to-domain mapping in the application.
  function _fromSupabase(raw) {
    return _normalise({
      id: raw.id,
      name: raw.name,
      category: raw.category,
      subcategory: raw.subcategory,
      section: raw.section,
      price: raw.price,
      oldPrice: raw.old_price,
      taagerCost: raw.taager_cost,
      stock: raw.stock,
      productType: raw.product_type,
      source: raw.source,
      image: raw.image,
      imageClass: raw.image_class,
      imageUrl: raw.primary_image,
      images: _arrayValue(raw.additional_images),
      colors: _arrayValue(raw.colors),
      sizes: _arrayValue(raw.sizes),
      description: raw.description,
      tags: _arrayValue(raw.tags),
      badge: raw.badge,
      featured: raw.featured,
      isBestSeller: raw.is_best_seller,
      isNew: raw.is_new,
      rating: raw.rating,
      reviewsCount: raw.reviews_count,
      sourceProductId: raw.source_product_id,
      sourceUrl: raw.source_url,
      taagerUrl: raw.taager_url,
      sku: raw.sku,
      brand: raw.brand,
      ownerId: raw.owner_id,
      contactPhone: raw.contact_phone,
      status: raw.status,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at
    }, String(raw.id));
  }

  function _imageValue(value) {
    if (!value) return null;
    if (value instanceof Blob || String(value).startsWith('blob:')) {
      throw new Error('صور المنتج المحلية تحتاج إلى رفع Storage قبل حفظ المنتج في Supabase');
    }
    return String(value);
  }

  // The only domain-to-Supabase mapping in the application.
  function _toSupabase(product) {
    const row = {
      id: String(product.id),
      name: product.name,
      category: product.category,
      subcategory: product.subcategory || null,
      section: product.section,
      price: product.price,
      old_price: product.oldPrice,
      taager_cost: product.taagerCost,
      stock: product.stock,
      product_type: product.productType,
      source: product.source,
      primary_image: _imageValue(product.imageUrl),
      additional_images: (product.images || []).map(_imageValue).filter(Boolean),
      image: product.image || null,
      image_class: product.imageClass || null,
      colors: product.colors || [],
      sizes: product.sizes || [],
      description: product.description || null,
      tags: product.tags || [],
      badge: product.badge,
      featured: Boolean(product.featured),
      is_best_seller: Boolean(product.isBestSeller),
      is_new: Boolean(product.isNew),
      rating: product.rating,
      reviews_count: product.reviewsCount,
      source_product_id: product.sourceProductId,
      source_url: product.sourceUrl,
      taager_url: product.taagerUrl,
      sku: product.sku || null,
      brand: product.brand || null,
      owner_id: product.ownerId || null,
      contact_phone: product.contactPhone || null,
    };

    if (product.status !== undefined && product.status !== null) row.status = product.status;
    if (product.createdAt) row.created_at = product.createdAt;
    if (product.updatedAt) row.updated_at = product.updatedAt;
    return row;
  }

  async function _convertImages(product) {
    const converted = { ...product };
    converted.imageUrl = _dataUrlToBlob(converted.imageUrl);
    converted.images = (converted.images || []).map(_dataUrlToBlob);
    return converted;
  }

  function _imageSrc(value) {
    if (!(value instanceof Blob)) return value || '';
    if (!imageUrls.has(value)) {
      const url = URL.createObjectURL(value);
      imageUrls.set(value, url);
      imageUrls.set(url, value);
    }
    return imageUrls.get(value);
  }

  function _toView(product) {
    if (!product) return null;
    return {
      ...product,
      imageUrl: _imageSrc(product.imageUrl),
      images: (product.images || []).map(_imageSrc)
    };
  }

  /** Auto-calculate discount % from oldPrice and price.
   *  Returns integer or null if oldPrice is absent / lower than price. */
  function _calcDiscount(price, oldPrice) {
    if (!oldPrice || oldPrice <= price) return null;
    return Math.round(((oldPrice - price) / oldPrice) * 100);
  }

  /** Normalise + enrich a raw product object before storage.
   *  Never mutates the original — returns a new object. */
  function _normalise(raw, existingId = null) {
    const now = new Date().toISOString();
    return {
      ...raw,
      // ── Identity ────────────────────────────────────────────
      id:           String(existingId || raw.id || generateId()),

      // ── Display ─────────────────────────────────────────────
      name:         (raw.name         || '').trim(),
      image:        raw.image         || '',
      imageClass:   raw.imageClass    || 'img-art',
      imageUrl:     _dataUrlToBlob(raw.imageUrl || null),
      images:       (Array.isArray(raw.images) ? raw.images.slice(0, 5) : []).map(_dataUrlToBlob),

      // ── Pricing ─────────────────────────────────────────────
      taagerCost:   Number(raw.taagerCost)  || 0,
      price:        Number(raw.price)       || 0,
      oldPrice:     raw.oldPrice ? Number(raw.oldPrice) : null,
      discount:     _calcDiscount(
                      Number(raw.price)    || 0,
                      raw.oldPrice ? Number(raw.oldPrice) : null
                    ),

      // ── Classification ──────────────────────────────────────
      category:     (raw.category    || '').trim(),
      subcategory:  (raw.subcategory || '').trim(),
      section:      raw.section      || 'sell',
      productType:  raw.productType  || 'physical',
      source:       raw.source       || 'doddz',
      ownerId:      raw.ownerId || raw.owner_id ? String(raw.ownerId || raw.owner_id) : null,

      // ── Contact (اختيارية — رقم تواصل خاص بالإعلان/الخدمة، يُستخدم لاحقاً في واجهة المستخدم) ──
      contactPhone: raw.contactPhone || raw.contact_phone ? String(raw.contactPhone || raw.contact_phone).trim() : null,

      // ── Import metadata (للمنتجات المستوردة من مصدر خارجي مستقبلاً) ──
      // بتفضل null لأي منتج مُنشأ يدوياً من الموقع أو لوحة الإدارة.
      sourceProductId: raw.sourceProductId ? String(raw.sourceProductId).trim() : null,
      sourceUrl:       raw.sourceUrl       ? String(raw.sourceUrl).trim()       : null,
      taagerUrl:       raw.taagerUrl       ? String(raw.taagerUrl).trim()       : null,

      // ── Inventory ───────────────────────────────────────────
      stock:        Number(raw.stock) >= 0 ? Number(raw.stock) : 0,

      // ── Variants ────────────────────────────────────────────
colors:       Array.isArray(raw.colors) 
                      ? raw.colors 
                      : (typeof raw.colors === 'string' ? raw.colors.split(',').map(s => s.trim()).filter(Boolean) : []),
      sizes:        Array.isArray(raw.sizes)  
                      ? raw.sizes  
                      : (typeof raw.sizes === 'string' ? raw.sizes.split(',').map(s => s.trim()).filter(Boolean) : []),

      // ── Content ─────────────────────────────────────────────
      description:  (raw.description || '').trim(),
      tags:         Array.isArray(raw.tags)
                      ? raw.tags
                      : (raw.tags || '').split(',').map(t => t.trim()).filter(Boolean),

      // ── Status flags ────────────────────────────────────────
      badge:        raw.badge       || null,   // 'best' | 'new' | 'sale' | null
      featured:     Boolean(raw.featured),
      isBestSeller: Boolean(raw.isBestSeller),
      isNew:        Boolean(raw.isNew),
      status:       raw.status || 'approved',

      // ── Social proof ────────────────────────────────────────
      rating:       Number(raw.rating)       || 0,
      reviewsCount: Number(raw.reviewsCount) || 0,

      // ── Timestamps ──────────────────────────────────────────
      createdAt:    raw.createdAt || now,
      updatedAt:    raw.updatedAt || raw.updated_at || now,
    };
  }

  /** Validate required fields — returns { valid: bool, errors: string[] } */
  function _validate(product) {
    const errors = [];
    if (!product.name)                    errors.push('name مطلوب');
    if (!product.price || product.price <= 0) errors.push('price مطلوب وأكبر من 0');
    if (!product.category)                errors.push('category مطلوبة');
    if (product.stock == null || product.stock < 0) errors.push('stock مطلوب (0 أو أكبر)');
    return { valid: errors.length === 0, errors };
  }

  // ── Seed ──────────────────────────────────────────────────────

  async function _initialise() {
    let stored = [];
    try {
      try {
        db = await _openDB();
        stored = await _allStored();
      } catch (error) {
        console.error('[ProductStore] IndexedDB unavailable:', error);
        db = null;
      }

      const client = typeof window !== 'undefined' ? window.supabaseClient : null;
      if (client) {
        const { data, error } = await client.from('products').select('*');
        if (!error && Array.isArray(data)) {
          cache = data.map(_fromSupabase);
          if (db) {
            try {
              await _writeAll(cache);
              console.info(`[ProductStore] Loaded ${cache.length} products from Supabase and refreshed IndexedDB cache`);
            } catch (cacheError) {
              console.error('[ProductStore] Supabase read succeeded but IndexedDB cache refresh failed:', cacheError);
            }
          } else {
            console.info(`[ProductStore] Loaded ${cache.length} products from Supabase`);
          }
          return;
        }
        console.error('[ProductStore] Supabase products read failed:', error);
      } else {
        console.error('[ProductStore] Supabase client unavailable; using IndexedDB fallback.');
      }

      if (!stored.length) {
        const rawLegacy = localStorage.getItem(LS_KEY);
        if (rawLegacy) {
          try {
            const legacy = JSON.parse(rawLegacy) || [];
            if (legacy.length) {
              localStorage.setItem(BACKUP_KEY, JSON.stringify({
                createdAt: new Date().toISOString(),
                products: legacy,
                seeded: localStorage.getItem(LS_SEED_KEY)
              }));
              stored = await Promise.all(legacy.map(product =>
                _convertImages(_normalise(product, product.id))
              ));
              if (db) await _writeAll(stored);
              await _putMeta(MIGRATION_KEY, { completedAt: new Date().toISOString() });
              localStorage.removeItem(LS_KEY);
              localStorage.removeItem(LS_SEED_KEY);
            }
          } catch (error) {
            console.error('[ProductStore] Legacy cache migration failed:', error);
          }
        }
      }

      cache = await Promise.all(stored.map(product =>
        _convertImages(_normalise(product, product.id))
      ));
      console.info(`[ProductStore] Using ${cache.length} products from IndexedDB fallback/cache`);
    } catch (error) {
      console.error('[ProductStore] Product initialisation failed:', error);
      cache = [];
    } finally {
      isReady = true;
      readyResolve();
      if (typeof initProducts === 'function') initProducts();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('products-ready'));
    }
  }

  // ── Storage Upload ────────────────────────────────────────────

  // الأنواع المسموح بها
  const _ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  // الحد الأقصى لحجم الـ Blob (بعد الـ compress فعلياً هو أصغر، لكن كـ safety check)
  const _MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
  const _STORAGE_BUCKET  = 'product-images';

  /** توليد UUID بسيط بدون dependency خارجية */
  function _uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /**
   * رفع صور منتج إلى Supabase Storage.
   *
   * @param {object} client        - Supabase client (window.supabaseClient)
   * @param {object} options
   * @param {Blob[]}  options.blobs         - مصفوفة الـ Blobs (بعد الـ compress)
   * @param {number}  options.primaryIndex  - index الصورة الأساسية
   * @param {string}  options.productId     - الـ ID المولَّد مسبقاً
   *
   * @returns {Promise<{ primaryUrl: string|null, additionalUrls: string[], _uploadedPaths: string[] }>}
   *
   * ملاحظات الأمان:
   * - owner ID يُؤخذ من الجلسة الحالية فقط (auth.getUser())، لا من المُعامِل.
   * - المسار: <userId>/<productId>/<uuid>.jpg
   * - عند أي فشل: cleanup لكل ما تم رفعه + throw
   */
  async function uploadProductImages(client, { blobs, primaryIndex, productId }) {
    if (!client) throw new Error('Supabase client غير متاح');

    // ── التحقق من الجلسة — owner ID يأتي من Auth فقط ──────────
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user?.id) {
      throw new Error('يجب تسجيل الدخول أولاً قبل رفع الصور');
    }
    const userId = userData.user.id;

    if (!productId) throw new Error('productId مطلوب لتحديد مسار الصورة في Storage');
    if (!Array.isArray(blobs) || !blobs.length) return { primaryUrl: null, additionalUrls: [], _uploadedPaths: [] };

    // ── Validation ─────────────────────────────────────────────
    blobs.forEach((blob, i) => {
      if (!(blob instanceof Blob)) {
        throw new Error(`الصورة رقم ${i + 1} ليست ملف صورة صالح`);
      }
      // نتحقق من نوع الـ MIME — لا نعتمد فقط على HTML accept=""
      if (!_ALLOWED_IMAGE_TYPES.includes(blob.type)) {
        throw new Error(`الصورة رقم ${i + 1}: نوع الملف "${blob.type}" غير مدعوم. المسموح: JPEG, PNG, WebP, GIF`);
      }
      if (blob.size > _MAX_IMAGE_BYTES) {
        throw new Error(`الصورة رقم ${i + 1} حجمها ${(blob.size / 1024 / 1024).toFixed(1)} MB — الحد الأقصى 10 MB`);
      }
    });

    // ── الرفع ─────────────────────────────────────────────────
    const uploadedPaths = []; // للـ cleanup عند الفشل

    async function _uploadOne(blob) {
      const ext = blob.type === 'image/png'  ? 'png'
                : blob.type === 'image/webp' ? 'webp'
                : blob.type === 'image/gif'  ? 'gif'
                : 'jpg';
      const filename = `${_uuid()}.${ext}`;
      const path     = `${userId}/${productId}/${filename}`;

      const { error: uploadError } = await client.storage
        .from(_STORAGE_BUCKET)
        .upload(path, blob, {
          contentType: blob.type,
          upsert: false          // نرفض الكتابة فوق ملف موجود
        });

      if (uploadError) {
        throw new Error(`فشل رفع صورة إلى Storage: ${uploadError.message}`);
      }

      uploadedPaths.push(path);

      const { data: urlData } = client.storage
        .from(_STORAGE_BUCKET)
        .getPublicUrl(path);

      if (!urlData?.publicUrl) {
        throw new Error('تعذّر الحصول على الرابط العام للصورة بعد الرفع');
      }
      return urlData.publicUrl;
    }

    async function _cleanupUploaded() {
      if (!uploadedPaths.length) return;
      try {
        await client.storage.from(_STORAGE_BUCKET).remove(uploadedPaths);
        console.info('[ProductStore.upload] Cleanup:', uploadedPaths.length, 'file(s) removed');
      } catch (cleanupErr) {
        console.error('[ProductStore.upload] Cleanup failed:', cleanupErr);
      }
    }

    // رفع الصور واحدة تلو الأخرى (sequential لضمان صحة uploadedPaths)
    const urls = [];
    try {
      for (const blob of blobs) {
        const url = await _uploadOne(blob);
        urls.push(url);
      }
    } catch (uploadErr) {
      // فشل الرفع — cleanup ما تم رفعه ثم bubble up
      await _cleanupUploaded();
      throw uploadErr;
    }

    // ── تقسيم الـ URLs على primary + additional ────────────────
    const safeIndex      = (primaryIndex >= 0 && primaryIndex < urls.length) ? primaryIndex : 0;
    const primaryUrl     = urls[safeIndex];
    const additionalUrls = urls.filter((_, i) => i !== safeIndex);

    return { primaryUrl, additionalUrls, _uploadedPaths: uploadedPaths };
  }

  // ── Public API ────────────────────────────────────────────────

  /** Generate a unique product ID */
  function generateId() {
    const ts   = Date.now();
    const rand = Math.random().toString(36).slice(2, 6);
    return `doddz_${ts}_${rand}`;
  }

  /** Return all products (full array) */
  function getAll() {
    return cache.map(_toView);
  }

  /** Return a single product by ID, or null */
  function getById(id) {
    return _toView(cache.find(p => p.id === id) || null);
  }

  /** Save a NEW product.
   *  Auto-generates ID if absent.
   *  Returns { success, product, errors } */
  async function save(rawProduct) {
    const product  = _normalise(rawProduct);
    const result   = _validate(product);
    if (!result.valid) return { success: false, product: null, errors: result.errors };

    const existing = cache;

    // Guard: never overwrite an existing ID
    if (existing.some(p => p.id === product.id)) {
      return { success: false, product: null, errors: ['ID موجود بالفعل — استخدم update()'] };
    }

    try {
      const client = typeof window !== 'undefined' ? window.supabaseClient : null;
      if (!client) throw new Error('Supabase client unavailable');

      const { data, error } = await client
        .from('products')
        .insert([_toSupabase(product)])
        .select('*')
        .single();
      if (error) throw error;

      const savedProduct = _fromSupabase(data);
      cache = [...existing, savedProduct];
      await _queuePersist();
      return { success: true, product: _toView(savedProduct), errors: [] };
    } catch (error) {
      console.error('[ProductStore] Save failed:', error);
      return { success: false, product: null, errors: [`تعذّر حفظ المنتج في Supabase: ${error.message || error}`] };
    }
  }

  /** Update an EXISTING product by ID.
   *  Merges partial fields — only provided keys are changed.
   *  Returns { success, product, errors } */
  async function update(id, partialProduct) {
    const all   = cache;
    const normalizedId = String(id);
    const index = all.findIndex(p => p.id === normalizedId);
    if (index === -1) return { success: false, product: null, errors: [`منتج بـ id "${id}" مش موجود`] };

    const merged  = _normalise({
      ...all[index],
      ...partialProduct,
      updatedAt: new Date().toISOString()
    }, normalizedId);
    const result  = _validate(merged);
    if (!result.valid) return { success: false, product: null, errors: result.errors };

    try {
      const client = typeof window !== 'undefined' ? window.supabaseClient : null;
      if (!client) throw new Error('Supabase client unavailable');

      const { data, error } = await client
        .from('products')
        .update(_toSupabase(merged))
        .eq('id', normalizedId)
        .select('*')
        .single();
      if (error) throw error;

      const updatedProduct = _fromSupabase(data);
      const nextCache = [...all];
      nextCache[index] = updatedProduct;
      cache = nextCache;
      await _queuePersist();
      return { success: true, product: _toView(updatedProduct), errors: [] };
    } catch (error) {
      console.error('[ProductStore] Update failed:', error);
      return { success: false, product: null, errors: [`تعذّر حفظ التعديلات في Supabase: ${error.message || error}`] };
    }
  }

  /** Delete a product by ID.
   *  Returns { success, errors } */
  async function remove(id) {
    const all     = cache;
    const normalizedId = String(id);
    const filtered = all.filter(p => p.id !== normalizedId);
    if (filtered.length === all.length) {
      return { success: false, errors: [`منتج بـ id "${id}" مش موجود`] };
    }

    try {
      const client = typeof window !== 'undefined' ? window.supabaseClient : null;
      if (!client) throw new Error('Supabase client unavailable');

      const { error } = await client
        .from('products')
        .delete()
        .eq('id', normalizedId);
      if (error) throw error;

      cache = filtered;
      await _queuePersist();
      return { success: true, errors: [] };
    } catch (error) {
      console.error('[ProductStore] Delete failed:', error);
      return { success: false, errors: [`تعذّر حذف المنتج من Supabase: ${error.message || error}`] };
    }
  }

  /** Search products by name, category, or tags.
   *  Case-insensitive. Returns filtered array. */
  function search(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return getAll();
    return cache.filter(p =>
      p.name.toLowerCase().includes(q)        ||
      p.category.toLowerCase().includes(q)    ||
      p.tags.some(t => t.toLowerCase().includes(q))
    ).map(_toView);
  }

  /** Filter by category. Returns filtered array. */
  function filterByCategory(category) {
    return cache.filter(p => p.category === category).map(_toView);
  }

  /** Filter by section. Returns filtered array. */
  function filterBySection(section) {
    return cache.filter(p => p.section === section).map(_toView);
  }

  /** Return stats summary — handy for console debugging */
  function stats() {
    const all = cache;
    const bySection = {};
    all.forEach(p => { bySection[p.section] = (bySection[p.section] || 0) + 1; });
    return {
      total:       all.length,
      bySection,
      storageKey:  DB_NAME + '/' + PRODUCTS_STORE,
      storageSizeKB: null
    };
  }

  /** Hard-reset IndexedDB and re-seed from static PRODUCTS. */
  function reset() {
    cache = PRODUCTS.map(p => _normalise(p, p.id));
    _queuePersist();
    console.warn('[ProductStore] Store reset and re-seeded.');
  }

  /** Promise يتحقق (resolve) أول ما ProductStore يخلص تحميل بياناته من IndexedDB.
   *  أي كود بيقرأ منتج فور تحميل الصفحة (زي product.html) لازم ينتظره الأول،
   *  عشان القراءة ما تسبقش تحميل البيانات الفعلية من القاعدة. */
  function whenReady() {
    return isReady ? Promise.resolve() : readyPromise;
  }

  // ── Initialise on script load ─────────────────────────────────
  _initialise();

  // ── Expose public API ─────────────────────────────────────────
  return {
    generateId,
    getAll,
    getById,
    save,
    update,
    remove,
    delete: remove,    // 'delete' is a reserved word — alias remove
    search,
    filterByCategory,
    filterBySection,
    stats,
    reset,
    getImageSrc: _imageSrc,
    flush,
    whenReady,
    uploadProductImages,
  };

})(); // end ProductStore IIFE

// ================================================================
// RENDERING ENGINE — بناء وعرض كروت المنتجات في كل قسم
// ================================================================

/** التنقل لصفحة تفاصيل المنتج */
function goToProduct(id) {
  window.location.href = 'product.html?id=' + encodeURIComponent(id);
}

/** بناء نجوم التقييم */
function buildStars(rating) {
  const full  = Math.floor(rating);
  const empty = 5 - full;
  return '★'.repeat(full) + '☆'.repeat(empty);
}

/** render card عادي (physical / digital / course / service / classified) */
function renderCard(p) {
  const badgeMap = {
    best: '<span class="pcard-badge badge-best">الأكثر مبيعاً</span>',
    new:  '<span class="pcard-badge badge-new">جديد</span>',
    sale: `<span class="pcard-badge badge-sale">خصم ${p.discount}%</span>`
  };
  const badgeHTML  = p.badge ? badgeMap[p.badge] : '';
  const priceOld   = p.oldPrice
    ? `<span class="price-was">${p.oldPrice.toLocaleString()}</span>
       <span class="price-off">${p.discount}%</span>` : '';
  const gallery = [];
  if (p.imageUrl) gallery.push(p.imageUrl);
  (p.images || []).forEach(src => { if (src && !gallery.includes(src)) gallery.push(src); });
  const galleryLimited = gallery.slice(0, 5);
  const productImage = galleryLimited.length
    ? `<div class="pcard-gallery" data-gallery-count="${galleryLimited.length}">
         ${galleryLimited.map((src, i) => `<img src="${src}" alt="${p.name}" class="pcard-gallery-img${i === 0 ? ' is-active' : ''}" data-gallery-index="${i}" loading="lazy"/>`).join('')}
         ${galleryLimited.length > 1 ? `<div class="pcard-gallery-dots">${galleryLimited.map((_, i) => `<span class="pcard-dot${i===0?' is-active':''}" data-dot="${i}"></span>`).join('')}</div>` : ''}
       </div>`
    : (p.image ? `<div class="pcard-gallery-fallback">${p.image}</div>` : `<div class="pcard-gallery-fallback"></div>`);

  // تحديد زر الإجراء (CTA) بحسب نوع المنتج مع الرجوع الافتراضي لـ physical
  const productType = p.productType || 'physical';
  let ctaButton;
  if (productType === 'service') {
    ctaButton = `<button class="pcard-btn" onclick="event.stopPropagation(); goToProduct('${p.id}')">عرض الخدمة</button>`;
  } else if (productType === 'classified') {
    ctaButton = `<button class="pcard-btn" onclick="event.stopPropagation(); goToProduct('${p.id}')">عرض الإعلان</button>`;
  } else {
    // physical أو أي منتج تقليدي
    ctaButton = `<button class="pcard-btn pcard-btn-cart" onclick="addToCart('${p.id}', event)">أضف إلى السلة</button>`;
  }

  return `
  <div class="pcard" data-id="${p.id}" data-source="${p.source}" data-type="${productType}" onclick="goToProduct('${p.id}')">
    <div class="pcard-img ${p.imageClass || ''}">
      ${productImage}
      ${badgeHTML}
      <button type="button" class="pcard-fav" aria-label="مفضلة" onclick="toggleFav(this, event, '${p.id}')" title="أضف للمفضلة">
        <svg class="icon-heart" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
    </div>
    <div class="pcard-body">
      <div class="pcard-cat">${p.category}</div>
      <div class="pcard-name">${p.name}</div>
      <div class="pcard-stars">
        <span class="stars">${buildStars(p.rating)}</span>
        <span class="stars-count">(${p.reviewsCount})</span>
      </div>
      <div class="pcard-price">
        <span class="price-now">${p.price.toLocaleString()} جنيه</span>
        ${priceOld}
      </div>
      ${ctaButton}
    </div>
  </div>`;
}

/** render merchant card (source === 'merchant') */
function renderMerchantCard(p) {
  return `
  <div class="pcard" data-id="${p.id}" data-source="${p.source}" data-type="${p.productType || 'service'}"
       style="background:#2a2a3d; border-color:#3a3a5c;">
    <div class="pcard-img" style="${p.imageStyle || ''}">${p.image}</div>
    <div class="pcard-body">
      <div class="pcard-cat" style="color:#ff6b4a;">${p.category}</div>
      <div class="pcard-name" style="color:#fff;">${p.name}</div>
      <div class="pcard-stars">
        <span class="stars">${buildStars(p.rating)}</span>
        <span class="stars-count" style="color:#aaa;">(${p.reviewsCount} تقييم)</span>
      </div>
      <div class="pcard-price">
        <span class="price-now" style="color:#ff6b4a;">${p.productCount}</span>
      </div>
      <button class="pcard-btn" onclick="event.stopPropagation(); showToast('صفحة متجر «${p.name}» هتكون متاحة قريباً 🚀')">زيارة المتجر</button>
    </div>
  </div>`;
}

/** render section — يحشو الـ container بالـ cards */
function renderSection(sectionId, products) {
  const container = document.getElementById('section-' + sectionId);
  if (!container) return;
  const sectionProducts = products.filter(p => p.section === sectionId);
  container.innerHTML = sectionProducts.map(p =>
    p.source === 'merchant' ? renderMerchantCard(p) : renderCard(p)
  ).join('');
}
/** ربط المفضلة الحقيقية */
function toggleFav(el, event, id) {
  if (typeof window.toggleWishlist === 'function') {
    const targetId = id || el?.closest('.pcard')?.dataset?.id;
    window.toggleWishlist(targetId, event);
  }
}

/** تشغيل كل الـ sections — يقرأ من ProductStore لو موجود، fallback للـ PRODUCTS */
function initProducts() {
  const sections = [
    'sell', 'electronics', 'mobiles', 'laptops', 'fashion', 'shoes', 'watches',
    'home', 'pets', 'toys', 'sports', 'beauty', 'kids', 'books', 'barber_supplies',
    'tech', 'merchants', 'services', 'carwash', 'handmade', 'bestsellers', 'new'
  ];
  const all      = (typeof ProductStore !== 'undefined')
    ? ProductStore.getAll()
    : PRODUCTS;
  // فلترة المنتجات المعتمدة فقط للواجهة العامة
  const approved = all.filter(p => {
    const st = (p.status || 'approved');
    return st === 'approved' || st === 'active' || st === 'published';
  });
  sections.forEach(s => renderSection(s, approved));
}

// ── شغّل عند تحميل الصفحة ──
document.addEventListener('DOMContentLoaded', () => {
  initProducts();
  initProductCardGalleries();
});

/** سلايد صور فرعية عند تمرير الماوس على كارت المنتج */
function initProductCardGalleries() {
  const root = document.body;
  if (!root || root.dataset.galleryBound === '1') return;
  root.dataset.galleryBound = '1';

  function setActive(gallery, index) {
    const imgs = gallery.querySelectorAll('.pcard-gallery-img');
    const dots = gallery.querySelectorAll('.pcard-dot');
    if (!imgs.length) return;
    const i = ((index % imgs.length) + imgs.length) % imgs.length;
    imgs.forEach((img, n) => img.classList.toggle('is-active', n === i));
    dots.forEach((dot, n) => dot.classList.toggle('is-active', n === i));
    gallery.dataset.active = String(i);
  }

  function startSlide(gallery) {
    if (!gallery || Number(gallery.dataset.galleryCount || 0) <= 1) return;
    if (gallery._slideTimer) return;
    gallery._slideTimer = setInterval(() => {
      const cur = Number(gallery.dataset.active || 0);
      setActive(gallery, cur + 1);
    }, 1100);
  }

  function stopSlide(gallery, reset) {
    if (!gallery) return;
    if (gallery._slideTimer) {
      clearInterval(gallery._slideTimer);
      gallery._slideTimer = null;
    }
    if (reset) setActive(gallery, 0);
  }

  // Desktop hover
  root.addEventListener('mouseenter', (e) => {
    const gallery = e.target.closest?.('.pcard-gallery');
    startSlide(gallery);
  }, true);
  root.addEventListener('mouseleave', (e) => {
    const gallery = e.target.closest?.('.pcard-gallery');
    stopSlide(gallery, true);
  }, true);

  // Mobile / touch: auto-slide while card is on screen
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const gallery = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
          startSlide(gallery);
        } else {
          stopSlide(gallery, true);
        }
      });
    }, { threshold: [0.55, 0.75] });

    const observeAll = () => {
      document.querySelectorAll('.pcard-gallery[data-gallery-count]').forEach((g) => {
        if (Number(g.dataset.galleryCount || 0) > 1 && !g.dataset.ioBound) {
          g.dataset.ioBound = '1';
          io.observe(g);
        }
      });
    };
    observeAll();
    // بعد رسم أقسام جديدة
    const mo = new MutationObserver(() => observeAll());
    mo.observe(root, { childList: true, subtree: true });
  }

  // لمس سريع: تمرير يدوي بين الصور
  let touchX = 0;
  root.addEventListener('touchstart', (e) => {
    const gallery = e.target.closest?.('.pcard-gallery');
    if (!gallery || Number(gallery.dataset.galleryCount || 0) <= 1) return;
    touchX = e.changedTouches[0].clientX;
    stopSlide(gallery, false);
  }, { passive: true });
  root.addEventListener('touchend', (e) => {
    const gallery = e.target.closest?.('.pcard-gallery');
    if (!gallery || Number(gallery.dataset.galleryCount || 0) <= 1) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) < 30) {
      startSlide(gallery);
      return;
    }
    const cur = Number(gallery.dataset.active || 0);
    setActive(gallery, dx < 0 ? cur + 1 : cur - 1);
    startSlide(gallery);
  }, { passive: true });
}

// إعادة ربط بعد أي إعادة رسم أقسام
const _origInitProducts = initProducts;
initProducts = function () {
  _origInitProducts();
  // galleries use event delegation — لا حاجة لإعادة الربط
};