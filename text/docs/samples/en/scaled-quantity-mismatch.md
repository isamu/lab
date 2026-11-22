<!-- chaff-sample
rule: scaled-quantity-mismatch
genre: blog/owned-media
file: chicken-curry.md
-->

# One row of a servings table that does not scale with the others (`scaled-quantity-mismatch`)

**Where it helps:** recipes with a column per number of servings, catering quantities, any table that scales by a ratio.

## Original

```markdown chaff-before
# Weeknight chicken curry

A mild curry that is ready in forty minutes. Double it for a crowd, or freeze half.

| Ingredient | Serves 4 | Serves 8 |
| --- | --- | --- |
| Chicken thighs | 600 g | 1.2 kg |
| Onion | 1 | 2 |
| Coconut milk | 400 ml | 800 ml |
| Curry paste | 3 tablespoons | 3 tablespoons |
| Rice | 300 g | 600 g |

Fry the onion until soft, add the curry paste and the chicken, then the coconut milk, and simmer for twenty minutes.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/owned-media chicken-curry.md

chicken-curry.md   blog/owned-media · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    3 tablespoons |

  ⚠  One row of a servings table that does not scale with the others

     "Curry paste" Serves 8 "3 tablespoons" does not scale like the other 4 rows (from Serves 4 "3 tablespoons", the ratio gives 6)
     In an ingredients table with one column per number of servings ("Serves 4 | Serves 8"), when every other row doubles and one stays the same (Ketchup 4 tablespoons | 4 tablespoons), whoever cooks from that column gets the amount wrong. It happens when a column is added and one row is not updated. A table is read when two or more of its column headings are only a number of servings or a multiple (Serves 4, 8 servings, ×2, 4人分). Each row is compared with the first such column, and a cell is reported when at least three rows scale exactly by the columns' ratio and exactly one does not. Amounts are read with their units, and only cells in the same unit are compared (g and kg are converted). With three or more columns, a row that is off against every other column, while those columns scale with each other, is reported once, at its first column.

     → Correct the amount to the columns' ratio. If the amount is meant to stay the same, write it as an amount left to the cook ("to taste", "as needed") and it is not reported.

     Relax this rule:  npx chaffjs relax scaled-quantity-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Weeknight chicken curry

A mild curry that is ready in forty minutes. Double it for a crowd, or freeze half.

| Ingredient | Serves 4 | Serves 8 |
| --- | --- | --- |
| Chicken thighs | 600 g | 1.2 kg |
| Onion | 1 | 2 |
| Coconut milk | 400 ml | 800 ml |
| Curry paste | 3 tablespoons | 6 tablespoons |
| Rice | 300 g | 600 g |

Fry the onion until soft, add the curry paste and the chicken, then the coconut milk, and simmer for twenty minutes.
```

## How it was fixed

Every row doubles from 4 servings to 8, except the curry paste, which stays at 3 tablespoons.
Whoever cooks for eight gets a curry with half the flavour.
It happens when the second column is added and one row is not updated.

The fix doubles the curry paste.
If an amount is meant to stay the same, write it as one left to the cook ("to taste") and it is not reported.
chaff reports a row only when at least three others scale exactly and this one alone does not.

## Settings

A row that does not scale is a warning at the default level, an error at `strict` and a note at `relaxed`.

If your tables keep some amounts fixed on purpose, relax it:

```yaml chaff-settings
rules:
  scaled-quantity-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain scaled-quantity-mismatch --genre blog/owned-media

  One row of a servings table that does not scale with the others   (scaled-quantity-mismatch)

  In an ingredients table with one column per number of servings ("Serves 4 | Serves 8"), when every other row doubles and one stays the same (Ketchup 4 tablespoons | 4 tablespoons), whoever cooks from that column gets the amount wrong. It happens when a column is added and one row is not updated. A table is read when two or more of its column headings are only a number of servings or a multiple (Serves 4, 8 servings, ×2, 4人分). Each row is compared with the first such column, and a cell is reported when at least three rows scale exactly by the columns' ratio and exactly one does not. Amounts are read with their units, and only cells in the same unit are compared (g and kg are converted). With three or more columns, a row that is off against every other column, while those columns scale with each other, is reported once, at its first column.

  How to fix: Correct the amount to the columns' ratio. If the amount is meant to stay the same, write it as an amount left to the cook ("to taste", "as needed") and it is not reported.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax scaled-quantity-mismatch --why "reason"
```

[All samples](README.md)
