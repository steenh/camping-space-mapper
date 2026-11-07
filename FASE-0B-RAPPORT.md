# Fase 0B — søgeforbedring O1+O2 (rapport)

> Branch: `fase0b/soegning` (worktree `E:/rf-fase0/pladser-soegning`), baseret på `fase0/sikring` @ `61b7d4d`
> Dato: 2026-11-07 · Status: **udviklet lokalt, afventer port G0B**. Holdes adskilt fra G0: ingen merge, ingen deploy.
> **Merge-rækkefølge:** Branchen indeholder fase 0-commits. Den må kun merges *efter* `fase0/sikring` er merget, og som en separat merge (G0-krav 8).

## 1. Hvad er ændret

| Del | Ændring |
|---|---|
| `candidateAngles()` / `edgeAngles()` | Kandidatvinkler: 0–175° i 5°-trin (før 0–85°) + retningerne af zonens længste kanter (højst 8) og deres vinkelrette |
| `optimizeZone()` | Søgning pr. zone i tre trin: (1) alle kandidatvinkler × den gamle 3×3-offsetliste (+ 4×3 produktperiode-offsets for kantvinkler); (2) top-3 vinkler ±1° × 6×5 periode-offsets; (3) bedste vinkel × 12×10 offsets. Trin 1 er et supersæt af den gamle søgning, så resultatet aldrig er dårligere for samme zone. Deterministisk |
| `optimize()` (UI) | Hver zone optimeres for sig, med fremdrift pr. zone ("Optimizing area 2 (2 of 7)…"); knapper låses under kørsel; hver zone husker sin vinkel og sit offset (`polySettings`) |
| `calculate()` (UI) | Bruger stadig de manuelle felter for alle valgte zoner og gemmer dem som zonernes indstilling |
| UI-tekst | Resultatkortet hedder "Rotation" og viser "per area", når zonerne har forskellige vinkler; arealisten viser rotation og offset pr. zone |
| Tests | `tests/optimize.test.mjs` (aldrig færre pladser, determinisme, gyldighed, guards) |
| Benchmark | `bench/compare-0b.mjs` + uafhængig validator `bench/lib/validate.mjs`; resultater i `bench/results/fase0b-compare.*` |

## 2. Benchmark: gammel vs. ny med identiske inputs

Samme zoner, produkter, eksklusioner, overlap-regler og placeringskode; kun søgningen er forskellig. 28 tilfælde: 6 syntetiske enkeltzoner × 2 produkter × 2 algoritmer, plus et blandet site med 7 zoner (forskellige orienteringer, overlap, hul, MultiPolygon, vej) × 2 × 2.

| Kriterium | Resultat |
|---|---|
| **Kapacitet** | Aldrig færre pladser (0 af 28). Gevinst: min 0 %, **median +4,7 %**, maks +23,9 %. Blandet site: +7,8 % til +21,2 % |
| **Gyldighed** | 28/28 nye og 28/28 gamle layouts uden overtrædelser (inden for zone inkl. huller, uden for eksklusioner, intet overlap inden for eller på tværs af zoner; tolerance 1 cm²) |
| **Reproducerbarhed** | `fase0b-compare.json` byte-identisk over to kørsler; kun syntetiske data |
| **Performance (Node 25)** | 4–6 gange flere layouts end før. Maks **2,99 s** for én zone (uregelmæssig 8 ha, greedy); blandet site med 7 zoner 1,8–6,4 s i alt |
| **Performance (headless Chrome 150)** | Samme værste zone: **9,5 s** (9,5 ms pr. layout mod 3 ms i Node) |

Restgab mod discovery-bedste (bred søgning med 3.780 layouts): fra 0 til −8 pladser (fx Get A Place-strimmel 352 mod 360, uregelmæssig zone 1.073 mod 1.081).

## 3. Acceptkriterier (roadmap §5, fase 0B)

