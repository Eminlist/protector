# Sayt səhifələri — xəritə

Mətnləri dəyişmək üçün **yalnız `texts/*.json`** faylını redaktə edin (hər faylda `az`, `ru`, `tr`, `en`).
Menyu və alt hissə (footer) bütün səhifələr üçün bir yerdədir: `texts/common.json → menu`.
Proqramın ünvanı (Qeydiyyat / Giriş düymələri): `texts/common.json → _ → appUrl`.

| Ünvan | HTML faylı | Mətn faylı |
|---|---|---|
| / — Ana səhifə (reklam) | index.html | texts/home.json |
| /application/eminapp/ — Proqram (veb tətbiq) | kökdəki index.html (build zamanı köçürülür) | — |
| /account/register — Qeydiyyat | account/register.html | texts/register.json |
| /account/login — Giriş | account/login.html | texts/login.json |
| /application — Proqram haqqında | application.html | texts/about.json |
| /application/features — Proqram üstünlükləri | application/features.html | texts/features.json |
| /application/guide — İstifadə təlimatları | application/guide.html | texts/guide.json |
| /application/install — Quraşdırma təlimatı | application/install.html | texts/install.json |
| /application/download — Proqram yüklə | application/download.html | texts/download.json |
| /privacy — Məxfilik siyasəti | privacy.html | texts/privacy.json |
| /help — Yardım mərkəzi | help.html | texts/help.json → hub, tiles, pop |
| /help/colors — Rənglər nəyi bildirir | help/colors.html | texts/help.json → topics.colors |
| /help/where — Harada nə var | help/where.html | texts/help.json → topics.where |
| /help/notifications — Bildirişlər | help/notifications.html | texts/help.json → topics.notifications |
| /help/account — Hesab və Premium | help/account.html | texts/help.json → topics.account |
| /help/troubleshooting — Problemlərin həlli | help/troubleshooting.html | texts/help.json → topics.troubleshooting |
| /contact — Əlaqə | contact.html | texts/contact.json |
| /help/app — proqram üçün tək fayl | avtomatik qurulur: tools/build-help-app.mjs | help + guide + install + contact |

Şəkillər: `assets/phones/*.svg` (telefonlar), ikonlar `assets/site.js → ICONS`.
Rəng nişanları mətndə: `{dot:green}`, `{bar:yellow}`, `{tick:1}`, `{tick:2}` (rənglər: green, yellow, red, gray, blue, gold, orange).
Köhnə ünvan yönləndirmələri: `site-worker/worker.js → MOVED`.
