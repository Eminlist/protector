// ProTechtor™ — sayt səhifələri üçün ümumi skript.
// Bütün mətnlər /texts/*.json fayllarındadır. HTML yalnız data-t açarlarını saxlayır.
(function () {
  "use strict";
  var LANGS = ["az", "ru", "tr", "en"];
  var LANG_KEY = "antiudar_lang"; // proqramla eyni açar — dil seçimi ortaqdır
  var page = document.body.getAttribute("data-page") || "";

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
  // Sadə işarələmə: **qalın** və [mətn](link)
  function fmt(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
        var ext = /^https?:/.test(u);
        return '<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + t + "</a>";
      });
  }

  var lang = pickLang();
  var T = {};

  function render() {
    document.documentElement.lang = lang;
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
    // Siyahılar və bölmələr: data-list="açar" → massiv
    document.querySelectorAll("[data-list]").forEach(function (el) {
      var arr = get(T, el.getAttribute("data-list"));
      if (!Array.isArray(arr)) return;
      var tag = el.tagName === "OL" || el.tagName === "UL" ? "li" : "p";
      el.innerHTML = arr.map(function (x) { return "<" + tag + ">" + fmt(x) + "</" + tag + ">"; }).join("");
    });
    // Hüquqi mətnlər: data-sections="açar" → [{h, p:[...], ul:[...]}]
    document.querySelectorAll("[data-sections]").forEach(function (el) {
      var arr = get(T, el.getAttribute("data-sections"));
      if (!Array.isArray(arr)) return;
      el.innerHTML = arr.map(function (s) {
        var h = s.h ? "<h2>" + fmt(s.h) + "</h2>" : "";
        var p = (s.p || []).map(function (x) { return "<p>" + fmt(x) + "</p>"; }).join("");
        var ul = s.ul ? "<ul>" + s.ul.map(function (x) { return "<li>" + fmt(x) + "</li>"; }).join("") + "</ul>" : "";
        var p2 = (s.p2 || []).map(function (x) { return "<p>" + fmt(x) + "</p>"; }).join("");
        var img = s.img ? '<img class="shot" loading="lazy" src="' + esc(s.img) + '" alt="' + esc(s.h || "") + '">' : "";
        return h + p + ul + p2 + img;
      }).join("");
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
    var title = get(T, "page.title");
    if (title) document.title = title + " — ProTechtor™";
    var desc = get(T, "page.desc");
    var md = document.querySelector('meta[name="description"]');
    if (desc && md) md.setAttribute("content", desc);
    var sel = document.getElementById("lang");
    if (sel) sel.value = lang;
    document.dispatchEvent(new CustomEvent("pt:rendered", { detail: { lang: lang, T: T } }));
  }

  function load() {
    var files = ["common"].concat(page ? [page] : []);
    return Promise.all(files.map(function (f) {
      return fetch("/texts/" + f + ".json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    })).then(function (parts) {
      T = {};
      parts.forEach(function (p) {
        var src = p[lang] || p.az || {};
        Object.keys(src).forEach(function (k) { T[k] = src[k]; });
      });
      render();
    });
  }

  window.PT = {
    lang: function () { return lang; },
    t: function (k) { return get(T, k); },
    fmt: fmt
  };

  document.addEventListener("DOMContentLoaded", function () {
    var sel = document.getElementById("lang");
    if (sel) sel.addEventListener("change", function () { lang = sel.value; store(LANG_KEY, lang); load(); });
    var mb = document.getElementById("menu-btn");
    var nav = document.getElementById("nav");
    if (mb && nav) mb.addEventListener("click", function () { nav.classList.toggle("open"); });
    if (nav) nav.querySelectorAll("a").forEach(function (a) {
      if (a.getAttribute("href") === location.pathname) a.classList.add("on");
    });
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
    load();
  });
})();
