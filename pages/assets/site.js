// ProTechtor™ — sayt səhifələri üçün ümumi skript.
// Bütün mətnlər /texts/*.json fayllarındadır. HTML yalnız data-t açarlarını saxlayır.
// Menyu və alt hissə (footer) hər səhifədə buradan qurulur — menyunu dəyişmək üçün
// yalnız /texts/common.json → "menu" bölməsini redaktə edin.
(function () {
  "use strict";
  var LANGS = ["az", "ru", "tr", "en"];
  var LANG_KEY = "antiudar_lang"; // proqramla eyni açar — dil seçimi ortaqdır
  var body = document.body;
  var page = body.getAttribute("data-page") || "";
  var extra = (body.getAttribute("data-texts") || "").split(",").filter(Boolean);

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function pickLang() {
    var q = new URLSearchParams(location.search).get("lang");
    if (q && LANGS.indexOf(q) >= 0) { store(LANG_KEY, q); return q; }
    var s = store(LANG_KEY);
    if (s && LANGS.indexOf(s) >= 0) return s;
    var n = (navigator.language || "az").slice(0, 2).toLowerCase();
    return LANGS.indexOf(n) >= 0 ? n : "az";
  }
  function get(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  var CFG = {};
  // Sadə işarələmə: **qalın**, [mətn](link), {app} — proqramın ünvanı,
  // rəng nişanları: {dot:green} {bar:yellow} {tick:1} {tick:2}
  function fmt(s) {
    return esc(String(s).replace(/\{app\}/g, "/application/download"))
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\{dot:(\w+)\}/g, '<i class="sw sw-$1" aria-hidden="true"></i>')
      .replace(/\{bar:(\w+)\}/g, '<i class="sbar sw-$1" aria-hidden="true"></i>')
      .replace(/\{tick:1\}/g, '<b class="tk tk1">✓</b>')
      .replace(/\{tick:2\}/g, '<b class="tk tk2">✓✓</b>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
        var ext = /^https?:/.test(u);
        return '<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + t + "</a>";
      });
  }

  var lang = pickLang();
  var T = {};

  /* ---------- Menyu (claude.com üslubunda) ---------- */
  function buildShell() {
    var top = document.getElementById("top");
    if (top && !top.firstChild) {
      top.className = "top";
      top.innerHTML =
        '<div class="wrap">' +
        '<a class="brand" href="/"><img src="/icon-192.png" alt="">ProTechtor™</a>' +
        '<nav class="mnav" id="mnav" aria-label="Menu"></nav>' +
        '<div class="top-r">' +
        '<button class="tbtn" id="themeBtn" type="button" aria-label="Theme">' +
        '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7"/></svg>' +
        '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg>' +
        '</button>' +
        '<select class="lang" id="lang" aria-label="Language"><option value="az">AZ</option><option value="ru">RU</option><option value="tr">TR</option><option value="en">EN</option></select>' +
        '<a class="btn sm cta" href="/application/download" data-t="__cta"></a>' +
        '<button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
        "</div></div>";
      // Panel header-in xaricindədir: header-dəki blur fixed paneli sıxışdırır
      var mp = document.createElement("div");
      mp.className = "mpanel"; mp.id = "mpanel"; mp.setAttribute("aria-hidden", "true");
      mp.innerHTML = '<div class="mpanel-in" id="mpanel-in"></div>';
      top.parentNode.insertBefore(mp, top.nextSibling);
      var sh = document.createElement("div");
      sh.className = "mshade"; sh.id = "mshade"; sh.setAttribute("aria-hidden", "true");
      top.parentNode.insertBefore(sh, mp);
    }
    var f = document.getElementById("foot");
    if (f && !f.firstChild) f.innerHTML = '<div class="wrap"><div class="fcols" id="fcols"></div><div class="fbar"><span>© ' + new Date().getFullYear() + ' ProTechtor™</span><span data-t="foot.rights"></span></div></div>';
  }
  function here(u) {
    var p = location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
    return u === p;
  }
  function renderMenu() {
    var menu = get(T, "menu");
    if (!Array.isArray(menu)) return;
    var nav = document.getElementById("mnav");
    if (nav) {
      nav.innerHTML = menu.map(function (g, i) {
        var on = g.items.some(function (it) { return here(it.u); });
        return '<div class="mg' + (on ? " on" : "") + '"><button class="mg-b" aria-expanded="false" data-i="' + i + '">' + esc(g.h) +
          '</button><div class="mg-d"><div class="mg-dl">' +
          g.items.map(function (it) {
            return '<a href="' + it.u + '"' + (here(it.u) ? ' class="on"' : "") + "><b>" + esc(it.t) + "</b>" + (it.d ? "<small>" + esc(it.d) + "</small>" : "") + "</a>";
          }).join("") + "</div></div></div>";
      }).join("");
    }
    var mp = document.getElementById("mpanel-in");
    if (mp) {
      mp.innerHTML = menu.map(function (g) {
        var on = g.items.some(function (it) { return here(it.u); });
        return '<div class="mx' + (on ? " open" : "") + '"><button class="mx-b">' + esc(g.h) + '</button><div class="mx-d"><div>' +
          g.items.map(function (it) { return '<a href="' + it.u + '"' + (here(it.u) ? ' class="on"' : "") + ">" + esc(it.t) + "</a>"; }).join("") +
          "</div></div></div>";
      }).join("") + '<a class="btn mx-cta" href="/application/download">' + esc(get(T, "__cta") || "") + "</a>";
    }
    var fc = document.getElementById("fcols");
    if (fc) {
      fc.innerHTML = menu.map(function (g) {
        return "<div><h4>" + esc(g.h) + "</h4>" + g.items.map(function (it) { return '<a href="' + it.u + '">' + esc(it.t) + "</a>"; }).join("") + "</div>";
      }).join("");
    }
  }
  function bindMenu() {
    var nav = document.getElementById("mnav");
    function closeAll(except) {
      if (!nav) return;
      nav.querySelectorAll(".mg.open").forEach(function (g) {
        if (g !== except) { g.classList.remove("open"); g.querySelector(".mg-b").setAttribute("aria-expanded", "false"); }
      });
    }
    if (nav) {
      nav.addEventListener("click", function (e) {
        var b = e.target.closest(".mg-b");
        if (!b) return;
        var g = b.parentElement, o = !g.classList.contains("open");
        closeAll(g);
        g.classList.toggle("open", o);
        b.setAttribute("aria-expanded", o ? "true" : "false");
      });
      var hoverable = window.matchMedia("(hover:hover) and (pointer:fine)");
      nav.addEventListener("mouseover", function (e) {
        if (!hoverable.matches) return;
        var g = e.target.closest(".mg");
        if (g && !g.classList.contains("open")) { closeAll(g); g.classList.add("open"); }
      });
      nav.addEventListener("mouseleave", function () { if (hoverable.matches) closeAll(); });
      document.addEventListener("click", function (e) { if (!e.target.closest(".mg")) closeAll(); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeAll(); setPanel(false); } });
    }
    var bu = document.getElementById("burger"), mp = document.getElementById("mpanel");
    function setPanel(o) {
      if (!mp || !bu) return;
      mp.classList.toggle("open", o);
      var sh = document.getElementById("mshade"); if (sh) sh.classList.toggle("open", o);
      body.classList.toggle("menu-open", o);
      bu.classList.toggle("x", o);
      bu.setAttribute("aria-expanded", o ? "true" : "false");
      mp.setAttribute("aria-hidden", o ? "false" : "true");
    }
    window.__ptMenu = setPanel;
    // keçiddə menyu bağlanır; geri qayıdanda (keşdən) menyu və ✕ ikonu açıq qalmır
    if (mp) mp.addEventListener("click", function (e) { if (e.target.closest("a[href]")) setPanel(false); });
    addEventListener("pageshow", function () { setPanel(false); closeAll(); });
    addEventListener("pagehide", function () { setPanel(false); });
    if (bu) bu.addEventListener("click", function () { setPanel(!mp.classList.contains("open")); });
    var shd = document.getElementById("mshade");
    if (shd) shd.addEventListener("click", function () { setPanel(false); });
    if (mp) mp.addEventListener("click", function (e) {
      var b = e.target.closest(".mx-b");
      if (!b) return;
      var x = b.parentElement, o = !x.classList.contains("open");
      mp.querySelectorAll(".mx.open").forEach(function (y) { if (y !== x) y.classList.remove("open"); });
      x.classList.toggle("open", o);
    });
  }

  /* ---------- Mətnlərin yerləşdirilməsi ---------- */
  function sectionsHtml(arr, openFirst) {
    return arr.map(function (s, i) {
      var p = (s.p || []).map(function (x) { return "<p>" + fmt(x) + "</p>"; }).join("");
      var ul = s.ul ? "<ul>" + s.ul.map(function (x) { return "<li>" + fmt(x) + "</li>"; }).join("") + "</ul>" : "";
      if (s.ol) ul = '<ol class="steps">' + s.ol.map(function (x) { return "<li>" + fmt(x) + "</li>"; }).join("") + "</ol>" + ul;
      var p2 = (s.p2 || []).map(function (x) { return "<p>" + fmt(x) + "</p>"; }).join("");
      var img = s.img ? '<img class="shot" loading="lazy" src="' + esc(s.img) + '" alt="' + esc(s.h || "") + '">' : "";
      return '<details class="acc" id="s' + (i + 1) + '"' + (openFirst && i === 0 ? " open" : "") + "><summary>" +
        (s.i ? '<span class="ai">' + esc(s.i) + "</span>" : "") + "<span>" + fmt(s.h || "") + '</span><span class="chev">›</span></summary>' +
        '<div class="acc-body">' + p + ul + p2 + img + "</div></details>";
    }).join("");
  }
  function render() {
    document.documentElement.lang = lang;
    renderMenu();
    document.querySelectorAll("[data-t]").forEach(function (el) {
      var v = get(T, el.getAttribute("data-t"));
      if (typeof v === "string") el.innerHTML = fmt(v);
    });
    document.querySelectorAll("[data-t-attr]").forEach(function (el) {
      el.getAttribute("data-t-attr").split(";").forEach(function (pair) {
        var p = pair.split(":");
        var v = get(T, p[1]);
        if (typeof v === "string") el.setAttribute(p[0], v);
      });
    });
    document.querySelectorAll("[data-list]").forEach(function (el) {
      var arr = get(T, el.getAttribute("data-list"));
      if (!Array.isArray(arr)) return;
      var tag = el.tagName === "OL" || el.tagName === "UL" ? "li" : "p";
      el.innerHTML = arr.map(function (x) { return "<" + tag + ">" + fmt(x) + "</" + tag + ">"; }).join("");
    });
    // Bölmələr (proqramdakı kimi açılan siyahı): data-sections="açar" → [{i, h, p:[...], ul:[...], p2:[...], img}]
    document.querySelectorAll("[data-sections]").forEach(function (el) {
      var arr = get(T, el.getAttribute("data-sections"));
      if (!Array.isArray(arr)) return;
      el.classList.add("acc-list", "vstrip");
      el.innerHTML = sectionsHtml(arr, true);
      bindAcc(el);
    });
    // Kartlar: data-cards="açar" → [{i, h, p}]
    document.querySelectorAll("[data-cards]").forEach(function (el) {
      var arr = get(T, el.getAttribute("data-cards"));
      if (!Array.isArray(arr)) return;
      el.innerHTML = arr.map(function (c) {
        return '<div class="card feat">' + (c.i ? '<div class="ic">' + esc(c.i) + "</div>" : "") +
          (c.h ? "<h3>" + fmt(c.h) + "</h3>" : "") + (c.p ? "<p>" + fmt(c.p) + "</p>" : "") + "</div>";
      }).join("");
    });
    // Keçid kartları: data-links="açar" → [{id, t, d, u}] — ikonlar aşağıdakı ICONS siyahısındandır
    document.querySelectorAll("[data-links]").forEach(function (el) {
      var arr = get(T, el.getAttribute("data-links"));
      if (!Array.isArray(arr)) return;
      el.innerHTML = arr.map(function (c) {
        return '<a class="tile" href="' + c.u + '"><span class="tile-ic">' + (ICONS[c.id] || "") + "</span><b>" + esc(c.t) + "</b>" +
          (c.d ? "<small>" + esc(c.d) + "</small>" : "") + "</a>";
      }).join("");
    });
    var title = get(T, "page.title");
    if (title) document.title = title + " — ProTechtor™";
    var desc = get(T, "page.desc");
    var md = document.querySelector('meta[name="description"]');
    if (desc && md) md.setAttribute("content", desc);
    var sel = document.getElementById("lang");
    if (sel) sel.value = lang;
    document.dispatchEvent(new CustomEvent("pt:rendered", { detail: { lang: lang, T: T } }));
  }

  // Açılan bölmələr: hamar açılma, eyni siyahıda bir anda yalnız biri açıq qalır
  function slide(d, open) {
    var b = d.querySelector(".acc-body");
    if (!b || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { d.open = open; return; }
    if (open) {
      d.open = true;
      var h = b.scrollHeight;
      b.style.height = "0px"; b.style.overflow = "hidden";
      requestAnimationFrame(function () { b.style.transition = "height .7s cubic-bezier(.4,0,.2,1)"; b.style.height = h + "px"; });
    } else {
      b.style.height = b.offsetHeight + "px"; b.style.overflow = "hidden";
      requestAnimationFrame(function () { b.style.transition = "height .6s cubic-bezier(.4,0,.2,1)"; b.style.height = "0px"; });
    }
    clearTimeout(d._t);
    d._t = setTimeout(function () {
      if (!open) d.open = false;
      b.style.height = ""; b.style.overflow = ""; b.style.transition = "";
    }, 720);
  }
  // Zolaq menyusu: hər yerdən (açıq yazının üstündən də) tutub sürüşdürmək olur, sonsuz fırlanır
  function stripLoop(w) {
    if (w._lp) return;
    w._lp = 1;
    var busy = false;
    function gap() { var g = parseFloat(getComputedStyle(w).columnGap); return isFinite(g) ? g : 10; }
    // kənara çatanda kənardakı zolaq o biri başa keçir — siyahı dairə kimi fırlanır
    w._fix = function () {
      if (busy || (w._hold && Date.now() < w._hold)) return;
      var kids = w.children;
      if (kids.length < 3 || w.scrollWidth - w.clientWidth < 8) return;
      busy = true;
      var g = gap(), n = 0, el, wd;
      while (w.scrollLeft > w.scrollWidth - w.clientWidth - 30 && n++ < kids.length) {
        el = w.firstElementChild; wd = el.getBoundingClientRect().width + g;
        if (el.getBoundingClientRect().right > w.getBoundingClientRect().left) break;
        w.appendChild(el); w.scrollLeft -= wd;
      }
      n = 0;
      while (w.scrollLeft < 30 && n++ < kids.length) {
        el = w.lastElementChild; wd = el.getBoundingClientRect().width + g;
        if (el.getBoundingClientRect().left < w.getBoundingClientRect().right) break;
        w.insertBefore(el, w.firstElementChild); w.scrollLeft += wd;
      }
      busy = false;
    };
    // Sonsuz fırlanma üçün zolaqların surəti əvvələ və sona əlavə olunur (bütün şaquli menyularda)
    w._fill = function () {
      if (w.querySelector(".vcl")) return;
      var orig = Array.prototype.slice.call(w.children);
      if (orig.length < 2) return; // bütün şaquli menyular (sığanlar da) sonsuz fırlanır
      var mk = function (d) {
        var c = d.cloneNode(true);
        c.classList.add("vcl"); c.open = false; c._acc = 0;
        if (c.id) c.removeAttribute("id");
        c.querySelectorAll("[id]").forEach(function (x) { x.removeAttribute("id"); });
        return c;
      };
      var first = orig[0];
      // qısa menyularda da açıq zolaq kənara dirənməsin deyə ehtiyat surətlər kifayət qədər olmalıdır
      var maxW = 0;
      orig.forEach(function (d) { maxW = Math.max(maxW, d.getBoundingClientRect().width); });
      for (var rnd = 0; rnd < 8; rnd++) {
        orig.forEach(function (d) { w.appendChild(mk(d)); });
        var lead = w.firstElementChild;
        orig.forEach(function (d) { w.insertBefore(mk(d), lead === first ? first : lead); });
        if (w.scrollWidth - w.clientWidth > w.clientWidth + maxW + 160) break;
      }
      busy = true;
      w.scrollLeft = first.offsetLeft - w.firstElementChild.offsetLeft;
      busy = false;
      if (typeof bindAcc === "function") bindAcc(w);
    };
    // Sürüşdürmə: kənara dirənəndə zolaqları o biri başa keçirib qalan məsafəni də gedir (heç nə itmir)
    w._move = function (dx) {
      for (var i = 0; i < 6 && Math.abs(dx) > 0.5; i++) {
        var a = w.scrollLeft;
        w.scrollLeft = a + dx;
        var got = w.scrollLeft - a;
        dx -= got;
        var b = w.scrollLeft;
        w._fix();
        if (Math.abs(dx) > 0.5 && w.scrollLeft === b && Math.abs(got) < 0.5) break; // daha yer yoxdur
      }
      w._fix();
    };
    setTimeout(function () { w._fill(); }, 0);
    var raf = 0;
    w.addEventListener("scroll", function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; w._fix(); });
    }, { passive: true });
    window.addEventListener("resize", function () { if (!w.querySelector(".vcl")) w._fill(); w._fix(); });
    setTimeout(function () { w._fix(); }, 400);
  }
  function dragStrip(w) {
    if (!w || w._dr) return;
    w._dr = 1;
    stripLoop(w);
    var sx = 0, sy = 0, st = 0, down = false, moved = false, axis = "", body = null, pid = null, ptype = "";
    var lx = 0, lt = 0, v = 0, inert = 0, wheelT = 0, wheelOn = false;
    // Zolağın sol kənarını menyunun sol kənarına düzləyən mövqelər (hiza nöqtələri)
    function snapPoints() {
      var r = w.getBoundingClientRect(), pl = parseFloat(getComputedStyle(w).paddingLeft) || 0, out = [];
      Array.prototype.forEach.call(w.children, function (c) {
        out.push(w.scrollLeft + c.getBoundingClientRect().left - r.left - pl);
      });
      return out;
    }
    // Buraxanda: sürüşdürmə sürəti ilə gedir və eyni tempdə ən yaxın zolağın hizasına oturur
    function glide(vel) {
      cancelAnimationFrame(inert);
      var cur = w.scrollLeft, proj = cur - vel * 280, pts = snapPoints(), best = cur, bd = Infinity;
      pts.forEach(function (p) {
        if (vel > 0.05 && p > cur + 1) return;   // sağa atılıb — geri (sola) getmir
        if (vel < -0.05 && p < cur - 1) return;  // sola atılıb — geri getmir
        var dd = Math.abs(p - proj);
        if (dd < bd) { bd = dd; best = p; }
      });
      var dist = best - cur;
      if (Math.abs(dist) < 1) return;
      var sp = Math.max(Math.abs(vel), 0.35);
      var dur = Math.min(1400, Math.max(260, 3 * Math.abs(dist) / sp)); // easeOutCubic başlanğıc sürəti = buraxılış sürəti
      var t0 = performance.now(), done = 0;
      var step = function (now) {
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3), want = dist * e;
        w._move(want - done); done = want;
        if (k < 1) inert = requestAnimationFrame(step); else inert = 0;
      };
      inert = requestAnimationFrame(step);
    }
    w._glide = glide;
    w.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest("a,button,input,textarea,select,iframe")) return;
      cancelAnimationFrame(inert); inert = 0;
      body = e.target.closest(".acc-body");
      down = true; moved = false; axis = ""; pid = e.pointerId; ptype = e.pointerType;
      sx = lx = e.clientX; sy = e.clientY; st = body ? body.scrollTop : 0;
      lt = performance.now(); v = 0;
    });
    window.addEventListener("pointermove", function (e) {
      if (!down || e.pointerId !== pid) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        // toxunuşda şaquli hərəkəti brauzer özü sürüşdürür (açıq yazı, səhifə)
        if (ptype !== "mouse" && Math.abs(dy) > Math.abs(dx)) { down = false; return; }
        moved = true;
        axis = Math.abs(dx) >= Math.abs(dy) || !body ? "x" : "y";
        w.classList.add("dragging");
        try { window.getSelection().removeAllRanges(); } catch (x) {}
      }
      if (e.cancelable) e.preventDefault();
      if (axis === "y") { body.scrollTop = st - dy; return; }
      var d = e.clientX - lx;
      w._move(-d);
      var now = performance.now(), dt = Math.max(1, now - lt);
      v = v * 0.35 + (d / dt) * 0.65; lx = e.clientX; lt = now;
    }, { passive: false });
    function up(e) {
      if (!down || (e && e.pointerId !== pid)) return;
      down = false;
      w.classList.remove("dragging");
      if (moved) { w._drag = 1; setTimeout(function () { w._drag = 0; }, 250); }
      if (moved && axis === "x") {
        if (performance.now() - lt > 90) v = 0; // dayanıb buraxıbsa — sadəcə hizaya oturur
        glide(v);
      }
    }
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    // Trekpad/təkərlə yana sürüşdürmə bitəndə də hizaya oturur
    w.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      wheelOn = true; cancelAnimationFrame(inert); inert = 0;
    }, { passive: true });
    w.addEventListener("scroll", function () {
      if (!wheelOn || down || inert) return;
      clearTimeout(wheelT);
      wheelT = setTimeout(function () { wheelOn = false; if (!down && !inert) glide(0); }, 160);
    }, { passive: true });
  }
  function bindAcc(root) {
    if (root.classList && root.classList.contains("vstrip")) { dragStrip(root); if (!root.querySelector(".vcl") && root._fill) setTimeout(root._fill, 0); }
    if (root.querySelectorAll) root.querySelectorAll(".vstrip").forEach(dragStrip);
    root.querySelectorAll("details.acc").forEach(function (d) {
      if (d._acc) return;
      d._acc = 1;
      var s = d.querySelector("summary");
      s.addEventListener("click", function (e) {
        e.preventDefault();
        var par = d.parentElement;
        if (par && par.classList.contains("vstrip")) {
          if (par._drag) return;
          if (window.__ptTick) window.__ptTick();
          if (d.open) return;
          var kids = Array.prototype.slice.call(par.children), k = kids.indexOf(d);
          kids.forEach(function (o, j) {
            if (o !== d && o.open) o.open = false;
            if (j === k) return;
            o.classList.remove("sl-l", "sl-r"); void o.offsetWidth;
            o.classList.add(j < k ? "sl-l" : "sl-r");
            setTimeout(function () { o.classList.remove("sl-l", "sl-r"); }, 650);
          });
          d.open = true;
          var toD = function () {
            try {
              var x = par.scrollLeft + d.getBoundingClientRect().left - par.getBoundingClientRect().left - (parseFloat(getComputedStyle(par).paddingLeft) || 0);
              par.scrollTo({ left: Math.max(0, x), behavior: "smooth" });
            } catch (x) {}
          };
          par._hold = Date.now() + 1400;
          toD(); setTimeout(toD, 650);
          return;
        }
        var willOpen = !d.open;
        if (willOpen && d.parentElement) {
          Array.prototype.forEach.call(d.parentElement.children, function (o) {
            if (o !== d && o.matches && o.matches("details.acc[open]")) slide(o, false);
          });
        }
        slide(d, willOpen);
      });
    });
  }
  // HTML-dəki kartları açılan bölməyə çevirir: <section class="card" data-acc="ikon" [data-acc-open]>
  function makeAcc() {
    document.querySelectorAll("section.card[data-acc]").forEach(function (sec) {
      var d = document.createElement("details");
      d.className = "acc card";
      if (sec.id) d.id = sec.id;
      if (sec.hasAttribute("data-acc-open")) d.open = true;
      var sum = document.createElement("summary");
      var ic = sec.getAttribute("data-acc");
      if (ic) { var a = document.createElement("span"); a.className = "ai"; a.textContent = ic; sum.appendChild(a); }
      var h = sec.querySelector("h2");
      var t = document.createElement("span");
      if (h) { t.setAttribute("data-t", h.getAttribute("data-t")); h.remove(); }
      sum.appendChild(t);
      var ch = document.createElement("span"); ch.className = "chev"; ch.textContent = "›"; sum.appendChild(ch);
      var bd = document.createElement("div"); bd.className = "acc-body";
      while (sec.firstChild) bd.appendChild(sec.firstChild);
      d.appendChild(sum); d.appendChild(bd);
      sec.replaceWith(d);
    });
    // Ardıcıl məlumat bölmələri şaquli zolaqlara yığılır (biri açıq, telefonda sürüşdürülür)
    document.querySelectorAll("details.acc").forEach(function (d) {
      if (d.parentElement.classList.contains("vstrip")) return;
      var w = document.createElement("div");
      w.className = "acc-list vstrip";
      d.parentNode.insertBefore(w, d);
      var n = d;
      while (n && n.matches && n.matches("details.acc")) { var nx = n.nextElementSibling; w.appendChild(n); n = nx; }
    });
    document.querySelectorAll(".vstrip").forEach(function (w) {
      if (!w.querySelector("details[open]") && w.firstElementChild) w.firstElementChild.open = true;
    });
    bindAcc(document);
  }
  function openHash() {
    if (!location.hash) return;
    var t = document.getElementById(location.hash.slice(1));
    if (t && t.matches("details.acc")) {
      if (!t.open) t.querySelector("summary").click();
      setTimeout(function () { t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 740);
    }
  }
  window.addEventListener("hashchange", openHash);

  var cache = {};
  function fetchText(f) {
    if (!cache[f]) cache[f] = fetch("/texts/" + f + ".json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    return cache[f];
  }
  function load() {
    var files = ["common"].concat(page ? [page] : [], extra);
    return Promise.all(files.map(fetchText)).then(function (parts) {
      T = {};
      var c0 = parts[0] || {};
      parts.forEach(function (p) {
        if (p._) Object.keys(p._).forEach(function (k) { CFG[k] = p._[k]; });
        var src = p[lang] || p.az || {};
        Object.keys(src).forEach(function (k) { T[k] = src[k]; });
      T.__cta = ((c0[lang] || c0.az || {}).cta) || "";
      });
      render();
      if (!load._h) { load._h = 1; setTimeout(openHash, 60); }
    });
  }

  /* ---------- İkonlar (Yardım mərkəzi plitələri) ---------- */
  var G = "#25d366", G2 = "#1a9e4b", L = "#dff7e8", K = "#0b1f12";
  function svg(inner) { return '<svg viewBox="0 0 64 64" aria-hidden="true">' + inner + "</svg>"; }
  var ICONS = {
    guide: svg('<rect x="10" y="8" width="30" height="48" rx="6" fill="' + G + '" stroke="' + K + '" stroke-width="2.5"/><rect x="14" y="14" width="22" height="34" rx="2" fill="' + L + '"/><circle cx="46" cy="40" r="11" fill="#fff" stroke="' + K + '" stroke-width="2.5"/><path d="M54 48l6 6" stroke="' + K + '" stroke-width="4" stroke-linecap="round"/><path d="M18 20h14M18 26h10M18 32h12" stroke="' + G2 + '" stroke-width="2.5" stroke-linecap="round"/>'),
    install: svg('<rect x="18" y="6" width="28" height="52" rx="6" fill="' + G + '" stroke="' + K + '" stroke-width="2.5"/><rect x="22" y="12" width="20" height="38" rx="2" fill="' + L + '"/><path d="M32 18v20m-7-7l7 7 7-7" stroke="' + K + '" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 44h14" stroke="' + G2 + '" stroke-width="3" stroke-linecap="round"/>'),
    colors: svg('<circle cx="22" cy="24" r="12" fill="' + G + '" stroke="' + K + '" stroke-width="2.5"/><circle cx="42" cy="24" r="12" fill="#f1c40f" stroke="' + K + '" stroke-width="2.5"/><circle cx="32" cy="42" r="12" fill="#e74c3c" stroke="' + K + '" stroke-width="2.5"/>'),
    where: svg('<rect x="14" y="6" width="36" height="52" rx="7" fill="' + G + '" stroke="' + K + '" stroke-width="2.5"/><rect x="18" y="12" width="28" height="40" rx="2" fill="' + L + '"/><rect x="21" y="15" width="22" height="6" rx="3" fill="#fff" stroke="' + G2 + '" stroke-width="1.5"/><circle cx="23" cy="47" r="2.6" fill="' + G2 + '"/><path d="M40 30c0 6-7 13-7 13s-7-7-7-13a7 7 0 0114 0z" fill="#fff" stroke="' + K + '" stroke-width="2.5"/><circle cx="33" cy="30" r="2.6" fill="' + K + '"/>'),
    notifications: svg('<path d="M32 8c-9 0-15 7-15 16v10l-5 8h40l-5-8V24c0-9-6-16-15-16z" fill="' + G + '" stroke="' + K + '" stroke-width="2.5" stroke-linejoin="round"/><path d="M26 46a6 6 0 0012 0" fill="' + L + '" stroke="' + K + '" stroke-width="2.5"/><circle cx="46" cy="14" r="7" fill="#e74c3c" stroke="' + K + '" stroke-width="2"/>'),
    account: svg('<rect x="8" y="14" width="48" height="36" rx="6" fill="' + G + '" stroke="' + K + '" stroke-width="2.5"/><circle cx="24" cy="30" r="6" fill="' + L + '" stroke="' + K + '" stroke-width="2"/><path d="M14 44c2-6 18-6 20 0" fill="' + L + '" stroke="' + K + '" stroke-width="2"/><path d="M38 26h12M38 33h9" stroke="' + K + '" stroke-width="2.5" stroke-linecap="round"/><path d="M44 6l3 5 5-3-1 6h-14l-1-6 5 3z" fill="#f1c40f" stroke="' + K + '" stroke-width="1.8" stroke-linejoin="round"/>'),
    troubleshooting: svg('<path d="M14 50l20-20" stroke="' + K + '" stroke-width="7" stroke-linecap="round"/><path d="M14 50l20-20" stroke="' + G + '" stroke-width="3.5" stroke-linecap="round"/><path d="M44 8a12 12 0 00-12 15l6 6a12 12 0 0015-12l-7 5-6-2-2-6z" fill="' + G + '" stroke="' + K + '" stroke-width="2.5" stroke-linejoin="round"/><circle cx="46" cy="46" r="10" fill="#fff" stroke="' + K + '" stroke-width="2.5"/><path d="M42 46l3 3 6-6" stroke="' + G2 + '" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
    contact: svg('<path d="M8 14h36a6 6 0 016 6v16a6 6 0 01-6 6H24l-10 8v-8H8a6 6 0 01-6-6V20a6 6 0 016-6z" fill="' + G + '" stroke="' + K + '" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 26h26M12 33h18" stroke="' + L + '" stroke-width="3" stroke-linecap="round"/><path d="M40 30l20-12-6 26-6-8-8-6z" fill="#fff" stroke="' + K + '" stroke-width="2.3" stroke-linejoin="round"/>'),
    privacy: svg('<path d="M32 6l20 8v14c0 14-9 24-20 30C21 52 12 42 12 28V14z" fill="' + G + '" stroke="' + K + '" stroke-width="2.5" stroke-linejoin="round"/><path d="M23 31l7 7 12-14" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
    help: svg('<circle cx="32" cy="32" r="24" fill="' + G + '" stroke="' + K + '" stroke-width="2.5"/><path d="M24 25a8 8 0 1112 7c-3 2-4 3-4 7" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round"/><circle cx="32" cy="47" r="3" fill="#fff"/>'),
    features: svg('<path d="M32 6l7 15 16 2-12 11 3 16-14-8-14 8 3-16L9 23l16-2z" fill="' + G + '" stroke="' + K + '" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 20l3 7 7 1-5 5 1 7-6-3" fill="' + L + '"/>'),
    download: svg('<path d="M18 44a12 12 0 01-1-24 16 16 0 0130-2 11 11 0 011 26z" fill="' + G + '" stroke="' + K + '" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 26v24m-8-8l8 8 8-8" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
  };

  /* Keçid kartları: kliklə flash + səs, sonra keçid */
  (function () {
    var ac = null;
    function tick() { // yalnız qısa klik səsi
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === "suspended") ac.resume();
        var t0 = ac.currentTime, n = Math.floor(ac.sampleRate * 0.03), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
        var src = ac.createBufferSource(); src.buffer = buf;
        var f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2200; f.Q.value = 0.8;
        var g = ac.createGain(); g.gain.setValueAtTime(0.5, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
        src.connect(f); f.connect(g); g.connect(ac.destination); src.start(t0);
        var o = ac.createOscillator(), og = ac.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(900, t0); o.frequency.exponentialRampToValueAtTime(380, t0 + 0.04);
        og.gain.setValueAtTime(0.12, t0); og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
        o.connect(og); og.connect(ac.destination); o.start(t0); o.stop(t0 + 0.06);
      } catch (e) {}
    }
    window.__ptTick = tick;
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest(".tile, .card.feat, .plist a");
      if (!t || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
      tick();
      t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash");
      setTimeout(function () { t.classList.remove("flash"); }, 460);
      var href = t.getAttribute("href");
      if (href && t.tagName === "A" && t.target !== "_blank") {
        e.preventDefault();
        setTimeout(function () { location.href = href; }, 260);
      }
    }, true);
  })();

  window.PT = {
    lang: function () { return lang; },
    t: function (k) { return get(T, k); },
    fmt: fmt,
    esc: esc,
    sections: sectionsHtml,
    bindAcc: bindAcc,
    icon: function (id) { return ICONS[id] || ""; },
    texts: fetchText,
    cfg: CFG
  };

  buildShell();

  /* Günəş / ay: ana səhifədə seçilən rəng bütün səhifələrdə eyni qalır (ortaq açar pt_home_theme), hər səhifədə dəyişmək olar */
  var THEME_KEY = "pt_home_theme";
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "light" ? "#f4f7f5" : "#0a0a0a");
  }
  (function () {
    var t = store(THEME_KEY);
    applyTheme(t === "light" ? "light" : "dark");
    var tb = document.getElementById("themeBtn");
    if (tb) tb.addEventListener("click", function () {
      var nt = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      applyTheme(nt); store(THEME_KEY, nt);
    });
    // başqa vərəqdə (və ya ana səhifədə) dəyişəndə bu səhifə də dərhal dəyişir
    window.addEventListener("storage", function (e) { if (e.key === THEME_KEY) applyTheme(e.newValue === "light" ? "light" : "dark"); });
    // dil seçimi: menyu düyməsi kimi kiçik düymə, aşağı açılan siyahı
    if (!document.querySelector('script[src^="/assets/ptui.js"]')) {
      var sc = document.createElement("script"); sc.src = "/assets/ptui.js?v=1"; document.head.appendChild(sc);
    }
  })();

  document.addEventListener("DOMContentLoaded", function () {
    var sel = document.getElementById("lang");
    if (sel) sel.addEventListener("change", function () { lang = sel.value; store(LANG_KEY, lang); load(); });
    bindMenu();
    makeAcc();
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
    load();
  });
})();

