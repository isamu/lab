<!-- chaff-sample
rule: time-range-reversed
genre: business/press-release
file: programme.md
-->

# A time range that ends before it starts (`time-range-reversed`)

**Where it helps:** conference programmes, meeting agendas, shift rotas, opening hours. Anywhere a slot is written as two times.

## Original

```markdown chaff-before
# Regional sales conference: programme

Thursday 8 October 2026, Riverside Hotel, Hall B.

- 9:00–9:30 Registration and coffee
- 9:30–10:15 Opening remarks and the year so far
- 10:15–11:00 New pricing for the winter range
- 11:00–11:15 Break
- 11:15–11:05 Customer panel: what buyers want next year
- 12:15–13:15 Lunch in the hotel restaurant

The afternoon workshops start at 13:15. Rooms are listed on the back of your badge.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release programme.md

programme.md   business/press-release · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    11:15–11:05 Customer panel: what buyers want next year

  ⚠  A time range that ends before it starts

     The time range "11:15–11:05" ends before it starts
     When a time range such as "15:15–14:15" ends before it starts, the reader has to ask when it really ends, and the times after it are in doubt too. It happens when only one of the two times is changed, or when a line is copied from the one before. Two times are read as a range when only a range mark (–, —) or a word such as "until" stands between them, or when they are written "from … to …". When only one side carries a.m. or p.m., the other is read the same way ("2:00–1:30 pm" is 2 pm to 1:30 pm). A table with the start and the end in separate columns, such as a timesheet (Time in and Time out, Start and End), is compared row by row.

     → Check both times and correct the wrong one. If the range runs past midnight, mark the end as the next day.

     Relax this rule:  npx chaffjs relax time-range-reversed


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Regional sales conference: programme

Thursday 8 October 2026, Riverside Hotel, Hall B.

- 9:00–9:30 Registration and coffee
- 9:30–10:15 Opening remarks and the year so far
- 10:15–11:00 New pricing for the winter range
- 11:00–11:15 Break
- 11:15–12:15 Customer panel: what buyers want next year
- 12:15–13:15 Lunch in the hotel restaurant

The afternoon workshops start at 13:15. Rooms are listed on the back of your badge.
```

## How it was fixed

The customer panel is listed as 11:15–11:05: it ends ten minutes before it begins.
The panellists need to know how long they have, and the hotel needs to know when to serve lunch.
The next line starts at 12:15, so the panel was meant to run an hour, and "12:15" was typed as "11:05" when the line was copied from the one above.

The fix makes the end 12:15, which also closes the gap before lunch.
If a slot really does run past midnight (a night shift, a late event), mark its end as the next day.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  time-range-reversed: relaxed
```

Two times are read as a range when only a range mark (–) or a word such as "until" stands between them, or when they are written "from … to …".
A range whose end is marked as the next day ("22:00–6:00 +1"), and one that goes back three hours or more (overnight, or a 12-hour clock as in 9:00–5:00), are not reported.
When only one side carries a.m. or p.m., the range may cross noon, so only a step back of less than an hour is reported.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain time-range-reversed --genre business/press-release

  A time range that ends before it starts   (time-range-reversed)

  When a time range such as "15:15–14:15" ends before it starts, the reader has to ask when it really ends, and the times after it are in doubt too. It happens when only one of the two times is changed, or when a line is copied from the one before. Two times are read as a range when only a range mark (–, —) or a word such as "until" stands between them, or when they are written "from … to …". When only one side carries a.m. or p.m., the other is read the same way ("2:00–1:30 pm" is 2 pm to 1:30 pm). A table with the start and the end in separate columns, such as a timesheet (Time in and Time out, Start and End), is compared row by row.

  How to fix: Check both times and correct the wrong one. If the range runs past midnight, mark the end as the next day.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax time-range-reversed --why "reason"
```

[All samples](README.md)