| # | Kriterium | Status |
|---|---|---|
| 0B.1 | Aldrig færre pladser end baseline på nogen fixture × produkt × algoritme | ✅ 0/28 og regressionstest |
| 0B.2 | Pr. zone ≥ fælles vinkel; gevinst rapporteret | ✅ blandet site +7,8–21,2 % |
| 0B.3 | Optimize ≤ 3 s pr. discovery-fixture på main-thread, ellers Web Worker | ❌ **Ikke opfyldt i browser**: 2,99 s i Node, men 9,5 s i headless Chrome for den værste zone. UI'et fryser ikke på tværs af zoner (fremdrift pr. zone), men inden for en stor zone |

## 4. Anbefaling til port G0B

Merge **ikke** 0B, før 0B.3 er løst. Foreslået næste skridt (0B.4): kør `optimizeZone` i en Web Worker (engine-regionen og Turf indlæses med SRI-verificeret `fetch`), og parallelisér zoner over `navigator.hardwareConcurrency`. Alternativt skal tidsbudgettet ændres ud fra en måling i en almindelig (ikke-headless) browser på en planlæggers maskine.

## 5. 0B.4 — Optimize i en Web Worker

> Branch: `fase0b/worker` (worktree `E:/rf-fase0/pladser-worker`), base `fd58589`. Dato: 2026-11-07. Ikke merget, ikke deployet.

### Hvad er ændret

| Del | Ændring |
|---|---|
| `optimizeZone(…, onProgress)` | Valgfri hook `onProgress(runs, planned)` efter hvert layout. `planned` er en øvre grænse (opdateres efter trin 1 og 2), så fremdriften aldrig overstiger 100 %. Uden hook er resultatet uændret (test) |
| Worker (engine-regionen) | `handleOptimizeMessage` / `optimizeWorkerMain` / `buildOptimizeWorkerSource`. Worker-scriptet = Turf (hentet med `fetch(url, { integrity })` med samme SRI-hash som `<script>`-tagget; ingen `importScripts`) + engine-regionen skåret ud af sidens egen inline-script + beskedhåndtering. Ingen Leaflet, ingen DOM, intet netværk i workeren. Zoner og eksklusioner sendes som GeoJSON |
| `optimize()` (UI) | Én worker pr. kørsel (ingen pool), oprettet ved behov fra en Blob-URL og termineret når kørslen slutter. Status: "Optimizing area 3 (2 of 7) — 43 %" (fremdrift hver 25. layout). Hovedtråden tegner kun hver zones resultat (én placering) |
| Annullér | Knappen **Cancel** vises under kørsel og kalder `worker.terminate()` med det samme. **Valg:** zoner, der var færdige før annulleringen, beholder deres nye layout og indstilling; alle andre zoner beholder deres tidligere layout (Optimize rydder ikke længere alle layouts ved start). Knapperne genaktiveres, og status siger fx "Optimize cancelled: 1 of 2 areas optimized and kept; the other areas keep their previous layout." "BEST FOUND"-mærket vises kun efter en fuldført kørsel |
| Ændringer under kørsel | Ny/redigeret/slettet zone, ny/slettet eksklusionszone eller "Clear all" annullerer en igangværende Optimize (søgningen passer ikke længere til kortet); statuslinjen nævner det |
| Fallback | Kan workeren ikke oprettes (ingen `Worker`, Turf-hentning fejler, blokeret Blob-worker, worker-fejl), køres de resterende zoner på hovedtråden som før (én zone pr. tick; Cancel virker mellem zoner), og status siger "on the main thread: Web Worker unavailable (…)" |
| Calculate | Uændret |

### Determinisme og kapacitet

- `node bench/compare-0b.mjs` regenererer `bench/results/fase0b-compare.json` **byte-identisk** (sammenlignet med den committede blob med `cmp` og `git diff --exit-code`).
- `tests/worker.test.mjs` kører det **rigtige** worker-script (bygget af appens `buildOptimizeWorkerSource` af den lokale Turf-fil, hvis sha384 testes mod SRI-hashen i `index.html`) i en rigtig tråd (`node:worker_threads` med en lille `self`-shim) og sammenligner med `optimizeZone` direkte: identiske resultater med overlap og eksklusioner, begge algoritmer; besked-rækkefølge; fremdrift ≤ 100 %; fejlbesked; og at `terminate()` stopper midt i en zone (< 1 s), så kun færdige zoner er rapporteret.
- Headless Chrome 156 (røgtest, `bench/browser/worker-bench.html`): 8/8 cases identiske mellem hovedtråd og worker; i appen gav en fuld kørsel med 2 zoner samme indstillinger som `optimizeZone` på hovedtråden.

