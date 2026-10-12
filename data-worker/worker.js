// ProTechtor™ — protector-data Worker (D1: protector-db)
// 1) İstifadəçi bildirişləri (əvvəl Firestore users/{uid}/notifications)
// 2) «Uyğun gəlmədi» hesabatları (əvvəl Firestore misfit_reports)
// 3) Əsas baza (Base.json) «Dərc et» versiyaları — hər dərc ayrıca versiya, geri qaytarıla bilir
// Bütün sorğular Firebase ID token ilə (Authorization: Bearer ...).

const PROJECT = "protechtor-99407";
const ADMIN_EMAIL = "o553115544@gmail.com";
const NOTIF_KEEP_MS = 180 * 86400000;   // bildirişlər 180 gün saxlanılır
const NOTIF_MAX_PER_USER = 200;
const REPORT_KEEP_MS = 365 * 86400000;  // hesabatlar 1 il
const REPORT_DAY_LIMIT = 20;            // istifadəçi gündə ən çox 20 hesabat
const BASE_KEEP = 40;                   // son 40 versiya saxlanılır
const MAX_BODY = 8 * 1024 * 1024;
const LANDING_MODES = ["on", "nogirl", "off"];
const PUSH_URL = "https://protector-push.o553115544.workers.dev";
// Batareya bazası (Battery.json) — yalnız serverdə saxlanılır, axtarış serverdə gedir (antiudar kimi qorunur)
const BAT_KEEP = 10;               // son 10 versiya
const BAT_DAY_LIMIT = 300;         // istifadəçi gündə ən çox 300 batareya axtarışı
const BAT_MIN_LIMIT = 40;          // dəqiqədə ən çox 40 (kütləvi çıxarmanın qarşısı)
const BAT_OLD = ["Sony Ericsson", "Samsung", "Philips", "Motorola", "Siemens", "Nokia"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Max-Age": "86400"
};
const J = (d, s) => new Response(JSON.stringify(d), { status: s || 200, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, CORS) });
const E = (code, s) => J({ error: code }, s || 400);

