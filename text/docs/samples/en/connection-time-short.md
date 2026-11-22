<!-- chaff-sample
rule: connection-time-short
genre: business/report
file: day-plan.md
-->

# A connection shorter than the stated travel time (`connection-time-short`)

**Where it helps:** travel itineraries, visit plans, event-day schedules. Any plan that says how long it takes to get from one place to the next.

## Original

```markdown chaff-before
# Day plan: supplier visit in Leeds

Tuesday 22 September 2026.

- 07:30 Train to Leeds (departs London King's Cross 07:30, arrives Leeds 09:45)
- 10:00 Meeting with the supplier at their works in Stourton (about 25 minutes by taxi from the station)
- 12:30 Lunch with the supplier's buyer
- 15:10 Train back to London (departs Leeds 15:10, arrives London King's Cross 17:25)

Taxis wait at the rank by the main entrance. The supplier will cover lunch.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report day-plan.md

day-plan.md   business/report · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    10:00 Meeting with the supplier at their works in Stourton (about 25 minutes by

  ⚠  A connection shorter than the stated travel time

     Only 15 minutes from 09:45 to 10:00, less than the stated travel time (25 minutes)
     When a schedule leaves less time than the travel time it states itself, as in "arrives Washington Reagan 9:05 AM" followed by "9:15 AM Meet Ms. Tanaka at Metro Center (25 minutes from the airport by Metro)", one of the times or the travel time is wrong, and whoever follows it will be late. Only travel times the document states are used (a length in the same sentence as a word of travel: "about 40 minutes by train", "allow 45 minutes"); real travel times are never assumed. A line that is itself a move ("09:30 Coach from York station to the Minster (about 15 minutes)") is measured from its time to the next item of the day; a travel time added to an item is measured from the arrival just before it.

     → Check the arrival, the next time and the stated travel time, and correct the wrong one.

     Relax this rule:  npx chaffjs relax connection-time-short


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Day plan: supplier visit in Leeds

Tuesday 22 September 2026.

- 07:30 Train to Leeds (departs London King's Cross 07:30, arrives Leeds 09:45)
- 10:30 Meeting with the supplier at their works in Stourton (about 25 minutes by taxi from the station)
- 12:30 Lunch with the supplier's buyer
- 15:10 Train back to London (departs Leeds 15:10, arrives London King's Cross 17:25)

Taxis wait at the rank by the main entrance. The supplier will cover lunch.
```

## How it was fixed

The train reaches Leeds at 09:45 and the meeting starts at 10:00, but the plan itself says the taxi takes about 25 minutes.
Followed to the letter, the day starts ten minutes late, before anyone has queued for a taxi.
Each line looks reasonable on its own; it is only the plan's own numbers, read together, that do not fit.

The fix moves the meeting to 10:30, which leaves time for the taxi rank and the walk to reception.
Catching an earlier train would work as well; either way, the times and the stated travel time now agree.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  connection-time-short: relaxed
```

Only travel times the document states are used: a length in the same sentence as a word of travel ("about 25 minutes by taxi", "allow 45 minutes").
chaff never assumes how long a journey really takes.
A time given as an upper limit ("within 10 minutes"), times on different dates or in different time zones, and a time whose previous time is not an arrival are not reported.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain connection-time-short --genre business/report

  A connection shorter than the stated travel time   (connection-time-short)

  When a schedule leaves less time than the travel time it states itself, as in "arrives Washington Reagan 9:05 AM" followed by "9:15 AM Meet Ms. Tanaka at Metro Center (25 minutes from the airport by Metro)", one of the times or the travel time is wrong, and whoever follows it will be late. Only travel times the document states are used (a length in the same sentence as a word of travel: "about 40 minutes by train", "allow 45 minutes"); real travel times are never assumed. A line that is itself a move ("09:30 Coach from York station to the Minster (about 15 minutes)") is measured from its time to the next item of the day; a travel time added to an item is measured from the arrival just before it.

  How to fix: Check the arrival, the next time and the stated travel time, and correct the wrong one.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax connection-time-short --why "reason"
```

[All samples](README.md)
