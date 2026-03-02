/* ═══════════════════════════════════════════════════════════════
   Thai Coffee Guide — Compare Page JS
   Client-side filtering, sorting, results count
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let currentSort = 'rating';
  let currentSortDir = 'desc';

  // ─── Filter & Sort ───────────────────────────────────────────
  window.applyFilters = function () {
    const category = document.getElementById('filter-category').value.toLowerCase();
    const roast = document.getElementById('filter-roast').value.toLowerCase();
    const maxPrice = parseInt(document.getElementById('filter-price').value) || Infinity;
    const sortBy = document.getElementById('sort-by').value;

    const tbody = document.getElementById('compare-tbody');
    const rows = Array.from(tbody.querySelectorAll('.brand-row-tr'));

    // Filter
    let visible = rows.filter(row => {
      const rowCategory = row.dataset.category.toLowerCase();
      const rowRoast = row.dataset.roast.toLowerCase();
      const rowPrice = parseInt(row.dataset.price);

      const categoryMatch = !category || rowCategory.includes(category);
      const roastMatch = !roast || rowRoast.includes(roast);
      const priceMatch = rowPrice <= maxPrice;

      return categoryMatch && roastMatch && priceMatch;
    });

    let hidden = rows.filter(row => !visible.includes(row));

    // Sort visible rows
    const sortFn = getSortFn(sortBy);
    visible.sort(sortFn);

    // Re-render
    hidden.forEach(row => {
      row.classList.add('hidden');
      tbody.appendChild(row);
    });
    visible.forEach(row => {
      row.classList.remove('hidden');
      tbody.appendChild(row);
    });

    // Update count
    const countEl = document.getElementById('results-count');
    if (countEl) countEl.textContent = visible.length;

    // Update sort button indicators
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.classList.remove('sort-btn--active');
      btn.querySelector('.sort-indicator').textContent = '';
    });
  };

  function getSortFn(sortBy) {
    switch (sortBy) {
      case 'rating':
        return (a, b) => parseFloat(b.dataset.rating) - parseFloat(a.dataset.rating);
      case 'price-asc':
        return (a, b) => parseInt(a.dataset.price) - parseInt(b.dataset.price);
      case 'price-desc':
        return (a, b) => parseInt(b.dataset.price) - parseInt(a.dataset.price);
      case 'name':
        return (a, b) => a.dataset.name.localeCompare(b.dataset.name);
      default:
        return (a, b) => parseFloat(b.dataset.rating) - parseFloat(a.dataset.rating);
    }
  }

  // Column header sort buttons
  window.sortTable = function (col) {
    const select = document.getElementById('sort-by');
    if (col === 'rating') select.value = 'rating';
    else if (col === 'price') select.value = 'price-asc';
    else if (col === 'body') select.value = 'rating'; // fallback
    else if (col === 'acidity') select.value = 'rating';
    applyFilters();
  };

  window.resetFilters = function () {
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-roast').value = '';
    document.getElementById('filter-price').value = '';
    document.getElementById('sort-by').value = 'rating';
    applyFilters();
  };

  // Run on load with initial state
  applyFilters();

})();
