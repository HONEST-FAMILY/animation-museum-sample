(function () {
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(pointer: coarse)').matches;

  function fitCanvas(canvas, maxDpr) {
    var dpr = Math.min(window.devicePixelRatio || 1, maxDpr || 2);
    var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    return false;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  var mounted = new Map();

  function mount(root) {
    if (mounted.has(root)) return mounted.get(root);
    var name = root.getAttribute('data-scene');
    var factory = window.AM.scenes[name];
    if (!factory) return null;
    var api = factory(root, { reducedMotion: reducedMotion, isTouch: isTouch }) || {};
    mounted.set(root, api);
    return api;
  }

  function autoMount(selector) {
    var roots = Array.prototype.slice.call(document.querySelectorAll(selector || '[data-scene]'));
    if (!('IntersectionObserver' in window)) {
      roots.forEach(function (r) { var api = mount(r); if (api && api.resume) api.resume(); });
      return;
    }
    var near = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) mount(e.target);
      });
    }, { rootMargin: '60% 0px 60% 0px' });
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var api = mount(e.target);
        if (!api) return;
        if (e.isIntersecting) { if (api.resume) api.resume(); }
        else if (api.pause) api.pause();
      });
    }, { threshold: 0.02 });
    roots.forEach(function (r) { near.observe(r); seen.observe(r); });
    document.addEventListener('visibilitychange', function () {
      mounted.forEach(function (api, root) {
        if (document.hidden) { if (api.pause) api.pause(); }
        else {
          var b = root.getBoundingClientRect();
          if (b.bottom > 0 && b.top < innerHeight && api.resume) api.resume();
        }
      });
    });
  }

  window.AM = window.AM || {};
  window.AM.scenes = window.AM.scenes || {};
  window.AM.fitCanvas = fitCanvas;
  window.AM.cssVar = cssVar;
  window.AM.reducedMotion = reducedMotion;
  window.AM.isTouch = isTouch;
  window.AM.mount = mount;
  window.AM.autoMount = autoMount;
})();
