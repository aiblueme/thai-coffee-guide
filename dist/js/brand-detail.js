/* ═══════════════════════════════════════════════════════════════
   Thai Coffee Guide — Brand Detail JS
   Vanilla JS radar/spider chart + image gallery
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Radar Chart (pure canvas, no library) ───────────────────
  function drawRadar(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;
    const levels = 5;
    const labels = data.labels;
    const values = data.values;
    const n = labels.length;

    // Colors from CSS vars — hardcoded for canvas compatibility
    const colorBrown = '#2C1810';
    const colorCream = '#EDD9C0';
    const colorTerracotta = '#C4652A';
    const colorBrownWarm = '#8B5E3C';

    ctx.clearRect(0, 0, size, size);

    // ── Draw grid ──
    for (let level = 1; level <= levels; level++) {
      const r = (radius / levels) * level;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = colorCream;
      ctx.lineWidth = level === levels ? 1.5 : 1;
      ctx.stroke();
    }

    // ── Draw axes ──
    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
      ctx.strokeStyle = colorCream;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ── Draw data polygon ──
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
      const r = (values[i] / 5) * radius;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(196, 101, 42, 0.18)';
    ctx.fill();
    ctx.strokeStyle = colorTerracotta;
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Draw data points ──
    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
      const r = (values[i] / 5) * radius;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = colorTerracotta;
      ctx.fill();
    }

    // ── Draw labels ──
    ctx.font = `500 11px 'JetBrains Mono', monospace`;
    ctx.fillStyle = colorBrown;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
      const labelR = radius + 22;
      const x = cx + labelR * Math.cos(angle);
      const y = cy + labelR * Math.sin(angle);
      ctx.fillText(labels[i], x, y);
    }

    // ── Center label ──
    ctx.font = `italic 10px 'Playfair Display', serif`;
    ctx.fillStyle = colorBrownWarm;
    ctx.fillText(data.brandName, cx, cy + radius + 42);
  }

  // ─── Gallery ─────────────────────────────────────────────────
  class Gallery {
    constructor(el) {
      this.el = el;
      this.frames  = Array.from(el.querySelectorAll('.gallery__frame'));
      this.thumbs  = Array.from(el.querySelectorAll('.gallery__thumb'));
      this.curEl   = el.querySelector('.gallery__cur');
      this.current = 0;
      this.total   = this.frames.length;
      this.srcs    = this.frames.map(f => f.querySelector('img').src);

      this.lightbox  = document.getElementById('brand-lightbox');
      this.lbImg     = this.lightbox && this.lightbox.querySelector('.lightbox__img');
      this.lbCurEl   = this.lightbox && this.lightbox.querySelector('.lightbox__cur');
      this.lbTotEl   = this.lightbox && this.lightbox.querySelector('.lightbox__tot');
      if (this.lbTotEl) this.lbTotEl.textContent = this.total;

      this._bindEvents();
    }

    goTo(i) {
      const next = ((i % this.total) + this.total) % this.total;
      this.frames[this.current].classList.remove('is-active');
      this.thumbs[this.current] && this.thumbs[this.current].classList.remove('is-active');
      this.thumbs[this.current] && this.thumbs[this.current].setAttribute('aria-selected', 'false');

      this.current = next;

      this.frames[this.current].classList.add('is-active');
      const activeThumb = this.thumbs[this.current];
      if (activeThumb) {
        activeThumb.classList.add('is-active');
        activeThumb.setAttribute('aria-selected', 'true');
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }

      if (this.curEl) this.curEl.textContent = String(this.current + 1).padStart(2, '0');
      if (this.lbCurEl) this.lbCurEl.textContent = this.current + 1;
      if (this.lbImg && this.lightbox && !this.lightbox.hidden) {
        this.lbImg.src = this.srcs[this.current];
      }
    }

    openLightbox() {
      if (!this.lightbox) return;
      this.lbImg.src = this.srcs[this.current];
      if (this.lbCurEl) this.lbCurEl.textContent = this.current + 1;
      this.lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
      this.lightbox.focus();
    }

    closeLightbox() {
      if (!this.lightbox) return;
      this.lightbox.hidden = true;
      document.body.style.overflow = '';
    }

    _bindEvents() {
      // Arrows
      const prev = this.el.querySelector('.gallery__nav--prev');
      const next = this.el.querySelector('.gallery__nav--next');
      prev && prev.addEventListener('click', e => { e.stopPropagation(); this.goTo(this.current - 1); });
      next && next.addEventListener('click', e => { e.stopPropagation(); this.goTo(this.current + 1); });

      // Thumbnails
      this.thumbs.forEach(t => {
        t.addEventListener('click', () => this.goTo(parseInt(t.dataset.index, 10)));
      });

      // Click stage → lightbox
      const stage = this.el.querySelector('.gallery__stage');
      stage && stage.addEventListener('click', e => {
        if (!e.target.closest('.gallery__nav') && !e.target.closest('.gallery__expand')) {
          this.openLightbox();
        }
      });
      const expand = this.el.querySelector('.gallery__expand');
      expand && expand.addEventListener('click', e => { e.stopPropagation(); this.openLightbox(); });

      // Touch swipe on stage
      let tx = 0;
      stage && stage.addEventListener('touchstart', e => { tx = e.changedTouches[0].clientX; }, { passive: true });
      stage && stage.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - tx;
        if (Math.abs(dx) > 40) this.goTo(this.current + (dx < 0 ? 1 : -1));
      }, { passive: true });

      // Lightbox controls
      if (this.lightbox) {
        this.lightbox.querySelector('.lightbox__close').addEventListener('click', () => this.closeLightbox());
        this.lightbox.querySelector('.lightbox__nav--prev').addEventListener('click', () => this.goTo(this.current - 1));
        this.lightbox.querySelector('.lightbox__nav--next').addEventListener('click', () => this.goTo(this.current + 1));
        this.lightbox.addEventListener('click', e => { if (e.target === this.lightbox) this.closeLightbox(); });

        let lx = 0;
        this.lightbox.addEventListener('touchstart', e => { lx = e.changedTouches[0].clientX; }, { passive: true });
        this.lightbox.addEventListener('touchend', e => {
          const dx = e.changedTouches[0].clientX - lx;
          if (Math.abs(dx) > 40) this.goTo(this.current + (dx < 0 ? 1 : -1));
        }, { passive: true });
      }

      // Keyboard
      document.addEventListener('keydown', e => {
        const lbOpen = this.lightbox && !this.lightbox.hidden;
        if (lbOpen) {
          if (e.key === 'Escape')      { e.preventDefault(); this.closeLightbox(); }
          if (e.key === 'ArrowLeft')   { e.preventDefault(); this.goTo(this.current - 1); }
          if (e.key === 'ArrowRight')  { e.preventDefault(); this.goTo(this.current + 1); }
        } else if (this.total > 1) {
          if (e.key === 'ArrowLeft')   { e.preventDefault(); this.goTo(this.current - 1); }
          if (e.key === 'ArrowRight')  { e.preventDefault(); this.goTo(this.current + 1); }
        }
      });
    }
  }

  // ─── Initialize ───────────────────────────────────────────────
  const galleryEl = document.getElementById('brand-gallery');
  if (galleryEl) new Gallery(galleryEl);

  if (window.FLAVOR_DATA) {
    drawRadar('flavor-radar', window.FLAVOR_DATA);
  }

  // Animate flavor bars on scroll into view
  const bars = document.querySelectorAll('.flavor-bar-fill');
  if (bars.length > 0 && 'IntersectionObserver' in window) {
    const widths = Array.from(bars).map(b => b.style.width);
    bars.forEach(b => { b.style.width = '0'; b.style.transition = 'none'; });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          bars.forEach((b, i) => {
            setTimeout(() => {
              b.style.transition = 'width 0.6s ease';
              b.style.width = widths[i];
            }, i * 80);
          });
          observer.disconnect();
        }
      });
    }, { threshold: 0.3 });

    const flavorSection = document.querySelector('.flavor-section');
    if (flavorSection) observer.observe(flavorSection);
  }

})();
