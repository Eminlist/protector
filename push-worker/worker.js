// ProTechtor™ — protector-push (push bildirişləri, FCM HTTP v1)
// Mənbə: Eminlist/protector push-worker/worker.js — GitHub Actions (push-worker.yml) avtomatik yerləşdirir.
//
// Bağlantılar (Worker → Settings → Bindings / Variables and Secrets):
//   DB        — D1 bazası: protector-db
//   FCM_SA    — Secret: Firebase service account JSON faylının BÜTÜN məzmunu
//   PUSH_KEY  — Secret: istənilən uzun təsadüfi söz (GitHub-dakı PUSH_KEY ilə eyni)
//
// Yollar:
//   POST /register    { token, lang }      — Authorization: Bearer <Firebase ID token>
//   POST /unregister  { token }            — Authorization: Bearer <Firebase ID token>
//   POST /send        { to, t, ti, b, o }  — yalnız admin (ID token) və ya X-Push-Key
//        to: "all" | ["uid1", "uid2"]
//        t:  news | models | reply | bulk | premium | general | update | warn | vip
//        ti: { az, ru, tr, en } başlıq     b: { az, ru, tr, en } mətn     o: notif | profile | update

const PROJECT = "protechtor-99407";
const ADMIN_EMAIL = "o553115544@gmail.com";
const ORIGINS = ["https://protechtor.app", "https://www.protechtor.app", "https://m.protechtor.app", "https://eminlist.github.io"];
const TYPES = ["news", "models", "reply", "bulk", "premium", "general", "update", "warn", "vip"];
const LANGS = ["az", "ru", "tr", "en"];
const MAX_TOKENS_PER_USER = 5;

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Push-Key",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const json = (o, status = 200) =>
      new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      const url = new URL(req.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      if (path === "/" && req.method === "GET") return json({ ok: true, service: "protector-push" });
      if (req.method !== "POST") return json({ error: "not-found" }, 404);

      await ensureTable(env);
      const body = await req.json().catch(() => ({}));

      if (path === "/register") {
        const user = await authUser(req);
        const token = cleanToken(body.token);
        const lang = LANGS.includes(body.lang) ? body.lang : "az";
        await env.DB.prepare(
          "INSERT INTO push_tokens (token, uid, lang, at) VALUES (?1, ?2, ?3, ?4) " +
          "ON CONFLICT(token) DO UPDATE SET uid = ?2, lang = ?3, at = ?4"
        ).bind(token, user.sub, lang, Date.now()).run();
        await env.DB.prepare(
          "DELETE FROM push_tokens WHERE uid = ?1 AND token NOT IN " +
          "(SELECT token FROM push_tokens WHERE uid = ?1 ORDER BY at DESC LIMIT ?2)"
        ).bind(user.sub, MAX_TOKENS_PER_USER).run();
        return json({ ok: true });
      }

      if (path === "/unregister") {
        const user = await authUser(req);
        const token = cleanToken(body.token);
        await env.DB.prepare("DELETE FROM push_tokens WHERE token = ?1 AND uid = ?2").bind(token, user.sub).run();
        return json({ ok: true });
      }

      if (path === "/send") {
        await authAdmin(req, env);
        const t = TYPES.includes(body.t) ? body.t : "general";
        const data = { t, o: String(body.o || "notif").replace(/[^a-z]/g, "").slice(0, 20) };
        for (const l of LANGS) {
          const ti = pickText(body.ti, l, 120);
          const b = pickText(body.b, l, 1000);
          if (ti) data["ti_" + l] = ti;
          if (b) data["b_" + l] = b;
        }
        if (!data.b_az) return json({ error: "empty-text" }, 400);

        if (body.to === "all") {
          const r = await sendFcm(env, { topic: "all" }, data);
          if (!r.ok) return json({ error: "fcm", detail: r.detail }, 502);
          return json({ ok: true, sent: "topic" });
        }

        const uids = (Array.isArray(body.to) ? body.to : [body.to])
          .map((x) => String(x || "").trim()).filter(Boolean).slice(0, 200);
        if (!uids.length) return json({ error: "no-target" }, 400);
        const rows = [];
        for (let i = 0; i < uids.length; i += 50) {
          const part = uids.slice(i, i + 50);
          const q = "SELECT token FROM push_tokens WHERE uid IN (" + part.map((_, k) => "?" + (k + 1)).join(",") + ")";
          const res = await env.DB.prepare(q).bind(...part).all();
          rows.push(...(res.results || []));
        }
        let sent = 0, failed = 0;
        const gone = [];
        await Promise.all(rows.map(async (row) => {
          const r = await sendFcm(env, { token: row.token }, data);
          if (r.ok) sent++;
          else {
            failed++;
            if (r.gone) gone.push(row.token);
          }
        }));
        for (const tk of gone) {
          await env.DB.prepare("DELETE FROM push_tokens WHERE token = ?1").bind(tk).run();
        }
        return json({ ok: true, sent, failed, devices: rows.length });
      }

      return json({ error: "not-found" }, 404);
    } catch (e) {
      return json({ error: e.code || "server", message: String(e.message || e) }, e.status || 500);
    }
  },
};

