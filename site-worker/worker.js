// ProTechtor™ — protechtor.app saytı (Cloudflare Workers + statik fayllar)
// /apk/version.json və /apk/ProTechtor.apk istifadəçiyə protechtor.app ünvanından verilir.
const APK_REPO = "Eminlist/protechtor-apk";
const VERSION_SRC = "https://raw.githubusercontent.com/" + APK_REPO + "/main/version.json";
// Proqramın (veb tətbiqin) ünvanı. Dəyişsə: pages/texts/common.json → appUrl və APK site_url da dəyişməlidir.
const APP = "/application/eminapp/";
const API_ORIGIN = "https://protector-api.o553115544.workers.dev";
const CATALOG_TTL = 60; // saniyə — /catalog kənarda (Cloudflare) bu qədər saxlanılır
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "Authorization,Content-Type",
  "access-control-max-age": "86400"
};

// Kök ünvanındakı köhnə Service Worker-i (proqram əvvəl "/" ünvanında idi) özünü silir
const KILL_SW = "self.addEventListener('install',function(){self.skipWaiting()});" +
  "self.addEventListener('activate',function(e){e.waitUntil(self.registration.unregister())});";

// Reklam/izləmə parametrləri ana səhifədə qalır, digər parametrlər (köhnə proqram linkləri) proqrama yönləndirilir
function appParams(sp) {
  for (const k of sp.keys()) if (!/^(utm_\w+|fbclid|gclid|yclid|ref)$/i.test(k)) return true;
  return false;
}

// /api/catalog — istifadəçi kataloqu, Cloudflare keşi ilə (D1 oxunuşlarını azaldır)
async function catalog(request, env, ctx, url) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const cache = caches.default;
  const key = new Request("https://protechtor.app/__cache/catalog");
  let full = null;
  const hit = await cache.match(key);
  if (hit) { try { full = await hit.json(); } catch (e) { full = null; } }
  if (!full) {
    const init = { headers: { "Authorization": request.headers.get("Authorization") || "" } };
    let r;
    try {
      r = env.API ? await env.API.fetch(new Request(API_ORIGIN + "/catalog", init)) : await fetch(API_ORIGIN + "/catalog", init);
    } catch (e) { r = null; }
    if (!r || !r.ok) return new Response(JSON.stringify({ error: "upstream" }), { status: 502, headers: Object.assign({ "content-type": "application/json" }, CORS) });
    try { full = await r.json(); } catch (e) { full = null; }
    if (!full || !Array.isArray(full.names)) return new Response(JSON.stringify({ error: "upstream" }), { status: 502, headers: Object.assign({ "content-type": "application/json" }, CORS) });
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(full), { headers: { "content-type": "application/json", "cache-control": "public, max-age=" + CATALOG_TTL } })));
  }
  const ver = url.searchParams.get("ver");
  const out = ver && String(full.ver) === ver ? { same: true, ver: full.ver } : full;
  return new Response(JSON.stringify(out), { headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-pt-cache": hit ? "HIT" : "MISS" }, CORS) });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.hostname === "www.protechtor.app") {
      url.hostname = "protechtor.app";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/catalog") return catalog(request, env, ctx, url);

    // Proqram: /application/eminapp → /application/eminapp/
    if (url.pathname === "/application/eminapp" || url.pathname === "/index.html") {
      return Response.redirect("https://protechtor.app" + APP + url.search, 301);
    }
    if (url.pathname === "/") {
      // Android proqramı (APK) köhnə ünvanı ("/") açırsa və ya köhnə proqram linki (?m=...) — proqrama
      const ua = request.headers.get("user-agent") || "";
      if (/ProTechtorApp/.test(ua) || appParams(url.searchParams)) {
        return Response.redirect("https://protechtor.app" + APP + url.search, 302);
      }
    }
    if (url.pathname === "/sw.js") {
      return new Response(KILL_SW, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });
    }

    // Köhnə ünvanlar → yeni səhifələr
    const MOVED = { "/application/android": "/application/guide", "/register": "/account/register", "/login": "/account/login", "/preview/home": "/" };
    const moved = MOVED[url.pathname.replace(/\.html$/, "").replace(/\/$/, "")];
    if (moved) return Response.redirect("https://protechtor.app" + moved + url.search + url.hash, 301);

    if (url.pathname === "/apk/version.json") {
      const r = await fetch(VERSION_SRC + "?t=" + Date.now(), { cf: { cacheTtl: 0 } });
      if (!r.ok) return new Response("{}", { status: 502, headers: { "content-type": "application/json" } });
      const j = await r.json();
      const m = String(j.url || "").match(/\/releases\/download\/([^/]+)\//);
      j.url = "https://protechtor.app/apk/ProTechtor.apk" + (m ? "?v=" + encodeURIComponent(m[1]) : "");
      return new Response(JSON.stringify(j), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" }
      });
    }

    if (url.pathname === "/apk/ProTechtor.apk" || url.pathname === "/apk") {
      const v = url.searchParams.get("v");
      const src = v && /^[\w.\-]+$/.test(v)
        ? "https://github.com/" + APK_REPO + "/releases/download/" + v + "/ProTechtor.apk"
        : "https://github.com/" + APK_REPO + "/releases/latest/download/ProTechtor.apk";
      const r = await fetch(src, { redirect: "follow" });
      if (!r.ok) return new Response("APK tapılmadı", { status: 502 });
      const h = new Headers();
      h.set("content-type", "application/vnd.android.package-archive");
      h.set("content-disposition", 'attachment; filename="ProTechtor.apk"');
      const len = r.headers.get("content-length");
      if (len) h.set("content-length", len);
      h.set("cache-control", v ? "public, max-age=31536000, immutable" : "no-store");
      return new Response(r.body, { headers: h });
    }

    const res = await env.ASSETS.fetch(request);
    if (url.pathname.startsWith("/texts/") && url.pathname.endsWith(".json")) {
      const h = new Headers(res.headers);
      h.set("access-control-allow-origin", "*");
      h.set("cache-control", "no-cache");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
    }
    if (url.pathname.endsWith("/") || url.pathname.endsWith(".html") || url.pathname.endsWith("/sw.js") || url.pathname.endsWith("/manifest.json")) {
      const h = new Headers(res.headers);
      h.set("cache-control", "no-cache");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
    }
    return res;
  }
};