/* Maus izləyən zərrəcik toru — bütün səhifələrdə eyni (ana səhifədəki kimi) */
(function () {
  if (window.__ptFx || document.getElementById('particles') || /[?&]embed=1(&|$)/.test(location.search)) return;
  window.__ptFx = 1;
  try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:90;opacity:.85;pointer-events:none';
  var cx = cv.getContext('2d'), W = 0, H = 0, P = [], mouse = { x: -999, y: -999 };
  function low() { return document.documentElement.classList.contains('low-power'); }
  function initP() {
    W = cv.width = innerWidth; H = cv.height = innerHeight;
    var n = Math.min(90, Math.floor(W * H / 18000));
    P = []; for (var i = 0; i < n; i++) P.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5, s: Math.random() * 2 + 1 });
  }
  function draw() {
    requestAnimationFrame(draw);
    if (document.hidden) return;
    cx.clearRect(0, 0, W, H);
    if (low()) return;
    for (var i = 0; i < P.length; i++) {
      var p = P[i]; p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
      var dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy) || 1;
      if (d < 150) {
        var f = (150 - d) / 150; p.x += dx / d * f * 2; p.y += dy / d * f * 2;
        cx.strokeStyle = 'rgba(240,200,121,' + (f * .55) + ')'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(mouse.x, mouse.y); cx.stroke();
      }
      cx.fillStyle = 'rgba(240,200,121,.55)'; cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.283); cx.fill();
      for (var j = i + 1; j < P.length; j++) {
        var q = P[j], dd = Math.hypot(p.x - q.x, p.y - q.y);
        if (dd < 120) { cx.strokeStyle = 'rgba(147,160,184,' + ((1 - dd / 120) * .2) + ')'; cx.lineWidth = .7; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke(); }
      }
    }
  }
  function start() {
    document.body.insertBefore(cv, document.body.firstChild);
    initP(); addEventListener('resize', initP);
    addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) { mouse.x = t.clientX; mouse.y = t.clientY; } }, { passive: true });
    draw();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

