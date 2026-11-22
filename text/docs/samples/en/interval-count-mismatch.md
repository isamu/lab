<!-- chaff-sample
rule: interval-count-mismatch
genre: docs/manual
file: kitten-feeding.md
-->

# A minimum interval and a maximum count of uses that cannot both hold, or a count that differs from the table (`interval-count-mismatch`)

**Where it helps:** dosage leaflets, care sheets, equipment manuals. Any instruction that gives a minimum gap between uses and a most per day.

## Original

```markdown chaff-before
# Feeding a kitten from eight weeks

Give wet food at room temperature, and take away what is left after 30 minutes.

## How often

Leave at least 6 hours between feedings, and do not give more than 5 feedings a day.
Fresh water should always be available.

## Changing food

Move to a new food over a week, mixing a little more of it in each day.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual kitten-feeding.md

kitten-feeding.md   docs/manual · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    5 feedings a day.

  ⚠  A minimum interval and a maximum count of uses that cannot both hold, or a count that differs from the table

     5 feedings a day at least 6 hours apart take 24 hours from the first to the last, which does not fit in 24 hours
     Written "leave at least 8 hours between doses, no more than 4 doses a day", four doses 8 hours apart take 24 hours from the first to the last, so the fourth falls on the next day: one of the numbers is wrong. n uses at least h hours apart take (n − 1) × h hours from the first to the last; when that is the length of the period (24 hours for a day) or more, n uses do not fit in it. This is worked out in a paragraph holding exactly one minimum interval ("at least 4 hours between doses") and exactly one count of uses in a period with a limit ("no more than 6 doses a day"). When the two can hold, a table under the same heading with a column of uses in a period ("Times a day") is read too, and its largest count is compared with the limit; a table of 3 times a day beside a limit of 6 leaves the reader unable to tell which to follow.

     → Check which of the interval, the count and the table is right and correct the rest.

     Relax this rule:  npx chaffjs relax interval-count-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Feeding a kitten from eight weeks

Give wet food at room temperature, and take away what is left after 30 minutes.

## How often

Leave at least 6 hours between feedings, and do not give more than 4 feedings a day.
Fresh water should always be available.

## Changing food

Move to a new food over a week, mixing a little more of it in each day.
```

## How it was fixed

Five feedings at least 6 hours apart take 24 hours from the first to the last, so the fifth falls on the next day.
The sheet was adapted from one for younger kittens, fed five times a day at shorter gaps, and only the interval was changed.
An owner who follows one number breaks the other, and cannot tell which the vet meant.

The fix lowers the most per day to four, which fits: four feedings 6 hours apart take 18 hours.
If five feedings are right, the gap is what to shorten.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  interval-count-mismatch: relaxed
```

A paragraph is read when it holds exactly one minimum interval ("at least 6 hours between feedings") and one count with a limit ("no more than 4 feedings a day").
A count that just fits (at least 4 hours apart, 6 a day) is not reported.
When the two can hold, a table under the same heading with a column such as "Times a day" is compared with the limit too.

```text chaff-explain
$ npx chaffjs explain interval-count-mismatch --genre docs/manual

  A minimum interval and a maximum count of uses that cannot both hold, or a count that differs from the table   (interval-count-mismatch)

  Written "leave at least 8 hours between doses, no more than 4 doses a day", four doses 8 hours apart take 24 hours from the first to the last, so the fourth falls on the next day: one of the numbers is wrong. n uses at least h hours apart take (n − 1) × h hours from the first to the last; when that is the length of the period (24 hours for a day) or more, n uses do not fit in it. This is worked out in a paragraph holding exactly one minimum interval ("at least 4 hours between doses") and exactly one count of uses in a period with a limit ("no more than 6 doses a day"). When the two can hold, a table under the same heading with a column of uses in a period ("Times a day") is read too, and its largest count is compared with the limit; a table of 3 times a day beside a limit of 6 leaves the reader unable to tell which to follow.

  How to fix: Check which of the interval, the count and the table is right and correct the rest.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax interval-count-mismatch --why "reason"
```

[All samples](README.md)
