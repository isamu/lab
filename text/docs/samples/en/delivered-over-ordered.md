<!-- chaff-sample
rule: delivered-over-ordered
genre: business/report
file: delivery-note.md
-->

# A delivered quantity larger than the ordered quantity (`delivered-over-ordered`)

**Where it helps:** delivery notes, goods-received records, lists of open orders. Any table with an ordered and a delivered column.

## Original

```markdown chaff-before
# Delivery note DN-5520

From: Office Supply Co. To: Greenway Primary School, school office. Delivered: November 9, 2026.

| Item | Ordered | Delivered | Backordered |
| --- | --- | --- | --- |
| A4 copier paper, 500 sheets | 40 reams | 40 reams | 0 reams |
| Whiteboard markers, black | 60 markers | 48 markers | 12 markers |
| Glue sticks | 120 sticks | 150 sticks | 0 sticks |
| Laminating pouches, A4 | 200 pouches | 100 pouches | 100 pouches |

Backordered items will be sent as soon as they are back in stock. If anything is missing, please tell us by November 14.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report delivery-note.md

delivery-note.md   business/report · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    150 sticks | 0 sticks |

  ⚠  A delivered quantity larger than the ordered quantity

     The delivered quantity "150 sticks" is larger than the ordered quantity "120 sticks" on the same row
     In the backorder section of a delivery note or a list of open orders, the delivered quantity of a row should not exceed the ordered quantity of the same row. Readers use the table to see what arrived and what is still to come. The delivered quantity exceeds the ordered one when the ordered quantity is copied wrong, when a row is mixed up with another item, or when only the delivered quantity is corrected. Which column is ordered and which is delivered is decided by the heading words alone (Ordered, Qty ordered, Delivered, Shipped), never by where a column stands. Only rows where both cells are written whole numbers in the same unit (40 reams, 300 folders) are compared.

     → Check which of the ordered and delivered quantities is right and correct the other. If more really was delivered, say so outside the table.

     Relax this rule:  npx chaffjs relax delivered-over-ordered


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Delivery note DN-5520

From: Office Supply Co. To: Greenway Primary School, school office. Delivered: November 9, 2026.

| Item | Ordered | Delivered | Backordered |
| --- | --- | --- | --- |
| A4 copier paper, 500 sheets | 40 reams | 40 reams | 0 reams |
| Whiteboard markers, black | 60 markers | 48 markers | 12 markers |
| Glue sticks | 150 sticks | 150 sticks | 0 sticks |
| Laminating pouches, A4 | 200 pouches | 100 pouches | 100 pouches |

Backordered items will be sent as soon as they are back in stock. If anything is missing, please tell us by November 14.
```

## How it was fixed

The school ordered 120 glue sticks, and the note says 150 were delivered with none to follow.
Either the supplier sent 30 extra, which someone will be billed for, or one of the two figures is wrong.
The school office checks the boxes against this note, and an extra 30 on paper is enough to hold up the invoice for a week.

The order had been raised to 150 by phone, and the note kept the first figure.
The fix writes the quantity ordered, 150.
If more really was delivered than ordered, leave the table as it is and say so beside it, so the reader knows it is not a typing slip.

## Settings

A delivered quantity over the ordered one is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  delivered-over-ordered: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

The two columns are found by their headings alone (Ordered, Qty ordered, Delivered, Shipped), never by where they stand.
Only rows where both cells are whole numbers in the same unit are compared.
A table with two delivered columns (delivered before and delivered now), and a blank, a dash or TBD in either cell, are skipped.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain delivered-over-ordered --genre business/report

  A delivered quantity larger than the ordered quantity   (delivered-over-ordered)

  In the backorder section of a delivery note or a list of open orders, the delivered quantity of a row should not exceed the ordered quantity of the same row. Readers use the table to see what arrived and what is still to come. The delivered quantity exceeds the ordered one when the ordered quantity is copied wrong, when a row is mixed up with another item, or when only the delivered quantity is corrected. Which column is ordered and which is delivered is decided by the heading words alone (Ordered, Qty ordered, Delivered, Shipped), never by where a column stands. Only rows where both cells are written whole numbers in the same unit (40 reams, 300 folders) are compared.

  How to fix: Check which of the ordered and delivered quantities is right and correct the other. If more really was delivered, say so outside the table.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax delivered-over-ordered --why "reason"
```

[All samples](README.md)