// ---------- Firebase ID token yoxlaması ----------
let JWKS = null, JWKS_AT = 0;
const b64u = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
async function keys() {
  if (JWKS && Date.now() - JWKS_AT < 3600000) return JWKS;
  const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  JWKS = (await r.json()).keys || [];
  JWKS_AT = Date.now();
  return JWKS;
}
async function verify(tok) {
  try {
    const p = String(tok || "").split(".");
    if (p.length !== 3) return null;
    const h = JSON.parse(new TextDecoder().decode(b64u(p[0])));
    const c = JSON.parse(new TextDecoder().decode(b64u(p[1])));
    const now = Math.floor(Date.now() / 1000);
    if (h.alg !== "RS256" || c.aud !== PROJECT || c.iss !== "https://securetoken.google.com/" + PROJECT || !c.sub || c.exp < now - 30) return null;
    let k = (await keys()).find((x) => x.kid === h.kid);
    if (!k) { JWKS = null; k = (await keys()).find((x) => x.kid === h.kid); }
    if (!k) return null;
    const ck = await crypto.subtle.importKey("jwk", k, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", ck, b64u(p[2]), new TextEncoder().encode(p[0] + "." + p[1]));
    if (!ok) return null;
    const email = String(c.email || "").toLowerCase();
    const anon = !!(c.firebase && c.firebase.sign_in_provider === "anonymous");
    return { uid: c.sub, email, anon, admin: !anon && email === ADMIN_EMAIL };
  } catch (e) { return null; }
}

// ---------- Cədvəllər ----------
let READY = false;
async function init(db) {
  if (READY) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS pt_notif (id TEXT PRIMARY KEY, uid TEXT NOT NULL, ts INTEGER NOT NULL, rd INTEGER DEFAULT 0, data TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS pt_notif_uid ON pt_notif (uid, ts)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pt_report (id TEXT PRIMARY KEY, uid TEXT, ts INTEGER NOT NULL, status TEXT DEFAULT 'pending', data TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS pt_report_ts ON pt_report (ts)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pt_base (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, by TEXT, note TEXT, groups INTEGER, models INTEGER, size INTEGER, data BLOB NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pt_cfg (k TEXT PRIMARY KEY, v TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pt_rate (k TEXT PRIMARY KEY, n INTEGER DEFAULT 0)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pt_bat (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, by TEXT, note TEXT, lines INTEGER, models INTEGER, codes INTEGER, size INTEGER, data BLOB NOT NULL)"),
    // Yeniləmə tarixçəsi: versiya saxlama limitindən asılı olmayan yüngül jurnal (antiudar + batareya)
    db.prepare("CREATE TABLE IF NOT EXISTS pt_hist (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, kind TEXT NOT NULL, a INTEGER DEFAULT 0, r INTEGER DEFAULT 0, e INTEGER DEFAULT 0, g INTEGER DEFAULT 0, n INTEGER DEFAULT 0, c INTEGER DEFAULT 0, note TEXT DEFAULT '', first INTEGER DEFAULT 0)"),
    db.prepare("CREATE INDEX IF NOT EXISTS pt_hist_ts ON pt_hist (ts)"),
    // Gecə saatlarında (Bakı 23:00–10:00) Telegram xəbərləri burada gözləyir, səhər 10:00-da bir yerdə gedir
    db.prepare("CREATE TABLE IF NOT EXISTS pt_tgq (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, text TEXT NOT NULL)")
  ]);
  READY = true;
}
async function cfgGet(db, k) { const r = await db.prepare("SELECT v FROM pt_cfg WHERE k=?").bind(k).first(); return r ? r.v : null; }
async function cfgSet(db, k, v) { await db.prepare("INSERT INTO pt_cfg (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(k, String(v)).run(); }

const rid = () => { const a = new Uint8Array(10); crypto.getRandomValues(a); return Date.now().toString(36) + Array.from(a, (b) => (b % 36).toString(36)).join(""); };
const okId = (s) => typeof s === "string" && /^[\w.:-]{1,80}$/.test(s);
const okUid = (s) => typeof s === "string" && /^[\w-]{1,128}$/.test(s);
function clean(o) {
  const out = {};
  if (!o || typeof o !== "object") return out;
  Object.keys(o).slice(0, 40).forEach((k) => {
    if (k === "id" || !/^[\w]{1,40}$/.test(k)) return;
    const v = o[k];
    if (v == null) return;
    if (typeof v === "string") out[k] = v.slice(0, 2000);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "object") { const s = JSON.stringify(v); if (s.length <= 4000) out[k] = v; }
  });
  return out;
}
async function body(req) {
  const len = +(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) throw new Error("too-big");
  try { return await req.json(); } catch (e) { return {}; }
}

// ---------- gzip ----------
async function gz(str) {
  const cs = new CompressionStream("gzip");
  const w = cs.writable.getWriter();
  w.write(new TextEncoder().encode(str));
  w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
async function gunz(buf) {
  const ds = new DecompressionStream("gzip");
  const w = ds.writable.getWriter();
  w.write(new Uint8Array(buf));
  w.close();
  return await new Response(ds.readable).text();
}

// ---------- Bildirişlər ----------
function notifOut(r) {
  let d = {};
  try { d = JSON.parse(r.data) || {}; } catch (e) {}
  d.read = !!r.rd;
  if (!d.createdAt) d.createdAt = r.ts;
  return { id: r.id, d };
}
async function notifAdd(db, uid, d, id) {
  const x = clean(d);
  const ts = +x.createdAt > 0 ? +x.createdAt : Date.now();
  x.createdAt = ts;
  const rd = x.read ? 1 : 0;
  delete x.read;
  id = id || rid();
  await db.prepare("INSERT OR IGNORE INTO pt_notif (id, uid, ts, rd, data) VALUES (?, ?, ?, ?, ?)").bind(id, uid, ts, rd, JSON.stringify(x)).run();
  return id;
}

// ---------- Hesabatlar ----------
function repOut(r) {
  let d = {};
  try { d = JSON.parse(r.data) || {}; } catch (e) {}
  d.status = r.status || d.status || "pending";
  if (!d.createdAt) d.createdAt = r.ts;
  return { id: r.id, d };
}

// ---------- Baza versiyaları ----------
function verMeta(r) { return { id: r.id, ts: r.ts, by: r.by || "", note: r.note || "", groups: r.groups || 0, models: r.models || 0, size: r.size || 0 }; }
async function baseRow(db, id) {
  return id
    ? await db.prepare("SELECT * FROM pt_base WHERE id=?").bind(id).first()
    : await db.prepare("SELECT * FROM pt_base WHERE id=(SELECT CAST(v AS INTEGER) FROM pt_cfg WHERE k='base_cur')").first();
}
async function baseOut(r) {
  if (!r) return null;
  let data = {};
  try { data = JSON.parse(await gunz(r.data)); } catch (e) { data = {}; }
  return Object.assign(verMeta(r), { data });
}

async function cleanup(env) {
  const db = env.DB;
  await init(db);
  const now = Date.now();
  await db.batch([
    db.prepare("DELETE FROM pt_notif WHERE ts < ?").bind(now - NOTIF_KEEP_MS),
    db.prepare("DELETE FROM pt_report WHERE ts < ? AND status != 'pending'").bind(now - REPORT_KEEP_MS),
    db.prepare("DELETE FROM pt_rate WHERE k < ?").bind("r:" + (Math.floor(now / 86400000) - 2)),
    db.prepare("DELETE FROM pt_rate WHERE k LIKE 'b:%' AND k < ?").bind("b:" + (Math.floor(now / 86400000) - 2)),
    db.prepare("DELETE FROM pt_rate WHERE k LIKE 'bm:%' AND k < ?").bind("bm:" + (Math.floor(now / 60000) - 1440))
  ]);
}

// ---------- Batareya bazası ----------
const nz = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9а-яё]+/g, "");
function batBuild(arr) {
  const byModel = new Map(), byCode = new Map(), rows = [];
  (Array.isArray(arr) ? arr : []).forEach((line) => {
    const p = String(line).split("|").map((x) => x.trim());
    if (p.length < 2) return;
    const models = p[0].split(",").map((x) => x.trim()).filter(Boolean);
    const codes = p[1].split(",").map((x) => x.trim()).filter(Boolean);
    if (!models.length || !codes.length) return;
    const r = { models, codes };
    rows.push(r);
    models.forEach((m) => { if (!byModel.has(m)) byModel.set(m, []); byModel.get(m).push(r); });
    codes.forEach((c) => { const k = nz(c); if (!k) return; if (!byCode.has(k)) byCode.set(k, { code: c, rows: [] }); byCode.get(k).rows.push(r); });
  });
  const old = [];
  byModel.forEach((_, m) => {
    if (BAT_OLD.some((b) => m.indexOf(b + " ") === 0 && (b !== "Samsung" || !/galaxy|5g|fold|flip/i.test(m)))) old.push(m);
  });
  return { byModel, byCode, rows, old };
}
let BAT = { id: -1, ix: null };
async function batIndex(db) {
  const cur = +(await cfgGet(db, "bat_cur")) || 0;
  if (BAT.id === cur && BAT.ix) return BAT.ix;
  let ix = batBuild([]);
  if (cur) {
    const r = await db.prepare("SELECT data FROM pt_bat WHERE id=?").bind(cur).first();
    if (r) { try { ix = batBuild(JSON.parse(await gunz(r.data))); } catch (e) {} }
  }
  BAT = { id: cur, ix };
  return ix;
}
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = new Array(n + 1), cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    const t = prev; prev = cur; cur = t;
  }
  return prev[n];
}
function batModelOut(ix, m) {
  const codes = [], cs = new Set(), same = [], ss = new Set([m]), shared = {};
  ix.byModel.get(m).forEach((r) => {
    r.codes.forEach((c) => { if (!cs.has(c)) { cs.add(c); codes.push(c); } });
  });
  // eyni batareya kodunu paylaşan digər modellər — uyğun ola bilən modellər (hər biri üçün ortaq kodlar)
  codes.forEach((c) => {
    const ent = ix.byCode.get(nz(c));
    if (ent) ent.rows.forEach((r) => r.models.forEach((x) => {
      if (x === m) return;
      if (!ss.has(x)) { ss.add(x); same.push(x); shared[x] = []; }
      if (shared[x].indexOf(c) < 0) shared[x].push(c);
    }));
  });
  const sh = {};
  same.slice(0, 40).forEach((x) => { sh[x] = shared[x].slice(0, 6); });
  return { model: m, codes, same: same.slice(0, 40), shared: sh };
}
function batSearch(ix, q) {
  const k = nz(q);
  const out = { codes: [], models: [], multi: false, fuzzy: false };
  if (!k) return out;
  let codeHit = ix.byCode.has(k) ? [k] : [];
  if (!codeHit.length && k.length >= 2) {
    codeHit = Array.from(ix.byCode.keys()).filter((c) => c.indexOf(k) >= 0)
      .sort((a, b) => (a.indexOf(k) - b.indexOf(k)) || (a.length - b.length));
  }
  codeHit.slice(0, 20).forEach((c) => {
    const ent = ix.byCode.get(c), seen = new Set(), mods = [];
    ent.rows.forEach((r) => r.models.forEach((m) => { if (!seen.has(m)) { seen.add(m); mods.push(m); } }));
    const mc = {};
    mods.slice(0, 80).forEach((m) => {
      const cs = [];
      ix.byModel.get(m).forEach((r) => r.codes.forEach((x) => { if (cs.indexOf(x) < 0) cs.push(x); }));
      mc[m] = cs.slice(0, 6);
    });
    out.codes.push({ code: ent.code, models: mods.slice(0, 80), mc });
  });
  const toks = String(q).toLowerCase().split(/[\s,\/]+/).map(nz).filter(Boolean);
  const mHit = [];
  ix.byModel.forEach((_, m) => {
    const z = nz(m);
    if (z.indexOf(k) >= 0 || (toks.length > 1 && toks.every((t) => z.indexOf(t) >= 0))) mHit.push(m);
  });
  // heç nə tapılmadısa: bir hərf səhvinə dözümlülük (antiudar axtarışı kimi)
  if (!mHit.length && !out.codes.length && toks.length) {
    out.fuzzy = true;
    ix.byModel.forEach((_, m) => {
      const z = nz(m);
      const words = m.toLowerCase().split(/[^a-z0-9а-яё]+/).filter(Boolean);
      const ok = toks.every((tk) => z.indexOf(tk) >= 0 || (tk.length >= 4 && words.some((w) => Math.abs(w.length - tk.length) <= 1 && lev(w, tk) <= 1)));
      if (ok) mHit.push(m);
    });
  }
  mHit.slice(0, 60).forEach((m) => {
    const o = batModelOut(ix, m);
    if (ix.byModel.get(m).some((r) => r.codes.length > 1)) out.multi = true;
    out.models.push(o);
  });
  return out;
}
// Gündəlik + dəqiqəlik limit (admin istisna)
async function batLimit(db, me) {
  if (me.admin) return null;
  const now = Date.now(), dk = "b:" + Math.floor(now / 86400000) + ":" + me.uid, mk = "bm:" + Math.floor(now / 60000) + ":" + me.uid;
  await db.batch([
    db.prepare("INSERT INTO pt_rate (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n=n+1").bind(dk),
    db.prepare("INSERT INTO pt_rate (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n=n+1").bind(mk)
  ]);
  const rs = await db.prepare("SELECT k, n FROM pt_rate WHERE k IN (?, ?)").bind(dk, mk).all();
  let day = 0, min = 0;
  (rs.results || []).forEach((r) => { if (r.k === dk) day = r.n; else min = r.n; });
  if (day > BAT_DAY_LIMIT) return "daily-limit";
  if (min > BAT_MIN_LIMIT) return "slow";
  return null;
}

// ---------- Telegram: gecə sakit saatları (Bakı vaxtı 23:00–10:00) ----------
const TG_QUIET_FROM = 23, TG_QUIET_TO = 10;
const TG_FLUSH_CRON = "0 6 * * *";           // 06:00 UTC = 10:00 Bakı
const bakuHour = (t) => (new Date(t || Date.now()).getUTCHours() + 4) % 24;
const bakuHM = (t) => new Date((t || Date.now()) + 4 * 3600000).toISOString().slice(11, 16);
const tgQuiet = () => { const h = bakuHour(); return h >= TG_QUIET_FROM || h < TG_QUIET_TO; };
async function tgRaw(env, text) {
  const r = await fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendMessage", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TG_CHAT, text: String(text).slice(0, 4000) })
  });
  return r.ok;
}
async function tgSend(env, text) {
  if (!env.TG_TOKEN || !env.TG_CHAT) return;
  if (tgQuiet() && env.DB) {
    try {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS pt_tgq (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, text TEXT NOT NULL)").run();
      await env.DB.prepare("INSERT INTO pt_tgq (ts, text) VALUES (?, ?)").bind(Date.now(), String(text).slice(0, 1500)).run();
      return;
    } catch (e) { /* növbə alınmasa, gecə də olsa göndər */ }
  }
  try { await tgRaw(env, text); } catch (e) {}
}
async function tgFlush(env) {
  if (!env.TG_TOKEN || !env.TG_CHAT || !env.DB) return;
  const db = env.DB;
  await init(db);
  const rs = await db.prepare("SELECT id, ts, text FROM pt_tgq ORDER BY id LIMIT 300").all();
  const rows = rs.results || [];
  if (!rows.length) return;
  const head = "🌅 Gecə bildirişləri (" + rows.length + ")";
  const chunks = [];
  let cur = head;
  rows.forEach((r) => {
    const part = "\n\n— " + bakuHM(r.ts) + " —\n" + r.text;
    if ((cur + part).length > 3800) { chunks.push(cur); cur = head + " · davamı"; }
    cur += part;
  });
  chunks.push(cur);
  for (const c of chunks) { if (!(await tgRaw(env, c))) return; }
  await db.batch(rows.map((r) => db.prepare("DELETE FROM pt_tgq WHERE id=?").bind(r.id)));
}

