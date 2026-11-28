<!-- chaff-sample
rule: sentence-spacing-consistency
genre: business/email
file: email.md
-->

# One and two spaces between sentences mixed (`sentence-spacing-consistency`)

**Where it helps:** emails, letters, reports. Especially a text that two people have edited, one who leaves two spaces after a full stop and one who leaves one.

## Original

```markdown chaff-before
Subject: Parking during the roof repairs

Dear residents,

The roof of Block B will be repaired from 9 to 20 September. The scaffolding goes up on the first morning, and it takes up the six spaces nearest the entrance.

Please park in the visitors' area at the back while the work goes on. The barrier will stay open during the day.  If you need a space near the door, tell the office and we will keep one free.

Thank you for your patience.

Helen Ward
Estate Office
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email email.md

email.md   business/email · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    If you need a space near the door, tell the office and we will keep one free.

  ·  One and two spaces between sentences mixed

     2 spaces after this sentence, where the document usually leaves 1 (1 of 2)
     Sentences separated by one space in some places and two in others make a document look pasted together. chaff does not pick a side; it counts only breaks between sentences on one line and points at the less common way.

     → Match the spacing the rest of the document uses.

     Relax this rule:  npx chaffjs relax sentence-spacing-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Parking during the roof repairs

Dear residents,

The roof of Block B will be repaired from 9 to 20 September. The scaffolding goes up on the first morning, and it takes up the six spaces nearest the entrance.

Please park in the visitors' area at the back while the work goes on. The barrier will stay open during the day. If you need a space near the door, tell the office and we will keep one free.

Thank you for your patience.

Helen Ward
Estate Office
```

## How it was fixed

One space or two after a full stop are both accepted, but this letter leaves one everywhere except in one place.
That gap is the mark of a sentence typed by someone else, or pasted from an older letter.
A reader may not name it, but the paragraph looks uneven, and a search for the sentence break finds only one kind.

The fix closes the gap to one space, like the rest of the letter.
Only breaks between sentences on the same line are counted; spaces at the end of a line are left alone.

## Settings

At `normal` and `strict`, the rarer spacing is reported from its first use; `relaxed` waits for three.
When both ways are common, chaff gives one note with both counts.

To stop checking:

```yaml chaff-settings
rules:
  sentence-spacing-consistency: off
```

```text chaff-explain
$ npx chaffjs explain sentence-spacing-consistency --genre business/email

  One and two spaces between sentences mixed   (sentence-spacing-consistency)

  Sentences separated by one space in some places and two in others make a document look pasted together. chaff does not pick a side; it counts only breaks between sentences on one line and points at the less common way.

  How to fix: Match the spacing the rest of the document uses.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once the less common spacing appears 1 time
  → normal   reported once the less common spacing appears 1 time
    relaxed  reported once the less common spacing appears 3 times
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax sentence-spacing-consistency --why "reason"
```

[All samples](README.md)
