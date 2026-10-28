(function () {
  var TAU = Math.PI * 2;
  var FRAME = 1 / 12;
  var MAX_FRAMES = 64;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }

  function mountBall(root, opts) {
    var reduced = !!(opts && opts.reducedMotion);
    var canvas = document.createElement('canvas');
    canvas.className = 'am-ball-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '공 튀기기 — 공을 잡아 던지면 12분의 1초마다 한 장씩 원화가 남습니다');
    root.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var ui = document.createElement('div');
    ui.className = 'am-ball-ui';
    ui.innerHTML =
      '<span class="am-ball-count">원화 <b>0</b>장</span>' +
      '<button type="button" class="am-ball-btn am-ball-play" disabled>재생</button>' +
      '<button type="button" class="am-ball-btn am-ball-clear" disabled>지우기</button>';
    root.appendChild(ui);
    var countEl = ui.querySelector('.am-ball-count');
    var playBtn = ui.querySelector('.am-ball-play');
    var clearBtn = ui.querySelector('.am-ball-clear');

    var hint = document.createElement('div');
    hint.className = 'am-ball-hint';
    hint.textContent = '공을 잡아 던지거나, 빈 곳을 눌러 보세요';
    root.appendChild(hint);

    var colors = { ink: '#16161a', ink2: '#4d4d55', ink3: '#8a8a91', line: 'rgba(22,22,26,0.14)', line2: 'rgba(22,22,26,0.32)', blue: '#2b5fd9', red: '#e0442b' };
    function readColors() {
      var map = { ink: '--ink', ink2: '--ink-2', ink3: '--ink-3', line: '--line', line2: '--line-2', blue: '--blue', red: '--red' };
      Object.keys(map).forEach(function (k) { var v = window.AM.cssVar(map[k]); if (v) colors[k] = v; });
    }
    readColors();

    var W = 0, H = 0, dpr = 1, floorY = 0, R = 22, G = 2300;
    var ball = { x: 0, y: 0, vx: 0, vy: 0, held: false, gx: 0, gy: 0, q: 0, qv: 0, qa: 0, sinceContact: 1, roll: 0, onFloor: false, anticipate: 0 };
    var pointer = { x: -1e4, y: -1e4, inside: false, id: null, samples: [], downX: 0, downY: 0, downT: 0, moved: false };
    var frames = [];
    var notes = [];
    var recording = false, frameClock = 0, frameNo = 0, apexArmed = false, maxSpeed = 0, maxSpeedFrame = -1, contactNoted = false, apexNoted = false, stretchNoted = false;
    var playing = false, playIndex = 0, playClock = 0, playLoops = 0;
    var running = false, raf = 0, last = 0, started = false, idleTime = 0, now = 0, fadeOut = null;

    function layout() {
      var r = root.getBoundingClientRect();
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      R = W < 560 ? 15 : 21;
      floorY = H - (W < 560 ? 70 : 64);
      G = clamp(H * 3.4, 1700, 2600);
      if (!started) {
        ball.x = W * 0.18;
        ball.y = floorY - R;
      }
      ball.x = clamp(ball.x, R, W - R);
      ball.y = Math.min(ball.y, floorY - R);
    }

    function setCount() {
      countEl.innerHTML = playing
        ? '재생 <b>' + String(playIndex + 1).padStart(2, '0') + '</b> / ' + String(frames.length).padStart(2, '0') + ' · 초당 12장'
        : '원화 <b>' + frames.length + '</b>장 · ' + (frames.length * FRAME).toFixed(1) + '초';
      playBtn.disabled = frames.length < 2 || recording;
      clearBtn.disabled = frames.length === 0;
      playBtn.textContent = playing ? '정지' : '재생';
    }

    function drawnShape() {
      var speed = Math.hypot(ball.vx, ball.vy);
      var settle = clamp(ball.sinceContact / 0.12, 0, 1);
      var k = ball.held || ball.onFloor ? 1 + Math.min(speed / 3600, 0.18) : 1 + Math.min(speed / 2800, 0.26) * settle;
      if (ball.onFloor && Math.abs(ball.vy) < 1) k = 1;
      return { ang: Math.atan2(ball.vy, ball.vx), k: k, q: ball.q + ball.anticipate, qa: ball.qa };
    }

    function shapeOffsetY(s) {
      if (s.qa === 0 && s.q > 0) return R * s.q;
      return 0;
    }

    function startRecording() {
      if (fadeOut) fadeOut = null;
      frames = [];
      notes = [];
      recording = true;
      frameClock = FRAME;
      frameNo = 0;
      apexArmed = ball.vy < 0;
      maxSpeed = 0;
      maxSpeedFrame = -1;
      contactNoted = apexNoted = stretchNoted = false;
      stopPlay();
      setCount();
    }

    function pushFrame(key) {
      if (frames.length >= MAX_FRAMES) { recording = false; setCount(); return null; }
      var s = drawnShape();
      var oy = shapeOffsetY(s);
      var f = { x: ball.x, y: ball.y + oy, ang: s.ang, k: s.k, q: s.q, qa: s.qa, roll: ball.roll, n: ++frameNo, key: key || null, t: now, speed: Math.hypot(ball.vx, ball.vy) };
      frames.push(f);
      if (!key && f.speed > maxSpeed && !ball.onFloor) { maxSpeed = f.speed; maxSpeedFrame = frames.length - 1; }
      setCount();
      return f;
    }

    function addNote(frame, kind, text, dx, dy) {
      notes.push({ f: frame, kind: kind, text: text, dx: dx, dy: dy, t: now });
    }

    function stopRecording() {
      recording = false;
      if (!stretchNoted && maxSpeedFrame >= 0 && frames[maxSpeedFrame]) {
        stretchNoted = true;
      }
      setCount();
    }

    function stopPlay() {
      playing = false;
      playIndex = 0;
      playClock = 0;
      playLoops = 0;
    }

    function onContact(impact, axis, floor) {
      var q = clamp(impact / 2600, 0, 0.42);
      if (q > ball.q) { ball.q = q; ball.qv = 0; }
      ball.qa = axis;
      ball.sinceContact = 0;
      if (recording && floor && impact <= 640 && frames.length > 4) {
        pushFrame('rest');
        stopRecording();
        return;
      }
      if (recording && impact > 260) {
        if (floor && !stretchNoted && maxSpeedFrame >= 0 && frames[maxSpeedFrame]) {
          var sf = frames[maxSpeedFrame];
          sf.key = sf.key || 'fast';
          addNote(sf, 'fast', '가장 빠를 때 — 늘어난다', -1, -1);
          stretchNoted = true;
        }
        var f = pushFrame('contact');
        frameClock = 0;
        if (f && floor && !contactNoted) {
          addNote(f, 'contact', '닿는 순간 — 찌그러진다', 1, -1);
          contactNoted = true;
        }
        maxSpeed = 0;
        maxSpeedFrame = -1;
      }
    }

    function step(dt) {
      ball.sinceContact += dt;
      var qk = 1100, qc = 26;
      ball.qv += (-qk * ball.q - qc * ball.qv) * dt;
      ball.q += ball.qv * dt;
      if (Math.abs(ball.q) < 0.0005 && Math.abs(ball.qv) < 0.01) { ball.q = 0; ball.qv = 0; }

      var near = !ball.held && ball.onFloor && pointer.inside && !AM.isTouch && Math.hypot(pointer.x - ball.x, pointer.y - ball.y) < R * 5.5;
      var at = near ? 0.07 : 0;
      if (near && Math.abs(ball.q) < 0.01) ball.qa = 0;
      ball.anticipate += (at - ball.anticipate) * Math.min(1, dt * 12);

      if (ball.held) {
        var tx = pointer.x - ball.gx, ty = pointer.y - ball.gy;
        var k = 900, c = 2 * Math.sqrt(k) * 0.85;
        ball.vx += ((tx - ball.x) * k - ball.vx * c) * dt;
        ball.vy += ((ty - ball.y) * k - ball.vy * c) * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.x = clamp(ball.x, R, W - R);
        ball.y = clamp(ball.y, R, floorY - R);
        ball.onFloor = false;
        return;
      }

      ball.vy += G * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.onFloor = false;

      if (ball.y > floorY - R) {
        ball.y = floorY - R;
        if (ball.vy > 80) {
          var impact = ball.vy;
          ball.vy = -ball.vy * 0.7;
          ball.vx *= 0.94;
          onContact(impact, 0, true);
        } else {
          ball.vy = 0;
          ball.onFloor = true;
          ball.vx *= Math.exp(-3.2 * dt);
          if (Math.abs(ball.vx) < 6) ball.vx = 0;
        }
      }
      if (ball.y < R) {
        ball.y = R;
        if (ball.vy < 0) { var im = -ball.vy; ball.vy = -ball.vy * 0.55; apexArmed = false; onContact(im, 0, false); }
      }
      if (ball.x < R) {
        ball.x = R;
        if (ball.vx < 0) { var iw = -ball.vx; ball.vx = -ball.vx * 0.6; onContact(iw, Math.PI / 2, false); }
      }
      if (ball.x > W - R) {
        ball.x = W - R;
        if (ball.vx > 0) { var ie = ball.vx; ball.vx = -ball.vx * 0.6; onContact(ie, Math.PI / 2, false); }
      }
      ball.roll += ball.vx * dt / R;

      if (recording) {
        if (apexArmed && ball.vy >= 0) {
          apexArmed = false;
          var a = pushFrame('apex');
          frameClock = 0;
          if (a && !apexNoted && frames.length > 2) {
            addNote(a, 'apex', '꼭대기 — 간격이 좁다(느려진다)', 1, -1);
            apexNoted = true;
          }
        }
        if (ball.vy < -40) apexArmed = true;
        frameClock += dt;
        if (frameClock >= FRAME) {
          frameClock -= FRAME;
          pushFrame(null);
        }
        if (ball.onFloor && ball.vx === 0 && ball.q === 0) {
          pushFrame('rest');
          stopRecording();
        }
      }
    }

    function shapePath(c, x, y, s, roll, r) {
      c.save();
      c.translate(x, y);
      if (s.q) {
        c.rotate(s.qa);
        var sq = 1 - s.q;
        c.scale(1 / Math.max(sq, 0.4), sq);
        c.rotate(-s.qa);
      }
      if (s.k !== 1) {
        c.rotate(s.ang);
        c.scale(s.k, 1 / s.k);
        c.rotate(-s.ang);
      }
      c.beginPath();
      c.arc(0, 0, r, 0, TAU);
      c.restore();
    }

    function drawFloor() {
      ctx.strokeStyle = colors.line2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(floorY) + 0.5);
      ctx.lineTo(W, Math.round(floorY) + 0.5);
      ctx.stroke();
      ctx.strokeStyle = colors.line;
      ctx.beginPath();
      var step = W < 560 ? 32 : 40;
      for (var x = step; x < W; x += step) {
        var big = Math.round(x / step) % 5 === 0;
        ctx.moveTo(Math.round(x) + 0.5, floorY + 1);
        ctx.lineTo(Math.round(x) + 0.5, floorY + (big ? 9 : 5));
      }
      ctx.stroke();
    }

    function drawPathOfAction(alpha) {
      if (frames.length < 2) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colors.blue;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(frames[0].x, frames[0].y);
      for (var i = 1; i < frames.length; i++) {
        var p = frames[i - 1], f = frames[i];
        var mx = (p.x + f.x) / 2, my = (p.y + f.y) / 2;
        ctx.quadraticCurveTo(p.x, p.y, mx, my);
      }
      var lf = frames[frames.length - 1];
      ctx.lineTo(lf.x, lf.y);
      ctx.stroke();
      ctx.restore();
    }

    function drawOnion(alphaAll, dim) {
      var n = frames.length;
      for (var i = 0; i < n; i++) {
        var f = frames[i];
        var age = clamp((now - f.t) / 0.18, 0, 1);
        var a = alphaAll * (dim ? 0.3 : 0.35 + 0.65 * ((i + 1) / n)) * easeOut(age);
        if (a <= 0.01) continue;
        var isKey = f.key === 'contact' || f.key === 'apex' || f.key === 'fast';
        ctx.save();
        ctx.globalAlpha = a;
        ctx.lineWidth = isKey ? 1.4 : 1.1;
        ctx.strokeStyle = isKey ? colors.red : colors.blue;
        shapePath(ctx, f.x, f.y, f, f.roll, R);
        ctx.stroke();
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        var cr = R * 0.28;
        var cx = Math.cos(f.roll), sy = Math.sin(f.roll);
        ctx.moveTo(f.x - cx * cr, f.y - sy * cr);
        ctx.lineTo(f.x + cx * cr, f.y + sy * cr);
        ctx.moveTo(f.x + sy * cr, f.y - cx * cr);
        ctx.lineTo(f.x - sy * cr, f.y + cx * cr);
        ctx.stroke();
        if (isKey || i === 0 || i === n - 1 || f.n % 4 === 1) {
          ctx.fillStyle = isKey ? colors.red : colors.ink3;
          ctx.font = '600 10px "Pretendard Variable", Pretendard, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          var ly = f.y - R * (f.q > 0 && f.qa === 0 ? 1 - f.q : 1) - 5;
          ctx.fillText(String(f.n).padStart(2, '0'), f.x, ly);
        }
        ctx.restore();
      }
    }

    function drawNotes(alphaAll) {
      ctx.save();
      ctx.font = '500 12px "Pretendard Variable", Pretendard, sans-serif';
      ctx.textBaseline = 'middle';
      for (var i = 0; i < notes.length; i++) {
        var nt = notes[i], f = nt.f;
        var t = now - nt.t;
        var lp = easeOut(t / 0.32);
        var tp = easeOut((t - 0.2) / 0.3);
        var sx = f.x + nt.dx * R * 0.9, sy = f.y + nt.dy * R * 0.9;
        var len = W < 560 ? 34 : 54;
        var ex = sx + nt.dx * len, ey = sy + nt.dy * len * 0.9;
        var tw = ctx.measureText(nt.text).width;
        var hx = nt.dx > 0 ? ex + 8 : ex - 8;
        if (nt.dx > 0 && hx + tw > W - 8) { nt.dx = -1; continue; }
        if (nt.dx < 0 && hx - tw < 8) { nt.dx = 1; continue; }
        var topSafe = frames.length >= 3 ? 70 : 16;
        if (ey < topSafe) ey = topSafe;
        var hEnd = hx;
        ctx.globalAlpha = alphaAll;
        ctx.strokeStyle = colors.ink2;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, TAU);
        ctx.fillStyle = colors.ink;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        var mx = sx + (ex - sx) * Math.min(1, lp * 1.6), my = sy + (ey - sy) * Math.min(1, lp * 1.6);
        ctx.lineTo(mx, my);
        if (lp > 0.62) {
          var p2 = (lp - 0.62) / 0.38;
          ctx.lineTo(ex + (hEnd - ex) * p2, ey);
        }
        ctx.stroke();
        if (tp > 0) {
          ctx.globalAlpha = alphaAll * tp;
          ctx.fillStyle = colors.ink;
          ctx.textAlign = nt.dx > 0 ? 'left' : 'right';
          ctx.fillText(nt.text, hx + (nt.dx > 0 ? 4 : -4), ey);
        }
      }
      ctx.restore();
    }

    function drawTiming(alphaAll) {
      if (frames.length < 3) return;
      var len = W < 560 ? Math.min(W - 40, 220) : 260;
      var x0 = W < 560 ? 20 : W - len - 28, y0 = W < 560 ? 30 : 34;
      var dist = [0];
      for (var i = 1; i < frames.length; i++) dist.push(dist[i - 1] + Math.hypot(frames[i].x - frames[i - 1].x, frames[i].y - frames[i - 1].y));
      var total = dist[dist.length - 1] || 1;
      ctx.save();
      ctx.globalAlpha = alphaAll;
      ctx.font = '600 11px "Pretendard Variable", Pretendard, sans-serif';
      ctx.fillStyle = colors.ink2;
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';
      ctx.fillText('타이밍 차트 — 눈금 사이가 좁을수록 느리다', x0, y0 - 6);
      ctx.strokeStyle = colors.line2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + 0.5);
      ctx.lineTo(x0 + len, y0 + 0.5);
      ctx.stroke();
      for (var j = 0; j < frames.length; j++) {
        var f = frames[j];
        var x = Math.round(x0 + dist[j] / total * len) + 0.5;
        var isKey = f.key === 'contact' || f.key === 'apex' || f.key === 'fast';
        var age = easeOut((now - f.t) / 0.2);
        ctx.strokeStyle = isKey ? colors.red : colors.blue;
        ctx.globalAlpha = alphaAll * age * (playing && j === playIndex ? 1 : 0.85);
        ctx.beginPath();
        ctx.moveTo(x, y0 - (isKey ? 6 : 3));
        ctx.lineTo(x, y0 + (isKey ? 9 : 6));
        ctx.stroke();
        if (playing && j === playIndex) {
          ctx.fillStyle = colors.ink;
          ctx.beginPath();
          ctx.arc(x, y0 + 14, 2.2, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    function drawShadow(x, y, s) {
      var h = clamp((floorY - (y + R)) / (H * 0.7), 0, 1);
      var w = R * (1.25 - 0.7 * h) * (s && s.q > 0 && s.qa === 0 ? 1 / (1 - s.q) : 1);
      ctx.save();
      ctx.globalAlpha = 0.16 * (1 - h * 0.8);
      ctx.fillStyle = colors.ink;
      ctx.beginPath();
      ctx.ellipse(x, floorY - 1, w, Math.max(1.5, R * 0.16 * (1 - h * 0.5)), 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    function drawBall() {
      var s = drawnShape();
      var oy = shapeOffsetY(s);
      drawShadow(ball.x, ball.y + oy, s);
      ctx.fillStyle = colors.ink;
      shapePath(ctx, ball.x, ball.y + oy, s, ball.roll, R);
      ctx.fill();
      if (ball.held) {
        ctx.save();
        ctx.strokeStyle = colors.blue;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, R + 7, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawPlayback() {
      var f = frames[playIndex];
      if (!f) return;
      drawShadow(f.x, f.y, f);
      ctx.fillStyle = colors.ink;
      shapePath(ctx, f.x, f.y, f, f.roll, R);
      ctx.fill();
    }

    function render() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawFloor();
      var fa = 1;
      if (fadeOut) {
        fa = 1 - clamp((now - fadeOut.t) / 0.28, 0, 1);
        if (fa <= 0) { fadeOut.done(); fadeOut = null; fa = 0; }
      }
      drawPathOfAction(0.55 * fa * (playing ? 0.5 : 1));
      drawOnion(fa, playing);
      drawTiming(fa);
      if (!playing) drawNotes(fa);
      if (playing) drawPlayback();
      else drawBall();
    }

    function tick(t) {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      now += dt;
      if (playing) {
        playClock += dt;
        while (playClock >= FRAME) {
          playClock -= FRAME;
          playIndex++;
          if (playIndex >= frames.length) {
            playIndex = 0;
            playLoops++;
            if (playLoops >= 3) { stopPlay(); break; }
          }
        }
        setCount();
      } else {
        var sub = Math.ceil(dt / (1 / 240));
        for (var i = 0; i < sub; i++) step(dt / sub);
        var still = ball.onFloor && ball.vx === 0 && !ball.held && !recording;
        idleTime = still ? idleTime + dt : 0;
        if (idleTime > 5 && !reduced && frames.length === 0) {
          idleTime = -4;
          hop();
        }
      }
      render();
    }

    function hop() {
      startRecording();
      ball.vy = -Math.sqrt(2 * G * Math.min(H * 0.22, 150));
      ball.vx = (ball.x < W / 2 ? 1 : -1) * 120;
      ball.sinceContact = 0.2;
    }

    function jumpTo(tx, ty) {
      ty = Math.min(ty, floorY - R);
      tx = clamp(tx, R, W - R);
      var d = Math.hypot(tx - ball.x, ty - ball.y);
      var T = clamp(0.42 + d / 2200, 0.42, 0.95);
      startRecording();
      ball.vx = (tx - ball.x) / T;
      ball.vy = (ty - ball.y - 0.5 * G * T * T) / T;
      ball.q = Math.max(ball.q, 0.16);
      ball.qa = 0;
      ball.sinceContact = 0;
      dismissHint();
    }

    function dismissHint() {
      hint.classList.add('is-gone');
    }

    function local(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function hitBall(p) {
      var reach = R * (AM.isTouch ? 2.6 : 1.9);
      return Math.hypot(p.x - ball.x, p.y - ball.y) <= reach;
    }

    canvas.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches[0]) return;
      var r = canvas.getBoundingClientRect();
      var p = { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
      if (hitBall(p) || playing) e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('pointerdown', function (e) {
      if (pointer.id !== null) return;
      var p = local(e);
      pointer.x = p.x; pointer.y = p.y;
      pointer.id = e.pointerId;
      pointer.downX = p.x; pointer.downY = p.y; pointer.downT = performance.now();
      pointer.moved = false;
      pointer.samples = [{ x: p.x, y: p.y, t: performance.now() }];
      if (playing) { stopPlay(); setCount(); }
      if (hitBall(p)) {
        ball.held = true;
        ball.gx = clamp(p.x - ball.x, -R, R) * 0.6;
        ball.gy = clamp(p.y - ball.y, -R, R) * 0.6;
        ball.q = Math.max(ball.q, 0.08);
        ball.qa = Math.PI / 2;
        recording = false;
        frames = [];
        notes = [];
        setCount();
        dismissHint();
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        canvas.style.cursor = 'grabbing';
      }
    });

    canvas.addEventListener('pointermove', function (e) {
      var p = local(e);
      pointer.x = p.x; pointer.y = p.y;
      pointer.inside = true;
      if (e.pointerId === pointer.id) {
        if (Math.hypot(p.x - pointer.downX, p.y - pointer.downY) > 8) pointer.moved = true;
        var t = performance.now();
        pointer.samples.push({ x: p.x, y: p.y, t: t });
        while (pointer.samples.length > 2 && t - pointer.samples[0].t > 90) pointer.samples.shift();
      }
      if (!ball.held && !AM.isTouch) canvas.style.cursor = hitBall(p) ? 'grab' : 'crosshair';
    });

    function release(e) {
      if (e.pointerId !== pointer.id) return;
      var p = local(e);
      pointer.id = null;
      if (ball.held) {
        ball.held = false;
        var s = pointer.samples;
        var a = s[0], b = s[s.length - 1];
        var dt = Math.max(0.016, (b.t - a.t) / 1000);
        var vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
        if (performance.now() - b.t > 120) { vx = 0; vy = 0; }
        var sp = Math.hypot(vx, vy), max = 4200;
        if (sp > max) { vx *= max / sp; vy *= max / sp; }
        ball.vx = vx * 0.92 + ball.vx * 0.08;
        ball.vy = vy * 0.92 + ball.vy * 0.08;
        ball.q = 0; ball.qv = -2.5; ball.qa = Math.atan2(ball.vy, ball.vx) + Math.PI / 2;
        ball.sinceContact = 0.06;
        startRecording();
        pushFrame(null);
        frameClock = 0;
        canvas.style.cursor = AM.isTouch ? '' : 'grab';
      } else if (e.type === 'pointerup' && !pointer.moved && performance.now() - pointer.downT < 450) {
        jumpTo(p.x, p.y);
      }
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', function (e) {
      if (e.pointerId !== pointer.id) return;
      pointer.id = null;
      if (ball.held) { ball.held = false; ball.vx = 0; ball.vy = 0; }
    });
    canvas.addEventListener('pointerleave', function () { pointer.inside = false; });

    playBtn.addEventListener('click', function () {
      if (playing) { stopPlay(); setCount(); return; }
      if (frames.length < 2) return;
      playing = true;
      playIndex = 0;
      playClock = 0;
      playLoops = 0;
      dismissHint();
      setCount();
    });
    clearBtn.addEventListener('click', function () {
      stopPlay();
      fadeOut = { t: now, done: function () { frames = []; notes = []; recording = false; setCount(); } };
    });

    function intro() {
      started = true;
      if (reduced) {
        ball.x = W * 0.1; ball.y = floorY - R - H * 0.5; ball.vx = W * 0.3; ball.vy = 0;
        startRecording();
        for (var i = 0; i < 1200 && recording; i++) { now += 1 / 240; step(1 / 240); }
        return;
      }
      ball.x = Math.max(R + 4, W * 0.08);
      ball.y = Math.max(R, floorY - R - H * 0.62);
      ball.vx = clamp(W * 0.34, 180, 420);
      ball.vy = 0;
      startRecording();
      pushFrame(null);
      frameClock = 0;
      setTimeout(function () { if (!hint.classList.contains('is-gone')) hint.classList.add('is-on'); }, 2600);
    }

    var ro = new ResizeObserver(function () {
      var oldW = W, oldF = floorY;
      layout();
      if (started && oldW && Math.abs(oldW - W) > 1) {
        frames = []; notes = []; recording = false; stopPlay(); setCount();
      }
      if (started && oldF !== floorY && ball.onFloor) ball.y = floorY - R;
      if (!running) render();
    });
    ro.observe(root);
    layout();
    setCount();
    render();

    return {
      pause: function () {
        running = false;
        cancelAnimationFrame(raf);
      },
      resume: function () {
        if (running) return;
        if (!started) { readColors(); intro(); }
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
  }

  window.AM = window.AM || {};
  window.AM.scenes = window.AM.scenes || {};
  window.AM.scenes.ball = mountBall;
})();
