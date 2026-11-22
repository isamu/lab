<!-- chaff-sample
rule: period-label-conflict
genre: business/press-release
file: q2-results.md
-->

# A period other than the one the title reports (`period-label-conflict`)

**Where it helps:** results releases, quarterly reports, investor updates, tax statements. Any document made from last period's, where one label can stay behind.

## Original

```markdown chaff-before
# Northwind Tools: Second Quarter Results, FY2027

Northwind Tools today reported its results for the third quarter of fiscal 2027.
Sales rose on demand for cordless tools, and the new Leeds warehouse cut delivery times.

| Item | Q2 FY2026 | Q2 FY2027 |
| --- | --- | --- |
| Net sales | $48.2 million | $53.6 million |
| Operating income | $4.1 million | $5.0 million |

The full report will be published on our investor page on 14 November.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release q2-results.md

q2-results.md   business/press-release · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    third quarter of fiscal 2027.

  ⚠  A period other than the one the title reports

     "third quarter" is not the period the title reports, "Second Quarter"
     When a release titled "Second Quarter Results" heads its table "Q3 FY2027", the reader has to ask which period the figures are for. It happens when last period's release is copied and one label is not updated, or when a table reused every quarter keeps its old heading. The period the title (the first line) names together with a results word ("Results", "Earnings") is the document's period: a quarter, a half or a fiscal year (Q2, first half, FY2026, fiscal year ending March 31, 2027). A kind the title does not name is taken from a "Reporting period:" line at the top. After that, a period of the same kind that differs is reported where the text speaks of the current results: in a table heading cell, and in a sentence or heading with "results" or "this quarter". A cell, sentence or section heading with a word for a comparison or a later period ("prior year", "a year earlier", "compared with", "forecast", "outlook") is not compared, and neither is a period written next to the document's own (| FY2025 | FY2026 |). A document whose title names its year with a marker ("Tax Year 2026", "the 2026 tax year"), such as an annual tax statement, is read even when it is not a results release, and a year with the same marker that differs anywhere in the body ("tax year 2025") is reported.

     → Correct the period name to the one in the title. If it is a period being compared with, say so ("a year earlier", "prior year").

     Relax this rule:  npx chaffjs relax period-label-conflict


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Northwind Tools: Second Quarter Results, FY2027

Northwind Tools today reported its results for the second quarter of fiscal 2027.
Sales rose on demand for cordless tools, and the new Leeds warehouse cut delivery times.

| Item | Q2 FY2026 | Q2 FY2027 |
| --- | --- | --- |
| Net sales | $48.2 million | $53.6 million |
| Operating income | $4.1 million | $5.0 million |

The full report will be published on our investor page on 14 November.
```

## How it was fixed

The title and the table report the second quarter, and the opening sentence says the third.
The release was drafted from last year's third-quarter release, and the year in the sentence was updated while the quarter was not.
The opening sentence is the one newswires quote, and a wrong quarter there has to be corrected in public.

The fix gives the sentence the period the title reports.
The year-earlier column, "Q2 FY2026", is a comparison, and chaff leaves it alone.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  period-label-conflict: relaxed
```

The period the title names together with a results word ("Results", "Earnings") is the document's period: a quarter, a half or a fiscal year.
A period of the same kind that differs is reported in a table heading, and in a sentence or heading about the current results.
A cell or sentence with a word for a comparison or a later period ("prior year", "a year earlier", "forecast", "outlook") is not compared, and neither is a period written next to the document's own.

```text chaff-explain
$ npx chaffjs explain period-label-conflict --genre business/press-release

  A period other than the one the title reports   (period-label-conflict)

  When a release titled "Second Quarter Results" heads its table "Q3 FY2027", the reader has to ask which period the figures are for. It happens when last period's release is copied and one label is not updated, or when a table reused every quarter keeps its old heading. The period the title (the first line) names together with a results word ("Results", "Earnings") is the document's period: a quarter, a half or a fiscal year (Q2, first half, FY2026, fiscal year ending March 31, 2027). A kind the title does not name is taken from a "Reporting period:" line at the top. After that, a period of the same kind that differs is reported where the text speaks of the current results: in a table heading cell, and in a sentence or heading with "results" or "this quarter". A cell, sentence or section heading with a word for a comparison or a later period ("prior year", "a year earlier", "compared with", "forecast", "outlook") is not compared, and neither is a period written next to the document's own (| FY2025 | FY2026 |). A document whose title names its year with a marker ("Tax Year 2026", "the 2026 tax year"), such as an annual tax statement, is read even when it is not a results release, and a year with the same marker that differs anywhere in the body ("tax year 2025") is reported.

  How to fix: Correct the period name to the one in the title. If it is a period being compared with, say so ("a year earlier", "prior year").

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax period-label-conflict --why "reason"
```

[All samples](README.md)
