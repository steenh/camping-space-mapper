# Discovery 3 — Optimering

> Status: discovery · Dato: 2026-11-07
> Alle tal i dette dokument er **målt** med appens egen placeringskode, udtrukket uændret fra `index.html` og kørt i Node 25 (V8). Formerne er syntetiske; historiske RF-geometrier var ikke tilgængelige i discovery (se §6).

## 1. Problemformulering

Givet en zone Z (polygon med mulige huller), en mængde eksklusioner E og en produktmodel (plads `w×h`, blok ≤ `c×r`, mellemrum `g`, sti `p`): find en mængde ikke-overlappende, aksejusterede (i en valgt rotation) blokke inden for `Z \ E`, adskilt af mindst `p`, som maksimerer antallet af pladser. Eventuelt kommer sekundære mål til: lige stier, få 1-rækkes blokke, tilgængelighed og ensartet orientering.

Problemet er en variant af *2D-pakning af rektangler i en vilkårlig polygon*, som generelt er NP-svært. Praktisk betyder det:

- Et **dokumenteret optimum** kan kun opnås *inden for en afgrænset model* (fast vinkel, diskretiseret positionsgitter) med en eksakt løser, der også leverer en øvre grænse.
- Alt andet er **bedste fundne løsning** og skal rapporteres sådan, med en øvre grænse og et gap, hvor det er muligt.

Appens "OPTIMAL"-badge bør derfor fjernes eller erstattes med "Bedste fundne · gap ≤ x %".

## 2. De eksisterende algoritmer

| | Greedy row-by-row | Straight walking paths |
|---|---|---|
| Struktur | Rækker. Blokbredde vælges frit pr. position | Kolonneslots med fast bredde. Rækker pr. slot |
| Stier | Vandrette gennemgående, lodrette forskudte | Vandrette pr. slot, lodrette gennemgående |
| Beslutning | Største blok, der passer, uden tilbagesporing | Kolonnebredde efter maks. dækning (uden eksklusioner) |
| Kompleksitet pr. kørsel | O(positioner × blokvarianter × zonekanter) | Samme størrelsesorden |
| Målt tid pr. kørsel | 2–7 ms (6–25 ha) | 1–4 ms |
| Kendte svagheder | Ubrugte strimler ved blandede rækkehøjder | Fase 1 ser bort fra eksklusioner |

**Søgningen omkring algoritmerne** (`optimize()`) er det svageste led (se §4): 0–85° i 5°-trin × offsets `[0,17,34]` × `[0,8,16]`, én fælles løsning for alle zoner.

## 3. Søgerummets struktur — tre målte indsigter

1. **θ og θ+90° er forskellige layouts.** Blokke er ikke kvadratiske (50×20 m for standardproduktet), så hele intervallet 0–180° skal afsøges. 180°-periodicitet gælder op til et offset.
2. **Den rigtige vinkel er sjældent et multiplum af 5°.** Zoner, der er tegnet langs UTM 32N-gitteret, har kanter i 87,45°/177,45° i appens referenceramme (gitterkonvergens 2,54°). Bedste løsninger i benchmarket lå ved netop disse vinkler.
3. **Offsets har en produktbestemt periode** (`c·(w+g) − g + p` i X, `r·(h+g) − g + p` i Y). De hardkodede trin passer kun til standardproduktet.

Det giver en billig og stærk heuristik: **kandidatvinkler = zonens kantretninger (mod 180°) og deres vinkelrette, plus et grovt gitter; offsets = jævn sampling af produktperioden; lokal forfining omkring de bedste.**

## 4. Benchmark — søgestrategier med de samme placeringsalgoritmer

Strategier:

- **Nu:** appens aktuelle 18 × 3 × 3 = 162 kørsler.
- **Gl.:** før commit `859849b`, 90 × 5 × 5 = 2.250 kørsler.
- **Bred:** 0–180° i 2°-trin × 6 × 5 produktperiode-offsets (2.700 kørsler) + forfining ±2° i 0,5°-trin × 12 × 10 offsets (1.080 kørsler).
- **Kant:** kantafledte vinkler × 12 × 10 offsets (480–2.400 kørsler).

### 4.1 Get A Place-model (5×10 m, 10×2, sti 5 m)

| Zone | Areal | Gitter-ref.¹ | Greedy nu | Greedy bedst | Δ | Straight nu | Straight bedst | Δ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A rektangel 300×200 | 6,0 ha | 873 | 826 | 864 | **+4,6 %** | 764 | 864 | **+13,1 %** |
| B rektangel roteret 23° | 6,0 ha | 873 | 864 | 864 | 0 % | 864 | 864 | 0 % |
| C L-form | 4,5 ha | 654 | 624 | 648 | +3,8 % | 563 | 648 | **+15,1 %** |
| D uregelmæssig 10-kant | 8,0 ha | 1.158 | 1.065 | 1.081 | +1,5 % | 997 | 1.022 | +2,5 % |
| E strimmel 62×400 | 2,5 ha | 361 | 326 | 360 | **+10,4 %** | 284 | 360 | **+26,8 %** |
| F trapez | 4,7 ha | 680 | 622 | 629 | +1,1 % | 587 | 625 | +6,5 % |

