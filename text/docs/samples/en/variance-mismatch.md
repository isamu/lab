<!-- chaff-sample
rule: variance-mismatch
genre: business/report
file: society-accounts.md
-->

# A variance that is not the difference of the budget and the actual (`variance-mismatch`)

**Where it helps:** club and society accounts, departmental budgets, project cost reports. Any table with a budget, an actual and a variance column.

## Original

```markdown chaff-before
# Allotment society: accounts for 2026

Presented to the annual general meeting, November 2026.

| Item | Budget | Actual | Variance |
| --- | --- | --- | --- |
| Plot rents | $3,600.00 | $3,480.00 | ($120.00) |
| Water charges | $900.00 | $1,045.60 | $154.60 |
| Seed and compost sales | $400.00 | $462.50 | $62.50 |
| Insurance | $310.00 | $310.00 | $0.00 |

Water cost more than planned because of the dry summer. The committee proposes to fit two more water butts by the main gate.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report society-accounts.md

society-accounts.md   business/report · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    $154.60 |

  ⚠  A variance that is not the difference of the budget and the actual

     "Water charges" shows a variance of "$154.60", but its budget and actual give "$145.60"
     In a table of budget, actual and variance, readers look at the variance column alone to see how far over or under budget each line went. When an actual figure is corrected and its variance is not, or a digit is copied wrong, the variance alone is off. When the headings name one budget column (Budget), one actual column (Actual) and one variance column (Variance, Difference, Over (under)), each row's actual less its budget is compared with the variance written. An amount marked -, −, ▲ or △, or written in brackets, is negative. Some tables write the variance the other way, as the budget less the actual, so the direction is the one most of the table's other rows follow (or, when no row of the table tells, the document's other tables); when the rows split evenly, nothing is said.

     → Check which of the budget, the actual and the variance is right, and correct the others.

     Relax this rule:  npx chaffjs relax variance-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Allotment society: accounts for 2026

Presented to the annual general meeting, November 2026.

| Item | Budget | Actual | Variance |
| --- | --- | --- | --- |
| Plot rents | $3,600.00 | $3,480.00 | ($120.00) |
| Water charges | $900.00 | $1,045.60 | $145.60 |
| Seed and compost sales | $400.00 | $462.50 | $62.50 |
| Insurance | $310.00 | $310.00 | $0.00 |

Water cost more than planned because of the dry summer. The committee proposes to fit two more water butts by the main gate.
```

## How it was fixed

Water cost $1,045.60 against a budget of $900.00, so it went $145.60 over, not $154.60.
Two digits were swapped as the figure was typed.
At an annual general meeting, the variance column is the one members read: it is where the questions come from, and the committee's case for new water butts rests on that line.

The fix works out the difference again and writes $145.60.
If the actual was the figure typed wrong, correct the actual instead, so the row agrees with itself.

## Settings

A variance that does not match its row is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  variance-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

A table is read when its headings name one budget column, one actual column and one variance column (Variance, Difference, Over (under)).
An amount written in brackets, or marked with a minus sign, is negative.
Some tables write the variance as the budget less the actual; chaff follows the direction most of the table's rows take.
A column of rates (Variance %) is not compared.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain variance-mismatch --genre business/report

  A variance that is not the difference of the budget and the actual   (variance-mismatch)

  In a table of budget, actual and variance, readers look at the variance column alone to see how far over or under budget each line went. When an actual figure is corrected and its variance is not, or a digit is copied wrong, the variance alone is off. When the headings name one budget column (Budget), one actual column (Actual) and one variance column (Variance, Difference, Over (under)), each row's actual less its budget is compared with the variance written. An amount marked -, −, ▲ or △, or written in brackets, is negative. Some tables write the variance the other way, as the budget less the actual, so the direction is the one most of the table's other rows follow (or, when no row of the table tells, the document's other tables); when the rows split evenly, nothing is said.

  How to fix: Check which of the budget, the actual and the variance is right, and correct the others.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax variance-mismatch --why "reason"
```

[All samples](README.md)
