<!-- chaff-sample
rule: backorder-mismatch
genre: business/report
file: delivery-note.md
-->

# A backordered quantity that is not the ordered less the delivered (`backorder-mismatch`)

**Where it helps:** delivery notes, open-order reports, purchase follow-ups. Any table that says how much is still to come.

## Original

```markdown chaff-before
# Delivery note DN-4471

Order: PO-2291, placed 3 November
Delivered to: Harbour Street office, goods-in

| Item | Ordered | Delivered | Backordered |
| --- | --- | --- | --- |
| A4 copier paper (box of 5 reams) | 40 boxes | 25 boxes | 15 boxes |
| Toner cartridge, black | 12 cartridges | 12 cartridges | 0 cartridges |
| Staples (box) | 50 boxes | 30 boxes | 25 boxes |

The backordered items will follow on our next delivery round, within ten working days.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report delivery-note.md

delivery-note.md   business/report · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    25 boxes |

  ⚠  A backordered quantity that is not the ordered less the delivered

     The backordered quantity "25 boxes" is written, but the ordered and delivered quantities on the row give 20 boxes
     In the backorder section of a delivery note or a list of open orders, the backordered (remaining, outstanding) quantity of a row is the ordered quantity less the delivered quantity of the same row. Readers learn from it how much is still to come and do not do the subtraction again. It goes wrong when only the delivered quantity is corrected, when the remainder of another row is copied, or when a digit is mistyped. Which column is ordered, delivered and backordered is decided by the heading words alone (Ordered, Delivered, Shipped, Backordered, Remaining, Outstanding), never by where a column stands. Only rows where all three cells are written whole numbers in the same unit are compared.

     → Check which of the ordered, delivered and backordered quantities is right, and correct the others.

     Relax this rule:  npx chaffjs relax backorder-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Delivery note DN-4471

Order: PO-2291, placed 3 November
Delivered to: Harbour Street office, goods-in

| Item | Ordered | Delivered | Backordered |
| --- | --- | --- | --- |
| A4 copier paper (box of 5 reams) | 40 boxes | 25 boxes | 15 boxes |
| Toner cartridge, black | 12 cartridges | 12 cartridges | 0 cartridges |
| Staples (box) | 50 boxes | 30 boxes | 20 boxes |

The backordered items will follow on our next delivery round, within ten working days.
```

## How it was fixed

Fifty boxes of staples were ordered and thirty delivered, so twenty are still to come.
The note said twenty-five: the warehouse first packed twenty-five boxes, found five more on the shelf, and corrected only the delivered column.
The office manager checks the next delivery against this note, and would either chase five boxes that are not owed or accept a short delivery as complete.

The fix writes the remainder the row gives, 20 boxes.
If the delivered count is the wrong one, correct that instead; the three cells of a row must still agree.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  backorder-mismatch: relaxed
```

Which column is which is decided by the heading words alone (Ordered, Delivered, Shipped, Backordered, Remaining, Outstanding), never by position.
A row is compared only when its three cells are whole numbers in the same unit.
A table with two delivered columns (previously and now), a blank or "TBD" cell, and a row with another count in the same unit are left alone.
A row that delivered more than was ordered is the job of `delivered-over-ordered`.

```text chaff-explain
$ npx chaffjs explain backorder-mismatch --genre business/report

  A backordered quantity that is not the ordered less the delivered   (backorder-mismatch)

  In the backorder section of a delivery note or a list of open orders, the backordered (remaining, outstanding) quantity of a row is the ordered quantity less the delivered quantity of the same row. Readers learn from it how much is still to come and do not do the subtraction again. It goes wrong when only the delivered quantity is corrected, when the remainder of another row is copied, or when a digit is mistyped. Which column is ordered, delivered and backordered is decided by the heading words alone (Ordered, Delivered, Shipped, Backordered, Remaining, Outstanding), never by where a column stands. Only rows where all three cells are written whole numbers in the same unit are compared.

  How to fix: Check which of the ordered, delivered and backordered quantities is right, and correct the others.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax backorder-mismatch --why "reason"
```

[All samples](README.md)
