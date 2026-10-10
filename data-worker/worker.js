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
    db.prepare("CREATE TABLE IF NOT EXISTS pt_rate (k TEXT PRIMARY KEY, n INTEGER DEFAULT 0)")
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
    db.prepare("DELETE FROM pt_rate WHERE k < ?").bind("r:" + (Math.floor(now / 86400000) - 2))
  ]);
}

// ---------- Marşrutlar ----------
export default {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const db = env.DB;
    if (!db) return E("no-db", 500);
    if (path === "/health") return J({ ok: true });
    await init(db);

    const me = await verify((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""));
    if (!me) return E("auth", 401);
    if (me.anon) return E("registered-only", 403);

    let b = {};
    if (req.method === "POST") {
      try { b = await body(req); } catch (e) { return E("too-big", 413); }
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
      if (!x.model) return E("model");
      const id = rid();
      await db.batch([
        db.prepare("INSERT INTO pt_report (id, uid, ts, status, data) VALUES (?, ?, ?, 'pending', ?)").bind(id, me.uid, x.createdAt, JSON.stringify(x)),
        db.prepare("INSERT INTO pt_rate (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n=n+1").bind(rk)
      ]);
      return J({ ok: true, id });
    }
    if (!me.admin && (path.startsWith("/r/") || path.startsWith("/base/"))) return E("forbidden", 403);

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
    ctx.waitUntil(cleanup(env));
  }
};
