// ================================================================
// DODDZ HOME SUBCATEGORIES — تقسيم صف «المنزل» لمجموعات فرعية
// ----------------------------------------------------------------
// ملف «عرض» بس: بياخد كروت المنتجات اللي js/products-data.js رسمها
// فعلاً في #section-home وينقلها جوّه 4 مجموعات حسب حقل subcategory:
//   مستلزمات مطبخ · مستلزمات حمام · ديكور · ادوات صيانة
// مفيش أي إعادة رسم للمنتجات، ولا لمس للسلة/المفضلة/الحساب/Supabase —
// نفس عناصر الـDOM بنفس الـonclick، اتنقلت لمكان تاني وخلاص.
//
// لو subcategory فاضي أو باسم قديم، بنوحّده بنفس قواعد supabase/11
// عشان التقسيم يبان صح قبل وبعد تشغيل ملف الـSQL.
// ================================================================
(function () {
  const HOME_SECTION = 'home';
  const OTHER_LABEL  = 'متنوع';

  // ترتيب المجموعات + أيقوناتها (إيموجي خفيف — نفس روح الأيقونات في الصفحة)
  const GROUPS = [
    { name: 'مستلزمات مطبخ', icon: '🍳' },
    { name: 'مستلزمات حمام', icon: '🛁' },
    { name: 'ديكور',          icon: '🖼️' },
    { name: 'ادوات صيانة',    icon: '🔧' }
  ];

  // أسماء قديمة/مختلفة → المجموعة الصح (نفس توحيد ملف SQL رقم 11)
  const ALIASES = {
    'ادوات مطبخ':              'مستلزمات مطبخ',
    'أدوات مطبخ':              'مستلزمات مطبخ',
    'ادوات مائدة':             'مستلزمات مطبخ',
    'مستلزمات حمامات و مطابخ': 'مستلزمات مطبخ',
    'مستلزمات حمامات':         'مستلزمات حمام',
    'مستلزمات الحمام':         'مستلزمات حمام',
    'ادوات حمام':              'مستلزمات حمام',
    'ديكورات':                 'ديكور',
    'ديكور منزلي':             'ديكور',
    'مفروشات':                 'ديكور',
    'صيانة منزلية':            'ادوات صيانة',
    'ادوات صيانة سيارات':      'ادوات صيانة',
    'عدد وصيانة':              'ادوات صيانة',
    'أدوات صيانة':             'ادوات صيانة'
  };

  // ── تطبيع النص عشان المقارنة ما تكسرش مع الهمزات والتشكيل ──
  function norm(s) {
    return String(s || '')
      .replace(/[\u064B-\u0652\u0640]/g, '')      // تشكيل وتطويل
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  const GROUP_INDEX = {};
  GROUPS.forEach(g => { GROUP_INDEX[norm(g.name)] = g.name; });
  Object.keys(ALIASES).forEach(k => { GROUP_INDEX[norm(k)] = ALIASES[k]; });

  /** subcategory خام → اسم المجموعة، أو null لو مش من الأربعة */
  //    «المنزل»/«home» مكتوبين كـ subcategory على منتجات قديمة — دول
  //    تصنيفهم الفرعي مش موجود فعليًا، بينزلوا تحت «متنوع».
  const UNTAGGED = { 'المنزل': 1, 'home': 1, 'منتجات المنزل': 1, 'منزل': 1 };
  function groupOf(sub) {
    const n = norm(sub);
    if (!n || UNTAGGED[n]) return null;
    return GROUP_INDEX[n] || null;
  }

  // ── id المنتج → subcategory من نفس المصدر اللي بيُرسم منه الكارت ──
  //    بنقرأ subcategory بس (مش category) — عشان اسم القسم ما يبقاش مجموعة.
  function subMap() {
    const map = new Map();
    try {
      const list = (typeof ProductStore !== 'undefined' && ProductStore.getAll)
        ? ProductStore.getAll()
        : (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []);
      (list || []).forEach(p => {
        if (p && p.id != null) map.set(String(p.id), p.subcategory || '');
      });
    } catch (_) { /* خريطة فاضية تكفي — الهيل بينزل تحت «متنوع» */ }
    return map;
  }

  function cardNode(id) {
    const el = document.createElement('div');
    el.className = 'home-sub-head';
    el.innerHTML =
      `<span class="home-sub-icon" aria-hidden="true">${id.icon || '🧺'}</span>` +
      `<h3 class="home-sub-title"></h3>` +
      `<span class="home-sub-count"></span>`;
    el.querySelector('.home-sub-title').textContent = id.name;
    return el;
  }

  let applying = false;

  function run() {
    const container = document.getElementById('section-' + HOME_SECTION);
    if (!container) return;

    // الكروت الحالية (سواء لسه متقسمة أو لا) — بنلمسها مش بنعيد بناءها
    const cards = Array.prototype.slice.call(container.querySelectorAll('.pcard'));
    if (!cards.length) {
      // مفيش منتجات منزل معتمدة — نظّف أي مجموعات قديمة وسيّب الصف يختفي عادي
      if (container.classList.contains('is-grouped')) {
        container.classList.remove('is-grouped');
        container.innerHTML = '';
      }
      return;
    }

    applying = true;
    const bySub = new Map();   // اسم المجموعة → [cards]
    const subs  = subMap();

    cards.forEach(card => {
      const raw   = subs.get(String(card.dataset.id || '')) || '';
      const named = groupOf(raw);
      // أي subcategory تاني مسجّل على المنتج يحافظ على اسمه — ما بنرميهوش في «متنوع»
      const key   = named || (norm(raw) ? String(raw).trim() : OTHER_LABEL);
      if (!bySub.has(key)) bySub.set(key, []);
      bySub.get(key).push(card);
    });

    // الترتيب: الأربعة المحددين أولًا، ثم أي مجموعة تانية، و«متنوع» آخر حاجة
    const ordered = GROUPS
      .filter(g => bySub.has(g.name))
      .map(g => ({ name: g.name, icon: g.icon, list: bySub.get(g.name) }));
    bySub.forEach((list, name) => {
      if (name === OTHER_LABEL || GROUPS.some(g => g.name === name)) return;
      ordered.push({ name: name, icon: '🧺', list: list });
    });
    if (bySub.has(OTHER_LABEL)) ordered.push({ name: OTHER_LABEL, icon: '🧺', list: bySub.get(OTHER_LABEL) });

    container.innerHTML = '';
    container.classList.add('is-grouped');

    ordered.forEach(g => {
      const wrap  = document.createElement('div');
      wrap.className = 'home-sub';
      wrap.setAttribute('data-home-sub', g.name);

      const head  = cardNode({ name: g.name, icon: g.icon });
      const count = head.querySelector('.home-sub-count');
      const n     = g.list.length;
      const isEn  = (typeof localStorage !== 'undefined' &&
                     localStorage.getItem('doddz_lang') === 'en');
      // العدّاد بيتكتب بلغة الصفحة نفسها — data-no-i18n بيمنع الترجمة النصية الجزئية
      count.setAttribute('data-no-i18n', '1');
      count.textContent = isEn
        ? n + (n === 1 ? ' item' : ' items')
        : n + ' ' + (n === 1 ? 'منتج' : 'منتجات');
      count.setAttribute('title', count.textContent);

      const track = document.createElement('div');
      track.className = 'home-sub-track';
      g.list.forEach(card => track.appendChild(card));   // نقل نفس العقدة

      wrap.appendChild(head);
      wrap.appendChild(track);
      container.appendChild(wrap);
    });

    applying = false;

    // «المنزل» بقى طولي بعد التقسيم — نفحص صفوف الفراغ تاني زي ما products-data بيعمل
    try { if (typeof updateEmptyRows === 'function') updateEmptyRows(); } catch (_) {}
  }

  // ── إعادة التقسيم لو اتعمل redraw للقسم (منتج جديد من لوحة الأدمن مثلاً) ──
  let queued = null;
  function schedule() {
    if (queued) return;
    queued = setTimeout(() => { queued = null; run(); }, 120);
  }

  function watch() {
    const container = document.getElementById('section-' + HOME_SECTION);
    if (!container || typeof MutationObserver === 'undefined') return;
    new MutationObserver(() => {
      if (applying) return;          // تغييرنا إحنا — ما ندورش في حلقة
      schedule();
    }).observe(container, { childList: true });
  }

  function boot() {
    run();
    watch();
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('doddz:sections-rendered', schedule);
  window.DoddzHomeSubs = { rerun: run };
})();