// ---------- köməkçilər ----------

function httpError(status, code) {
  const e = new Error(code);
  e.status = status;
  e.code = code;
  return e;
}

function cleanToken(t) {
  t = String(t || "").trim();
  if (t.length < 20 || t.length > 4096 || /[^A-Za-z0-9_\-:.]/.test(t)) throw httpError(400, "bad-token");
  return t;
}

function pickText(o, l, max) {
  if (typeof o === "string") return l === "az" ? o.slice(0, max) : "";
  if (!o || typeof o !== "object") return "";
  return String(o[l] || "").trim().slice(0, max);
}

let tableReady = false;
async function ensureTable(env) {
  if (tableReady) return;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS push_tokens (token TEXT PRIMARY KEY, uid TEXT NOT NULL, lang TEXT, at INTEGER)"
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS push_tokens_uid ON push_tokens (uid)").run();
  tableReady = true;
}

// ---------- Firebase ID token yoxlaması ----------

let jwks = null;
let jwksExp = 0;

async function googleKeys() {
  if (jwks && Date.now() < jwksExp) return jwks;
  const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  const j = await r.json();
  const m = (r.headers.get("cache-control") || "").match(/max-age=(\d+)/);
  jwksExp = Date.now() + (m ? +m[1] : 3600) * 1000;
  jwks = j.keys || [];
  return jwks;
}

function b64urlBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

function bytesB64url(u) {
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function strB64url(s) {
  return bytesB64url(new TextEncoder().encode(s));
}

async function verifyIdToken(tok) {
  const parts = String(tok || "").split(".");
  if (parts.length !== 3) throw httpError(401, "unauthenticated");
  const dec = (p) => JSON.parse(new TextDecoder().decode(b64urlBytes(p)));
  let header, payload;
  try { header = dec(parts[0]); payload = dec(parts[1]); } catch (e) { throw httpError(401, "unauthenticated"); }
  if (header.alg !== "RS256") throw httpError(401, "unauthenticated");
  let jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) { jwksExp = 0; jwk = (await googleKeys()).find((k) => k.kid === header.kid); }
  if (!jwk) throw httpError(401, "unauthenticated");
  const key = await crypto.subtle.importKey(
    "jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  const now = Math.floor(Date.now() / 1000);
  if (!ok || payload.aud !== PROJECT || payload.iss !== "https://securetoken.google.com/" + PROJECT ||
      !payload.sub || payload.exp < now || payload.iat > now + 300) {
    throw httpError(401, "unauthenticated");
  }
  return payload;
}

async function authUser(req) {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) throw httpError(401, "unauthenticated");
  const p = await verifyIdToken(h.slice(7));
  if (p.firebase && p.firebase.sign_in_provider === "anonymous") throw httpError(403, "anonymous");
  return p;
}

async function authAdmin(req, env) {
  const key = req.headers.get("X-Push-Key") || "";
  if (key && env.PUSH_KEY && key.length === env.PUSH_KEY.length) {
    let diff = 0;
    for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ env.PUSH_KEY.charCodeAt(i);
    if (diff === 0) return { admin: true };
  }
  const p = await authUser(req);
  if (String(p.email || "").toLowerCase() !== ADMIN_EMAIL || p.email_verified !== true) {
    throw httpError(403, "forbidden");
  }
  return p;
}

// ---------- FCM ----------

let gToken = null;
let gExp = 0;

async function googleAccessToken(env) {
  if (gToken && Date.now() < gExp) return gToken;
  if (!env.FCM_SA) throw httpError(500, "no-fcm-sa");
  const sa = JSON.parse(env.FCM_SA);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = strB64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + strB64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = b64urlBytes(pem.replace(/\+/g, "-").replace(/\//g, "_"));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") +
      "&assertion=" + unsigned + "." + bytesB64url(sig),
  });
  const j = await r.json();
  if (!j.access_token) throw httpError(502, "google-auth: " + (j.error_description || j.error || r.status));
  gToken = j.access_token;
  gExp = Date.now() + ((j.expires_in || 3600) - 120) * 1000;
  return gToken;
}

async function sendFcm(env, target, data) {
  const at = await googleAccessToken(env);
  const r = await fetch("https://fcm.googleapis.com/v1/projects/" + PROJECT + "/messages:send", {
    method: "POST",
    headers: { "Authorization": "Bearer " + at, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: { ...target, data, android: { priority: "HIGH", ttl: "172800s" } },
    }),
  });
  if (r.ok) return { ok: true };
  const txt = await r.text();
  const gone = r.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(txt);
  return { ok: false, gone, detail: txt.slice(0, 300) };
}
