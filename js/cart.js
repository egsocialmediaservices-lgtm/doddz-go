// ================================================================
// DODDZ CART SYSTEM — v2.1 (ProductStore-backed with Variants)
// ================================================================

let cart = JSON.parse(localStorage.getItem('doddz_cart')) || [];

// ------------------------------------------------
// مفتاح فريد لكل عنصر في السلة بناءً على المقاس واللون
// ------------------------------------------------
function getCartItemKey(id, color, size) {
  return `${id}_${color || ''}_${size || ''}`;
}

// ------------------------------------------------
// فتح وإغلاق نافذة عربة التسوق
// ------------------------------------------------
function openCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (!drawer || !overlay) return;
  drawer.classList.add('open');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (!drawer || !overlay) return;
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('cart-btn')?.addEventListener('click', openCart);

// ------------------------------------------------
// Toast تأكيد الإضافة للعربة
// ------------------------------------------------
function showCartToast(product) {
  let toast = document.getElementById('cart-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cart-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `تمت إضافة <strong>${product.name}</strong> للعربة`;
  toast.classList.add('show');
  clearTimeout(window.cartToastTimer);
  window.cartToastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ------------------------------------------------
// حفظ العربة
// ------------------------------------------------
function saveCart() {
  localStorage.setItem('doddz_cart', JSON.stringify(cart));
}

// ------------------------------------------------
// إضافة منتج للعربة مع اللون والمقاس
// ------------------------------------------------
function addToCart(productId, event, options = {}) {
  if (event) event.stopPropagation();

  const product = ProductStore.getById(productId);
  if (!product) {
    console.error('Product not found:', productId);
    return;
  }

  const color = options.color || null;
  const size = options.size || null;
  const itemKey = getCartItemKey(product.id, color, size);

  const existing = cart.find(item => getCartItemKey(item.id, item.color, item.size) === itemKey);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: product.id,
      color: color,
      size: size,
      quantity: 1
    });
  }

  saveCart();
  updateCartUI();
  showCartToast(product);

  const btn = document.getElementById('cart-btn');
  if (btn) {
    btn.style.transform = 'scale(1.08)';
    btn.style.background = '#ff6b4a';
    setTimeout(() => {
      btn.style.transform = '';
      btn.style.background = '';
    }, 350);
  }
}

// ------------------------------------------------
// زيادة الكمية
// ------------------------------------------------
function increaseCartItem(key) {
  const item = cart.find(i => getCartItemKey(i.id, i.color, i.size) === key);
  if (!item) return;
  item.quantity++;
  saveCart();
  updateCartUI();
}

// ------------------------------------------------
// تقليل الكمية
// ------------------------------------------------
function decreaseCartItem(key) {
  const item = cart.find(i => getCartItemKey(i.id, i.color, i.size) === key);
  if (!item) return;
  item.quantity--;
  if (item.quantity <= 0) {
    cart = cart.filter(i => getCartItemKey(i.id, i.color, i.size) !== key);
  }
  saveCart();
  updateCartUI();
}

// ------------------------------------------------
// حذف منتج
// ------------------------------------------------
function removeFromCart(key) {
  cart = cart.filter(i => getCartItemKey(i.id, i.color, i.size) !== key);
  saveCart();
  updateCartUI();
}

// ------------------------------------------------
// بيانات العربة مع بيانات المنتجات ومتغيراتها
// ------------------------------------------------
function getCartProducts() {
  return cart
    .map(item => {
      const product = ProductStore.getById(item.id);
      if (!product) return null;
      return {
        ...product,
        cartKey: getCartItemKey(item.id, item.color, item.size),
        selectedColor: item.color,
        selectedSize: item.size,
        quantity: item.quantity
      };
    })
    .filter(Boolean);
}

// ------------------------------------------------
// حساب العدد
// ------------------------------------------------
function getCartCount() {
  // فقط المنتجات الموجودة فعليًا — يمنع ظهور رقم في الهيدر والعربة فاضية
  return getCartProducts().reduce((total, product) => total + (product.quantity || 0), 0);
}

function pruneOrphanCartItems() {
  const before = cart.length;
  cart = cart.filter(item => {
    try { return !!(typeof ProductStore !== 'undefined' && ProductStore.getById(item.id)); }
    catch { return false; }
  });
  if (cart.length !== before) saveCart();
}

// ------------------------------------------------
// حساب الإجمالي
// ------------------------------------------------
function getCartTotal() {
  return getCartProducts().reduce(
    (total, product) => total + (product.price * product.quantity),
    0
  );
}

