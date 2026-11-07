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
