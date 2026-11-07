# Release-gate — produktionsdeploy af fase 0 (udkast)

> Status: **GENNEMFØRT 2026-11-07.** G0-a + G0-c godkendt samlet (vej A). Merge `f2ef46d` pushet til `origin/master`; produktionsdeployment `a65649ef` aktiv på `pladser.campops.net`; verifikation V1–V7 bestået.
> Formål: hurtigt og kontrolleret at lukke den **åbne proxy** og den **destruktive push**, som kører i produktion i dag, uden at bryde login og læsning.
> ArcGIS er read-only (A9): releasen fjerner al skrivning; ingen test må skrive til ArcGIS.

## 0. Blokerende forudsætninger (før merge og før deploy)

| # | Forudsætning | Hvorfor | Status |
|---|---|---|---|
| F1 | **Produktionens deploy-vej er kendt.** `pladser.campops.net` ligger ikke i den personlige Cloudflare-konto. Er projektet koblet til GitHub (automatisk deploy ved push til `master`), deployes manuelt med wrangler, eller på anden måde? | Hvis Pages er Git-koblet til `origin/master`, **er en merge til master det samme som en produktionsdeploy**. Det er ikke godkendt | ✅ **Afklaret 2026-11-07 (læsning via `campops-cf-deploy`): Git-koblet.** Pages-projekt `camping-space-mapper` (domæner `camping-space-mapper.pages.dev`, `pladser.campops.net`), kilde GitHub `steenh/camping-space-mapper`, production branch `master`, produktionsdeploys slået til, preview-deploys for **alle** branches. Seneste produktionsdeploy `fc5d1c3a` (2026-11-07 11:42 UTC) udløst af `github:push` af `dbf2580`. Ingen miljøvariabler i produktion. **Konsekvens: merge til `origin/master` = produktionsdeploy** |
| F2 | Login-test (vej A) bestået | Krav fra G0 | ✅ Bestået 2026-11-07 (L1–L9, se G0-LOGIN-TEST.md) |
| F3 | Merge-kandidaten = `origin/master` + `fase0/sikring`, uden O1+O2 | Krav fra G0-a | ✅ `f2ef46d` = `dbf2580` + `fase0/sikring`; ingen O1+O2 i `index.html`; `arc-proxy.js` slettet; `index.html`/`functions` identiske med det login-testede `preview/g0`; ingen uventede filer (kun dokumenter, `bench/`, `tests/`, `package*.json`, `.gitignore`) |
| F4 | `npm ci && npm test` og `CSM_NETWORK=1 npm test` grønne på præcis den commit, der deployes | Regression og SRI | ✅ Ren `npm ci`; 28/28 tests inkl. SRI mod CDN på `f2ef46d` |

F1 viser automatisk deploy ved merge. Der er to sikre muligheder:
- Afbryd Git-integrationen midlertidigt (eller sæt production branch til en anden branch), før der merges.
- Behandl G0-a og G0-c som én samlet beslutning.

**Yderligere konsekvens af F1:** Fordi preview-deploys er slået til for alle branches, giver et push af *enhver* branch til GitHub en offentligt tilgængelig preview på `<branch>.camping-space-mapper.pages.dev` (ukendt om den er bag Cloudflare Access). Fase 0-, 0B- og preview-branches må derfor ikke pushes, før det er afklaret.

## 1. Artefakt

| Kontrol | Krav |
|---|---|
| Indhold | Kun `index.html` og `functions/arc-token.js`. **Ingen `functions/arc-proxy.js`** |
| Sporbarhed | Deploy-metadata peger på den mergede commit; sha256 af `index.html` noteres |
| Konfiguration | Ingen miljøvariabler er nødvendige. `ARC_PROXY_ENABLED` findes ikke længere. `ALLOWED_ORIGINS` kun hvis en front-proxy omskriver Host. `ARCGIS_CLIENT_IDS` sættes ikke (standardlisten indeholder det aktive ID) |

## 2. Deploy og verifikation (read-only)

Verifikationen må **ikke** sende skrivekald til ArcGIS. Proxytests bruger mål, der ikke kan skade, og sendes kun *efter* deploy, når proxyen er fjernet.

