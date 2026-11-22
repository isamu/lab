<!-- chaff-sample
rule: reference-unit-mismatch
genre: business/report
file: kidney-test.md
-->

# A test result in another unit than its reference range (`reference-unit-mismatch`)

**Where it helps:** lab results, test reports, any table that gives a result next to its reference range.

## Original

```markdown chaff-before
# Kidney function test

Blood sample taken on April 22, 2026.

| Test | Result | Reference range |
| --- | --- | --- |
| Creatinine | 0.9 mg/dL | 0.6–1.2 mg/dL |
| Blood urea nitrogen | 14 mmol/L | 7–20 mg/dL |
| Uric acid | 5.4 mg/dL | 3.5–7.2 mg/dL |

Your doctor will go through these results with you at your next visit.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report kidney-test.md

kidney-test.md   business/report · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    14 mmol/L | 7–20 mg/dL |

  ✖  A test result in another unit than its reference range

     The result "14 mmol/L" for "Blood urea nitrogen" is in another unit than its reference range "7–20 mg/dL"
     When a results table writes a result as "52 mmol/L" and the reference range on the same row as "40–60 mg/dL", the numbers cannot be compared, and the reader cannot tell whether the result is in range. It happens when a unit is copied wrong or a value is pasted from another lab. Each row of a table whose headings name a result and a reference range (the language package's lab-result-column and reference-unit-column lexicons) is read, and the units of the two cells (the reference-unit lexicon) are compared. A cell without a unit takes a unit in brackets in its column heading, then the row's Unit column. Two reference range columns (men and women) are each compared. Two ways of writing one unit, which compare without converting the number (mg/dL and mg/dl, ×10³/µL and ×10⁹/L), are read as the same unit.

     → Check the lab's report and correct the unit of the result or of the range, or convert one so both use the same unit.

     Relax this rule:  npx chaffjs relax reference-unit-mismatch


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Kidney function test

Blood sample taken on April 22, 2026.

| Test | Result | Reference range |
| --- | --- | --- |
| Creatinine | 0.9 mg/dL | 0.6–1.2 mg/dL |
| Blood urea nitrogen | 14 mg/dL | 7–20 mg/dL |
| Uric acid | 5.4 mg/dL | 3.5–7.2 mg/dL |

Your doctor will go through these results with you at your next visit.
```

## How it was fixed

Blood urea nitrogen is written as 14 mmol/L, but its reference range is 7–20 mg/dL.
The two cannot be compared, so the reader cannot tell whether the result is in range: 14 mmol/L of urea nitrogen would be far above it.
A unit copied wrong or a value pasted from another lab's report does this.

The lab's report gives 14 mg/dL, so the fix corrects the unit.
If the result really is in another unit, convert one so the row uses the same unit throughout.
Two ways of writing one unit (mg/dL and mg/dl) are read as the same.

## Settings

A result in another unit than its range is an error at the default level, so the run fails in CI; `relaxed` makes it a warning.

If you check drafts that are converted to one unit later, relax it:

```yaml chaff-settings
rules:
  reference-unit-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain reference-unit-mismatch --genre business/report

  A test result in another unit than its reference range   (reference-unit-mismatch)

  When a results table writes a result as "52 mmol/L" and the reference range on the same row as "40–60 mg/dL", the numbers cannot be compared, and the reader cannot tell whether the result is in range. It happens when a unit is copied wrong or a value is pasted from another lab. Each row of a table whose headings name a result and a reference range (the language package's lab-result-column and reference-unit-column lexicons) is read, and the units of the two cells (the reference-unit lexicon) are compared. A cell without a unit takes a unit in brackets in its column heading, then the row's Unit column. Two reference range columns (men and women) are each compared. Two ways of writing one unit, which compare without converting the number (mg/dL and mg/dl, ×10³/µL and ×10⁹/L), are read as the same unit.

  How to fix: Check the lab's report and correct the unit of the result or of the range, or convert one so both use the same unit.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax reference-unit-mismatch --why "reason"
```

[All samples](README.md)
