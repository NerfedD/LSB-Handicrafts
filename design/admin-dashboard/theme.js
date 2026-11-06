/* Applies the saved theme before first paint, and follows changes made in
   any other artboard (they share storage, so one toggle flips them all). */
(function () {
  function apply() {
    var t = null;
    try { t = window.localStorage.getItem('lsb-theme'); } catch (e) { /* storage blocked: stay light */ }
    var dark = t === 'dark' || (t === 'device' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }
  apply();
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key === 'lsb-theme') {
      var root = document.documentElement;
      root.classList.add('theme-anim');
      apply();
      setTimeout(function () { root.classList.remove('theme-anim'); }, 300);
    }
  });
})();
