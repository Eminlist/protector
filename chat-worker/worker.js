// ProTechtor™ — «Adminlə əlaqə» söhbəti (protector-chat Worker)
// D1 (DB = protector-db): mesajlar, şəkillər, ayarlar. Durable Object (HUB): canlı WebSocket.
// Mesajlar və şəkillər 30 gündən sonra avtomatik silinir (Cron, hər gün).
// İstəyə bağlı secrets: TG_TOKEN + TG_CHAT — yeni mesaj gələndə Telegram xəbəri.

const PROJECT = "protechtor-99407";
const ADMIN_EMAIL = "o553115544@gmail.com";
const PUSH_URL = "https://protector-push.o553115544.workers.dev";
const KEEP_MS = 30 * 86400000;
const MAX_TXT = 2000;
const MAX_IMG = 900 * 1024;
const DAY_MSG = 150;
const DAY_IMG = 30;

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
    if (c.firebase && c.firebase.sign_in_provider === "anonymous") return null;
    return { uid: c.sub, email, admin: email === ADMIN_EMAIL, name: c.name || "" };
  } catch (e) { return null; }
}

// ---------- Cədvəllər ----------
let READY = false;
async function init(db) {
  if (READY) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS chat_msg (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, frm TEXT NOT NULL, txt TEXT, img TEXT, ts INTEGER NOT NULL, ack INTEGER DEFAULT 0, seen INTEGER DEFAULT 0)"),
    db.prepare("CREATE INDEX IF NOT EXISTS chat_msg_uid ON chat_msg(uid, id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS chat_msg_ts ON chat_msg(ts)"),
    db.prepare("CREATE TABLE IF NOT EXISTS chat_thread (uid TEXT PRIMARY KEY, email TEXT, name TEXT, last_ts INTEGER, last_txt TEXT, last_frm TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS chat_img (k TEXT PRIMARY KEY, uid TEXT, mime TEXT, data BLOB, ts INTEGER)"),
    db.prepare("CREATE TABLE IF NOT EXISTS chat_cfg (k TEXT PRIMARY KEY, v TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS chat_rate (uid TEXT, day INTEGER, n INTEGER DEFAULT 0, img INTEGER DEFAULT 0, PRIMARY KEY (uid, day))")
  ]);
  READY = true;
}
async function cfg(db) {
  const r = await db.prepare("SELECT v FROM chat_cfg WHERE k='img'").first();
  return { img: r ? r.v === "1" : true };
}

// ---------- Canlı yayım (Durable Object) ----------
async function publish(env, tags, msg) {
  if (!env.HUB) return;
  try {
    const stub = env.HUB.get(env.HUB.idFromName("hub"));
    await stub.fetch("https://hub/pub", { method: "POST", body: JSON.stringify({ tags, msg }) });
  } catch (e) {}
}

export class ChatHub {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/pub") {
      const { tags, msg } = await req.json();
      const s = JSON.stringify(msg);
      (tags || []).forEach((t) => this.ctx.getWebSockets(t).forEach((ws) => { try { ws.send(s); } catch (e) {} }));
      return new Response("ok");
    }
    const tag = url.searchParams.get("tag");
    if (!tag || req.headers.get("Upgrade") !== "websocket") return new Response("bad", { status: 400 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [tag]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  webSocketMessage(ws, m) { if (m === "ping") { try { ws.send("pong"); } catch (e) {} } }
  webSocketClose(ws, code) { try { ws.close(code, "bye"); } catch (e) {} }
  webSocketError() {}
}

// ---------- Köməkçilər ----------
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
function decodeImg(d) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(d || ""));
  if (!m) return null;
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  if (!bin.length || bin.length > MAX_IMG) return null;
  return { mime: m[1], bin };
}
const PUSH_TI = { az: "Admindən cavab", ru: "Ответ администрации", tr: "Yöneticiden yanıt", en: "Reply from admin" };
const PHOTO = { az: "📷 Şəkil", ru: "📷 Фото", tr: "📷 Fotoğraf", en: "📷 Photo" };
const rowOut = (r) => ({ id: r.id, f: r.frm, t: r.txt || "", i: r.img || "", ts: r.ts, a: r.ack ? 1 : 0, s: r.seen ? 1 : 0 });

