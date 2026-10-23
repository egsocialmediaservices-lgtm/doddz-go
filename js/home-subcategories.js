// ================================================================
// DODDZ HOME SUBCATEGORIES — تقسيم صف «المنزل» لمجموعات فرعية
// ----------------------------------------------------------------
// ملف «عرض» بس: بياخد كروت المنتجات اللي js/products-data.js رسمها
// فعلاً في #section-home وينقلها جوّه مجموعات حسب حقل subcategory:
//   مستلزمات مطبخ · مستلزمات حمام · ديكور · ادوات صيانة
// مفيش أي إعادة رسم للمنتجات، ولا لمس للسلة/المفضلة/الحساب/Supabase —
// نفس عناصر الـDOM بنفس الـonclick، اتنقلت لمكان تاني وخلاص.
//
// لو subcategory فاضي أو باسم قديم، بنوحّده بنفس قواعد supabase/11
// عشان التقسيم يبان صح قبل وبعد تشغيل ملف الـSQL.
//
// ⚠️ قاعدة أمان مهمة: run() بيشتغل بس لما يكون الصف «ني» (أولاده المباشرة
//    كروت products). بعد التقسيم الأولاد بي بقوا .home-sub → أي تشغيل تاني
//    بيرجع فورًا من غير ما يلمس حاجة. ده اللي بيمنع حلقة إعادة التقسيم
//    اللي كانت بتخلي الكروت ترتجف والشريط ما يمشيش.
// ================================================================
(function () {
  const HOME_SECTION = 'home';
  const OTHER_LABEL  = 'متنوع';

  // ترتيب المجموعات + أيقوناتها
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

  // «المنزل» مكتوبة كـsubcategory على منتجات قديمة — دي فعليًا بلا تصنيف
  const UNTAGGED = { 'المنزل': 1, 'منزل': 1, 'منتجات المنزل': 1, 'home': 1 };

  // ── تطبيع النص عشان المقارنة ما تكسرش مع الهمزات والتشكيل ──
  function norm(s) {
    return String(s || '')
      .replace(/[ً-ْـ]/g, '')            // تشكيل وتطويل
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

  function groupOf(sub) {
    const n = norm(sub);
    if (!n || UNTAGGED[n]) return null;
    return GROUP_INDEX[n] || null;
  }

  // ── id المنتج → subcategory (بنقرأ subcategory بس، مش category) ──
  function subMap() {
    const map = new Map();
    try {
      const list = (typeof ProductStore !== 'undefined' && ProductStore.getAll)
        ? ProductStore.getAll()
        : (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []);
      (list || []).forEach(p => {
        if (p && p.id != null) map.set(String(p.id), p.subcategory || '');
      });
    } catch (_) { /* خريطة فاضية تكفي — الكل ينزل تحت «متنوع» */ }
    return map;
  }

  function buildHead(g) {
    const head = document.createElement('div');
    head.className = 'home-sub-head';
    head.innerHTML =
      '<span class="home-sub-icon" aria-hidden="true"></span>' +
      '<h3 class="home-sub-title"></h3>' +
      '<span class="home-sub-count"></span>';
    head.querySelector('.home-sub-icon').textContent = g.icon || '🧺';
    head.querySelector('.home-sub-title').textContent = g.name;

    const n     = g.list.length;
    const isEn  = (typeof localStorage !== 'undefined' &&
                   localStorage.getItem('doddz_lang') === 'en');
    const count = head.querySelector('.home-sub-count');
    count.setAttribute('data-no-i18n', '1');
    count.textContent = isEn
      ? n + (n === 1 ? ' item' : ' items')
      : n + ' ' + (n === 1 ? 'منتج' : 'منتجات');
    count.title = count.textContent;
    return head;
  }

  function run() {
    const container = document.getElementById('section-' + HOME_SECTION);
    if (!container) return false;

    // الصف «ني»؟ أولاده المباشرة كروت products. لو متقسّم بالفعل → مفيش شغل.
    const fresh = Array.prototype.slice.call(container.children)
      .filter(el => el.classList.contains('pcard'));
    if (!fresh.length) {
      // مفيش منتجات خالص: لو المجموعات القديمة لسه موجودة ننظّفها،
      // و updateEmptyRows() بيتكفل إن الصف يختفي زي أي قسم فاضي
      if (container.classList.contains('is-grouped') && !container.querySelector('.pcard')) {
        container.classList.remove('is-grouped');
        container.innerHTML = '';
      }
      return false;
    }

    const bySub = new Map();
    const subs  = subMap();

    fresh.forEach(card => {
      const raw = subs.get(String(card.dataset.id || '')) || '';
      // الأربعة اللي طلبتهم بس: أي subcategory تاني (مدرسية/مخيم/سيارة...)
      // بينزل تحت «متنوع» عشان الصفحة ما تتقسمش لشرائط صغيرة كتير
      const key = groupOf(raw) || OTHER_LABEL;
      if (!bySub.has(key)) bySub.set(key, []);
      bySub.get(key).push(card);
    });

    // الترتيب: الأربعة المحددين أولًا، و«متنوع» آخر حاجة
    const ordered = GROUPS.filter(g => bySub.has(g.name))
      .map(g => ({ name: g.name, icon: g.icon, list: bySub.get(g.name) }));
    if (bySub.has(OTHER_LABEL)) ordered.push({ name: OTHER_LABEL, icon: '🧺', list: bySub.get(OTHER_LABEL) });

    container.innerHTML = '';
    container.classList.add('is-grouped');

    ordered.forEach(g => {
      const wrap = document.createElement('div');
      wrap.className = 'home-sub';
      wrap.setAttribute('data-home-sub', g.name);
      const track = document.createElement('div');
      track.className = 'home-sub-track';
      g.list.forEach(card => track.appendChild(card));   // نقل نفس العقدة
      wrap.appendChild(buildHead(g));
      wrap.appendChild(track);
      container.appendChild(wrap);
      wireTrack(track);
      addNav(wrap, track);
    });

    try { if (typeof updateEmptyRows === 'function') updateEmptyRows(); } catch (_) {}
    return true;
  }

  // ── موضع الشريط بالنسبة لبدايته (0 = البداية، max = الآخر) ──
  //    كروم بيستخدم قيم سالبة لـscrollLeft في RTL، وفايرفوكس مقلوبة — بنطمن الاتنين.
  function posOf(track) {
    const max = track.scrollWidth - track.clientWidth;
    const raw = track.scrollLeft;
    if (getComputedStyle(track).direction !== 'rtl') return Math.max(0, Math.min(max, raw));
    if (raw <= 0) return Math.min(max, -raw);            // موديل كروم
    return Math.max(0, Math.min(max, max - raw));        // موديل فايرفوكس
  }
  function setPos(track, p, smooth) {
    const max = track.scrollWidth - track.clientWidth;
    const v   = Math.max(0, Math.min(max, p));
    const target = getComputedStyle(track).direction === 'rtl' ? -v : v;
    if (smooth) {
      // Smooth أصلي من المتصفح: بيشتغل حتى لو الطلبات مت بطيئة، وبيحفظ
      // موضع الكروت من غير أي transform
      track.style.scrollBehavior = 'smooth';
      track.scrollLeft = target;
      clearTimeout(track._sbTimer);
      track._sbTimer = setTimeout(() => {
        // شبكة أمان: الحركة السلسة بتتوقف تمامًا لو التبويب مخفي أو الجهاز
        // بيقلة إطارات — بنلمّ الموضع فوري بنفس الهدف بدل ما الشريط «يقف»
        const still = posOf(track);
        if (Math.abs(still - v) > 12) {
          track.style.scrollBehavior = 'auto';
          track.scrollLeft = target;
        }
        track.style.scrollBehavior = '';
        syncNav(track);
      }, 360);
      return;
    }
    track.style.scrollBehavior = 'auto';    // العجلة والسحب لازم يكونوا فوريين
    track.scrollLeft = target;
    track.style.scrollBehavior = '';
  }

  // ── أزرار يمين/شمال لكل مجموعة ──────────────────────────────
  function stepTrack(track, dir) {
    const card = track.querySelector('.pcard');
    const w    = card ? card.getBoundingClientRect().width : 210;
    const gap  = 14;
    const page = Math.max(w + gap, track.clientWidth * .8, 120);
    setPos(track, posOf(track) + dir * page, true);
  }

  function syncNav(track) {
    const nav = track.parentNode && track.parentNode.querySelector('.home-sub-nav');
    if (!nav) return;
    // scrollWidth بيزيد شوية عن أقصى scrollLeft حقيقي (الـpadding/الظلال)،
    // فبنحسب المسافة المتبقية بحافزة small عشان الزرار يقفل وهو في مكانه
    const max  = track.scrollWidth - track.clientWidth;
    const pos  = posOf(track);
    const left = max - pos;
    nav.style.visibility = max <= 24 ? 'hidden' : 'visible';
    const prev = nav.querySelector('.is-prev');
    const next = nav.querySelector('.is-next');
    if (prev) prev.classList.toggle('is-off', pos <= 2);
    if (next) next.classList.toggle('is-off', left <= 24);
  }

  function addNav(wrap, track) {
    const head = wrap.querySelector('.home-sub-head');
    if (!head) return;
    const isEn = (typeof localStorage !== 'undefined' &&
                  localStorage.getItem('doddz_lang') === 'en');
    const nav = document.createElement('div');
    nav.className = 'home-sub-nav';
    const cfgs = [
      ['-1', 'is-prev', isEn ? 'Previous' : 'السابق'],
      ['1',  'is-next', isEn ? 'Next'     : 'التالي']
    ];
    cfgs.forEach(cfg => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'home-sub-btn ' + cfg[1];
      b.dataset.dir = cfg[0];
      b.setAttribute('aria-label', cfg[2]);
      b.title = cfg[2];
      b.addEventListener('click', () => stepTrack(track, Number(cfg[0])));
      nav.appendChild(b);
    });
    head.appendChild(nav);
    // تحديث حالة الأزرار أثناء التمرير (بتايمين مش rAF عشان تبقى مضمونة)
    track.addEventListener('scroll', () => {
      if (track._navTimer) return;
      track._navTimer = setTimeout(() => { track._navTimer = null; syncNav(track); }, 90);
    }, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      try { new ResizeObserver(() => syncNav(track)).observe(track); } catch (_) {}
    }
    syncNav(track);
  }

  // ── تمرير مريح للشريط: عجلة الماوس + سحب بالماوس (من غير ما نكسر النقر) ──
  function wireTrack(track) {
    if (track.dataset.wired === '1') return;
    track.dataset.wired = '1';

    // عجلة الماوس الأفقية سيّبيها للمتصفح — إحنا بنحوّل الراسية بس
    track.addEventListener('wheel', (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 0) return;
      const next = posOf(track) + e.deltaY;
      if (next < 0 || next > max) return;   // عند الحافة → سيّب الصفحة تتنزل
      e.preventDefault();
      setPos(track, next);
    }, { passive: false });

    // سحب بالماوس: الكروت بتتمشى مع الإيد، ولو السحب كان كبير بنمنع النقر بعدها
    let drag = null;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (e.target.closest('button, a')) return;
      drag = { x: e.clientX, pos: posOf(track), moved: 0 };
    });
    track.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) < 4) return;
      drag.moved = Math.abs(dx);
      track.classList.add('is-dragging');
      setPos(track, drag.pos - dx);          // السحب فيزيائي — نفسه في RTL وLTR
    });
    const end = () => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      track.classList.remove('is-dragging');
      if (moved > 8) track.dataset.suppressClick = String(Date.now());
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('pointerleave', end);
    track.addEventListener('click', (e) => {
      const t = Number(track.dataset.suppressClick || 0);
      if (t && Date.now() - t < 350) {        // دي آخر سحب مش نقرة
        e.preventDefault();
        e.stopPropagation();
        track.dataset.suppressClick = '0';
      }
    }, true);
  }

  // ── إعادة التقسيم بعد أي إعادة رسم (منتج جديد من الأدمن، أو تحميل Supabase) ──
  let queued = null;
  function schedule() {
    if (queued) return;
    queued = setTimeout(() => { queued = null; run(); }, 150);
  }

  function watch() {
    const container = document.getElementById('section-' + HOME_SECTION);
    if (!container || typeof MutationObserver === 'undefined') return;
    new MutationObserver(schedule).observe(container, { childList: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    run();
    watch();
  });
  window.addEventListener('doddz:sections-rendered', schedule);
  window.DoddzHomeSubs = { rerun: run };
})();
