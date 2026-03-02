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

  // ─── Image gallery ───────────────────────────────────────────
  window.setMainImage = function (src) {
    const mainImg = document.querySelector('.brand-hero__main-img');
    if (mainImg) {
      // Must update <source srcset> too — browsers prefer it over img.src inside <picture>
      const source = mainImg.closest('picture') && mainImg.closest('picture').querySelector('source');
      mainImg.style.opacity = '0';
      setTimeout(() => {
        if (source) source.srcset = src;
        mainImg.src = src;
        mainImg.style.opacity = '1';
      }, 150);
    }
  };

  // ─── Initialize ───────────────────────────────────────────────
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
