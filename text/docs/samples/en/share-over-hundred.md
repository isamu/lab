<!-- chaff-sample
rule: share-over-hundred
genre: business/report
file: staff-survey.md
-->

# A share above 100% (`share-over-hundred`)

**Where it helps:** survey summaries, annual reports, newsletters, slides of results. Any document that says what percentage of a group did something.

## Original

```markdown chaff-before
# Staff survey 2026: summary

We asked every member of staff about the move to the new office in March. Of our 240 staff, 212 answered.

## Results

- 78% of respondents said the new office is easier to reach.
- 140% of employees now work from the office at least three days a week.
- The quiet rooms were the most requested change, named by 64 people.

Facilities will put two more quiet rooms on the second floor before the end of the year.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report staff-survey.md

staff-survey.md   business/report · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    easier to reach. - 140% of employees now wo

  ✖  A share above 100%

     "140%" is a share of employees, so it cannot pass 100%
     A share of a group, such as "120% of respondents", cannot pass 100%. It is a misplaced decimal point (12.0%), a mix-up with another figure (growth on last year), or a mistyped digit, and the reader stops trusting the number. A part never exceeds the whole, so a machine can tell.

     → Check the source figure and correct it. If growth or a comparison was meant, say so ("120% of last year's level", "up 20%").

     Relax this rule:  npx chaffjs relax share-over-hundred


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Staff survey 2026: summary

We asked every member of staff about the move to the new office in March. Of our 240 staff, 212 answered.

## Results

- 78% of respondents said the new office is easier to reach.
- Of the 212 who answered, 140 (66%) now work from the office at least three days a week.
- The quiet rooms were the most requested change, named by 64 people.

Facilities will put two more quiet rooms on the second floor before the end of the year.
```

## How it was fixed

No more than all of the employees can work from the office, so "140% of employees" cannot be right.
The figure in the survey was 140 people, not 140%: a count turned into a percentage somewhere between the spreadsheet and the summary.
A reader who sees an impossible figure stops trusting the ones around it too, even the 78%, which is correct.

The fix goes back to the source and writes what it says: 140 of the 212 who answered, which is 66%.
If a comparison was meant instead, such as growth on last year, say what it is compared with ("one and a half times as many as last year").

## Settings

A share over 100% is an error at the default level, since it can never be right; `relaxed` makes it a warning:

```yaml chaff-settings
rules:
  share-over-hundred: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

Only a percentage written as a share of a group (respondents, employees, users, and so on) is read.
Growth and comparisons ("120% of last year", "110% of the budget") and a percentage of no group ("120% attainment") are not reported.
The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain share-over-hundred --genre business/report

  A share above 100%   (share-over-hundred)

  A share of a group, such as "120% of respondents", cannot pass 100%. It is a misplaced decimal point (12.0%), a mix-up with another figure (growth on last year), or a mistyped digit, and the reader stops trusting the number. A part never exceeds the whole, so a machine can tell.

  How to fix: Check the source figure and correct it. If growth or a comparison was meant, say so ("120% of last year's level", "up 20%").

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax share-over-hundred --why "reason"
```

[All samples](README.md)
