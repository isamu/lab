<!-- chaff-sample
rule: table-row-overflow
genre: business/report
file: supplier-review.md
-->

# Table row with more cells than the header (`table-row-overflow`)

**Where it helps:** reports, price comparisons, plans. Any Markdown table that someone added a column to by hand.

## Original

```markdown chaff-before
# Stationery suppliers: price review

| Supplier | Price per box | Delivery |
| --- | --- | --- |
| Northgate Paper | $24.50 | Next day |
| Riverside Office | $22.90 | 3 days | minimum order 10 boxes |
| Bluebell Supplies | $26.00 | Next day |
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report supplier-review.md

supplier-review.md   business/report · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    | Riverside Office | $22.90 | 3 days | minimum order 10 boxes |

  ⚠  Table row with more cells than the header

     This row has 4 cells; past the header's 3 columns they are not shown
     A Markdown table (GFM) shows only as many cells as its header row has, and silently drops the rest. It happens when a value holds a "|", or when a column was added to the rows but not to the header, and the reader never sees the value that was written.

     → Add the column to the header row, or remove the extra cell. Write a "|" inside a value as "\|".

     Relax this rule:  npx chaffjs relax table-row-overflow


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Stationery suppliers: price review

| Supplier | Price per box | Delivery | Note |
| --- | --- | --- | --- |
| Northgate Paper | $24.50 | Next day | — |
| Riverside Office | $22.90 | 3 days | Minimum order 10 boxes |
| Bluebell Supplies | $26.00 | Next day | — |
```

## How it was fixed

The Riverside row has a fourth cell, "minimum order 10 boxes", but the header has only three columns.
A Markdown table shows only as many cells as its header, so the note is dropped without a sign when the table is shown.
Whoever reads the review sees Riverside as the cheapest supplier, and never learns that it needs an order of ten boxes.

The fix adds a "Note" column to the header and fills it for every row.
A "|" inside a value has the same effect; write it as `\|`.

## Settings

A row with more cells than the header is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your tables are shown by a tool that keeps the extra cells, relax it:

```yaml chaff-settings
rules:
  table-row-overflow: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain table-row-overflow --genre business/report

  Table row with more cells than the header   (table-row-overflow)

  A Markdown table (GFM) shows only as many cells as its header row has, and silently drops the rest. It happens when a value holds a "|", or when a column was added to the rows but not to the header, and the reader never sees the value that was written.

  How to fix: Add the column to the header row, or remove the extra cell. Write a "|" inside a value as "\|".

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax table-row-overflow --why "reason"
```

[All samples](README.md)
