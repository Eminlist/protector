// ProTechtor™ — /account/register səhifəsində yerində qeydiyyat.
// Proqramdakı qeydiyyatla eyni: Firebase Auth + Firestore «users» sənədi + Turnstile + təsdiq məktubu.
// Mətnlər: /texts/register.json → "form"
(function () {
  "use strict";
  var CFG = {
    apiKey: "AIzaSyB-kuPK97aaUbXNf1vJqUf7aFAKEJVvY8o",
    authDomain: "protechtor-99407.firebaseapp.com",
    projectId: "protechtor-99407",
    storageBucket: "protechtor-99407.firebasestorage.app",
    messagingSenderId: "703242369784",
    appId: "1:703242369784:web:03bc54204f753af9cb990d"
  };
  var APPCHECK_KEY = "6Le-_-EtAAAAABzopqfpR0pI3_tNPLd4tHD0qChF";
  var TS_SITEKEY = "0x4AAAAAAFSWDremRZy4kQth";
  var API_BASE = "https://protector-api.o553115544.workers.dev";
  var PREFIXES = ["10", "50", "51", "55", "60", "70", "77", "99", "12"];

  var auth = null, db = null, tsId, busy = false;
  function $(id) { return document.getElementById(id); }
  function tx(k) { return (window.PT && PT.t("form." + k)) || ""; }
  function lang() { return (window.PT && PT.lang()) || "az"; }

  function initFb() {
    if (auth || !window.firebase) return !!auth;
    try {
      if (!firebase.apps.length) firebase.initializeApp(CFG);
      try {
        if (firebase.appCheck) {
          try { firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(APPCHECK_KEY), true); }
          catch (e1) { try { firebase.appCheck().activate(new firebase.appCheck.ReCaptchaV3Provider(APPCHECK_KEY), true); } catch (e2) {} }
        }
      } catch (e) {}
      auth = firebase.auth();
      db = firebase.firestore();
    } catch (e) { auth = null; }
    return !!auth;
  }

  function renderTs() {
    var el = $("rTs");
    if (!el) return;
    if (!window.turnstile) { setTimeout(renderTs, 300); return; }
    if (tsId !== undefined) { try { turnstile.remove(tsId); } catch (e) {} tsId = undefined; }
    el.innerHTML = "";
    try { tsId = turnstile.render(el, { sitekey: TS_SITEKEY, theme: "dark", language: lang() }); } catch (e) {}
  }
  function tsTok() { try { return tsId !== undefined ? (turnstile.getResponse(tsId) || "") : ""; } catch (e) { return ""; } }
  function tsReset() { try { if (tsId !== undefined) turnstile.reset(tsId); } catch (e) {} }

  function digits(v) {
    var d = String(v || "").replace(/\D/g, "");
    if (d.indexOf("994") === 0) d = d.slice(3);
    return d.slice(0, 9);
  }
  function mask(d) {
    var p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
    return p.join(" ");
  }
  function fakePhone(d) {
    if (/^(\d)\1{8}$/.test(d)) return true;
    if ("01234567890123456789".indexOf(d) >= 0 || "98765432109876543210".indexOf(d) >= 0) return true;
    return ["123456780", "123454321"].indexOf(d) >= 0;
  }
  function phoneOk(d) { return d.length === 9 && PREFIXES.indexOf(d.slice(0, 2)) >= 0 && !fakePhone(d); }
  function nameOk(n) { return n.replace(/[^\p{L}]/gu, "").length >= 3; }
  function passOk(p) { return p.length >= 8 && /\d/.test(p) && /[A-Z]/.test(p) && /[a-z]/.test(p); }
  function mailOk(m) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m); }

  function msg(k, cls) {
    var el = $("rMsg");
    if (!el) return;
    el.className = "rmsg" + (cls ? " " + cls : "");
    var v = k ? tx(k) : "";
    el.innerHTML = window.PT ? PT.fmt(v) : v;
  }
  function mark(id, bad) { var el = $(id); if (el) el.classList.toggle("bad", !!bad); }

  function markHuman(tok) {
    var u = auth.currentUser;
    if (!u) return Promise.resolve();
    return u.getIdToken().then(function (t) {
      return fetch(API_BASE + "/human", {
        method: "POST",
        headers: { "Authorization": "Bearer " + t, "Content-Type": "application/json" },
        body: JSON.stringify({ t: tok })
      });
    }).catch(function () {});
  }
  function sendVerify(u) {
    try { auth.languageCode = lang(); } catch (e) {}
    var s = { handleCodeInApp: false, url: location.origin + "/account/login" };
    return u.sendEmailVerification(s).catch(function () { return u.sendEmailVerification(); }).catch(function () {});
  }

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    var name = $("rName").value.trim().replace(/\s+/g, " ");
    var email = $("rEmail").value.trim();
    var pass = $("rPass").value;
    var ph = digits($("rPhone").value);
    var store = $("rStore").value.trim();
    var addr = $("rAddr").value.trim();

    mark("rName", !nameOk(name)); mark("rEmail", !mailOk(email)); mark("rPass", !passOk(pass)); mark("rPhone", !phoneOk(ph));
    if (!nameOk(name)) return msg("errName", "err");
    if (!mailOk(email)) return msg("errEmail", "err");
    if (!passOk(pass)) return msg("errPass", "err");
    if (!phoneOk(ph)) return msg("errPhone", "err");
    var tok = tsTok();
    if (!tok) return msg("errTs", "err");
    if (!initFb()) return msg("errGen", "err");

    busy = true;
    $("rBtn").disabled = true;
    msg("busy");
    auth.createUserWithEmailAndPassword(email, pass).then(function (cred) {
      var u = cred.user;
      return db.collection("users").doc(u.uid).set({
        username: name,
        displayName: name,
        email: email,
        storeName: store,
        storeAddress: addr,
        phoneNumber: "+994" + ph,
        provider: "email",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function () { return markHuman(tok); })
        .then(function () { return sendVerify(u); });
    }).then(function () {
      $("reg").querySelectorAll("label,.rts,#rBtn").forEach(function (x) { x.style.display = "none"; });
      msg("ok", "ok");
    }).catch(function (err) {
      var c = (err && err.code) || "";
      tsReset();
      if (c === "auth/email-already-in-use") { mark("rEmail", true); msg("errExists", "err"); }
      else if (c === "auth/invalid-email") { mark("rEmail", true); msg("errEmail", "err"); }
      else if (c === "auth/weak-password") { mark("rPass", true); msg("errPass", "err"); }
      else msg("errGen", "err");
      try { console.warn("register:", c, err && err.message); } catch (x) {}
    }).then(function () { busy = false; var b = $("rBtn"); if (b) b.disabled = false; });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var f = $("reg");
    if (!f) return;
    f.addEventListener("submit", submit);
    var p = $("rPhone");
    p.addEventListener("input", function () { p.value = mask(digits(p.value)); mark("rPhone", false); });
    ["rName", "rEmail", "rPass"].forEach(function (id) { $(id).addEventListener("input", function () { mark(id, false); }); });
    renderTs();
  });
  // Dil dəyişəndə təhlükəsizlik yoxlaması da həmin dildə yenidən qurulur
  var lastLang = null;
  document.addEventListener("pt:rendered", function (e) {
    var l = e.detail && e.detail.lang;
    if (lastLang && l !== lastLang) renderTs();
    lastLang = l;
    var m = $("rMsg");
    if (m && m.className.indexOf("err") >= 0) m.innerHTML = "";
  });
})();
