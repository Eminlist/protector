// ProTechtor™ — saytda gəzən pişik (ağ, mavi gözlü, boz qulaq və quyruq).
// Bütün sayt səhifələrində işləyir: döşəmədə (ekranın altı) gəzir, menyulara tullanır,
// menyu üstündə gəzir, menyu ətrafında fırlanır, oturur, quyruğunu yelləyir, pəncəsini yalayır,
// uzanır, yatır, gərnəşir, kursora baxır/arxasınca qaçır; toxunanda reaksiya verir.
// Kliklərə mane olmur (pointer-events: none).
(function () {
  "use strict";
  if (window.__ptCat) return;
  window.__ptCat = 1;

  var mobile = matchMedia("(max-width:700px)").matches;
  var fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  var W = mobile ? 60 : 80, H = W * 0.75;
  var SPEED = mobile ? 55 : 70, RUN = mobile ? 150 : 190;
  var FLOOR_PAD = 2;

  // Pişiyin "menyu" sayılan elementləri (sayt səhifələri + ana səhifə)
  var SEL = [
    ".mg-b", ".mg.open .mg-dl", ".top .brand", ".top .cta", ".top .lang",
    ".mpanel.open .mx-b",
    ".door.show", "nav.foot a", ".tools"
  ].join(",");

  /* ---------------- Rəsm (SVG) ---------------- */
  function head(cx, cy) {
    var eye = function (x) {
      return '<g class="ey" transform="translate(' + x + ',-1)"><ellipse rx="4.6" ry="5.4" fill="url(#ptEye)" stroke="#6b5f5a" stroke-width=".5"/>' +
        '<g class="pp"><ellipse rx="2" ry="3.4" fill="#12233f"/><circle cx="1.3" cy="-1.8" r="1.3" fill="#fff"/></g></g>';
    };
    return '<g transform="translate(' + cx + "," + cy + ')"><g class="hd">' +
      '<path d="M-17,-5 L-15,-27 L-2,-15Z" fill="#978b86"/><path d="M-14,-9 L-13,-22 L-6,-14Z" fill="#e8b4b8"/>' +
      '<path d="M17,-5 L15,-27 L2,-15Z" fill="#978b86"/><path d="M14,-9 L13,-22 L6,-14Z" fill="#e8b4b8"/>' +
      '<ellipse cx="-13" cy="6" rx="8" ry="7" fill="url(#ptFur)"/><ellipse cx="13" cy="6" rx="8" ry="7" fill="url(#ptFur)"/>' +
      '<ellipse rx="19" ry="16.5" fill="url(#ptFur)" stroke="#d8d1cb" stroke-width=".6"/>' +
      '<ellipse cy="-6" rx="15" ry="8" fill="#a99d97" opacity=".28"/>' +
      '<ellipse cy="-12" rx="9" ry="4" fill="#a99d97" opacity=".22"/>' +
      eye(-7) + eye(7) +
      '<g class="ec"><path d="M-11,-1 Q-7,2.5 -3,-1 M3,-1 Q7,2.5 11,-1" stroke="#6b5f5a" stroke-width="1.2" stroke-linecap="round" fill="none"/></g>' +
      '<path d="M-2.2,5.6 L2.2,5.6 L0,8.2Z" fill="#e79aa6"/>' +
      '<path d="M0,8.2 Q-2,10.6 -4,9.6 M0,8.2 Q2,10.6 4,9.6" stroke="#9b8f8a" stroke-width=".8" fill="none" stroke-linecap="round"/>' +
      '<ellipse class="tg" cy="11.2" rx="1.6" ry="2" fill="#f08aa0"/>' +
      '<path d="M-6,7.5 L-23,4 M-6,8.5 L-23,9.5 M6,7.5 L23,4 M6,8.5 L23,9.5" stroke="#bfb7b1" stroke-width=".5" opacity=".9"/>' +
      "</g></g>";
  }
  function leg(x, cls, shade) {
    return '<g class="lg ' + cls + '"><rect x="' + x + '" y="56" width="9" height="30" rx="4.5" fill="' + shade + '"/>' +
      '<ellipse cx="' + (x + 4.5) + '" cy="86" rx="6" ry="3" fill="' + shade + '"/></g>';
  }
  var DEFS =
    '<defs><radialGradient id="ptFur" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#f4efea"/><stop offset="1" stop-color="#e2dbd4"/></radialGradient>' +
    '<radialGradient id="ptEye" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#a6d0ff"/><stop offset=".6" stop-color="#4f86d4"/><stop offset="1" stop-color="#2d5a9e"/></radialGradient>' +
    '<linearGradient id="ptTail" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#cfc8c3"/><stop offset="1" stop-color="#857b76"/></linearGradient></defs>';

  // Yan görünüş: gəzmək, dayanmaq, tullanmaq, gərnəşmək
  var SIDE =
    '<g class="d ds"><g class="all">' +
    leg(38, "la lr", "#e6e0da") + leg(76, "lb lf", "#e6e0da") +
    '<path class="tl" d="M28,50 C12,47 6,32 10,16" stroke="url(#ptTail)" stroke-width="11" stroke-linecap="round" fill="none"/>' +
    '<g class="bd">' +
    '<ellipse cx="55" cy="54" rx="33" ry="19" fill="url(#ptFur)" stroke="#d8d1cb" stroke-width=".6"/>' +
    '<ellipse cx="50" cy="43" rx="24" ry="7" fill="#b3a8a2" opacity=".35"/>' +
    leg(66, "la lf", "#f8f5f2") +
    '<ellipse cx="80" cy="52" rx="13" ry="16" fill="url(#ptFur)"/>' +
    head(90, 30) +
    "</g>" +
    leg(28, "lb lr", "#f8f5f2") +
    "</g></g>";

  // Oturmaq (öndən, şəkildəki kimi), yalanmaq
  var SITF =
    '<g class="d df">' +
    '<path class="tl2" d="M74,83 C96,88 105,77 100,62" stroke="url(#ptTail)" stroke-width="10" stroke-linecap="round" fill="none"/>' +
    '<path d="M60,40 C40,40 33,62 36,79 C38,89 82,89 84,79 C87,62 80,40 60,40Z" fill="url(#ptFur)" stroke="#d8d1cb" stroke-width=".6"/>' +
    '<ellipse cx="40" cy="77" rx="11" ry="10" fill="url(#ptFur)"/><ellipse cx="80" cy="77" rx="11" ry="10" fill="url(#ptFur)"/>' +
    '<path d="M60,44 C47,46 45,63 52,75 L60,81 L68,75 C75,63 73,46 60,44Z" fill="#fff"/>' +
    '<g class="lg"><rect x="62" y="60" width="8" height="25" rx="4" fill="#fbf9f7"/><ellipse cx="66" cy="85.5" rx="6" ry="3.2" fill="#fbf9f7"/></g>' +
    head(60, 28) +
    '<g class="lg lp"><rect x="50" y="60" width="8" height="25" rx="4" fill="#fbf9f7"/><ellipse cx="54" cy="85.5" rx="6" ry="3.2" fill="#fbf9f7" stroke="#e6dfd9" stroke-width=".4"/></g>' +
    "</g>";

  // Uzanmaq, yatmaq
  var LIE =
    '<g class="d dl">' +
    '<path d="M26,76 C10,80 2,70 6,58" stroke="url(#ptTail)" stroke-width="9" stroke-linecap="round" fill="none"/>' +
    '<g class="bdy">' +
    '<ellipse cx="56" cy="71" rx="36" ry="15.5" fill="url(#ptFur)" stroke="#d8d1cb" stroke-width=".6"/>' +
    '<ellipse cx="50" cy="62" rx="26" ry="6" fill="#b3a8a2" opacity=".3"/>' +
    "</g>" +
    '<ellipse cx="80" cy="84" rx="8" ry="3.8" fill="#fbf9f7" stroke="#e6dfd9" stroke-width=".4"/><ellipse cx="68" cy="85" rx="7.5" ry="3.6" fill="#f3efeb"/>' +
    head(86, 58) +
    "</g>";

  var CSS =
    ".ptcat{position:fixed;left:0;top:0;width:" + W + "px;height:" + H + "px;z-index:9000;pointer-events:none;transform-origin:50% 100%;will-change:transform;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))}" +
    ".ptcat .fl{width:100%;height:100%;transition:transform .15s}" +
    ".ptcat.left .fl{transform:scaleX(-1)}" +
    ".ptcat svg{width:100%;height:100%;overflow:visible;display:block}" +
    ".ptcat .d,.ptcat .ec,.ptcat .tg{display:none}" +
    ".ptcat.walk .ds,.ptcat.run .ds,.ptcat.stand .ds,.ptcat.stretch .ds,.ptcat.air .ds,.ptcat.crouch .ds,.ptcat.sit .df,.ptcat.lick .df,.ptcat.lie .dl,.ptcat.sleep .dl{display:inline}" +
    ".ptcat .lg,.ptcat .hd,.ptcat .ey,.ptcat .tl,.ptcat .tl2,.ptcat .bdy{transform-box:fill-box}" +
    ".ptcat .lg{transform-origin:50% 0;transition:transform .35s}" +
    ".ptcat .ey{transform-origin:50% 50%;transition:transform .08s}" +
    ".ptcat .pp{transition:transform .2s}" +
    ".ptcat.blink .ey{transform:scaleY(.12)}" +
    ".ptcat.walk .la{animation:ptl .5s ease-in-out infinite alternate}" +
    ".ptcat.walk .lb{animation:ptl .5s ease-in-out infinite alternate-reverse}" +
    ".ptcat.run .la{animation:ptl .26s ease-in-out infinite alternate}" +
    ".ptcat.run .lb{animation:ptl .26s ease-in-out infinite alternate-reverse}" +
    "@keyframes ptl{from{transform:rotate(24deg)}to{transform:rotate(-24deg)}}" +
    ".ptcat .bd{transform-box:view-box;transform-origin:32px 60px;transition:transform .5s}" +
    ".ptcat.walk .bd{animation:ptb .25s ease-in-out infinite alternate}" +
    ".ptcat.run .bd{animation:ptb .13s ease-in-out infinite alternate}" +
    "@keyframes ptb{to{transform:translateY(-1.5px)}}" +
    ".ptcat .tl{transform-origin:100% 100%}" +
    ".ptcat.stand .tl,.ptcat.walk .tl{animation:ptt 1.6s ease-in-out infinite alternate}" +
    "@keyframes ptt{from{transform:rotate(-6deg)}to{transform:rotate(10deg)}}" +
    ".ptcat .tl2{transform-origin:0 100%}" +
    ".ptcat.sit .tl2{animation:ptw 1.1s ease-in-out infinite alternate}" +
    "@keyframes ptw{from{transform:rotate(-6deg)}to{transform:rotate(10deg)}}" +
    ".ptcat .hd{transform-origin:50% 60%;transition:transform .4s}" +
    ".ptcat.lick .lp{animation:ptup .35s forwards,ptlk .45s .35s ease-in-out infinite alternate}" +
    "@keyframes ptup{to{transform:rotate(152deg)}}" +
    "@keyframes ptlk{from{transform:rotate(152deg)}to{transform:rotate(166deg)}}" +
    ".ptcat.lick .df .hd{transform:rotate(-7deg) translateY(1px)}" +
    ".ptcat.lick .tg{display:inline}" +
    ".ptcat.stretch .bd{transform:rotate(20deg)}" +
    ".ptcat.stretch .lf{transform:rotate(-62deg)}" +
    ".ptcat.stretch .ds .hd{transform:rotate(-20deg)}" +
    ".ptcat.stretch .tl{transform:rotate(14deg)}" +
    ".ptcat.air .lf{transform:rotate(-48deg)}" +
    ".ptcat.air .lr{transform:rotate(48deg)}" +
    ".ptcat .all{transform-box:view-box;transform-origin:60px 88px;transition:transform .18s}" +
    ".ptcat.crouch .all{transform:scaleY(.86)}" +
    ".ptcat.sleep .ey{display:none}.ptcat.sleep .ec{display:inline}" +
    ".ptcat.sleep .dl .hd{transform:translate(-2px,5px) rotate(-12deg)}" +
    ".ptcat .bdy{transform-origin:50% 100%}" +
    ".ptcat.sleep .bdy{animation:ptbr 2.6s ease-in-out infinite}" +
    "@keyframes ptbr{50%{transform:scaleY(1.05)}}" +
    ".ptcat .zz{position:absolute;right:-4%;top:-30%;width:40%;height:60%;display:none;font:700 " + (mobile ? 11 : 14) + "px/1 system-ui,sans-serif;color:#9fb8ff}" +
    ".ptcat.left .zz{right:auto;left:-4%}" +
    ".ptcat.sleep .zz{display:block}" +
    ".ptcat .zz i{position:absolute;left:10%;bottom:0;font-style:normal;opacity:0;animation:ptz 3s linear infinite}" +
    ".ptcat .zz i:nth-child(2){animation-delay:1s}.ptcat .zz i:nth-child(3){animation-delay:2s}" +
    "@keyframes ptz{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translate(14px,-26px) scale(1.25)}}";

  /* ---------------- Vəziyyət ---------------- */
  var el, fl, pps = [];
  var st = {
    surf: null,      // null = döşəmə (ekranın altı), yoxsa element
    x: -W,           // səthin solundan məsafə (döşəmədə ekran x)
    face: 1,         // 1 = sağa, -1 = sola
    pose: "walk",
    air: null,       // {x,y} tullanma zamanı
    per: null,       // {el,s} menyu ətrafında fırlanma
    ang: 0, angT: 0
  };
  var job = 0, pending = null, falling = false;
  var mouse = { x: -1, y: -1, t: 0 };
  var chaseCool = 0;

  function now() { return performance.now(); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function frame() { return new Promise(function (r) { requestAnimationFrame(r); }); }
  function wait(ms, j) {
    return new Promise(function (res) {
      var t0 = now();
      (function f() { if (j !== job) return res(false); if (now() - t0 >= ms) return res(true); requestAnimationFrame(f); })();
    });
  }
  function tween(ms, fn, j) {
    return new Promise(function (res) {
      var t0 = now();
      (function f() {
        if (j !== job) return res(false);
        var t = Math.min(1, (now() - t0) / ms);
        if (fn(t) === false) return res(false);
        if (t >= 1) return res(true);
        requestAnimationFrame(f);
      })();
    });
  }
  function setPose(p) {
    st.pose = p;
    var c = "ptcat " + p + (st.face < 0 ? " left" : "");
    if (el.classList.contains("blink") && p !== "sleep") c += " blink";
    el.className = c;
  }
  function setFace(f) { st.face = f; setPose(st.pose); }

  /* ---------------- Səthlər ---------------- */
  function vis(e) {
    if (!e || !e.isConnected) return false;
    if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    var r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }
  function topY(r) { return Math.max(r.top, H * 0.92); }   // ekranın lap yuxarısındakı menyuda başı kəsilməsin
  function floorY() { return innerHeight - FLOOR_PAD; }
  function feet() {
    if (st.air) return { x: st.air.x, y: st.air.y };
    if (st.per) return perPoint(st.per.el.getBoundingClientRect(), st.per.s);
    if (st.surf) { var r = st.surf.getBoundingClientRect(); return { x: r.left + st.x, y: topY(r) }; }
    return { x: st.x, y: floorY() };
  }
  function width() { return st.surf ? st.surf.getBoundingClientRect().width : innerWidth; }
  function targets(except) {
    var out = [];
    document.querySelectorAll(SEL).forEach(function (e) {
      if (e === except || !vis(e)) return;
      var r = e.getBoundingClientRect();
      if (r.width < 36 || r.top > innerHeight - H * 1.2) return;
      if (r.left < 0 || r.right > innerWidth) return;
      out.push(e);
    });
    return out;
  }
  function canCircle(e) {
    var r = e.getBoundingClientRect();
    return r.width >= 60 && r.height >= 22 && r.top >= H * 0.95 && r.bottom < innerHeight - 8 && r.left > 4 && r.right < innerWidth - 4;
  }
  function perPoint(r, s) {
    var w = r.width, h = r.height, P = 2 * (w + h);
    s = ((s % P) + P) % P;
    if (s < w) { st.angT = 0; return { x: r.left + s, y: r.top }; }
    if (s < w + h) { st.angT = 90; return { x: r.right, y: r.top + (s - w) }; }
    if (s < 2 * w + h) { st.angT = 180; return { x: r.right - (s - w - h), y: r.bottom }; }
    st.angT = 270; return { x: r.left, y: r.bottom - (s - 2 * w - h) };
  }

  /* ---------------- Göstərmə ---------------- */
  function render() {
    var p = feet();
    if (!st.per) st.angT = 0;
    var d = ((st.angT - st.ang + 540) % 360) - 180;
    st.ang += d * 0.25;
    if (Math.abs(d) < 0.5) st.ang = st.angT;
    el.style.transform = "translate(" + (p.x - W / 2).toFixed(1) + "px," + (p.y - H).toFixed(1) + "px) rotate(" + st.ang.toFixed(1) + "deg)";

    // menyu bağlandı / sürüşdü — aşağı tullan
    if (!falling && !st.air) {
      var s = st.per ? st.per.el : st.surf;
      if (s && !vis(s)) { falling = true; interrupt(fallDown); }
    }
    // gözlər kursora baxır
    var dx = 0, dy = 0;
    if (mouse.t && now() - mouse.t < 4000) {
      var vx = mouse.x - p.x, vy = mouse.y - (p.y - H * 0.6), L = Math.hypot(vx, vy) || 1;
      dx = (vx / L) * 1.6 * st.face; dy = (vy / L) * 1.4;
    }
    var tr = "translate(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px)";
    for (var i = 0; i < pps.length; i++) pps[i].style.transform = tr;
    requestAnimationFrame(render);
  }

  /* ---------------- Hərəkətlər ---------------- */
  function interrupt(fn) { pending = fn; job++; }

  async function walkTo(tx, j, fast) {
    var wv = width(), m = W * 0.3;
    if (st.surf) tx = Math.max(m, Math.min(wv - m, tx));
    else tx = Math.max(W / 2, Math.min(innerWidth - W / 2, tx));
    var x0 = st.x, dist = tx - x0;
    if (Math.abs(dist) < 4) return true;
    setFace(dist > 0 ? 1 : -1);
    setPose(fast ? "run" : "walk");
    return tween(Math.abs(dist) / (fast ? RUN : SPEED) * 1000, function (t) { st.x = x0 + dist * t; }, j);
  }

  async function jumpTo(target, lx, j) {
    var a = feet();
    var tp = function () {
      if (!target) return { x: lx, y: floorY() };
      var r = target.getBoundingClientRect();
      return { x: r.left + lx, y: topY(r) };
    };
    var b = tp();
    setFace(b.x >= a.x ? 1 : -1);
    setPose("crouch");
    if (!(await wait(230, j))) return false;
    var dist = Math.hypot(b.x - a.x, b.y - a.y);
    var hgt = Math.max(36, Math.abs(b.y - a.y) * 0.35 + 30);
    st.per = null;
    st.air = { x: a.x, y: a.y };
    setPose("air");
    var ok = await tween(Math.max(420, Math.min(1100, 340 + dist * 0.85)), function (t) {
      var bb = tp();
      st.air.x = a.x + (bb.x - a.x) * t;
      st.air.y = a.y + (bb.y - a.y) * t - hgt * 4 * t * (1 - t);
    }, j);
    st.air = null;
    if (target && vis(target)) { st.surf = target; st.x = lx; }
    else { st.surf = null; st.x = Math.max(W / 2, Math.min(innerWidth - W / 2, b.x)); }
    setPose("crouch");
    if (ok) await wait(160, j);
    setPose("stand");
    return ok;
  }

  async function fallDown(j) {
    var p = feet();
    st.per = null;
    st.surf = null;
    st.air = { x: p.x, y: p.y };
    setPose("air");
    var y0 = Math.min(p.y, floorY()), x0 = Math.max(W / 2, Math.min(innerWidth - W / 2, p.x));
    var dy = floorY() - y0;
    await tween(Math.max(300, Math.min(800, 250 + dy * 0.6)), function (t) {
      st.air.x = p.x + (x0 - p.x) * t;
      st.air.y = y0 + (floorY() - y0) * t * t - 18 * 4 * t * (1 - t);
    }, j);
    st.air = null; st.x = x0;
    setPose("crouch");
    await wait(180, j);
    setPose("stand");
    falling = false;
  }

  async function circle(e, j) {
    // əvvəl menyunun üstünə çıx
    if (st.surf !== e) {
      var r0 = e.getBoundingClientRect();
      if (!(await jumpTo(e, rnd(W * 0.3, Math.max(W * 0.3, r0.width - W * 0.3)), j))) return;
    }
    var s0 = st.x, r = e.getBoundingClientRect(), P = 2 * (r.width + r.height);
    setFace(1);
    st.per = { el: e, s: s0 };
    setPose("walk");
    var laps = P < 500 ? 2 : 1;
    await tween(P * laps / (SPEED * 1.25) * 1000, function (t) {
      if (!vis(e)) return false;
      st.per.s = s0 + P * laps * t;
    }, j);
    if (st.per) { st.per = null; st.surf = e; st.x = s0; }
    setPose("stand");
  }

  async function sitFor(ms, j) { setPose("sit"); return wait(ms, j); }

  async function lick(j) {
    setPose("sit"); if (!(await wait(500, j))) return;
    setPose("lick"); if (!(await wait(rnd(2400, 4200), j))) return;
    setPose("sit"); await wait(rnd(800, 1600), j);
  }

  async function nap(j) {
    setPose("lie");
    if (!(await wait(rnd(2500, 5000), j))) return;
    if (Math.random() < 0.65) {
      setPose("sleep");
      if (!(await wait(rnd(8000, 16000), j))) return;
      setPose("lie"); if (!(await wait(700, j))) return;
      await stretch(j);
    } else {
      setPose("sit"); await wait(1200, j);
    }
  }

  async function stretch(j) {
    setPose("stand"); if (!(await wait(250, j))) return;
    setPose("stretch"); if (!(await wait(rnd(1300, 1900), j))) return;
    setPose("stand"); await wait(400, j);
  }

  async function chase(j) {
    var end = now() + rnd(2500, 4000);
    while (now() < end && j === job) {
      var tx = mouse.x;
      if (Math.abs(tx - st.x) < 10) { setPose("sit"); if (!(await wait(250, j))) return; continue; }
      var dir = tx > st.x ? 1 : -1;
      setFace(dir); setPose("run");
      await frame();
      st.x += dir * RUN / 60;
      st.x = Math.max(W / 2, Math.min(innerWidth - W / 2, st.x));
    }
    setPose("sit");
    await wait(rnd(1200, 2400), j);
    chaseCool = now() + 9000;
  }

  // toxunanda / kliklədikdə
  async function react(j) {
    if (st.pose === "sleep" || st.pose === "lie") {
      setPose("lie"); if (!(await wait(300, j))) return;
      await stretch(j);
      await sitFor(1500, j);
      return;
    }
    var p = feet(), surf = st.surf, lx = st.x;
    if (st.per) { st.per = null; }
    st.air = { x: p.x, y: p.y };
    setPose("air");
    await tween(420, function (t) { st.air.y = p.y - 30 * 4 * t * (1 - t); }, j);
    st.air = null;
    if (surf && vis(surf)) { st.surf = surf; st.x = lx; } else { st.surf = null; st.x = p.x; }
    await sitFor(1600, j);
  }

  async function choose(j) {
    // kursor yaxınlıqdadırsa arxasınca qaç
    if (fine && !st.surf && mouse.t && now() - mouse.t < 1500 && now() > chaseCool &&
        mouse.y > innerHeight * 0.45 && Math.abs(mouse.x - st.x) < 320 && Math.random() < 0.55) {
      return chase(j);
    }
    var r = Math.random();
    if (!st.surf) {
      var T = targets();
      if (r < 0.28) return walkTo(rnd(W, innerWidth - W), j);
      if (r < 0.52 && T.length) {
        var t = pick(T), rr = t.getBoundingClientRect();
        if (!(await walkTo(rr.left + rr.width / 2 + rnd(-80, 80), j))) return;
        return jumpTo(t, rr.width < W * 0.6 ? rr.width / 2 : rnd(W * 0.3, rr.width - W * 0.3), j);
      }
      if (r < 0.62) {
        var C = T.filter(canCircle);
        if (C.length) return circle(pick(C), j);
      }
      if (r < 0.75) return sitFor(rnd(2500, 5000), j);
      if (r < 0.83) return lick(j);
      if (r < 0.93) return nap(j);
      return stretch(j);
    }
    // menyu üstündə
    var cur = st.surf, cw = cur.getBoundingClientRect().width;
    if (r < 0.22 && cw > W * 1.2) return walkTo(rnd(W * 0.3, cw - W * 0.3), j);
    if (r < 0.40) {
      var cr = cur.getBoundingClientRect();
      var N = targets(cur).filter(function (e) {
        var q = e.getBoundingClientRect();
        return Math.hypot(q.left - cr.left, q.top - cr.top) < 520;
      });
      if (N.length) { var n = pick(N), nr = n.getBoundingClientRect(); return jumpTo(n, nr.width < W * 0.6 ? nr.width / 2 : rnd(W * 0.3, nr.width - W * 0.3), j); }
    }
    if (r < 0.52 && canCircle(cur)) return circle(cur, j);
    if (r < 0.66) return sitFor(rnd(2500, 5500), j);
    if (r < 0.74) return lick(j);
    if (r < 0.84) return nap(j);
    if (r < 0.90) return stretch(j);
    var p = feet();
    return jumpTo(null, Math.max(W / 2, Math.min(innerWidth - W / 2, p.x + rnd(-120, 120))), j);
  }

  async function loop() {
    // ekranın solundan gəzərək gəlir
    await walkTo(rnd(innerWidth * 0.25, innerWidth * 0.6), job);
    for (;;) {
      var j = job;
      try {
        if (pending) { var f = pending; pending = null; await f(j); }
        else await choose(j);
      } catch (e) { st.air = null; st.per = null; falling = false; }
      await frame();
    }
  }

  function blink() {
    if (st.pose !== "sleep") {
      el.classList.add("blink");
      setTimeout(function () { el.classList.remove("blink"); }, 140);
    }
    setTimeout(blink, rnd(2500, 6000));
  }

  function start() {
    var s = document.createElement("style");
    s.textContent = CSS;
    document.head.appendChild(s);
    el = document.createElement("div");
    el.className = "ptcat walk";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<div class="fl"><svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">' + DEFS + SIDE + SITF + LIE + "</svg></div>" +
      '<div class="zz"><i>z</i><i>z</i><i>Z</i></div>';
    document.body.appendChild(el);
    fl = el.firstChild;
    pps = Array.prototype.slice.call(el.querySelectorAll(".pp"));
    st.x = -W;

    addEventListener("mousemove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = now(); }, { passive: true });
    addEventListener("pointerdown", function (e) {
      var r = el.getBoundingClientRect(), m = 8;
      if (e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m) interrupt(react);
    }, { passive: true, capture: true });
    addEventListener("resize", function () { if (!st.surf && !st.air) st.x = Math.max(W / 2, Math.min(innerWidth - W / 2, st.x)); });

    requestAnimationFrame(render);
    setTimeout(blink, 3000);
    loop();
  }

  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
