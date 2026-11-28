<!-- chaff-sample
rule: table-header-variant
genre: business/meeting-notes
file: plan.md
-->

# One table header written two ways (`table-header-variant`)

**Where it helps:** project plans, status reports, handbooks. Any document with several tables built by different people.

## Original

```markdown chaff-before
# Open day: who does what

The school open day is on Saturday 14 June. These are the jobs agreed at the meeting.

## Before the day

| Task | Owner | Due |
| --- | --- | --- |
| Print the maps | Grace | 10 June |
| Book the marquee | Daniel | 6 June |

## On the day

| Task | Owners | Due |
| --- | --- | --- |
| Run the welcome desk | Grace | 9 am |
| Serve tea in the hall | Amir | 10 am |

## After the day

| Task | Owner | Due |
| --- | --- | --- |
| Return the marquee | Daniel | 16 June |
| Send the thank-you notes | Amir | 20 June |
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/meeting-notes plan.md

plan.md   business/meeting-notes · English   genre from --genre

─── line 14 ──────────────────────────────────────────────────

    Owners

  ·  One table header written two ways

     The table header "Owners" here, where the document's other tables write "Owner" (1 of 3)
     When one table says "Owner" and another says "Owners" for the same column, the reader wonders whether they are different columns and stops to compare. chaff collects the header row of every table and the left cell of every two-column table (a field name). It treats two headers as one label when they are the same after folding width, case, spaces, hyphens and middle dots and dropping an ending that leaves the meaning alone (s, es). It then points at the less common spelling in the document, without deciding which is right.

     → If it is the same column, write it the way the rest of the document does. If it really is a different column, give it a name that shows the difference.

     Relax this rule:  npx chaffjs relax table-header-variant


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Open day: who does what

The school open day is on Saturday 14 June. These are the jobs agreed at the meeting.

## Before the day

| Task | Owner | Due |
| --- | --- | --- |
| Print the maps | Grace | 10 June |
| Book the marquee | Daniel | 6 June |

## On the day

| Task | Owner | Due |
| --- | --- | --- |
| Run the welcome desk | Grace | 9 am |
| Serve tea in the hall | Amir | 10 am |

## After the day

| Task | Owner | Due |
| --- | --- | --- |
| Return the marquee | Daniel | 16 June |
| Send the thank-you notes | Amir | 20 June |
```

## How it was fixed

Three tables share the same columns, but the middle one says "Owners".
A reader comparing the tables wonders whether that column works differently, whether a job on the day can have several people responsible, when every row still names one person.

The fix writes "Owner", like the other two tables.
chaff treats two headers as one label when they differ only in case, spaces, hyphens or a plural ending, and points at the spelling the document uses less.
If the column really were different, a name that shows the difference would be better than a plural.

## Settings

At `normal` and `strict`, the rarer spelling is reported when it is half of the header's uses or less; `relaxed` waits until it is a third or less.
chaff reads the header row of every table and the left cell of every two-column table.
Headers that differ in meaning ("Date" and "Time") and headers with no letters are not compared.

To stop checking:

```yaml chaff-settings
rules:
  table-header-variant: off
```

```text chaff-explain
$ npx chaffjs explain table-header-variant --genre business/meeting-notes

  One table header written two ways   (table-header-variant)

  When one table says "Owner" and another says "Owners" for the same column, the reader wonders whether they are different columns and stops to compare. chaff collects the header row of every table and the left cell of every two-column table (a field name). It treats two headers as one label when they are the same after folding width, case, spaces, hyphens and middle dots and dropping an ending that leaves the meaning alone (s, es). It then points at the less common spelling in the document, without deciding which is right.

  How to fix: If it is the same column, write it the way the rest of the document does. If it really is a different column, give it a name that shows the difference.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when the less common spelling is 50% of the header's uses or less
  → normal   reported when the less common spelling is 50% of the header's uses or less
    relaxed  reported when the less common spelling is 34% of the header's uses or less
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax table-header-variant --why "reason"
```

[All samples](README.md)
