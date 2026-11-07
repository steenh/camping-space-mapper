# Beslutningslog — Camping Space Mapper

> Formål: Én sporbar liste over beslutninger, deres betingelser og konsekvenser. Nye beslutninger tilføjes nederst; eksisterende poster ændres ikke, men kan erstattes af en ny post (med henvisning).
> Relateret: [Roadmap](DISCOVERY-ROADMAP.md)

## Godkendelsesporte (gennemgående)

Disse regler gælder for alle faser, indtil en ny beslutning siger andet:

- **Ingen produktionsdeploy** uden særskilt godkendelse.
- **Ingen skrivning til ArcGIS** (heller ikke testlag i produktionsportalen) uden særskilt godkendelse.
- **Intet merge til `master`** uden særskilt godkendelse. Arbejde sker på lokale branches; lokale commits er tilladt.
- **Følsomme RF-data** (zonegeometrier, interne lag, personoplysninger) lægges ikke i repositoryet, så længe det er (eller kan blive) offentligt. Fixtures er syntetiske.
- **Eksterne henvendelser** (fx kravspecifikation til Team GIS) sendes ikke uden særskilt godkendelse.

## 2026-11-07 — Discovery-review

Beslutningstager: Steen Ritter (efter gennemgang af discovery sammen med ChatGPT). Grundlag: discovery-dokumenterne i repositoryets rod.

| ID | Beslutning | Status | Betingelser / præciseringer | Konsekvens |
|---|---|---|---|---|
| B1 | Sikr den eksisterende app: deaktivér destruktiv ArcGIS-push, begræns proxyens adgang, ret de kritiske geometrifejl | **GO** | Ingen produktionsdeploy uden særskilt godkendelse | Fase 0 udføres lokalt på branch `fase0/sikring` |
| B2 | Implementér søgeforbedring O1+O2 i den eksisterende app | **Betinget GO** | Separat branch, med benchmark og regressionstest. Ingen produktionsdeploy | Fase 0B på egen branch *efter* fase 0, fordi benchmark og regressionstest bygges i fase 0 |
| B3 | UI-framework | **GO**: React + TypeScript | Geometri- og kapacitetsmotoren skal være framework-uafhængig | `packages/engine` uden DOM-, React- og ArcGIS-afhængigheder |
| B4 | Kortbibliotek | **Betinget GO**: MapLibre foretrukket | Teknisk spike på rendering, ArcGIS-integration og redigering før endeligt valg | Prototypetrin P0 med egen port (GP0) |
| B5 | Benchmark-harness, fixtures og reproducerbare resultater i repositoryet | **GO** | Ingen følsomme RF-data i et offentligt repository | `bench/` med syntetiske fixtures og baseline |
| B6 | Forbered afklaringer med GIS, sikkerhed og produktansvarlige | **GO** | — | Spor A (afklaringer), parallelt med fase 0 og prototype |
| B7 | Kort, samarbejdsorienteret kravspecifikation til Team GIS | **GO** (udarbejdelse) | **Må ikke sendes** uden særskilt godkendelse | Udkast i spor A; sendes først efter port GA |
| B8 | RF27-skitser bliver til foreløbige zoner | **GO**: GIS-digitalisering foretrækkes | Manuel optegning skal fortsat være mulig. Begge er foreløbige, indtil de autoritative zoner foreligger | Proveniens `foreloebig` for begge veje |
| B9 | Årlige eller fælles zonelag | **GO**: understøt begge | — | Zonekilde-konfiguration med `where`-filter |

### Arkitekturkrav (samme review)

