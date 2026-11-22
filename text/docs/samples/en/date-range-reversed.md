<!-- chaff-sample
rule: date-range-reversed
genre: business/email
file: closure.md
-->

# A period that ends before it starts (`date-range-reversed`)

**Where it helps:** closure notices, leave requests, booking confirmations, contract terms. Anywhere a period is written as two dates.

## Original

```markdown chaff-before
Subject: Library closed for refurbishment

Dear readers,

The Westbrook branch library will be closed for refurbishment from 14 July 2026 to 8 July 2026. While we are closed, return books to the Central Library or the drop box by the main door.

Loans due while we are closed will be extended automatically, so no fines will be charged.

Kind regards,
The Westbrook Library team
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email closure.md

closure.md   business/email · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    14 July 2026 to 8 July 2026. While we are closed, return books to the Central Li

  ⚠  A period that ends before it starts

     The period "14 July 2026 to 8 July 2026" ends before it starts
     When a period such as "5 April 2026 – 2 April 2026" ends before it starts, the reader has to ask which date is right. It happens when a year is copied wrong, or when only one of the two dates is changed. Two dates are read as a period when only a range mark (–, —) or a word such as "through" or "until" stands between them, or when they are written "from … to …", or when one sentence gives the start and the end with one start word and one end word on the two dates ("starts on 1 April 2026 and ends on 31 March 2027"). A period without a year ("28 December – 4 January") may run into the next year and is not compared. With the year on one end only ("July 9 – July 8, 2026"), both ends are read in that year; a reversed one is reported only when the weekday on the end without a year matches that reading, or when reading it across the year end would make the period nearly a year long ("December 28 – January 4, 2027" crosses the year end).

     → Check both dates and correct the one that is wrong.

     Relax this rule:  npx chaffjs relax date-range-reversed


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Library closed for refurbishment

Dear readers,

The Westbrook branch library will be closed for refurbishment from 14 July 2026 to 28 July 2026. While we are closed, return books to the Central Library or the drop box by the main door.

Loans due while we are closed will be extended automatically, so no fines will be charged.

Kind regards,
The Westbrook Library team
```

## How it was fixed

The closure runs "from 14 July to 8 July", which ends six days before it starts.
A reader cannot tell when the library reopens: was the start meant to be the 4th, or the end the 18th or the 28th?
People planning a visit, and the staff of the Central Library expecting extra returns, all need the reopening date.

The refurbishment takes two weeks, and the "2" of the 28th was dropped as the notice was typed.
The fix restores it, so the period reads from 14 July to 28 July 2026.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  date-range-reversed: relaxed
```

Two dates are read as a period when only a range mark (–) or a word such as "through" or "until" stands between them, when they are written "from … to …", or when one sentence gives a start and an end ("starts on … and ends on …").
A period without a year may run into the next year, and a sentence that moves a date ("moved from 10 March to 3 March") is not a period, so neither is compared.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain date-range-reversed --genre business/email

  A period that ends before it starts   (date-range-reversed)

  When a period such as "5 April 2026 – 2 April 2026" ends before it starts, the reader has to ask which date is right. It happens when a year is copied wrong, or when only one of the two dates is changed. Two dates are read as a period when only a range mark (–, —) or a word such as "through" or "until" stands between them, or when they are written "from … to …", or when one sentence gives the start and the end with one start word and one end word on the two dates ("starts on 1 April 2026 and ends on 31 March 2027"). A period without a year ("28 December – 4 January") may run into the next year and is not compared. With the year on one end only ("July 9 – July 8, 2026"), both ends are read in that year; a reversed one is reported only when the weekday on the end without a year matches that reading, or when reading it across the year end would make the period nearly a year long ("December 28 – January 4, 2027" crosses the year end).

  How to fix: Check both dates and correct the one that is wrong.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax date-range-reversed --why "reason"
```

[All samples](README.md)
