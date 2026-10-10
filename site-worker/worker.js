// ProTechtor™ — protechtor.app saytı (Cloudflare Workers + statik fayllar)
// /apk/version.json və /apk/ProTechtor.apk istifadəçiyə protechtor.app ünvanından verilir.
const APK_REPO = "Eminlist/protechtor-apk";
const VERSION_SRC = "https://raw.githubusercontent.com/" + APK_REPO + "/main/version.json";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www.protechtor.app") {
      url.hostname = "protechtor.app";
      return Response.redirect(url.toString(), 301);
    }

    // Köhnə ünvanlar → yeni səhifələr
    const MOVED = { "/application/android": "/application/guide", "/register": "/account/register", "/login": "/account/login" };
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
    if (url.pathname === "/" || url.pathname.endsWith(".html") || url.pathname === "/sw.js") {
      const h = new Headers(res.headers);
      h.set("cache-control", "no-cache");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
    }
    return res;
  }
};
