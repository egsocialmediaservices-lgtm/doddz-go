// ================================================================
// DODDZ PRODUCT DETAILS — يقرأ من ProductStore فقط
// ================================================================
(function () {

  const notFoundEl   = document.getElementById('pd-not-found');
  const mainEl       = document.getElementById('pd-main');
  const breadcrumbCat = document.getElementById('pd-breadcrumb-cat');
  const breadcrumbCur = document.getElementById('pd-breadcrumb-current');

  const BADGE_MAP = {
    best: { cls: 'pd-badge-best', label: 'الأكثر مبيعاً' },
    new:  { cls: 'pd-badge-new',  label: 'جديد' },
  };

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function showNotFound() {
    if (notFoundEl) notFoundEl.style.display = '';
    if (mainEl) mainEl.style.display = 'none';
    document.title = 'المنتج غير موجود — Doddz Go';
  }

  function buildGallery(product) {
    const list = [];
    if (product.imageUrl) list.push(product.imageUrl);
    (product.images || []).forEach(src => {
      if (src && !list.includes(src)) list.push(src);
    });
    return list;
  }

  function renderBadgeHTML(product) {
    if (product.badge === 'sale') {
      return `<span class="pd-badge pd-badge-sale">خصم ${product.discount || 0}%</span>`;
    }
    const b = BADGE_MAP[product.badge];
    return b ? `<span class="pd-badge ${b.cls}">${b.label}</span>` : '';
  }

  const SOURCE_LABELS = {
    doddz: 'Doddz', merchant: 'تاجر خارجي موثّق', affiliate: 'أفلييت'
  };

  function renderSourceHTML(product) {
    const label = SOURCE_LABELS[product.source] || product.source || 'Doddz';
    let html = `البائع: <strong>${label}</strong>`;
    if (product.sourceUrl) {
      html += ` <a class="pd-source-link" href="${product.sourceUrl}" target="_blank" rel="noopener noreferrer">المصدر الأصلي ↗</a>`;
    }
    return html;
  }

  function render(product) {
    document.title = `${product.name} — Doddz Go`;

    // Breadcrumb
    if (breadcrumbCat) breadcrumbCat.textContent = product.category || '';
    if (breadcrumbCur) breadcrumbCur.textContent = product.name;

    // معلومات أساسية
    document.getElementById('pd-cat').textContent = product.category || '';
    document.getElementById('pd-name').textContent = product.name;

    // التقييم
    document.getElementById('pd-stars').textContent =
      (typeof buildStars === 'function') ? buildStars(product.rating || 0) : '';
    document.getElementById('pd-reviews').textContent = `(${product.reviewsCount || 0} تقييم)`;

    // السعر والخصم
    document.getElementById('pd-price-now').textContent =
      `${(product.price || 0).toLocaleString()} جنيه`;

    const wasEl = document.getElementById('pd-price-was');
    const offEl = document.getElementById('pd-price-off');
    if (product.oldPrice && product.oldPrice > product.price) {
      wasEl.textContent = product.oldPrice.toLocaleString();
      offEl.textContent = `خصم ${product.discount || 0}%`;
      wasEl.style.display = '';
      offEl.style.display = '';
    } else {
      wasEl.style.display = 'none';
      offEl.style.display = 'none';
    }

    // الشارة
    document.getElementById('pd-badges').innerHTML = renderBadgeHTML(product);

    const productType = product.productType || 'physical';
    const isPhysical  = productType === 'physical';

    // المخزون + زرار الإجراء
    const stockEl = document.getElementById('pd-stock');
    const addBtn  = document.getElementById('pd-add-btn');

    if (isPhysical) {
      stockEl.style.display = '';
      if (product.stock > 0) {
        stockEl.textContent = `✔ متوفر في المخزون (${product.stock} قطعة)`;
        stockEl.className = 'pd-stock in';
        addBtn.disabled = false;
        addBtn.textContent = '+ أضف للعربة';
      } else {
        stockEl.textContent = '✕ غير متوفر حالياً';
        stockEl.className = 'pd-stock out';
        addBtn.disabled = true;
        addBtn.textContent = 'غير متوفر حالياً';
      }
    } else {
      stockEl.style.display = 'none';
      stockEl.textContent = '';
      stockEl.className = 'pd-stock';

      addBtn.disabled = false;
      if (productType === 'service') {
        addBtn.textContent = 'عرض الخدمة';
      } else if (productType === 'classified') {
        addBtn.textContent = 'عرض الإعلان';
      } else {
        addBtn.textContent = 'عرض التفاصيل';
      }
    }

    // الوصف
    const descriptionEl = document.getElementById('pd-desc');
    const descriptionToggle = document.getElementById('pd-desc-toggle');
    const description = product.description || 'لا يوجد وصف لهذا المنتج حالياً.';
    descriptionEl.textContent = description;
    descriptionEl.classList.remove('expanded');
    if (descriptionToggle) {
      const isLongDescription = description.length > 360;
      descriptionToggle.hidden = !isLongDescription;
      descriptionToggle.textContent = 'عرض المزيد';
      descriptionToggle.onclick = () => {
        const expanded = descriptionEl.classList.toggle('expanded');
        descriptionToggle.textContent = expanded ? 'عرض أقل' : 'عرض المزيد';
      };
    }

    // ===== الألوان والمقاسات (اختيار تفاعلي) =====
    let selectedColor = null;
    let selectedSize = null;

    function renderSelectableChips(list, type) {
      return list.map(val => `
        <button type="button" class="pd-chip pd-chip-${type}" data-variant-type="${type}" data-variant-value="${val}" aria-pressed="false">
          <span class="pd-chip-dot" aria-hidden="true"></span>
          <span class="pd-chip-text">${val}</span>
        </button>`).join('');
    }

    let variantsHTML = '';
    if (product.colors && product.colors.length) {
      variantsHTML += `
        <div class="pd-variant-group" id="group-colors">
          <span class="pd-variant-label">اللون: <strong id="pd-selected-color-txt" style="color:var(--black); font-weight:700;">(اختر لون)</strong></span>
          ${renderSelectableChips(product.colors, 'color')}
        </div>`;
    }
    if (product.sizes && product.sizes.length) {
      variantsHTML += `
        <div class="pd-variant-group" id="group-sizes">
          <span class="pd-variant-label">المقاس: <strong id="pd-selected-size-txt" style="color:var(--black); font-weight:700;">(اختر مقاس)</strong></span>
          ${renderSelectableChips(product.sizes, 'size')}
        </div>`;
    }
    const variantsContainer = document.getElementById('pd-variants');
    variantsContainer.innerHTML = variantsHTML;

    // إضافة أحداث الضغط على المقاسات والألوان
    variantsContainer.querySelectorAll('.pd-chip').forEach(chip => {
      chip.addEventListener('click', function() {
        const type = this.dataset.variantType;
        const val = this.dataset.variantValue;

        const parent = this.closest('.pd-variant-group');
        parent.querySelectorAll('.pd-chip').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed','false'); });

        this.classList.add('selected');

        if (type === 'color') {
          selectedColor = val;
          const label = document.getElementById('pd-selected-color-txt');
          if (label) label.textContent = val;
        } else if (type === 'size') {
          selectedSize = val;
          const label = document.getElementById('pd-selected-size-txt');
          if (label) label.textContent = val;
        }
      });
    });

    // المصدر
    document.getElementById('pd-source').innerHTML = renderSourceHTML(product);

    // الوسوم
    document.getElementById('pd-tags').innerHTML =
      (product.tags || []).map(t => `<span class="pd-tag">#${t}</span>`).join('');

    // ===== Gallery + Thumbnails =====
    const images    = buildGallery(product);
    const mainImgEl = document.getElementById('pd-gallery-main');
    const thumbsEl  = document.getElementById('pd-thumbs');

    function setMainImage(src) {
      mainImgEl.innerHTML = src
        ? `<img src="${src}" alt="${product.name}">`
        : (product.image || '📦');
    }

    if (images.length) {
      setMainImage(images[0]);
      thumbsEl.innerHTML = images.map((src, i) => `
        <div class="pd-thumb ${i === 0 ? 'active' : ''}" data-index="${i}">
          <img src="${src}" alt="صورة ${i + 1} من ${product.name}">
        </div>`).join('');

      thumbsEl.querySelectorAll('.pd-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
          thumbsEl.querySelectorAll('.pd-thumb').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          setMainImage(images[Number(thumb.dataset.index)]);
        });
      });
    } else {
      setMainImage(null);
      thumbsEl.innerHTML = '';
    }

    // ===== ربط زرار المفضلة في صفحة المنتج =====
    window._currentProductId = product.id;
    const favBtn = document.getElementById('pd-fav-btn');
    if (favBtn) {
      favBtn.textContent = (typeof isWishlisted === 'function' && isWishlisted(product.id)) ? '❤️' : '♡';
      favBtn.onclick = function(e) {
        if (typeof toggleWishlist === 'function') toggleWishlist(product.id, e);
      };
    }

    // ===== زر الإجراء =====
    addBtn.onclick = function (event) {
      if (isPhysical) {
        // التحقق من اختيار اللون لو المنتج يحتوي على ألوان
        if (product.colors && product.colors.length && !selectedColor) {
          if (typeof showToast === 'function') showToast('من فضلك اختر اللون أولاً 🎨');
          else alert('من فضلك اختر اللون أولاً');
          return;
        }
        // التحقق من اختيار المقاس لو المنتج يحتوي على مقاسات
        if (product.sizes && product.sizes.length && !selectedSize) {
          if (typeof showToast === 'function') showToast('من فضلك اختر المقاس أولاً 📏');
          else alert('من فضلك اختر المقاس أولاً');
          return;
        }

        if (typeof addToCart === 'function') {
          addToCart(product.id, event, { color: selectedColor, size: selectedSize });
        }
      } else {
        event.preventDefault();
        document.getElementById('pd-desc')?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    mainEl.style.display = '';
    notFoundEl.style.display = 'none';
  }

  async function init() {
    const productId = getParam('id');
    if (!productId) { showNotFound(); return; }

    if (typeof ProductStore === 'undefined') { showNotFound(); return; }

    if (typeof ProductStore.whenReady === 'function') {
      await ProductStore.whenReady();
    }

    const product = ProductStore.getById(productId);
    if (!product) { showNotFound(); return; }

    render(product);
  }

  document.addEventListener('DOMContentLoaded', init);
})();