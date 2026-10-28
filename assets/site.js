(function () {
  var reduced = window.AM.reducedMotion;
  var SVGNS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }

  var hd = document.getElementById('hd');
  var lastY = window.scrollY;
  function onScroll() {
    var y = window.scrollY;
    hd.classList.toggle('is-scrolled', y > 24);
    var menuOpen = document.body.classList.contains('menu-open');
    hd.classList.toggle('is-hidden', !menuOpen && y > 480 && y > lastY + 2);
    if (y < lastY - 2 || y < 480) hd.classList.remove('is-hidden');
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var menuBtn = document.querySelector('.hd-menu');
  menuBtn.addEventListener('click', function () {
    var open = document.body.classList.toggle('menu-open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  });
  document.querySelectorAll('.sheet-menu a').forEach(function (a) {
    a.addEventListener('click', function () {
      document.body.classList.remove('menu-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });

  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        revealIO.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('[data-reveal], .route-svg').forEach(function (n) {
    if (n.closest('.hero')) return;
    revealIO.observe(n);
  });
  var heroCopy = document.querySelector('.hero-copy');
  var fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 900); })]) : Promise.resolve();
  fontsReady.then(function () { requestAnimationFrame(function () { heroCopy.classList.add('is-in'); }); });

  var DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  var HOLIDAYS = ['2026-02-17', '2026-09-25', '2027-02-07', '2027-09-15'];

  function kstNow() {
    var d = new Date(Date.now() + 9 * 3600e3);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay(), h: d.getUTCHours(), min: d.getUTCMinutes() };
  }

  function ymd(t) { return t.y + '-' + String(t.m).padStart(2, '0') + '-' + String(t.d).padStart(2, '0'); }

  function closedReason(t) {
    if (t.dow === 1) return '매주 월요일';
    if (t.m === 1 && t.d === 1) return '1월 1일';
    if (HOLIDAYS.indexOf(ymd(t)) >= 0) return '명절 당일';
    return '';
  }

  function status() {
    var t = kstNow();
    var mins = t.h * 60 + t.min;
    var reason = closedReason(t);
    var nextOpen = t.dow === 0 ? '화요일 10:00에 엽니다' : '내일 10:00에 엽니다';
    if (reason) return { open: false, short: '오늘 휴관', long: '<b>오늘은 휴관일이에요</b> · ' + reason + ' · ' + (t.dow === 1 ? '내일 10:00에 엽니다' : '다음 운영일에 만나요'), t: t };
    if (mins < 600) return { open: false, short: '10:00 개관', long: '<b>오늘 10:00에 문을 엽니다</b> · 입장 마감 17:00', t: t };
    if (mins < 1020) return { open: true, short: '지금 관람 가능', long: '<b>지금 관람할 수 있어요</b> · 오늘 10:00–18:00 · 입장 마감 17:00', t: t };
    if (mins < 1080) return { open: false, short: '입장 마감', long: '<b>오늘 입장은 마감됐어요</b> · 18:00까지 운영', t: t };
    return { open: false, short: '운영 종료', long: '<b>오늘 운영을 마쳤어요</b> · ' + nextOpen, t: t };
  }

  var xsheet = document.querySelector('[data-xsheet]');
  function buildXsheet(st) {
    var t = st.t;
    var order = [1, 2, 3, 4, 5, 6, 0];
    var html = '<thead><tr><th scope="col"><span class="sr">시간</span></th>';
    order.forEach(function (d) {
      var isToday = d === t.dow;
      html += '<th scope="col" class="' + (isToday ? 'is-today' : '') + '">' + DAYS[d] + (isToday ? ' · 오늘' : '') + '</th>';
    });
    html += '</tr></thead><tbody>';
    for (var h = 10; h < 18; h++) {
      html += '<tr><th scope="row">' + h + ':00</th>';
      order.forEach(function (d) {
        var cls = [];
        var txt = '';
        if (d === 1) { cls.push('closed'); if (h === 13) txt = '<span>휴관</span>'; }
        else if (h === 17) { cls.push('last'); }
        if (d === t.dow) cls.push('today-col');
        var ph = '';
        if (d === t.dow && !closedReason(t) && t.h === h) {
          var p = (t.min / 60) * 100;
          ph = '<i class="playhead" style="top:' + p.toFixed(1) + '%"><em>지금 ' + String(t.h).padStart(2, '0') + ':' + String(t.min).padStart(2, '0') + '</em></i>';
        }
        html += '<td class="' + cls.join(' ') + '">' + txt + ph + '</td>';
      });
      html += '</tr>';
    }
    html += '</tbody>';
    xsheet.innerHTML = html;
  }

  function renderStatus() {
    var st = status();
    document.querySelectorAll('[data-status-dot]').forEach(function (d) { d.classList.toggle('is-open', st.open); });
    document.querySelectorAll('[data-status-short]').forEach(function (n) { n.textContent = st.short; });
    document.querySelectorAll('[data-status-long]').forEach(function (n) { n.innerHTML = st.long; });
    buildXsheet(st);
  }
  renderStatus();
  setInterval(renderStatus, 30000);

  var HALLS = {
    1: [
      { no: '01', name: '동굴벽화', x: 96, y: 292, desc: '애니메이션은 무슨 뜻일까요? 기원전 1만 년 무렵 알타미라 동굴 벽화에서 그 뜻과 원리를 알아봅니다.' },
      { no: '02', name: '1층 전시관', x: 178, y: 262, desc: '애니메이션의 탄생과 발전 과정을 영상과 전시물로 살펴보고, 애니메이션의 종류와 한국 애니메이션의 역사를 자료로 만납니다.' },
      { no: '03', name: '영사기', x: 254, y: 296, desc: '환등기에서 시작된 영사기의 발달 과정과 1890년대에 쓰인 유리필름을 만납니다.' },
      { no: '04', name: '상상의 계단', x: 352, y: 252, desc: '애니메이션 포스터가 걸린 계단을 따라 2층으로 올라갑니다.' },
      { no: '05', name: '뮤지엄샵 · 구름빵 카페', x: 300, y: 248, desc: '캐릭터 상품을 만나는 뮤지엄샵과, 커피와 빵을 즐기며 바깥 경치를 보는 구름빵 카페가 있습니다(10:00–18:00).' }
    ],
    2: [
      { no: '06', name: '세계관', x: 104, y: 142, desc: '나라별 애니메이션의 경향을 한눈에 살펴봅니다.' },
      { no: '07', name: '메모리얼 홀', x: 184, y: 112, desc: '한국 애니메이션의 산 역사, 故 신동헌 감독을 기리는 공간입니다.' },
      { no: '08', name: '애니메이션이랑 놀자', x: 262, y: 152, desc: '몸으로 느껴 보는 핀스크린 체험, 주인공 체험, 캐릭터 변검 체험을 할 수 있습니다. 이 페이지의 핀스크린이 바로 그 체험입니다.' },
      { no: '09', name: '체험공간', x: 330, y: 116, desc: '소리를 만들어 내는 폴리 아티스트 체험과 더빙 체험을 할 수 있습니다.' },
      { no: '10', name: '기획전시실', x: 398, y: 150, desc: '애니메이션을 더 넓게 즐길 수 있도록 해마다 두 번 이상 기획전을 엽니다.' }
    ]
  };

  var hallsEl = document.querySelector('[data-halls]');
  var seg = document.querySelector('.seg');
  var segPill = seg.querySelector('.seg-pill');
  var segBtns = seg.querySelectorAll('button');
  var svg = document.querySelector('[data-section-svg] svg');
  var floor = 1, hot = null;
  var dotEls = {};

  function drawSection() {
    var g = el('g', { fill: 'none', stroke: 'currentColor' }, svg);
    svg.style.color = 'var(--ink)';
    el('line', { x1: 20, y1: 330.5, x2: 460, y2: 330.5, 'stroke-opacity': 0.5 }, g);
    for (var i = 0; i < 22; i++) el('line', { x1: 24 + i * 20, y1: 331, x2: 16 + i * 20, y2: 339, 'stroke-opacity': 0.22 }, g);
    el('rect', { x: 60.5, y: 200.5, width: 360, height: 130, 'data-floor-box': 1, 'stroke-opacity': 0.55 }, g);
    el('rect', { x: 60.5, y: 70.5, width: 360, height: 130, 'data-floor-box': 2, 'stroke-opacity': 0.55 }, g);
    el('path', { d: 'M52 70.5 L240 26 L428 70.5', 'stroke-opacity': 0.55 }, g);
    el('path', { d: 'M372 330.5 L372 314.5 L366 314.5 L366 298.5 L360 298.5 L360 282.5 L354 282.5 L354 266.5 L348 266.5 L348 250.5 L342 250.5 L342 234.5 L336 234.5 L336 218.5 L330 218.5 L330 200.5', 'stroke-opacity': 0.4 }, g);
    for (var x = 100; x < 420; x += 40) {
      el('line', { x1: x + 0.5, y1: 72, x2: x + 0.5, y2: 199, 'stroke-opacity': 0.08 }, g);
      el('line', { x1: x + 0.5, y1: 202, x2: x + 0.5, y2: 329, 'stroke-opacity': 0.08 }, g);
    }
    var lab = el('g', { fill: 'currentColor', stroke: 'none', 'font-size': 12, 'font-weight': 650, 'font-family': 'Pretendard Variable, Pretendard, sans-serif' }, svg);
    var t1 = el('text', { x: 20, y: 270 }, lab); t1.textContent = '1층';
    var t2 = el('text', { x: 20, y: 140 }, lab); t2.textContent = '2층';
    [1, 2].forEach(function (f) {
      HALLS[f].forEach(function (h) {
        var dg = el('g', { 'data-dot': h.no, transform: 'translate(' + h.x + ' ' + h.y + ')', style: 'cursor:pointer' }, svg);
        el('circle', { r: 13, fill: 'transparent' }, dg);
        el('circle', { r: 9, fill: 'none', stroke: 'var(--blue)', 'stroke-width': 1, class: 'ring', opacity: 0 }, dg);
        el('circle', { r: 4, fill: 'var(--ink)', class: 'core' }, dg);
        var tx = el('text', { x: 8, y: -8, 'font-size': 10, 'font-weight': 700, fill: 'var(--ink-3)', 'font-family': 'Pretendard Variable, Pretendard, sans-serif' }, dg);
        tx.textContent = h.no;
        dotEls[h.no] = dg;
        dg.addEventListener('mouseenter', function () { setHot(h.no, true); });
        dg.addEventListener('mouseleave', function () { setHot(null, true); });
        dg.addEventListener('click', function () { if (floor !== f) setFloor(f); openHall(h.no); });
      });
    });
    var lead = el('g', { 'data-lead': '', opacity: 0, style: 'transition:opacity .35s' }, svg);
    el('path', { d: '', fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1, class: 'lead-line' }, lead);
    var lt = el('text', { 'font-size': 14, 'font-weight': 700, fill: 'var(--ink)', 'font-family': 'Pretendard Variable, Pretendard, sans-serif', class: 'lead-text' }, lead);
    lt.textContent = '';
  }

  function updateSection() {
    svg.querySelectorAll('[data-floor-box]').forEach(function (b) {
      var on = +b.getAttribute('data-floor-box') === floor;
      b.setAttribute('fill', on ? 'rgba(43,95,217,0.045)' : 'none');
    });
    [1, 2].forEach(function (f) {
      HALLS[f].forEach(function (h) {
        var dg = dotEls[h.no];
        var on = f === floor;
        var isHot = hot === h.no;
        dg.style.opacity = on ? 1 : 0.28;
        dg.querySelector('.core').setAttribute('fill', isHot ? 'var(--blue)' : 'var(--ink)');
        dg.querySelector('.core').setAttribute('r', isHot ? 5 : 4);
        dg.querySelector('.ring').setAttribute('opacity', isHot ? 1 : 0);
      });
    });
    var lead = svg.querySelector('[data-lead]');
    var h = null;
    [1, 2].forEach(function (f) { HALLS[f].forEach(function (x) { if (x.no === hot) h = x; }); });
    if (!h) { lead.setAttribute('opacity', 0); return; }
    var up = h.y < 200;
    var ey = up ? 44 : 368;
    var ex = h.x < 240 ? h.x + 34 : h.x - 34;
    var anchorRight = h.x < 240;
    var tx = anchorRight ? ex + 6 : ex - 6;
    lead.querySelector('.lead-line').setAttribute('d', 'M' + h.x + ' ' + (h.y + (up ? -9 : 9)) + ' L' + ex + ' ' + ey + ' L' + (anchorRight ? ex + 4 : ex - 4) + ' ' + ey);
    var lt = lead.querySelector('.lead-text');
    lt.textContent = h.no + '  ' + h.name;
    lt.setAttribute('x', tx);
    lt.setAttribute('y', ey + 5);
    lt.setAttribute('text-anchor', anchorRight ? 'start' : 'end');
    lead.setAttribute('opacity', 1);
  }

  function setHot(no, fromSvg) {
    hot = no;
    hallsEl.classList.toggle('is-hovering', !!no);
    hallsEl.querySelectorAll('.hall').forEach(function (li) { li.classList.toggle('is-hot', li.getAttribute('data-no') === no); });
    if (!no) {
      var open = hallsEl.querySelector('.hall.is-open');
      if (open) hot = open.getAttribute('data-no');
      hallsEl.classList.remove('is-hovering');
    }
    updateSection();
  }

  function openHall(no) {
    hallsEl.querySelectorAll('.hall').forEach(function (li) {
      var on = li.getAttribute('data-no') === no ? !li.classList.contains('is-open') : false;
      li.classList.toggle('is-open', on);
      li.querySelector('button').setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    var open = hallsEl.querySelector('.hall.is-open');
    hot = open ? open.getAttribute('data-no') : null;
    updateSection();
  }

  function renderHalls() {
    hallsEl.innerHTML = HALLS[floor].map(function (h) {
      return '<li class="hall" data-no="' + h.no + '"><button type="button" aria-expanded="false"><span class="hall-no">' + h.no + '</span><span class="hall-name">' + h.name + '</span><span class="hall-plus" aria-hidden="true"></span></button><div class="hall-body"><div><p>' + h.desc + '</p></div></div></li>';
    }).join('');
    hallsEl.querySelectorAll('.hall').forEach(function (li, i) {
      var no = li.getAttribute('data-no');
      li.querySelector('button').addEventListener('click', function () { openHall(no); });
      li.addEventListener('mouseenter', function () { if (!AM.isTouch) setHot(no); });
      li.addEventListener('mouseleave', function () { if (!AM.isTouch) setHot(null); });
      if (!reduced) li.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: i * 45, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'backwards' });
    });
    var first = hallsEl.querySelector('.hall');
    if (first) openHall(first.getAttribute('data-no'));
  }

  function placePill() {
    var b = seg.querySelector('button[aria-pressed="true"]');
    segPill.style.width = b.offsetWidth + 'px';
    segPill.style.transform = 'translateX(' + (b.offsetLeft - 4) + 'px)';
  }

  function setFloor(f) {
    floor = f;
    segBtns.forEach(function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-floor') === f ? 'true' : 'false'); });
    placePill();
    renderHalls();
  }

  segBtns.forEach(function (b) { b.addEventListener('click', function () { if (+b.getAttribute('data-floor') !== floor) setFloor(+b.getAttribute('data-floor')); }); });
  drawSection();
  setFloor(1);
  window.addEventListener('resize', placePill);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placePill);

  var route = document.querySelector('[data-route] svg');
  var routeMode = '';
  var ROUTES = {
    wide: {
      box: '0 0 640 300',
      paths: [
        { d: 'M40 70 H240 Q252 70 260 78 L330 148 Q338 156 350 156 H420', stroke: 'var(--ink)', w: 2 },
        { d: 'M40 242 H240 Q252 242 260 234 L330 164 Q338 156 350 156 H420', stroke: 'var(--ink)', w: 2 },
        { d: 'M420 156 H590', stroke: 'var(--blue)', w: 2.5 }
      ],
      stops: [
        [40, 70, '용산역', '서울', 0, -20, -18, 'start', false, 0.2],
        [40, 242, '상봉역', '서울', 0, 30, 18, 'start', false, 0.3],
        [420, 156, '춘천역', '', 0, 30, 18, 'middle', false, 1.0],
        [590, 156, '애니메이션박물관', '‘애니메이션박물관 입구’ 하차', 0, -20, -18, 'end', true, 1.8]
      ],
      tags: [[150, 58, 'ITX 청춘 · 1시간 10분', 'middle', 'var(--ink-2)', 0.6], [150, 262, '경춘선 · 1시간 20분', 'middle', 'var(--ink-2)', 0.7], [505, 180, '서면4·5·6 버스', 'middle', 'var(--blue)', 1.5]]
    },
    tall: {
      box: '0 0 360 470',
      paths: [
        { d: 'M64 46 V120 Q64 132 72 140 L172 232 Q180 240 180 252 V262', stroke: 'var(--ink)', w: 2 },
        { d: 'M296 46 V120 Q296 132 288 140 L188 232 Q180 240 180 252 V262', stroke: 'var(--ink)', w: 2 },
        { d: 'M180 262 V396', stroke: 'var(--blue)', w: 2.5 }
      ],
      stops: [
        [64, 46, '용산역', '', 0, -16, 0, 'middle', false, 0.2],
        [296, 46, '상봉역', '', 0, -16, 0, 'middle', false, 0.3],
        [180, 262, '춘천역', '', 18, 5, 0, 'start', false, 1.0],
        [180, 396, '애니메이션박물관', '‘애니메이션박물관 입구’ 하차', 0, 38, 20, 'middle', true, 1.8]
      ],
      tags: [[76, 84, 'ITX 청춘 · 1시간 10분', 'start', 'var(--ink-2)', 0.6], [284, 116, '경춘선 · 1시간 20분', 'end', 'var(--ink-2)', 0.7], [194, 334, '서면4·5·6 버스', 'start', 'var(--blue)', 1.5]]
    }
  };

  function drawRoute() {
    var mode = route.parentNode.clientWidth < 520 ? 'tall' : 'wide';
    if (mode === routeMode) return;
    routeMode = mode;
    var spec = ROUTES[mode];
    var ff = 'Pretendard Variable, Pretendard, sans-serif';
    while (route.firstChild) route.removeChild(route.firstChild);
    route.setAttribute('viewBox', spec.box);
    spec.paths.forEach(function (p, i) {
      var path = el('path', { d: p.d, fill: 'none', stroke: p.stroke, 'stroke-width': p.w, 'stroke-linecap': 'round', class: 'draw' }, route);
      var len = Math.ceil(path.getTotalLength());
      path.style.setProperty('--len', len);
      path.style.transitionDelay = (i === 2 ? 1.1 : i * 0.15) + 's';
    });
    spec.stops.forEach(function (s) {
      var g = el('g', { class: 'stop', style: 'transition-delay:' + s[9] + 's' }, route);
      el('circle', { cx: s[0], cy: s[1], r: s[8] ? 9 : 6, fill: 'var(--paper)', stroke: s[8] ? 'var(--blue)' : 'var(--ink)', 'stroke-width': 2 }, g);
      if (s[8]) el('circle', { cx: s[0], cy: s[1], r: 3.5, fill: 'var(--blue)' }, g);
      var t = el('text', { x: s[0] + s[4], y: s[1] + s[5], 'text-anchor': s[7], 'font-size': 15, 'font-weight': 700, fill: 'var(--ink)', 'font-family': ff }, g);
      t.textContent = s[2];
      if (s[3]) {
        var sub = el('text', { x: s[0] + s[4], y: s[1] + s[5] + s[6], 'text-anchor': s[7], 'font-size': 12, fill: 'var(--ink-3)', 'font-family': ff }, g);
        sub.textContent = s[3];
      }
    });
    spec.tags.forEach(function (tg) {
      var g = el('g', { class: 'stop', style: 'transition-delay:' + tg[5] + 's' }, route);
      var t = el('text', { x: tg[0], y: tg[1], 'text-anchor': tg[3], 'font-size': 12, 'font-weight': 600, fill: tg[4], 'font-family': ff }, g);
      t.textContent = tg[2];
    });
  }
  drawRoute();
  window.addEventListener('resize', drawRoute);

  var ticket = document.querySelector('[data-ticket] .ticket-card');
  if (ticket) {
    var tk = { x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, held: false, px: 0, py: 0, ox: 0, oy: 0, last: 0, tiltX: 0, tiltY: 0, hx: 0, hy: 0, hover: false, raf: 0, lastPX: 0, lastT: 0, pvx: 0 };
    function tkLoop(t) {
      var dt = Math.min(0.033, (t - (tk.last || t)) / 1000 || 0.016);
      tk.last = t;
      if (tk.held) {
        var nx = tk.px - tk.ox, ny = tk.py - tk.oy;
        tk.vx = (nx - tk.x) / Math.max(dt, 0.008);
        tk.vy = (ny - tk.y) / Math.max(dt, 0.008);
        tk.x = nx; tk.y = ny;
        var target = Math.max(-28, Math.min(28, -tk.vx * 0.02));
        tk.va += ((target - tk.a) * 160 - tk.va * 14) * dt;
      } else {
        tk.vx += (-tk.x * 140 - tk.vx * 13) * dt;
        tk.vy += (-tk.y * 140 - tk.vy * 13) * dt;
        tk.x += tk.vx * dt;
        tk.y += tk.vy * dt;
        tk.va += (-tk.a * 90 - tk.va * 5.5 - tk.vx * 0.4) * dt;
      }
      tk.a += tk.va * dt;
      var tx = tk.hover && !tk.held ? tk.hy * -8 : 0, ty = tk.hover && !tk.held ? tk.hx * 10 : 0;
      tk.tiltX += (tx - tk.tiltX) * Math.min(1, dt * 10);
      tk.tiltY += (ty - tk.tiltY) * Math.min(1, dt * 10);
      ticket.style.transform = 'perspective(700px) translate3d(' + tk.x.toFixed(2) + 'px,' + tk.y.toFixed(2) + 'px,0) rotate(' + tk.a.toFixed(2) + 'deg) rotateX(' + tk.tiltX.toFixed(2) + 'deg) rotateY(' + tk.tiltY.toFixed(2) + 'deg)';
      var resting = !tk.held && Math.abs(tk.x) < 0.05 && Math.abs(tk.y) < 0.05 && Math.abs(tk.vx) < 0.05 && Math.abs(tk.vy) < 0.05 && Math.abs(tk.a) < 0.02 && Math.abs(tk.va) < 0.02 && Math.abs(tk.tiltX - tx) < 0.02 && Math.abs(tk.tiltY - ty) < 0.02;
      if (resting) { tk.raf = 0; tk.last = 0; return; }
      tk.raf = requestAnimationFrame(tkLoop);
    }
    function kick() { if (!tk.raf) { tk.last = 0; tk.raf = requestAnimationFrame(tkLoop); } }
    ticket.addEventListener('pointerdown', function (e) {
      tk.held = true;
      tk.px = e.clientX; tk.py = e.clientY;
      tk.ox = e.clientX - tk.x; tk.oy = e.clientY - tk.y;
      try { ticket.setPointerCapture(e.pointerId); } catch (err) {}
      kick();
    });
    ticket.addEventListener('pointermove', function (e) {
      var r = ticket.getBoundingClientRect();
      tk.hx = (e.clientX - r.left) / r.width - 0.5;
      tk.hy = (e.clientY - r.top) / r.height - 0.5;
      tk.hover = true;
      if (tk.held) { tk.px = e.clientX; tk.py = e.clientY; }
      kick();
    });
    ticket.addEventListener('pointerleave', function () { tk.hover = false; kick(); });
    function drop() { if (!tk.held) return; tk.held = false; kick(); }
    ticket.addEventListener('pointerup', drop);
    ticket.addEventListener('pointercancel', drop);
  }

  var credits = document.querySelector('[data-credits]');
  fetch('scenes/disc/credits.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (list) {
    if (!list || !list.length) return;
    credits.innerHTML = list.map(function (c) {
      var label = '회전 원반 「' + (c.titleKo || c.title) + '」' + (c.year ? ' ' + c.year : '');
      var src = c.source ? ' <a href="' + c.source + '" target="_blank" rel="noopener">원본</a>' : '';
      return '<li>' + label + ' — ' + (c.collection || '') + ' · 공개 도메인' + src + '</li>';
    }).join('');
  }).catch(function () {});

  var strip = document.querySelector('[data-strip]');
  if (strip) {
    var track = strip.querySelector('.strip-track');
    var frameEls = Array.prototype.slice.call(track.children);
    var stripNo = document.querySelector('[data-strip-no]');
    var stripDisc = track.querySelector('.frame-disc');
    var S = { x: 0, v: 0, bend: 0, held: false, id: null, axis: '', sx: 0, sy: 0, lastX: 0, samples: [], min: 0, max: 0, raf: 0, lt: 0, entered: false };
    var stripClamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

    function stripBounds() {
      var w = strip.clientWidth;
      var inner = Math.min(1240, w - (w <= 900 ? 40 : 64));
      var pad = Math.max(20, (w - inner) / 2);
      S.max = pad;
      S.min = Math.min(pad, w - track.scrollWidth - pad);
    }

    function stripRender() {
      track.style.transform = 'translate3d(' + S.x.toFixed(2) + 'px,0,0)';
      strip.style.setProperty('--sprocket', (S.x % 28).toFixed(1) + 'px');
      var w = strip.clientWidth, best = 0, bestD = 1e9;
      for (var i = 0; i < frameEls.length; i++) {
        var f = frameEls[i];
        var d = (f.offsetLeft + S.x + f.offsetWidth / 2 - w / 2) / w;
        var ry = S.bend - d * 8;
        f.style.transform = 'translate3d(0,' + (d * d * 18).toFixed(1) + 'px,0) rotateY(' + ry.toFixed(2) + 'deg)';
        if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = i; }
      }
      if (stripNo) stripNo.textContent = String(best + 1).padStart(2, '0');
      if (stripDisc) stripDisc.style.transform = 'rotate(' + (-S.x * 0.8).toFixed(1) + 'deg)';
    }

    function stripLoop(t) {
      S.raf = 0;
      var dt = Math.min(0.033, S.lt ? (t - S.lt) / 1000 : 0.016);
      S.lt = t;
      if (!S.held) {
        S.x += S.v * dt;
        S.v *= Math.exp(-3 * dt);
        var edge = S.x > S.max ? S.max : S.x < S.min ? S.min : null;
        if (edge !== null) S.v += ((edge - S.x) * 170 - S.v * 26) * dt;
      }
      var target = stripClamp(-S.v * 0.011, -14, 14);
      S.bend += (target - S.bend) * Math.min(1, dt * 9);
      stripRender();
      var moving = S.held || Math.abs(S.v) > 1.5 || S.x > S.max + 0.3 || S.x < S.min - 0.3 || Math.abs(S.bend) > 0.04;
      if (moving) S.raf = requestAnimationFrame(stripLoop); else S.lt = 0;
    }

    function stripKick() { if (!S.raf) S.raf = requestAnimationFrame(stripLoop); }

    function stripGrab(e) {
      S.held = true;
      strip.classList.add('is-drag');
      try { strip.setPointerCapture(e.pointerId); } catch (err) {}
    }

    strip.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      S.id = e.pointerId;
      S.sx = e.clientX; S.sy = e.clientY; S.lastX = e.clientX;
      S.samples = [{ x: e.clientX, t: performance.now() }];
      S.axis = e.pointerType === 'mouse' ? 'x' : '';
      if (S.axis === 'x') { S.v = 0; stripGrab(e); stripKick(); }
    });

    strip.addEventListener('pointermove', function (e) {
      if (e.pointerId !== S.id) return;
      if (!S.axis) {
        var ax = Math.abs(e.clientX - S.sx), ay = Math.abs(e.clientY - S.sy);
        if (ax < 6 && ay < 6) return;
        S.axis = ax > ay ? 'x' : 'y';
        if (S.axis === 'x') { S.v = 0; stripGrab(e); }
      }
      if (S.axis !== 'x') return;
      var dx = e.clientX - S.lastX;
      S.lastX = e.clientX;
      S.x += (S.x > S.max || S.x < S.min) ? dx * 0.38 : dx;
      var now = performance.now();
      S.samples.push({ x: e.clientX, t: now });
      while (S.samples.length > 2 && now - S.samples[0].t > 100) S.samples.shift();
      S.v = 0;
      stripKick();
    });

    function stripRelease(e) {
      if (e.pointerId !== S.id) return;
      S.id = null;
      if (!S.held) return;
      S.held = false;
      strip.classList.remove('is-drag');
      var a = S.samples[0], b = S.samples[S.samples.length - 1];
      var dt = Math.max(0.016, (b.t - a.t) / 1000);
      S.v = performance.now() - b.t > 120 ? 0 : stripClamp((b.x - a.x) / dt, -4200, 4200);
      stripKick();
    }
    strip.addEventListener('pointerup', stripRelease);
    strip.addEventListener('pointercancel', stripRelease);

    strip.addEventListener('wheel', function (e) {
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
      if (!d) return;
      e.preventDefault();
      S.v -= d * 7;
      stripKick();
    }, { passive: false });

    strip.setAttribute('tabindex', '0');
    strip.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { S.v -= 900; stripKick(); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { S.v += 900; stripKick(); e.preventDefault(); }
    });

    stripBounds();
    S.x = S.max;
    stripRender();
    window.addEventListener('resize', function () { stripBounds(); S.x = stripClamp(S.x, S.min, S.max); stripRender(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { stripBounds(); stripRender(); });

    new IntersectionObserver(function (entries, io) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || S.entered) return;
        S.entered = true;
        io.disconnect();
        if (reduced) return;
        S.x = S.max + strip.clientWidth * 0.32;
        S.v = -900;
        stripKick();
      });
    }, { threshold: 0.35 }).observe(strip);
  }

  if (!AM.isTouch && !reduced) {
    document.querySelectorAll('.btn').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.classList.add('is-magnet');
        b.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + 'px');
        b.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * 0.32).toFixed(1) + 'px');
      });
      b.addEventListener('pointerleave', function () {
        b.classList.remove('is-magnet');
        b.style.setProperty('--mx', '0px');
        b.style.setProperty('--my', '0px');
      });
    });
  }

  var hud = document.querySelector('.hud');
  var hudCut = document.querySelector('[data-hud-cut]');
  var hudTc = document.querySelector('[data-hud-tc]');
  var CUTS = [['top', '컷 01 · 원반'], ['story', '컷 01 · 걸어온 길'], ['pins', '컷 02 · 핀스크린'], ['ball', '컷 03 · 공 튀기기'], ['halls', '컷 04 · 전시 안내'], ['visit', '컷 05 · 관람 안내'], ['way', '컷 06 · 오시는 길']];
  var cutEls = CUTS.map(function (c) { return [document.getElementById(c[0]), c[1]]; });
  var hudTick = false;
  function updateHud() {
    hudTick = false;
    var y = window.scrollY;
    hud.classList.toggle('is-on', y > 200);
    var frames = Math.floor(y / 12);
    var ff = frames % 24, sec = Math.floor(frames / 24), mm = Math.floor(sec / 60), ss = sec % 60;
    hudTc.textContent = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + ':' + String(ff).padStart(2, '0');
    var label = CUTS[0][1];
    for (var i = 0; i < cutEls.length; i++) if (cutEls[i][0] && cutEls[i][0].getBoundingClientRect().top < innerHeight * 0.5) label = cutEls[i][1];
    if (hudCut.textContent !== label) hudCut.textContent = label;
  }
  window.addEventListener('scroll', function () { if (!hudTick) { hudTick = true; requestAnimationFrame(updateHud); } }, { passive: true });
  updateHud();

  window.AM.autoMount();
})();