// ------------------------------------------------
// تحديث Header + Drawer
// ------------------------------------------------
function updateCartUI() {
  pruneOrphanCartItems();
  const count = getCartCount();
  const total = getCartTotal();

  document.querySelectorAll('#cart-count, .cart-count').forEach(countEl => {
    countEl.textContent = String(count);
    countEl.hidden = count <= 0;
    countEl.classList.toggle('is-empty', count <= 0);
    countEl.classList.toggle('has-items', count > 0);
  });
  document.querySelectorAll('#cart-total').forEach(totalEl => {
    totalEl.textContent = total.toLocaleString() + ' جنيه';
  });

  renderCartDrawer();
}

// ------------------------------------------------
// رسم محتوى العربة
// ------------------------------------------------
function renderCartDrawer() {
  const container = document.getElementById('cart-items');
  const footer     = document.getElementById('cart-drawer-footer');
  if (!container) return;

  const products = getCartProducts();

  // العربة فاضية
  if (!products.length) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <h3>العربة فاضية</h3>
        <p>لسه مفيش منتجات في عربتك</p>
        <button onclick="closeCart()">ابدأ التسوق</button>
      </div>
    `;
    if (footer) footer.innerHTML = '';
    return;
  }

  // رسم المنتجات
  container.innerHTML = products.map(product => {
    const itemTotal = product.price * product.quantity;
    const variantLabel = [product.selectedColor, product.selectedSize].filter(Boolean).join(' | ');

    return `
      <div class="cart-item">
        <div class="cart-item-img ${product.imageClass || ''}">
          ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}">` : product.image}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${product.name}</div>
          ${variantLabel ? `<div class="cart-item-variant">${variantLabel}</div>` : ''}
          <div class="cart-item-price">${product.price.toLocaleString()} جنيه</div>
          <div class="cart-item-bottom">
            <div class="qty-control">
              <button onclick="decreaseCartItem('${product.cartKey}')">−</button>
              <span>${product.quantity}</span>
              <button onclick="increaseCartItem('${product.cartKey}')">+</button>
            </div>
            <strong>${itemTotal.toLocaleString()} جنيه</strong>
          </div>
        </div>
        <button class="cart-remove" onclick="removeFromCart('${product.cartKey}')" title="حذف" aria-label="حذف">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;
  }).join('');

  // Footer
  if (footer) {
    const total = getCartTotal();
    footer.innerHTML = `
      <div class="cart-summary">
        <div>
          <span>الإجمالي</span>
          <strong>${total.toLocaleString()} جنيه</strong>
        </div>
        <button class="cart-checkout" onclick="checkoutCart()">إتمام الطلب ←</button>
      </div>
    `;
  }
}

// ------------------------------------------------
// إتمام الطلب — ربط الطلبات بـ Supabase
// ------------------------------------------------
const checkoutOverlay    = document.getElementById('checkout-overlay');
const checkoutCloseBtn   = document.getElementById('checkout-close');
const checkoutSummaryEl  = document.getElementById('checkout-summary');
const checkoutForm       = document.getElementById('checkout-form');
const checkoutErrorsEl   = document.getElementById('checkout-errors');
const checkoutSubmitBtn  = document.getElementById('checkout-submit-btn');
const checkoutSuccessEl  = document.getElementById('checkout-success');
const checkoutOrderRefEl = document.getElementById('checkout-order-ref');
const checkoutDoneBtn    = document.getElementById('checkout-done-btn');

const DELIVERY_FEE = 0;