/* Qeydiyyat / Giriş: səhifəni tərk etmədən yuxarıdan açılan panel.
   Panelin içində həmin səhifələr ?embed=1 rejimində (yalnız forma) açılır. */
(function () {
  var EMB = /[?&]embed=1(&|$)/.test(location.search);
  var AUTH = /^\/account\/(register|login)\/?$/;
  function path(a) { try { var u = new URL(a.href, location.href); return u.origin === location.origin ? u.pathname : ""; } catch (e) { return ""; } }
  if (EMB) {
    document.documentElement.classList.add("embed");
    // panel daxilində: qeydiyyat ⇄ giriş panel içində qalır, digər keçidlər əsas səhifəni dəyişir
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || e.defaultPrevented) return;
      var p = path(a);
      if (!p || a.getAttribute("href").charAt(0) === "#") return;
      e.preventDefault();
      if (AUTH.test(p)) location.href = p + "?embed=1";
      else window.top.location.href = a.href;
    });
    function size() { try { parent.postMessage({ ptH: document.documentElement.scrollHeight }, location.origin); } catch (e) {} }
    addEventListener("load", size);
    new MutationObserver(size).observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    setInterval(size, 800);
    return;
  }
  var box = null, fr = null, tabs = null;
  function build() {
    if (box) return;
    box = document.createElement("div");
    box.className = "authp";
    box.innerHTML = '<div class="authp-bg"></div><div class="authp-in" role="dialog" aria-modal="true">' +
      '<div class="authp-h"><div class="authp-t"><button type="button" data-u="/account/register"></button><button type="button" data-u="/account/login"></button></div>' +
      '<button type="button" class="authp-x" aria-label="✕">✕</button></div><iframe title=""></iframe></div>';
    document.body.appendChild(box);
    fr = box.querySelector("iframe"); tabs = box.querySelectorAll(".authp-t button");
    box.querySelector(".authp-bg").addEventListener("click", close);
    box.querySelector(".authp-x").addEventListener("click", close);
    tabs.forEach(function (b) { b.addEventListener("click", function () { if (window.__ptTick) window.__ptTick(); go(b.getAttribute("data-u")); }); });
    addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    addEventListener("message", function (e) {
      if (e.origin !== location.origin || !e.data || !e.data.ptH) return;
      fr.style.height = Math.min(e.data.ptH, innerHeight - 140) + "px";
    });
    fr.addEventListener("load", function () {
      var p = ""; try { p = fr.contentWindow.location.pathname; } catch (x) {}
      mark(p);
    });
  }
  function labels() {
    var m = (window.PT && PT.t("menu")) || [];
    var all = []; m.forEach(function (g) { (g.items || []).forEach(function (it) { all.push(it); }); });
    tabs.forEach(function (b) {
      var u = b.getAttribute("data-u"), it = all.filter(function (x) { return x.u === u; })[0];
      b.textContent = it ? it.t : (u.indexOf("register") > 0 ? "Qeydiyyat" : "Giriş");
    });
  }
  function mark(p) { tabs.forEach(function (b) { b.classList.toggle("on", p.indexOf(b.getAttribute("data-u")) === 0); }); }
  function go(u) { mark(u); fr.src = u + "?embed=1"; }
  function open(u) {
    build(); labels(); go(u);
    document.querySelectorAll(".mg-d").forEach(function (d) { d.parentElement.classList.remove("open"); });
    if (window.__ptMenu) window.__ptMenu(false);
    box.classList.add("show");
    requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add("in"); }); });
    document.documentElement.classList.add("authp-lock");
  }
  function close() {
    if (!box) return;
    box.classList.remove("in");
    document.documentElement.classList.remove("authp-lock");
    setTimeout(function () { box.classList.remove("show"); }, 650);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    var p = path(a);
    if (!AUTH.test(p)) return;
    e.preventDefault(); e.stopPropagation();
    if (window.__ptTick) window.__ptTick();
    open(p.replace(/\/$/, ""));
  }, true);
})();
