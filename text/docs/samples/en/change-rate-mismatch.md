<!-- chaff-sample
rule: change-rate-mismatch
genre: business/report
file: library-report.md
-->

# A rate of change the two values do not give (`change-rate-mismatch`)

**Where it helps:** annual reports, press releases, newsletters, results tables. Any sentence or row that gives last year's figure, this year's and the change between them.

## Original

```markdown chaff-before
# Library service: annual report 2025–26

## Visits and loans

It was a busy year for the branch libraries. Together they had 186,400 visits, up 12% from 152,800 visits the year before, helped by the longer Saturday hours. Loans of e-books grew too, and the children's summer reading challenge had its largest intake yet.

## Next year

We will open the Eastgate branch on Sunday afternoons from April.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report library-report.md

library-report.md   business/report · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    12% from 152,800 visits the year before, helped by the longer Saturday hours. Lo

  ⚠  A rate of change the two values do not give

     "12%" is written, but the two values give 22%
     When one sentence gives the earlier value, the current one and the rate of change ("1,200 companies, up 20% from 1,000"), readers trust the rate without checking it. It goes wrong when one figure is updated and the others are not, or when the rate is copied from last year's text. When a sentence has one earlier value (marked by "from" or "compared with"), one current value in the same unit, and one percentage with a word of direction (up, decline), chaff computes the rate from the two values and compares. Right after "up 20% from" or "down 20% from", the earlier value may be written without its noun, and it is read in the unit of the value just before the rate ("1,300 companies, up 30% from 1,000", "Visits reached 186,400, up 22% from 152,800 the year before"). The two values may also stand together right before the rate ("rose from $1.0 million last year to $1.5 million, an increase of 50%", "$1.0 million in 2025 and $1.5 million in 2026, up 50%"; with years, the earlier year's value is the earlier one). The rate may also come first, with the value reached and then the earlier one ("rose 10.0% to $2,640 million from $2,400 million"). Each value may be rounded to its last written digit ($12 million is anything from $11.5 million to $12.5 million). Tables are read too. When the headings name one column of the earlier value (Prior year), one of the current value (Current year) and one of the rate (YoY, Change (%)), or two columns are each headed by one year (FY2025, FY2026; the earlier year's column holds the earlier value), each row's rate is computed from its two values and compared. A rate marked -, −, ▲ or △ is a decrease. A column headed only "Change" or "Growth" is read as a rate only where its cells carry %.

     → Check which of the two values and the rate is right, and correct the others.

     Relax this rule:  npx chaffjs relax change-rate-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Library service: annual report 2025–26

## Visits and loans

It was a busy year for the branch libraries. Together they had 186,400 visits, up 22% from 152,800 visits the year before, helped by the longer Saturday hours. Loans of e-books grew too, and the children's summer reading challenge had its largest intake yet.

## Next year

We will open the Eastgate branch on Sunday afternoons from April.
```

## How it was fixed

From 152,800 visits to 186,400 is a rise of 22%, not 12%.
A digit slipped, or last year's rate stayed in the sentence when this year's figures went in.
Either way, the report undersells the year: the longer Saturday hours did far more than the sentence says, and a council member who quotes the 12% in a budget meeting will be quoting the wrong figure.

The fix works out the rate again from the two values and writes 22%.
If the rate was right and one of the visit counts was wrong, correct the count instead.

## Settings

A rate that its two values do not give is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  change-rate-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

A sentence is compared when it has one earlier value (marked by "from" or "compared with", or by an earlier year), one current value in the same unit, and one percentage with a word of direction (up, down, rose, fell).
In a table, a row is compared when the headings name an earlier column, a current column and a rate column, or two year columns.
Each value may be rounded to its last written digit.
A change given with one value ("up 20% year on year") and percentage points are not read.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain change-rate-mismatch --genre business/report

  A rate of change the two values do not give   (change-rate-mismatch)

  When one sentence gives the earlier value, the current one and the rate of change ("1,200 companies, up 20% from 1,000"), readers trust the rate without checking it. It goes wrong when one figure is updated and the others are not, or when the rate is copied from last year's text. When a sentence has one earlier value (marked by "from" or "compared with"), one current value in the same unit, and one percentage with a word of direction (up, decline), chaff computes the rate from the two values and compares. Right after "up 20% from" or "down 20% from", the earlier value may be written without its noun, and it is read in the unit of the value just before the rate ("1,300 companies, up 30% from 1,000", "Visits reached 186,400, up 22% from 152,800 the year before"). The two values may also stand together right before the rate ("rose from $1.0 million last year to $1.5 million, an increase of 50%", "$1.0 million in 2025 and $1.5 million in 2026, up 50%"; with years, the earlier year's value is the earlier one). The rate may also come first, with the value reached and then the earlier one ("rose 10.0% to $2,640 million from $2,400 million"). Each value may be rounded to its last written digit ($12 million is anything from $11.5 million to $12.5 million). Tables are read too. When the headings name one column of the earlier value (Prior year), one of the current value (Current year) and one of the rate (YoY, Change (%)), or two columns are each headed by one year (FY2025, FY2026; the earlier year's column holds the earlier value), each row's rate is computed from its two values and compared. A rate marked -, −, ▲ or △ is a decrease. A column headed only "Change" or "Growth" is read as a rate only where its cells carry %.

  How to fix: Check which of the two values and the rate is right, and correct the others.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax change-rate-mismatch --why "reason"
```

[All samples](README.md)
