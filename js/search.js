// ================================================================
// DODDZ SITE SEARCH — بحث حي + فلترة حسب القسم عبر ProductStore
// ================================================================
(function () {
  const input        = document.getElementById('site-search-input');
  const catSel        = document.getElementById('site-search-cat');
  const btn           = document.getElementById('site-search-btn');
  const resultsRow    = document.getElementById('search-results-row');
  const resultsGrid   = document.getElementById('search-results-grid');
  const resultsTitle  = document.getElementById('search-results-title');
  const clearBtn      = document.getElementById('search-clear-btn');

  if (!input || !resultsRow) return;

  let debounceTimer = null;

  function getProducts() {
    const all = (typeof ProductStore !== 'undefined') ? ProductStore.getAll() : PRODUCTS;
    return all.filter(p => (p.status || 'approved') === 'approved');
  }

  // نخبي كل أقسام المتجر العادية والبانرات الكبيرة وقت ما نتائج البحث ظاهرة
  function toggleStorefrontSections(hide) {
    document.querySelectorAll('.content > .section-row, .content > .big-banners').forEach(el => {
      if (el.id === 'search-results-row') return;
      el.style.display = hide ? 'none' : '';
    });
  }

  function renderResults(products, label) {
    resultsTitle.textContent = label;
    resultsGrid.innerHTML = products.length
      ? products.map(p => p.source === 'merchant' ? renderMerchantCard(p) : renderCard(p)).join('')
      : `<div class="search-results-empty">مفيش نتائج مطابقة، جرّب كلمة تانية 🔍</div>`;

    resultsRow.style.display = '';
    toggleStorefrontSections(true);
    resultsRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // متاحة عالمياً عشان site.js يقفلها لما المستخدم يدوس على أي قسم من النافبار
  window.clearSearchResults = function clearSearchResults() {
    if (resultsRow.style.display === 'none') return;
    resultsRow.style.display = 'none';
    toggleStorefrontSections(false);
  };

  function runSearch() {
    const query   = input.value.trim();
    const section = catSel.value;

    if (!query && !section) {
      clearSearchResults();
      return;
    }

    let products = getProducts();
    if (query) {
      const q = query.toLowerCase();
      products = products.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    if (section) {
      products = products.filter(p => p.section === section);
    }

    const sectionLabel = section ? SECTION_LABELS_SITE[section] : '';
    const label = query && sectionLabel ? `نتائج "${query}" في ${sectionLabel}`
                : query ? `نتائج البحث عن "${query}"`
                : `كل منتجات ${sectionLabel}`;

    renderResults(products, label);
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 350);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); runSearch(); }
  });
  btn?.addEventListener('click', runSearch);
  catSel?.addEventListener('change', runSearch);
  clearBtn?.addEventListener('click', () => {
    input.value = '';
    catSel.value = '';
    clearSearchResults();
  });

  // "عرض الكل" في أي قسم → يفتح نفس واجهة النتائج لكل منتجات القسم ده
  document.querySelectorAll('.row-see-all[data-section]').forEach(el => {
    el.addEventListener('click', () => {
      input.value = '';
      catSel.value = el.dataset.section;
      runSearch();
    });
  });
})(); 