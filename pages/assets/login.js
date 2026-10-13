// ProTechtor™ — /account/login səhifəsində yerində giriş (Firebase Auth, e-poçt + parol).
// Giriş saytda qalır: heç bir yönləndirmə yoxdur. Mətnlər: /texts/login.json → "form"
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
  var auth = null, busy = false, bound = false;
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
      auth.onAuthStateChanged(show);
    } catch (e) { auth = null; }
    return !!auth;
  }
  function msg(k, cls) {
    var el = $("lMsg");
    if (!el) return;
    el.className = "rmsg" + (cls ? " " + cls : "");
    var v = k ? tx(k) : "";
    el.innerHTML = window.PT ? PT.fmt(v) : v;
  }
  function mark(id, bad) { var el = $(id); if (el) el.classList.toggle("bad", !!bad); }
  function mailOk(m) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m); }
  function show(u) {
    var f = $("lg"), i = $("lIn");
    if (!f || !i) return;
    f.hidden = !!u; i.hidden = !u;
    if (u) $("lWho").textContent = u.email || "";
  }
  function errKey(e) {
    var c = (e && e.code) || "";
    if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return "errBad";
    if (/too-many-requests/.test(c)) return "errMany";
    return "errGen";
  }
  function submit(e) {
    e.preventDefault();
    if (busy) return;
    var email = $("lEmail").value.trim(), pass = $("lPass").value;
    mark("lEmail", !mailOk(email)); mark("lPass", !pass);
    if (!mailOk(email)) return msg("errEmail", "err");
    if (!pass) return msg("errPass", "err");
    if (!initFb()) return msg("errGen", "err");
    busy = true; $("lBtn").disabled = true; msg("busy");
    auth.signInWithEmailAndPassword(email, pass).then(function () {
      msg("");
    }).catch(function (er) { msg(errKey(er), "err"); }).then(function () { busy = false; $("lBtn").disabled = false; });
  }
  function forgot(e) {
    e.preventDefault();
    var email = $("lEmail").value.trim();
    if (!mailOk(email)) { mark("lEmail", true); return msg("resetNeed", "err"); }
    if (!initFb()) return msg("errGen", "err");
    try { auth.languageCode = lang(); } catch (x) {}
    auth.sendPasswordResetEmail(email).then(function () { msg("resetOk", "ok"); }).catch(function (er) { msg(errKey(er) === "errMany" ? "errMany" : "resetOk", errKey(er) === "errMany" ? "err" : "ok"); });
  }
  function bind() {
    if (bound || !$("lg")) return;
    bound = true;
    $("lg").addEventListener("submit", submit);
    $("lForgot").addEventListener("click", forgot);
    $("lOut").addEventListener("click", function () { if (initFb()) auth.signOut(); });
    initFb();
  }
  document.addEventListener("pt:rendered", bind);
  document.addEventListener("DOMContentLoaded", function () { setTimeout(bind, 0); });
})();