// ---------- Adminə xəbərdarlıq (Telegram + telefona push) ----------
// Push dərhal gedir; Telegram gözləsə də push gecikmir (paralel)
async function notifyAdmin(env, db, title, text) {
  const tg = tgSend(env, title + "\n\n" + text).catch(() => {});
  const push = (async () => {
    if (!env.PUSH_KEY) return;
    const a = await db.prepare("SELECT v FROM chat_cfg WHERE k='admin_uid'").first();
    if (!a || !a.v) return;
    const bt = String(text).slice(0, 200);
    await fetch(PUSH_URL + "/send", {
      method: "POST",
      headers: { "X-Push-Key": env.PUSH_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ to: [a.v], t: "general", ti: { az: title, ru: title, tr: title, en: title }, b: { az: bt, ru: bt, tr: bt, en: bt }, o: "notif" })
    });
  })().catch(() => {});
  await Promise.all([tg, push]);
}

// ---------- Marşrutlar ----------
// ---------- Xəta xəbərdarlığı (Telegram) ----------
// Secrets: TG_TOKEN + TG_CHAT. Eyni isolate-də dəqiqədə ən çox 1 xəbər (spam olmasın).
let _lastAlert = 0;
async function tgAlert(env, where, err, req) {
  try {
    if (!env.TG_TOKEN || !env.TG_CHAT) return;
    const t = Date.now();
    if (t - _lastAlert < 60000) return;
    _lastAlert = t;
    let p = "";
    try { if (req) p = " " + req.method + " " + new URL(req.url).pathname; } catch (e) {}
    const msg = "⚠️ " + "protector-data" + " xətası (" + where + ")" + p + "\n\n" + String((err && err.message) || err).slice(0, 500);
    await tgSend(env, msg);
  } catch (e) {}
}

