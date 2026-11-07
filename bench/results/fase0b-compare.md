# Fase 0B — gammel vs. ny Optimize (identiske inputs)

Gammel: én fælles indstilling for alle zoner, 0–85° i 5°-trin × X[0,17,34] × Y[0,8,16]. Ny: optimizeZone pr. zone (se index.html).
Gyldighed: uafhængig validator (bench/lib/validate.mjs), tolerance 1 cm². Node v25.6.1.

| Case | Algoritme | Gammel | Ny | Gevinst | Gammel tid | Ny tid | Kørsler gammel/ny | Gyldig gammel/ny |
|---|---|---:|---:|---:|---:|---:|---:|---|
| A_rect_300x200|GAP_5x10 | greedy | 826 | 864 | +4.6 % | 184 ms | 822 ms | 162/756 | ✔ / ✔ |
| A_rect_300x200|GAP_5x10 | straight | 764 | 864 | +13.1 % | 124 ms | 659 ms | 162/756 | ✔ / ✔ |
| A_rect_300x200|SYN_6x8 | greedy | 517 | 532 | +2.9 % | 50 ms | 243 ms | 162/756 | ✔ / ✔ |
| A_rect_300x200|SYN_6x8 | straight | 512 | 532 | +3.9 % | 81 ms | 452 ms | 162/756 | ✔ / ✔ |
| B_rect_rot23|GAP_5x10 | greedy | 864 | 864 | +0 % | 304 ms | 1495 ms | 162/759 | ✔ / ✔ |
| B_rect_rot23|GAP_5x10 | straight | 864 | 864 | +0 % | 203 ms | 1014 ms | 162/759 | ✔ / ✔ |
| B_rect_rot23|SYN_6x8 | greedy | 532 | 532 | +0 % | 87 ms | 450 ms | 162/759 | ✔ / ✔ |
| B_rect_rot23|SYN_6x8 | straight | 532 | 532 | +0 % | 136 ms | 642 ms | 162/759 | ✔ / ✔ |
| C_L_shape|GAP_5x10 | greedy | 624 | 648 | +3.8 % | 242 ms | 1212 ms | 162/756 | ✔ / ✔ |
| C_L_shape|GAP_5x10 | straight | 563 | 648 | +15.1 % | 165 ms | 788 ms | 162/756 | ✔ / ✔ |
| C_L_shape|SYN_6x8 | greedy | 381 | 399 | +4.7 % | 70 ms | 311 ms | 162/757 | ✔ / ✔ |
| C_L_shape|SYN_6x8 | straight | 375 | 395 | +5.3 % | 106 ms | 577 ms | 162/757 | ✔ / ✔ |
| D_irregular|GAP_5x10 | greedy | 1065 | 1073 | +0.8 % | 522 ms | 2996 ms | 162/999 | ✔ / ✔ |
| D_irregular|GAP_5x10 | straight | 997 | 1023 | +2.6 % | 276 ms | 1906 ms | 162/996 | ✔ / ✔ |
| D_irregular|SYN_6x8 | greedy | 695 | 696 | +0.1 % | 143 ms | 865 ms | 162/999 | ✔ / ✔ |
| D_irregular|SYN_6x8 | straight | 651 | 664 | +2 % | 199 ms | 1768 ms | 162/996 | ✔ / ✔ |
| E_strip_62x400|GAP_5x10 | greedy | 326 | 352 | +8 % | 392 ms | 1694 ms | 162/757 | ✔ / ✔ |
| E_strip_62x400|GAP_5x10 | straight | 284 | 352 | +23.9 % | 242 ms | 1604 ms | 162/757 | ✔ / ✔ |
| E_strip_62x400|SYN_6x8 | greedy | 204 | 224 | +9.8 % | 93 ms | 443 ms | 162/757 | ✔ / ✔ |
| E_strip_62x400|SYN_6x8 | straight | 198 | 224 | +13.1 % | 131 ms | 999 ms | 162/756 | ✔ / ✔ |
| F_trapezoid|GAP_5x10 | greedy | 622 | 629 | +1.1 % | 370 ms | 1716 ms | 162/797 | ✔ / ✔ |
| F_trapezoid|GAP_5x10 | straight | 587 | 624 | +6.3 % | 240 ms | 1371 ms | 162/797 | ✔ / ✔ |
| F_trapezoid|SYN_6x8 | greedy | 402 | 416 | +3.5 % | 101 ms | 479 ms | 162/796 | ✔ / ✔ |
| F_trapezoid|SYN_6x8 | straight | 370 | 416 | +12.4 % | 187 ms | 1191 ms | 162/797 | ✔ / ✔ |
| SITE_MIX(7 zones)|GAP_5x10 | greedy | 3151 | 3448 | +9.4 % | 1809 ms | 7773 ms | 1134/5294 | ✔ / ✔ |
| SITE_MIX(7 zones)|GAP_5x10 | straight | 2796 | 3388 | +21.2 % | 930 ms | 5517 ms | 1134/5293 | ✔ / ✔ |
| SITE_MIX(7 zones)|SYN_6x8 | greedy | 2040 | 2199 | +7.8 % | 470 ms | 2084 ms | 1134/5297 | ✔ / ✔ |
| SITE_MIX(7 zones)|SYN_6x8 | straight | 1815 | 2199 | +21.2 % | 688 ms | 3870 ms | 1134/5298 | ✔ / ✔ |

Gevinst: min 0 %, median 4.7 %, maks 23.9 %. Ny < gammel i 0 af 28 tilfælde.
Gyldighed: 28/28 nye og 28/28 gamle layouts uden overtrædelser.
Tid (ny): maks 7773 ms pr. case; maks pr. zone 2996 ms (enkeltzone-fixtures).