function generateOrderId() {
  return 'order_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// خطأ برسالة واضحة للمستخدم (بدون ما نضيّع السبب الحقيقي)
function userFacingError(message) {
  const err = new Error(message);
  err.userMessage = message;
  return err;
}

function checkoutFriendlyMessage(error) {
  const code = error && error.code ? String(error.code) : '';
  const msg  = error && error.message ? String(error.message).toLowerCase() : '';
  if (code === '42501' || msg.includes('row-level security')) {
    return 'السيرفر رفض حفظ الطلب (صلاحية) — حدّث الصفحة وجرّب تاني.';
  }
  if (code === '42703' || msg.includes('does not exist') || msg.includes('column')) {
    return 'في تحديث ناقص في قاعدة البيانات — بلّغ الإدارة.';
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return 'تعذر الوصول للسيرفر — تأكد من الاتصال بالإنترنت وجرّب تاني.';
  }
  return 'تعذر إرسال الطلب. جرّب تاني بعد قليل.';
}

function showCheckoutError(message) {
  if (!checkoutErrorsEl) return;
  checkoutErrorsEl.innerHTML = `• ${message}`;
  checkoutErrorsEl.classList.add('show');
}

function clearCheckoutError() {
  if (!checkoutErrorsEl) return;
  checkoutErrorsEl.classList.remove('show');
  checkoutErrorsEl.innerHTML = '';
}

function renderCheckoutSummary() {
  if (!checkoutSummaryEl) return;
  const products = getCartProducts();
  const subtotal = getCartTotal();
  const total = subtotal + DELIVERY_FEE;

  checkoutSummaryEl.innerHTML = products.map(product => {
    const variantLabel = [product.selectedColor, product.selectedSize].filter(Boolean).join(' - ');
    const displayName = variantLabel ? `${product.name} (${variantLabel})` : product.name;
    return `
      <div class="checkout-summary-row">
        <span class="checkout-summary-item-name">${displayName} × ${product.quantity}</span>
        <span>${(product.price * product.quantity).toLocaleString()} جنيه</span>
      </div>
    `;
  }).join('') + `
    <div class="checkout-summary-row">
      <span>التوصيل</span>
      <span>${DELIVERY_FEE ? DELIVERY_FEE.toLocaleString() + ' جنيه' : 'مجاني'}</span>
    </div>
    <div class="checkout-summary-row total">
      <span>الإجمالي</span>
      <span>${total.toLocaleString()} جنيه</span>
    </div>
  `;
}

function openCheckout() {
  if (!cart.length || !checkoutOverlay) return;
  checkoutForm.hidden = false;
  checkoutSuccessEl.hidden = true;
  clearCheckoutError();
  checkoutForm.reset();
  renderCheckoutSummary();
  checkoutOverlay.classList.add('open');
  prefillCheckoutFromProfile();
}

// لو الزائر مسجّل دخولاه —املّى الاسم والموبايل والعنوان من حسابه
async function prefillCheckoutFromProfile() {
  const client = window.supabaseClient;
  if (!client) return;
  try {
    const { data: sess } = await client.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) return;

    const { data: prof } = await client
      .from('profiles')
      .select('display_name,phone,governorate,area,street,building,floor')
      .eq('id', uid)
      .maybeSingle();
    const minimal = prof ? null : await client
      .from('profiles')
      .select('display_name,phone')
      .eq('id', uid)
      .maybeSingle();
    const saved = prof || minimal?.data;
    if (!saved) return;

    // ممكن المستخدم يقفل اللوحة ويغيّر العربة — نتأكد إن الفورم لسه مفتوح وفاضي
    if (!checkoutOverlay.classList.contains('open')) return;

    const nameEl    = document.getElementById('co-name');
    const phoneEl   = document.getElementById('co-phone');
    const addrEl    = document.getElementById('co-address');
    const areaEl    = document.getElementById('co-area');

    if (nameEl && !nameEl.value && saved.display_name) nameEl.value = saved.display_name;
    if (phoneEl && !phoneEl.value && saved.phone) phoneEl.value = saved.phone;
    if (areaEl && !areaEl.value && saved.area) areaEl.value = saved.area;

    if (addrEl && !addrEl.value) {
      const withPrefix = (value, prefix) => {
        const v = String(value || '').trim();
        if (!v) return '';
        return /^[\d\u0660-\u0669]/.test(v) ? prefix + ' ' + v : v;
      };
      const streetParts = [
        withPrefix(saved.street, 'شارع'),
        withPrefix(saved.building, 'رقم'),
        withPrefix(saved.floor, 'الدور')
      ].filter(Boolean).join('، ');
      const fullAddr = [saved.governorate, streetParts].filter(Boolean).join(' - ');
      if (fullAddr) addrEl.value = fullAddr;
    }
  } catch (error) {
    console.warn('[Checkout] prefill from profile:', error);
  }
}

function closeCheckout() {
  if (!checkoutOverlay) return;
  checkoutOverlay.classList.remove('open');
}

