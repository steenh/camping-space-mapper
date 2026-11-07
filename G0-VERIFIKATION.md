# G0-verifikation

> Dato: 2026-11-07 · Grundlag: [Fase 0-rapport](FASE-0-RAPPORT.md), G0-beslutninger i [Beslutningslog](DECISION-LOG.md)
> Kode: `fase0/sikring` @ `c3ce7d7` · Preview: `preview/g0` @ `240a31e` (= `fase0/sikring` + `fase0/f5a2-arcgis-client-id`)
> Intet er merget til `master`, intet er deployet til produktion, og intet er skrevet til ArcGIS.

## 1. Kriterier

| # | Krav (G0) | Status | Evidens |
|---|---|---|---|
| 1 | Selvstændig diff-review af fase 0 mod master, inkl. sikkerhed | ✅ Bestået | Hele diffen gennemlæst (§3). Supplerer den tidligere uafhængige review. Ingen blokerende fund |
| 2 | Serverens adgangskontrol bygger ikke alene på Origin/CORS | ✅ Bestået | §4: Access foran preview; proxyen lukket via serverkonfiguration (verificeret via API: ingen miljøvariabler); token-udveksling afgrænset af PKCE og grant-/client-allowlist; forfalsket Origin fra en ikke-browser giver stadig 403/400 |
| 3a | Isoleret, beskyttet testmiljø uden skriveadgang til ArcGIS | ✅ Bestået | Separat Pages-projekt `csm-preview-g0` i den personlige Cloudflare-konto (ikke produktionskontoen); Cloudflare Access kun for din e-mail på alle URL'er inkl. funktioner; `/arc-proxy` lukket |
| 3b | Calculate, Optimize, eksport | ✅ Bestået | Kørt i Cloudflares runtime (`wrangler pages dev`) med det byte-identiske deploy-bundle: 2.227 → 2.410 pladser, eksport 2.410 features |
| 3c | Dokumenteret blokering af alle skriveoperationer | ✅ Bestået | Push: 0 netværkskald, også med et "logget ind"-token. Proxy: add/delete/applyEdits giver 403 med og uden Origin; ingen udgående kald i runtime-loggen. Ingen andre skrivestier i koden (`grep` efter applyEdits/addFeature/updateFeature/deleteFeature) |
| 3d | Tokenudløb | 🟡 Delvist | Simuleret: udløbet token i sessionen → login vises, ingen kald. Token, som ArcGIS afviser → **lydløs tom visning** (nyt fund KB-02). Ikke testet med et rigtigt token, der udløber |
| 3e | ArcGIS PKCE-login og indlæsning af features | ❌ **Ikke udført** | Kræver dit interaktive login. Preview-URL'en er heller ikke registreret som redirect-URI for client `2FXbDZ9xhc66sQ0r` (kun `https://pladser.campops.net/` og `http://localhost:8788/`). Se §6 |
| 4 | Forholdet til `fase0/f5a2-arcgis-client-id` afklaret før deploy | ✅ Bestået | §5 |
| 5 | Kendt geometribegrænsning registreret og må ikke give ukritisk godkendelse | ✅ Bestået | [KENDTE-BEGRÆNSNINGER.md](KENDTE-BEGRÆNSNINGER.md) KB-01 med regel; rød advarsel i appen pr. zone og i statuslinjen; test (commit `c3ce7d7`) |
| 6 | O1+O2 benchmarket mod oprindelig algoritme (kapacitet, gyldighed, performance) | ✅ Bestået (måling) | Branch `fase0b/soegning`, [FASE-0B-RAPPORT](https://github.com/steenh/camping-space-mapper/blob/fase0b/soegning/FASE-0B-RAPPORT.md) (lokal branch): 0/28 dårligere, median +4,7 %, 28/28 gyldige. Men dens eget tidskriterium (0B.3) er ikke opfyldt i browser |
| 7 | Benchmark og fixtures reproducerbare og uden følsomme data | ✅ Bestået | Golden 240/240; `latest.json` og `fase0b-compare.json` byte-identiske over to kørsler; discovery 96/96; fixtures syntetiske; scanning i §7 |
| 8 | Fase 0 og O1+O2 ikke i samme merge | ✅ Bestået | Separate branches; `fase0b/soegning` må kun merges efter `fase0/sikring` som separat merge (står i branchens rapport og commit-besked) |
| — | Offentligt repository | 🟡 Betinget | §7: ingen hemmeligheder eller persondata; men dokumenterne beskriver udnyttelige svagheder i den kørende produktion |

## 2. Ændringer siden fase 0-rapporten

| Hvad | Hvor |
|---|---|
| KB-01-advarsel i appen (`overlapUnusedM2`, advarsel i arealisten og statuslinjen), register over kendte begrænsninger (KB-01..08), test | `fase0/sikring` commit `c3ce7d7` |
| Denne rapport og G0-beslutninger i beslutningsloggen | `fase0/sikring` |
| Integrationsbranch `preview/g0` (fase 0 + f5a2), kun til preview | Lokal branch, ikke merget |
| Fase 0B (O1+O2) | Lokal branch `fase0b/soegning` |
| Cloudflare: Pages-projekt `csm-preview-g0` og Access-app "csm-preview-g0" (owner-only, 8 t session) | Personlig Cloudflare-konto, uden for repo |

Ingen ændringer i sikkerhedskoden (`functions/`) siden fase 0-rapporten.

## 3. Diff-review (resumé)

Gennemgået: hele `git diff master..fase0/sikring` for `index.html` og `functions/`.

- **Placering:** Sweep-koden er uændret linje for linje; nye early returns kun for ugyldige input. Golden-test bekræfter 240/240.
- **Overlap og huller:** Korrekt for normale tilfælde; KB-01 er den kendte, konservative undtagelse.
- **Push:** `const`-flag + guard som første sætning; UI skjult; ingen andre skrivestier.
- **Proxy og token:** Validerer normaliseret URL og fetcher den samme; ingen CORS; `redirect: 'manual'`; ingen logning af tokens.
- **XSS:** Brugerdata i `innerHTML` escapes; status via `textContent`.
- **SRI:** 6/6 filer verificeret mod CDN.

Ingen nye blokerende fund. Små observationer:
- Analyse kan foreslå mål over 50 m, som dialogen så afviser med en forklaring. Det er acceptabelt.
- `darkenHex` beregner tal og er derfor sikker.

## 4. Adgangskontrol: lag for lag (krav 2)

| Lag | Mekanisme | Afhænger af Origin? | Verificeret |
|---|---|---|---|
| Preview: hele sitet inkl. funktioner | Cloudflare Access, kun `steenhan@gmail.com`, alle URL'er (`csm-preview-g0.pages.dev` og `*.`) | Nej | Uautentificeret GET/POST på 5 URL'er → 302 til Access-login |
| `/arc-proxy` | Lukket via serverkonfiguration (`ARC_PROXY_ENABLED` ikke sat) | Nej | API: preview-projektet har 0 miljøvariabler; runtime: 403 med samme, forfalsket og manglende Origin |
| `/arc-token` | Kun `authorization_code` med kendt client-ID; koden kan kun indløses med den PKCE-verifier, som kun browseren har | Delvist (Origin er ekstra) | Forfalsket Origin fra curl: password/client_credentials/ukendt client → 400 |
| ArcGIS | Brugerens egne rettigheder (token) | Nej | Uden for appens kontrol (KB-03) |

**Restrisiko:** Origin kan forfalskes af ikke-browser-klienter. Hvis `/arc-proxy` en dag åbnes igen, skal den derfor kræve et valideret Access-JWT (`Cf-Access-Jwt-Assertion`, signatur og `aud`) og ikke kun Origin. Det er tilføjet som krav til sikker publicering (fase 5).

## 5. Forholdet til `fase0/f5a2-arcgis-client-id` (krav 4)

- **Indhold:** Én linje: `ARCGIS_CLIENT_ID` skiftes fra `wDfGolINXTr1cgFD` (ifølge commit-beskeden en QGIS-desktop-app uden redirect til `pladser.campops.net`) til `2FXbDZ9xhc66sQ0r` (registrerede redirects: `https://pladser.campops.net/`, `http://localhost:8788/`).
- **Konflikter:** Ingen. `git merge-tree` er rent; de to branches rører forskellige linjer.
- **Kompatibilitet:** `/arc-token` tillader begge ID'er, og en test sikrer, at ID'et i `index.html` altid er tilladt.
- **Preview:** Bygget fra `preview/g0` = `fase0/sikring` + f5a2, fordi login med det gamle ID ikke kan virke. `preview/g0` merges aldrig til master.
- **Konsekvens for master:** Ifølge f5a2's commit-besked giver login på produktionen i dag "Invalid redirect_uri". Det er uafhængigt af fase 0. f5a2 skal merges (separat eller før/sammen med fase 0) for at login virker på `pladser.campops.net`. Efter merge bør det gamle ID fjernes fra allowlisten.

## 6. Login-test (krav 3e): hvad der mangler, og to veje

Testen kræver, at du logger ind. Ingen af vejene kræver skrivning til ArcGIS-data.

| Vej | Hvad | Kræver |
|---|---|---|
| **A (anbefalet, ingen ArcGIS-ændring)** | Det byte-identiske bundle køres lokalt i Cloudflares runtime på `http://localhost:8788` (allerede registreret redirect). Du logger ind i en synlig browser; jeg kører de scriptede kontroller i samme session | At din lokale "ENCORE"-server på port 8788 stoppes under testen |
| B | Test på det Access-beskyttede preview | At `https://csm-preview-g0.pages.dev/` registreres som redirect-URI på OAuth-appen `2FXbDZ9xhc66sQ0r`. Det er en ændring i ArcGIS-portalen og kræver din (og evt. Team GIS') godkendelse |

Scriptede kontroller under login-testen:
1. PKCE-flow gennemføres (state og verifier valideres; tokenet ligger kun i `sessionStorage`).
2. Lag 835 indlæser features; box-/poly-select og "Create polygon from selection".
3. Calculate, Optimize og eksport på rigtige zoner.
4. Netværksloggen indeholder ingen kald til `applyEdits`, `addFeatures` eller `deleteFeatures`.
5. Push giver 0 kald.
6. Tokenudløb: udløbstid sat i fortid, så login vises igen.
7. Inddraget token: log ud i portalen, så KB-02-adfærden dokumenteres med et rigtigt token.

## 7. Offentligt repository

| Område | Fund |
|---|---|
| Hemmeligheder | Ingen i nogen branch eller i historikken (scannet for nøgler, tokens, private keys og passwords). Client-ID'er er offentlige PKCE-ID'er |
| Persondata | Kun committer-identiteten (allerede offentlig på master). Ingen navne eller e-mails fra RF-dokumenter |
| RF-data | Ingen zonegeometrier eller kapacitetstal (fx de 660 pladser er ikke medtaget). Fixtures er syntetiske. "50 m², 6–10 personer" er offentlig shopinformation |
| Hvad lag-URL'erne afslører | Tjenestekataloget `/arcgis/rest/services` kan listes uden login (8 mapper, 6 tjenester). Lag 835 ("GAT") viser skema uden token (17 felter, EPSG:25832), men en anonym optælling giver 0 features. `Space_mapping` kræver token. URL'erne i repoet tilføjer derfor kun lidt; det offentlige katalog er et forhold for Team GIS |
| Interne oplysninger | Navne på interne værktøjer (rf-camping-command-center, Camping Portal) og lokale stier. Lav følsomhed |
| **Timing (vigtigst)** | Discovery-dokumenterne og fase 0-rapporten beskriver detaljeret, hvordan den **kørende** produktion kan misbruges: åben proxy og destruktiv push. Koden på den offentlige master viser det allerede, men dokumenterne gør det let |

**Anbefaling:** Repoet kan forblive offentligt. Men `fase0/sikring` (med dokumenterne) bør **ikke pushes til GitHub, før fase 0 er i produktion (G0-c)**. Alternativt kan sikkerhedsafsnittene midlertidigt holdes ude af det, der pushes.

## 8. Nye fund og åbne risici

| # | Fund / risiko | Alvor | Håndtering |
|---|---|---|---|
| R1 | Produktionen (master) har stadig den åbne proxy og den destruktive push, indtil fase 0 er deployet | **Høj** | Kræver G0-a og G0-c |
| R2 | Login på produktionen er ifølge f5a2 brudt ("Invalid redirect_uri") | Middel | Merge af f5a2 (separat beslutning) |
| R3 | KB-02: afvist token giver lydløs, tom lagvisning | Middel | Registreret; løses i ny app |
| R4 | esri-leaflet sender tokenet som URL-parameter (havner i server- og proxy-logs) | Lav–middel | Kendt ArcGIS-mønster; ArcGIS REST JS med header/POST i ny app |
| R5 | Skrivespærring er app- og proxy-niveau, ikke ArcGIS-niveau (KB-03) | Lav | ArcGIS-rettigheder; fase 5 |
| R6 | Proxyens Origin-tjek kan forfalskes af ikke-browsere | Lav (proxy lukket) | Access-JWT-validering er et krav, hvis den genåbnes |
| R7 | ArcGIS-tjenestekataloget og lag-skemaer er offentligt tilgængelige | Lav | Til Team GIS (spor A) |
| R8 | API-tokenen i Proton Pass (`cloudflare-access-edit`) har ikke rettighed til service-tokens, så automatiske kontroller bag Access ikke er mulige | Lav | Ny, smalt afgrænset token, hvis du ønsker automatiske preview-tjek |
| R9 | Wrangler 4.158 omlægger Pages til Workers; klassiske Pages-projekter kræver `--force` ved oprettelse | Lav | Notér i drift; afklar produktionens deploy-vej |
| R10 | 0B.3 ikke opfyldt i browser (9,5 s for den værste zone i headless Chrome) | — (0B, ikke G0) | Web Worker før G0B |

## 9. Anbefaling om merge til master (G0-a)

**Anbefaling: Betinget GO.** Merge `fase0/sikring` til master, når login-testen i §6 er bestået.

- Diff-reviewet har ingen blokerende fund, og alle automatiske og runtime-tests er grønne.
- Login-testen er det eneste udestående kriterium, som du selv har stillet.
- Merge f5a2 som separat beslutning før eller sammen med fase 0, så login virker på produktionen.
- Push ikke branchen til GitHub før G0-c (§7).
- Fase 0B merges ikke nu (separat port G0B, efter Web Worker).
