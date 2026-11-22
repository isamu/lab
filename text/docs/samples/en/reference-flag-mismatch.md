<!-- chaff-sample
rule: reference-flag-mismatch
genre: business/report
file: health-check.md
-->

# A flag that does not match the result and its reference range (`reference-flag-mismatch`)

**Where it helps:** lab and health check results, inspection reports, quality checks. Any table that flags a value against a range.

## Original

```markdown chaff-before
# Your health check results

These are the results of the blood test taken at your health check on May 14, 2026.

| Test | Result | Reference range | Flag |
| --- | --- | --- | --- |
| Fasting glucose | 92 mg/dL | 70–99 mg/dL | Normal |
| LDL cholesterol | 162 mg/dL | 60–139 mg/dL | Normal |
| HDL cholesterol | 58 mg/dL | 40–90 mg/dL | Normal |
| Triglycerides | 110 mg/dL | 30–149 mg/dL | Normal |

Please bring this page to your next appointment with your doctor.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report health-check.md

health-check.md   business/report · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    Normal |

  ⚠  A flag that does not match the result and its reference range

     "LDL cholesterol" is 162 mg/dL, outside its reference range (60–139 mg/dL), but is flagged "Normal"
     When a results table flags 5.2 "H" against a reference range of 4.0–5.6 %, or 18 "Normal" against 30–100 ng/mL, the reader trusts the flag and either misses the value that needs attention or worries about one that does not. It happens when the flags of last time's table are kept and only the values are updated, or a row's flag is pasted from its neighbour. The result, reference range and flag columns are found by their headings, and the result of each row is compared with the range on the same row. A range written with a range mark only ("4.0–5.6") includes both ends, since a reference range names the lowest and the highest value it counts as within it. "Or less", "or more", "≤" and "≥" keep their end; "below", "above", "<" and ">" do not.

     → Check the result and the reference range, and correct the flag or the mistyped number.

     Relax this rule:  npx chaffjs relax reference-flag-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Your health check results

These are the results of the blood test taken at your health check on May 14, 2026.

| Test | Result | Reference range | Flag |
| --- | --- | --- | --- |
| Fasting glucose | 92 mg/dL | 70–99 mg/dL | Normal |
| LDL cholesterol | 162 mg/dL | 60–139 mg/dL | H |
| HDL cholesterol | 58 mg/dL | 40–90 mg/dL | Normal |
| Triglycerides | 110 mg/dL | 30–149 mg/dL | Normal |

Please bring this page to your next appointment with your doctor.
```

## How it was fixed

LDL cholesterol is 162 mg/dL against a reference range of 60–139 mg/dL, but the flag says "Normal".
Most readers look at the flag column, not the numbers, so this result goes unnoticed.
It happens when last time's flags are kept and only the values are updated.

The fix flags the row "H".
chaff reads the result, range and flag columns by their headings and compares each row with its own range.
A grade the clinic sets by its own criteria (A to E) is not compared.

## Settings

A flag that does not match its range is a warning at the default level, an error at `strict` and a note at `relaxed`.

If your flags follow criteria other than the reference range, relax it:

```yaml chaff-settings
rules:
  reference-flag-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain reference-flag-mismatch --genre business/report

  A flag that does not match the result and its reference range   (reference-flag-mismatch)

  When a results table flags 5.2 "H" against a reference range of 4.0–5.6 %, or 18 "Normal" against 30–100 ng/mL, the reader trusts the flag and either misses the value that needs attention or worries about one that does not. It happens when the flags of last time's table are kept and only the values are updated, or a row's flag is pasted from its neighbour. The result, reference range and flag columns are found by their headings, and the result of each row is compared with the range on the same row. A range written with a range mark only ("4.0–5.6") includes both ends, since a reference range names the lowest and the highest value it counts as within it. "Or less", "or more", "≤" and "≥" keep their end; "below", "above", "<" and ">" do not.

  How to fix: Check the result and the reference range, and correct the flag or the mistyped number.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax reference-flag-mismatch --why "reason"
```

[All samples](README.md)
