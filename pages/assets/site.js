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
    return esc(String(s).replace(/\{app\}/g, CFG.appUrl || "/application/eminapp/"))
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
        '<select class="lang" id="lang" aria-label="Language"><option value="az">AZ</option><option value="ru">RU</option><option value="tr">TR</option><option value="en">EN</option></select>' +
        '<a class="btn sm cta" href="/application/download" data-t="cta"></a>' +
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
          '<span class="pl" aria-hidden="true"></span></button><div class="mg-d"><div class="mg-dl">' +
          g.items.map(function (it) {
            return '<a href="' + it.u + '"' + (here(it.u) ? ' class="on"' : "") + "><b>" + esc(it.t) + "</b>" + (it.d ? "<small>" + esc(it.d) + "</small>" : "") + "</a>";
          }).join("") + "</div></div></div>";
      }).join("");
    }
    var mp = document.getElementById("mpanel-in");
    if (mp) {
      mp.innerHTML = menu.map(function (g) {
        var on = g.items.some(function (it) { return here(it.u); });
        return '<div class="mx' + (on ? " open" : "") + '"><button class="mx-b">' + esc(g.h) + '<span class="pl" aria-hidden="true"></span></button><div class="mx-d"><div>' +
          g.items.map(function (it) { return '<a href="' + it.u + '"' + (here(it.u) ? ' class="on"' : "") + ">" + esc(it.t) + "</a>"; }).join("") +
          "</div></div></div>";
      }).join("") + '<a class="btn mx-cta" href="/application/download">' + esc(get(T, "cta") || "") + "</a>";
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
      el.classList.add("acc-list");
      el.innerHTML = sectionsHtml(arr, !el.hasAttribute("data-closed"));
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
    // Proqramın ünvanı (common.json → "_" → appUrl): <a data-app-link>
    document.querySelectorAll("[data-app-link]").forEach(function (a) { a.href = CFG.appUrl || "/application/eminapp/"; });
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
      requestAnimationFrame(function () { b.style.transition = "height .34s cubic-bezier(.4,0,.2,1)"; b.style.height = h + "px"; });
    } else {
      b.style.height = b.offsetHeight + "px"; b.style.overflow = "hidden";
      requestAnimationFrame(function () { b.style.transition = "height .3s cubic-bezier(.4,0,.2,1)"; b.style.height = "0px"; });
    }
    clearTimeout(d._t);
    d._t = setTimeout(function () {
      if (!open) d.open = false;
      b.style.height = ""; b.style.overflow = ""; b.style.transition = "";
    }, 360);
  }
  function bindAcc(root) {
    root.querySelectorAll("details.acc").forEach(function (d) {
      if (d._acc) return;
      d._acc = 1;
      var s = d.querySelector("summary");
      s.addEventListener("click", function (e) {
        e.preventDefault();
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
    bindAcc(document);
  }
  function openHash() {
    if (!location.hash) return;
    var t = document.getElementById(location.hash.slice(1));
    if (t && t.matches("details.acc")) {
      if (!t.open) t.querySelector("summary").click();
      setTimeout(function () { t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 380);
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
      parts.forEach(function (p) {
        if (p._) Object.keys(p._).forEach(function (k) { CFG[k] = p._[k]; });
        var src = p[lang] || p.az || {};
        Object.keys(src).forEach(function (k) { T[k] = src[k]; });
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
