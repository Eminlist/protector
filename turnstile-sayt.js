// ProTechtor — Turnstile (sayt tərəfi)
// 1) index.html <head>-ə əlavə et:
//    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
// 2) Qeydiyyat, giriş və şifrə bərpası formalarının hər birinə (düymədən əvvəl) boş blok qoy:
//    <div id="ts-register"></div>   <div id="ts-login"></div>   <div id="ts-reset"></div>

const API = "https://protector-api.<SƏNİN-SUBDOMENİN>.workers.dev"; // mövcud API ünvanın
const TS_SITEKEY = "0x4AAAAAAFSWDremRZy4kQth"; // Cloudflare → Turnstile → Site Key (açıq, saytda ola bilər)

const tsIds = {};
function tsRender(boxId) {
  const el = document.getElementById(boxId);
  if (!el || !window.turnstile) return setTimeout(() => tsRender(boxId), 300);
  if (tsIds[boxId] !== undefined) return;
  tsIds[boxId] = turnstile.render(el, { sitekey: TS_SITEKEY, theme: "auto", language: "az" });
}
function tsToken(boxId) {
  const t = tsIds[boxId] !== undefined ? turnstile.getResponse(tsIds[boxId]) : "";
  if (!t) throw new Error("Zəhmət olmasa robot olmadığınızı təsdiqləyin");
  return t;
}
function tsReset(boxId) { if (tsIds[boxId] !== undefined) turnstile.reset(tsIds[boxId]); } // token birdəfəlikdir

// Firebase girişindən/qeydiyyatından SONRA çağır (token həmin formadan)
async function markHuman(token) {
  const id = await firebase.auth().currentUser.getIdToken();
  const r = await fetch(API + "/human", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + id },
    body: JSON.stringify({ t: token }),
  });
  if (!r.ok) throw new Error("Robot yoxlaması alınmadı, yenidən cəhd edin");
}

// ---- Qeydiyyat ----
async function doRegister(email, pass) {
  const t = tsToken("ts-register");
  try {
    const cred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
    await markHuman(t);
    await cred.user.sendEmailVerification(); // mövcud axın necədirsə, elə saxla
  } finally { tsReset("ts-register"); }
}

// ---- Giriş ----
async function doLogin(email, pass) {
  const t = tsToken("ts-login");
  try {
    await firebase.auth().signInWithEmailAndPassword(email, pass);
    await markHuman(t);
  } finally { tsReset("ts-login"); }
}

// ---- Şifrə bərpası (artıq birbaşa Firebase yox, Worker üzərindən) ----
async function doReset(email) {
  const t = tsToken("ts-reset");
  try {
    const r = await fetch(API + "/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, t }),
    });
    if (!r.ok) throw new Error("Robot yoxlaması alınmadı");
    // Həmişə eyni mesaj göstər: "E-poçt qeydiyyatdadırsa, link göndərildi"
  } finally { tsReset("ts-reset"); }
}

// ---- Artıq daxil olmuş köhnə istifadəçilər ----
// /model 403 {error:"human-required"} qaytararsa: bir dəfəlik pəncərə aç, içində tsRender("ts-gate"),
// təsdiqdən sonra markHuman(tsToken("ts-gate")) və sorğunu təkrarla.

// Formalar açılanda: tsRender("ts-register"); tsRender("ts-login"); tsRender("ts-reset");
