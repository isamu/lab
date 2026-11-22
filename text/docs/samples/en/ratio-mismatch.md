<!-- chaff-sample
rule: ratio-mismatch
genre: business/report
file: half-year-results.md
-->

# A margin the two values it divides do not give (`ratio-mismatch`)

**Where it helps:** results announcements, board packs, management accounts, investor slides. Any table with sales, profit and a margin.

## Original

```markdown chaff-before
# Results for the half year to September 30, 2026

Figures in $ million.

| Item | H1 2025 | H1 2026 |
| --- | --- | --- |
| Net sales | 412 | 458 |
| Gross profit | 167 | 183 |
| Operating profit | 29 | 37 |
| Operating margin | 7.0% | 7.4% |

Sales rose in every region, led by the online store. Freight costs were lower than in the first half of last year.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report half-year-results.md

half-year-results.md   business/report · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    7.4% |

  ⚠  A margin the two values it divides do not give

     Operating margin "7.4%" is written, but its two values give 8.1%
     The "Operating margin 7.5%" of a results table is the operating profit divided by the net sales in the same column. Readers trust it without dividing again. It goes wrong when an amount is corrected and the margin is not, or when the margin is copied from last period's table. In a table, a row labelled with only the name of a ratio (Operating margin, Gross margin, Net margin) is compared, column by column, with its numerator divided by its denominator, when the same table has one row of each (Operating profit, Net sales). One sentence that names the ratio, the numerator and the denominator once each, with a value right after each name ("Operating profit was $198 million on net sales of $2,640 million, an operating margin of 7.5%"), is compared too. Which ratio divides which two values is in the language package's lexicons ratio-label and ratio-term. The ratio may be rounded to half its last digit (7.3% is anything from 7.25% to 7.35%). Each amount may be off by one whole step of its last digit, not half, because results tables often round amounts down and the margin is worked out from the amounts before rounding.

     → Check which of the ratio and the two values is right, and correct the others.

     Relax this rule:  npx chaffjs relax ratio-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Results for the half year to September 30, 2026

Figures in $ million.

| Item | H1 2025 | H1 2026 |
| --- | --- | --- |
| Net sales | 412 | 458 |
| Gross profit | 167 | 183 |
| Operating profit | 29 | 37 |
| Operating margin | 7.0% | 8.1% |

Sales rose in every region, led by the online store. Freight costs were lower than in the first half of last year.
```

## How it was fixed

An operating profit of 37 on sales of 458 is a margin of 8.1%, not 7.4%.
The last year's column checks; this year's does not.
7.4% is what a profit of 34 would give, which is the kind of figure left behind when the profit is revised late and the margin row is not worked out again.
Margins are what readers compare between periods, so this one tells them the business improved by less than it did.

The fix divides the two values again and writes 8.1%.
If the margin was right and the profit was the figure revised in error, correct the profit instead.

## Settings

A margin that its two values do not give is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  ratio-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

In a table, a row named only after a ratio (Operating margin, Gross margin, Net margin) is compared, column by column, with its two rows (Operating profit, Net sales).
One sentence that names the ratio and its two values once each is compared too.
The margin may be rounded to half its last digit, and each amount by one step of its last digit, since results tables often round amounts down.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain ratio-mismatch --genre business/report

  A margin the two values it divides do not give   (ratio-mismatch)

  The "Operating margin 7.5%" of a results table is the operating profit divided by the net sales in the same column. Readers trust it without dividing again. It goes wrong when an amount is corrected and the margin is not, or when the margin is copied from last period's table. In a table, a row labelled with only the name of a ratio (Operating margin, Gross margin, Net margin) is compared, column by column, with its numerator divided by its denominator, when the same table has one row of each (Operating profit, Net sales). One sentence that names the ratio, the numerator and the denominator once each, with a value right after each name ("Operating profit was $198 million on net sales of $2,640 million, an operating margin of 7.5%"), is compared too. Which ratio divides which two values is in the language package's lexicons ratio-label and ratio-term. The ratio may be rounded to half its last digit (7.3% is anything from 7.25% to 7.35%). Each amount may be off by one whole step of its last digit, not half, because results tables often round amounts down and the margin is worked out from the amounts before rounding.

  How to fix: Check which of the ratio and the two values is right, and correct the others.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax ratio-mismatch --why "reason"
```

[All samples](README.md)
