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