| ID | Krav | Hvor det håndteres |
|---|---|---|
| A1 | ArcGIS-zoneintegrationen er en **adapter**. Kapacitetsmotoren må ikke afhænge af et eksisterende ArcGIS-lag | `packages/engine` kender kun datakontrakten; adaptere (GeoJSON, syntetisk, ArcGIS) leverer kontrakt-zoner. Arkitekturtest i P1 |
| A2 | Skeln mellem **godkendelse af GIS-zonegeometri** og **godkendelse af kapacitetsberegninger** | To adskilte begreber: `zone_status = godkendt` (ejes af GIS, læses fra kilden) og `CapacityApproval` (ejes af campingledelsen, binder sig til et beregningssnapshot). Se [Zoneintegration §5.1](DISCOVERY-ZONE-INTEGRATION.md) |
| A3 | Snapshot-identitet, beregningsversioner og proveniens fra **første version**, også ved lokal lagring | P2: `zoneset_hash`, `geometry_hash`, `engine_version`, `provenance` er obligatoriske felter fra start |
| A4 | Geometriske præcisionsvalg **testes frem for at antages** | P2 indeholder præcisionsforsøg (afrunding, toleranceværdier, reprojektion) med dokumenterede resultater, før værdierne låses |
| A5 | Første kapacitetsprototype har et **reelt, brugbart kortoverblik** med syntetiske zoner og GeoJSON-import | P3–P4 |
| A6 | Et tidligt, testbart visuelt produkt prioriteres før den fulde Designer | Port GP4 (første testbare produkt) ligger før optimering v2 og Designer |
| A7 | Eksisterende discovery-dokumenter må ikke overskrives ukritisk; lokale ændringer gennemgås og bevares | Dokumenterne er committet uændret som første commit på `fase0/sikring`; alle senere rettelser er synlige som diffs |
| A8 | Ingen ændringer i produktion eller ArcGIS uden særskilt godkendelse | Se godkendelsesporte øverst |

### Observeret ved opstart af fase 0

- Der findes en parallel lokal branch `fase0/f5a2-arcgis-client-id` (worktree `E:/rf-fase0/pladser-f5a2`, commit `dbf2580`), som skifter ArcGIS client-ID til "Pladsplanlæggerens" egen OAuth-app, fordi appen er flyttet til `pladser.campops.net`. Fase 0-branchen rører ikke den linje, og de to branches forventes at kunne merges uden konflikt.

## 2026-11-07 — Port G0

Beslutningstager: Steen Ritter. Grundlag: [Fase 0-rapport](FASE-0-RAPPORT.md).

| ID | Beslutning | Status | Betingelser |
|---|---|---|---|
| G0-a | Merge `fase0/sikring` til `master` | **Afventer** | Først diff-review og vellykket preview-test |
| G0-b | Isoleret preview | **GO** | Skriveadgang til ArcGIS fuldt deaktiveret; preview beskyttet mod uvedkommende adgang |
| G0-c | Produktionsdeploy | **NO-GO** | Kræver særskilt godkendelse |
| G0-d | Fase 0B (O1+O2) | **GO** | Separat branch; ingen merge eller deploy; holdes adskilt fra G0 |
| — | Offentligt repository | **Betinget GO** | Kun hvis gennemgang bekræfter, at kode, dokumenter, testdata og historik ikke indeholder secrets, følsomme RF-data eller interne oplysninger, der ikke bør offentliggøres |

Yderligere krav (G0-1..8): selvstændig diff-review; adgangskontrol ikke kun Origin/CORS; preview-test inkl. PKCE-login, features, tokenudløb, Calculate, Optimize, eksport og dokumenteret skriveblokering; afklaring af `fase0/f5a2-arcgis-client-id` før preview; KB-01 registreret som kendt begrænsning; O1+O2 benchmarket mod oprindelig algoritme; reproducerbare, ikke-følsomme benchmarks; fase 0 og O1+O2 ikke i samme merge.

Udførelse: se [G0-verifikation](G0-VERIFIKATION.md). Preview-miljø: Cloudflare Pages-projekt `csm-preview-g0` (personlig konto) bag Cloudflare Access-app "csm-preview-g0" (kun ejeren, session 8 t), bygget fra lokal integrationsbranch `preview/g0`.

