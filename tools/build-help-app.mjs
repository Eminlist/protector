// ProTechtor™ — proqram (APK) üçün tək fayllıq Yardım mərkəzi.
// Hər deploy zamanı avtomatik qurulur: dist/help/app.html → https://protechtor.app/help/app
// İnternetsiz də işləyir: bütün mətnlər (4 dil), stil və ikonlar faylın içindədir.
// Mətnləri dəyişmək üçün yalnız pages/texts/*.json redaktə edin — bu fayl özü yenilənəcək.
// İstifadə: node tools/build-help-app.mjs <çıxış faylı>
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const P = (f) => path.join(root, "pages", f);
const read = (f) => JSON.parse(fs.readFileSync(P("texts/" + f + ".json"), "utf8"));
const out = process.argv[2] || path.join(root, "dist/help/app.html");

const T = { common: read("common"), help: read("help"), guide: read("guide"), install: read("install"), contact: read("contact") };
const css = fs.readFileSync(P("assets/site.css"), "utf8");
const siteJs = fs.readFileSync(P("assets/site.js"), "utf8");
const icons = siteJs.slice(siteJs.indexOf('var G = "#25d366"'), siteJs.indexOf("window.PT ="));

const app = `
(function () {
  "use strict";
  var DATA = ${JSON.stringify(T)};
  var SITE = "https://protechtor.app";
  ${icons}
  var LANGS = ["az", "ru", "tr", "en"], lang;
  try { lang = new URLSearchParams(location.search).get("lang") || localStorage.getItem("antiudar_lang"); } catch (e) {}
  if (LANGS.indexOf(lang) < 0) lang = "az";
  function tx(f) { return DATA[f][lang] || DATA[f].az; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // Daxili səhifələr bu faylın içində açılır, qalanları saytda
  var LOCAL = { "/help": "#/", "/help/colors": "#/colors", "/help/where": "#/where", "/help/notifications": "#/notifications", "/help/account": "#/account",
                "/help/troubleshooting": "#/troubleshooting", "/application/guide": "#/guide", "/application/install": "#/install", "/contact": "#/contact" };
  function link(u) {
    var m = u.match(/^([^#]*)(#.*)?$/), p = m[1], h = m[2] || "";
    if (LOCAL[p] !== undefined) return LOCAL[p] + (h ? "/" + h.slice(1) : "");
    if (/^\\//.test(u)) return SITE + u;
    return u;
  }
  function fmt(s) {
    return esc(String(s).replace(/\\{app\\}/g, "/application/eminapp/"))
      .replace(/\\*\\*(.+?)\\*\\*/g, "<b>$1</b>")
      .replace(/\\{dot:(\\w+)\\}/g, '<i class="sw sw-$1"></i>')
      .replace(/\\{bar:(\\w+)\\}/g, '<i class="sbar sw-$1"></i>')
      .replace(/\\{tick:1\\}/g, '<b class="tk tk1">✓</b>').replace(/\\{tick:2\\}/g, '<b class="tk tk2">✓✓</b>')
      .replace(/\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/g, function (m, t, u) {
        var h = link(u), ext = /^https?:|^mailto:/.test(h);
        return '<a href="' + h + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + t + "</a>";
      });
  }
  function sections(arr, open) {
    return '<div class="acc-list">' + arr.map(function (s, i) {
      var b = (s.p || []).map(function (x) { return "<p>" + fmt(x) + "</p>"; }).join("");
      if (s.ol) b += '<ol class="steps">' + s.ol.map(function (x) { return "<li>" + fmt(x) + "</li>"; }).join("") + "</ol>";
      if (s.ul) b += "<ul>" + s.ul.map(function (x) { return "<li>" + fmt(x) + "</li>"; }).join("") + "</ul>";
      b += (s.p2 || []).map(function (x) { return "<p>" + fmt(x) + "</p>"; }).join("");
      return '<details class="acc" id="s' + (i + 1) + '"' + (i + 1 === open ? " open" : "") + "><summary>" + (s.i ? '<span class="ai">' + esc(s.i) + "</span>" : "") +
        "<span>" + fmt(s.h || "") + '</span><span class="chev">›</span></summary><div class="acc-body">' + b + "</div></details>";
    }).join("") + "</div>";
  }
  function tiles(arr) {
    return '<div class="tiles">' + arr.map(function (c) {
      return '<a class="tile" href="' + link(c.u) + '"><span class="tile-ic">' + (ICONS[c.id] || "") + "</span><b>" + esc(c.t) + "</b></a>";
    }).join("") + "</div>";
  }
  function still(H) {
    return '<div class="card still"><div><h3>' + esc(H.hub.still) + "</h3><p>" + esc(H.hub.stillP) + '</p></div><a class="btn" href="#/contact">' + esc(H.hub.contact) + "</a></div>";
  }
  function page(h, p, body) {
    var H = tx("help");
    return '<a class="crumb" href="#/">‹ ' + esc(H.hub.back) + '</a><div class="hero" style="padding-top:8px"><h1>' + fmt(h) + "</h1>" + (p ? "<p>" + fmt(p) + "</p>" : "") + "</div>" + body + still(H);
  }
  function view() {
    var H = tx("help"), r = (location.hash || "#/").slice(2).split("/"), id = r[0], open = r[1] ? +String(r[1]).replace("s", "") : 1;
    var html;
    if (!id) {
      html = '<div class="help-hero"><h1>' + esc(H.hub.h) + "</h1></div>" +
        '<h2 class="sec-h">' + esc(H.hub.topics) + "</h2>" + tiles(H.tiles) +
        '<h2 class="sec-h">' + esc(H.hub.popular) + '</h2><div class="plist">' + H.pop.map(function (p) { return '<a href="' + link(p.u) + '">' + esc(p.t) + "</a>"; }).join("") + "</div>" + still(H);
    } else if (H.topics[id]) {
      html = page(H.topics[id].t, H.topics[id].p, sections(H.topics[id].s, open));
    } else if (id === "guide") {
      var g = tx("guide"); html = page(g.hero.h, g.hero.p, sections(g.g, open));
    } else if (id === "install") {
      var n = tx("install"); html = page(n.hero.h, n.hero.p, sections(n.s, open));
    } else if (id === "contact") {
      var c = tx("contact");
      html = page(c.hero.h, c.hero.p, '<div class="grid">' +
        '<div class="card contact"><div class="ic">✈️</div><div><h3>' + esc(c.tg.h) + '</h3><a href="https://t.me/protechtor_app" target="_blank" rel="noopener">@protechtor_app</a></div></div>' +
        '<div class="card contact"><div class="ic">✉️</div><div><h3>' + esc(c.mail.h) + '</h3><a href="mailto:app.protechtor@gmail.com">app.protechtor@gmail.com</a></div></div>' +
        '<div class="card contact"><div class="ic">💬</div><div><h3>' + esc(c.chat.h) + '</h3><span class="meta">' + esc(c.chat.p) + "</span></div></div></div>").replace(/<div class="card still">[\\s\\S]*$/, "");
    } else { location.hash = "#/"; return; }
    document.getElementById("v").innerHTML = html;
    document.documentElement.lang = lang;
    document.title = (H.page.title) + " — ProTechtor™";
    document.querySelectorAll("details.acc>summary").forEach(function (s) {
      s.addEventListener("click", function (e) {
        e.preventDefault();
        var d = s.parentElement, o = !d.open;
        d.parentElement.querySelectorAll("details.acc[open]").forEach(function (x) { x.open = false; });
        d.open = o;
      });
    });
    var t = r[1] && document.getElementById("s" + open);
    if (t) t.scrollIntoView({ block: "start" }); else window.scrollTo(0, 0);
  }
  var sel = document.getElementById("lang");
  sel.value = lang;
  sel.addEventListener("change", function () { lang = sel.value; try { localStorage.setItem("antiudar_lang", lang); } catch (e) {} view(); });
  window.addEventListener("hashchange", view);
  view();
})();`;

const html = `<!doctype html>
<html lang="az">
<head>
<!-- AVTOMATİK YARADILIB (tools/build-help-app.mjs). Bu faylı əl ilə redaktə etməyin — pages/texts/*.json dəyişin. -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Yardım mərkəzi — ProTechtor™</title>
<meta name="theme-color" content="#0a0a0a">
<style>${css}
.top>.wrap{justify-content:space-between}</style>
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="#/">ProTechtor™</a>
<select class="lang" id="lang" aria-label="Language"><option value="az">AZ</option><option value="ru">RU</option><option value="tr">TR</option><option value="en">EN</option></select></div></header>
<main><div class="wrap" id="v"></div></main>
<script>${app}</script>
</body>
</html>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log("help app:", out, (html.length / 1024).toFixed(1) + " KB");
