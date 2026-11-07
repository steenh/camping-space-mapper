# Benchmark — nuværende app (index.html)

Søgning: 18 angles (0–85°, step 5) × offsets X[0,17,34] × Y[0,8,16]. Gitterreference = areal / analytisk gittertæthed (ikke en øvre grænse).

| Zone | Produkt | Areal (m²) | Gitter-ref. | Greedy | % | Straight | % |
|---|---|---:|---:|---:|---:|---:|---:|
| A_rect_300x200 | GAP_5x10 | 59993 | 873 | 826 @85° | 94.6 | 764 @0° | 87.5 |
| A_rect_300x200 | SYN_6x8 | 59993 | 547 | 517 @60° | 94.5 | 512 @0° | 93.6 |
| B_rect_rot23 | GAP_5x10 | 59993 | 873 | 864 @20° | 99 | 864 @20° | 99 |
| B_rect_rot23 | SYN_6x8 | 59993 | 547 | 532 @20° | 97.3 | 532 @20° | 97.3 |
| C_L_shape | GAP_5x10 | 44995 | 654 | 624 @85° | 95.4 | 563 @0° | 86.1 |
| C_L_shape | SYN_6x8 | 44995 | 410 | 381 @85° | 92.9 | 375 @0° | 91.5 |
| D_irregular | GAP_5x10 | 79590 | 1158 | 1065 @65° | 92 | 997 @25° | 86.1 |
| D_irregular | SYN_6x8 | 79590 | 726 | 695 @70° | 95.7 | 651 @20° | 89.7 |
| E_strip_62x400 | GAP_5x10 | 24797 | 361 | 326 @0° | 90.3 | 284 @85° | 78.7 |
| E_strip_62x400 | SYN_6x8 | 24797 | 226 | 204 @0° | 90.3 | 198 @85° | 87.6 |
| F_trapezoid | GAP_5x10 | 46744 | 680 | 622 @85° | 91.5 | 587 @85° | 86.3 |
| F_trapezoid | SYN_6x8 | 46744 | 426 | 402 @85° | 94.4 | 370 @5° | 86.9 |

## Fejlprober

```json
{
 "hole": {
  "spaces": 695,
  "spaces_intersecting_hole": 0
 },
 "multipolygon": {
  "spaces": 253,
  "terminates": true
 },
 "overlap": {
  "spaces": [
   539,
   411
  ],
  "overlapping_pairs": 0,
  "max_overlap_m2": 0,
  "sum_area_m2": 79797,
  "shown_area_m2": 69822
 }
}
```

Tider (ikke deterministiske, v25.6.1): se `latest-timings.json`.