## 2026-11-07 — Arkitekturbeslutning A9: ArcGIS er READ-ONLY

Beslutningstager: Steen Ritter. **Ufravigeligt krav for alle faser.**

| ID | Beslutning |
|---|---|
| A9 | Appen må **ikke** skrive tilbage til ArcGIS — hverken lag 835, kommende campingzonelag, andre importerede lag eller `Hosted/Space_mapping/FeatureServer/0`. ArcGIS er udelukkende en datakilde. Ingen skrivning er godkendt, heller ikke til testlag |

Konsekvenser (gennemført på `fase0/sikring`, commit `0c6fe97` og senere):

1. ArcGIS-push fjernet fra brugerflade og kode (ikke blot deaktiveret).
2. Skriveproxyen `/arc-proxy` fjernet. Eneste serverfunktion er `/arc-token` (OAuth-kodeudveksling, kun portalens token-endpoint); den er nødvendig for login og kan ikke bruges til skrivning.
3. Ingen `addFeatures`, `updateFeatures`, `deleteFeatures`, `applyEdits` eller tilsvarende kan kaldes fra appen: read-only-vagt i browseren (fetch/XHR/sendBeacon) og slåede-fra redigeringsmetoder i esri-leaflet.
4. Alle ArcGIS-kildelag behandles som uforanderlige.
5. Scenarier, layouts og kapacitetsberegninger gemmes i appens egen datamodel og lagring.
6. GeoJSON-eksport bevares.
7. Et dedikeret ArcGIS-outputlag kræver en ny, eksplicit godkendelse og er ikke på roadmappen.
8. Roadmap (fase 5 → "Eksport og egen lagring"), arkitektur (§7 markeret som erstattet, ny §8), UX (BR4), zoneintegration, register over kendte begrænsninger, README, tests og release-gates er opdateret.
9. Negative tests verificerer, at ingen skriveoperation kan udføres uanset brugerrolle/token, Origin-header eller direkte API-kald.

Erstatter: den tidligere plan om "sikker publicering" (Arkitektur §7, P1–P10, roadmap fase 5) og de dele af B1, der forudsatte en senere genindførelse af push.

## 2026-11-07 — G0, anden runde

| ID | Beslutning | Status | Betingelser |
|---|---|---|---|
| G0-login | Login-test via vej A: `http://localhost:8788` (registreret redirect) med samme integrationsbundle som `preview/g0` | **GO** | ENCORE-serveren på port 8788 må ikke stoppes eller ændres automatisk; processen identificeres, og frigivelse/genstart beskrives; stop ved manuel handling (lukning af ENCORE, login) |
| KB-02 | Ret lydløs tom visning ved afvist token | **GO** | Tydelig forskel på tomt lag, autorisationsfejl og indlæsningsfejl |
| G0-a | Merge af fase 0 til `origin/master` | **Betinget GO** | Efter bestået login-test; aktuel `origin/master` hentet og integreret korrekt; alle regressionstests består; sikkerhedsrettelserne uændrede i funktion; O1+O2 ikke inkluderet; ingen uventede ændringer |
| G0-c | Produktionsdeploy | **NO-GO** | Release-gate skal leveres efter merge med fokus på at lukke åben proxy og destruktiv push i produktion |
| G0B-worker | O1+O2 i Web Worker | **GO** | Separat branch; ingen beregning på hovedtråden; synlig fremdrift; annullering; deterministisk; ingen kapacitetsregression mod nuværende O1+O2; tidssammenligning Node / Chrome main thread / Chrome Web Worker; ingen unødvendig workerpool; ingen merge/deploy uden godkendelse |

Prioritering: (1) G0-login og KB-02, (2) merge af sikker fase 0 efter bestået gate, (3) forbered kontrolleret produktionsrelease, (4) Web Worker parallelt.