async function sendMsg(env, ctx, me, body, authHeader) {
  const db = env.DB;
  const txt = String(body.text || "").trim().slice(0, MAX_TXT);
  let img = null;
  if (body.img) {
    if (!me.admin && !(await cfg(db)).img) return E("img-off", 403);
    img = decodeImg(body.img);
    if (!img) return E("img-bad");
  }
  if (!txt && !img) return E("empty");
  const uid = me.admin ? String(body.uid || "") : me.uid;
  if (!uid) return E("uid");
  const now = Date.now();

  if (!me.admin) {
    const day = Math.floor(now / 86400000);
    const r = await db.prepare("SELECT n, img FROM chat_rate WHERE uid=? AND day=?").bind(uid, day).first();
    if (r && r.n >= DAY_MSG) return E("limit", 429);
    if (img && r && r.img >= DAY_IMG) return E("img-limit", 429);
    await db.prepare("INSERT INTO chat_rate (uid, day, n, img) VALUES (?, ?, 1, ?) ON CONFLICT(uid, day) DO UPDATE SET n=n+1, img=img+?").bind(uid, day, img ? 1 : 0, img ? 1 : 0).run();
  }

  let key = "";
  const st = [];
  if (img) {
    key = hex(16);
    st.push(db.prepare("INSERT INTO chat_img (k, uid, mime, data, ts) VALUES (?, ?, ?, ?, ?)").bind(key, uid, img.mime, img.bin, now));
  }
  const frm = me.admin ? "a" : "u";
  st.push(db.prepare("INSERT INTO chat_msg (uid, frm, txt, img, ts) VALUES (?, ?, ?, ?, ?)").bind(uid, frm, txt, key, now));
  // Admin cavab yazanda istifadəçinin əvvəlki mesajları «cavablandı» (iki yaşıl xətt) olur
  if (me.admin) st.push(db.prepare("UPDATE chat_msg SET ack=1, seen=1 WHERE uid=? AND frm='u' AND ack=0").bind(uid));
  const preview = txt ? txt.slice(0, 120) : "📷";
  if (me.admin) {
    st.push(db.prepare("INSERT INTO chat_thread (uid, last_ts, last_txt, last_frm) VALUES (?, ?, ?, 'a') ON CONFLICT(uid) DO UPDATE SET last_ts=excluded.last_ts, last_txt=excluded.last_txt, last_frm='a'").bind(uid, now, preview));
  } else {
    const name = String(body.name || me.name || "").slice(0, 80);
    st.push(db.prepare("INSERT INTO chat_thread (uid, email, name, last_ts, last_txt, last_frm) VALUES (?, ?, ?, ?, ?, 'u') ON CONFLICT(uid) DO UPDATE SET email=excluded.email, name=CASE WHEN excluded.name<>'' THEN excluded.name ELSE chat_thread.name END, last_ts=excluded.last_ts, last_txt=excluded.last_txt, last_frm='u'").bind(uid, me.email, name, now, preview));
  }
  await db.batch(st);

  const ev = { type: "msg", uid, frm };
  ctx.waitUntil(publish(env, ["u:" + uid, "admin"], ev));

  if (me.admin) {
    const b = {};
    ["az", "ru", "tr", "en"].forEach((l) => { b[l] = txt ? txt.slice(0, 300) : PHOTO[l]; });
    ctx.waitUntil(fetch(PUSH_URL + "/send", {
      method: "POST",
      headers: { "Authorization": authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ to: [uid], t: "reply", ti: PUSH_TI, b, o: "chat" })
    }).catch(() => {}));
  } else if (env.TG_TOKEN && env.TG_CHAT) {
    const who = (body.name || me.email || uid);
    ctx.waitUntil(fetch("https://api.telegram.org/bot" + env.TG_TOKEN + "/sendMessage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TG_CHAT, text: "💬 Yeni mesaj — " + who + "\n\n" + (txt || "📷 Şəkil") })
    }).catch(() => {}));
  }
  return J({ ok: true, ts: now });
}

