# Kendte begrænsninger

> Register over kendte begrænsninger i Camping Space Mapper, der kan påvirke kapacitetstal. Oprettet 2026-11-07 (G0-krav 5).
> Regel: **Et kapacitetstal fra en zone, der er berørt af en aktiv begrænsning med konsekvens "tal kan være forkert", må ikke bruges eller godkendes uden en dokumenteret manuel kontrol.** Begrænsninger lukkes ved en ny post i [Beslutningslog](DECISION-LOG.md) eller ved en rettelse med test, aldrig ved at blive slettet herfra.

| ID | Begrænsning | Konsekvens for kapacitet | Synlig i appen? | Afhjælpning nu | Planlagt løsning | Status |
|---|---|---|---|---|---|---|
| KB-01 | Når en zone overlapper et **hul** i en tidligere zone, bruger ingen af zonerne arealet i hullet. Overlap udelukkes som yderring, ikke som polygon med huller | **Undervurderet** kapacitet for den senere zone (aldrig dobbeltplacering) | Ja: rød advarsel i arealisten med tabt areal i m², og "⚠ Capacity understated" i statuslinjen efter Calculate/Optimize | Kontrollér zonen manuelt; undgå overlappende zoner (GIS-krav 14) | Ægte polygondifferens i den nye motor (prototype P2) | Aktiv |
| KB-02 | Hvis ArcGIS afviser tokenet, viste appen lag-panelet uden features og uden fejlbesked | — | Ja: lagstatus skelner "tomt lag", "ikke autoriseret" (afslutter sessionen og viser login med begrundelse) og "kunne ikke indlæses"; timer ved tokenudløb | — | — | **Lukket** 2026-11-07 (commit `0c6fe97`; lagkontrollen sendte i første version ikke tokenet, rettet i `5570cf7` efter login-testen; tests i `tests/static.test.mjs`) |
| KB-03 | Appen har ingen skrivevej til ArcGIS (A9: push og skriveproxy fjernet; read-only-vagt i browseren). En bruger med skriverettigheder i ArcGIS kan dog stadig skrive direkte i ArcGIS uden om appen | Ingen | Ja: "read-only" ved laget og i eksportafsnittet | Skriverettigheder styres i ArcGIS | — (uden for appens ansvar) | Aktiv (uden for appens kontrol) |
| KB-04 | Straight paths fase 1 (kolonnebredder) ser bort fra eksklusioner, huller og overlap; fase 2 respekterer dem | Lidt lavere kapacitet i straight paths nær forhindringer | Nej | Sammenlign med greedy | Ny placeringskerne (fase 3) | Aktiv |
| KB-05 | Hvis `turf.union` fejler, viser bruttoareal summen af zonerne (kun `console.warn`) | Bruttoareal kan være for højt ved overlap | Nej | Tjek konsollen ved overlappende zoner | Robust union i ny motor (P2) | Aktiv |
| KB-06 | Sti 0 m i produktdialogen bliver til 5 m (`|| 5`, eksisterende adfærd) | Produktet kan ikke beskrives med sti 0 | Nej | — | Ingen stille standardværdier (P5) | Aktiv |
| KB-07 | Optimize er en søgning: "BEST FOUND" er bedste fundne layout, ikke et bevist optimum | Kapaciteten kan være højere end vist | Ja: "BEST FOUND"-mærket har en forklaring | — | Grænse og gap (fase 3) | Aktiv |
| KB-08 | Projektion: lokal ækvirektangulær tilnærmelse (+0,23 % øst–vest); arealer via `turf.area` (kugle, −0,24 %) | Systematisk afvigelse ≈ 0,2 % | Nej | — | Beregning i EPSG:25832 (P2) | Aktiv |
