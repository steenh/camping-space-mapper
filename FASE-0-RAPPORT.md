# Fase 0 — rapport til port G0

> Branch: `fase0/sikring` (worktree `E:/rf-fase0/pladser-sikring`), baseret på `master` @ `859849b`
> Dato: 2026-11-07 · Status: **udført lokalt, afventer G0**. Intet er merget, deployet eller skrevet til ArcGIS.
> Plan og acceptkriterier: [Roadmap §5](DISCOVERY-ROADMAP.md) · Beslutninger: [Beslutningslog](DECISION-LOG.md)

## 1. Resultat pr. leverance

| # | Leverance | Status | Evidens |
|---|---|---|---|
| 0.1 | Repo-hygiejne (`.gitignore`, `package.json` kun dev, `npm test`, `npm run bench`) | ✅ | Appen har stadig intet byggetrin og ingen nye runtime-afhængigheder |
| 0.2 | Benchmark-harness, syntetiske fixtures, baseline fra uændret master | ✅ | `bench/`; baseline `golden-859849b.json` (240 cases); `latest.json` byte-identisk over to kørsler; discovery-tal reproduceret 96/96 |
| 0.3 | Golden-regressionstest | ✅ | 240/240 simple cases identiske med master |
| 0.4 | Destruktiv push deaktiveret | ✅ | Kodeflag + guard; runtime-test og browsertest: 0 netværkskald |
| 0.5 | `/arc-proxy` og `/arc-token` begrænset | ✅ | 10 tests med mocket fetch; proxyen er lukket som standard |
| 0.6 | Kritiske geometrifejl | ✅ | Probe-tests røde på master, grønne på branchen; målt overlap 0 m² |
| 0.7 | Versionslås + SRI | ✅ | Statisk test + netværksverifikation af alle 6 hashes |
| 0.8 | "BEST FOUND", escaping, README | ✅ | Statiske tests |
| 0.9 | Lokal browser-røgtest | ✅ (uden skærmbillede) | Se §4 |

## 2. Testresultater

`npm test`: **24 tests, 23 bestået, 0 fejlet, 1 sprunget over** (SRI-hashes mod CDN kræver netværk; kørt separat med `CSM_NETWORK=1` → bestået).

Samme tests mod uændret `master` (`CSM_INDEX_HTML=<859849b>`): 11 af 13 relevante tests fejler. Det viser, at testene fanger de fejl, de skal:

| Test | Master `859849b` | `fase0/sikring` |
|---|---|---|
| Huller (F03) | ✖ pladser i hul | ✔ 0 pladser i hul (målt overlap 0 m²) |
| MultiPolygon (F02) | ✖ uendelig løkke (timeout 10 s) | ✔ < 0,3 s, begge dele udfyldt, 0 m² uden for zonen |
| Overlap mellem zoner (F04) | ✖ ikke understøttet | ✔ 0 overlappende pladspar (målt 0 m²) |
| Bruttoareal = union (F04) | ✖ sum (79.797 m²) | ✔ union (69.822 m²) |
| Ugyldige produkter | ✖ uendelig løkke (fx bredde −5) | ✔ afvist, 0 blokke |
| Eksklusionszoner (regression) | ✔ | ✔ |
| Golden (simple polygoner) | ✔ | ✔ 240/240 identiske |
| SRI / versionslås | ✖ | ✔ |
| Push deaktiveret (statisk + runtime) | ✖ | ✔ |
| "OPTIMAL"-påstand | ✖ | ✔ |
| Escaping af produktnavne | ✖ | ✔ |

**Regressioner:** Ingen fundet. Placeringsresultater for simple polygoner er uændrede, og benchmarkens `latest.json` er identisk før og efter review-rettelserne. Adfærd ændres *bevidst* kun for zoner med huller, MultiPolygoner, overlappende zoner og ugyldige produkter.