| # | Efter deploy | Forventet |
|---|---|---|
| V1 | `GET /` | sha256 = artefaktets; titel "Camping Space Mapper" |
| V2 | `POST /arc-proxy?target=https%3A%2F%2Fexample.invalid%2Fx` | 404/405, **ikke** videresendt (proxyen findes ikke) |
| V3 | `POST /arc-token` med ugyldig body / fremmed Origin | 400/403 |
| V4 | UI | Ingen push-knap; "read-only" ved laget og i eksportafsnittet; SRI på alle CDN-filer (ingen konsolfejl) |
| V5 | Login på `pladser.campops.net` | PKCE-login virker med client `2FXbDZ9xhc66sQ0r` |
| V6 | Lag 835 | Lagstatus viser antal features; features vises |
| V7 | Netværkslog under et normalt forløb | 0 skrivekald til ArcGIS |

## 3. Rollback

- **Forward fix foretrækkes.** En rollback til den forrige deployment genindfører den åbne proxy og den destruktive push.
- Bryder login eller læsning efter deploy, så luk hellere appen midlertidigt (fx Cloudflare Access foran produktionen eller en vedligeholdelsesside) end at rulle tilbage.
- Notér deployment-ID før og efter.

## 4. Efter release

1. Fjern det gamle client-ID (`wDfGolINXTr1cgFD`) fra allowlisten i `/arc-token` (lille opfølgende release).
2. Gennemgå produktionens logs/analytics for tidligere kald til `/arc-proxy`. Den har været en åben relay, så eventuelt misbrug bør kendes.
3. Bed Team GIS kontrollere `Hosted/Space_mapping/FeatureServer/0` for uventede sletninger eller ændringer (laget kunne tømmes med ét klik).
4. Push dokumentationen (discovery, rapporter) til det offentlige GitHub-repo først **efter** releasen (G0-verifikation §7).
5. Informér brugerne: push til ArcGIS er fjernet permanent (A9). Output afleveres som GeoJSON til Team GIS.

## 5. Godkendelse

| Port | Beslutning | Dato |
|---|---|---|
| G0-c | Produktionsdeploy | ⏳ Kræver din særskilte godkendelse, når F1–F4 er opfyldt |

## 6. Gennemførelse 2026-11-07

| Trin | Resultat |
|---|---|
| Produktion før | Deployment `fc5d1c3a` (commit `dbf2580`). Viste sig at ligge **bag Cloudflare Access** (campops-teamet) på både `pladser.campops.net` og `camping-space-mapper.pages.dev`: den åbne proxy var kun tilgængelig for Access-brugere |
| Push | `dbf2580..f2ef46d` (fast-forward) til `origin/master` |
| Build/deploy | Deployment `a65649ef`, alle trin `success`; 34 filer uploadet; Functions kompileret; **ingen** `npm install` og ingen `node_modules` |
| V1 | Serveret `index.html` = `f2ef46d` (sha256 normaliseret `af84be07…`) |
| V2 | `POST /arc-proxy` → **405** (funktionen findes ikke) |
| V3 | `POST /arc-token` med password-grant → **400** |
| V4 | Ingen push-funktion eller push-UI; "read-only" ved laget og i eksport; 6/6 CDN-filer med SRI indlæst; read-only-vagt aktiv |
| V5 | Access-login og ArcGIS-PKCE-login virker (client `2FXbDZ9xhc66sQ0r`, token-udveksling via `/arc-token`, `code` fjernet fra URL) |
| V6 | Lag 835: "The layer is empty: it contains 0 features." (korrekt for RF27) |
| V7 | 0 skrivekald til ArcGIS i netværksloggen |

**Opfølgning (åben):**
1. Fjern det gamle client-ID `wDfGolINXTr1cgFD` fra allowlisten i `/arc-token` (næste release).
2. Gennemgå Cloudflare-logs/analytics for historiske kald til `/arc-proxy` (kun Access-brugere kunne nå den).
3. Bed Team GIS kontrollere `Hosted/Space_mapping/FeatureServer/0` for uventede sletninger/ændringer, og om lag 835 skal være anonymt læsbart.
4. Afklar, om preview-deploys (`<branch>.camping-space-mapper.pages.dev`) er dækket af Access, før andre branches pushes.
5. Overvej at slå automatiske produktionsdeploys fra eller kræve godkendelse, så en merge ikke er en deploy.

