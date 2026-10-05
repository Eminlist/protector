/* ProTechtor™ Service Worker
   HTML həmişə əvvəlcə internetdən götürülür (yeni versiya dərhal görünür),
   internet olmadıqda keşdəki nüsxə açılır. */
const CACHE = "protechtor-v3.4.0";
const CORE = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", function (e) {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE).then(function (c) {
            return Promise.all(CORE.map(function (u) {
                return c.add(new Request(u, { cache: "reload" })).catch(function () {});
            }));
        })
    );
});

self.addEventListener("activate", function (e) {
    e.waitUntil((async function () {
        const keys = await caches.keys();
        const old = keys.filter(function (k) { return k !== CACHE; });
        await Promise.all(old.map(function (k) { return caches.delete(k); }));
        await self.clients.claim();
        // Köhnə versiya açıq qalıbsa — səhifəni yeni versiya ilə yenidən aç
        if (old.length) {
            const list = await self.clients.matchAll({ type: "window" });
            list.forEach(function (c) { try { c.navigate(c.url); } catch (_) {} });
        }
    })());
});

self.addEventListener("message", function (e) {
    if (e.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
    if (url.origin === self.location.origin) return true;
    if (/(^|\.)gstatic\.com$/.test(url.hostname) && url.pathname.indexOf("/firebasejs/") === 0) return true;
    if (url.hostname === "flagcdn.com") return true;
    if (url.hostname === "raw.githubusercontent.com" && /\.(png|jpg|jpeg|svg|webp)$/i.test(url.pathname)) return true;
    return false;
}

self.addEventListener("fetch", function (e) {
    const req = e.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);

    // Səhifə (HTML): əvvəl internet, sonra keş
    if (req.mode === "navigate" || (url.origin === self.location.origin && /(\.html|\/)$/.test(url.pathname))) {
        e.respondWith(
            fetch(req, { cache: "no-store" }).then(function (res) {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
                }
                return res;
            }).catch(function () {
                return caches.match("./index.html").then(function (r) { return r || caches.match("./"); });
            })
        );
        return;
    }

    // Firebase/Firestore sorğuları və digər xarici sorğular keşlənmir
    if (!isStaticAsset(url) || url.search) return;

    // Statik fayllar: keşdən dərhal ver, arxada yenilə
    e.respondWith(
        caches.match(req).then(function (cached) {
            const net = fetch(req).then(function (res) {
                if (res && (res.ok || res.type === "opaque")) {
                    const copy = res.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, copy); });
                }
                return res;
            }).catch(function () { return cached; });
            return cached || net;
        })
    );
});
