<!-- chaff-sample
rule: impossible-date
genre: business/email
file: expenses.md
-->

# A date the calendar does not have (`impossible-date`)

**Where it helps:** deadlines in emails, notices, contracts, forms. Anywhere the end of a month is written from memory.

## Original

```markdown chaff-before
Subject: Expense claims for the first half of the year

Hi everyone,

Please submit your expense claims for January to June by June 31. Claims that arrive later will be paid with the next quarter's run.

Attach a receipt for every item over $25. Mileage can be claimed at the rate on the finance page.

Thanks,
Priya
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email expenses.md

expenses.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    January to June by June 31. Claims that arrive

  ✖  A date the calendar does not have

     "June 31" is not on the calendar (that month has 30 days)
     A date such as "February 30", "April 31" or "2023-02-29" is not on the calendar. The reader has to find out whether the day before, the day after or another month was meant, and for a deadline someone acts on the wrong day. It happens when the end of a month is taken to be the 31st, or a leap-year schedule is reused. When a Japanese era year and the Western year in brackets beside it disagree (令和6年（2023年）, where 令和6 is 2024), the reader cannot tell which year is meant. Month lengths, leap years and the first year of an era are fixed by the calendar, so a machine can tell.

     → Check the date that was meant and correct it. For the end of a month, write that month's last day (30 April, 28 February).

     Relax this rule:  npx chaffjs relax impossible-date


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Expense claims for the first half of the year

Hi everyone,

Please submit your expense claims for January to June by June 30. Claims that arrive later will be paid with the next quarter's run.

Attach a receipt for every item over $25. Mileage can be claimed at the rate on the finance page.

Thanks,
Priya
```

## How it was fixed

June has thirty days, so "June 31" is not a day anyone can meet.
Some readers will take it as the end of June, some as July 1, and someone will send their claim on July 1 and find it held over to the next quarter.
The mistake comes from taking every month's end to be the 31st.

The fix writes the last day of the month that was meant: June 30.
Month lengths and leap years are fixed by the calendar, so a machine can check every date in a document.

## Settings

The rule is an error at `normal` and a warning at `relaxed`:

```yaml chaff-settings
rules:
  impossible-date: relaxed
```

It runs in every genre.
For a date without a year, February 29 is not reported, since the leap year cannot be decided.
A bare run of numbers such as 2026-13-45 may be an identifier or a version, so it is checked only when the month is 1 to 12 and the day at most 31. Code is not read.

```text chaff-explain
$ npx chaffjs explain impossible-date --genre business/email

  A date the calendar does not have   (impossible-date)

  A date such as "February 30", "April 31" or "2023-02-29" is not on the calendar. The reader has to find out whether the day before, the day after or another month was meant, and for a deadline someone acts on the wrong day. It happens when the end of a month is taken to be the 31st, or a leap-year schedule is reused. When a Japanese era year and the Western year in brackets beside it disagree (令和6年（2023年）, where 令和6 is 2024), the reader cannot tell which year is meant. Month lengths, leap years and the first year of an era are fixed by the calendar, so a machine can tell.

  How to fix: Check the date that was meant and correct it. For the end of a month, write that month's last day (30 April, 28 February).

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax impossible-date --why "reason"
```

[All samples](README.md)
