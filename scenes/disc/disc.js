(function () {
  var SCRIPT = document.currentScript;
  var BASE = SCRIPT && SCRIPT.src ? SCRIPT.src.replace(/[^\/]*$/, '') : 'scenes/disc/';
  var TAU = Math.PI * 2;
  var F_MAX = 30;
  var EYE_F = 12;
  var GAUGE_FROM = Math.PI * 0.75;
  var GAUGE_SPAN = Math.PI * 1.5;
  var KV = 0.5;
  var CF = 0.65;
  var SHUT_LO = 5;
  var SHUT_HI = 7;
  var FALLBACK = [
    { key: 'dancer', title: '춤추는 남자', year: '1835년경', n: 8, phase: 0.1564, fit: 0.99739, img: 'img/dancer.webp', imgM: 'img/dancer-m.webp', thumb: 'img/dancer-t.webp' },
    { key: 'cats', title: '고양이와 당나귀', year: '1830년경', n: 10, phase: 0.1067, fit: 0.99693, img: 'img/cats.webp', imgM: 'img/cats-m.webp', thumb: 'img/cats-t.webp' },
    { key: 'waltz', title: '왈츠 추는 남녀', year: '1893년', n: 13, phase: 0.0675, fit: 0.99664, img: 'img/waltz.webp', imgM: 'img/waltz-m.webp', thumb: 'img/waltz-t.webp' }
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function wrap(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
  function ease(dt, tau) { return 1 - Math.exp(-dt / tau); }
  function polar(cx, cy, r, a) { return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }

  function ensureStyle(onLoad) {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      if (/scenes\/disc\/disc\.css(\?|$)/.test(links[i].href) || links[i].id === 'am-disc-css') return;
    }
    var ln = document.createElement('link');
    ln.id = 'am-disc-css';
    ln.rel = 'stylesheet';
    ln.href = BASE + 'disc.css';
    ln.addEventListener('load', onLoad);
    document.head.appendChild(ln);
  }

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function mountDisc(root, opts) {
    opts = opts || {};
    var AM = window.AM || {};
    var reduced = opts.reducedMotion != null ? opts.reducedMotion : !!AM.reducedMotion;
    var touchy = opts.isTouch != null ? opts.isTouch : !!AM.isTouch;
    ensureStyle(function () { layout(); });
    root.classList.add('am-disc');

    var canvas = el('canvas', 'am-disc-canvas', root);
    var ctx = canvas.getContext('2d');
    var hit = el('div', 'am-disc-hit', root);
    var noteRead = el('div', 'am-disc-note am-disc-read', root);
    var noteEye = el('div', 'am-disc-note', root);
    var noteShut = el('div', 'am-disc-note', root);
    var noteHint = el('div', 'am-disc-note', root);
    var noteId = el('div', 'am-disc-note', root);
    var thumbsBox = el('div', 'am-disc-thumbs', root);
    noteEye.innerHTML = '<b>초당 12장 안팎</b>이때부터 눈은 움직임으로 봅니다';
    noteShut.innerHTML = '<b>틈 사이로 보면 —</b>그림이 제자리에서 움직입니다';
    noteHint.innerHTML = '<b>돌려 보세요</b>빠를수록 그림이 살아납니다';

    var col = { ink: '#16161a', ink2: '#4d4d55', line: 'rgba(22,22,26,0.14)', line2: 'rgba(22,22,26,0.32)', blue: '#2b5fd9', red: '#e0442b' };
    if (AM.cssVar) {
      col.ink = AM.cssVar('--ink') || col.ink;
      col.blue = AM.cssVar('--blue') || col.blue;
      col.red = AM.cssVar('--red') || col.red;
      col.line = AM.cssVar('--line') || col.line;
      col.line2 = AM.cssVar('--line-2') || col.line2;
    }

    var mobileImg = touchy && Math.min(screen.width, screen.height) * Math.min(window.devicePixelRatio || 1, 2) < 1300;
    var discs = [];
    var images = [];
    var cur = 0;
    var thumbs = [];

    var L = { W: 1, H: 1, cx: 0, cy: 0, R: 10, Rg: 20, side: false, pad: 12, dpr: 1 };
    var maxDpr = 2;
    var maxBlur = 6;

    var theta = 0;
    var omega = 0;
    var breathT = 0;
    var idleT = 0;
    var press = { v: 1, vel: 0, target: 1 };
    var tilt = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    var grab = null;
    var flip = null;
    var flash = 0;
    var shutOn = false;
    var lastIdx = 0;
    var touched = false;
    var running = false;
    var raf = 0;
    var lastNow = 0;
    var started = false;
    var introT = -1;
    var ready = false;
    var appear = 0;
    var perf = { n: 0, sum: 0, done: false };
    var notes = {
      read: { el: noteRead, a: 0, t: 0, line: null },
      eye: { el: noteEye, a: 0, t: 0, line: null },
      shut: { el: noteShut, a: 0, t: 0, line: null },
      hint: { el: noteHint, a: 0, t: 0, line: null },
      id: { el: noteId, a: 0, t: 0, line: null }
    };
    var readTxt = '';
    var hintArc = null;

    function disc() { return discs[cur] || FALLBACK[0]; }
    function slitStep() { return TAU / disc().n; }
    function fps() { return Math.abs(omega) / slitStep(); }

    function setIdText() {
      var d = disc();
      noteId.innerHTML = '<b>' + d.title + '</b>' + d.year + ' · 그림 ' + d.n + '장';
    }

    function buildThumbs() {
      thumbsBox.innerHTML = '';
      thumbs = discs.map(function (d, i) {
        var b = el('button', 'am-disc-thumb', thumbsBox);
        b.type = 'button';
        b.setAttribute('aria-label', d.year + ' ' + d.title + ' 원반');
        b.title = d.year + ' · ' + d.title;
        var s = el('span', '', b);
        var im = el('img', '', s);
        im.alt = '';
        im.decoding = 'async';
        im.src = BASE + d.thumb;
        b.addEventListener('click', function () { setDisc(i); });
        return b;
      });
      markThumbs();
    }

    function markThumbs() {
      thumbs.forEach(function (b, i) { b.setAttribute('aria-pressed', i === cur ? 'true' : 'false'); });
    }

    function loadImage(i) {
      if (images[i]) return images[i].p;
      var d = discs[i];
      var im = new Image();
      im.decoding = 'async';
      var entry = { img: im, ok: false, p: null };
      images[i] = entry;
      im.src = BASE + (mobileImg ? d.imgM : d.img);
      entry.p = (im.decode ? im.decode() : new Promise(function (res, rej) { im.onload = res; im.onerror = rej; }))
        .then(function () { entry.ok = true; })
        .catch(function () { entry.ok = im.complete && im.naturalWidth > 0; });
      return entry.p;
    }

    function imgOf(i) { var e = images[i]; return e && e.ok ? e.img : null; }

    function layout() {
      var W = Math.max(1, root.clientWidth);
      var H = Math.max(1, root.clientHeight);
      var stripH = 64;
      var areaH = Math.max(80, H - stripH);
      var mind = Math.min(W, areaH);
      var D = mind * (mind < 400 ? 0.8 : 0.86);
      var R = D / 2;
      var gap = clamp(R * 0.045, 8, 16);
      var Rg = R + gap;
      var cx = W / 2;
      var cy = areaH / 2;
      var pad = W < 480 ? 12 : 18;
      var side = (W / 2 - Rg - 12) >= 230;
      L = { W: W, H: H, cx: cx, cy: cy, R: R, Rg: Rg, side: side, pad: pad, dpr: L.dpr };
      var stripTop = Math.min(H - stripH, cy + Math.max(R + 34, mind / 2 + 2));
      thumbsBox.style.top = stripTop + 'px';
      thumbsBox.style.justifyContent = side ? 'center' : 'flex-end';
      thumbsBox.style.paddingRight = side ? '0' : (pad - 4) + 'px';
      var hr = R + (touchy ? 22 : 12);
      hit.style.left = (cx - hr) + 'px';
      hit.style.top = (cy - hr) + 'px';
      hit.style.width = hit.style.height = (2 * hr) + 'px';
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      if (AM.fitCanvas) AM.fitCanvas(canvas, maxDpr);
      else { canvas.width = W; canvas.height = H; }
      L.dpr = canvas.width / W;
      placeNotes(stripTop, stripH);
    }

    function setBox(n, left, top, right, center) {
      var s = n.el.style;
      s.transform = center ? 'translateX(-50%)' : 'none';
      if (right != null) { s.left = 'auto'; s.right = right + 'px'; n.el.classList.add('is-right'); }
      else { s.right = 'auto'; s.left = left + 'px'; n.el.classList.remove('is-right'); }
      s.top = top + 'px';
    }

    function noteSize(n) { return { w: n.el.offsetWidth, h: n.el.offsetHeight }; }

    function slitAngleNear(target) {
      var d = disc();
      var s = TAU / d.n;
      var k = Math.round((target - d.phase) / s);
      return d.phase + k * s;
    }

    function placeNotes(stripTop, stripH) {
      var cx = L.cx, cy = L.cy, R = L.R, Rg = L.Rg, W = L.W, pad = L.pad;
      setIdText();
      var aEye = GAUGE_FROM + (EYE_F / F_MAX) * GAUGE_SPAN;
      var aShut = slitAngleNear(-0.7);
      var eyeA = polar(cx, cy, Rg + 12, aEye);
      var shutA = polar(cx, cy, R + 7, aShut);
      var sz;
      if (L.side) {
        setBox(notes.read, cx, cy + R + Math.max(10, (L.Rg - R) + 4), null, true);
        notes.read.line = null;
        var aId = Math.PI * 0.83;
        var idA = polar(cx, cy, R, aId);
        var idE = polar(cx, cy, Rg + 30, aId);
        sz = noteSize(notes.id);
        setBox(notes.id, 0, idE.y - sz.h / 2, W - (idE.x - 34));
        notes.id.line = [idA, idE, { x: idE.x - 28, y: idE.y }];
        var eyeE = polar(cx, cy, Rg + 40, aEye);
        sz = noteSize(notes.eye);
        setBox(notes.eye, 0, eyeE.y - sz.h / 2, W - (eyeE.x - 34));
        notes.eye.line = [eyeA, eyeE, { x: eyeE.x - 28, y: eyeE.y }];
        var shutE = polar(cx, cy, Rg + 40, aShut);
        sz = noteSize(notes.shut);
        setBox(notes.shut, shutE.x + 34, shutE.y - sz.h / 2);
        notes.shut.line = [shutA, shutE, { x: shutE.x + 28, y: shutE.y }];
        var hEnd = -0.42;
        var hE = polar(cx, cy, Rg + 30, hEnd);
        sz = noteSize(notes.hint);
        setBox(notes.hint, hE.x + 22, hE.y - sz.h / 2 + 4);
        hintArc = { r: Rg + 16, a0: -1.25, a1: hEnd };
        notes.hint.line = null;
      } else {
        var topY = Math.max(pad, cy - Rg - 70);
        setBox(notes.read, pad, topY);
        notes.read.line = null;
        sz = noteSize(notes.read);
        var eyeTop = topY + sz.h + 6;
        setBox(notes.eye, pad, eyeTop);
        var esz = noteSize(notes.eye);
        var eyeT = { x: pad + esz.w + 6, y: eyeTop + esz.h * 0.72 };
        notes.eye.line = [eyeA, eyeT];
        var ssz = noteSize(notes.shut);
        setBox(notes.shut, 0, topY, pad);
        var shutT = { x: W - pad - ssz.w - 6, y: topY + ssz.h * 0.72 };
        notes.shut.line = [shutA, shutT];
        var hsz = noteSize(notes.hint);
        setBox(notes.hint, 0, topY, pad);
        hintArc = { r: Rg + 12, a0: -1.45, a1: -0.85 };
        notes.hint.line = null;
        var isz = noteSize(notes.id);
        var idTop = stripTop + (stripH - isz.h) / 2;
        setBox(notes.id, pad, idTop);
        var midY = idTop + isz.h * 0.5;
        var tx = pad + isz.w + 8;
        var ax = Math.max(tx + 18, cx - R * 0.5);
        var aIdc = Math.acos(clamp((ax - cx) / R, -0.98, 0.98));
        var idAc = polar(cx, cy, R, aIdc);
        notes.id.line = [idAc, { x: idAc.x, y: midY }, { x: tx, y: midY }];
        void hsz;
      }
    }

    function setDisc(i) {
      i = ((i % discs.length) + discs.length) % discs.length;
      if (!discs.length || i === cur || flip) return;
      loadImage(i);
      touched = true;
      flip = { t: 0, from: cur, to: i, swapped: false };
    }

    function stepFlip(dt) {
      if (!flip) return;
      flip.t += dt;
      var T = 0.82;
      var p = clamp(flip.t / T, 0, 1);
      var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      flip.psi = e * TAU;
      if (!flip.swapped && flip.psi >= Math.PI * 1.5) {
        if (!imgOf(flip.to)) { flip.t -= dt; flip.psi = Math.PI * 1.49; return; }
        flip.swapped = true;
        cur = flip.to;
        lastIdx = Math.round(theta / slitStep());
        markThumbs();
        layout();
      }
      if (p >= 1) flip = null;
    }

    function handVelocity(now) {
      var M = grab.samples;
      var last = M[M.length - 1];
      var j = M.length - 1;
      while (j > 0 && last.t - M[j - 1].t <= 100) j--;
      if (j === M.length - 1 && j > 0 && last.t - M[j - 1].t < 260) j--;
      var first = M[j];
      var span = last.t - first.t;
      if (span < 6) return 0;
      var v = (last.h - first.h) / (span / 1000);
      return v * (1 - smooth(55, 170, now - last.t));
    }

    function pushSample(now) {
      grab.samples.push({ t: now, h: grab.hand });
      while (grab.samples.length > 3 && now - grab.samples[0].t > 320) grab.samples.shift();
    }

    function localPoint(e) {
      var b = root.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    }

    function onDown(e) {
      if (grab || flip) return;
      var p = localPoint(e);
      var dx = p.x - L.cx, dy = p.y - L.cy;
      var r = Math.hypot(dx, dy);
      if (r > L.R + (touchy ? 24 : 14)) return;
      e.preventDefault();
      try { hit.setPointerCapture(e.pointerId); } catch (err) {}
      hit.classList.add('is-grab');
      var now = performance.now();
      grab = {
        id: e.pointerId, phi: Math.atan2(dy, dx), r: r, hand: theta, offset: 0,
        slip: Math.abs(omega) > 0.4 ? 0.15 : 0, slipT: 0, wh: 0, samples: [], downT: now, moved: 0, lastMove: now
      };
      pushSample(now);
      press.target = 0.985;
      touched = true;
      idleT = 0;
    }

    function onMove(e) {
      if (!grab || e.pointerId !== grab.id) return;
      var p = localPoint(e);
      var dx = p.x - L.cx, dy = p.y - L.cy;
      var r = Math.hypot(dx, dy);
      var phi = Math.atan2(dy, dx);
      var lever = smooth(L.R * 0.03, L.R * 0.14, r);
      var d = wrap(phi - grab.phi) * lever;
      grab.phi = phi;
      grab.r = r;
      grab.hand += d;
      grab.moved += Math.abs(d) * Math.max(r, 1);
      var now = performance.now();
      if (Math.abs(d) > 0.002) grab.lastMove = now;
      pushSample(now);
    }

    function onUp(e) {
      if (!grab || e.pointerId !== grab.id) return;
      var now = performance.now();
      var v = handVelocity(now);
      if (grab.slipT < grab.slip) v = omega + (v - omega) * clamp(grab.slipT / grab.slip, 0, 1);
      var lim = F_MAX * slitStep();
      omega = clamp(v, -lim, lim);
      grab = null;
      hit.classList.remove('is-grab');
      press.target = 1;
      try { hit.releasePointerCapture(e.pointerId); } catch (err) {}
    }

    function onHover(e) {
      if (e.pointerType !== 'mouse' || grab) return;
      var p = localPoint(e);
      var dx = (p.x - L.cx) / L.R, dy = (p.y - L.cy) / L.R;
      var m = Math.hypot(dx, dy);
      var k = m > 1.6 ? 0 : m > 1 ? 1 - (m - 1) / 0.6 : 1;
      var lim = Math.min(1, m);
      var s = m > 0 ? lim / m : 0;
      tilt.tx = dx * s * k;
      tilt.ty = dy * s * k;
    }

    function onLeave() { tilt.tx = 0; tilt.ty = 0; }

    hit.addEventListener('pointerdown', onDown);
    hit.addEventListener('pointermove', onMove);
    hit.addEventListener('pointerup', onUp);
    hit.addEventListener('pointercancel', onUp);
    hit.addEventListener('lostpointercapture', function (e) { if (grab && e.pointerId === grab.id) onUp(e); });
    root.addEventListener('pointermove', onHover);
    root.addEventListener('pointerleave', onLeave);

    function stepPhysics(dt, now) {
      var s = slitStep();
      var lim = F_MAX * s;
      if (introT >= 0) introT += dt;
      if (grab) {
        var wh = handVelocity(performance.now());
        grab.wh = wh;
        if (grab.slipT < grab.slip) {
          grab.slipT += dt;
          omega += (wh - omega) * ease(dt, 0.045);
          theta += omega * dt;
          grab.offset = theta - grab.hand;
          if (Math.abs(omega - wh) < 0.3) grab.slip = grab.slipT;
        } else {
          theta = grab.hand + grab.offset;
          omega += (clamp(wh, -lim, lim) - omega) * ease(dt, 0.04);
        }
        if (now - grab.downT > 450 && now - grab.lastMove > 350) press.target = 0.977;
        else press.target = 0.985;
        idleT = 0;
        return;
      }
      if (flip) { omega *= Math.exp(-dt / 0.12); theta += omega * dt; idleT = 0; return; }
      if (introT >= 0.32 && introT < 0.78 && !touched && !reduced) {
        omega += (15 * s - omega) * ease(dt, 0.11);
      }
      var f = omega / s;
      if (f !== 0) {
        var sg = f > 0 ? 1 : -1;
        var nf = f - (KV * f + CF * sg) * dt;
        if (nf * sg <= 0) nf = 0;
        omega = clamp(nf * s, -lim, lim);
      }
      theta += omega * dt;
      if (omega === 0) idleT += dt; else idleT = 0;
    }

    function stepSprings(dt) {
      var k = 520, c = 26;
      var a = -k * (press.v - press.target) - c * press.vel;
      press.vel += a * dt;
      press.v += press.vel * dt;
      var kt = 90, ct = 2 * Math.sqrt(kt) * 0.85;
      tilt.vx += (-kt * (tilt.x - tilt.tx) - ct * tilt.vx) * dt;
      tilt.vy += (-kt * (tilt.y - tilt.ty) - ct * tilt.vy) * dt;
      tilt.x += tilt.vx * dt;
      tilt.y += tilt.vy * dt;
    }

    function noteTargets(f, m) {
      var introDone = introT > (reduced ? 0.9 : 5.2) || touched;
      notes.read.t = appear > 0.6 ? 1 : 0;
      notes.id.t = appear > 0.8 && !flip ? 1 : 0;
      notes.shut.t = m > 0.6 ? 1 : 0;
      notes.eye.t = (f > 9.5 && f < 19) ? 1 : 0;
      notes.hint.t = (!touched && introDone && Math.abs(omega) < 0.05) ? 1 : 0;
      if (!L.side && notes.shut.t > 0) notes.hint.t = 0;
    }

    function updateNotes(dt) {
      for (var key in notes) {
        var n = notes[key];
        var na = n.a + (n.t - n.a) * ease(dt, n.t > n.a ? 0.16 : 0.22);
        if (Math.abs(n.t - na) < 0.01) na = n.t;
        if (na !== n.a) {
          n.a = na;
          n.el.style.opacity = n.a.toFixed(3);
        }
      }
      var f = fps();
      var txt = (Math.round(f * 10) / 10).toFixed(1);
      if (txt !== readTxt) {
        readTxt = txt;
        noteRead.innerHTML = '초당 <em>' + txt + '</em>장';
      }
    }

    function drawLine(pts, alpha, color) {
      if (!pts || alpha <= 0.01) return;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color || col.line2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.fillStyle = color || col.ink;
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, 2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawGauge(f, reveal) {
      var cx = L.cx, cy = L.cy, Rg = L.Rg;
      var end = GAUGE_FROM + GAUGE_SPAN * reveal;
      ctx.lineWidth = 1;
      ctx.strokeStyle = col.line2;
      ctx.beginPath();
      ctx.arc(cx, cy, Rg, GAUGE_FROM, end);
      ctx.stroke();
      var on = clamp(f / F_MAX, 0, 1);
      var minorPath = new Path2D();
      var majorPath = new Path2D();
      var onPath = new Path2D();
      for (var i = 0; i <= F_MAX; i++) {
        var q = i / F_MAX;
        if (q > reveal + 1e-6) break;
        var a = GAUGE_FROM + GAUGE_SPAN * q;
        var major = i % 6 === 0;
        var len = major ? 7 : 3.5;
        var c = Math.cos(a), sn = Math.sin(a);
        var p = q <= on + 1e-6 && f > 0.05 ? onPath : major ? majorPath : minorPath;
        p.moveTo(cx + c * Rg, cy + sn * Rg);
        p.lineTo(cx + c * (Rg + len), cy + sn * (Rg + len));
      }
      ctx.strokeStyle = col.line;
      ctx.stroke(minorPath);
      ctx.strokeStyle = col.line2;
      ctx.stroke(majorPath);
      ctx.strokeStyle = col.blue;
      ctx.stroke(onPath);
      if (f > 0.05) {
        var ae = GAUGE_FROM + GAUGE_SPAN * on;
        ctx.beginPath();
        ctx.arc(cx, cy, Rg, GAUGE_FROM, ae);
        ctx.stroke();
        var c2 = Math.cos(ae), s2 = Math.sin(ae);
        ctx.beginPath();
        ctx.moveTo(cx + c2 * (Rg - 5), cy + s2 * (Rg - 5));
        ctx.lineTo(cx + c2 * (Rg + 11), cy + s2 * (Rg + 11));
        ctx.stroke();
      }
      if (reveal >= EYE_F / F_MAX) {
        var ar = GAUGE_FROM + GAUGE_SPAN * (EYE_F / F_MAX);
        ctx.fillStyle = col.red;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ar) * (Rg + 12), cy + Math.sin(ar) * (Rg + 12), 1.8, 0, TAU);
        ctx.fill();
      }
    }

    function drawHint(alpha, now) {
      if (!hintArc || alpha <= 0.01) return;
      var cx = L.cx, cy = L.cy, h = hintArc;
      var cyc = ((now / 1000) % 3.2) / 3.2;
      var grow = smooth(0, 0.45, cyc);
      var fade = 1 - smooth(0.75, 1, cyc);
      var a1 = h.a0 + (h.a1 - h.a0) * grow;
      ctx.globalAlpha = alpha * fade;
      ctx.strokeStyle = col.blue;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, h.r, h.a0, a1);
      ctx.stroke();
      var tip = polar(cx, cy, h.r, a1);
      var tang = a1 + Math.PI / 2;
      var back = { x: tip.x - Math.cos(tang) * 7, y: tip.y - Math.sin(tang) * 7 };
      var nx = Math.cos(a1) * 3.5, ny = Math.sin(a1) * 3.5;
      ctx.beginPath();
      ctx.moveTo(back.x + nx, back.y + ny);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(back.x - nx, back.y - ny);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawSlitTicks(alpha, R) {
      if (alpha <= 0.01) return;
      var d = disc();
      var s = TAU / d.n;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = col.blue;
      ctx.lineWidth = 1 / Math.max(press.v, 0.5);
      ctx.beginPath();
      for (var k = 0; k < d.n; k++) {
        var a = d.phase + k * s;
        var c = Math.cos(a), sn = Math.sin(a);
        ctx.moveTo(c * (R + 3), sn * (R + 3));
        ctx.lineTo(c * (R + 10), sn * (R + 10));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawShadow(lift, flipW) {
      var R = L.R;
      var ox = -tilt.x * R * 0.025, oy = R * 0.03 - tilt.y * R * 0.02 + lift * R * 0.06;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.translate(L.cx + ox, L.cy + oy);
      ctx.scale(Math.max(0.3, flipW) * (1 + lift * 0.05), 0.985);
      var g = ctx.createRadialGradient(0, 0, R * 0.78, 0, 0, R * (1.07 + lift * 0.08));
      var a = 0.085 * appear * (1 - lift * 0.45);
      g.addColorStop(0, 'rgba(22,22,26,' + a.toFixed(3) + ')');
      g.addColorStop(0.55, 'rgba(22,22,26,' + (a * 0.55).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(22,22,26,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R * (1.07 + lift * 0.08), 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    function drawImageAt(img, ang, alpha, S) {
      ctx.globalAlpha = alpha;
      ctx.rotate(ang);
      ctx.drawImage(img, -S / 2, -S / 2, S, S);
      ctx.rotate(-ang);
    }

    function render(now, dt) {
      var W = L.W, H = L.H, R = L.R, cx = L.cx, cy = L.cy;
      var dpr = canvas.width / W;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var it = introT < 0 ? 0 : introT;
      var reveal = reduced ? 1 : smooth(0.0, 0.7, it);
      var s = slitStep();
      var f = fps();
      var m = smooth(SHUT_LO, SHUT_HI, f);
      var idx = Math.round(theta / s);
      if (m > 0.5 && !shutOn) { shutOn = true; flash = 1; }
      if (m < 0.3) shutOn = false;
      if (m > 0.5 && idx !== lastIdx) flash = Math.max(flash, 0.35);
      lastIdx = idx;
      flash *= Math.exp(-dt / 0.22);

      var psi = flip ? flip.psi || 0 : 0;
      var flipC = Math.cos(psi);
      var flipW = Math.max(0.002, Math.abs(flipC));
      var lift = flip ? Math.sin(psi / 2) : 0;
      var breathe = (!grab && !flip && omega === 0 && !reduced) ? smooth(0.6, 2.2, idleT) * 0.0035 * Math.sin(breathT * TAU / 5.2) : 0;

      drawGauge(f, reveal);

      if (!ready) {
        ctx.strokeStyle = col.line2;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * reveal);
        ctx.stroke();
        return;
      }

      drawShadow(lift, flipW);

      var tm = Math.hypot(tilt.x, tilt.y);
      var ta = Math.atan2(tilt.y, tilt.x);
      ctx.save();
      ctx.translate(cx + tilt.x * 3, cy + tilt.y * 3);
      if (tm > 0.002) {
        ctx.rotate(ta);
        ctx.scale(1 - 0.024 * Math.min(1, tm), 1);
        ctx.rotate(-ta);
      }
      var sc = press.v * (1 + lift * 0.06) * (0.965 + 0.035 * appear);
      ctx.scale(sc * flipW, sc);

      var d = disc();
      var img = imgOf(cur);
      var S = 2 * R / d.fit;
      if (flip && flipC < 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#d9ccb0';
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(22,22,26,0.18)';
        ctx.lineWidth = 1 / Math.max(0.05, sc * flipW);
        ctx.stroke();
        ctx.fillStyle = 'rgba(22,22,26,0.22)';
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.012, 0, TAU);
        ctx.fill();
      } else if (img) {
        var thetaDraw = theta + breathe;
        var thetaQ = idx * s;
        var base = appear;
        if (m < 1) {
          var expo = 1 / 60;
          var sweep = Math.abs(omega) * expo;
          var k = clamp(Math.ceil(sweep * R / 2.5), 1, maxBlur);
          if (k <= 1) {
            drawImageAt(img, thetaDraw, base, S);
          } else {
            var acc = 0;
            for (var q = k - 1; q >= 0; q--) {
              var wq = 1 - q / k;
              acc += wq;
              drawImageAt(img, thetaDraw - omega * expo * (q / (k - 1)), base * wq / acc, S);
            }
          }
        }
        if (m > 0) drawImageAt(img, thetaQ, base * m, S);
        drawSlitTicks((0.55 * flash + 0.22 * m) * base, R);
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      drawLine(notes.id.line, notes.id.a * 0.9, col.line2);
      drawLine(notes.eye.line, notes.eye.a, col.red);
      drawLine(notes.shut.line, notes.shut.a, col.blue);
      drawHint(notes.hint.a, now);
    }

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;
      if (!perf.done && ready) {
        perf.n++;
        if (perf.n > 5) perf.sum += dt;
        if (perf.n >= 65) {
          perf.done = true;
          if (perf.sum / 60 > 0.022) { maxBlur = 3; maxDpr = 1.5; layout(); }
        }
      }
      if (ready && introT < 0) introT = 0;
      if (ready) appear = reduced ? 1 : Math.min(1, appear + dt / 0.55);
      breathT += dt;
      stepFlip(dt);
      stepPhysics(dt, now);
      stepSprings(dt);
      var f = fps();
      noteTargets(f, smooth(SHUT_LO, SHUT_HI, f));
      updateNotes(dt);
      render(now, dt);
    }

    function resume() {
      if (running) return;
      running = true;
      started = true;
      lastNow = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function pause() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (grab) { grab = null; hit.classList.remove('is-grab'); press.target = 1; }
    }

    var ro = new ResizeObserver(function () { layout(); });
    ro.observe(root);

    function boot(list) {
      discs = list && list.length ? list : FALLBACK;
      buildThumbs();
      setIdText();
      layout();
      loadImage(0).then(function () {
        ready = !!imgOf(0);
        if (!ready) return;
        discs.forEach(function (d, i) { if (i) loadImage(i); });
      });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    }

    discs = FALLBACK;
    setIdText();
    layout();
    fetch(BASE + 'discs.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(boot);

    return {
      pause: pause,
      resume: resume,
      setDisc: function (i) { setDisc(i); }
    };
  }

  window.AM = window.AM || {};
  window.AM.scenes = window.AM.scenes || {};
  window.AM.scenes.disc = mountDisc;
})();
