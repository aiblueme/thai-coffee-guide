/* ═══════════════════════════════════════════════════════════════
   Thai Coffee Guide — Main JS
   Mobile nav toggle, lazy image loading, general utilities
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Mobile navigation ───────────────────────────────────────
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close nav when a link is clicked
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !nav.contains(e.target)) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ─── Smooth scroll for anchor links ──────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const headerHeight = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--header-height') || '64');
      const y = target.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  // ─── Feature 4: Skeleton — fade images in on load ────────────
  document.querySelectorAll(
    '.brand-card__img, .brand-card__compact-img, .brand-row__img, .table-brand-img'
  ).forEach(img => {
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('img-loaded');
    } else {
      img.addEventListener('load',  () => img.classList.add('img-loaded'));
      img.addEventListener('error', () => img.classList.add('img-loaded'));
    }
  });

  // ─── Feature 5: Bookmark manager ─────────────────────────────
  const Bookmarks = {
    KEY: 'tcg-bookmarks',
    load() {
      try { return new Set(JSON.parse(localStorage.getItem(this.KEY) || '[]')); }
      catch { return new Set(); }
    },
    save(set) { localStorage.setItem(this.KEY, JSON.stringify([...set])); },
    toggle(slug) {
      const s = this.load();
      s.has(slug) ? s.delete(slug) : s.add(slug);
      this.save(s);
      return s.has(slug);
    },
    has(slug) { return this.load().has(slug); },
    count()   { return this.load().size; }
  };

  function syncBookmarkBtn(btn, saved) {
    btn.classList.toggle('is-saved', saved);
    btn.setAttribute('aria-label', saved
      ? `Remove ${btn.dataset.name || ''} from saved`
      : `Save ${btn.dataset.name || ''}`
    );
    btn.title = saved ? 'Remove from saved' : 'Save to list';
  }

  function refreshBookmarkUI() {
    const count = Bookmarks.count();
    // Sync all bookmark buttons on page
    document.querySelectorAll('.bookmark-btn[data-slug]').forEach(btn => {
      syncBookmarkBtn(btn, Bookmarks.has(btn.dataset.slug));
    });
    // Sync count badges
    document.querySelectorAll('.bookmark-count-badge').forEach(el => {
      el.textContent = count;
      el.hidden = count === 0;
    });
    // Show/hide bookmark toggle buttons
    document.querySelectorAll('.bookmark-toggle-btn').forEach(btn => {
      btn.hidden = count === 0;
    });
  }

  document.querySelectorAll('.bookmark-btn[data-slug]').forEach(btn => {
    syncBookmarkBtn(btn, Bookmarks.has(btn.dataset.slug));
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const saved = Bookmarks.toggle(btn.dataset.slug);
      refreshBookmarkUI();
      // Re-apply bookmark filter if active
      const filterBtn = document.getElementById('bookmark-filter-btn');
      if (filterBtn && filterBtn.classList.contains('is-active')) {
        applyBookmarkFilter();
      }
    });
  });
  refreshBookmarkUI();

  // Bookmark filter (index quick-list + compare)
  window.applyBookmarkFilter = function() {
    const saved = Bookmarks.load();
    document.querySelectorAll('[data-slug]').forEach(row => {
      if (row.classList.contains('quick-list__row')) {
        row.classList.toggle('is-hidden', !saved.has(row.dataset.slug));
      }
    });
  };

  const bookmarkFilterBtn = document.getElementById('bookmark-filter-btn');
  if (bookmarkFilterBtn) {
    if (Bookmarks.count() === 0) bookmarkFilterBtn.hidden = true;
    bookmarkFilterBtn.addEventListener('click', () => {
      const active = bookmarkFilterBtn.classList.toggle('is-active');
      bookmarkFilterBtn.setAttribute('aria-pressed', active);
      if (active) {
        applyBookmarkFilter();
      } else {
        document.querySelectorAll('[data-slug].quick-list__row').forEach(r => r.classList.remove('is-hidden'));
      }
    });
  }

  // ─── Feature 5: Copy button ───────────────────────────────────
  document.querySelectorAll('.copy-btn[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.copy).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('is-copied');
        setTimeout(() => {
          btn.textContent = orig;
          btn.classList.remove('is-copied');
        }, 1800);
      });
    });
  });

  // ─── Feature 1: Index view toggle ────────────────────────────
  const viewToggleBtns  = document.querySelectorAll('.view-toggle__btn');
  const editorialSects  = document.getElementById('editorial-sections');
  const quickListSect   = document.getElementById('quick-list-section');

  if (viewToggleBtns.length && editorialSects && quickListSect) {
    const PREF_KEY = 'tcg-view';
    const savedView = localStorage.getItem(PREF_KEY) || 'editorial';

    function setView(view) {
      viewToggleBtns.forEach(b => {
        const active = b.dataset.view === view;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', active);
      });
      editorialSects.hidden = view !== 'editorial';
      quickListSect.hidden  = view !== 'list';
      localStorage.setItem(PREF_KEY, view);
    }

    viewToggleBtns.forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    setView(savedView);
  }

  // ─── Table of contents active state (guide page) ─────────────
  const tocLinks = document.querySelectorAll('.toc-list a');
  if (tocLinks.length > 0) {
    const sections = Array.from(tocLinks).map(link => {
      const id = link.getAttribute('href').slice(1);
      return document.getElementById(id);
    }).filter(Boolean);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          tocLinks.forEach(link => {
            const active = link.getAttribute('href') === `#${id}`;
            link.style.color = active ? 'var(--terracotta)' : '';
            link.style.borderColor = active ? 'var(--terracotta)' : '';
          });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });

    sections.forEach(section => observer.observe(section));
  }

})();