const _handler = {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const db = env.DB;
    if (!db) return E("no-db", 500);
    if (path === "/health") return J({ ok: true });
    await init(db);

    // İlk səhifə rejimi (ictimai oxuma): on = bələdçi ilə, nogirl = qızsız, off = «təmirdədir» səhifəsi
    if (path === "/cfg/landing" && req.method === "GET") {
      const m = await cfgGet(db, "landing");
      return J({ mode: LANDING_MODES.indexOf(m) >= 0 ? m : "on" });
    }

    const me = await verify((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""));
    if (!me) return E("auth", 401);
    if (me.anon) return E("registered-only", 403);

    let b = {};
    if (req.method === "POST") {
      try { b = await body(req); } catch (e) { return E("too-big", 413); }
    }

    // ===== İlk səhifə rejimi (yalnız admin) =====
    if (path === "/cfg/landing" && req.method === "POST") {
      if (!me.admin) return E("forbidden", 403);
      if (LANDING_MODES.indexOf(b.mode) < 0) return E("mode");
      await cfgSet(db, "landing", b.mode);
      return J({ ok: true, mode: b.mode });
    }

    // ===== Bildirişlər =====
    if (path === "/n/list" && req.method === "GET") {
      const uid = me.admin && url.searchParams.get("uid") ? url.searchParams.get("uid") : me.uid;
      if (!okUid(uid)) return E("uid");
      const n = Math.min(Math.max(+url.searchParams.get("n") || 50, 1), 200);
      const rs = await db.prepare("SELECT * FROM pt_notif WHERE uid=? ORDER BY ts DESC LIMIT ?").bind(uid, n).all();
      const mig = await cfgGet(db, "nmig:" + uid);
      return J({ items: (rs.results || []).map(notifOut), mig: !!mig });
    }
    if (path === "/n/unread" && req.method === "GET") {
      const r = await db.prepare("SELECT COUNT(*) n FROM pt_notif WHERE uid=? AND rd=0").bind(me.uid).first();
      return J({ n: (r && r.n) || 0 });
    }
    if (path === "/n/add" && req.method === "POST") {
      if (!me.admin) return E("forbidden", 403);
      const uids = (Array.isArray(b.uids) ? b.uids : [b.uid]).filter(okUid).slice(0, 1000);
      if (!uids.length) return E("uid");
      const ids = [];
      for (let i = 0; i < uids.length; i += 50) {
        const part = uids.slice(i, i + 50);
        const stmts = part.map((u) => {
          const x = clean(b.d);
          const ts = +x.createdAt > 0 ? +x.createdAt : Date.now();
          x.createdAt = ts;
          const rd = x.read ? 1 : 0;
          delete x.read;
          const id = rid();
          ids.push(id);
          return db.prepare("INSERT INTO pt_notif (id, uid, ts, rd, data) VALUES (?, ?, ?, ?, ?)").bind(id, u, ts, rd, JSON.stringify(x));
        });
        await db.batch(stmts);
      }
      // Hər istifadəçidə ən çox NOTIF_MAX_PER_USER bildiriş qalır
      ctx.waitUntil(Promise.all(uids.slice(0, 50).map((u) =>
        db.prepare("DELETE FROM pt_notif WHERE uid=? AND id NOT IN (SELECT id FROM pt_notif WHERE uid=? ORDER BY ts DESC LIMIT ?)").bind(u, u, NOTIF_MAX_PER_USER).run()
      )).catch(() => {}));
      return J({ ok: true, id: ids[0], ids });
    }
    if (path === "/n/upd" && req.method === "POST") {
      const uid = me.admin && b.uid ? b.uid : me.uid;
      if (!okUid(uid) || !okId(b.id)) return E("id");
      const r = await db.prepare("SELECT * FROM pt_notif WHERE id=? AND uid=?").bind(b.id, uid).first();
      if (!r) return E("not-found", 404);
      let d = {};
      try { d = JSON.parse(r.data) || {}; } catch (e) {}
      const o = clean(b.o);
      // İstifadəçi yalnız «oxundu» və «təşəkkür» işarəsini dəyişə bilər
      const allowed = me.admin ? Object.keys(o) : Object.keys(o).filter((k) => k === "read" || k === "thanked");
      let rd = r.rd;
      allowed.forEach((k) => { if (k === "read") rd = o.read ? 1 : 0; else d[k] = o[k]; });
      await db.prepare("UPDATE pt_notif SET rd=?, data=? WHERE id=?").bind(rd, JSON.stringify(d), b.id).run();
      return J({ ok: true });
    }
    if (path === "/n/read" && req.method === "POST") {
      const ids = (Array.isArray(b.ids) ? b.ids : []).filter(okId).slice(0, 300);
      if (ids.length) await db.batch(ids.map((id) => db.prepare("UPDATE pt_notif SET rd=1 WHERE id=? AND uid=?").bind(id, me.uid)));
      return J({ ok: true });
    }
    if (path === "/n/readall" && req.method === "POST") {
      await db.prepare("UPDATE pt_notif SET rd=1 WHERE uid=? AND rd=0").bind(me.uid).run();
      return J({ ok: true });
    }
    if (path === "/n/del" && req.method === "POST") {
      const uid = me.admin && b.uid ? b.uid : me.uid;
      if (!okUid(uid)) return E("uid");
      if (b.all) { await db.prepare("DELETE FROM pt_notif WHERE uid=?").bind(uid).run(); return J({ ok: true }); }
      const ids = (Array.isArray(b.ids) ? b.ids : []).filter(okId).slice(0, 300);
      if (ids.length) await db.batch(ids.map((id) => db.prepare("DELETE FROM pt_notif WHERE id=? AND uid=?").bind(id, uid)));
      return J({ ok: true, n: ids.length });
    }
    // Firestore-dakı köhnə bildirişlərin bir dəfəlik köçürülməsi (istifadəçinin öz cihazından)
    if (path === "/n/import" && req.method === "POST") {
      const key = "nmig:" + me.uid;
      if (await cfgGet(db, key)) return J({ ok: true, skipped: true });
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 200);
      for (const it of items) {
        if (!it || !okId(String(it.id || "")) || !it.d) continue;
        await notifAdd(db, me.uid, it.d, "fs_" + it.id);
      }
      await cfgSet(db, key, Date.now());
      return J({ ok: true, n: items.length });
    }

    // ===== «Uyğun gəlmədi» hesabatları =====
    if (path === "/r/add" && req.method === "POST") {
      const day = Math.floor(Date.now() / 86400000);
      const rk = "r:" + day + ":" + me.uid;
      const rr = await db.prepare("SELECT n FROM pt_rate WHERE k=?").bind(rk).first();
      if (!me.admin && rr && rr.n >= REPORT_DAY_LIMIT) return E("daily-limit", 429);
      const d = clean(b.d || b);
      const x = {
        uid: me.uid,
        email: me.email,
        model: String(d.model || "").slice(0, 100),
        group: String(d.group || "").slice(0, 500),
        reason: String(d.reason || "other").slice(0, 40),
        comment: String(d.comment || "").slice(0, 300),
        date: String(d.date || "").slice(0, 20),
        createdAt: Date.now()
      };
      if (d.kind === "battery") { x.kind = "battery"; x.code = String(d.code || "").slice(0, 60); }
      if (!x.model) return E("model");
      const id = rid();
      await db.batch([
        db.prepare("INSERT INTO pt_report (id, uid, ts, status, data) VALUES (?, ?, ?, 'pending', ?)").bind(id, me.uid, x.createdAt, JSON.stringify(x)),
        db.prepare("INSERT INTO pt_rate (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n=n+1").bind(rk)
      ]);
      if (x.kind === "battery") {
        const fit = x.reason === "bat_fit", miss = x.reason === "bat_missing";
        ctx.waitUntil(notifyAdmin(env, db, fit ? "🔋 Batareya: «Uyğundur» bildirişi" : (miss ? "🔋 Batareya: bazada yoxdur" : "🔋 Batareya: «Uyğun gəlmədi» bildirişi"),
          (me.email || me.uid) + "\n" + x.model + (x.code ? " — " + x.code : "") + (x.comment ? "\n" + x.comment : "")));
      } else if (!me.admin) {
        // Antiudar «Uyğun gəlmədi» / yeni model bildirişi də adminə dərhal push kimi çatsın
        ctx.waitUntil(notifyAdmin(env, db, "⚠ Yeni bildiriş: " + x.model.slice(0, 60),
          (me.email || me.uid) + "\n" + (x.reason || "") + (x.comment ? "\n" + x.comment : "")));
      }
      return J({ ok: true, id });
    }
    // ===== Yeniləmə tarixçəsi (hamı üçün eyni: antiudar + batareya bazası) =====
    if (path === "/hist" && req.method === "GET") {
      const rs = await db.prepare("SELECT ts, kind, a, r, e, g, n, c, note, first FROM pt_hist ORDER BY ts DESC LIMIT 150").all();
      return J({ items: rs.results || [] });
    }
    // ===== Batareya axtarışı (qeydiyyatlı istifadəçilər; baza heç vaxt tam göndərilmir) =====
    if (path === "/bat/meta" && req.method === "GET") {
      const ix = await batIndex(db);
      const old = ix.old.slice();
      for (let i = old.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = old[i]; old[i] = old[j]; old[j] = t; }
      return J({ n: ix.byModel.size, c: ix.byCode.size, brands: BAT_OLD, old: old.slice(0, 24) });
    }
    if (path === "/bat/search" && req.method === "GET") {
      const q = String(url.searchParams.get("q") || "").trim().slice(0, 60);
      if (!q) return J({ codes: [], models: [], multi: false });
      const lim = await batLimit(db, me);
      if (lim) return E(lim, 429);
      return J(batSearch(await batIndex(db), q));
    }

    if (!me.admin && (path.startsWith("/r/") || path.startsWith("/base/") || path.startsWith("/bat/"))) return E("forbidden", 403);

    // ===== Batareya bazası: dərc (admin, GitHub-dan gələn Battery.json) =====
    if (path === "/bat/publish" && req.method === "POST") {
      const lines = Array.isArray(b.lines) ? b.lines : null;
      if (!lines || lines.length < 1 || lines.length > 30000) return E("data");
      const arr = lines.map((x) => String(x).slice(0, 600)).filter((x) => x.indexOf("|") > 0);
      const ix = batBuild(arr);
      if (!ix.byModel.size || !ix.byCode.size) return E("data");
      const prev = await batIndex(db);
      const added = [], removed = [];
      ix.byModel.forEach((_, m) => { if (!prev.byModel.has(m)) added.push(m); });
      prev.byModel.forEach((_, m) => { if (!ix.byModel.has(m)) removed.push(m); });
      const txt = JSON.stringify(arr);
      const note = "+" + added.length + " / −" + removed.length;
      const now = Date.now();
      const ins = await db.prepare("INSERT INTO pt_bat (ts, by, note, lines, models, codes, size, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(now, me.email, note, arr.length, ix.byModel.size, ix.byCode.size, txt.length, await gz(txt)).run();
      const id = ins.meta && ins.meta.last_row_id;
      await cfgSet(db, "bat_cur", id);
      // Tarixçə jurnalı: dəyişiklik varsa (model +/−, kod və ya sətir sayı) qeyd olunur
      const structChanged = ix.byCode.size !== prev.byCode.size || ix.rows.length !== prev.rows.length;
      if (added.length || removed.length || structChanged) {
        await db.prepare("INSERT INTO pt_hist (ts, kind, a, r, n, c, note) VALUES (?, 'bat', ?, ?, ?, ?, ?)")
          .bind(now, added.length, removed.length, ix.byModel.size, ix.byCode.size, added.length || removed.length ? "" : "edit").run();
      }
      BAT = { id, ix };
      ctx.waitUntil(db.prepare("DELETE FROM pt_bat WHERE id NOT IN (SELECT id FROM pt_bat ORDER BY id DESC LIMIT ?)").bind(BAT_KEEP).run().catch(() => {}));
      if (added.length || removed.length) {
        ctx.waitUntil(notifyAdmin(env, db, "🔋 Batareya bazası yeniləndi",
          "Əlavə: " + added.length + (added.length ? " (" + added.slice(0, 8).join(", ") + (added.length > 8 ? "…" : "") + ")" : "") +
          "\nSilindi: " + removed.length + (removed.length ? " (" + removed.slice(0, 8).join(", ") + (removed.length > 8 ? "…" : "") + ")" : "") +
          "\nCəmi: " + ix.byModel.size + " model · " + ix.byCode.size + " kod"));
      }
      return J({ ok: true, id, a: added.length, r: removed.length, n: ix.byModel.size, c: ix.byCode.size, added: added.slice(0, 10), removed: removed.slice(0, 10) });
    }
    if (path === "/bat/list" && req.method === "GET") {
      const rs = await db.prepare("SELECT id, ts, by, note, lines, models, codes, size FROM pt_bat ORDER BY id DESC LIMIT ?").bind(BAT_KEEP).all();
      return J({ items: rs.results || [], cur: +(await cfgGet(db, "bat_cur")) || 0 });
    }

    // Yüngül yoxlama: admin paneli hər 10 saniyədən bir yalnız bunu çağırır, dəyişiklik varsa siyahını yükləyir
    if (path === "/r/count" && req.method === "GET") {
      const p = await db.prepare("SELECT COUNT(*) n, COALESCE(MAX(ts), 0) t FROM pt_report WHERE status='pending'").first();
      const l = await db.prepare("SELECT COALESCE(MAX(ts), 0) t FROM pt_report").first();
      return J({ pending: (p && p.n) || 0, last: (l && l.t) || 0 });
    }
    if (path === "/r/list" && req.method === "GET") {
      const n = Math.min(Math.max(+url.searchParams.get("n") || 100, 1), 500);
      const rs = await db.prepare("SELECT * FROM pt_report ORDER BY ts DESC LIMIT ?").bind(n).all();
      const p = await db.prepare("SELECT COUNT(*) n FROM pt_report WHERE status='pending'").first();
      return J({ items: (rs.results || []).map(repOut), pending: (p && p.n) || 0 });
    }
    if (path === "/r/upd" && req.method === "POST") {
      if (!okId(b.id)) return E("id");
      const r = await db.prepare("SELECT * FROM pt_report WHERE id=?").bind(b.id).first();
      if (!r) return E("not-found", 404);
      let d = {};
      try { d = JSON.parse(r.data) || {}; } catch (e) {}
      const o = clean(b.o);
      Object.assign(d, o);
      const st = String(o.status || r.status || "pending").slice(0, 20);
      d.status = st;
      await db.prepare("UPDATE pt_report SET status=?, data=? WHERE id=?").bind(st, JSON.stringify(d), b.id).run();
      return J({ ok: true });
    }
    if (path === "/r/del" && req.method === "POST") {
      const ids = (Array.isArray(b.ids) ? b.ids : []).filter(okId).slice(0, 300);
      if (ids.length) await db.batch(ids.map((id) => db.prepare("DELETE FROM pt_report WHERE id=?").bind(id)));
      return J({ ok: true });
    }
    if (path === "/r/import" && req.method === "POST") {
      if (await cfgGet(db, "rmig")) return J({ ok: true, skipped: true });
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 1000);
      for (let i = 0; i < items.length; i += 50) {
        const stmts = [];
        items.slice(i, i + 50).forEach((it) => {
          if (!it || !okId(String(it.id || "")) || !it.d) return;
          const d = clean(it.d);
          const ts = +d.createdAt > 0 ? +d.createdAt : Date.now();
          d.createdAt = ts;
          stmts.push(db.prepare("INSERT OR IGNORE INTO pt_report (id, uid, ts, status, data) VALUES (?, ?, ?, ?, ?)")
            .bind("fs_" + it.id, String(d.uid || ""), ts, String(d.status || "pending").slice(0, 20), JSON.stringify(d)));
        });
        if (stmts.length) await db.batch(stmts);
      }
      await cfgSet(db, "rmig", Date.now());
      return J({ ok: true, n: items.length });
    }

    // ===== Əsas baza: dərc, versiyalar, geri qaytarma =====
    if (path === "/base/cur" && req.method === "GET") {
      const r = await baseRow(db, 0);
      return J({ cur: await baseOut(r) });
    }
    if (path === "/base/list" && req.method === "GET") {
      const rs = await db.prepare("SELECT id, ts, by, note, groups, models, size FROM pt_base ORDER BY id DESC LIMIT ?").bind(BASE_KEEP).all();
      return J({ items: (rs.results || []).map(verMeta), cur: +(await cfgGet(db, "base_cur")) || 0 });
    }
    if (path === "/base/get" && req.method === "GET") {
      const id = +url.searchParams.get("id") || 0;
      if (!id) return E("id");
      const r = await baseRow(db, id);
      if (!r) return E("not-found", 404);
      return J({ ver: await baseOut(r) });
    }
    if (path === "/base/publish" && req.method === "POST") {
      const data = b.data;
      if (!data || typeof data !== "object" || typeof data.dataJson !== "string" || data.dataJson.length < 3) return E("data");
      const txt = JSON.stringify(data);
      const blob = await gz(txt);
      const now = Date.now();
      const ins = await db.prepare("INSERT INTO pt_base (ts, by, note, groups, models, size, data) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(now, me.email, String(b.note || "").slice(0, 200), +data.groupCount || 0, +b.models || 0, txt.length, blob).run();
      const id = ins.meta && ins.meta.last_row_id;
      await cfgSet(db, "base_cur", id);
      // Tarixçə jurnalı (client dərc zamanı göndərdiyi say məlumatı)
      const h = b.hist && typeof b.hist === "object" ? b.hist : null;
      if (h && (h.a || h.r || h.e || h.g || h.note)) {
        await db.prepare("INSERT INTO pt_hist (ts, kind, a, r, e, g, n, note, first) VALUES (?, 'base', ?, ?, ?, ?, ?, ?, ?)")
          .bind(now, +h.a || 0, +h.r || 0, +h.e || 0, +h.g || 0, +h.n || +b.models || 0, String(h.note || "").slice(0, 30), h.first ? 1 : 0).run();
      }
      ctx.waitUntil(db.prepare("DELETE FROM pt_base WHERE id NOT IN (SELECT id FROM pt_base ORDER BY id DESC LIMIT ?)").bind(BASE_KEEP).run().catch(() => {}));
      return J({ ok: true, id, ts: now });
    }
    // Model kodları: cari versiyanı yerində yeniləyir (yeni versiya yaratmır)
    if (path === "/base/codes" && req.method === "POST") {
      const key = String(b.key || "");
      if (!key || key.length > 120) return E("key");
      const r = await baseRow(db, 0);
      if (!r) return E("no-base", 404);
      const v = await baseOut(r);
      const data = v.data || {};
      data.codes = data.codes || {};
      const codes = (Array.isArray(b.codes) ? b.codes : []).map((c) => String(c).slice(0, 40)).slice(0, 30);
      if (codes.length) data.codes[key] = codes; else delete data.codes[key];
      const txt = JSON.stringify(data);
      await db.prepare("UPDATE pt_base SET data=?, size=? WHERE id=?").bind(await gz(txt), txt.length, r.id).run();
      return J({ ok: true });
    }

    return E("not-found", 404);
  },

  async scheduled(ev, env, ctx) {
    // 10:00 Bakı: gecə növbəsindəki Telegram xəbərləri bir mesajda göndərilir
    if (ev && ev.cron === TG_FLUSH_CRON) { await tgFlush(env); return; }
    await cleanup(env);
  }
};

export default {
  async fetch(req, env, ctx) {
    try {
      return await _handler.fetch(req, env, ctx);
    } catch (e) {
      ctx.waitUntil(tgAlert(env, "fetch", e, req));
      return J({ error: "server" }, 500);
    }
  },
  async scheduled(ev, env, ctx) {
    try {
      await _handler.scheduled(ev, env, ctx);
    } catch (e) {
      ctx.waitUntil(tgAlert(env, "cron", e));
    }
  }
};
