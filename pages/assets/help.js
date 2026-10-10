// ProTechtor™ — Yardım mərkəzi (/help və /help/<mövzu>).
// Mətnlər: /texts/help.json. Mövzu səhifəsi <body data-help="colors"> kimi işarələnir, mərkəz isə data-help="hub".
(function () {
  "use strict";
  var mode = document.body.getAttribute("data-help") || "hub";

  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/\*\*|\{[^}]*\}|\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[əä]/g, "e").replace(/[ıİ]/g, "i").replace(/[öо]/g, "o").replace(/[üu]/g, "u")
      .replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ё/g, "е");
  }
  function plain(s) { return String(s || "").replace(/\*\*|\{[^}]*\}/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); }
  function secText(s) { return [s.h].concat(s.p || [], s.ul || [], s.ol || [], s.p2 || []).join(" "); }

  function still() {
    var el = document.getElementById("still");
    if (!el) return;
    el.innerHTML = '<div><h3>' + PT.fmt(PT.t("hub.still") || "") + "</h3><p>" + PT.fmt(PT.t("hub.stillP") || "") + '</p></div><a class="btn" href="/contact">' + PT.esc(PT.t("hub.contact") || "") + "</a>";
  }

  /* ---------- Mərkəz: axtarış + populyar məqalələr ---------- */
  var index = [], idxLang = "";
  function buildIndex() {
    var lang = PT.lang();
    if (idxLang === lang) return Promise.resolve();
    idxLang = lang;
    index = [];
    var topics = PT.t("topics") || {};
    Object.keys(topics).forEach(function (k) {
      (topics[k].s || []).forEach(function (s, i) {
        index.push({ h: plain(s.h), sub: topics[k].t, u: "/help/" + k + "#s" + (i + 1), x: norm(secText(s) + " " + topics[k].t) });
      });
    });
    var extra = [["guide", "/application/guide", "g"], ["install", "/application/install", "s"]];
    return Promise.all(extra.map(function (e) { return PT.texts(e[0]); })).then(function (parts) {
      parts.forEach(function (p, j) {
        var src = p[lang] || p.az || {};
        var arr = src[extra[j][2]] || [];
        var title = src.page ? src.page.title : "";
        arr.forEach(function (s, i) { index.push({ h: plain(s.h), sub: title, u: extra[j][1] + "#s" + (i + 1), x: norm(secText(s) + " " + title) }); });
      });
    });
  }
  function search(q) {
    var box = document.getElementById("hres");
    var words = norm(q).split(/\s+/).filter(function (w) { return w.length > 1; });
    if (!words.length) { box.hidden = true; box.innerHTML = ""; return; }
    buildIndex().then(function () {
      var res = index.map(function (r) {
        var sc = 0;
        words.forEach(function (w) { if (r.x.indexOf(w) >= 0) sc += 1; if (norm(r.h).indexOf(w) >= 0) sc += 2; });
        return { r: r, sc: sc };
      }).filter(function (o) { return o.sc >= words.length; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 8);
      box.hidden = false;
      box.innerHTML = res.length ? res.map(function (o) {
        return '<a href="' + o.r.u + '">' + PT.esc(o.r.h) + "<small>" + PT.esc(o.r.sub) + "</small></a>";
      }).join("") : '<div class="none">' + PT.esc(PT.t("hub.none") || "") + "</div>";
    });
  }
  function hub() {
    var pop = document.getElementById("pop");
    if (pop) pop.innerHTML = (PT.t("pop") || []).map(function (p) { return '<a href="' + p.u + '">' + PT.esc(p.t) + "</a>"; }).join("");
    var q = document.getElementById("hq");
    if (q && !q._b) {
      q._b = 1;
      var t;
      q.addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { search(q.value); }, 120); });
    }
    if (q && q.value) search(q.value);
  }

  /* ---------- Mövzu səhifəsi ---------- */
  function topic() {
    var tp = (PT.t("topics") || {})[mode];
    if (!tp) return;
    document.getElementById("ht").innerHTML = PT.fmt(tp.t);
    document.getElementById("hp").innerHTML = PT.fmt(tp.p || "");
    document.title = tp.t + " — ProTechtor™";
    var hs = document.getElementById("hs");
    hs.className = "acc-list";
    hs.innerHTML = PT.sections(tp.s || [], true);
    PT.bindAcc(hs);
    var more = document.getElementById("hmore");
    if (more) more.innerHTML = (PT.t("tiles") || []).filter(function (c) { return c.u !== "/help/" + mode; }).map(function (c) {
      return '<a class="tile" href="' + c.u + '"><span class="tile-ic">' + PT.icon(c.id) + "</span><b>" + PT.esc(c.t) + "</b></a>";
    }).join("");
    if (location.hash) {
      var el = document.getElementById(location.hash.slice(1));
      if (el && !el.open) setTimeout(function () { el.querySelector("summary").click(); setTimeout(function () { el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 380); }, 60);
    }
  }

  document.addEventListener("pt:rendered", function () {
    still();
    if (mode === "hub") hub(); else topic();
  });
})();
