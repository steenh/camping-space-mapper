# G0 — login-test (vej A) · protokol og resultat

> Status: **udført 2026-11-07** (ENCORE stoppet af ejeren; to logins). Godkendt: vej A (beslutningslog, G0 anden runde).
> Bundle: `preview/g0` @ `9cabd71` = `fase0/sikring` + client-ID fra `origin/master` (dbf2580). Byggemappe `C:\tmp\csm-deploy` (`dist/index.html` sha256 `70cd22b8…`, `functions/arc-token.js` sha256 `f74aeb4d…`). Samme bundle er deployet til det Access-beskyttede preview (deployment `f19ff961`).
> ArcGIS er read-only (A9): testen udfører kun læsning.

## 1. Port 8788 — hvem bruger den

| Felt | Værdi |
|---|---|
| Lytter | `workerd.exe` pid 7036 på `127.0.0.1:8788` (vises ikke af `netstat`'s LISTEN-filter, men af `Get-NetTCPConnection`) |
| Projekt | ENCORE — `E:\encore-dev` (Cloudflare Workers, `wrangler dev`) |
| Startet | 2026-11-07 kl. 08:24 |
| Kommando | `npx wrangler dev --test-scheduled --port 8788 --ip 127.0.0.1 --var ENCORE_MODE:shadow --var DEV_NO_ACCESS:1` |
| Procestræ | bash 53716 → bash 5476 → node 21676 (npx) → cmd 53808 → node 52468 (wrangler) → node 21016 (wrangler cli) → workerd 7036 |
| Forælder | pid 23592 findes ikke længere: træet er forældreløst (intet terminalvindue at trykke Ctrl+C i) |
| Lokal tilstand | `E:\encore-dev\.wrangler\state\v3` (lokale D1/KV/R2-data) |

## 2. Sikker frigivelse og genstart af ENCORE (udføres af dig)

1. *(Anbefalet)* Tag en kopi af den lokale tilstand, hvis ENCORE-dataene betyder noget:
   `Copy-Item E:\encore-dev\.wrangler\state E:\encore-dev\.wrangler\state.backup-20261107 -Recurse`
2. Stop hele træet fra roden (wrangler stopper selv workerd):
   `taskkill /PID 53716 /T /F`
   Kontrollér, at porten er fri: `curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:8788/` skal fejle (000).
3. Efter login-testen genstartes ENCORE med præcis samme kommando:
   `cd E:\encore-dev` → `npx wrangler dev --test-scheduled --port 8788 --ip 127.0.0.1 --var ENCORE_MODE:shadow --var DEV_NO_ACCESS:1`
   Kontrollér: `http://127.0.0.1:8788/` viser titlen "ENCORE — Before the Final Bow".

`--test-scheduled` kører ikke cron-triggere automatisk (den åbner kun et manuelt endpoint), så et stop afbryder ikke planlagte jobs. Den lokale tilstand bevares, fordi `wrangler dev` gemmer den på disk.

## 3. Testforløb (når porten er fri)

1. Jeg starter bundlet: `npx wrangler pages dev dist --port 8788 --ip 127.0.0.1` i `C:\tmp\csm-deploy`.
2. Jeg åbner en **synlig** browserfane i Nimbalyst på `http://localhost:8788/`. Brug `localhost`, ikke `127.0.0.1`, fordi redirect-URI'en er registreret som `http://localhost:8788/`.
3. **Du** klikker "Login to ArcGIS" og logger ind i portalen. Ingen adgangskoder går gennem mig eller chatten.
4. Jeg kører de scriptede kontroller i samme fane (tabel nedenfor) og logger netværkskald.
5. Jeg stopper bundlet, og du genstarter ENCORE (§2.3).

| # | Kontrol | Forventet |
|---|---|---|
| L1 | PKCE-login | Redirect tilbage med `code` + `state`; `state` matcher; token udstedes via `/arc-token`; `code` fjernes fra URL'en |
| L2 | Token-håndtering | Token kun i `sessionStorage` + hukommelse; udløbstid sat; timer planlagt |
| L3 | Lag 835 indlæses | Lagstatus "N features in the layer"; features vises på kortet |
| L4 | Valg og zone | Box select → "Create polygon from selection" → zone oprettes |
| L5 | Calculate, Optimize, eksport | Virker på den rigtige zone; GeoJSON genereres |
| L6 | Ingen skrivning | Netværksloggen indeholder 0 kald til `addFeatures`/`updateFeatures`/`deleteFeatures`/`applyEdits`; direkte skriveforsøg fra siden blokeres (fetch/XHR/sendBeacon/esri) |
| L7 | Tokenudløb | Udløbstid sat i fortiden + genindlæsning → login vises med "session has expired" |
| L8 | Afvist token | Tokenet ugyldiggøres (log ud i portalen eller manipuleret token) → "Not authorized (498/499)" og login vises; ingen tom, lydløs visning |
| L9 | Oprydning | Log ud; `sessionStorage` tømmes |

## 4. Resultat

Bundlet blev serveret uændret (indhold identisk med `preview/g0`; kun linjeskift adskiller `git archive`-filerne fra git-blobben). Testen kørte i din synlige Nimbalyst-fane efter dit login.

| # | Kontrol | Resultat | Evidens |
|---|---|---|---|
| L1 | PKCE-login | ✅ | Serverlog: `POST /arc-token 200`; `code`/`state` fjernet fra URL'en; verifier og state ryddet fra `sessionStorage` |
| L2 | Token-håndtering | ✅ | Token kun i `sessionStorage` og hukommelse (ikke `localStorage` eller cookie); udløb ≈ 30 min; udløbstimer aktiv |
| L3 | Lag 835 indlæses | ✅ | Lagstatus: "The layer is empty: it contains 0 features." Korrekt: RF27 er ikke tegnet endnu (count 0 og tomt extent med gyldigt token; ingen definition query; capabilities `Query`). Før KB-02-rettelsen ville det have været en lydløs tom visning |
| L4 | Valg og zone fra features | ⏭ Ikke mulig | Laget har ingen features i RF27 |
| L5 | Calculate, Optimize, eksport | ✅ | Testzone: 765 → 810 pladser; eksport 810 features |
| L6 | Ingen skrivning | ✅ | Med rigtigt token blev 6 af 6 skriveforsøg blokeret (fetch addFeatures, fetch applyEdits, XHR deleteFeatures, sendBeacon updateFeatures, esri addFeature, esri deleteFeature). 0 skrivekald i netværksloggen; `POST /arc-proxy` → 405 |
| L7 | Tokenudløb | ✅ | Udløb sat til +3 s: sessionen sluttede efter 3,0 s med "Your ArcGIS session has expired. Log in again."; token slettet; layout bevaret |
| L8 | Afvist token | 🟡 Delvist | Med et manipuleret rigtigt token blev resultatet ikke entydigt: fanen blev lukket/genindlæst under testen, og en genindlæsning henter det gyldige token fra `sessionStorage`. Verificeret i stedet: ArcGIS svarer 498 på ugyldige tokens (count og metadata), og appen viser "Not authorized (498)" og login ved 498 (verificeret i Cloudflare-runtime med samme kode) |
| L9 | Oprydning | ✅ | Fanen er lukket (`sessionStorage` forsvinder med fanen); testserveren på 8788 er stoppet; ENCORE-mappen er uberørt |

**Nyt fund (til Team GIS):** Lag 835 ("GAT") er anonymt læsbart: metadata og `query` virker uden token. Laget er tomt nu, men når RF27-felterne tegnes, vil de sandsynligvis være offentligt tilgængelige, selvom appen kræver login. Det er en rettighedsindstilling i ArcGIS, ikke i appen.
