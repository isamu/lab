<!-- chaff-sample
rule: ellipsis-consistency
genre: docs/manual
file: export.md
-->

# Ellipses written two ways (`ellipsis-consistency`)

**Where it helps:** user guides that name menu commands, scripts, transcripts of interviews. Any document where ellipses appear more than once.

## Original

```markdown chaff-before
# Sharing a report

To keep a copy on your computer, open the File menu and choose Save As…, then pick a folder.
To send it to a colleague, choose Share… and type their name.
To print it, choose Print… and pick the printer by the door.
To send it outside the company, choose Export... and save it as a PDF first.

Reports saved this way keep the date they were made in the footer.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual export.md

export.md   docs/manual · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    mpany, choose Export... and save it as a PD

  ·  Ellipses written two ways

     The ellipsis "..." here, where the document usually writes "…" (1 of 4)
     An ellipsis written as "..." in some places and "…" in others makes the reader wonder whether the difference means something, and makes the document look pasted together; a search finds only one kind. chaff does not pick a side; it points at the way the document uses less.

     → Match the way the rest of the document writes it.

     Relax this rule:  npx chaffjs relax ellipsis-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Sharing a report

To keep a copy on your computer, open the File menu and choose Save As…, then pick a folder.
To send it to a colleague, choose Share… and type their name.
To print it, choose Print… and pick the printer by the door.
To send it outside the company, choose Export… and save it as a PDF first.

Reports saved this way keep the date they were made in the footer.
```

## How it was fixed

The menu commands are written with the single ellipsis character "…", as the screen shows them, except "Export...", typed with three full stops.
On the page the two look almost the same, but a search for "Export…" finds nothing, and the line looks pasted in from another guide.

The fix writes the ellipsis character there too.
chaff does not pick a side; a guide written mostly with three dots would have the "…" pointed at.

## Settings

The rarer way is reported while it is at most a third of the ellipses (34% at `normal`, 49% at `strict`, 20% at `relaxed`).
Code is not read, and a longer run of dots ("....") is not counted.

To stop checking:

```yaml chaff-settings
rules:
  ellipsis-consistency: off
```

```text chaff-explain
$ npx chaffjs explain ellipsis-consistency --genre docs/manual

  Ellipses written two ways   (ellipsis-consistency)

  An ellipsis written as "..." in some places and "…" in others makes the reader wonder whether the difference means something, and makes the document look pasted together; a search finds only one kind. chaff does not pick a side; it points at the way the document uses less.

  How to fix: Match the way the rest of the document writes it.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported while the less common way is at most 49% of the ellipses
  → normal   reported while the less common way is at most 34% of the ellipses
    relaxed  reported while the less common way is at most 20% of the ellipses
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax ellipsis-consistency --why "reason"
```

[All samples](README.md)
