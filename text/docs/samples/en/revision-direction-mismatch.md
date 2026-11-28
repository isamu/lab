<!-- chaff-sample
rule: revision-direction-mismatch
genre: business/press-release
file: forecast-revision.md
-->

# A forecast revision that moves the other way (`revision-direction-mismatch`)

**Where it helps:** notices of forecast revisions, earnings releases, budget updates.

## Original

```markdown chaff-before
# Notice of revision to the full-year forecast

Kestrel Tools is revising upward its full-year forecast for the fiscal year ending March 31, 2027, first announced on May 12, 2026.

| Item | Previous forecast | Revised forecast |
| --- | --- | --- |
| Net sales | 48,000 | 45,500 |
| Operating profit | 3,600 | 3,100 |

(In millions of yen)

## Reasons

Orders from overseas builders slowed from July, and the yen was stronger than we assumed in May.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release forecast-revision.md

forecast-revision.md   business/press-release · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    et sales | 48,000 | 45,500 |

  ⚠  A forecast revision that moves the other way

     "revising upward" is written, but Net sales goes the other way, from 48,000 to 45,500
     When a release says the forecast is "revised upward" and the table below it shows a revised figure lower than the previous one, readers cannot tell whether to believe the sentence or the table. It happens when last year's release is copied and only the figures are replaced, or when the columns are swapped. A table with a column of the previous forecast (Previous forecast) and one of the revised forecast (Revised forecast), or a row of each, is compared with the word of revision in the same section, from a heading to the next (revised upward, revised downward; raised, lowered and cut only with forecast, guidance or outlook in their sentence). When the sentence of the word names items (net sales, operating profit; "Operating profit (loss)" is named without its brackets too) those items are checked; when it names none, the first item of the table is.

     → Check whether the word of revision or the previous and revised figures are right, and correct the other. If the items move different ways, say so item by item ("we lower net sales and raise operating profit").

     Relax this rule:  npx chaffjs relax revision-direction-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Notice of revision to the full-year forecast

Kestrel Tools is revising downward its full-year forecast for the fiscal year ending March 31, 2027, first announced on May 12, 2026.

| Item | Previous forecast | Revised forecast |
| --- | --- | --- |
| Net sales | 48,000 | 45,500 |
| Operating profit | 3,600 | 3,100 |

(In millions of yen)

## Reasons

Orders from overseas builders slowed from July, and the yen was stronger than we assumed in May.
```

## How it was fixed

The notice says the forecast is revised upward, but the table shows both figures going down: net sales from 48,000 to 45,500.
Investors read the sentence first, and a notice that says "upward" over a cut is worse than a cut.
It happens when last year's notice is copied and only the figures are replaced.

The figures are right, so the fix says "downward".
chaff compares the word of revision with the first item of the table, or with the items the sentence names.
If items move different ways, say so item by item.

## Settings

A revision that moves the other way is a warning at the default level, an error at `strict` and a note at `relaxed`.

To relax it:

```yaml chaff-settings
rules:
  revision-direction-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain revision-direction-mismatch --genre business/press-release

  A forecast revision that moves the other way   (revision-direction-mismatch)

  When a release says the forecast is "revised upward" and the table below it shows a revised figure lower than the previous one, readers cannot tell whether to believe the sentence or the table. It happens when last year's release is copied and only the figures are replaced, or when the columns are swapped. A table with a column of the previous forecast (Previous forecast) and one of the revised forecast (Revised forecast), or a row of each, is compared with the word of revision in the same section, from a heading to the next (revised upward, revised downward; raised, lowered and cut only with forecast, guidance or outlook in their sentence). When the sentence of the word names items (net sales, operating profit; "Operating profit (loss)" is named without its brackets too) those items are checked; when it names none, the first item of the table is.

  How to fix: Check whether the word of revision or the previous and revised figures are right, and correct the other. If the items move different ways, say so item by item ("we lower net sales and raise operating profit").

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax revision-direction-mismatch --why "reason"
```

[All samples](README.md)