### Tider

Node v25.6.1 (`node bench/compare-0b.mjs`, ny søgning, én zone pr. case):

| Fixture | Produkt | Algoritme | Layouts | Node |
|---|---|---|---:|---:|
| D_irregular | GAP_5x10 | greedy | 999 | 2.886 ms |
| D_irregular | GAP_5x10 | straight | 996 | 1.795 ms |
| D_irregular | SYN_6x8 | greedy / straight | 999 / 996 | 831 / 1.311 ms |
| E_strip_62x400 | GAP_5x10 | greedy / straight | 757 / 757 | 1.142 / 1.007 ms |
| E_strip_62x400 | SYN_6x8 | greedy / straight | 757 / 756 | 333 / 723 ms |

Headless Chrome 156 (røgtest på udviklermaskinen, ikke den endelige måling): D_irregular GAP greedy 2.900 ms på hovedtråden (UI frosset 2.895 ms) mod 3.007 ms i workeren inkl. opstart (længste UI-pause 11 ms). Alle 8 cases: længste UI-pause med worker ≤ 11 ms.

| Måling (rigtig Chrome, ikke headless) | D_irregular GAP greedy | D_irregular GAP straight | E_strip GAP greedy | E_strip GAP straight |
|---|---:|---:|---:|---:|
| Chrome hovedtråd (ms / længste UI-pause) | TODO | TODO | TODO | TODO |
| Chrome Web Worker (ms inkl. opstart / længste UI-pause) | TODO | TODO | TODO | TODO |

**Sådan måles (orkestrator):** `npm run bench:browser` (statisk server på `127.0.0.1:8790`, kun repo-roden) → åbn `http://127.0.0.1:8790/bench/browser/worker-bench.html?auto=1` i Chrome i forgrunden. Siden indlæser engine-regionen fra `/index.html`, kører hver case (D_irregular og E_strip_62x400 × GAP_5x10 og SYN_6x8 × greedy og straight) først på hovedtråden og derefter i en worker bygget som i appen, og viser ms, layouts, længste UI-pause (største afstand mellem animation frames), antal fremdriftsbeskeder og om resultaterne er identiske. JSON står nederst på siden og i `window.benchResult`. `?only=D_irregular|GAP_5x10` begrænser til én fixture/ét produkt. Fixtures: `bench/fixtures/worker-bench.json` (syntetiske, genereres med `node bench/make-worker-fixtures.mjs`). Siden kalder ikke ArcGIS.

### Acceptkriterie 0B.3 efter 0B.4

UI'et fryser ikke længere under Optimize: søgningen kører i workeren, og hovedtråden laver kun én placering pr. zone ved visning. Tiden pr. zone er omtrent den samme som på hovedtråden (i headless-røgtesten 2–150 ms mere pr. zone, inkl. opstart af workeren). Om 0B.3 nu anses som opfyldt, afgøres ved port G0B ud fra Chrome-målingen ovenfor.

### Risici / åbne punkter

- Workeren henter Turf igen fra unpkg (normalt fra browserens cache). Er CDN'et nede efter sideindlæsning, eller blokerer en fremtidig CSP Blob-workers (`worker-src blob:`), bruges hovedtråds-fallback, og status siger det. Sætter man en CSP, skal `worker-src blob:` med.
- Read-only-vagten (A9) er installeret på `window`, ikke i workeren; workerkoden har ingen netværkskald (statisk test).
- `bench/lib/extract.mjs` omskriver ordet `drawnExclusions`, så `buildOptimizeWorkerSource` testes ud fra den uændrede regionstekst, ikke via `loadEngine`.
