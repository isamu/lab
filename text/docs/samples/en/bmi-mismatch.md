<!-- chaff-sample
rule: bmi-mismatch
genre: business/report
file: checkup-result.md
-->

# A BMI the height and weight beside it do not give (`bmi-mismatch`)

**Where it helps:** health checkup results, occupational health reports, fitness assessments. Any record that writes a BMI next to the height and weight it comes from.

## Original

```markdown chaff-before
# Annual health check: results

Employee: D. Okafor
Date of check: 12 November 2026

## Body measurements

| Item | Result |
| --- | --- |
| Height | 178 cm |
| Weight | 74.0 kg |
| BMI | 21.4 |
| Waist | 84 cm |

Your weight has gone up by 6 kg since last year. The nurse will talk this through with you at your follow-up.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report checkup-result.md

checkup-result.md   business/report · English   genre from --genre

─── line 12 ──────────────────────────────────────────────────

    21.4 |

  ⚠  A BMI the height and weight beside it do not give

     BMI 21.4 is written, but the height and weight give 23.4
     The "BMI 22.0" of a checkup result is the weight in kilograms of the same person divided by the square of their height in metres. Readers trust it without working it out again. It goes wrong when the weight is corrected and the BMI is not, or when the BMI is copied from last year's result or another person's. One section (a heading to the next) is read as one person's results. When it has one height, one weight and one BMI row, in one table (or all three as lines of a name, a colon and a value, such as "Height" then "178 cm"), they are compared column by column. A height in cm or m and a weight in kg are read, with the unit after the value or in brackets in the row label; the other units of the lexicons (ft, in, lb) are converted too. Which words name a height, a weight and a BMI is in the language package's lexicon bmi-term. Every written number may be rounded to half its last digit (22.0 is anything from 21.95 to 22.05, 178 cm from 177.5 to 178.5 cm). A BMI is not reported when its rounding overlaps the range the height and weight can give, from the lightest weight over the tallest height squared to the heaviest weight over the shortest.

     → Check which of the height, the weight and the BMI is right, and correct the others.

     Relax this rule:  npx chaffjs relax bmi-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Annual health check: results

Employee: D. Okafor
Date of check: 12 November 2026

## Body measurements

| Item | Result |
| --- | --- |
| Height | 178 cm |
| Weight | 74.0 kg |
| BMI | 23.4 |
| Waist | 84 cm |

Your weight has gone up by 6 kg since last year. The nurse will talk this through with you at your follow-up.
```

## How it was fixed

A BMI is the weight in kilograms divided by the height in metres squared: 74.0 ÷ 1.78² is 23.4.
The report said 21.4, last year's value for a weight of 68 kg: the form was filled in from the previous year's and only the weight was updated.
The note under the table speaks of a 6 kg gain while the BMI shows none, and a reader who trusts the BMI is told nothing has changed.

The fix works the BMI out from this year's height and weight.
Rounding is allowed for: a BMI within the range the rounded height and weight can give is never reported.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  bmi-mismatch: relaxed
```

One section (a heading to the next) is read as one person's results, and it is compared only when it holds one height, one weight and one BMI.
Heights in cm, m, ft or in and weights in kg or lb are read; a range, an "about" and a height of two numbers ("5 ft 10 in") are not.
A section with two people, or a before and an after, is left alone.

```text chaff-explain
$ npx chaffjs explain bmi-mismatch --genre business/report

  A BMI the height and weight beside it do not give   (bmi-mismatch)

  The "BMI 22.0" of a checkup result is the weight in kilograms of the same person divided by the square of their height in metres. Readers trust it without working it out again. It goes wrong when the weight is corrected and the BMI is not, or when the BMI is copied from last year's result or another person's. One section (a heading to the next) is read as one person's results. When it has one height, one weight and one BMI row, in one table (or all three as lines of a name, a colon and a value, such as "Height" then "178 cm"), they are compared column by column. A height in cm or m and a weight in kg are read, with the unit after the value or in brackets in the row label; the other units of the lexicons (ft, in, lb) are converted too. Which words name a height, a weight and a BMI is in the language package's lexicon bmi-term. Every written number may be rounded to half its last digit (22.0 is anything from 21.95 to 22.05, 178 cm from 177.5 to 178.5 cm). A BMI is not reported when its rounding overlaps the range the height and weight can give, from the lightest weight over the tallest height squared to the heaviest weight over the shortest.

  How to fix: Check which of the height, the weight and the BMI is right, and correct the others.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax bmi-mismatch --why "reason"
```

[All samples](README.md)