**Præcision (arkitekturkrav A4):** Tolerancen (1 cm²) blev ikke antaget; den blev målt. Den største målte skæring mellem pladser og huller, eksklusioner og andre zoner var 0 m² i alle probe-tests. Det sker, fordi pladser højst deler kanter med forhindringer.

## 3. Præcis hvad der er ændret

| Fil | Ændring |
|---|---|
| `index.html` | **Geometri:** `zoneParts`, `ringToLocal`, `exclusionLocalsFor`, `isValidProduct` (med grænser), `zoneOverlapExclusions`, `unionAreaM2`. `runPlacement`/`runPlacementStraight` kører pr. polygondel med huller som forhindringer; selve sweep-koden er linje for linje uændret. `calculate()`/`optimize()` sender overlap med tidligere zoner som eksklusioner. Areal-KPI viser unionen; arealisten viser overlap. **Sikkerhed:** `ENABLE_ARCGIS_PUSH = false` + guard, push-UI skjult med forklaring; 6 CDN-filer versionslåst med SRI (esri-leaflet `@3` → `3.0.19`, som var det, `@3` pegede på); `escapeHtml` på produktnavne og farver; produktdialogen afviser ugyldige værdier. **Tekst:** "OPTIMAL" → "BEST FOUND", "Optimal:" → "Best found:", kommentaren "negligible quality loss" erstattet med målte tal, vejledningstrin 6. Markør `// @bench-extract-end` |
| `functions/arc-proxy.js` | Lukket uden `ARC_PROXY_ENABLED=true`; kun samme origin (+ `ALLOWED_ORIGINS`); kun https/standardport/præcis vært uden credentials eller query; kun add/delete/applyEdits på `Space_mapping/FeatureServer/0`; ingen CORS; `redirect: 'manual'`; 502 ved netværksfejl |
| `functions/arc-token.js` | Kun samme origin; kun `authorization_code`, kendte public client IDs, krævet code + verifier, `redirect_uri` på tilladt origin; kun forventede parametre videresendes; ingen CORS; `redirect: 'manual'`; 502 ved netværksfejl |
| `README.md` | Deaktiveret push, miljøvariabler, SRI, tests og benchmarks, korrekt beskrivelse af optimizeren |
| `bench/`, `tests/`, `package.json`, `package-lock.json`, `.gitignore` | Nye (se §1) |
| `DISCOVERY-*.md`, `DECISION-LOG.md`, `FASE-0-RAPPORT.md` | Discovery committet uændret først; derefter roadmap/beslutningslog/arkitektur/zoneintegration opdateret efter review |

Commits på branchen (ældst først): `e257239` discovery uændret · `f357b0a` roadmap og beslutningslog · `c22afb3` benchmark og baseline · `f56201d` test-script · `54ff275` proxy/token · `566d501` app-sikring · `5cb0da3` benchmark-scripts og README · `30d693f` discovery reproduceret · `bedac23` review-rettelser · (denne rapport).

## 4. Browser-røgtest (lokal, statisk server, uden login)

- Alle fire CDN-biblioteker indlæst med SRI (Leaflet 1.9.4, Leaflet.draw, Turf, esri-leaflet).
- Fire zoner tegnet programmatisk: simpel, overlappende, MultiPolygon (Leaflet-lag fra GeoJSON) og zone med hul.
- Calculate: 2.227 pladser; 0 pladser i hullet; 0 overlappende pladspar mellem zone 1 og 2; 0 pladser uden for MultiPolygon-zonen; bruttoareal 167.068 m² (union) mod 181.061 m² (sum), og arealisten viser overlappet på 13.993 m².
- Optimize: "Best found: 2.410 spaces", badge "BEST FOUND". Målt tid ≈ 2,6 s for de fire zoner (overlap-eksklusion koster ≈ 1 ms pr. kørsel i de overlappende zoner).
- Push-funktionen: 0 netværkskald, statusbesked om deaktivering, push-UI skjult, forklaring vist.
- GeoJSON-eksport genereres.
- Ikke testet: skærmbillede (værktøjsfejl i headless-sessionen), rigtigt ArcGIS-login og token-udveksling (kræver login mod produktionsportalen; skal ske på et preview-miljø ved G0).

