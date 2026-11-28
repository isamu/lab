<!-- chaff-sample
rule: table-unit-mix
genre: business/report
file: q2-results.md
-->

# A table that mixes scales of amount (`table-unit-mix`)

**Where it helps:** financial statements, results summaries, budgets. Any table with one stated unit of amount.

## Original

```markdown chaff-before
# Second-quarter results

Revenue rose 11% on the same quarter last year, led by subscriptions.

(In thousands of US dollars)

| Item | Q2 2025 | Q2 2026 |
| --- | --- | --- |
| Revenue | 8,420 | 9,310 |
| Gross profit | 3,960 | 4,470 |
| Operating expenses | 2,880 | 3,050 |
| Operating profit | 1,080 | 1,420 |
| Net profit | 812,000 | 1,064,000 |
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report q2-results.md

q2-results.md   business/report · English   genre from --genre

─── line 13 ──────────────────────────────────────────────────

    812,000 | 1,064,000 |

  ⚠  A table that mixes scales of amount

     "Net profit" is "812,000", about a thousand times the other rows (in thousands, 812?)
     When a table "(In millions of US dollars)" has one row in thousands (52,000 among 1,200 and 84) or one cell written "$110,000 thousand", the reader takes that row as a thousand times what it is. It happens when a row is copied from another statement, or when millions are turned into thousands and the unit is not changed. A short line right above the table with "in" or "of" and one word of scale (millions, thousands) is read as the table's unit; without one, the word of scale most cells carry is. A cell written in another scale than the table's is pointed out (once per row), and so is a row, under a stated unit, entered a thousand times as large as the others.

     → Write the row in the table's unit, or, if the row really is in another unit, put its unit in the row's label ("Employees (persons)").

     Relax this rule:  npx chaffjs relax table-unit-mix


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Second-quarter results

Revenue rose 11% on the same quarter last year, led by subscriptions.

(In thousands of US dollars)

| Item | Q2 2025 | Q2 2026 |
| --- | --- | --- |
| Revenue | 8,420 | 9,310 |
| Gross profit | 3,960 | 4,470 |
| Operating expenses | 2,880 | 3,050 |
| Operating profit | 1,080 | 1,420 |
| Net profit | 812 | 1,064 |
```

## How it was fixed

The table is in thousands of dollars, but net profit is 812,000 and 1,064,000: the row was entered in dollars.
Read in the table's unit, it says the company made 812 million dollars on revenue of 8.4 million.
It happens when a row is copied from another statement.

The fix writes the row in thousands.
chaff reads the line "(In thousands of US dollars)" above the table as its unit, and reports a row that is a thousand times the others in every column.
A row that really is in another unit can say so in its label ("Employees (persons)").

## Settings

A table that mixes scales is a warning at the default level, an error at `strict` and a note at `relaxed`.

To relax it:

```yaml chaff-settings
rules:
  table-unit-mix: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain table-unit-mix --genre business/report

  A table that mixes scales of amount   (table-unit-mix)

  When a table "(In millions of US dollars)" has one row in thousands (52,000 among 1,200 and 84) or one cell written "$110,000 thousand", the reader takes that row as a thousand times what it is. It happens when a row is copied from another statement, or when millions are turned into thousands and the unit is not changed. A short line right above the table with "in" or "of" and one word of scale (millions, thousands) is read as the table's unit; without one, the word of scale most cells carry is. A cell written in another scale than the table's is pointed out (once per row), and so is a row, under a stated unit, entered a thousand times as large as the others.

  How to fix: Write the row in the table's unit, or, if the row really is in another unit, put its unit in the row's label ("Employees (persons)").

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax table-unit-mix --why "reason"
```

[All samples](README.md)
