<!-- chaff-sample
rule: date-format-consistency
genre: business/meeting-notes
file: notes.md
-->

# Dates written two ways (`date-format-consistency`)

**Where it helps:** meeting notes, schedules, project plans. Any document where dates come from a calendar, a spreadsheet and someone's email.

## Original

```markdown chaff-before
# Garden project, planning meeting

The council confirmed the grant on 12 March 2026, so the work can start this spring.

The fence goes up first, on 4 April 2026, while the ground is still soft.
Volunteers will plant the fruit trees on 18 April 2026.
The raised beds arrive from the supplier on 2026-04-25, and we need six people that day to carry them in.

Next meeting: at the community hall, after the planting.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/meeting-notes notes.md

notes.md   business/meeting-notes · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    2026-04-25, and we need six people that day to carry them in.

  ·  Dates written two ways

     The date "2026-04-25" is written differently from 3 other dates in the document (such as "12 March 2026")
     One document writing "2026-10-02" in one place and "October 2, 2026" or "10/2/2026" in another makes the reader check whether the dates are the same kind, and 10/2 may be read as October 2 or 10 February. The mix usually comes from a pasted or later-added passage. chaff does not pick a style; it points at the minority. Only dates with a year, a month and a day are compared. Month names and eras are in each language's lexicon.

     → Write every date in the document the same way.

     Relax this rule:  npx chaffjs relax date-format-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Garden project, planning meeting

The council confirmed the grant on 12 March 2026, so the work can start this spring.

The fence goes up first, on 4 April 2026, while the ground is still soft.
Volunteers will plant the fruit trees on 18 April 2026.
The raised beds arrive from the supplier on 25 April 2026, and we need six people that day to carry them in.

Next meeting: at the community hall, after the planting.
```

## How it was fixed

The notes write dates as "4 April 2026", except the delivery date, copied from the supplier's confirmation as "2026-04-25".
The reader has to translate it before seeing that it falls a week after the planting, and a volunteer scanning for "April" misses it.

The fix writes it the same way as the other dates.
chaff does not pick a style; a document written mostly as "2026-04-04" would have the long dates pointed at.
Only dates with a year, a month and a day are compared.

## Settings

The rarer style is reported while it is at most a third of the dates (34% at `normal`, 49% at `strict`, 20% at `relaxed`).
Above that, the document is taken to use two styles on purpose (one in tables, one in the text).
Dates in code, in a reference list and inside web addresses are not compared.

To stop checking:

```yaml chaff-settings
rules:
  date-format-consistency: off
```

```text chaff-explain
$ npx chaffjs explain date-format-consistency --genre business/meeting-notes

  Dates written two ways   (date-format-consistency)

  One document writing "2026-10-02" in one place and "October 2, 2026" or "10/2/2026" in another makes the reader check whether the dates are the same kind, and 10/2 may be read as October 2 or 10 February. The mix usually comes from a pasted or later-added passage. chaff does not pick a style; it points at the minority. Only dates with a year, a month and a day are compared. Month names and eras are in each language's lexicon.

  How to fix: Write every date in the document the same way.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported while the minority style is 49% of the dates or less
  → normal   reported while the minority style is 34% of the dates or less
    relaxed  reported while the minority style is 20% of the dates or less
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax date-format-consistency --why "reason"
```

[All samples](README.md)
