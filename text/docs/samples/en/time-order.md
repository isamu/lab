<!-- chaff-sample
rule: time-order
genre: business/proposal
file: kickoff-day-2.md
-->

# A time out of order in a day's schedule (`time-order`)

**Where it helps:** itineraries, event programmes, agendas, timetables. Any list or table of a day that starts each item with a time.

## Original

```markdown chaff-before
# Sales kickoff 2026

## Day 2: Thursday, May 21

- 8:30 AM Registration and coffee
- 9:00 AM Keynote: the year ahead
- 10:15 AM Break
- 10:30 AM Customer panel
- 12:00 PM Lunch
- 11:30 AM Regional workshops (rooms A to C)
- 3:00 PM Awards
- 5:00 PM Close
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal kickoff-day-2.md

kickoff-day-2.md   business/proposal · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    11:30 AM Regional workshops (rooms A to C)

  ⚠  A time out of order in a day's schedule

     11:30 AM breaks the order of the times around it (after 12:00 PM)
     In a list or a table whose items start with a time, such as an itinerary or a programme, one time earlier than the item before it makes the reader check whether it is a typo or a swapped row, and someone turns up at the wrong time. A day's schedule runs from the earliest time, so a time against that order is pointed out. A day ends where a date heading or the date at the start of a row changes. A time past midnight, such as 0:15 after 23:30, is read as the next day's when it is marked so (+1, "next day"). Two times whose labels fix their order, such as doors open and the show's start, or meeting time and departure, are compared too, since doors that open after the start leave the audience outside when the show begins.

     → Check the time. Correct it if it is a typo, or move the item if the order is wrong.

     Relax this rule:  npx chaffjs relax time-order


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Sales kickoff 2026

## Day 2: Thursday, May 21

- 8:30 AM Registration and coffee
- 9:00 AM Keynote: the year ahead
- 10:15 AM Break
- 10:30 AM Customer panel
- 12:00 PM Lunch
- 1:30 PM Regional workshops (rooms A to C)
- 3:00 PM Awards
- 5:00 PM Close
```

## How it was fixed

The workshops are at 11:30 AM, after a 12:00 PM lunch and before a 3:00 PM session.
It is either a typo or a row in the wrong place, and the attendees who trust it come to an empty room at 11:30.

The workshops start after lunch, so the fix corrects the time to 1:30 PM.
If the order is what is wrong, move the item instead.
A day ends where a date heading changes, and a time after midnight is read as the next day's.

## Settings

A time out of order is a warning at the default level, an error at `strict` and a note at `relaxed`.

To relax it:

```yaml chaff-settings
rules:
  time-order: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain time-order --genre business/proposal

  A time out of order in a day's schedule   (time-order)

  In a list or a table whose items start with a time, such as an itinerary or a programme, one time earlier than the item before it makes the reader check whether it is a typo or a swapped row, and someone turns up at the wrong time. A day's schedule runs from the earliest time, so a time against that order is pointed out. A day ends where a date heading or the date at the start of a row changes. A time past midnight, such as 0:15 after 23:30, is read as the next day's when it is marked so (+1, "next day"). Two times whose labels fix their order, such as doors open and the show's start, or meeting time and departure, are compared too, since doors that open after the start leave the audience outside when the show begins.

  How to fix: Check the time. Correct it if it is a typo, or move the item if the order is wrong.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax time-order --why "reason"
```

[All samples](README.md)
