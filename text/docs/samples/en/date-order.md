<!-- chaff-sample
rule: date-order
genre: business/report
file: office-move.md
-->

# A date out of order in a schedule (`date-order`)

**Where it helps:** project plans, office moves, itineraries, changelogs. Any list or table of dates that should run in order.

## Original

```markdown chaff-before
# Office move: key dates

The team moves from Carver Street to the new office at Dock Road this spring. The dates below are fixed with the building manager.

| Date | Step |
| --- | --- |
| 2 March 2026 | Floor plan and desk allocation agreed |
| 16 March 2026 | Network and phones installed at Dock Road |
| 30 March 2026 | Packing crates delivered to Carver Street |
| 23 March 2026 | Last working day at Carver Street |
| 6 April 2026 | First working day at Dock Road |

Please pack your desk before the last working day.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report office-move.md

office-move.md   business/report · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    23 March 2026 | Last working day at Carver Street |

  ⚠  A date out of order in a schedule

     23 March 2026 breaks the order of the dates around it (after 30 March 2026)
     In a list or a table of dates, such as an itinerary or milestones, or in a run of headings at one depth, such as the release headings of a changelog, one date earlier than the one before it makes the reader check whether it is a typo or a swapped row. The direction of the list (oldest or newest first) is taken from most of its steps, and only a date against it is pointed out. A list where no more than half of the dates follow that direction is taken as sorted by something else, such as a name or a version, and nothing is said.

     → Check the date. Correct it if it is a typo, or move the row if the order is wrong.

     Relax this rule:  npx chaffjs relax date-order


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Office move: key dates

The team moves from Carver Street to the new office at Dock Road this spring. The dates below are fixed with the building manager.

| Date | Step |
| --- | --- |
| 2 March 2026 | Floor plan and desk allocation agreed |
| 16 March 2026 | Network and phones installed at Dock Road |
| 20 March 2026 | Packing crates delivered to Carver Street |
| 23 March 2026 | Last working day at Carver Street |
| 6 April 2026 | First working day at Dock Road |

Please pack your desk before the last working day.
```

## How it was fixed

The table runs in date order, except for one row: the crates arrive on 30 March, a week after the last working day at Carver Street.
Read as written, everyone is asked to pack before the crates exist.
chaff names the date that comes first after a later one, 23 March, but the row that is wrong here is the one above it.

The crates were booked for the 20th, and "20" became "30" on the way into the table.
Correcting the typo puts the dates back in order and gives people the weekend to pack.
If a row had been swapped instead of mistyped, the fix would be to move it.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  date-order: relaxed
```

It reads the dates of a list, a table, or the headings at one depth (a changelog's releases).
The direction, oldest or newest first, is taken from most of the steps, and only a date against it is pointed out.
A list where no more than half of the dates run one way is taken as sorted by something else, and a deadline column after the first (| Action | Owner | Due date |) is left out.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain date-order --genre business/report

  A date out of order in a schedule   (date-order)

  In a list or a table of dates, such as an itinerary or milestones, or in a run of headings at one depth, such as the release headings of a changelog, one date earlier than the one before it makes the reader check whether it is a typo or a swapped row. The direction of the list (oldest or newest first) is taken from most of its steps, and only a date against it is pointed out. A list where no more than half of the dates follow that direction is taken as sorted by something else, such as a name or a version, and nothing is said.

  How to fix: Check the date. Correct it if it is a typo, or move the row if the order is wrong.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax date-order --why "reason"
```

[All samples](README.md)