## 5. Uafhængig review

En separat, read-only review (andet modelagent) fandt **ingen kritiske eller høje fund** og ingen omgåelse af proxy, token eller push. Den bekræftede, at sweep-koden er linje for linje uændret for simple polygoner, og at browsere sender `Origin` på same-origin POST, så token-udvekslingen bør virke.

| Fund | Alvor | Håndtering |
|---|---|---|
| Ekstreme produktværdier (fx 0,001 m) kunne stadig fryse fanen | Middel | **Rettet**: grænser i `isValidProduct` + test |
| Proxyerne fulgte redirects; netværksfejl gav rå 500 | Lav | **Rettet**: `redirect: 'manual'`, 502 + test |
| `ALLOWED_ORIGINS` med afsluttende skråstreg matchede ikke | Lav | **Rettet** + test |
| Huller i et overlap går tabt (zone med hul, der overlapper en anden zone) | Middel | **Kendt begrænsning**: konservativ (færre pladser, aldrig dobbeltplacering). Korrekt løsning kræver polygondifferens og hører til motoren i prototypen (P2) |
| Overlap beregnes O(n²) på main-thread uden cache | Lav | Kendt; ikke målbart ved få zoner. Flyttes til worker i ny motor |
| Overlap-noten kan dobbelttælle, hvis tidligere zoner overlapper hinanden | Lav | Kendt; kun visning |
| `unionAreaM2` falder stille tilbage til sum, hvis union fejler | Lav | Kendt; kun `console.warn` |
| Sti 0 i dialogen bliver til 5 (`|| 5`, eksisterende adfærd) | Lav | Uændret; ingen stille standardværdier i ny motor (P5) |
| Straight paths fase 1 ignorerer huller/overlap ved kolonnebredde | Lav | Kendt (som for eksklusioner, F09); kun udbyttetab |
| Origin-tjek fejler lukket bag en proxy, der omskriver Host | Lav, drift | Sæt `ALLOWED_ORIGINS` ved behov |

## 6. Forhold, du skal kende før G0

1. **Parallel branch `fase0/f5a2-arcgis-client-id`** skifter client ID til `2FXbDZ9xhc66sQ0r` (appen er flyttet til `pladser.campops.net`). `/arc-token` tillader begge ID'er, og en test sikrer, at ID'et i `index.html` altid er tilladt. Branchene rører ikke de samme linjer. Efter merge af begge bør det gamle ID fjernes fra allowlisten.
2. **Produktion kræver handling for at proxyen virker:** `/arc-proxy` er lukket, indtil `ARC_PROXY_ENABLED=true` sættes. Det er tilsigtet, så længe push er deaktiveret. `/arc-token` behøver ingen variabel.
3. **ArcGIS-login er ikke testet end-to-end.** Det kræver et preview-deploy, et login og registreret redirect-URI. Det anbefales som første skridt efter G0(b), før produktion.
4. **Repo-synlighed:** Fixtures er syntetiske. Discovery-dokumenterne nævner offentligt kendte lag-URL'er (som allerede står i koden) og produktfakta fra RF's shop. Bekræft, at repoet må være offentligt, eller gør det privat.

## 7. Port G0 — beslutninger, der afventer dig

| # | Beslutning | Anbefaling |
|---|---|---|
| G0(a) | Merge `fase0/sikring` til `master`? | Ja, efter din gennemgang af diffen |
| G0(b) | Deploy til preview (ikke produktion) for at teste login og token-udveksling? | Ja, som første skridt |
| G0(c) | Produktionsdeploy? | Efter (b) er verificeret |
| G0(d) | Start fase 0B (søgeforbedring O1+O2 på egen branch)? | Ja |
| — | Skal "huller i overlap" rettes i den nuværende app, eller vente til motoren (P2)? | Vent; adfærden er konservativ og sjælden |