¹ Gittertæthed 68,75 m²/plads (se [Geometri §3.1](DISCOVERY-GEOMETRY-AND-CAPACITY.md)); en reference, ikke en strikt grænse.

### 4.2 Syntetisk 1-rækkes model (6×8 m, 6×1, sti 6 m, gap 1 m)

| Zone | Greedy nu → bedst | Δ | Straight nu → bedst | Δ |
|---|---:|---:|---:|---:|
| A | 517 → 532 | +2,9 % | 512 → 532 | +3,9 % |
| B | 532 → 532 | 0 % | 532 → 532 | 0 % |
| C | 381 → 399 | +4,7 % | 375 → 395 | +5,3 % |
| D | 695 → 702 | +1,0 % | 651 → 665 | +2,2 % |
| E | 204 → 224 | +9,8 % | 198 → 224 | +13,1 % |
| F | 402 → 416 | +3,5 % | 370 → 416 | +12,4 % |

### 4.3 Øvrige målinger

| Måling | Resultat |
|---|---|
| Fælles vinkel for 3 zoner (0°, 30°, 62° orienteret) mod optimering pr. zone | 1.258 → 1.359 pladser (**+8,0 %**) |
| "Gl." (2.250 kørsler) mod "Nu" (162), straight paths, zone A / C | 864 mod 764 / 648 mod 563: reduktionen i `859849b` kostede 11,6–13,1 % |
| Kantafledt søgning mod bred+forfining | Samme eller bedre i 21 af 24 tilfælde (værst −2 pladser = −0,2 %), med 37–87 % færre kørsler |
| Tid, nuværende søgning, 25 ha-zone | 0,67 s (main-thread) |
| Tid, kantafledt søgning, uregelmæssig 8 ha-zone | 5,9–9,2 s (kræver worker + beskæring) |

### 4.4 Fortolkning

- **Op mod hele den målbare gevinst ligger i søgningen, ikke i algoritmerne.** Med god søgning ligger begge algoritmer på 99–99,8 % af gittertætheden for regulære zoner. Der er reelt ikke mere at hente med smartere pakning der.
- **Straight paths er næsten gratis med god søgning.** Med den nuværende søgning ser det ud, som om lige stier koster 7–15 %. Med god søgning er prisen 0 % på regulære zoner og 2–5 % på uregelmæssige. Det ændrer den driftsmæssige afvejning markant, og brugerne har formentlig fravalgt lige stier på et forkert grundlag.
- **Restgevinsten ligger i uregelmæssige zoner** (D, F: 92–93 % af referencen). Her kan flere rotationer pr. zone, kantudfyldning og eksakte metoder gøre en forskel.

## 5. Alternativer — vurdering

| # | Tilgang | Forventet kvalitet | Performance | Kompleksitet | Praktisk anvendelighed | Vurdering |
|---|---|---|---|---|---|---|
| O1 | **Bedre parametersøgning**: 0–180°, kantvinkler, produktperiode-offsets, lokal forfining | Målt +0–27 % | 0,5–10 s/zone; parallelliserbar | Lav | Høj, drop-in | **Gør først** |
| O2 | **Optimering pr. zone** (og pr. polygondel) | Målt +8 % på 3 zoner; altid ≥ fælles | Lineær i antal zoner | Lav | Høj | **Gør først** |
| O3 | **Strip-DP**: for fast vinkel løses hver række som 1D-knapsack over tilgængelige intervaller (eksakt), og rækkehøjder vælges via DP over diskretiseret Y | Eksakt *inden for rækkemodellen* ved fast vinkel. Forventet +1–3 % på uregelmæssige zoner (hypotese H2) | ms pr. vinkel | Middel | Høj; erstatter greedy-kernen | **Gør som næste trin** |
| O4 | **Flere rotationer i samme zone**: opdel zonen (automatisk langs lange kanter eller veje, eller manuelt) og optimér pr. delzone | Kun relevant for uregelmæssige zoner; størrelse ukendt | Lineær | Middel | Middel: overgange giver spildareal og stiomveje | Undersøg på historiske data |
| O5 | **Lokal søgning / LNS**: fjern blokke langs kanten og genudfyld; simulated annealing på blokpositioner | Typisk +1–3 % langs kanter | Sekunder–minutter | Middel | Mindre regulære layouts | Senere, opt-in |
| O6 | **ILP / CP-SAT**: binær variabel pr. kandidatblok på fint gitter, konfliktbetingelser inkl. stiafstand | **Dokumenteret optimum** inden for diskretisering, plus LP-grænse og gap | Sekunder–timer; stort for store zoner | Høj | Ikke i browser (CP-SAT). HiGHS findes som WASM for mindre MIP | **Som benchmark-orakel offline**, ikke som produktionsmotor |
| O7 | **Hybrid**: O1+O2+O3 interaktivt i browseren; O6 offline for at måle gap på benchmarksættet | Kendt kvalitet | God | Middel | Høj | **Anbefalet målarkitektur** |
| O8 | **Multikriterie**: kapacitet, lige stier, få 1-rækkes blokke, tilgængelighed (V8), gangafstand til faciliteter, ensartet orientering | Pareto-front frem for ét tal | Faktor × O1 | Middel–høj | Høj, når kriterierne er afklaret | Efter O1–O3, når kriterier og vægte er besluttet |

