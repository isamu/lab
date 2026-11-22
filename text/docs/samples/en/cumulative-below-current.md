<!-- chaff-sample
rule: cumulative-below-current
genre: business/report
file: sales-report.md
-->

# A cumulative figure lower than this period's (`cumulative-below-current`)

**Where it helps:** monthly sales reports, pay statements with a year-to-date column, budget reports. Any table with "this month" beside "year to date".

## Original

```markdown chaff-before
# Monthly sales report: October 2026

Garden centre, all departments.

| Department | This month | Year to date |
| --- | --- | --- |
| Plants and trees | £48,210 | £512,640 |
| Tools and furniture | £21,880 | £236,400 |
| Café | £14,320 | £9,815 |
| Pet supplies | £8,940 | £91,270 |

October was steady. The café had its best month since it reopened in the spring.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report sales-report.md

sales-report.md   business/report · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    £9,815 |

  ⚠  A cumulative figure lower than this period's

     The cumulative figure "£9,815" is lower than this period's "£14,320"
     The "year to date" of a payslip, the "cumulative" of a monthly sales report and the "YTD actual" of a budget report are totals that include this period's figure. A total cannot be smaller than a part it includes. It goes wrong when a digit of the cumulative figure is dropped, when a row is copied one line off, or when last month's table is reused and its cumulative figures are not updated. Which column is this period and which the cumulative one is decided by the heading words alone (This month, This period, Current, Year to date, YTD, Cumulative), never by where a column stands. A column up to an earlier period ("Prior YTD", "Brought forward") does not hold this period and is not read as the cumulative one. Only figures of zero or more written in the same unit are compared, and each may be rounded to half its last digit.

     → Check whether the cumulative figure or this period's figure is right, and correct the other.

     Relax this rule:  npx chaffjs relax cumulative-below-current


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Monthly sales report: October 2026

Garden centre, all departments.

| Department | This month | Year to date |
| --- | --- | --- |
| Plants and trees | £48,210 | £512,640 |
| Tools and furniture | £21,880 | £236,400 |
| Café | £14,320 | £98,150 |
| Pet supplies | £8,940 | £91,270 |

October was steady. The café had its best month since it reopened in the spring.
```

## How it was fixed

The year-to-date figure includes October, so it can never be smaller than October alone.
The café took £14,320 this month, and the table says £9,815 for the whole year.
A final zero was dropped: the figure should be £98,150.
Without the fix, the café looks like a department that barely trades, in the same report that calls October its best month.

The fix writes the cumulative figure in full.
When a row of a table like this is wrong, also check that the rows were not shifted by one line when last month's report was copied.

## Settings

A cumulative figure below this period's is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  cumulative-below-current: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

The two columns are found by their headings alone (This month, This period, Year to date, YTD, Cumulative).
A column up to an earlier period ("Prior YTD", "Brought forward") is not read as the cumulative one.
A row with a negative figure is skipped, since a refund can make a year-to-date figure fall below this period's; so is a row of averages, rates or balances.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain cumulative-below-current --genre business/report

  A cumulative figure lower than this period's   (cumulative-below-current)

  The "year to date" of a payslip, the "cumulative" of a monthly sales report and the "YTD actual" of a budget report are totals that include this period's figure. A total cannot be smaller than a part it includes. It goes wrong when a digit of the cumulative figure is dropped, when a row is copied one line off, or when last month's table is reused and its cumulative figures are not updated. Which column is this period and which the cumulative one is decided by the heading words alone (This month, This period, Current, Year to date, YTD, Cumulative), never by where a column stands. A column up to an earlier period ("Prior YTD", "Brought forward") does not hold this period and is not read as the cumulative one. Only figures of zero or more written in the same unit are compared, and each may be rounded to half its last digit.

  How to fix: Check whether the cumulative figure or this period's figure is right, and correct the other.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax cumulative-below-current --why "reason"
```

[All samples](README.md)
