(function () {
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  var DEFAULT_ANG = Math.atan2(-0.62, -0.78);
  var BASE = 0.55;
  var LEN = 2.4;

  var VERT = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';

  var FRAG = [
    'precision highp float;',
    'uniform sampler2D uTex;',
    'uniform vec2 uRes;',
    'uniform vec2 uGrid;',
    'uniform vec2 uOrigin;',
    'uniform float uSp;',
    'uniform vec2 uLight;',
    'uniform float uRef;',
    'uniform float uLen;',
    'uniform float uDark;',
    'uniform vec3 uBoard;',
    'uniform vec3 uHead;',
    'uniform vec3 uInk;',
    'float hAt(vec2 c){vec2 a=step(vec2(0.0),c)*step(c,uGrid-1.0);return texture2D(uTex,(c+0.5)/uGrid).r*a.x*a.y;}',
    'void main(){',
    ' vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);',
    ' vec2 g=(p-uOrigin)/uSp;',
    ' vec2 cell=floor(g);',
    ' vec2 f=g-cell-0.5;',
    ' vec2 ig=step(vec2(0.0),cell)*step(cell,uGrid-1.0);',
    ' float hs=hAt(cell);',
    ' float aa=1.0/uSp;',
    ' float rh=0.31;',
    ' float dh=length(f);',
    ' float head=(1.0-smoothstep(rh-aa,rh+aa,dh))*ig.x*ig.y;',
    ' float z=head>0.5?hs:0.0;',
    ' vec2 tp=g-uLight;',
    ' float dl=length(tp);',
    ' vec2 dir=tp/dl;',
    ' float sc=uLen*mix(1.0,dl/uRef,0.4);',
    ' vec2 sg=vec2(dir.x<0.0?-1.0:1.0,dir.y<0.0?-1.0:1.0);',
    ' float occ=0.0;',
    ' for(int j=0;j<6;j++){for(int i=0;i<6;i++){',
    '  vec2 c=cell-sg*vec2(float(i)-1.0,float(j)-1.0);',
    '  float rise=hAt(c)-z;',
    '  if(rise>0.004){',
    '   vec2 v=g-c-0.5;',
    '   float t=clamp(dot(v,dir),0.0,rise*sc);',
    '   float d=length(v-dir*t);',
    '   float pen=0.06+0.15*t;',
    '   float o=(1.0-smoothstep(0.31-pen,0.31+pen,d))*smoothstep(0.0,0.12,rise)*(1.0-0.34*t/sc);',
    '   occ=max(occ,o);',
    '  }',
    ' }}',
    ' vec2 nf=f/max(dh,0.0001);',
    ' float fc=dot(nf,-dir);',
    ' float dome=smoothstep(0.04,0.4,hs);',
    ' float ek=smoothstep(0.2,1.0,dh/rh);',
    ' float hsh=1.0+dome*ek*(0.05*max(fc,0.0)-0.36*max(-fc,0.0));',
    ' float rim=smoothstep(rh-2.2*aa,rh-0.2*aa,dh);',
    ' float lamp=1.0-0.08*smoothstep(0.7,1.4,dl/uRef);',
    ' float lit=(1.0-occ*uDark)*mix(1.0,hsh*(1.0-rim*(0.07+0.13*hs)),head)*lamp;',
    ' vec3 base=mix(uBoard,uHead,head);',
    ' float a=clamp(1.0-lit,0.0,1.0);',
    ' vec3 col=base*(1.0-a*(1.0-uInk))*max(lit,1.0);',
    ' gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function wrapAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }
  function rgb(str, fallback) {
    var m = /^#([0-9a-f]{6})$/i.exec((str || '').trim());
    var h = m ? m[1] : fallback;
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function ensureCss() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) if (/pins\.css(\?|$)/.test(links[i].href)) return;
    if (!SCRIPT_SRC) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('pins.css', SCRIPT_SRC).href;
    document.head.appendChild(l);
  }
  function fmt(v) { return v.toLocaleString('ko-KR'); }

  function mountPins(root, opts) {
    opts = opts || {};
    var AMr = window.AM || {};
    var reduced = opts.reducedMotion != null ? !!opts.reducedMotion : !!AMr.reducedMotion;
    var coarse = opts.isTouch != null ? !!opts.isTouch : !!AMr.isTouch;
    ensureCss();

    var wrap = el('div', 'am-pins', root);
    var meter = el('div', 'am-pins-meter', wrap);
    var countEl = el('span', 'am-pins-count', meter);
    var lightEl = el('span', 'am-pins-light', meter);
    var ticks = '';
    for (var a = 0; a < 12; a++) {
      var ang = a * Math.PI / 6, r1 = a % 3 === 0 ? 5.4 : 6.9;
      ticks += '<line x1="' + (Math.sin(ang) * r1).toFixed(2) + '" y1="' + (-Math.cos(ang) * r1).toFixed(2) + '" x2="' + (Math.sin(ang) * 8.5).toFixed(2) + '" y2="' + (-Math.cos(ang) * 8.5).toFixed(2) + '"/>';
    }
    lightEl.innerHTML = '<svg class="am-pins-dial" width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true"><g stroke="currentColor" stroke-opacity="0.45" stroke-width="0.8" fill="none"><circle r="8.5"/>' + ticks + '</g><g class="am-pins-needle"><line x1="0" y1="0" x2="0" y2="-8.5" style="stroke:var(--blue,#2b5fd9)" stroke-width="1"/><circle cx="0" cy="-8.5" r="1.4" style="fill:var(--blue,#2b5fd9)"/></g><circle r="1" fill="currentColor"/></svg><span class="am-pins-deg"></span>';
    var needle = lightEl.querySelector('.am-pins-needle');
    var degEl = lightEl.querySelector('.am-pins-deg');
    var stage = el('div', 'am-pins-stage', wrap);
    var canvas = el('canvas', 'am-pins-canvas', stage);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '핀스크린 판 — 누르거나 끌어 그림을 그린다');
    var noteLayer = el('div', 'am-pins-note', stage);
    var bar = el('div', 'am-pins-bar', wrap);
    function button(label) {
      var b = el('button', 'am-pins-btn', bar);
      b.type = 'button';
      el('span', '', b).textContent = label;
      return b;
    }
    var btnPush = button('누르기');
    var btnPull = button('당기기');
    el('span', 'am-pins-sep', bar);
    var btnShake = button('판 흔들기');
    var btnTilt = button('기울여 보기');
    btnTilt.hidden = true;
    var hint = el('span', 'am-pins-hint', bar);
    hint.textContent = coarse ? '두 번 톡 · 물결' : 'Shift·우클릭 당기기 · 더블클릭 물결';

    var cssv = AMr.cssVar || function () { return ''; };
    var paper = rgb(cssv('--paper'), 'f6f4ef');
    var paper3 = rgb(cssv('--paper-3'), 'e2ddd2');
    var ink = rgb(cssv('--ink'), '16161a');
    var boardCol = mixRgb(paper, paper3, 0.28);
    var headCol = mixRgb(paper, [1, 1, 1], 0.15);

    var gl = null, ctx2 = null, prog = null, tex = null, U = {}, texW = 0, texH = 0, glLost = false;

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    function initGL() {
      var attrs = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
      gl = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
      if (!gl) return false;
      var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) { gl = null; return false; }
      prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
      gl.useProgram(prog);
      var vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      ['uTex', 'uRes', 'uGrid', 'uOrigin', 'uSp', 'uLight', 'uRef', 'uLen', 'uDark', 'uBoard', 'uHead', 'uInk'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
      gl.uniform1i(U.uTex, 0);
      gl.uniform3fv(U.uBoard, boardCol);
      gl.uniform3fv(U.uHead, headCol);
      gl.uniform3fv(U.uInk, ink);
      gl.uniform1f(U.uDark, 0.6);
      texW = texH = 0;
      return true;
    }
    if (!initGL()) ctx2 = canvas.getContext('2d');
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); glLost = true; });
    canvas.addEventListener('webglcontextrestored', function () { glLost = false; initGL(); });

    var W = 0, H = 0, sp = 10, ox = 0, oy = 0, cols = 0, rows = 0, n = 0;
    var maxDpr = 2, spacingBoost = 1;
    var tgt, hx, hv, rest, kk, cc, wu, wv, bytes, cover = null;
    var introCol, introLetter;
    var waveOn = false;
    var lightAng = DEFAULT_ANG, lenScale = 1;
    var mode = 'push';
    var pointers = new Map();
    var hover = { on: false, x: 0, y: 0 };
    var running = false, raf = 0, last = 0, needLayout = true;
    var intro = { started: false, active: false, t: 0, maskT: -1, lettersDone: false };
    var fontReady = false;
    var meterT = 0, lastTxt = '', lastDeg = -1;
    var idleAcc = 0;

    function regrid(nc, nr) {
      var old = n ? { cols: cols, rows: rows, tgt: tgt, hx: hx } : null;
      cols = nc; rows = nr; n = nc * nr;
      tgt = new Float32Array(n); hx = new Float32Array(n); hv = new Float32Array(n); rest = new Float32Array(n);
      kk = new Float32Array(n); cc = new Float32Array(n); wu = new Float32Array(n); wv = new Float32Array(n);
      bytes = new Uint8Array(n);
      for (var i = 0; i < n; i++) {
        rest[i] = BASE + (Math.random() - 0.5) * 0.05;
        var w = 16 * (0.82 + Math.random() * 0.36);
        kk[i] = w * w;
        cc[i] = 2 * 0.3 * w;
      }
      if (old) {
        for (var j = 0; j < nr; j++) {
          for (var q = 0; q < nc; q++) {
            var sx = clamp((q + 0.5) / nc * old.cols - 0.5, 0, old.cols - 1), sy = clamp((j + 0.5) / nr * old.rows - 0.5, 0, old.rows - 1);
            var x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(old.cols - 1, x0 + 1), y1 = Math.min(old.rows - 1, y0 + 1), fx = sx - x0, fy = sy - y0;
            var a00 = y0 * old.cols + x0, a10 = y0 * old.cols + x1, a01 = y1 * old.cols + x0, a11 = y1 * old.cols + x1;
            var k = j * nc + q;
            tgt[k] = (old.tgt[a00] * (1 - fx) + old.tgt[a10] * fx) * (1 - fy) + (old.tgt[a01] * (1 - fx) + old.tgt[a11] * fx) * fy;
            hx[k] = (old.hx[a00] * (1 - fx) + old.hx[a10] * fx) * (1 - fy) + (old.hx[a01] * (1 - fx) + old.hx[a11] * fx) * fy;
          }
        }
      } else {
        for (i = 0; i < n; i++) { tgt[i] = rest[i]; hx[i] = rest[i] + (Math.random() - 0.5) * 0.08; }
      }
      introCol = new Float32Array(nc);
      introLetter = new Uint8Array(nc);
      var front = introFront();
      for (var c = 0; c < nc; c++) {
        introCol[c] = intro.started && c + 0.5 < front ? intro.t : -1;
        introLetter[c] = intro.lettersDone ? 1 : 0;
      }
      cover = null;
      waveOn = false;
    }

    function layout() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (w < 8 || h < 8) return false;
      if (AMr.fitCanvas) AMr.fitCanvas(canvas, maxDpr);
      else {
        var d = Math.min(window.devicePixelRatio || 1, maxDpr);
        canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
      }
      W = w; H = h;
      var base = (coarse ? 8 : 9.5) * spacingBoost;
      var maxPins = coarse ? 5200 : 15000;
      var s = Math.max(base, Math.sqrt(w * h / maxPins));
      var nc = Math.max(4, Math.floor(w / s)), nr = Math.max(4, Math.floor(h / s));
      if (nc !== cols || nr !== rows) regrid(nc, nr);
      sp = s;
      ox = (w - cols * s) / 2;
      oy = (h - rows * s) / 2;
      return true;
    }

    function brushPx(st) { return st && st.touch ? 40 : 34; }
    function toGrid(x, y) { return { x: (x - ox) / sp, y: (y - oy) / sp }; }

    function stamp(x0, y0, x1, y1, R, amount, pull) {
      if (!n || R <= 0 || amount <= 0) return;
      var i0 = Math.max(0, Math.floor(Math.min(x0, x1) - R)), i1 = Math.min(cols - 1, Math.ceil(Math.max(x0, x1) + R));
      var j0 = Math.max(0, Math.floor(Math.min(y0, y1) - R)), j1 = Math.min(rows - 1, Math.ceil(Math.max(y0, y1) + R));
      var dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy, inner = R * 0.32;
      for (var j = j0; j <= j1; j++) {
        for (var i = i0; i <= i1; i++) {
          var px = i + 0.5, py = j + 0.5;
          var t = l2 > 1e-6 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          var qx = x0 + dx * t - px, qy = y0 + dy * t - py;
          var d = Math.sqrt(qx * qx + qy * qy);
          if (d >= R) continue;
          var w = d <= inner ? 1 : 1 - smooth((d - inner) / (R - inner));
          var k = j * cols + i, old = tgt[k];
          var e = Math.exp(-amount * w);
          var nv = pull ? 1 - (1 - old) * e : old * e;
          tgt[k] = nv;
          hv[k] += (nv - old) * 10;
        }
      }
    }

    function nudge(x0, y0, x1, y1, R, amp, toWave) {
      if (!n) return;
      var i0 = Math.max(0, Math.floor(Math.min(x0, x1) - R)), i1 = Math.min(cols - 1, Math.ceil(Math.max(x0, x1) + R));
      var j0 = Math.max(0, Math.floor(Math.min(y0, y1) - R)), j1 = Math.min(rows - 1, Math.ceil(Math.max(y0, y1) + R));
      var dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
      for (var j = j0; j <= j1; j++) {
        for (var i = i0; i <= i1; i++) {
          var px = i + 0.5, py = j + 0.5;
          var t = l2 > 1e-6 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          var qx = x0 + dx * t - px, qy = y0 + dy * t - py;
          var d = Math.sqrt(qx * qx + qy * qy);
          if (d >= R) continue;
          var w = 1 - smooth(d / R);
          if (toWave) { wv[j * cols + i] += amp * w; waveOn = true; }
          else hv[j * cols + i] += amp * w;
        }
      }
    }

    function introFront() {
      var k = clamp(intro.t / 1.25, 0, 1);
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      return (-0.1 + 1.25 * e) * cols;
    }

    function buildMask() {
      var ss = 4, cw = cols * ss, ch = rows * ss;
      var cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      var c = cv.getContext('2d', { willReadFrequently: true });
      c.fillStyle = '#000';
      c.fillRect(0, 0, cw, ch);
      var family = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      var two = W / H < 0.95 || W < 560;
      var lines = two ? ['애니메이션', '박물관'] : ['애니메이션박물관'];
      c.font = '800 100px ' + family;
      var widest = 1;
      lines.forEach(function (l) { widest = Math.max(widest, c.measureText(l).width); });
      var lh = 1.16;
      var fsz = 100 * (W * (two ? 0.7 : 0.67)) / widest;
      fsz = Math.min(fsz, H * (two ? 0.62 : 0.42) / (1 + (lines.length - 1) * lh));
      var unit = ss / sp;
      c.font = '800 ' + (fsz * unit).toFixed(2) + 'px ' + family;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#fff';
      c.strokeStyle = '#fff';
      c.lineJoin = 'round';
      c.lineWidth = Math.max(0.5 * ss, fsz * unit * 0.045);
      var cx = (W / 2 - ox) * unit, cy = (H / 2 - oy) * unit;
      lines.forEach(function (l, k) {
        var y = cy + (k - (lines.length - 1) / 2) * fsz * lh * unit + fsz * unit * 0.03;
        c.fillText(l, cx, y);
        c.strokeText(l, cx, y);
      });
      var data = c.getImageData(0, 0, cw, ch).data;
      cover = new Float32Array(n);
      var norm = 1 / (ss * ss * 255);
      for (var j = 0; j < rows; j++) {
        for (var i = 0; i < cols; i++) {
          var s = 0;
          for (var yy = 0; yy < ss; yy++) {
            var rowOff = ((j * ss + yy) * cw + i * ss) * 4;
            for (var xx = 0; xx < ss; xx++) s += data[rowOff + xx * 4];
          }
          cover[j * cols + i] = s * norm;
        }
      }
      intro.maskT = intro.t;
    }

    function startIntro() {
      intro.started = true;
      intro.active = true;
      intro.t = 0;
      for (var c = 0; c < cols; c++) { introCol[c] = -1; introLetter[c] = 0; }
    }

    function introStep(dt) {
      intro.t += dt;
      if (!cover && (fontReady || intro.t > 1.6)) buildMask();
      var front = introFront();
      var kick = reduced ? 0 : 1;
      var c, r, k;
      for (c = 0; c < cols; c++) {
        if (introCol[c] < 0 && c + 0.5 < front) {
          introCol[c] = intro.t;
          for (r = 0; r < rows; r++) {
            k = r * cols + c;
            tgt[k] = rest[k];
            hv[k] += kick * (3.4 + Math.random() * 1.8);
          }
        }
      }
      if (cover) {
        var done = true;
        for (c = 0; c < cols; c++) {
          if (introLetter[c]) continue;
          if (introCol[c] >= 0 && intro.t >= Math.max(introCol[c] + 0.1, intro.maskT + 0.3 * c / cols)) {
            introLetter[c] = 1;
            for (r = 0; r < rows; r++) {
              k = r * cols + c;
              var cv = cover[k];
              if (cv > 0.01) {
                tgt[k] = rest[k] * (1 - 0.95 * cv);
                hv[k] -= kick * 2.6 * cv;
              }
            }
          } else done = false;
        }
        if (done) intro.lettersDone = true;
      }
      if (intro.lettersDone && front > cols) intro.active = false;
    }

    function springStep(dt) {
      var steps = dt > 0.022 ? 2 : 1, h = dt / steps;
      for (var s = 0; s < steps; s++) {
        for (var i = 0; i < n; i++) {
          var v = hv[i] + (kk[i] * (tgt[i] - hx[i]) - cc[i] * hv[i]) * h;
          var x = hx[i] + v * h;
          if (x < 0) { x = 0; if (v < 0) v = -v * 0.3; }
          else if (x > 1) { x = 1; if (v > 0) v = -v * 0.3; }
          hv[i] = v;
          hx[i] = x;
        }
      }
    }

    function idleStep(dt) {
      idleAcc += dt * n / 650;
      while (idleAcc >= 1) {
        idleAcc -= 1;
        var i = (Math.random() * n) | 0;
        hv[i] += (Math.random() - 0.5) * 1.5;
      }
    }

    function lightStep(dt, t) {
      var target = DEFAULT_ANG, rate = 0.8, lt = 1;
      if (hover.on && W) {
        var vx = hover.x - W / 2, vy = hover.y - H / 2;
        var m = Math.sqrt(vx * vx + vy * vy) / (0.5 * Math.min(W, H));
        if (m > 0.1) { target = Math.atan2(vy, vx); rate = 2.4 * Math.min(1, m) * (pointers.size ? 0.35 : 1); }
        else { target = lightAng; }
        lt = 0.86 + 0.26 * Math.min(1.2, m);
      } else if (tilt.on && performance.now() - tilt.t < 3000) {
        target = tilt.ang; rate = 4.5; lt = tilt.len;
      } else if (!reduced) {
        target = DEFAULT_ANG + 0.24 * Math.sin(t * 0.11) + 0.1 * Math.sin(t * 0.047 + 1.3);
        lt = 1 + 0.05 * Math.sin(t * 0.08);
      }
      lightAng = wrapAngle(lightAng + wrapAngle(target - lightAng) * (1 - Math.exp(-dt * rate)));
      lenScale += (lt - lenScale) * (1 - Math.exp(-dt * 2));
    }

    function pack() {
      for (var i = 0; i < n; i++) {
        var d = hx[i] + wu[i];
        bytes[i] = d <= 0 ? 0 : d >= 1 ? 255 : (d * 255 + 0.5) | 0;
      }
    }

    function meterStep(now) {
      if (now - meterT < 160) return;
      meterT = now;
      var pushed = 0, pulled = 0;
      for (var i = 0; i < n; i++) {
        var d = hx[i];
        if (d < rest[i] - 0.16) pushed++;
        else if (d > rest[i] + 0.16) pulled++;
      }
      var txt = '핀 ' + fmt(n) + '개 · 누른 핀 ' + fmt(pushed) + '개' + (pulled > 0 ? ' · 당긴 핀 ' + fmt(pulled) + '개' : '');
      if (txt !== lastTxt) { countEl.textContent = txt; lastTxt = txt; }
      var deg = Math.round((lightAng * 180 / Math.PI + 90 + 720) % 360);
      if (deg !== lastDeg) {
        needle.setAttribute('transform', 'rotate(' + deg + ')');
        degEl.textContent = '빛 ' + deg + '°';
        lastDeg = deg;
      }
    }

    function render() {
      if (!n) return;
      if (gl && !glLost) {
        if (texW !== cols || texH !== rows) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cols, rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
          texW = cols; texH = rows;
        } else {
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
        }
        var sx = canvas.width / W;
        var R = Math.max(cols, rows) * 1.3;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(U.uRes, canvas.width, canvas.height);
        gl.uniform2f(U.uGrid, cols, rows);
        gl.uniform2f(U.uOrigin, ox * sx, oy * sx);
        gl.uniform1f(U.uSp, sp * sx);
        gl.uniform2f(U.uLight, cols / 2 + Math.cos(lightAng) * R, rows / 2 + Math.sin(lightAng) * R);
        gl.uniform1f(U.uRef, R);
        gl.uniform1f(U.uLen, LEN * lenScale);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      } else if (ctx2) {
        render2d();
      }
    }

    function render2d() {
      var s = canvas.width / W, c = ctx2;
      c.setTransform(s, 0, 0, s, 0, 0);
      c.fillStyle = 'rgb(' + boardCol.map(function (v) { return Math.round(v * 255); }).join(',') + ')';
      c.fillRect(0, 0, W, H);
      var dx = -Math.cos(lightAng), dy = -Math.sin(lightAng);
      c.lineCap = 'round';
      c.lineWidth = sp * 0.54;
      c.strokeStyle = 'rgba(22,22,26,0.42)';
      c.beginPath();
      var i, j, k, x, y, L;
      for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
        k = j * cols + i;
        L = bytes[k] / 255 * LEN * sp;
        if (L < 0.5) continue;
        x = ox + (i + 0.5) * sp; y = oy + (j + 0.5) * sp;
        c.moveTo(x, y); c.lineTo(x + dx * L, y + dy * L);
      }
      c.stroke();
      c.fillStyle = 'rgb(' + headCol.map(function (v) { return Math.round(v * 255); }).join(',') + ')';
      c.beginPath();
      for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
        x = ox + (i + 0.5) * sp; y = oy + (j + 0.5) * sp;
        c.moveTo(x + sp * 0.31, y); c.arc(x, y, sp * 0.31, 0, Math.PI * 2);
      }
      c.fill();
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      var raw = now - last;
      var dt = clamp(raw / 1000, 0.001, 0.05);
      last = now;
      if (needLayout) { needLayout = false; layout(); }
      if (!n) return;
      perfStep(raw);
      if (intro.active) introStep(dt);
      pointers.forEach(function (st) { holdStep(st, dt); });
      if (!reduced && !intro.active) idleStep(dt);
      lightStep(dt, now / 1000);
      springStep(dt);
      if (waveOn) waveStep(dt);
      shakeStep(dt);
      pack();
      render();
      meterStep(now);
    }

    function holdStep(st, dt) {
      var moved = Math.sqrt((st.x - st.fx) * (st.x - st.fx) + (st.y - st.fy) * (st.y - st.fy));
      st.fx = st.x; st.fy = st.y;
      if (moved < 1.5) st.hold += dt; else st.hold = Math.max(0, st.hold - dt * 3);
      var g = toGrid(st.x, st.y);
      var grow = smooth((st.hold - 0.15) / 1.2);
      var Rpx = moved < 1.5 ? brushPx(st) * (1 + 0.3 * grow) : st.r;
      stamp(g.x, g.y, g.x, g.y, Rpx / sp, (1.8 + 2.4 * grow) * dt, st.pull);
    }

    function localPoint(e) {
      var b = canvas.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    }

    var lastTap = { t: 0, x: 0, y: 0 };

    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      var p = localPoint(e);
      var now = performance.now();
      var st = { x: p.x, y: p.y, fx: p.x, fy: p.y, t0: now, lt: now, speed: 0, hold: 0, r: 0, touch: e.pointerType !== 'mouse', pull: e.button === 2 || e.shiftKey || mode === 'pull' };
      st.r = brushPx(st) * 0.6;
      pointers.set(e.pointerId, st);
      var g = toGrid(p.x, p.y);
      stamp(g.x, g.y, g.x, g.y, brushPx(st) * 0.75 / sp, 0.6, st.pull);
      if (e.pointerType === 'mouse') { hover.on = true; hover.x = p.x; hover.y = p.y; }
      if (now - lastTap.t < 340 && Math.abs(p.x - lastTap.x) < 30 && Math.abs(p.y - lastTap.y) < 30) {
        ripple(g.x, g.y);
        lastTap.t = 0;
      } else {
        lastTap.t = now; lastTap.x = p.x; lastTap.y = p.y;
      }
      if (!noteShown) showNote(p.x, p.y);
    }

    function moveSample(st, x, y, t) {
      var dx = x - st.x, dy = y - st.y, dist = Math.sqrt(dx * dx + dy * dy);
      var dte = Math.max(1, t - st.lt) / 1000;
      st.speed += (dist / dte - st.speed) * (1 - Math.exp(-dte / 0.07));
      st.lt = t;
      if (dist < 0.3) return;
      var sn = clamp((st.speed - 160) / 1700, 0, 1);
      var land = 0.55 + 0.45 * smooth((t - st.t0) / 120);
      var Rpx = brushPx(st) * (1 - 0.6 * sn) * land;
      st.r = Rpx;
      var a = toGrid(st.x, st.y), b = toGrid(x, y);
      stamp(a.x, a.y, b.x, b.y, Rpx / sp, 1.15 * (1 - 0.5 * sn) * Math.min(1, dist / Rpx), st.pull);
      if (sn > 0.45 && !reduced) nudge(a.x, a.y, b.x, b.y, 1.3, (st.pull ? 9 : -9) * sn * Math.min(1, dist / 12), true);
      st.x = x; st.y = y;
    }

    function onMove(e) {
      var st = pointers.get(e.pointerId);
      var list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (!list || !list.length) list = [e];
      if (st) {
        for (var i = 0; i < list.length; i++) {
          var p = localPoint(list[i]);
          moveSample(st, p.x, p.y, list[i].timeStamp || performance.now());
        }
      }
      if (e.pointerType === 'mouse') {
        var q = localPoint(e);
        if (!st && hover.on && !reduced) {
          var ddx = q.x - hover.x, ddy = q.y - hover.y, dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd > 0.5) {
            var a = toGrid(hover.x, hover.y), b = toGrid(q.x, q.y);
            nudge(a.x, a.y, b.x, b.y, 1.6, -0.9 * Math.min(1, dd / 14), false);
          }
        }
        hover.on = true; hover.x = q.x; hover.y = q.y;
      }
    }

    function onUp(e) {
      var st = pointers.get(e.pointerId);
      if (!st) return;
      pointers.delete(e.pointerId);
      var g = toGrid(st.x, st.y);
      nudge(g.x, g.y, g.x, g.y, (st.r || brushPx(st)) / sp, st.pull ? -1.4 : 1.4, false);
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }

    function onLeave(e) {
      if (e.pointerType === 'mouse' && !pointers.has(e.pointerId)) hover.on = false;
    }

    function ripple(gx, gy) {
      if (!n) return;
      var s = 1.7, rad = Math.ceil(s * 3);
      var i0 = Math.max(0, Math.floor(gx - rad)), i1 = Math.min(cols - 1, Math.ceil(gx + rad));
      var j0 = Math.max(0, Math.floor(gy - rad)), j1 = Math.min(rows - 1, Math.ceil(gy + rad));
      for (var j = j0; j <= j1; j++) {
        for (var i = i0; i <= i1; i++) {
          var dx = i + 0.5 - gx, dy = j + 0.5 - gy;
          wv[j * cols + i] -= 40 * Math.exp(-(dx * dx + dy * dy) / (2 * s * s));
        }
      }
      waveOn = true;
    }

    function waveStep(dt) {
      var C = 30, steps = Math.max(1, Math.ceil(dt * C / 0.55)), h = dt / steps, c2 = C * C, damp = 1.5, e = 0;
      for (var s = 0; s < steps; s++) {
        for (var j = 0; j < rows; j++) {
          var row = j * cols;
          for (var i = 0; i < cols; i++) {
            var k = row + i, u = wu[k];
            var lap = (i > 0 ? wu[k - 1] : 0) + (i < cols - 1 ? wu[k + 1] : 0) + (j > 0 ? wu[k - cols] : 0) + (j < rows - 1 ? wu[k + cols] : 0) - 4 * u;
            wv[k] += (c2 * lap - damp * wv[k]) * h;
          }
        }
        for (var q = 0; q < n; q++) wu[q] += wv[q] * h;
      }
      for (var m = 0; m < n; m++) {
        var a = Math.abs(wu[m]) + Math.abs(wv[m]) * 0.02;
        if (a > e) e = a;
      }
      if (e < 0.003) { wu.fill(0); wv.fill(0); waveOn = false; }
    }

    var noteShown = false;
    function showNote(x, y) {
      noteShown = true;
      var NS = 'http://www.w3.org/2000/svg';
      var sx = x > W - 270 ? -1 : 1, sy = y < 90 ? 1 : -1;
      var ex = x + sx * 30, ey = y + sy * 30, fx = ex + sx * 24;
      var box = el('div', '', noteLayer);
      box.style.position = 'absolute';
      box.style.left = '0'; box.style.top = '0'; box.style.width = '100%'; box.style.height = '100%';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      var dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', '2.6');
      dot.style.fill = 'var(--red,#e0442b)';
      var line = document.createElementNS(NS, 'polyline');
      line.setAttribute('points', x + ',' + y + ' ' + ex + ',' + ey + ' ' + fx + ',' + ey);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke-width', '1');
      line.style.stroke = 'var(--ink,#16161a)';
      var len = Math.sqrt(1800) + 24;
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      svg.appendChild(line); svg.appendChild(dot);
      box.appendChild(svg);
      var txt = el('div', 'am-pins-note-text', box);
      txt.textContent = '들어간 핀은 밝게, 나온 핀은 그림자로';
      txt.style.top = ey + 'px';
      txt.style.left = fx + 'px';
      txt.style.transform = 'translate(' + (sx > 0 ? '0' : '-100%') + ',-50%)';
      if (!line.animate) {
        line.style.strokeDashoffset = 0;
        setTimeout(function () { box.remove(); }, 3200);
        return;
      }
      line.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 340, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'forwards' });
      dot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: 'forwards' });
      txt.animate([{ opacity: 0, marginLeft: (sx * -6) + 'px' }, { opacity: 1, marginLeft: '0px' }], { duration: 320, delay: 220, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'backwards' });
      var out = box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 2900, easing: 'ease-in', fill: 'forwards' });
      out.onfinish = function () { box.remove(); };
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    function setMode(m) {
      mode = m === 'pull' ? 'pull' : 'push';
      btnPush.classList.toggle('is-on', mode === 'push');
      btnPull.classList.toggle('is-on', mode === 'pull');
      btnPush.setAttribute('aria-pressed', mode === 'push');
      btnPull.setAttribute('aria-pressed', mode === 'pull');
    }
    btnPush.addEventListener('click', function () { setMode('push'); });
    btnPull.addEventListener('click', function () { setMode('pull'); });
    setMode('push');

    var shakeT = -1;
    function shake() {
      if (!n) return;
      for (var i = 0; i < n; i++) {
        tgt[i] = rest[i];
        hv[i] += (Math.random() * 2 - 1) * 5.5 + (rest[i] - hx[i]) * 3;
        if (!reduced) wv[i] += (Math.random() * 2 - 1) * 1.2;
      }
      if (!reduced) waveOn = true;
      shakeT = 0;
    }
    function shakeStep(dt) {
      if (shakeT < 0) return;
      shakeT += dt;
      if (shakeT > 0.65 || reduced) { canvas.style.transform = ''; shakeT = -1; return; }
      var a = 7 * Math.exp(-shakeT / 0.13);
      canvas.style.transform = 'translate3d(' + (a * Math.sin(shakeT * 74)).toFixed(2) + 'px,' + (a * 0.4 * Math.sin(shakeT * 57 + 1)).toFixed(2) + 'px,0)';
    }
    btnShake.addEventListener('click', function () { shake(); });

    var tilt = { on: false, t: 0, ang: DEFAULT_ANG, len: 1, b0: null };
    var motion = { last: null, hits: [], lastShake: 0 };
    function screenAngle() {
      var o = window.screen && window.screen.orientation;
      return (o && typeof o.angle === 'number') ? o.angle : (typeof window.orientation === 'number' ? window.orientation : 0);
    }
    function onOrient(e) {
      if (e.beta == null || e.gamma == null) return;
      if (tilt.b0 == null) tilt.b0 = e.beta;
      tilt.b0 += (e.beta - tilt.b0) * 0.003;
      var x = clamp(e.gamma / 28, -1.5, 1.5), y = clamp((e.beta - tilt.b0) / 28, -1.5, 1.5);
      var so = screenAngle() * Math.PI / 180;
      var rx = x * Math.cos(so) + y * Math.sin(so), ry = -x * Math.sin(so) + y * Math.cos(so);
      var dx = 0.78 + rx * 1.4, dy = 0.62 + ry * 1.4;
      tilt.ang = Math.atan2(-dy, -dx);
      tilt.len = 0.9 + 0.22 * Math.min(1.5, Math.sqrt(rx * rx + ry * ry));
      tilt.on = true;
      tilt.t = performance.now();
    }
    function onMotion(e) {
      var a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      var m = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z), now = performance.now();
      if (motion.last != null && Math.abs(m - motion.last) > 13) motion.hits.push(now);
      motion.last = m;
      while (motion.hits.length && now - motion.hits[0] > 900) motion.hits.shift();
      if (motion.hits.length >= 3 && now - motion.lastShake > 1600) { motion.lastShake = now; motion.hits.length = 0; shake(); }
    }
    var sensorsOn = false;
    function attachSensors() {
      if (sensorsOn) return;
      sensorsOn = true;
      window.addEventListener('deviceorientation', onOrient);
      window.addEventListener('devicemotion', onMotion);
    }
    var needPerm = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
    if ('DeviceOrientationEvent' in window) attachSensors();
    if (needPerm) {
      setTimeout(function () { if (!tilt.on && coarse) btnTilt.hidden = false; }, 900);
      btnTilt.addEventListener('click', function () {
        var ps = [DeviceOrientationEvent.requestPermission()];
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') ps.push(DeviceMotionEvent.requestPermission());
        Promise.all(ps.map(function (p) { return p.catch(function () { return 'denied'; }); })).then(function (r) {
          if (r[0] === 'granted') { attachSensors(); btnTilt.classList.add('is-on'); }
        });
      });
    }

    var perf = { n: 0, sum: 0, cnt: 0, rounds: 0 };
    function perfStep(rawDt) {
      if (perf.rounds >= 3 || intro.t < 0.05) return;
      perf.n++;
      if (perf.n <= 12) return;
      perf.sum += rawDt; perf.cnt++;
      if (perf.cnt < 45) return;
      var avg = perf.sum / perf.cnt;
      perf.n = 0; perf.sum = 0; perf.cnt = 0;
      if (avg > 24) {
        perf.rounds++;
        if (maxDpr > 1 && (window.devicePixelRatio || 1) > 1) maxDpr = Math.max(1, maxDpr - 0.5);
        else spacingBoost *= 1.2;
        needLayout = true;
      } else perf.rounds = 3;
    }

    var fontP = document.fonts && document.fonts.load ? document.fonts.load('800 120px "Pretendard Variable"', '애니메이션박물관') : Promise.resolve();
    Promise.race([fontP, new Promise(function (r) { setTimeout(r, 1500); })]).then(function () { fontReady = true; }, function () { fontReady = true; });

    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () {
      needLayout = true;
      if (!running && layout()) { needLayout = false; pack(); render(); meterStep(1e9); }
    }) : null;
    if (ro) ro.observe(stage);
    else window.addEventListener('resize', function () { needLayout = true; });

    if (layout()) { needLayout = false; pack(); render(); meterStep(1e9); meterT = 0; }

    function resume() {
      if (running) return;
      running = true;
      last = performance.now();
      if (!intro.started && n) startIntro();
      raf = requestAnimationFrame(function (now) {
        last = now;
        if (!intro.started && n) startIntro();
        frame(now);
      });
    }
    function pause() {
      running = false;
      cancelAnimationFrame(raf);
    }

    return {
      pause: pause,
      resume: resume,
      setMode: setMode,
      shake: function () { shake(); },
      ripple: function (x, y) { var g = toGrid(x, y); ripple(g.x, g.y); }
    };
  }

  window.AM = window.AM || {};
  window.AM.scenes = window.AM.scenes || {};
  window.AM.scenes.pins = mountPins;
})();
