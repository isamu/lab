<!-- chaff-sample
rule: number-style-consistency
genre: business/report
file: report.md
-->

# Numbers written two ways (`number-style-consistency`)

**Where it helps:** reports, newsletters, proposals. Any document where figures come from several people or spreadsheets.

## Original

```markdown chaff-before
# Food bank: winter report

From November to February we handed out 3,200 food parcels, the most in any winter so far.
Local schools collected 1,450 tins in their December drive.
The supermarket on the high street gave 2,100 kilos of fresh food that was close to its date.
Our volunteers gave 4800 hours over the four months.

In spring we will open a second collection point at the community centre.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report report.md

report.md   business/report · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    4800

  ·  Numbers written two ways

     "4800" here, where the document usually writes large numbers like "3,200" (1 of 4)
     How a document writes numbers (1,000 or 1000; 10% or 10 percent; three files or 3 files) is a choice either way. What reads badly is mixing them in one document, which makes the reader wonder whether the difference means something. chaff does not decide which is right; for digit grouping, the percent unit and counts (below ten, and ten to twelve, separately, so that a style that spells out small numbers stays consistent) it points at whichever the document uses less.

     → Match the way the rest of the document does it. If the team has decided, write it in the style guide.

     Relax this rule:  npx chaffjs relax number-style-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Food bank: winter report

From November to February we handed out 3,200 food parcels, the most in any winter so far.
Local schools collected 1,450 tins in their December drive.
The supermarket on the high street gave 2,100 kilos of fresh food that was close to its date.
Our volunteers gave 4,800 hours over the four months.

In spring we will open a second collection point at the community centre.
```

## How it was fixed

The report writes its large numbers with a comma, "3,200" and "1,450", except the volunteer hours, "4800".
The reader's eye slows on it, and in a row of figures it can look like a different kind of number, a code or a year.

The fix adds the comma, so all four figures read the same way.
chaff does not decide which style is right. It compares digit grouping, the percent sign against "percent", and counts spelled out against counts in figures, each on its own.

## Settings

The rarer style is reported while it is at most a third of its kind (34% at `normal`, 49% at `strict`, 20% at `relaxed`).
Numbers inside quotation marks, a number before a unit ("6 months") and a number that names something ("Room 12") are not counted.

To stop checking:

```yaml chaff-settings
rules:
  number-style-consistency: off
```

It is off for legal texts, which write a number twice on purpose ("thirty (30) days"), and for literature and speech.

```text chaff-explain
$ npx chaffjs explain number-style-consistency --genre business/report

  Numbers written two ways   (number-style-consistency)

  How a document writes numbers (1,000 or 1000; 10% or 10 percent; three files or 3 files) is a choice either way. What reads badly is mixing them in one document, which makes the reader wonder whether the difference means something. chaff does not decide which is right; for digit grouping, the percent unit and counts (below ten, and ten to twelve, separately, so that a style that spells out small numbers stays consistent) it points at whichever the document uses less.

  How to fix: Match the way the rest of the document does it. If the team has decided, write it in the style guide.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when the less common style is 49% of its kind or less
  → normal   reported when the less common style is 34% of its kind or less
    relaxed  reported when the less common style is 20% of its kind or less
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax number-style-consistency --why "reason"
```

[All samples](README.md)
