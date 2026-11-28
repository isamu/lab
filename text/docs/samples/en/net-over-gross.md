<!-- chaff-sample
rule: net-over-gross
genre: business/report
file: packing-list.md
-->

# A net weight larger than the gross weight (`net-over-gross`)

**Where it helps:** packing lists, shipping documents, customs declarations. Any table with a net and a gross weight per carton.

## Original

```markdown chaff-before
# Packing list

Shipper: Northfield Ceramics Ltd. Consignee: Lakeside Home Stores. Invoice no. NC-2611.

| Carton | Contents | Qty | Net weight | Gross weight |
| --- | --- | --- | --- | --- |
| 1 | Dinner plates, 27 cm | 48 | 31.2 kg | 34.0 kg |
| 2 | Side plates, 20 cm | 72 | 25.9 kg | 28.4 kg |
| 3 | Pasta bowls | 36 | 29.8 kg | 26.5 kg |
| 4 | Mugs, 350 ml | 96 | 33.6 kg | 37.1 kg |

All cartons are double-walled and marked FRAGILE on two sides.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report packing-list.md

packing-list.md   business/report · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    29.8 kg | 26.5 kg |

  ⚠  A net weight larger than the gross weight

     The net weight "29.8 kg" is larger than the gross weight "26.5 kg" on the same row
     On a packing list, the net weight is the goods alone and the gross weight includes the cartons and packing, so the net weight of a row cannot exceed its gross weight. It does when the net weight is copied wrong, when a row is mixed up with another carton, or when only the gross weight is corrected. Which column is net and which is gross is decided by the heading words alone (Net weight, N.W., Gross weight, G.W.), never by where a column stands. Only rows where both cells are written numbers (96.0 kg) are compared, the totals row too. Grams, kilograms, tonnes and pounds are converted by the units word list; other units are compared only with the same unit.

     → Check which of the net and gross weights is right and correct the other.

     Relax this rule:  npx chaffjs relax net-over-gross


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Packing list

Shipper: Northfield Ceramics Ltd. Consignee: Lakeside Home Stores. Invoice no. NC-2611.

| Carton | Contents | Qty | Net weight | Gross weight |
| --- | --- | --- | --- | --- |
| 1 | Dinner plates, 27 cm | 48 | 31.2 kg | 34.0 kg |
| 2 | Side plates, 20 cm | 72 | 25.9 kg | 28.4 kg |
| 3 | Pasta bowls | 36 | 23.8 kg | 26.5 kg |
| 4 | Mugs, 350 ml | 96 | 33.6 kg | 37.1 kg |

All cartons are double-walled and marked FRAGILE on two sides.
```

## How it was fixed

The net weight is the goods alone; the gross weight adds the carton and the packing.
Carton 3 claims 29.8 kg of bowls in a carton that weighs 26.5 kg in all, which cannot be.
A customs officer or a freight forwarder who notices it will ask which figure is right, and a shipment can sit in a warehouse while the question is answered.

The bowls were weighed at 23.8 kg, and a 3 was typed for the 2.
The fix corrects the net weight, so carton 3 now carries 2.7 kg of packing, in line with the other cartons.
If the gross weight was the wrong one, correct that instead.

## Settings

A net weight over the gross weight is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  net-over-gross: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

The net and gross columns are found by their headings alone (Net weight, N.W., Gross weight, G.W.), never by where they stand.
Only rows where both cells are written weights are compared; grams, kilograms, tonnes and pounds are converted to each other.
A blank cell, a dash, TBD or an approximate weight is skipped.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain net-over-gross --genre business/report

  A net weight larger than the gross weight   (net-over-gross)

  On a packing list, the net weight is the goods alone and the gross weight includes the cartons and packing, so the net weight of a row cannot exceed its gross weight. It does when the net weight is copied wrong, when a row is mixed up with another carton, or when only the gross weight is corrected. Which column is net and which is gross is decided by the heading words alone (Net weight, N.W., Gross weight, G.W.), never by where a column stands. Only rows where both cells are written numbers (96.0 kg) are compared, the totals row too. Grams, kilograms, tonnes and pounds are converted by the units word list; other units are compared only with the same unit.

  How to fix: Check which of the net and gross weights is right and correct the other.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax net-over-gross --why "reason"
```

[All samples](README.md)
