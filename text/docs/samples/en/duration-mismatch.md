<!-- chaff-sample
rule: duration-mismatch
genre: legal/contract
file: rental.md
-->

# A start plus a length of time that does not reach the stated end (`duration-mismatch`)

**Where it helps:** rental agreements, service contracts, hotel bookings, leave requests. Anywhere a period is given as a start, a length and an end.

## Original

```markdown chaff-before
# Equipment Rental Agreement

1. The Owner shall rent the scaffolding described in the Schedule to the Hirer for 8 weeks from 1 June 2026 until 31 August 2026.

2. The Hirer shall pay the rent of $300 per week in advance, on the first working day of each week.

3. The Hirer shall return the scaffolding to the Owner's yard on the last day of the rental, clean and in good repair.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract rental.md

rental.md   legal/contract · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    31 August 2026.

  ⚠  A start plus a length of time that does not reach the stated end

     1 June 2026 plus 8 weeks ends around 26 July 2026, but the end is given as 31 August 2026
     When a start, a length and an end are written together ("for 3 months from April 1, 2026, until July 31, 2026"), the reader cannot tell which of the three is right. It happens when the length or one date is changed and not the other. In a sentence with two dates and one length of time, the start plus the length is compared with the end. Three ways of counting are accepted: with the last day included (April 1 plus 3 months is June 30), without it (July 1), and the day after the period has passed when the first day is not counted (July 2); it is pointed out only when the end matches none. A number of nights is compared with the days between two dates (Oct 12 to Oct 14 is 2 nights), in a sentence with two dates and one number of nights, and in each row of a table with check-in, check-out and nights columns. Where nights and days are written together ("2 days, 1 night"), the days must be one more than the nights. Working hours ("9:00–17:30 with a 1-hour break, 8 hours a day") are checked by taking the start and the break from the end and comparing what is left with the stated hours. A timesheet (Start, End, Break and Hours columns, or one cell holding the time range beside Break and Hours) is checked row by row the same way, and a break longer than the shift is pointed out.

     → Check whether the length or the end date is right and correct the other.

     Relax this rule:  npx chaffjs relax duration-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Equipment Rental Agreement

1. The Owner shall rent the scaffolding described in the Schedule to the Hirer for 3 months from 1 June 2026 until 31 August 2026.

2. The Hirer shall pay the rent of $300 per week in advance, on the first working day of each week.

3. The Hirer shall return the scaffolding to the Owner's yard on the last day of the rental, clean and in good repair.
```

## How it was fixed

Eight weeks from 1 June ends in late July, but the clause runs the rental until 31 August.
The job was extended after the first draft, and the end date was changed while "8 weeks" stayed.
The difference is five weeks of scaffolding: the owner may plan to collect it at the end of July, while the hirer expects to keep it through August, and clause 3 depends on which "last day" is meant.

Both parties agreed on the summer, so the fix keeps the end date and makes the length match it: 3 months.
If the eight weeks were right instead, the end date would be the one to correct.

## Settings

The rule is a warning at `normal` and a note at `relaxed`:

```yaml chaff-settings
rules:
  duration-mismatch: relaxed
```

In a sentence with two dates and one length of time, the start plus the length is compared with the end.
Three ways of counting are accepted (with the last day, without it, and the day after the period has passed), and it is pointed out only when the end matches none.
A number of nights is compared with the dates of a stay, and working hours with a stated total.
A rough length ("about 3 months"), a count in each period ("3 days a week"), and a sentence with three or more dates or two or more lengths are left alone.
The rule runs in every genre.

```text chaff-explain
$ npx chaffjs explain duration-mismatch --genre legal/contract

  A start plus a length of time that does not reach the stated end   (duration-mismatch)

  When a start, a length and an end are written together ("for 3 months from April 1, 2026, until July 31, 2026"), the reader cannot tell which of the three is right. It happens when the length or one date is changed and not the other. In a sentence with two dates and one length of time, the start plus the length is compared with the end. Three ways of counting are accepted: with the last day included (April 1 plus 3 months is June 30), without it (July 1), and the day after the period has passed when the first day is not counted (July 2); it is pointed out only when the end matches none. A number of nights is compared with the days between two dates (Oct 12 to Oct 14 is 2 nights), in a sentence with two dates and one number of nights, and in each row of a table with check-in, check-out and nights columns. Where nights and days are written together ("2 days, 1 night"), the days must be one more than the nights. Working hours ("9:00–17:30 with a 1-hour break, 8 hours a day") are checked by taking the start and the break from the end and comparing what is left with the stated hours. A timesheet (Start, End, Break and Hours columns, or one cell holding the time range beside Break and Hours) is checked row by row the same way, and a break longer than the shift is pointed out.

  How to fix: Check whether the length or the end date is right and correct the other.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax duration-mismatch --why "reason"
```

[All samples](README.md)
