// ProTechtor™ — dil seçimi: menyu düyməsi kimi kiçik düymə, aşağı sürüşüb açılan siyahı.
// Telefonda ekranı tutan sistem siyahısı açılmır. Seçiləndə siyahı bağlanır.
// Gizli <select> saxlanılır: seçim onun "change" hadisəsi ilə əvvəlki kimi işləyir.
(function () {
  "use strict";
  var CSS =
    ".ldd{position:relative;display:inline-block}" +
    ".ldd select{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;left:0;top:0}" +
    ".ldd-b{height:38px;min-width:46px;padding:0 9px;display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text);font:inherit;font-size:14px;font-weight:700;letter-spacing:.04em;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:border-color .25s,color .25s,box-shadow .25s}" +
    ".ldd-b:hover,.ldd.open .ldd-b{border-color:var(--ldd-acc,#2ecc71);color:var(--ldd-acc,#2ecc71)}" +
    ".ldd-b i{display:block;width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-2px) rotate(45deg);transition:transform .35s cubic-bezier(.2,.9,.25,1.2)}" +
    ".ldd.open .ldd-b i{transform:translateY(2px) rotate(-135deg)}" +
    ".ldd-p{position:absolute;top:calc(100% + 8px);right:0;z-index:80;min-width:150px;visibility:hidden;clip-path:inset(0 -30px 100% -30px);transition:clip-path .45s cubic-bezier(.4,0,.2,1),visibility 0s linear .45s}" +
    ".ldd.open .ldd-p{visibility:visible;clip-path:inset(-12px -30px -40px -30px);transition:clip-path .45s cubic-bezier(.4,0,.2,1),visibility 0s}" +
    ".ldd-l{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px;box-shadow:0 20px 40px -16px rgba(0,0,0,.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}" +
    ".ldd-l button{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border:0;border-radius:10px;background:none;color:var(--text);font:inherit;font-size:14px;text-align:left;cursor:pointer}" +
    ".ldd-l button b{min-width:24px;font-weight:800;letter-spacing:.04em;color:var(--muted)}" +
    ".ldd-l button:hover{background:rgba(127,127,127,.12)}" +
    ".ldd-l button.on,.ldd-l button.on b{color:var(--ldd-acc,#2ecc71)}" +
    "@media (prefers-reduced-motion:reduce){.ldd-p,.ldd-b i{transition:none}}";
  var NAMES = { az: "Azərbaycanca", ru: "Русский", tr: "Türkçe", en: "English" };

  function enhance(sel) {
    if (!sel || sel.__ldd) return;
    sel.__ldd = 1;
    var box = document.createElement("div");
    box.className = "ldd";
    sel.parentNode.insertBefore(box, sel);
    box.appendChild(sel);
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");
    var b = document.createElement("button");
    b.type = "button"; b.className = "ldd-b";
    b.setAttribute("aria-haspopup", "listbox"); b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-label", sel.getAttribute("aria-label") || "Language");
    b.innerHTML = '<span></span><i aria-hidden="true"></i>';
    var p = document.createElement("div");
    p.className = "ldd-p";
    var l = document.createElement("div");
    l.className = "ldd-l"; l.setAttribute("role", "listbox");
    Array.prototype.forEach.call(sel.options, function (o) {
      var it = document.createElement("button");
      it.type = "button"; it.setAttribute("role", "option"); it.setAttribute("data-v", o.value);
      it.innerHTML = "<b>" + o.text + "</b><span>" + (NAMES[o.value] || o.text) + "</span>";
      it.addEventListener("click", function (e) {
        e.stopPropagation();
        close();
        if (sel.value !== o.value) {
          sel.value = o.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
        sync();
      });
      l.appendChild(it);
    });
    p.appendChild(l);
    box.appendChild(b); box.appendChild(p);

    function sync() {
      var o = sel.options[sel.selectedIndex];
      b.firstChild.textContent = o ? o.text : "";
      Array.prototype.forEach.call(l.children, function (it) {
        var on = it.getAttribute("data-v") === sel.value;
        it.classList.toggle("on", on); it.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
    function open() { box.classList.add("open"); b.setAttribute("aria-expanded", "true"); }
    function close() { box.classList.remove("open"); b.setAttribute("aria-expanded", "false"); }
    b.addEventListener("click", function (e) { e.stopPropagation(); box.classList.contains("open") ? close() : open(); });
    document.addEventListener("click", function (e) { if (!box.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    window.addEventListener("scroll", close, { passive: true });
    sel.addEventListener("change", sync);
    // dil kodla dəyişəndə (səhifə yüklənəndə) düymə yazısı da yenilənsin
    new MutationObserver(sync).observe(sel, { attributes: true, childList: true, subtree: true });
    setInterval(function () { if (b.firstChild.textContent !== (sel.options[sel.selectedIndex] || {}).text) sync(); }, 700);
    sync();
  }

  function run() {
    if (!document.getElementById("ptui-css")) {
      var st = document.createElement("style");
      st.id = "ptui-css"; st.textContent = CSS;
      document.head.appendChild(st);
    }
    var s = document.querySelectorAll("select#lang, select#langSel");
    Array.prototype.forEach.call(s, enhance);
  }
  window.ptLangDropdown = run;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
