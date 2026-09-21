// ================================================================
// DODDZ WISHLIST SYSTEM — v3.0 (With Built-in Drawer)
// ================================================================

let wishlist = JSON.parse(localStorage.getItem('doddz_wishlist')) || [];

function isWishlisted(id) {
  return wishlist.includes(String(id));
}

function saveWishlist() {
  localStorage.setItem('doddz_wishlist', JSON.stringify(wishlist));
  updateWishlistUI();
}

function pruneWishlist() {
  const valid = new Set(getWishlistProducts().map(p => String(p.id)));
  const next = wishlist.filter(id => valid.has(String(id)));
  if (next.length !== wishlist.length) {
    wishlist = next;
    localStorage.setItem('doddz_wishlist', JSON.stringify(wishlist));
  }
}

function updateWishlistUI() {
  pruneWishlist();
  const count = getWishlistProducts().length;
  // 1. تحديث العداد في الهيدر
  const favCount = document.getElementById('fav-count');
  if (favCount) favCount.textContent = `${count} عناصر`;
  document.querySelectorAll('.hdr-btn').forEach(btn => {
    if (btn.id === 'fav-btn' || btn.id === 'wishlist-btn' || (btn.querySelector('.label') && btn.querySelector('.label').textContent.includes('المفضلة'))) {
      const sub = btn.querySelector('.sub');
      if (sub) sub.textContent = `${count} عناصر`;
    }
  });

  // 2. تحديث قلوب الكروت في الصفحة الرئيسية
  document.querySelectorAll('.pcard').forEach(card => {
    const id = card.dataset.id;
    const favIcon = card.querySelector('.pcard-fav');
    if (favIcon && id) {
      favIcon.classList.toggle('active', isWishlisted(id));
      favIcon.innerHTML = isWishlisted(id) ? `<svg class="icon-heart is-active" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>` : `<svg class="icon-heart" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    }
  });

  // 3. تحديث زر المفضلة في صفحة تفاصيل المنتج (product.html)
  const pdFavBtn = document.getElementById('pd-fav-btn');
  if (pdFavBtn && window._currentProductId) {
    const on = isWishlisted(window._currentProductId);
    pdFavBtn.classList.toggle('active', on);
    pdFavBtn.innerHTML = on ? `<svg class="icon-heart is-active" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>` : `<svg class="icon-heart" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  }

  // 4. تحديث العداد داخل درج المفضلة
  const drawerCount = document.getElementById('wishlist-drawer-count');
  if (drawerCount) {
    drawerCount.textContent = `${getWishlistProducts().length} منتج محفوظ`;
  }
}

function toggleWishlist(productId, event) {
  if (event) event.stopPropagation();
  const id = String(productId);
  const index = wishlist.indexOf(id);

  if (index > -1) {
    wishlist.splice(index, 1);
    if (typeof showToast === 'function') showToast('تمت الإزالة من المفضلة');
  } else {
    wishlist.push(id);
    if (typeof showToast === 'function') showToast('تمت الإضافة للمفضلة');
  }

  saveWishlist();
  renderWishlistDrawer();
}

function toggleFav(el, event, directId = null) {
  if (event) event.stopPropagation();
  const id = directId || el?.closest('.pcard')?.dataset.id;
  if (id) toggleWishlist(id, event);
}

// ------------------------------------------------
// بناء والتحكم في درج المفضلة (Wishlist Drawer)
// ------------------------------------------------
function ensureWishlistDOM() {
  if (document.getElementById('wishlist-drawer')) return;
  const markup = `
    <div id="wishlist-overlay" class="cart-overlay" onclick="closeWishlist()"></div>
    <aside id="wishlist-drawer" class="cart-drawer">
      <div class="cart-drawer-header">
        <div>
          <div class="cart-title">مفضلتي</div>
          <div class="cart-subtitle" id="wishlist-drawer-count">${wishlist.length} منتج محفوظ</div>
        </div>
        <button class="cart-close" onclick="closeWishlist()">✕</button>
      </div>
      <div id="wishlist-items" class="cart-items"></div>
    </aside>
  `;
  document.body.insertAdjacentHTML('beforeend', markup);
}

function openWishlist() {
  ensureWishlistDOM();
  const drawer = document.getElementById('wishlist-drawer');
  const overlay = document.getElementById('wishlist-overlay');
  if (!drawer || !overlay) return;
  renderWishlistDrawer();
  drawer.classList.add('open');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeWishlist() {
  const drawer = document.getElementById('wishlist-drawer');
  const overlay = document.getElementById('wishlist-overlay');
  if (!drawer || !overlay) return;
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function getWishlistProducts() {
  return wishlist.map(id => {
    if (typeof ProductStore !== 'undefined') {
      const p = ProductStore.getById(id);
      if (p) return p;
    }
    if (typeof PRODUCTS !== 'undefined') {
      return PRODUCTS.find(p => String(p.id) === String(id)) || null;
    }
    return null;
  }).filter(Boolean);
}

function renderWishlistDrawer() {
  ensureWishlistDOM();
  const container = document.getElementById('wishlist-items');
  if (!container) return;

  const products = getWishlistProducts();

  if (!products.length) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </div>
        <h3>المفضلة فارغة</h3>
        <p>لسه مفيش منتجات محفوظة في مفضلتك</p>
        <button onclick="closeWishlist()">ابدأ التسوق</button>
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(product => {
    const isPhysical = (product.productType || 'physical') === 'physical';
    const ctaBtn = isPhysical
      ? `<button class="pcard-btn pcard-btn-cart wl-move-cart" onclick="addToCart('${product.id}', event); closeWishlist(); openCart();">نقل إلى السلة</button>`
      : `<button class="pcard-btn wl-move-cart" onclick="window.location.href='product.html?id=${product.id}'">عرض التفاصيل</button>`;
    return `
    <div class="cart-item">
      <div class="cart-item-img ${product.imageClass || ''}">
        ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}">` : (product.image || '📦')}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name" style="cursor:pointer;" onclick="window.location.href='product.html?id=${product.id}'">${product.name}</div>
        <div class="cart-item-price">${(product.price || 0).toLocaleString()} جنيه</div>
        ${ctaBtn}
      </div>
      <button class="cart-remove" onclick="toggleWishlist('${product.id}', event)" title="إزالة من المفضلة" aria-label="إزالة">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  `;
  }).join('');
}

// ------------------------------------------------
// ربط الأحداث
// ------------------------------------------------
function initWishlist() {
  ensureWishlistDOM();
  updateWishlistUI();

  // ربط زر المفضلة في الهيدر
  document.querySelectorAll('.hdr-btn').forEach(btn => {
    if (btn.textContent.includes('المفضلة') || btn.id === 'wishlist-btn') {
      btn.id = 'wishlist-btn';
      btn.onclick = function(e) {
        e.preventDefault();
        openWishlist();
      };
    }
  });
}

document.addEventListener('DOMContentLoaded', initWishlist);
window.addEventListener('products-ready', updateWishlistUI);

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initWishlist();
}