async function submitCheckout(event) {
  event.preventDefault();

  if (typeof window === 'undefined' || !window.supabaseClient) {
    showCheckoutError('تعذر الاتصال بالخادم، حاول تاني بعد قليل');
    return;
  }

  const name    = document.getElementById('co-name').value.trim();
  const phone   = document.getElementById('co-phone').value.trim();
  const address = document.getElementById('co-address').value.trim();
  const area    = document.getElementById('co-area').value.trim();
  const notes   = document.getElementById('co-notes').value.trim();
  const paymentMethod = document.querySelector('input[name="co-payment"]:checked')?.value || 'cash';

  if (!name || !phone || !address) {
    showCheckoutError('من فضلك املأ الاسم ورقم الموبايل والعنوان');
    return;
  }
  if (!/^01[0-9]{9}$/.test(phone)) {
    showCheckoutError('رقم الموبايل غير صحيح (لازم يبدأ بـ01 ويكون 11 رقم)');
    return;
  }

  const products = getCartProducts();
  if (!products.length) {
    showCheckoutError('عربتك فاضية');
    return;
  }

  const subtotal = getCartTotal();
  const total    = subtotal + DELIVERY_FEE;
  const orderId  = generateOrderId();
  let orderCreated = false;

  checkoutSubmitBtn.disabled = true;
  checkoutSubmitBtn.textContent = 'جارِ إرسال الطلب...';
  clearCheckoutError();

  try {
    let customerUserId = null;
    try {
      const { data: sess } = await window.supabaseClient.auth.getSession();
      customerUserId = sess?.session?.user?.id || null;
    } catch (_) {}

    const orderPayload = {
      id: orderId,
      customer_name: name,
      customer_phone: phone,
      customer_address: address,
      customer_area: area || null,
      customer_notes: notes || null,
      items_subtotal: subtotal,
      delivery_fee: DELIVERY_FEE,
      total: total,
      payment_method: paymentMethod,
      status: 'pending'
    };
    if (customerUserId) orderPayload.customer_user_id = customerUserId;

    let { error: orderError } = await window.supabaseClient.from('orders').insert([orderPayload]);

    // عمود customer_user_id لسه مش موجود في القاعدة — نكمل بدونه بدل ما الطلب يفشل
    const missingColumn = orderError && (orderError.code === '42703' || orderError.code === 'PGRST204');
    if (missingColumn && customerUserId) {
      console.warn('[Checkout] orders.customer_user_id غير متوفر:', orderError.message);
      delete orderPayload.customer_user_id;
      ({ error: orderError } = await window.supabaseClient.from('orders').insert([orderPayload]));
    }
    if (orderError) throw orderError;

    orderCreated = true;

    const orderItemsPayload = products.map(product => {
      const variantLabel = [product.selectedColor, product.selectedSize].filter(Boolean).join(' - ');
      const finalName = variantLabel ? `${product.name} [${variantLabel}]` : product.name;

      return {
        order_id: orderId,
        product_id: product.id,
        product_name: finalName,
        product_image: (product.imageUrl && !String(product.imageUrl).startsWith('blob:')) ? product.imageUrl : null,
        unit_price: product.price,
        quantity: product.quantity,
        line_total: product.price * product.quantity
      };
    });

    const { error: itemsError } = await window.supabaseClient.from('order_items').insert(orderItemsPayload);
    if (itemsError) {
      console.error('[Checkout] order_items:', itemsError);
      // منتج في العربة اتحذف من المتجر — نشيل الطلب اليتيم ونقول السبب الصحيح
      try { await window.supabaseClient.from('orders').delete().eq('id', orderId); } catch (_) {}
      orderCreated = false;
      if (itemsError.code === '23503') {
        throw userFacingError('في منتج في عربتك اتمسح من المتجر — حدّث الصفحة وزيده تاني.');
      }
      throw userFacingError('تعذر إرسال تفاصيل الطلب. جرّب تاني بعد قليل.');
    }

    // نجاح — نفضّي العربة ونعرض شاشة التأكيد
    cart = [];
    saveCart();
    updateCartUI();

    checkoutForm.hidden = true;
    checkoutSuccessEl.hidden = false;
    checkoutOrderRefEl.textContent = `رقم مرجعي: ${orderId.slice(-8).toUpperCase()}`;
  } catch (error) {
    console.error('[Checkout] فشل إرسال الطلب:', error);
    if (orderCreated) {
      try { await window.supabaseClient.from('orders').delete().eq('id', orderId); } catch (_) {}
    }
    showCheckoutError(error && error.userMessage ? error.userMessage : checkoutFriendlyMessage(error));
  } finally {
    checkoutSubmitBtn.disabled = false;
    checkoutSubmitBtn.textContent = 'تأكيد الطلب ←';
  }
}

checkoutCloseBtn?.addEventListener('click', closeCheckout);
checkoutOverlay?.addEventListener('click', (event) => {
  if (event.target === checkoutOverlay) closeCheckout();
});
checkoutForm?.addEventListener('submit', submitCheckout);
checkoutDoneBtn?.addEventListener('click', () => {
  closeCheckout();
  closeCart();
});

function checkoutCart() {
  if (!cart.length) return;
  openCheckout();
}

document.addEventListener('DOMContentLoaded', updateCartUI);