async function cleanup(env) {
  const db = env.DB;
  await init(db);
  const cut = Date.now() - KEEP_MS;
  await db.batch([
    db.prepare("DELETE FROM chat_msg WHERE ts < ?").bind(cut),
    db.prepare("DELETE FROM chat_img WHERE ts < ?").bind(cut),
    db.prepare("DELETE FROM chat_thread WHERE uid NOT IN (SELECT DISTINCT uid FROM chat_msg)"),
    db.prepare("DELETE FROM chat_rate WHERE day < ?").bind(Math.floor(Date.now() / 86400000) - 2)
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
    await init(db);

    // Şəkil: açar təsadüfi və uzundur, ona görə <img> birbaşa yükləyə bilir
    if (path.startsWith("/img/")) {
      const k = path.slice(5);
      if (!/^[0-9a-f]{32}$/.test(k)) return new Response("not found", { status: 404, headers: CORS });
      const r = await db.prepare("SELECT mime, data FROM chat_img WHERE k=?").bind(k).first();
      if (!r) return new Response("not found", { status: 404, headers: CORS });
      return new Response(new Uint8Array(r.data), { headers: Object.assign({ "Content-Type": r.mime, "Cache-Control": "private, max-age=2592000, immutable" }, CORS) });
    }

    if (path === "/ws") {
      if (!env.HUB) return E("no-ws", 501);
      const me = await verify(url.searchParams.get("t"));
      if (!me) return E("auth", 401);
      const stub = env.HUB.get(env.HUB.idFromName("hub"));
      return stub.fetch("https://hub/ws?tag=" + encodeURIComponent(me.admin ? "admin" : "u:" + me.uid), req);
    }

    const authH = req.headers.get("Authorization") || "";
    const me = await verify(authH.replace(/^Bearer\s+/i, ""));
    if (!me) return E("auth", 401);

    if (path === "/cfg" && req.method === "GET") {
      const c = await cfg(db);
      return J({ img: c.img, ws: !!env.HUB, keepDays: 30, admin: me.admin });
    }

    if (path === "/unread" && req.method === "GET") {
      const r = me.admin
        ? await db.prepare("SELECT COUNT(*) n FROM chat_msg WHERE frm='u' AND seen=0").first()
        : await db.prepare("SELECT COUNT(*) n FROM chat_msg WHERE uid=? AND frm='a' AND seen=0").bind(me.uid).first();
      return J({ n: (r && r.n) || 0 });
    }

    if (path === "/thread" && req.method === "GET") {
      const uid = me.admin ? String(url.searchParams.get("uid") || "") : me.uid;
      if (!uid) return E("uid");
      const rs = await db.prepare("SELECT * FROM (SELECT * FROM chat_msg WHERE uid=? ORDER BY id DESC LIMIT 300) ORDER BY id ASC").bind(uid).all();
      const th = await db.prepare("SELECT email, name FROM chat_thread WHERE uid=?").bind(uid).first();
      // Oxundu: istifadəçi admin mesajlarını, admin istifadəçi mesajlarını görür (yaşıl xəttə təsir etmir)
      const upd = me.admin
        ? await db.prepare("UPDATE chat_msg SET seen=1 WHERE uid=? AND frm='u' AND seen=0").bind(uid).run()
        : await db.prepare("UPDATE chat_msg SET seen=1 WHERE uid=? AND frm='a' AND seen=0").bind(uid).run();
      if (upd && upd.meta && upd.meta.changes && me.admin) ctx.waitUntil(publish(env, ["admin"], { type: "seen", uid }));
      return J({ msgs: (rs.results || []).map(rowOut), email: th ? th.email : "", name: th ? th.name : "" });
    }

    if (path === "/send" && req.method === "POST") {
      let body = {};
      try { body = await req.json(); } catch (e) { return E("json"); }
      return sendMsg(env, ctx, me, body, authH);
    }

    if (!me.admin) return E("forbidden", 403);

    if (path === "/admin/threads" && req.method === "GET") {
      const rs = await db.prepare("SELECT t.uid, t.email, t.name, t.last_ts, t.last_txt, t.last_frm, (SELECT COUNT(*) FROM chat_msg m WHERE m.uid=t.uid AND m.frm='u' AND m.seen=0) AS unread FROM chat_thread t ORDER BY t.last_ts DESC LIMIT 300").all();
      return J({ threads: rs.results || [] });
    }

    if (path === "/admin/cfg" && req.method === "POST") {
      let body = {};
      try { body = await req.json(); } catch (e) {}
      await db.prepare("INSERT INTO chat_cfg (k, v) VALUES ('img', ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(body.img ? "1" : "0").run();
      ctx.waitUntil(publish(env, ["admin"], { type: "cfg" }));
      return J({ ok: true, img: !!body.img });
    }

    if (path === "/admin/delete" && req.method === "POST") {
      let body = {};
      try { body = await req.json(); } catch (e) {}
      const uid = String(body.uid || "");
      if (!uid) return E("uid");
      await db.batch([
        db.prepare("DELETE FROM chat_img WHERE uid=?").bind(uid),
        db.prepare("DELETE FROM chat_msg WHERE uid=?").bind(uid),
        db.prepare("DELETE FROM chat_thread WHERE uid=?").bind(uid)
      ]);
      ctx.waitUntil(publish(env, ["u:" + uid, "admin"], { type: "msg", uid }));
      return J({ ok: true });
    }

    if (path === "/admin/cleanup" && req.method === "POST") {
      await cleanup(env);
      return J({ ok: true });
    }

    return E("not-found", 404);
  },

  async scheduled(ev, env, ctx) {
    ctx.waitUntil(cleanup(env));
  }
};