### 5.1 Bedste fundne vs. dokumenteret optimum — rapporteringsregel

Hver beregnet kapacitet (K2) rapporteres som:

```
Bedste fundne: 1.081 pladser  (søgning: kant+forfining v2, 2.400 kørsler, seed 0)
Øvre grænse:   1.122 pladser  (metode: LP-relaksering, model: rækkemodel @69,5°)
Gap:           3,7 %
```

Talene i eksemplet er illustrative. Ordet "optimal" bruges kun, når gap = 0 er bevist af en eksakt løser *inden for en navngiven model*, og modellen står ved siden af tallet. Gittertætheden kan vises som "reference", men aldrig kaldes en grænse.

Billige grænser, rangeret efter styrke:

1. `A2 / pladsareal`: strikt, men svag (ignorerer stier).
2. Gittertæthed: reference, ikke strikt.
3. Strip-DP: eksakt for rækkemodellen ved fast vinkel.
4. LP-relaksering af ILP: strikt inden for diskretiseringen.

### 5.2 Multikriterieoptimering — forslag til målemetrikker

| Kriterium | Metrik |
|---|---|
| Kapacitet | Pladser; personer (interval) |
| Udnyttelse | Pladser × pladsareal / A2 |
| Stiregularitet | Andel stilængde, der indgår i gennemgående korridorer ≥ X m |
| Fragmentering | Andel 1-rækkes blokke og blokke < ½ maks. bredde |
| Tilgængelighed | Andel blokke med stiforbindelse til indgang/vej (V8) |
| Gangafstand *(senere)* | Median afstand til nærmeste toilet/vand |

UI'et viser 2–4 Pareto-optimale alternativer ("maks. kapacitet", "lige stier", "få småblokke") med deres metrikker side om side, i stedet for at skjule afvejningen i én vægtet score.

## 6. Reproducerbart benchmark — forslag

**Formål:** enhver ændring i motoren kan måles på løsningskvalitet, gyldighed og tid, mod den nuværende version og mod historiske, menneskeligt optegnede layouts.

| Element | Indhold |
|---|---|
| Datasæt | (1) Syntetiske former A–F fra denne discovery (enhedsniveau). (2) Historiske zoner RF22–RF26 eksporteret fra ArcGIS. (3) De faktisk optegnede felter fra samme år som "menneskelig baseline" |
| Format | GeoJSON i EPSG:25832 + `manifest.json` med SHA-256 pr. fil, produktparametre, eksklusioner og kilde/dato |
| Placering | `bench/fixtures/` i repo (eller R2, hvis data er følsomme) |
| Kørsel | `npm run bench`: deterministisk, faste seeds, én proces pr. strategi, rapporterer JSON + Markdown |
| Metrikker | Pladser, % af gitterreference, % af LP-grænse (hvor kendt), % af menneskelig baseline, valideringsovertrædelser (**skal være 0**), tid p50/p95, antal kørsler |
| Regression | CI fejler, hvis en strategi giver overtrædelser, eller kapaciteten falder > 0,5 % på nogen fixture uden en godkendt baseline-opdatering |
| Orakel | Offline ILP (OR-Tools CP-SAT/HiGHS) på en delmængde for at kende gap |
| Versionering | Motor-semver + git-SHA i hvert resultat, så de kan bindes til snapshots |

Harness'et fra denne discovery (`C:\tmp\csm-bench\`: `harness.js`, `bench-optimizer.js`, `bench-geometry.js`, `bench-edgeseed.js`) er en fungerende første version. Det udtrækker koden mellem markørerne `// ── Coordinate helpers` og `function onToggleStraight` fra `index.html` og kører den uændret. Det kan flyttes ind i repoet ved godkendelse.

## 7. Anbefaling

1. **Straks (lav risiko, stor gevinst):**
   - Søg i 0–180°.
   - Brug kantafledte vinkler og produktperiode-offsets.
   - Optimér pr. zone.
   - Lad straight-paths fase 1 respektere eksklusioner.
   - Fjern "OPTIMAL".
   - Kør søgningen i en Web Worker.

   Forventet gevinst er +0–27 % pr. zone (målt på syntetiske former) og skal bekræftes på historiske data (H1).
2. **Næste:** Strip-DP som ny kerne, med eksakt rækkeløsning, en grænse pr. vinkel og en hurtigere søgning.
3. **Benchmark før alt andet.** Ingen algoritmeændring uden målt effekt på fixture-sættet.
4. **Eksakte metoder som orakel,** ikke som produktionsmotor, indtil benchmarket viser, at gappet er praktisk relevant.
5. **Multikriterie** først, når kriterier og acceptkriterier er formuleret af drift og sikkerhed.
