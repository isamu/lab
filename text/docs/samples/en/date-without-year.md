<!-- chaff-sample
rule: date-without-year
genre: business/report
file: renewal-plan.md
-->

# Date without a year (`date-without-year`)

**Where it helps:** plans and timelines, reports, schedules that run across the end of a year.

## Original

```markdown chaff-before
# Office lease renewal

## Timeline

- November 28, 2026: the landlord sends the new terms
- December 15, 2026: our reply is due
- January 9: the board approves the renewal
- February 1, 2027: the new lease starts
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report renewal-plan.md

renewal-plan.md   business/report · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    January 9: the board approves the renewal

  ·  Date without a year

     "January 9" has no year, and the document's dates run from 2026 to 2027, so the year is unclear
     When the document's dates span more than one year (some in 2025, some in 2026), a date without a year leaves the reader unable to tell which year it means. The same holds where the dates cross the turn of a year (December and January). When every dated date is in one year, the reader can tell the year without it.

     → Write the year (January 15, 2027).

     Relax this rule:  npx chaffjs relax date-without-year


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Office lease renewal

## Timeline

- November 28, 2026: the landlord sends the new terms
- December 15, 2026: our reply is due
- January 9, 2027: the board approves the renewal
- February 1, 2027: the new lease starts
```

## How it was fixed

The timeline runs from November 2026 to February 2027.
Every date has a year except January 9, which sits between a December date and a February date of different years.
A reader can guess that it means January 2027, but the board secretary booking the meeting should not have to guess.

The fix writes the year.
chaff does not report a document whose dates are all in one year, or one that writes the year once and the other dates without it. In those, the year is clear.

## Settings

A date without a year is a note at the default level and a warning at `strict`.

In minutes, emails and speeches, the date at the top is the day the text is about, and a day and month within five months of it are read as that year's.
The genres that work this way are listed in the option `dated_genres` (see the `explain` output below).

`relaxed` keeps it a note. If your readers always know the year from the context, turn it off:

```yaml chaff-settings
rules:
  date-without-year: off
```

```text chaff-explain
$ npx chaffjs explain date-without-year --genre business/report

  Date without a year   (date-without-year)

  When the document's dates span more than one year (some in 2025, some in 2026), a date without a year leaves the reader unable to tell which year it means. The same holds where the dates cross the turn of a year (December and January). When every dated date is in one year, the reader can tell the year without it.

  How to fix: Write the year (January 15, 2027).

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Options (set under options in chaff.yaml):
    dated_genres: [business/meeting-notes, business/email, speech]   (default)
      Genres whose date at the top is the day the text is about (the meeting, the letter, the speech or hearing). A day and month within five months of it is read as that year's. A web page's date at the top is the day it was posted, and its days and months may be any year's

  Set one:  write options: { date-without-year: { <name>: <value> } } in chaff.yaml

  Now: normal.

  Change it:  npx chaffjs relax date-without-year --why "reason"
```

[All samples](README.md)
