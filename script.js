/* ==========================================================================
   Syed Nabil Kabir — "Lamplight & Signal"
   Vanilla JS · GSAP + ScrollTrigger + Lenis
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isMobile = () => matchMedia('(max-width: 767px)').matches;
  const conn = navigator.connection || {};
  const saveData = !!conn.saveData || /2g|3g/.test(conn.effectiveType || '');
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  let lenis = null;
  let ctaTrigger = null;

  /* ------------------------------------------------------------------------
     Utilities
     ------------------------------------------------------------------------ */
  function splitText(el) {
    if (el.dataset.splitDone) return;
    const mode = el.dataset.split;
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = label;
    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    while (el.firstChild) wrap.appendChild(el.firstChild);
    splitNode(wrap, mode);
    el.append(sr, wrap);
    el.dataset.splitDone = '1';
  }

  function splitNode(node, mode) {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const word = document.createElement('span');
          word.className = 'split-word split-mask';
          if (mode === 'chars') {
            for (const ch of part) {
              const c = document.createElement('span');
              c.className = 'split-char';
              c.textContent = ch;
              word.appendChild(c);
            }
          } else {
            const w = document.createElement('span');
            w.className = 'split-char';
            w.textContent = part;
            word.appendChild(w);
          }
          frag.appendChild(word);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) {
        splitNode(child, mode);
      }
    });
  }

  const units = (el) => $$('.split-char', el);

  function toast(msg) {
    const t = $('.toast');
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('is-visible'), 2200);
  }

  /* ------------------------------------------------------------------------
     Always-on basics (work without GSAP)
     ------------------------------------------------------------------------ */
  function initCopy() {
    $$('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = btn.dataset.copy;
        try {
          await navigator.clipboard.writeText(text);
        } catch (e) {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch (err) { /* ignore */ }
          ta.remove();
        }
        toast('Email copied');
      });
    });
  }

  // Film grain: one small noise tile rendered once, tiled and jittered by CSS
  function initGrain() {
    try {
      const size = 160;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = Math.random() * 200;
      }
      ctx.putImageData(img, 0, 0);
      document.documentElement.style.setProperty('--grain-img', `url(${c.toDataURL('image/png')})`);
    } catch (e) { /* grain is decorative */ }
  }

  function initClock() {
    const el = $('.footer__time');
    if (!el) return;
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' });
    const tick = () => { el.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 30000);
  }

  function initMenu() {
    const burger = $('.header__burger');
    const menu = $('#menu');
    const links = $$('a', menu);
    const open = (state) => {
      burger.setAttribute('aria-expanded', String(state));
      menu.classList.toggle('is-open', state);
      document.body.style.overflow = state ? 'hidden' : '';
      if (lenis) state ? lenis.stop() : lenis.start();
      if (state) {
        $('.header').classList.remove('is-hidden');
        if (hasGSAP && !reduceMotion) {
          gsap.fromTo(links, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .9, ease: 'expo.out', stagger: .06, delay: .1 });
        }
        setTimeout(() => links[0].focus(), 50);
      }
    };
    burger.addEventListener('click', () => open(burger.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => {
      if (!menu.classList.contains('is-open')) return;
      if (e.key === 'Escape') { open(false); burger.focus(); }
      if (e.key === 'Tab') {
        const items = [burger, ...links];
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    });
    initMenu.close = () => { if (menu.classList.contains('is-open')) open(false); };
  }

  function initAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id === '#' || id === '#main') return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      if (initMenu.close) initMenu.close();
      let dest = id === '#top' ? 0 : target;
      // Land on the assembled CTA rather than the start of its pin
      if (id === '#contact' && ctaTrigger) {
        dest = ctaTrigger.start + (ctaTrigger.end - ctaTrigger.start) * 0.85;
      }
      if (lenis) lenis.scrollTo(dest, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else if (typeof dest === 'number') window.scrollTo({ top: dest, behavior: reduceMotion ? 'auto' : 'smooth' });
      else dest.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ------------------------------------------------------------------------
     Mini charts (case files)
     ------------------------------------------------------------------------ */
  function chartSVG(type) {
    const defs = '<defs><linearGradient id="mcGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5CC6E8" stop-opacity=".55"/><stop offset="1" stop-color="#5CC6E8" stop-opacity="0"/></linearGradient></defs>';
    const grid = [40, 80, 120, 160].map((y) => `<line class="mc-grid" x1="0" x2="320" y1="${y}" y2="${y}"/>`).join('');
    let body = '';
    if (type === 'drop') {
      const vals = [240, 180, 120, 60, 20];
      const bars = vals.map((v, i) => {
        const h = (v / 240) * 130; const x = 24 + i * 60;
        return `<rect class="mc-bar${i === vals.length - 1 ? ' mc-bar--hot' : ''}" x="${x}" y="${170 - h}" width="36" height="${h}" rx="3"/>`;
      }).join('');
      const pts = vals.map((v, i) => `${42 + i * 60},${170 - (v / 240) * 130 - 8}`).join(' ');
      body = `${bars}<polyline class="mc-line mc-line--amber" points="${pts}"/>
        <text class="mc-text" x="24" y="190">4 HRS</text><text class="mc-text mc-text--amber" x="264" y="190">20 MIN</text>`;
    } else if (type === 'aging') {
      const vals = [30, 38, 52, 80, 110, 140, 158];
      const pts = vals.map((v, i) => `${10 + i * 50},${v}`);
      body = `<path class="mc-area" d="M${pts.join(' L')} L310,170 L10,170 Z"/>
        <polyline class="mc-line" points="${pts.join(' ')}"/>
        <circle class="mc-dot" cx="310" cy="158" r="5"/>
        <text class="mc-text" x="10" y="190">AT-RISK STOCK</text><text class="mc-text mc-text--amber" x="200" y="146">$100K PROTECTED</text>`;
    } else if (type === 'margin') {
      const vals = [-5, -4.6, -3.8, -2.5, -1, .6, 1.4, 2];
      const y = (v) => 100 - v * 13;
      const pts = vals.map((v, i) => `${14 + i * 42},${y(v)}`).join(' ');
      body = `<line class="mc-axis" x1="0" x2="320" y1="100" y2="100"/>
        <polyline class="mc-line mc-line--amber" points="${pts}"/>
        <circle class="mc-node" cx="14" cy="${y(-5)}" r="5"/><circle class="mc-dot" cx="308" cy="${y(2)}" r="5"/>
        <text class="mc-text" x="286" y="94">0%</text><text class="mc-text" x="24" y="${y(-5) + 4}">−5%</text>
        <text class="mc-text mc-text--amber" x="272" y="${y(2) - 12}">+2%</text>`;
    } else {
      const markets = ['BD', 'PK', 'LK', 'NP', 'MM'];
      body = markets.map((m, i) => {
        const ny = 22 + i * 38;
        return `<path class="mc-line" d="M60,${ny} C160,${ny} 170,100 250,100"/>
          <circle class="mc-node" cx="52" cy="${ny}" r="7"/><text class="mc-text" x="18" y="${ny + 4}">${m}</text>`;
      }).join('') + `<circle class="mc-hub" cx="258" cy="100" r="11"/><text class="mc-text mc-text--amber" x="276" y="104">WBR</text>`;
    }
    return `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid meet">${defs}${grid}${body}</svg>`;
  }

  function drawLines(container) {
    if (!hasGSAP || reduceMotion) return;
    $$('.mc-line', container).forEach((p) => {
      const len = p.getTotalLength ? p.getTotalLength() : 400;
      gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: 'power3.out' });
    });
    gsap.fromTo($$('.mc-bar, .mc-dot, .mc-hub, .mc-node', container),
      { scale: 0, transformOrigin: '50% 100%' },
      { scale: 1, duration: .8, ease: 'expo.out', stagger: .05 });
  }

  function initCases() {
    const cases = $$('.case');
    cases.forEach((c) => {
      $('.case__chart', c).innerHTML = chartSVG(c.dataset.chart);
      const row = $('.case__row', c);
      row.dataset.cursorLabel = 'View';
      row.addEventListener('click', () => {
        const open = !c.classList.contains('is-open');
        c.classList.toggle('is-open', open);
        row.setAttribute('aria-expanded', String(open));
        if (open) drawLines($('.case__chart', c));
        if (hasGSAP) setTimeout(() => ScrollTrigger.refresh(), 850);
      });
    });

    // Cursor-following preview (desktop)
    const preview = $('.case-preview');
    if (!finePointer || !hasGSAP || !preview) return;
    const inner = $('.case-preview__inner', preview);
    const xTo = gsap.quickTo(preview, 'x', { duration: .6, ease: 'power3' });
    const yTo = gsap.quickTo(preview, 'y', { duration: .6, ease: 'power3' });
    let current = null;   // case whose chart is loaded in the card
    let shown = null;     // case the card is currently shown for
    let px = -1, py = -1; // last known pointer position

    const show = (c) => {
      if (shown === c) return;
      shown = c;
      if (current !== c) { inner.innerHTML = chartSVG(c.dataset.chart); drawLines(inner); current = c; }
      gsap.to(preview, { opacity: 1, scale: 1, duration: .5, ease: 'expo.out', overwrite: 'auto' });
    };
    const hide = () => {
      if (!shown) return;
      shown = null;
      gsap.to(preview, { opacity: 0, scale: .6, duration: .35, ease: 'power3.out', overwrite: 'auto' });
    };
    // Decide from what is actually under the pointer. Hover events alone miss the
    // case where the page scrolls under a still mouse (no "leave" event fires),
    // which used to leave the card stuck on screen in other sections.
    const update = () => {
      const el = px < 0 ? null : document.elementFromPoint(px, py);
      const c = el && el.closest('.case__row') ? el.closest('.case') : null;
      if (c && !c.classList.contains('is-open')) show(c); else hide();
    };

    window.addEventListener('pointermove', (e) => {
      px = e.clientX; py = e.clientY;
      xTo(px); yTo(py);
      update();
    }, { passive: true });
    window.addEventListener('scroll', update, { passive: true }); // Lenis drives native scroll, so this fires either way
    document.addEventListener('pointerleave', () => { px = py = -1; hide(); });
    cases.forEach((c) => $('.case__row', c).addEventListener('click', () => setTimeout(update, 0)));
  }

  /* ------------------------------------------------------------------------
     Procedural canvas fields (video fallbacks)
     ------------------------------------------------------------------------ */
  const TEAL = [92, 198, 232];
  const AMBER = [242, 179, 91];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  class Field {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.mode = canvas.dataset.mode;
      this.progress = 0;
      this.t = Math.random() * 100;
      this.visible = false;
      this.resize();
      new ResizeObserver(() => this.resize()).observe(canvas);
      new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { rootMargin: '10% 0px' }).observe(canvas);
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.w = this.c.clientWidth;
      this.h = this.c.clientHeight;
      if (!this.w || !this.h) return;
      this.c.width = Math.round(this.w * dpr);
      this.c.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.setup();
    }

    setup() {
      const { w, h } = this;
      const mobile = w < 768;
      if (this.mode === 'bars') {
        this.setupBars();
      } else if (this.mode === 'motes') {
        const n = mobile ? 50 : 120;
        // Where the trend line forms, chosen by screen shape so it stays clear of faces:
        // landscape rises through the sunset window; portrait (phones, upright tablets)
        // arcs over the wall above Nabil's head.
        const portrait = h > w;
        this.pts = Array.from({ length: n }, (_, i) => {
          const f = i / (n - 1);
          const tx = w * (portrait ? .30 + f * .63 : .62 + f * .31);
          const trend = Math.pow(f, 1.4) + Math.sin(f * 9) * .05;
          const ty = h * (portrait ? .20 - trend * .10 : .45 - trend * .29);
          return {
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - .5) * .25, vy: -(.15 + Math.random() * .45),
            r: .6 + Math.random() * 1.8, amber: Math.random() < .22, tx, ty,
            ph: Math.random() * Math.PI * 2,
          };
        });
      } else if (this.mode === 'charts') {
        const n = mobile ? 4 : 7;
        this.panels = Array.from({ length: n }, (_, i) => ({
          x: (i / n) * w * 1.6 + Math.random() * 80,
          y: h * (.14 + Math.random() * .6),
          pw: (mobile ? 140 : 200) + Math.random() * 120,
          ph: (mobile ? 90 : 120) + Math.random() * 70,
          depth: .35 + Math.random() * .9,
          kind: i % 3,
          seed: Math.random() * 10,
          hot: i === 2 || i === 5,
        }));
      } else if (this.mode === 'corridor') {
        this.screens = Array.from({ length: 14 }, (_, i) => ({ z: 1 + i * .6, seed: Math.random() * 10 }));
      }
    }

    frame(dt) {
      if (!this.visible || !this.w) return;
      this.t += dt / 1000;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      if (this.mode === 'motes') this.drawMotes();
      else if (this.mode === 'bars') this.drawBars();
      else if (this.mode === 'charts') this.drawCharts();
      else this.drawCorridor();
    }

    drawMotes() {
      const { ctx, w, h, pts } = this;
      // data-form="off" keeps the motes drifting without forming the chart.
      const k = this.c.dataset.form === 'off' ? 0 : smooth(.08, .72, this.progress);
      ctx.globalCompositeOperation = 'lighter';
      const pos = pts.map((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
        const x = p.x + (p.tx - p.x) * k;
        const y = p.y + (p.ty - p.y) * k;
        return [x, y];
      });
      if (k > .25) {
        ctx.beginPath();
        pos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.strokeStyle = rgba(TEAL, (k - .25) * .6);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      pts.forEach((p, i) => {
        const [x, y] = pos[i];
        const tw = .55 + Math.sin(this.t * 2 + p.ph) * .35;
        const col = p.amber ? AMBER : TEAL;
        ctx.fillStyle = rgba(col, .08 * tw);
        ctx.beginPath(); ctx.arc(x, y, p.r * 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(col, .85 * tw);
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      if (k > .6) {
        const [ex, ey] = pos[pos.length - 1];
        const a = (k - .6) / .4;
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 60);
        g.addColorStop(0, rgba(AMBER, .7 * a)); g.addColorStop(1, rgba(AMBER, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 60, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(AMBER, a); ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // Mission section: particles settle into a bar chart in the open space next to
    // (desktop) or below (phones) the statement. The area is measured from the text
    // itself so it adapts to any screen and font size.
    barsRegion() {
      const st = $('.mission__statement');
      const body = $('.mission__body');
      const inner = $('.mission__inner');
      if (!st || !body || !inner) return null;
      const cr = this.c.getBoundingClientRect();
      const sr = st.getBoundingClientRect();
      const ir = inner.getBoundingClientRect();
      const bodyTop = body.getBoundingClientRect().top - (gsap.getProperty(body, 'y') || 0);
      if (this.w >= 768) {
        let right = sr.left;
        $$('.split-word', st).forEach((wd) => { right = Math.max(right, wd.getBoundingClientRect().right); });
        const x1 = ir.right - cr.left;
        const x0 = Math.max(right - cr.left + this.w * .05, x1 - 440);
        const r = { x0, x1, y0: sr.top - cr.top + sr.height * .06, y1: sr.bottom - cr.top - sr.height * .04 };
        return r.x1 - r.x0 >= 170 && r.y1 - r.y0 >= 140 ? r : null;
      }
      const r = { x0: ir.left - cr.left + 4, x1: ir.right - cr.left - 4, y0: sr.bottom - cr.top + 28, y1: bodyTop - cr.top - 28 };
      return r.y1 - r.y0 >= 90 ? r : null;
    }

    setupBars() {
      const { w, h } = this;
      const reg = this.region = this.barsRegion();
      const heights = [.34, .47, .42, .6, .68, .82, 1];
      const n = heights.length;
      this.bars = [];
      const targets = [];
      if (reg) {
        const bw = (reg.x1 - reg.x0) / (n + (n - 1) * .45);
        const sp = Math.min(9, Math.max(5, bw / 4));
        const cols = Math.max(2, Math.round(bw / sp));
        const maxH = reg.y1 - reg.y0;
        heights.forEach((hf, b) => {
          const bx = reg.x0 + b * bw * 1.45;
          const bh = maxH * hf;
          const hot = b === n - 1;
          this.bars.push({ x: bx, y: reg.y1 - bh, w: bw, h: bh, hot });
          const rows = Math.max(1, Math.floor(bh / sp));
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              // bottom rows land first so the bars grow upward
              targets.push({ tx: bx + (c + .5) * (bw / cols), ty: reg.y1 - (r + .5) * (bh / rows), hot, d: (r / rows) * .45 + Math.random() * .08 });
            }
          }
        });
      }
      // A few extra free-floating motes keep the drift lively before the chart forms
      const extra = w < 768 ? 30 : 60;
      for (let i = 0; i < extra; i++) targets.push({ tx: null });
      this.pts = targets.map((t) => ({
        ...t,
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3 - .1,
        r: .8 + Math.random() * 1.2, ph: Math.random() * Math.PI * 2,
        amber: t.hot || Math.random() < .12,
      }));
    }

    drawBars() {
      const { ctx, w, h, pts, bars, region: reg } = this;
      const k = smooth(.12, .82, this.progress);
      ctx.globalCompositeOperation = 'lighter';
      if (reg && k > .35) {
        const a = (k - .35) / .65;
        bars.forEach((b) => { ctx.fillStyle = rgba(b.hot ? AMBER : TEAL, .08 * a); ctx.fillRect(b.x, b.y, b.w, b.h); });
        ctx.strokeStyle = rgba(TEAL, .4 * a);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(reg.x0 - 6, reg.y1 + 5); ctx.lineTo(reg.x1 + 6, reg.y1 + 5); ctx.stroke();
      }
      pts.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
        if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
        const kp = p.tx === null || !reg ? 0 : smooth(p.d, p.d + .55, k);
        const x = kp ? p.x + (p.tx - p.x) * kp : p.x;
        const y = kp ? p.y + (p.ty - p.y) * kp : p.y;
        const tw = .55 + Math.sin(this.t * 2 + p.ph) * .35;
        const col = p.amber ? AMBER : TEAL;
        const s = p.r * (1 + kp * .4);
        ctx.fillStyle = rgba(col, (.45 + .45 * kp) * (kp > .9 ? 1 : tw));
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      });
      if (reg && k > .65) {
        const hot = bars[bars.length - 1];
        const a = (k - .65) / .35;
        const cx = hot.x + hot.w / 2, cy = hot.y - 4;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70);
        g.addColorStop(0, rgba(AMBER, .55 * a)); g.addColorStop(1, rgba(AMBER, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    drawCharts() {
      const { ctx, w, h } = this;
      // Grid
      ctx.strokeStyle = 'rgba(92,198,232,.05)';
      ctx.lineWidth = 1;
      const step = 64;
      const off = (this.progress * 400) % step;
      ctx.beginPath();
      for (let x = -off; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = 0; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();

      // Flowing background series
      ctx.globalCompositeOperation = 'lighter';
      [[TEAL, .22, .72, 1], [TEAL, .12, .5, 1.7], [AMBER, .28, .82, .6]].forEach(([col, a, base, f], s) => {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 12) {
          const u = x / w;
          const y = h * base - Math.sin(u * 6 * f + this.t * .5 + s) * 26 - Math.sin(u * 17 + this.t * .9) * 8 - u * h * .12 * (1 + this.progress);
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = rgba(col, a);
        ctx.lineWidth = s === 2 ? 1.6 : 1.1;
        ctx.stroke();
      });

      // Floating holographic panels
      this.panels.forEach((p) => {
        const span = w * 1.8;
        let x = ((p.x - this.progress * w * 1.2 * p.depth - this.t * 6 * p.depth) % span + span) % span - w * .3;
        const y = p.y + Math.sin(this.t * .6 + p.seed) * 8;
        const s = .6 + p.depth * .5;
        const pw = p.pw * s; const ph = p.ph * s;
        const col = p.hot ? AMBER : TEAL;
        const alpha = .25 + p.depth * .35;
        ctx.fillStyle = rgba(col, .035 * alpha * 2);
        ctx.strokeStyle = rgba(col, .35 * alpha);
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, pw, ph);
        ctx.strokeRect(x + .5, y + .5, pw, ph);
        // header ticks
        ctx.fillStyle = rgba(col, .5 * alpha);
        ctx.fillRect(x + 10, y + 10, pw * .3, 2);
        ctx.fillRect(x + 10, y + 16, pw * .18, 2);
        const ix = x + 10, iy = y + 28, iw = pw - 20, ih = ph - 38;
        if (p.kind === 0) {
          const n = 7;
          for (let i = 0; i < n; i++) {
            const v = .3 + .7 * Math.abs(Math.sin(i * 1.3 + p.seed + this.t * .4));
            ctx.fillStyle = rgba(col, (.25 + (i === n - 1 ? .5 : 0)) * alpha * 1.6);
            ctx.fillRect(ix + i * (iw / n) + 2, iy + ih * (1 - v), iw / n - 5, ih * v);
          }
        } else if (p.kind === 1) {
          ctx.beginPath();
          for (let i = 0; i <= 20; i++) {
            const u = i / 20;
            const yy = iy + ih * (.8 - u * .55 - Math.sin(u * 8 + p.seed + this.t * .7) * .12);
            i ? ctx.lineTo(ix + u * iw, yy) : ctx.moveTo(ix, yy);
          }
          ctx.strokeStyle = rgba(col, .8 * alpha);
          ctx.lineWidth = 1.4;
          ctx.stroke();
        } else {
          const cx = ix + iw / 2, cy = iy + ih / 2, r = Math.min(iw, ih) * .4;
          ctx.lineWidth = 5;
          ctx.strokeStyle = rgba(col, .18 * alpha);
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = rgba(col, .8 * alpha);
          ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (.55 + .3 * Math.sin(this.t * .5 + p.seed))); ctx.stroke();
        }
      });
      ctx.globalCompositeOperation = 'source-over';
    }

    drawCorridor() {
      const { ctx, w, h } = this;
      const cx = w / 2, cy = h * .48;
      // Amber light at the end of the corridor
      const glowR = Math.max(w, h) * .35;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      g.addColorStop(0, rgba(AMBER, .55 + this.progress * .25));
      g.addColorStop(.12, rgba(AMBER, .18));
      g.addColorStop(1, rgba(AMBER, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Perspective rails
      ctx.strokeStyle = 'rgba(92,198,232,.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      [[0, 0], [w, 0], [0, h], [w, h], [0, h * .78], [w, h * .78], [0, h * .2], [w, h * .2]].forEach(([x, y]) => { ctx.moveTo(cx, cy); ctx.lineTo(x, y); });
      ctx.stroke();

      // Screens moving toward the viewer
      ctx.globalCompositeOperation = 'lighter';
      const speed = .25 + this.progress * .6;
      const zMax = 1 + this.screens.length * .6;
      const sorted = this.screens.map((s) => {
        s.z -= speed * .016;
        if (s.z < .35) { s.z += zMax - .35; s.seed = Math.random() * 10; }
        return s;
      }).sort((a, b) => b.z - a.z);
      sorted.forEach((s) => {
        const sc = 1 / s.z;
        const a = Math.min(1, sc * .9) * Math.min(1, (zMax - s.z) / 2);
        [-1, 1].forEach((side) => {
          const xNear = cx + side * w * .62 * sc;
          const xFar = cx + side * w * .62 * (1 / (s.z + .45));
          const top = cy - h * .42 * sc, bot = cy + h * .3 * sc;
          const topF = cy - h * .42 / (s.z + .45), botF = cy + h * .3 / (s.z + .45);
          ctx.beginPath();
          ctx.moveTo(xNear, top); ctx.lineTo(xFar, topF); ctx.lineTo(xFar, botF); ctx.lineTo(xNear, bot); ctx.closePath();
          const hot = s.seed > 8.6;
          ctx.fillStyle = rgba(hot ? AMBER : TEAL, .05 * a);
          ctx.fill();
          ctx.strokeStyle = rgba(hot ? AMBER : TEAL, .35 * a);
          ctx.stroke();
          // chart line inside the screen
          ctx.beginPath();
          for (let i = 0; i <= 10; i++) {
            const u = i / 10;
            const x = xNear + (xFar - xNear) * u;
            const t0 = top + (topF - top) * u, b0 = bot + (botF - bot) * u;
            const y = b0 - (b0 - t0) * (.3 + .4 * Math.abs(Math.sin(u * 5 + s.seed + this.t)));
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.strokeStyle = rgba(hot ? AMBER : TEAL, .6 * a);
          ctx.stroke();
        });
      });
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  const fields = new Map();
  function initFields() {
    // Only reserve room for the mission chart when it will actually be drawn
    // (no gap for reduced-motion visitors or if the libraries fail to load)
    const bars = $('canvas.field[data-mode="bars"]');
    if (bars) bars.closest('section').classList.add('has-chart');
    $$('canvas.field').forEach((c) => fields.set(c.dataset.mode, new Field(c)));
    // Chart areas measured from text need re-measuring after fonts load or layout refreshes
    ScrollTrigger.addEventListener('refresh', () => fields.forEach((f) => { if (f.mode === 'bars') f.resize(); }));
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(64, now - last); last = now;
      if (!document.hidden) fields.forEach((f) => f.frame(dt));
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  const setField = (mode, p) => { const f = fields.get(mode); if (f) f.progress = p; };

  /* ------------------------------------------------------------------------
     Scroll-scrubbed videos
     ------------------------------------------------------------------------ */
  function initScrubVideos() {
    const useVideo = !reduceMotion && !saveData;
    $$('.scrub-video').forEach((v, i) => {
      const section = v.closest('section');
      const ctrl = { target: 0, current: 0, ready: false, dur: 0, set(p) { this.target = p; } };
      v._scrub = ctrl;
      if (!useVideo) { v.remove(); return; }

      const load = () => {
        if (v.src) return;
        v.addEventListener('loadedmetadata', () => { ctrl.dur = v.duration || 0; }, { once: true });
        v.addEventListener('loadeddata', () => { ctrl.ready = true; v.pause(); section.classList.add('has-video'); }, { once: true });
        v.addEventListener('error', () => { ctrl.ready = false; v.remove(); }, { once: true });
        v.preload = 'auto';
        v.src = isMobile() && v.dataset.srcMobile ? v.dataset.srcMobile : v.dataset.src;
        v.load();
      };

      if (i === 0) load();
      else {
        const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { load(); io.disconnect(); } }, { rootMargin: '150% 0px' });
        io.observe(section);
      }

      gsap.ticker.add(() => {
        if (!ctrl.ready || !ctrl.dur || !v.isConnected) return;
        const t = ctrl.target * (ctrl.dur - .05);
        ctrl.current += (t - ctrl.current) * .12;
        if (Math.abs(v.currentTime - ctrl.current) > .01 && !v.seeking) v.currentTime = ctrl.current;
      });
    });
  }
  const scrubOf = (sel) => { const v = $(sel + ' .scrub-video'); return v && v._scrub ? v._scrub : { set() {} }; };

  /* ------------------------------------------------------------------------
     Lenis
     ------------------------------------------------------------------------ */
  function initLenis() {
    if (reduceMotion || typeof window.Lenis === 'undefined') return;
    lenis = new Lenis({ lerp: .085, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  /* ------------------------------------------------------------------------
     Header, progress, cursor, magnetic, velocity skew, marquee
     ------------------------------------------------------------------------ */
  function initChrome() {
    const header = $('.header');
    const bar = $('.progress i');
    const onScroll = (y, dir, prog) => {
      bar.style.transform = `scaleX(${prog})`;
      if ($('#menu').classList.contains('is-open')) return;
      header.classList.toggle('is-hidden', y > 240 && dir > 0);
    };
    if (lenis) lenis.on('scroll', (e) => onScroll(e.scroll, e.direction, e.progress || 0));
    else {
      let lastY = scrollY;
      addEventListener('scroll', () => {
        const max = document.documentElement.scrollHeight - innerHeight;
        onScroll(scrollY, scrollY > lastY ? 1 : -1, max > 0 ? scrollY / max : 0);
        lastY = scrollY;
      }, { passive: true });
    }

    // Velocity skew on section titles + reactive marquee
    const titles = $$('.title');
    const skewTo = titles.map((el) => gsap.quickTo(el, 'skewX', { duration: .6, ease: 'power3' }));
    const track = $('.marquee__track');
    track.innerHTML += track.innerHTML;
    let x = 0, dir = 1;
    gsap.ticker.add((time, dt) => {
      const vel = lenis ? lenis.velocity : 0;
      if (lenis && Math.abs(vel) > .1) dir = vel > 0 ? 1 : -1;
      const skew = gsap.utils.clamp(-6, 6, -vel * .3);
      skewTo.forEach((f) => f(skew));
      const half = track.scrollWidth / 2;
      if (half) {
        x -= (1 + Math.min(Math.abs(vel) * .35, 10)) * dir * dt * .06;
        x = gsap.utils.wrap(-half, 0, x);
        track.style.transform = `translate3d(${x}px,0,0)`;
      }
    });

    if (!finePointer) return;

    // Custom cursor
    const cursor = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    const label = $('.cursor__label');
    const dx = gsap.quickTo(dot, 'x', { duration: .12, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: .12, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: .5, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: .5, ease: 'power3' });
    addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); cursor.classList.remove('is-hidden'); }, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('pointerover', (e) => {
      const lab = e.target.closest('[data-cursor-label]');
      const hov = e.target.closest('a, button');
      if (lab && !(hov && hov !== lab)) {
        cursor.classList.add('is-label'); cursor.classList.remove('is-hover');
        label.textContent = lab.dataset.cursorLabel;
      } else {
        cursor.classList.remove('is-label');
        cursor.classList.toggle('is-hover', !!hov);
      }
    });

    // Magnetic buttons
    $$('.magnetic').forEach((el) => {
      const mx = gsap.quickTo(el, 'x', { duration: .6, ease: 'power3' });
      const my = gsap.quickTo(el, 'y', { duration: .6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - (r.left + r.width / 2)) * .35);
        my((e.clientY - (r.top + r.height / 2)) * .35);
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, .4)' }));
    });
  }

  /* ------------------------------------------------------------------------
     Sections
     ------------------------------------------------------------------------ */
  function initHero(mm) {
    const hero = $('.hero');
    const noise = units($('.hero__line--noise'));
    const scrub = scrubOf('.hero');

    // Initial (pre-reveal) states
    gsap.set(units($('.hero__title')), { yPercent: 115 });
    gsap.set('.hero__eyebrow', { clipPath: 'inset(0 100% 0 0)' });
    gsap.set(['.hero__lede', '.hero__cue'], { opacity: 0, y: 24 });
    gsap.set('.hero__fallback', { scale: 1.15 });
    gsap.set('.header', { opacity: 0, y: -20 });

    mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)' }, (ctx) => {
      const len = ctx.conditions.desktop ? 2.5 : 1.5;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: hero, start: 'top top', end: () => '+=' + innerHeight * len,
          pin: true, scrub: true, anticipatePin: 1,
          onUpdate: (self) => { scrub.set(self.progress); setField('motes', self.progress); },
        },
      });
      tl.fromTo('.hero__fallback', { scale: 1.15, yPercent: 0 }, { scale: 1, yPercent: -3, ease: 'none', duration: 1 }, 0)
        .fromTo(noise, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 }, {
          x: () => gsap.utils.random(-180, 180), y: () => gsap.utils.random(-240, 60),
          rotation: () => gsap.utils.random(-45, 45), scale: () => gsap.utils.random(.4, 1.6), opacity: 0,
          ease: 'power1.in', duration: .45, stagger: { each: .02, from: 'random' },
        }, .06)
        .fromTo('.hero__line--signal', { scale: 1, yPercent: 0 }, { scale: 1.12, yPercent: -95, ease: 'power2.inOut', duration: .5 }, .2)
        .fromTo(['.hero__eyebrow', '.hero__foot'], { opacity: 1 }, { opacity: 0, ease: 'none', duration: .2 }, .04)
        .fromTo('.hero__stage', { scale: 1, borderRadius: 0 }, { scale: .92, borderRadius: 28, ease: 'power2.in', duration: .3 }, .7)
        .fromTo('.hero__dim', { opacity: 0 }, { opacity: .6, ease: 'power2.in', duration: .3 }, .7);
    });
  }

  function heroIntro() {
    const tl = gsap.timeline();
    tl.to(units($('.hero__title')), {
      yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: .028,
      onComplete: () => $('.hero__title').classList.add('is-free'),
    }, 0)
      .to('.hero__eyebrow', { clipPath: 'inset(0 0% 0 0)', duration: 1.4, ease: 'expo.inOut' }, .2)
      .to(['.hero__lede', '.hero__cue'], { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: .12 }, .6)
      .to('.header', { opacity: 1, y: 0, duration: 1, ease: 'expo.out', clearProps: 'transform' }, .7);
  }

  function initStats() {
    gsap.from('.stat', {
      y: 50, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .08,
      scrollTrigger: { trigger: '.stats__grid', start: 'top 85%' },
    });
    $$('[data-count]').forEach((el) => {
      const end = +el.dataset.count;
      const o = { v: 0 };
      el.textContent = '0';
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: () => gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } }),
      });
    });
  }

  function initMission(mm) {
    const words = units($('.mission__statement'));
    mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)' }, (ctx) => {
      gsap.set(words, { opacity: .14 });
      gsap.set('.mission__body', { opacity: 0, y: 30 });
      const tl = gsap.timeline({
        scrollTrigger: ctx.conditions.desktop
          ? { trigger: '.mission', start: 'top top', end: '+=150%', pin: true, scrub: true, onUpdate: (self) => setField('bars', self.progress) }
          : { trigger: '.mission', start: 'top 70%', end: 'bottom 70%', scrub: true, onUpdate: (self) => setField('bars', self.progress) },
      });
      tl.to(words, { opacity: 1, ease: 'none', stagger: .1, duration: .3 })
        .to('.mission__body', { opacity: 1, y: 0, ease: 'power2.out', duration: .6 }, '-=.2');
    });
  }

  function prepDraw(svg) {
    $$('path, rect, circle, line, polyline', svg).forEach((p) => {
      const len = p.getTotalLength ? p.getTotalLength() : 200;
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    });
  }
  const drawIn = (svg) => gsap.to($$('path, rect, circle, line, polyline', svg), { strokeDashoffset: 0, duration: 1.6, ease: 'power3.inOut', stagger: .08 });

  function initPillars(mm) {
    const section = $('.pillars');
    const track = $('.pillars__track');
    const cards = $$('.pillar');
    const count = $('.pillars__count b');
    const scrub = scrubOf('.pillars');
    cards.forEach((c) => prepDraw($('.pillar__icon', c)));

    mm.add('(min-width: 768px)', () => {
      section.dataset.cursorLabel = 'Scroll';
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      let lastIdx = 1;
      const tween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: section, start: 'top top', end: () => '+=' + dist(),
          pin: true, scrub: 1, invalidateOnRefresh: true,
          onUpdate: (self) => {
            scrub.set(self.progress);
            setField('charts', self.progress);
            const idx = Math.min(3, Math.floor(self.progress * 3) + 1);
            if (idx !== lastIdx) { lastIdx = idx; count.textContent = '0' + idx; }
          },
        },
      });
      // Slow drift across the background photo while the cards travel
      gsap.fromTo('.pillars__fallback img', { scale: 1.14, xPercent: 3 }, {
        scale: 1.04, xPercent: -3, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + dist(), scrub: true, invalidateOnRefresh: true },
      });
      cards.forEach((c) => {
        gsap.from(c, {
          opacity: 0, y: 80, rotation: 3, duration: 1, ease: 'expo.out',
          scrollTrigger: { trigger: c, containerAnimation: tween, start: 'left 92%' },
        });
        ScrollTrigger.create({ trigger: c, containerAnimation: tween, start: 'left 75%', once: true, onEnter: () => drawIn($('.pillar__icon', c)) });
      });

      // Subtle tilt toward the cursor
      const tilts = cards.map((c) => {
        const rx = gsap.quickTo(c, 'rotationX', { duration: .6, ease: 'power3' });
        const ry = gsap.quickTo(c, 'rotationY', { duration: .6, ease: 'power3' });
        gsap.set(c, { transformPerspective: 900 });
        const move = (e) => {
          const r = c.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - .5) * 8);
          rx(-((e.clientY - r.top) / r.height - .5) * 8);
        };
        const leave = () => { rx(0); ry(0); };
        c.addEventListener('pointermove', move);
        c.addEventListener('pointerleave', leave);
        return () => { c.removeEventListener('pointermove', move); c.removeEventListener('pointerleave', leave); };
      });
      return () => { delete section.dataset.cursorLabel; tilts.forEach((f) => f()); };
    });

    mm.add('(max-width: 767px)', () => {
      ScrollTrigger.create({
        trigger: section, start: 'top bottom', end: 'bottom top',
        onUpdate: (self) => { scrub.set(self.progress); setField('charts', self.progress); },
      });
      cards.forEach((c) => {
        gsap.from(c, { opacity: 0, y: 60, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: c, start: 'top 88%' } });
        ScrollTrigger.create({ trigger: c, start: 'top 75%', once: true, onEnter: () => drawIn($('.pillar__icon', c)) });
      });
    });
  }

  function initStory() {
    gsap.to('.timeline__line i', {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: '.story__timeline', start: 'top 60%', end: 'bottom 60%', scrub: true },
    });
    gsap.fromTo('.story__portrait img', { yPercent: -12 }, {
      yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: '.story__portrait', start: 'top bottom', end: 'bottom top', scrub: true },
    });
    gsap.from('.story__portrait', { scale: .6, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.story__portrait', start: 'top 85%' } });

    const yearEl = $('.story__year-num');
    const yr = { v: 2012 };
    const setYear = (y) => gsap.to(yr, { v: +y, duration: .9, ease: 'power3.out', onUpdate: () => { yearEl.textContent = Math.round(yr.v); } });

    $$('.tl').forEach((item) => {
      gsap.from(item, { opacity: 0, y: 50, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: item, start: 'top 88%' } });
      ScrollTrigger.create({
        trigger: item, start: 'top 60%', end: 'bottom 60%',
        onToggle: (self) => {
          item.classList.toggle('is-active', self.isActive);
          if (self.isActive) setYear(item.dataset.year);
        },
      });
    });
  }

  function initCaps(mm) {
    const cards = $$('.cap');
    mm.add('(min-width: 768px)', () => {
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        gsap.to(card, {
          scale: .94, '--dim': .5, ease: 'none',
          scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 25%', scrub: true },
        });
      });
    });
    cards.forEach((card) => {
      gsap.from($$('.cap__title, .cap__text, .cap__tags li', card), {
        opacity: 0, y: 30, duration: 1, ease: 'expo.out', stagger: .05,
        scrollTrigger: { trigger: card, start: 'top 80%' },
      });
    });
    gsap.from('.cert', { opacity: 0, y: 40, duration: 1, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: '.certs', start: 'top 88%' } });
  }

  function initWork() {
    gsap.from('.case', { opacity: 0, y: 50, duration: 1.1, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: '.cases', start: 'top 85%' } });
    gsap.from('.work__note', { opacity: 0, y: 20, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.work__note', start: 'top 90%' } });
  }

  function initCTA(mm) {
    const scrub = scrubOf('.cta');
    const l1 = units($$('.cta__line')[0]);
    const l2 = units($$('.cta__line')[1]);
    const rest = ['.cta__content .label', '.cta__sub', '.cta__actions', '.cta__meta'];

    mm.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)' }, (ctx) => {
      if (ctx.conditions.desktop) {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: '.cta', start: 'top top', end: '+=200%', pin: true, scrub: true,
            onUpdate: (self) => { scrub.set(self.progress); setField('corridor', self.progress); },
          },
        });
        ctaTrigger = tl.scrollTrigger;
        tl.fromTo('.cta__media', { scale: 1.18 }, { scale: 1, ease: 'none', duration: 1 }, 0)
          .fromTo(rest[0], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .1 }, .12)
          .fromTo(l1, { yPercent: 115, rotation: 6 }, { yPercent: 0, rotation: 0, ease: 'power3.out', stagger: .012, duration: .25 }, .15)
          .fromTo(l2, { yPercent: 115, rotation: 6 }, { yPercent: 0, rotation: 0, ease: 'power3.out', stagger: .02, duration: .25 }, .32)
          .fromTo(rest.slice(1), { opacity: 0, y: 30 }, { opacity: 1, y: 0, ease: 'power2.out', stagger: .05, duration: .15 }, .5);
        return () => { ctaTrigger = null; };
      }
      ScrollTrigger.create({
        trigger: '.cta', start: 'top bottom', end: 'bottom top',
        onUpdate: (self) => { scrub.set(self.progress); setField('corridor', self.progress); },
      });
      const tl = gsap.timeline({ scrollTrigger: { trigger: '.cta__content', start: 'top 80%' } });
      tl.from([...l1, ...l2], { yPercent: 115, duration: 1.2, ease: 'expo.out', stagger: .02 })
        .from(rest, { opacity: 0, y: 30, duration: 1, ease: 'expo.out', stagger: .08 }, '-=.8');
    });
  }

  function initFooter() {
    gsap.from(units($('.footer__word')), {
      yPercent: 110, duration: 1.4, ease: 'expo.out', stagger: .03,
      scrollTrigger: { trigger: '.footer__word', start: 'top 95%' },
    });
    gsap.from('.footer__cols > div', { opacity: 0, y: 30, duration: 1, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: '.footer', start: 'top 85%' } });
  }

  function initGenericReveals() {
    // Section titles & quotes: characters / words rise from masks
    $$('.title[data-split], .story__quote [data-split]').forEach((el) => {
      if (el.closest('.pillars')) return; // handled with the pinned track below
      gsap.from(units(el), {
        yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: el.dataset.split === 'chars' ? .025 : .05,
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });
    const pillarTitle = $('.pillars .title');
    if (pillarTitle) {
      gsap.from(units(pillarTitle), { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: .03, scrollTrigger: { trigger: '.pillars', start: 'top 60%' } });
    }
    $$('.label').forEach((el) => {
      if (el.closest('.hero, .cta, .footer')) return;
      gsap.from(el, { opacity: 0, x: -20, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
    });
  }

  /* ------------------------------------------------------------------------
     Preloader
     ------------------------------------------------------------------------ */
  function runPreloader(onReveal) {
    const pre = $('.preloader');
    const countEl = $('.preloader__count');
    const bar = $('.preloader__bar i');
    const img = $('.hero__fallback img');
    const imgReady = new Promise((r) => {
      if (img.complete) r();
      else { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }
    });
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    const minTime = new Promise((r) => setTimeout(r, reduceMotion ? 200 : 1100));
    const cap = new Promise((r) => setTimeout(r, 3500));
    const ready = Promise.race([Promise.all([imgReady, fonts, minTime]), cap]);

    const s = { v: 0 };
    const render = () => {
      countEl.textContent = String(Math.round(s.v)).padStart(3, '0');
      bar.style.transform = `scaleX(${s.v / 100})`;
    };
    const t1 = gsap.to(s, { v: 86, duration: 2.2, ease: 'power2.out', onUpdate: render });

    ready.then(() => {
      t1.kill();
      ScrollTrigger.refresh();
      gsap.timeline()
        .to(s, { v: 100, duration: .45, ease: 'power2.inOut', onUpdate: render })
        .to('.preloader__inner', { opacity: 0, y: -20, duration: .4, ease: 'power2.in' })
        .to('.preloader__panel--top', { yPercent: -100, duration: 1.2, ease: 'expo.inOut' })
        .to('.preloader__panel--bottom', { yPercent: 100, duration: 1.2, ease: 'expo.inOut' }, '<')
        .add(() => { pre.style.pointerEvents = 'none'; onReveal(); }, '<.35')
        .add(() => pre.remove());
    });
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  function boot() {
    initGrain();
    initCopy();
    initClock();
    initMenu();
    initAnchors();

    if (!hasGSAP) {
      // Libraries failed to load: show the static, fully readable page
      const pre = $('.preloader'); if (pre) pre.remove();
      $$('.scrub-video').forEach((v) => v.remove());
      initCases();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    initCases();

    if (reduceMotion) {
      // Calm version: no smooth scroll, pins, splits or scrubbing
      $$('.scrub-video').forEach((v) => v.remove());
      $$('canvas.field').forEach((c) => c.remove());
      const bar = $('.progress i');
      addEventListener('scroll', () => {
        const max = document.documentElement.scrollHeight - innerHeight;
        bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
      }, { passive: true });
      const pre = $('.preloader'); if (pre) pre.remove();
      return;
    }

    $$('[data-split]').forEach(splitText);
    initLenis();
    initFields();
    initScrubVideos();
    initChrome();

    const mm = gsap.matchMedia();
    initHero(mm);
    initStats();
    initMission(mm);
    initPillars(mm);
    initStory();
    initCaps(mm);
    initWork();
    initCTA(mm);
    initFooter();
    initGenericReveals();

    runPreloader(() => {
      heroIntro();
      if (lenis) lenis.start();
    });

    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
    addEventListener('load', () => ScrollTrigger.refresh());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
