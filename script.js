(function () {
  'use strict';

  /* ---- Two settings to fill in (see the notes that came with this file) ---- */
  /* Formspree: your form ID, the last part of https://formspree.io/f/xxxxxxxx */
  var FORMSPREE_ID = '';
  /* Search service: the address of your Azure Function, for real Google results and images */
  var SEARCH_API = '';

  var body = document.body;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobileQuery = window.matchMedia('(max-width: 760px)');
  function isMobile() { return mobileQuery.matches; }

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function esc(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function plainText(html) {
    return new DOMParser().parseFromString(html, 'text/html').body.textContent;
  }

  /* ======================================================
     Settings (remembered in this browser)
     ====================================================== */
  var defaults = { wall: 'water', hour24: false, seconds: false, dock: 58, magnify: true, notify: true };
  var prefs = {};

  (function loadPrefs() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('pm-prefs') || '{}') || {}; } catch (e) { saved = {}; }
    Object.keys(defaults).forEach(function (k) { prefs[k] = saved[k] !== undefined ? saved[k] : defaults[k]; });
  })();

  function savePrefs() {
    try { localStorage.setItem('pm-prefs', JSON.stringify(prefs)); } catch (e) { /* storage unavailable */ }
  }

  /* ======================================================
     Loading screen
     ====================================================== */
  var loader = $('#loader');
  var hello = $('#hello');
  var words = ['hello', 'habari', 'oli otya', 'hola', 'bonjour', 'hallo', 'hello'];
  var wordIndex = 0;
  var finished = false;

  var wordTimer = setInterval(function () {
    wordIndex = (wordIndex + 1) % words.length;
    hello.classList.add('swap');
    setTimeout(function () {
      hello.textContent = words[wordIndex];
      hello.classList.remove('swap');
    }, 250);
  }, 480);

  function finishLoading() {
    if (finished) return;
    finished = true;
    clearInterval(wordTimer);
    loader.classList.add('done');
    body.classList.add('ready');
    setTimeout(function () { openApp('whoami'); }, 700);
    setTimeout(function () {
      notify('Welcome', 'Paul\'s portfolio is ready. Open anything from the Dock.', 'whoami');
    }, 2300);
  }

  setTimeout(finishLoading, 3300);
  $('#skip').addEventListener('click', finishLoading);

  /* ======================================================
     Windows
     ====================================================== */
  var desk = $('#desk');
  var dock = $('#dock');
  var appname = $('#appname');

  var apps = {
    whoami:   { label: 'Finder',             w: 1120, h: 790 },
    journey:  { label: 'Journey',            w: 980,  h: 640 },
    projects: { label: 'Projects',           w: 1020, h: 660 },
    terminal: { label: 'Terminal',           w: 800,  h: 520 },
    safari:   { label: 'Safari',             w: 1040, h: 680 },
    reach:    { label: 'Mail',               w: 920,  h: 620 },
    calendar: { label: 'Calendar',           w: 900,  h: 660 },
    calc:     { label: 'Calculator',         w: 330,  h: 490 },
    prefs:    { label: 'System Preferences', w: 580,  h: 600 }
  };

  var wins = {};
  var zTop = 10;
  var current = null;

  Object.keys(apps).forEach(function (key) {
    wins[key] = {
      el: $('#win-' + key),
      slot: $('.slot[data-app="' + key + '"]'),
      closed: true,
      min: false,
      zoomed: false,
      placed: false,
      back: null
    };
  });

  function deskSize() { return { w: desk.clientWidth, h: desk.clientHeight }; }

  function openCount() {
    return Object.keys(wins).filter(function (k) { return !wins[k].closed; }).length;
  }

  function setBox(el, l, t, w, h) {
    el.style.left = l + 'px';
    el.style.top = t + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  }

  function place(key) {
    var size = deskSize();
    var a = apps[key];
    var n = openCount();
    var w = Math.min(a.w, size.w - 40);
    var h = Math.min(a.h, size.h - 112);
    setBox(wins[key].el,
      Math.max(10, (size.w - w) / 2 + ((n * 30) % 150) - 60),
      Math.max(8, 10 + (n * 26) % 110), w, h);
  }

  function focusApp(key) {
    zTop += 1;
    Object.keys(wins).forEach(function (k) { wins[k].el.classList.remove('front'); });
    wins[key].el.style.zIndex = zTop;
    wins[key].el.classList.add('front');
    current = key;
    appname.textContent = apps[key].label;
  }

  function topmost() {
    var best = null, bestZ = -1;
    Object.keys(wins).forEach(function (k) {
      var w = wins[k];
      if (w.closed || w.min) return;
      var z = parseInt(w.el.style.zIndex || '0', 10);
      if (z > bestZ) { bestZ = z; best = k; }
    });
    return best;
  }

  function refocus() {
    var next = topmost();
    if (next) focusApp(next);
    else {
      current = null;
      appname.textContent = 'Finder';
      Object.keys(wins).forEach(function (k) { wins[k].el.classList.remove('front'); });
    }
  }

  function updateDock() {
    Object.keys(wins).forEach(function (k) {
      wins[k].slot.classList.toggle('running', !wins[k].closed);
    });
  }

  function bounce(key) {
    var slot = wins[key].slot;
    slot.classList.add('bounce');
    setTimeout(function () { slot.classList.remove('bounce'); }, 1200);
  }

  /* The genie effect: the window narrows toward its Dock icon and shrinks into it. */
  function genieFrames(el, slot) {
    var r = el.getBoundingClientRect();
    var s = slot.getBoundingClientRect();
    var ox = s.left + s.width / 2 - r.left;
    var oy = s.top + s.height / 2 - r.top;
    var pct = Math.max(6, Math.min(94, ox / r.width * 100));
    function poly(spread) {
      return 'polygon(0% 0%, 100% 0%, ' + Math.min(100, pct + spread).toFixed(1) + '% 100%, ' + Math.max(0, pct - spread).toFixed(1) + '% 100%)';
    }
    el.style.transformOrigin = ox.toFixed(1) + 'px ' + oy.toFixed(1) + 'px';
    return [
      { transform: 'scale(1, 1)',       clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', opacity: 1, offset: 0 },
      { transform: 'scale(0.74, 0.8)',  clipPath: poly(26), opacity: 1, offset: 0.55 },
      { transform: 'scale(0.04, 0.04)', clipPath: poly(3),  opacity: 0.15, offset: 1 }
    ];
  }

  function runGenie(el, slot, reverse, done) {
    var anim = el.animate(genieFrames(el, slot), {
      duration: reduce ? 1 : (reverse ? 640 : 720),
      easing: 'cubic-bezier(0.6, 0.05, 0.85, 0.45)',
      direction: reverse ? 'reverse' : 'normal',
      fill: 'both'
    });
    anim.onfinish = function () {
      if (done) done();
      anim.cancel();
      el.style.transformOrigin = '';
    };
  }

  function openApp(key) {
    var w = wins[key];
    if (!w) return;
    if (w.min) {
      restoreApp(key);
    } else if (w.closed) {
      if (!w.placed) { place(key); w.placed = true; }
      w.closed = false;
      w.el.classList.remove('closed');
      runGenie(w.el, w.slot, true);
      bounce(key);
      if (key === 'terminal') setTimeout(function () { $('#termIn').focus(); }, 500);
    }
    focusApp(key);
    updateDock();
  }

  function closeApp(key) {
    var w = wins[key];
    if (!w || w.closed) return;
    w.closed = true;
    w.min = false;
    var el = w.el;
    el.style.pointerEvents = 'none';
    var a = el.animate(
      [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.9)' }],
      { duration: reduce ? 1 : 240, easing: 'ease-in', fill: 'forwards' }
    );
    a.onfinish = function () {
      if (w.closed) el.classList.add('closed');
      a.cancel();
      el.style.pointerEvents = '';
    };
    updateDock();
    refocus();
  }

  function minimizeApp(key) {
    var w = wins[key];
    if (!w || w.closed || w.min) return;
    w.min = true;
    w.el.style.pointerEvents = 'none';
    runGenie(w.el, w.slot, false, function () {
      if (w.min) w.el.classList.add('minimized');
      w.el.style.pointerEvents = '';
    });
    refocus();
  }

  function restoreApp(key) {
    var w = wins[key];
    if (!w || !w.min) return;
    w.min = false;
    w.el.classList.remove('minimized');
    runGenie(w.el, w.slot, true);
    focusApp(key);
  }

  function zoomApp(key) {
    var w = wins[key];
    if (!w || w.closed || w.min || isMobile()) return;
    var el = w.el;
    var size = deskSize();
    el.classList.add('animating');
    setTimeout(function () { el.classList.remove('animating'); }, 540);
    if (!w.zoomed) {
      w.back = { l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      setBox(el, 10, 8, size.w - 20, size.h - 108);
      w.zoomed = true;
    } else {
      var b = w.back;
      setBox(el, b.l, b.t, b.w, b.h);
      w.zoomed = false;
    }
  }

  Object.keys(wins).forEach(function (key) {
    var w = wins[key];
    var el = w.el;
    var bar = $('.titlebar', el);

    el.addEventListener('pointerdown', function () { if (current !== key) focusApp(key); });

    $$('.light', el).forEach(function (button) {
      button.addEventListener('click', function (e) {
        e.stopPropagation();
        var act = button.getAttribute('data-act');
        if (act === 'close') closeApp(key);
        else if (act === 'min') minimizeApp(key);
        else zoomApp(key);
      });
    });

    bar.addEventListener('dblclick', function (e) {
      if (e.target.closest('.lights')) return;
      zoomApp(key);
    });

    /* Drag by the title bar */
    bar.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || isMobile() || e.target.closest('.lights')) return;
      var d = desk.getBoundingClientRect();
      if (w.zoomed) {
        el.style.width = w.back.w + 'px';
        el.style.height = w.back.h + 'px';
        w.zoomed = false;
      }
      var r = el.getBoundingClientRect();
      var offX = e.clientX - r.left;
      var offY = e.clientY - r.top;
      bar.setPointerCapture(e.pointerId);

      function move(ev) {
        var x = ev.clientX - d.left - offX;
        var y = ev.clientY - d.top - offY;
        x = Math.max(-el.offsetWidth + 140, Math.min(d.width - 140, x));
        y = Math.max(0, Math.min(d.height - 60, y));
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      }
      function up() {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        bar.removeEventListener('pointercancel', up);
      }
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
    });

    /* Resize from the corner */
    var grip = $('.grip', el);
    grip.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || isMobile()) return;
      e.preventDefault();
      e.stopPropagation();
      focusApp(key);
      w.zoomed = false;
      var startX = e.clientX, startY = e.clientY;
      var startW = el.offsetWidth, startH = el.offsetHeight;
      grip.setPointerCapture(e.pointerId);

      function move(ev) {
        el.style.width = Math.max(300, startW + ev.clientX - startX) + 'px';
        el.style.height = Math.max(280, startH + ev.clientY - startY) + 'px';
      }
      function up() {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
      }
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });
  });

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-open]');
    if (!trigger) return;
    openApp(trigger.getAttribute('data-open'));
  });

  /* ======================================================
     Dock (smooth magnification)
     ====================================================== */
  var slots = $$('.slot', dock);
  var centers = [];
  var targets = slots.map(function () { return 1; });
  var scales = slots.map(function () { return 1; });
  var frame = null;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function animateDock() {
    var moving = false;
    slots.forEach(function (slot, i) {
      var diff = targets[i] - scales[i];
      if (Math.abs(diff) > 0.002) { scales[i] += diff * 0.2; moving = true; }
      else scales[i] = targets[i];
      slot.style.setProperty('--s', scales[i].toFixed(3));
    });
    frame = moving ? requestAnimationFrame(animateDock) : null;
  }

  function kick() { if (!frame) frame = requestAnimationFrame(animateDock); }

  slots.forEach(function (slot) {
    slot.addEventListener('click', function () {
      var key = slot.getAttribute('data-app');
      if (key === 'trash') {
        showSheet('Trash', '<p>The Trash is empty.</p>');
        return;
      }
      if (key === current && !wins[key].closed && !wins[key].min) { bounce(key); return; }
      openApp(key);
    });
  });

  if (fine) {
    dock.addEventListener('mouseenter', function () {
      centers = slots.map(function (slot) {
        var r = slot.getBoundingClientRect();
        return r.left + r.width / 2;
      });
    });

    dock.addEventListener('mousemove', function (e) {
      if (!prefs.magnify || !centers.length) return;
      slots.forEach(function (slot, i) {
        var k = Math.max(0, 1 - Math.abs(e.clientX - centers[i]) / 140);
        targets[i] = 1 + 0.75 * k * k;
      });
      kick();
    });

    dock.addEventListener('mouseleave', function () {
      targets = slots.map(function () { return 1; });
      kick();
    });
  }

  /* Sends a message to Paul's inbox through Formspree. */
  function sendToPaul(data) {
    if (!FORMSPREE_ID) return Promise.reject(new Error('not-configured'));
    return fetch('https://formspree.io/f/' + encodeURIComponent(FORMSPREE_ID), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok || body.error || (body.errors && body.errors.length)) throw new Error('failed');
        return body;
      });
    });
  }

  /* ======================================================
     Notifications
     ====================================================== */
  var toasts = $('#toasts');

  function removeToast(t) {
    if (!t || t.getAttribute('data-gone')) return;
    t.setAttribute('data-gone', '1');
    t.classList.remove('in');
    t.classList.add('out');
    setTimeout(function () { t.remove(); }, 420);
  }

  function notify(title, text, icon, force) {
    if (!prefs.notify && !force) return;
    var t = element('div', 'toast');
    t.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#i-' + (icon || 'whoami') + '"/></svg>' +
      '<div class="tbody"><strong></strong><span></span></div><em>now</em>';
    $('strong', t).textContent = title;
    $('.tbody span', t).textContent = text;
    toasts.appendChild(t);
    while (toasts.children.length > 3) removeToast(toasts.firstChild);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('in'); }); });
    var timer = setTimeout(function () { removeToast(t); }, 5200);
    t.addEventListener('click', function () { clearTimeout(timer); removeToast(t); });
  }

  /* ======================================================
     Message sheet
     ====================================================== */
  var sheetBack = $('#sheetBack');

  function hideSheet() { sheetBack.hidden = true; }

  function showSheet(title, html, buttons) {
    $('#sheetTitle').textContent = title;
    $('#sheetText').innerHTML = html;
    var actions = $('#sheetActions');
    actions.innerHTML = '';
    (buttons || [{ label: 'OK' }]).forEach(function (b, i, all) {
      var button = element('button', 'gel' + (b.ghost ? ' ghost' : ''), b.label);
      button.type = 'button';
      button.addEventListener('click', function () { hideSheet(); if (b.fn) b.fn(); });
      actions.appendChild(button);
      if (i === all.length - 1) setTimeout(function () { button.focus(); }, 30);
    });
    sheetBack.hidden = false;
  }

  function confirmSheet(title, text, label, fn) {
    showSheet(title, '<p>' + text + '</p>', [{ label: 'Cancel', ghost: true }, { label: label, fn: fn }]);
  }

  sheetBack.addEventListener('click', function (e) { if (e.target === sheetBack) hideSheet(); });

  function showHelp() {
    showSheet('Portfolio Help',
      '<p><b>Dock:</b> click an icon to open a window. Hover to see it grow.</p>' +
      '<p><b>Windows:</b> drag the title bar to move, drag the corner to resize, double-click the title bar to zoom.</p>' +
      '<p><b>Buttons:</b> red closes, yellow shrinks the window into the Dock, green zooms.</p>' +
      '<p><b>Power:</b> the button in the top right can sleep, restart or shut down.</p>' +
      '<p><b>Terminal:</b> type <code>help</code> to see what it can do.</p>');
  }

  /* ======================================================
     Power: sleep, restart, power off
     ====================================================== */
  var sleepVeil = $('#sleepVeil');
  var restartVeil = $('#restartVeil');
  var offVeil = $('#offVeil');

  function showVeil(v) {
    v.hidden = false;
    void v.offsetWidth;
    v.classList.add('on');
  }

  function sleepNow() { showVeil(sleepVeil); }

  function wake() {
    if (sleepVeil.hidden) return;
    sleepVeil.classList.remove('on');
    setTimeout(function () { sleepVeil.hidden = true; }, 700);
  }

  sleepVeil.addEventListener('click', wake);

  function restartNow() {
    showVeil(restartVeil);
    setTimeout(function () { location.reload(); }, 1900);
  }

  function powerOffNow() {
    showVeil(offVeil);
    setTimeout(function () {
      try { window.close(); } catch (e) { /* the browser may refuse */ }
      setTimeout(function () {
        $('#offMsg').textContent = 'Your computer is off. You can close this tab.';
        $('#powerOn').hidden = false;
      }, 450);
    }, 1000);
  }

  $('#powerOn').addEventListener('click', function () { location.reload(); });

  function askRestart() { confirmSheet('Restart', 'Are you sure you want to restart your computer now?', 'Restart', restartNow); }
  function askPowerOff() { confirmSheet('Shut Down', 'Are you sure you want to shut down your computer now?', 'Shut Down', powerOffNow); }

  /* ======================================================
     Menu bar
     ====================================================== */
  var dropdown = $('#dropdown');
  var openMenu = null;

  function arrange() {
    var n = 0;
    Object.keys(wins).forEach(function (k) {
      var w = wins[k];
      if (w.closed || w.min) return;
      var size = deskSize();
      var a = apps[k];
      var width = Math.min(a.w, size.w - 40);
      var height = Math.min(a.h, size.h - 112);
      w.el.classList.add('animating');
      setBox(w.el, Math.max(10, (size.w - width) / 2 + n * 30 - 60), 10 + n * 26, width, height);
      w.zoomed = false;
      (function (el) { setTimeout(function () { el.classList.remove('animating'); }, 540); })(w.el);
      n += 1;
    });
  }

  function minimizeAll() {
    var i = 0;
    Object.keys(wins).forEach(function (k) {
      if (wins[k].closed || wins[k].min) return;
      setTimeout(function () { minimizeApp(k); }, i * 90);
      i += 1;
    });
  }

  function showAll() {
    var i = 0;
    Object.keys(wins).forEach(function (k) {
      if (!wins[k].min) return;
      setTimeout(function () { restoreApp(k); }, i * 90);
      i += 1;
    });
  }

  var menus = {
    apple: [
      ['About Paul Marvin', function () { openApp('whoami'); }],
      ['System Preferences...', function () { openApp('prefs'); }],
      '-',
      ['Sleep', sleepNow],
      ['Restart...', askRestart],
      ['Shut Down...', askPowerOff]
    ],
    file: [
      ['Close Window', function () { if (current) closeApp(current); }],
      ['Minimize Window', function () { if (current) minimizeApp(current); }],
      '-',
      ['Open Journey', function () { openApp('journey'); }],
      ['Open Projects', function () { openApp('projects'); }],
      ['Open Mail', function () { openApp('reach'); }]
    ],
    edit: [
      ['Undo', null], '-', ['Cut', null], ['Copy', null], ['Paste', null], ['Select All', null]
    ],
    view: [
      ['Zoom Window', function () { if (current) zoomApp(current); }],
      ['Arrange Windows', arrange],
      ['Minimize All', minimizeAll],
      ['Show All Windows', showAll]
    ],
    special: [
      ['Empty Trash...', function () { showSheet('Trash', '<p>The Trash is empty.</p>'); }],
      '-',
      ['Sleep', sleepNow],
      ['Restart...', askRestart],
      ['Shut Down...', askPowerOff]
    ],
    help: [['Portfolio Help', showHelp]],
    power: [
      ['Sleep', sleepNow],
      ['Restart...', askRestart],
      ['Power Off...', askPowerOff]
    ]
  };

  function closeMenu() {
    dropdown.hidden = true;
    if (openMenu) openMenu.classList.remove('open');
    openMenu = null;
  }

  function showMenu(button) {
    var list = menus[button.getAttribute('data-menu')];
    if (!list) return;
    dropdown.innerHTML = '';
    list.forEach(function (item) {
      if (item === '-') { dropdown.appendChild(element('div', 'msep')); return; }
      var row = element('button', 'mi');
      row.type = 'button';
      row.appendChild(element('span', '', item[0]));
      if (!item[1]) row.disabled = true;
      row.addEventListener('click', function () { closeMenu(); item[1](); });
      dropdown.appendChild(row);
    });
    var r = button.getBoundingClientRect();
    dropdown.style.left = Math.max(4, Math.min(r.left, window.innerWidth - 244)) + 'px';
    dropdown.hidden = false;
    dropdown.style.animation = 'none';
    void dropdown.offsetWidth;
    dropdown.style.animation = '';
    if (openMenu) openMenu.classList.remove('open');
    openMenu = button;
    button.classList.add('open');
  }

  $$('.menu').forEach(function (button) {
    button.addEventListener('click', function (e) {
      e.stopPropagation();
      if (openMenu === button) closeMenu(); else showMenu(button);
    });
    button.addEventListener('mouseenter', function () {
      if (openMenu && openMenu !== button) showMenu(button);
    });
  });

  document.addEventListener('click', closeMenu);

  document.addEventListener('keydown', function (e) {
    if (!sleepVeil.hidden) { wake(); return; }
    if (e.key === 'Escape') { closeMenu(); hideSheet(); }
  });

  /* ======================================================
     Live clock, date and Calendar
     ====================================================== */
  var cdate = $('#cdate');
  var ctime = $('#ctime');
  var lastDay = -1;

  function hourCycle() { return prefs.hour24 ? 'h23' : 'h12'; }

  function offsetText(d) {
    var m = -d.getTimezoneOffset();
    var sign = m >= 0 ? '+' : '-';
    m = Math.abs(m);
    return 'UTC' + sign + ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
  }

  function zoneName() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time'; } catch (e) { return 'Local time'; }
  }

  var calView = { y: 0, m: 0 };
  var picked = new Date();
  picked = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate());
  calView.y = picked.getFullYear();
  calView.m = picked.getMonth();

  function updatePick() {
    var now = new Date();
    var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var diff = Math.round((picked - t0) / 86400000);
    var label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' :
      diff > 0 ? 'In ' + diff + ' days' : Math.abs(diff) + ' days ago';
    $('#calPick').textContent = picked.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + label;
  }

  function renderCal() {
    var now = new Date();
    var grid = $('#calGrid');
    $('#calMonth').textContent = new Date(calView.y, calView.m, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
    grid.innerHTML = '';
    for (var i = 0; i < 7; i++) {
      grid.appendChild(element('div', 'dow', new Date(2023, 0, 1 + i).toLocaleDateString([], { weekday: 'short' })));
    }
    var first = new Date(calView.y, calView.m, 1).getDay();
    var days = new Date(calView.y, calView.m + 1, 0).getDate();
    for (var b = 0; b < first; b++) grid.appendChild(element('span', 'day blank'));
    for (var d = 1; d <= days; d++) {
      (function (day) {
        var cell = element('button', 'day', String(day));
        cell.type = 'button';
        if (day === now.getDate() && calView.m === now.getMonth() && calView.y === now.getFullYear()) cell.classList.add('today');
        if (day === picked.getDate() && calView.m === picked.getMonth() && calView.y === picked.getFullYear()) cell.classList.add('sel');
        var cellDate = new Date(calView.y, calView.m, day);
        if (cellDate < startOfDay(now)) cell.classList.add('past');
        if (hasRequestOn(cellDate)) cell.classList.add('has');
        cell.addEventListener('click', function () {
          picked = new Date(calView.y, calView.m, day);
          renderCal();
        });
        grid.appendChild(cell);
      })(d);
    }
    updatePick();
    updateBook();
  }

  function updateCalSide(now) {
    $('#calTime').textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hourCycle: hourCycle() });
    $('#calDate').textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('#calZone').textContent = zoneName() + ' · ' + offsetText(now);
  }

  $('#calPrev').addEventListener('click', function () {
    calView.m -= 1;
    if (calView.m < 0) { calView.m = 11; calView.y -= 1; }
    renderCal();
  });
  $('#calNext').addEventListener('click', function () {
    calView.m += 1;
    if (calView.m > 11) { calView.m = 0; calView.y += 1; }
    renderCal();
  });
  $('#calToday').addEventListener('click', function () {
    var n = new Date();
    calView.y = n.getFullYear();
    calView.m = n.getMonth();
    picked = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    renderCal();
  });

  /* ======================================================
     Ask Paul to contact you (booking)
     ====================================================== */
  var bookForm = $('#bookForm');
  var bkTime = $('#bkTime');
  var bkSend = $('#bkSend');
  var bkStatus = $('#bkStatus');
  var REQ_KEY = 'pm-requests';
  var requests = [];
  var bkSending = false;
  var methodLabels = { email: 'email', call: 'a phone call', whatsapp: 'WhatsApp' };

  try {
    var savedReqs = JSON.parse(localStorage.getItem(REQ_KEY) || '[]');
    if (Array.isArray(savedReqs)) {
      requests = savedReqs.filter(function (r) { return r && typeof r.when === 'number'; });
    }
  } catch (e) { requests = []; }

  function saveRequests() {
    try { localStorage.setItem(REQ_KEY, JSON.stringify(requests.slice(-20))); } catch (e) { /* storage unavailable */ }
  }

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function hasRequestOn(date) {
    return requests.some(function (r) { return sameDay(new Date(r.when), date); });
  }

  function bkSay(text, bad) {
    bkStatus.textContent = text;
    bkStatus.classList.toggle('bad', !!bad);
  }

  function longWhen(date, zone) {
    var o = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
    if (zone) o.timeZone = zone;
    return date.toLocaleString('en-GB', o);
  }

  function shortWhen(date) {
    return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ' at ' +
      date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hourCycle: hourCycle() });
  }

  function gcalLink(start, title, details) {
    var end = new Date(start.getTime() + 30 * 60000);
    function stamp(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) +
      '&dates=' + stamp(start) + '/' + stamp(end) + '&details=' + encodeURIComponent(details);
  }

  function renderRequests() {
    var list = $('#reqList');
    var upcoming = requests
      .filter(function (r) { return r.when > Date.now() - 3600000; })
      .sort(function (a, b) { return a.when - b.when; });
    list.innerHTML = '';
    upcoming.forEach(function (r) {
      var li = document.createElement('li');
      li.appendChild(element('span', '', shortWhen(new Date(r.when))));
      li.appendChild(element('span', '', methodLabels[r.method] || 'email'));
      list.appendChild(li);
    });
    $('#reqs').hidden = upcoming.length === 0;
  }

  function updateBook() {
    var past = picked < startOfDay(new Date());
    var sub = $('#bookSub');
    $('#bkDay').value = picked.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('#bkZone').textContent = 'Times are in your time zone: ' + zoneName() + ' (' + offsetText(new Date()) + ').';
    sub.classList.toggle('warn', past);
    sub.textContent = past ?
      'That day has already passed. Pick today or a day in the future.' :
      'Pick a day in the calendar, choose a time, and Paul gets an email with your request.';
    bkSend.disabled = past || bkSending;
    if (!bkTime.value) {
      var t = new Date();
      t.setHours(t.getHours() + 1, 0, 0, 0);
      bkTime.value = ('0' + t.getHours()).slice(-2) + ':00';
    }
    renderRequests();
  }

  bookForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (bookForm.elements._gotcha.value) return;

    var name = $('#bkName').value.trim();
    var email = $('#bkEmail').value.trim();
    var phone = $('#bkPhone').value.trim();
    var method = $('#bkMethod').value;
    var note = $('#bkNote').value.trim();
    var time = bkTime.value;

    if (!name) { bkSay('Please add your name.', true); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { bkSay('Please add a valid email so Paul can reply.', true); return; }
    if (!time) { bkSay('Please choose a time.', true); return; }
    var cleanPhone = phone.replace(/[\s\-().]/g, '');
    if (phone && !/^\+?\d{7,15}$/.test(cleanPhone)) { bkSay('That phone number does not look right. Include the country code, like +256.', true); return; }
    if ((method === 'call' || method === 'whatsapp') && !phone) { bkSay('Add a phone number so Paul can call or WhatsApp you.', true); return; }

    var parts = time.split(':');
    var when = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), parseInt(parts[0], 10), parseInt(parts[1], 10));
    if (when.getTime() < Date.now() + 5 * 60000) { bkSay('Please choose a time in the future.', true); return; }

    var recent = requests.filter(function (r) { return Date.now() - r.ts < 86400000; }).length;
    if (recent >= 5) { bkSay('You have already sent several requests today. Paul will be in touch.', true); return; }

    var clientWhen = longWhen(when);
    var kampalaWhen = longWhen(when, 'Africa/Kampala');
    var details = name + ' asked to be contacted by ' + methodLabels[method] + '.\nEmail: ' + email +
      '\nPhone: ' + (phone || 'Not given') + (note ? '\nAbout: ' + note : '');

    var payload = {
      _subject: 'Contact request: ' + name + ', ' + kampalaWhen + ' (Kampala time)',
      name: name,
      email: email,
      phone: phone || 'Not given',
      preferred_method: methodLabels[method],
      message: name + ' requests that you contact them on ' + clientWhen + ' (their time) by ' + methodLabels[method] + '.',
      requested_time_their_zone: clientWhen + ' (' + zoneName() + ', ' + offsetText(when) + ')',
      requested_time_in_kampala: kampalaWhen,
      note: note || 'None',
      add_to_google_calendar: gcalLink(when, 'Contact ' + name + ' (' + methodLabels[method] + ')', details)
    };

    bkSending = true;
    bkSend.disabled = true;
    bkSay('Sending...');

    sendToPaul(payload)
      .then(function () {
        requests.push({ ts: Date.now(), when: when.getTime(), method: method });
        saveRequests();
        $('#bkNote').value = '';
        bkSay('Sent. Paul will contact you on ' + shortWhen(when) + '.');
        notify('Request sent', 'Paul will contact you on ' + shortWhen(when) + ' by ' + methodLabels[method] + '.', 'calendar');
        renderCal();
      })
      .catch(function (err) {
        var notReady = err && err.message === 'not-configured';
        bkSay(notReady ? 'The request form is not connected yet. Please use WhatsApp for now.' : 'Could not send. Please try WhatsApp or LinkedIn.', true);
        notify('Request not sent', notReady ? 'The form is not connected yet. Please use WhatsApp.' : 'Something went wrong. Please try WhatsApp.', 'calendar');
      })
      .then(function () {
        bkSending = false;
        updateBook();
      });
  });

  function tick() {
    var now = new Date();
    var o = { hour: 'numeric', minute: '2-digit', hourCycle: hourCycle() };
    if (prefs.seconds) o.second = '2-digit';
    ctime.textContent = now.toLocaleTimeString([], o);
    cdate.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    if (now.getDate() !== lastDay) {
      lastDay = now.getDate();
      $('#calDay').textContent = String(now.getDate());
      $('#calWk').textContent = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      renderCal();
    }
    if (!wins.calendar.closed && !wins.calendar.min) updateCalSide(now);
  }

  tick();
  updateCalSide(new Date());
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  $('#clock').addEventListener('click', function (e) { e.stopPropagation(); closeMenu(); openApp('calendar'); });

  /* ======================================================
     Network and battery in the menu bar
     ====================================================== */
  var wifi = $('#wifi');

  function netState(announce) {
    var on = navigator.onLine;
    wifi.classList.toggle('off', !on);
    wifi.title = on ? 'Online' : 'Offline';
    if (announce) notify('Network', on ? 'You are back online.' : 'You are offline.', 'safari');
  }

  window.addEventListener('online', function () { netState(true); });
  window.addEventListener('offline', function () { netState(true); });
  wifi.addEventListener('click', function () {
    notify('Network', navigator.onLine ? 'You are online.' : 'You are offline.', 'safari', true);
  });
  netState(false);

  if (navigator.getBattery) {
    navigator.getBattery().then(function (b) {
      var btn = $('#battery');
      function update() {
        var pct = Math.round(b.level * 100);
        $('#batText').textContent = pct + '%';
        $('#batFill').setAttribute('width', String(Math.max(1, Math.round(17 * b.level))));
        btn.title = b.charging ? 'Charging' : 'On battery';
      }
      btn.hidden = false;
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
      btn.addEventListener('click', function () {
        notify('Battery', Math.round(b.level * 100) + '% ' + (b.charging ? 'and charging' : 'remaining'), 'prefs', true);
      });
      update();
    }).catch(function () { /* battery not available */ });
  }

  /* ======================================================
     Portrait and empty sections
     ====================================================== */
  var photo = $('#photo');
  function noPhoto() { photo.parentNode.classList.add('nophoto'); }
  photo.addEventListener('error', noPhoto);
  if (photo.complete && photo.naturalWidth === 0) noPhoto();

  $$('[data-list]').forEach(function (list) {
    var empty = list.parentNode.querySelector('[data-empty]');
    if (empty) empty.hidden = list.children.length > 0;
  });

  document.addEventListener('click', function (e) {
    var card = e.target.closest('.flip');
    if (!card) return;
    var on = card.classList.toggle('on');
    card.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  /* ======================================================
     Terminal (Ubuntu style)
     ====================================================== */
  var termScreen = $('#termScreen');
  var termBody = $('#termBody');
  var termOut = $('#termOut');
  var termIn = $('#termIn');
  var termPs = $('#termPs');
  var termTitle = $('#termTitle');
  var cmdHistory = [];
  var historyAt = 0;
  var started = Date.now();
  var cwd = '~';

  var files = {
    'about.txt': 'Paul Marvin. Backend developer.\nI write Python and C#, and I like building on Azure.',
    'stack.txt': 'languages  Python, C#\nplatform   .NET, Azure\ndata       SQL\nother      REST APIs, Git, Linux',
    'hello.py': 'def greet(name: str) -> str:\n    return f"Hello, I\'m {name}."\n\nprint(greet("Paul"))\nprint("I write Python and C# for the backend.")',
    'Program.cs': 'var name = "Paul";\n\nConsole.WriteLine($"Hello, I\'m {name}.");\nConsole.WriteLine("I write Python and C# for the backend.");'
  };
  var fileNames = Object.keys(files);
  var dirNames = ['journey/', 'projects/'];

  var helloOut = 'Hello, I\'m Paul.\nI write Python and C# for the backend.';

  function promptHtml() {
    return '<span class="ug">paul@ubuntu</span><span class="wh">:</span><span class="pb">' + esc(cwd) + '</span><span class="wh">$ </span>';
  }

  function refreshPrompt() {
    termPs.innerHTML = promptHtml();
    termTitle.textContent = 'paul@ubuntu: ' + cwd;
  }

  function print(html) {
    var line = document.createElement('pre');
    line.innerHTML = html;
    termOut.appendChild(line);
    termBody.scrollTop = termBody.scrollHeight;
  }

  function uptimeText() {
    var s = Math.floor((Date.now() - started) / 1000);
    var m = Math.floor(s / 60);
    return m > 0 ? m + ' min, ' + (s % 60) + ' sec' : s + ' sec';
  }

  function calText() {
    var n = new Date();
    var y = n.getFullYear(), m = n.getMonth();
    var title = n.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    var pad = Math.max(0, Math.floor((20 - title.length) / 2));
    var lines = [new Array(pad + 1).join(' ') + title, 'Su Mo Tu We Th Fr Sa'];
    var first = new Date(y, m, 1).getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var row = [];
    var i;
    for (i = 0; i < first; i++) row.push('  ');
    for (var d = 1; d <= days; d++) {
      var cell = ('0' + d).slice(-2).replace(/^0/, ' ');
      row.push(d === n.getDate() ? '<span class="today">' + cell + '</span>' : cell);
      if (row.length === 7) { lines.push(row.join(' ')); row = []; }
    }
    if (row.length) lines.push(row.join(' '));
    return lines.join('\n');
  }

  var openNames = {
    about: 'whoami', whoami: 'whoami', journey: 'journey', projects: 'projects',
    terminal: 'terminal', safari: 'safari', browser: 'safari', mail: 'reach', reach: 'reach', contact: 'reach',
    calendar: 'calendar', calc: 'calc', calculator: 'calc', prefs: 'prefs', preferences: 'prefs', settings: 'prefs'
  };

  var commands = {
    help: function () {
      print('<span class="yl">Commands</span>\n' +
        '  help            show this list\n' +
        '  whoami          who is Paul\n' +
        '  ls              list files\n' +
        '  cd DIR          change folder (projects, journey, ..)\n' +
        '  cat FILE        read a file\n' +
        '  python3 FILE    run hello.py\n' +
        '  dotnet run      run Program.cs\n' +
        '  neofetch        system info\n' +
        '  date, cal       the real date and a calendar\n' +
        '  uptime, pwd     where things stand\n' +
        '  open APP        journey, projects, safari, mail, calendar...\n' +
        '  notify TEXT     pop up a notification\n' +
        '  sudo reboot     restart the computer\n' +
        '  clear           clear the screen\n' +
        '<span class="dm">Tip: press Tab to complete a command or file name.</span>');
    },
    whoami: function () { print('paul\n<span class="dm">Backend developer. Python, C# and Azure.</span>'); },
    hostname: function () { print('ubuntu'); },
    pwd: function () { print(cwd === '~' ? '/home/paul' : '/home/paul/' + cwd.replace('~/', '')); },
    ls: function () {
      if (cwd !== '~') return;
      print(dirNames.map(function (d) { return '<span class="dir">' + d + '</span>'; }).concat(fileNames).join('  '));
    },
    cd: function (args) {
      var t = (args[0] || '~').replace(/\/$/, '');
      if (t === '~' || t === '..' || t === '') { cwd = '~'; }
      else if (cwd === '~' && (t === 'projects' || t === 'journey')) { cwd = '~/' + t; }
      else if (t === '.') { /* stay */ }
      else print('bash: cd: ' + esc(args[0]) + ': No such file or directory');
      refreshPrompt();
    },
    cat: function (args) {
      var name = args[0];
      if (!name) { print('usage: cat FILE'); return; }
      var clean = name.replace(/^~\//, '');
      if (clean === 'projects' || clean === 'journey' || clean === 'projects/' || clean === 'journey/') { print('cat: ' + esc(name) + ': Is a directory'); return; }
      if (files[clean] && (cwd === '~' || name.indexOf('~/') === 0)) print(esc(files[clean]));
      else print('cat: ' + esc(name) + ': No such file or directory');
    },
    python3: function (args) {
      if (args[0] === 'hello.py' && cwd === '~') print(esc(helloOut));
      else if (!args[0]) print('<span class="dm">The interactive shell is not available here. Try:</span> python3 hello.py');
      else print('python3: can\'t open file \'' + esc(args[0]) + '\': No such file or directory');
    },
    dotnet: function (args) {
      if (args[0] === 'run' && cwd === '~') print(esc(helloOut));
      else print('usage: dotnet run');
    },
    neofetch: function () {
      var n = new Date();
      print('<span class="or">   .--------.   </span><span class="ug">paul</span>@<span class="ug">ubuntu</span>\n' +
            '<span class="or">  /  ______  \\  </span>-----------\n' +
            '<span class="or"> |  | &gt;_   |  | </span><span class="or">Role</span>        Backend developer\n' +
            '<span class="or"> |  |______|  | </span><span class="or">Languages</span>   Python, C#\n' +
            '<span class="or">  \\          /  </span><span class="or">Platform</span>    .NET, Azure\n' +
            '<span class="or">   \'--------\'   </span><span class="or">Shell</span>       bash\n' +
            '<span class="or">                </span><span class="or">Resolution</span>  ' + window.innerWidth + 'x' + window.innerHeight + '\n' +
            '<span class="or">                </span><span class="or">Time zone</span>   ' + esc(zoneName()) + ' (' + offsetText(n) + ')\n' +
            '<span class="or">                </span><span class="or">Local time</span>  ' + esc(n.toLocaleString()) + '\n' +
            '<span class="or">                </span><span class="or">Uptime</span>      ' + uptimeText());
    },
    date: function () { print(esc(new Date().toString())); },
    cal: function () { print(calText()); },
    uptime: function () { print('up ' + uptimeText()); },
    echo: function (args) { print(esc(args.join(' '))); },
    history: function () {
      print(cmdHistory.map(function (h, i) { return ' ' + (i + 1) + '  ' + esc(h); }).join('\n') || '(empty)');
    },
    clear: function () { termOut.innerHTML = ''; },
    exit: function () { closeApp('terminal'); },
    open: function (args) {
      var target = openNames[(args[0] || '').toLowerCase()];
      if (!target) { print('usage: open journey | projects | safari | mail | calendar | calculator | preferences'); return; }
      print('<span class="gr">opening ' + esc(args[0]) + ' ...</span>');
      openApp(target);
    },
    notify: function (args) {
      notify('Terminal', args.join(' ') || 'Hello from the terminal.', 'terminal', true);
    },
    sudo: function (args) {
      var what = args[0];
      if (what === 'reboot' || (what === 'shutdown' && args[1] === '-r')) {
        print('<span class="yl">Restarting...</span>');
        setTimeout(restartNow, 700);
      } else if (what === 'poweroff' || (what === 'shutdown' && args[1] !== '-r')) {
        print('<span class="yl">Powering off...</span>');
        setTimeout(powerOffNow, 700);
      } else {
        print('paul is not in the sudoers file. <span class="rd">This incident will be reported.</span>');
      }
    },
    reboot: function () { print('Need root. Try: sudo reboot'); },
    shutdown: function () { print('Need root. Try: sudo shutdown now'); }
  };

  function run(line) {
    var text = line.trim();
    print(promptHtml() + esc(line));
    if (!text) return;
    cmdHistory.push(text);
    historyAt = cmdHistory.length;
    var parts = text.split(/\s+/);
    var name = parts[0];
    if (Object.prototype.hasOwnProperty.call(commands, name)) commands[name](parts.slice(1));
    else print(esc(name) + ': command not found');
  }

  function complete() {
    var v = termIn.value;
    var parts = v.split(/\s+/);
    var last = parts[parts.length - 1];
    if (!last) return;
    var pool = parts.length === 1 ? Object.keys(commands) : (cwd === '~' ? fileNames.concat(dirNames) : []);
    var m = pool.filter(function (n) { return n.indexOf(last) === 0; });
    if (m.length === 1) {
      parts[parts.length - 1] = m[0];
      termIn.value = parts.join(' ') + (parts.length === 1 ? ' ' : '');
    } else if (m.length > 1) {
      print(promptHtml() + esc(v));
      print(m.join('  '));
    }
  }

  print('Welcome to Paul\'s terminal. It runs right here in the page.\nType <span class="yl">help</span> to see what it can do.');
  refreshPrompt();

  termIn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var value = termIn.value;
      termIn.value = '';
      run(value);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyAt > 0) { historyAt -= 1; termIn.value = cmdHistory[historyAt]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyAt < cmdHistory.length - 1) { historyAt += 1; termIn.value = cmdHistory[historyAt]; }
      else { historyAt = cmdHistory.length; termIn.value = ''; }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      termOut.innerHTML = '';
    }
  });

  termScreen.addEventListener('click', function () {
    if (!window.getSelection().toString()) termIn.focus();
  });

  /* ======================================================
     Safari
     ====================================================== */

  var sView = $('#sView');
  var sInput = $('#sInput');
  var sEngine = $('#sEngine');
  var sBar = $('#sBar');
  var sStatus = $('#sStatus');
  var sTitle = $('#safariTitle');
  var sBack = $('#sBack');
  var sFwd = $('#sFwd');
  var pages = [{ type: 'home' }];
  var at = 0;
  var token = 0;
  var engineNames = { google: 'Google', googleimages: 'Google Images', bing: 'Bing', wikipedia: 'Wikipedia', stackoverflow: 'Stack Overflow', github: 'GitHub' };

  function setTitle(text) { sTitle.textContent = 'Safari — ' + text; }

  function progress(on) {
    if (on) {
      sBar.style.transition = 'none';
      sBar.style.opacity = '1';
      sBar.style.width = '0';
      void sBar.offsetWidth;
      sBar.style.transition = 'width 0.9s ease';
      sBar.style.width = '70%';
      sStatus.textContent = 'Loading...';
    } else {
      sBar.style.transition = 'width 0.25s ease, opacity 0.4s ease 0.25s';
      sBar.style.width = '100%';
      sBar.style.opacity = '0';
      sStatus.textContent = 'Done';
    }
  }

  function webUrl(engine, q) {
    return (engine === 'bing' ? 'https://www.bing.com/search?q=' : 'https://www.google.com/search?q=') + encodeURIComponent(q);
  }

  function externalLink(label, href, className) {
    var a = element('a', className === undefined ? 'gel more' : className, label);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  function getJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('bad response');
      return res.json();
    });
  }

  var fetchers = {
    wikipedia: function (q) {
      return getJson('https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=8&format=json&origin=*&srsearch=' + encodeURIComponent(q))
        .then(function (d) {
          return ((d.query && d.query.search) || []).map(function (i) {
            return { title: i.title, text: plainText(i.snippet) + '...', article: i.title };
          });
        });
    },
    stackoverflow: function (q) {
      return getJson('https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&pagesize=8&site=stackoverflow&q=' + encodeURIComponent(q))
        .then(function (d) {
          return (d.items || []).map(function (i) {
            return {
              title: plainText(i.title),
              text: (i.is_answered ? 'Answered' : 'Open') + ' · ' + i.score + ' votes · ' + i.answer_count + ' answers',
              meta: (i.tags || []).join(', '),
              href: i.link
            };
          });
        });
    },
    github: function (q) {
      return getJson('https://api.github.com/search/repositories?per_page=8&q=' + encodeURIComponent(q))
        .then(function (d) {
          return (d.items || []).map(function (i) {
            return {
              title: i.full_name,
              text: i.description || 'No description.',
              meta: (i.language ? i.language + ' · ' : '') + '★ ' + i.stargazers_count,
              href: i.html_url
            };
          });
        });
    }
  };

  function renderResults(host, items) {
    var ul = element('ul', 'results');
    items.forEach(function (item) {
      var li = document.createElement('li');
      var row;
      if (item.article) {
        row = element('button');
        row.type = 'button';
        row.addEventListener('click', function () { visit({ type: 'article', value: item.article }); });
      } else if (item.href && item.href.indexOf('https://') === 0) {
        row = externalLink('', item.href, '');
      } else {
        return;
      }
      row.appendChild(element('strong', '', item.title));
      row.appendChild(element('span', '', item.text));
      if (item.meta) row.appendChild(element('span', 'meta', item.meta));
      li.appendChild(row);
      ul.appendChild(li);
    });
    host.appendChild(ul);
  }

  function showHome() {
    sView.innerHTML = '';
    var box = element('div', 'page');
    box.appendChild(element('h2', '', 'Start Page'));
    box.appendChild(element('p', 'sub', 'Type in the address bar to search. Pick a search engine on the right, or choose a topic below.'));
    var tiles = element('div', 'tiles');
    ['Python (programming language)', 'C Sharp (programming language)', '.NET', 'Microsoft Azure', 'Ubuntu', 'Git', 'SQL', 'REST', 'Docker (software)', 'Kubernetes', 'Linux', 'Application programming interface'].forEach(function (topic) {
      var label = topic.replace(/ \(.*\)/, '').replace('Application programming interface', 'APIs').replace('C Sharp', 'C#');
      var b = element('button', '', label);
      b.type = 'button';
      b.addEventListener('click', function () { visit({ type: 'article', value: topic }); });
      tiles.appendChild(b);
    });
    box.appendChild(tiles);
    box.appendChild(element('p', 'hint', 'Tip: type a web address like python.org to open a site. Some sites refuse to appear inside other pages, and Safari will offer to open them in a new tab.'));
    sView.appendChild(box);
    sInput.value = '';
    setTitle('Start Page');
    progress(false);
  }

  function showOffline(q, engine) {
    sView.innerHTML = '';
    var box = element('div', 'page');
    box.appendChild(element('h2', '', 'Safari can\'t reach the internet'));
    box.appendChild(element('p', 'sub', 'Check your connection and try again. Meanwhile you can open the search in its own tab.'));
    var row = element('div', 'btnrow');
    row.appendChild(externalLink('Search Google', webUrl('google', q || 'python'), 'gel'));
    row.appendChild(externalLink('Search Bing', webUrl('bing', q || 'python'), 'gel ghost'));
    box.appendChild(row);
    sView.appendChild(box);
    setTitle('Can\'t open page');
  }

  /* Google and Bing refuse to be shown inside other pages. When the search service is set up,
     Google results and Google Images appear right here. Without it, each opens in its own tab
     and live results from Wikipedia and Wikimedia Commons are shown instead. */
  function safeUrl(u) { return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : ''; }

  function searchApi(q, type, page) {
    return getJson(SEARCH_API + (SEARCH_API.indexOf('?') < 0 ? '?' : '&') +
      'q=' + encodeURIComponent(q) + '&type=' + type + '&page=' + (page || 0));
  }

  function commonsImages(q) {
    return getJson('https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=' +
      encodeURIComponent(q + ' filetype:bitmap') + '&prop=imageinfo&iiprop=url&iiurlwidth=360&format=json&origin=*')
      .then(function (d) {
        var found = (d.query && d.query.pages) || {};
        return Object.keys(found).map(function (k) { return found[k]; })
          .sort(function (a, b) { return (a.index || 0) - (b.index || 0); })
          .filter(function (p) { return p.imageinfo && p.imageinfo[0]; })
          .map(function (p) {
            var ii = p.imageinfo[0];
            return {
              title: p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
              thumb: ii.thumburl || ii.url,
              full: ii.url,
              site: 'Wikimedia Commons',
              link: ii.descriptionurl
            };
          });
      });
  }

  function searchTabs(q, active) {
    var row = element('div', 'stabs');
    [['google', 'All'], ['googleimages', 'Images']].forEach(function (t) {
      var b = element('button', t[0] === active ? 'on' : '', t[1]);
      b.type = 'button';
      b.addEventListener('click', function () {
        if (t[0] !== active) visit({ type: 'search', value: q, engine: t[0] });
      });
      row.appendChild(b);
    });
    return row;
  }

  function moreButton(label, fn) {
    var b = element('button', 'gel ghost more', label);
    b.type = 'button';
    b.addEventListener('click', function () {
      b.disabled = true;
      b.textContent = 'Loading...';
      fn(b);
    });
    return b;
  }

  /* Image viewer */
  var lb = null;
  var lbList = [];
  var lbAt = 0;

  function closeLightbox() {
    if (lb) { lb.remove(); lb = null; }
  }

  function lbStep(d) {
    var n = lbAt + d;
    if (!lb || n < 0 || n >= lbList.length) return;
    lbAt = n;
    lb.show();
  }

  function openLightbox(list, index) {
    closeLightbox();
    lbList = list;
    lbAt = index;
    lb = element('div', 'lightbox');
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-label', 'Image viewer');

    var stage = element('div', 'lb-stage');
    var img = document.createElement('img');
    img.referrerPolicy = 'no-referrer';
    img.alt = '';
    var prev = element('button', 'lb-nav lb-prev', '‹');
    prev.type = 'button';
    prev.setAttribute('aria-label', 'Previous image');
    var next = element('button', 'lb-nav lb-next', '›');
    next.type = 'button';
    next.setAttribute('aria-label', 'Next image');
    stage.appendChild(img);
    stage.appendChild(prev);
    stage.appendChild(next);

    var bar = element('div', 'lb-bar');
    var cap = element('div', 'cap');
    var capTitle = element('strong');
    var capSite = element('span');
    cap.appendChild(capTitle);
    cap.appendChild(capSite);
    var visitLink = externalLink('Visit page', '#', 'gel small');
    var openLink = externalLink('Open image', '#', 'gel small ghost');
    var close = element('button', 'gel small ghost', 'Close');
    close.type = 'button';
    bar.appendChild(cap);
    bar.appendChild(visitLink);
    bar.appendChild(openLink);
    bar.appendChild(close);

    lb.appendChild(stage);
    lb.appendChild(bar);
    $('.safari').appendChild(lb);

    lb.show = function () {
      var im = lbList[lbAt];
      img.onerror = function () { if (im.thumb && img.src !== im.thumb) img.src = im.thumb; };
      img.src = safeUrl(im.full) || safeUrl(im.thumb);
      img.alt = im.title || '';
      capTitle.textContent = im.title || 'Image';
      capSite.textContent = im.site || '';
      var page = safeUrl(im.link);
      var full = safeUrl(im.full);
      visitLink.hidden = !page;
      if (page) visitLink.href = page;
      openLink.hidden = !full;
      if (full) openLink.href = full;
      prev.disabled = lbAt === 0;
      next.disabled = lbAt >= lbList.length - 1;
    };

    prev.addEventListener('click', function () { lbStep(-1); });
    next.addEventListener('click', function () { lbStep(1); });
    close.addEventListener('click', closeLightbox);
    stage.addEventListener('click', function (e) { if (e.target === stage) closeLightbox(); });
    lb.show();
    close.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (!lb) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') lbStep(1);
    else if (e.key === 'ArrowLeft') lbStep(-1);
  });

  function imageGrid() {
    var grid = element('div', 'imgs');
    var all = [];
    function add(items) {
      items.forEach(function (im) {
        if (!safeUrl(im.thumb)) return;
        var idx = all.length;
        all.push(im);
        var b = element('button', 'img');
        b.type = 'button';
        var img = document.createElement('img');
        img.src = im.thumb;
        img.alt = im.title || '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', function () { b.remove(); });
        b.appendChild(img);
        b.appendChild(element('span', '', im.title || im.site || ''));
        b.addEventListener('click', function () { openLightbox(all, idx); });
        grid.appendChild(b);
      });
    }
    return { el: grid, add: add };
  }

  function addWebResults(ul, items) {
    items.forEach(function (r) {
      var href = safeUrl(r.link);
      if (!href) return;
      var li = document.createElement('li');
      var a = externalLink('', href, '');
      a.appendChild(element('div', 'gsite', r.site || ''));
      a.appendChild(element('div', 'gt', r.title || href));
      if (r.snippet) a.appendChild(element('div', 'gs', r.snippet));
      li.appendChild(a);
      ul.appendChild(li);
    });
  }

  function showGoogleWeb(q, mine) {
    searchApi(q, 'web', 0).then(function (d) {
      if (mine !== token) return;
      sView.innerHTML = '';
      var box = element('div', 'page wide');
      box.appendChild(searchTabs(q, 'google'));

      if (d.knowledge) {
        var k = element('div', 'kcard');
        var kimg = safeUrl(d.knowledge.image);
        if (kimg) {
          var ki = element('img');
          ki.src = kimg;
          ki.alt = '';
          ki.referrerPolicy = 'no-referrer';
          ki.addEventListener('error', function () { ki.remove(); });
          k.appendChild(ki);
        }
        k.appendChild(element('h3', '', d.knowledge.title));
        if (d.knowledge.subtitle) k.appendChild(element('p', 'kind-line', d.knowledge.subtitle));
        if (d.knowledge.description) k.appendChild(element('p', '', d.knowledge.description));
        if (safeUrl(d.knowledge.link)) k.appendChild(externalLink('Learn more', safeUrl(d.knowledge.link), 'gel small more'));
        box.appendChild(k);
      }

      if (d.answer) {
        var a = element('div', 'acard');
        if (d.answer.title) a.appendChild(element('h3', '', d.answer.title));
        a.appendChild(element('p', '', d.answer.text));
        box.appendChild(a);
      }

      var ul = element('ul', 'gres');
      addWebResults(ul, d.results || []);
      box.appendChild(ul);
      if (!ul.children.length && !d.knowledge && !d.answer) box.appendChild(element('p', 'sub', 'No results found for that search.'));

      var moreHost = element('div');
      box.appendChild(moreHost);
      var pageNo = 0;
      var hasNext = !!d.next;
      function addMore() {
        moreHost.innerHTML = '';
        if (!hasNext) return;
        moreHost.appendChild(moreButton('More results', function (btn) {
          pageNo += 1;
          searchApi(q, 'web', pageNo).then(function (n) {
            if (mine !== token) return;
            addWebResults(ul, n.results || []);
            hasNext = !!n.next && (n.results || []).length > 0;
            addMore();
          }).catch(function () {
            btn.disabled = false;
            btn.textContent = 'Could not load more. Try again';
          });
        }));
      }
      addMore();

      if (d.questions && d.questions.length) {
        box.appendChild(element('h3', 'subhead', 'People also ask'));
        var ql = element('div', 'qlist');
        d.questions.forEach(function (item) {
          var det = document.createElement('details');
          det.appendChild(element('summary', '', item.question));
          if (item.snippet) det.appendChild(element('p', '', item.snippet));
          ql.appendChild(det);
        });
        box.appendChild(ql);
      }

      if (d.related && d.related.length) {
        box.appendChild(element('h3', 'subhead', 'Related searches'));
        var chips = element('div', 'chiprow');
        d.related.forEach(function (term) {
          var c = element('button', '', term);
          c.type = 'button';
          c.addEventListener('click', function () { visit({ type: 'search', value: term, engine: 'google' }); });
          chips.appendChild(c);
        });
        box.appendChild(chips);
      }

      sView.appendChild(box);
      progress(false);
    }).catch(function () {
      if (mine !== token) return;
      showGate(q, 'google', mine, true);
    });
  }

  function showGoogleImages(q, mine) {
    searchApi(q, 'images', 0).then(function (d) {
      if (mine !== token) return;
      sView.innerHTML = '';
      var box = element('div', 'page wide');
      box.appendChild(searchTabs(q, 'googleimages'));
      var grid = imageGrid();
      grid.add(d.images || []);
      if (!(d.images || []).length) box.appendChild(element('p', 'sub', 'No images found for that search.'));
      box.appendChild(grid.el);

      var moreHost = element('div');
      box.appendChild(moreHost);
      var pageNo = 0;
      var hasNext = !!d.next;
      function addMore() {
        moreHost.innerHTML = '';
        if (!hasNext) return;
        moreHost.appendChild(moreButton('More images', function (btn) {
          pageNo += 1;
          searchApi(q, 'images', pageNo).then(function (n) {
            if (mine !== token) return;
            grid.add(n.images || []);
            hasNext = !!n.next && (n.images || []).length > 0;
            addMore();
          }).catch(function () {
            btn.disabled = false;
            btn.textContent = 'Could not load more. Try again';
          });
        }));
      }
      addMore();

      sView.appendChild(box);
      progress(false);
    }).catch(function () {
      if (mine !== token) return;
      showImagesFallback(q, mine, true);
    });
  }

  function showImagesFallback(q, mine, failed) {
    sView.innerHTML = '';
    var box = element('div', 'page wide');
    box.appendChild(searchTabs(q, 'googleimages'));
    box.appendChild(element('p', 'sub', failed ?
      'Google Images is not reachable right now. Here are images from Wikimedia Commons instead.' :
      'Showing live images from Wikimedia Commons. Google Images opens in its own tab.'));
    var row = element('div', 'btnrow');
    row.appendChild(externalLink('See Google Images', 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q), 'gel'));
    box.appendChild(row);
    var holder = element('div');
    holder.appendChild(element('p', 'sub', 'Loading images...'));
    box.appendChild(holder);
    sView.appendChild(box);
    progress(false);
    commonsImages(q).then(function (items) {
      if (mine !== token) return;
      holder.innerHTML = '';
      if (!items.length) { holder.appendChild(element('p', 'sub', 'No images found for that search.')); return; }
      var g = imageGrid();
      g.add(items);
      holder.appendChild(g.el);
    }).catch(function () {
      if (mine !== token) return;
      holder.innerHTML = '';
      holder.appendChild(element('p', 'sub', 'Could not load images. Check your connection.'));
    });
  }

  function showGate(q, engine, mine, failed) {
    sView.innerHTML = '';
    var box = element('div', 'page wide');
    if (engine === 'google') box.appendChild(searchTabs(q, 'google'));
    box.appendChild(element('h2', '', engineNames[engine] + ' results open in a new tab'));
    box.appendChild(element('p', 'sub', failed ?
      'Google search is not reachable right now, so it opens in its own tab.' :
      'Google and Bing don\'t let other sites show their result pages inside a window, so they open in their own tab.'));
    var row = element('div', 'btnrow');
    row.appendChild(externalLink('Search Google for "' + q + '"', webUrl('google', q), engine === 'bing' ? 'gel ghost' : 'gel'));
    row.appendChild(externalLink('Google Images', 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q), 'gel ghost'));
    row.appendChild(externalLink('Search Bing', webUrl('bing', q), engine === 'bing' ? 'gel' : 'gel ghost'));
    box.appendChild(row);

    box.appendChild(element('h3', 'subhead', 'Live results from Wikipedia'));
    var holder = element('div');
    holder.appendChild(element('p', 'sub', 'Loading...'));
    box.appendChild(holder);

    box.appendChild(element('h3', 'subhead', 'Images from Wikimedia Commons'));
    var imgHolder = element('div');
    imgHolder.appendChild(element('p', 'sub', 'Loading images...'));
    box.appendChild(imgHolder);

    sView.appendChild(box);
    progress(false);

    fetchers.wikipedia(q).then(function (items) {
      if (mine !== token) return;
      holder.innerHTML = '';
      if (!items.length) { holder.appendChild(element('p', 'sub', 'Nothing found on Wikipedia for that search.')); return; }
      renderResults(holder, items);
    }).catch(function () {
      if (mine !== token) return;
      holder.innerHTML = '';
      holder.appendChild(element('p', 'sub', 'Could not reach Wikipedia. Check your connection.'));
    });

    commonsImages(q).then(function (items) {
      if (mine !== token) return;
      imgHolder.innerHTML = '';
      if (!items.length) { imgHolder.appendChild(element('p', 'sub', 'No images found.')); return; }
      var g = imageGrid();
      g.add(items.slice(0, 18));
      imgHolder.appendChild(g.el);
    }).catch(function () {
      if (mine !== token) return;
      imgHolder.innerHTML = '';
      imgHolder.appendChild(element('p', 'sub', 'Could not load images.'));
    });
  }

  function showSearch(q, engine) {
    var mine = ++token;
    setTitle(q);
    sInput.value = q;
    sEngine.value = engine;
    progress(true);
    if (engine === 'google') {
      if (SEARCH_API) showGoogleWeb(q, mine); else showGate(q, 'google', mine);
      return;
    }
    if (engine === 'googleimages') {
      if (SEARCH_API) showGoogleImages(q, mine); else showImagesFallback(q, mine, false);
      return;
    }
    if (engine === 'bing') { showGate(q, 'bing', mine); return; }
    fetchers[engine](q).then(function (items) {
      if (mine !== token) return;
      sView.innerHTML = '';
      var box = element('div', 'page');
      box.appendChild(element('h2', '', 'Results for "' + q + '"'));
      box.appendChild(element('p', 'sub', items.length ? 'Live from ' + engineNames[engine] + '.' : 'Nothing found on ' + engineNames[engine] + ' for that search.'));
      renderResults(box, items);
      var row = element('div', 'btnrow');
      row.appendChild(externalLink('Search Google', webUrl('google', q), 'gel ghost'));
      row.appendChild(externalLink('Search Bing', webUrl('bing', q), 'gel ghost'));
      box.appendChild(row);
      sView.appendChild(box);
      progress(false);
    }).catch(function () {
      if (mine !== token) return;
      showOffline(q, engine);
      progress(false);
    });
  }

  function showArticle(title) {
    var mine = ++token;
    setTitle(title);
    sInput.value = 'en.wikipedia.org/wiki/' + title.replace(/ /g, '_');
    progress(true);
    getJson('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')))
      .then(function (data) {
        if (mine !== token) return;
        sView.innerHTML = '';
        var box = element('div', 'page');
        if (data.thumbnail && data.thumbnail.source && data.thumbnail.source.indexOf('https://upload.wikimedia.org/') === 0) {
          var img = element('img', 'thumb');
          img.src = data.thumbnail.source;
          img.alt = '';
          img.addEventListener('error', function () { img.remove(); });
          box.appendChild(img);
        }
        box.appendChild(element('h2', '', data.title || title));
        if (data.description) box.appendChild(element('p', 'sub', data.description));
        box.appendChild(element('p', 'extract', data.extract || 'No summary available.'));
        var page = data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page;
        if (page && page.indexOf('https://en.wikipedia.org/') === 0) {
          box.appendChild(externalLink('Read the full article on Wikipedia', page));
        }
        box.appendChild(externalLink('Search Google for this', webUrl('google', data.title || title), 'gel ghost more'));
        sView.appendChild(box);
        setTitle(data.title || title);
        progress(false);
      })
      .catch(function () {
        if (mine !== token) return;
        showOffline(title, 'wikipedia');
        progress(false);
      });
  }

  function showSite(address) {
    token += 1;
    var url = /^https?:\/\//i.test(address) ? address : 'https://' + address;
    sView.innerHTML = '';
    progress(true);
    var frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.title = 'Web page';
    frame.addEventListener('load', function () { progress(false); });
    frame.src = url;
    sView.appendChild(frame);
    var note = element('div', 'noticebar');
    note.appendChild(element('span', '', 'Blank page? This site may not allow being shown here.'));
    note.appendChild(externalLink('Open in a new tab', url, ''));
    sView.appendChild(note);
    sInput.value = url.replace(/^https?:\/\//i, '');
    setTitle(url.replace(/^https?:\/\//i, '').split('/')[0]);
  }

  function render(entry) {
    closeLightbox();
    if (entry.type === 'home') showHome();
    else if (entry.type === 'search') showSearch(entry.value, entry.engine);
    else if (entry.type === 'article') showArticle(entry.value);
    else showSite(entry.value);
    sBack.disabled = at === 0;
    sFwd.disabled = at >= pages.length - 1;
  }

  function visit(entry) {
    pages = pages.slice(0, at + 1);
    pages.push(entry);
    at = pages.length - 1;
    render(entry);
  }

  function looksLikeAddress(text) {
    return !/\s/.test(text) && /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(text);
  }

  $('#sForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = sInput.value.trim();
    if (!text) { visit({ type: 'home' }); return; }
    if (looksLikeAddress(text)) visit({ type: 'site', value: text });
    else visit({ type: 'search', value: text, engine: sEngine.value });
  });

  sBack.addEventListener('click', function () { if (at > 0) { at -= 1; render(pages[at]); } });
  sFwd.addEventListener('click', function () { if (at < pages.length - 1) { at += 1; render(pages[at]); } });
  $('#sReload').addEventListener('click', function () { render(pages[at]); });
  $('#sHome').addEventListener('click', function () { visit({ type: 'home' }); });

  $$('.bookmarks button').forEach(function (b) {
    b.addEventListener('click', function () { visit({ type: 'article', value: b.getAttribute('data-article') }); });
  });

  render(pages[0]);

  /* ======================================================
     Calculator
     ====================================================== */
  var calc = { cur: '0', acc: null, op: null, fresh: true };
  var calcOut = $('#calcOut');

  function fmt(n) {
    if (!isFinite(n)) return 'Error';
    return String(parseFloat(n.toPrecision(10)));
  }

  function applyOp(a, b, op) {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    if (op === '/') return b === 0 ? NaN : a / b;
    return b;
  }

  function calcKey(k) {
    if (calc.cur === 'Error' && k !== 'C') {
      calc.cur = '0'; calc.acc = null; calc.op = null; calc.fresh = true;
    }
    if (/^[0-9]$/.test(k)) {
      if (calc.fresh) { calc.cur = k; calc.fresh = false; }
      else if (calc.cur.replace(/[-.]/g, '').length < 12) calc.cur = calc.cur === '0' ? k : calc.cur + k;
    } else if (k === '.') {
      if (calc.fresh) { calc.cur = '0.'; calc.fresh = false; }
      else if (calc.cur.indexOf('.') < 0) calc.cur += '.';
    } else if (k === 'C') {
      calc.cur = '0'; calc.acc = null; calc.op = null; calc.fresh = true;
    } else if (k === 'neg') {
      if (calc.cur !== '0') calc.cur = calc.cur.charAt(0) === '-' ? calc.cur.slice(1) : '-' + calc.cur;
    } else if (k === 'pct') {
      calc.cur = fmt(parseFloat(calc.cur) / 100);
      calc.fresh = true;
    } else if (k === '=') {
      if (calc.op !== null && calc.acc !== null) {
        calc.cur = fmt(applyOp(calc.acc, parseFloat(calc.cur), calc.op));
        calc.op = null; calc.acc = null; calc.fresh = true;
      }
    } else {
      if (calc.op !== null && !calc.fresh) calc.cur = fmt(applyOp(calc.acc, parseFloat(calc.cur), calc.op));
      if (calc.cur === 'Error') { calc.op = null; calc.acc = null; calc.fresh = true; }
      else { calc.acc = parseFloat(calc.cur); calc.op = k; calc.fresh = true; }
    }
    calcOut.textContent = calc.cur;
  }

  $('#calcKeys').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) calcKey(b.getAttribute('data-k'));
  });

  document.addEventListener('keydown', function (e) {
    if (current !== 'calc' || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    var k = e.key;
    if (/^[0-9.]$/.test(k) || k === '+' || k === '-' || k === '*' || k === '/') calcKey(k);
    else if (k === 'Enter' || k === '=') { e.preventDefault(); calcKey('='); }
    else if (k === 'Escape' || k === 'c' || k === 'C') calcKey('C');
    else if (k === '%') calcKey('pct');
  });

  /* ======================================================
     System Preferences
     ====================================================== */
  var water = $('#water');

  function applyPrefs() {
    water.setAttribute('data-wall', prefs.wall);
    if (isMobile()) dock.style.removeProperty('--base');
    else dock.style.setProperty('--base', prefs.dock + 'px');
    $$('.wall').forEach(function (w) { w.classList.toggle('on', w.getAttribute('data-wall') === prefs.wall); });
    tick();
  }

  $('#p24').checked = prefs.hour24;
  $('#pSec').checked = prefs.seconds;
  $('#pMag').checked = prefs.magnify;
  $('#pNote').checked = prefs.notify;
  $('#pSize').value = prefs.dock;
  $('#pZone').textContent = 'Your time zone is ' + zoneName() + ' (' + offsetText(new Date()) + '). The clock follows your device automatically.';

  $('#walls').addEventListener('click', function (e) {
    var w = e.target.closest('.wall');
    if (!w) return;
    prefs.wall = w.getAttribute('data-wall');
    savePrefs();
    applyPrefs();
  });
  $('#p24').addEventListener('change', function () { prefs.hour24 = this.checked; savePrefs(); applyPrefs(); });
  $('#pSec').addEventListener('change', function () { prefs.seconds = this.checked; savePrefs(); applyPrefs(); });
  $('#pMag').addEventListener('change', function () {
    prefs.magnify = this.checked;
    if (!prefs.magnify) { targets = slots.map(function () { return 1; }); kick(); }
    savePrefs();
  });
  $('#pNote').addEventListener('change', function () { prefs.notify = this.checked; savePrefs(); });
  $('#pSize').addEventListener('input', function () { prefs.dock = parseInt(this.value, 10); savePrefs(); applyPrefs(); });
  $('#pTest').addEventListener('click', function () {
    notify('Notifications', 'This is how a notification looks.', 'prefs', true);
  });

  applyPrefs();

  /* ======================================================
     Contact form
     ====================================================== */
  var form = $('#note');
  var sendButton = $('#send');
  var status = $('#status');

  function say(text, bad) {
    status.textContent = text;
    status.classList.toggle('bad', !!bad);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    /* Bots fill the hidden field. People never see it. */
    if (form.elements._gotcha.value) return;

    var data = {
      email: form.elements.email.value,
      message: form.elements.message.value,
      _subject: 'New message from your portfolio'
    };

    sendButton.disabled = true;
    say('Sending...');

    sendToPaul(data)
      .then(function () {
        form.reset();
        say('Sent. Thanks, I will reply soon.');
        notify('Message sent', 'Thanks for reaching out. Paul will reply by email.', 'mail');
      })
      .catch(function (err) {
        var notReady = err && err.message === 'not-configured';
        say(notReady ? 'The form is not connected yet. Please use WhatsApp or LinkedIn for now.' : 'Could not send. Please try WhatsApp or LinkedIn.', true);
        notify('Message not sent', notReady ? 'The form is not connected yet. Please use WhatsApp.' : 'Something went wrong. Please try WhatsApp or LinkedIn.', 'mail');
      })
      .then(function () {
        sendButton.disabled = false;
      });
  });
})();
