<!-- chaff-sample
rule: unit-spacing-consistency
genre: technical/spec
file: storage.md
-->

# Units spaced two ways (`unit-spacing-consistency`)

**Where it helps:** specifications, product pages, IT notices. Any document with sizes, speeds or weights.

## Original

```markdown chaff-before
# Shared drive: storage limits

Each person gets 50 GB on the shared drive, and each team folder gets 500 GB.
A single file can be up to 15 GB, so most video recordings fit.

When a team folder passes 450GB, its owner gets a warning by email.
Files in the bin count towards the limit until they are deleted for good, after 30 days.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/spec storage.md

storage.md   technical/spec · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    When a team folder passes 450GB, its owner gets a warning by email.

  ·  Units spaced two ways

     "450GB" here, where the document usually writes this unit like "50 GB" (1 of 4)
     A document writing "5 GB" in one place and "5GB" in another makes the reader wonder whether the difference means something, looks pasted together, and splits a search. chaff does not pick a side; unit by unit, it points at the way the document uses less.

     → Match the way the rest of the document writes units.

     Relax this rule:  npx chaffjs relax unit-spacing-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Shared drive: storage limits

Each person gets 50 GB on the shared drive, and each team folder gets 500 GB.
A single file can be up to 15 GB, so most video recordings fit.

When a team folder passes 450 GB, its owner gets a warning by email.
Files in the bin count towards the limit until they are deleted for good, after 30 days.
```

## How it was fixed

The sizes are written with a space, "50 GB", except the warning level, "450GB".
The page looks pasted together, and a search for "450 GB" misses the one line that tells the team when they will hear from IT.

The fix adds the space, like the rest of the page.
chaff does not pick a side; unit by unit, it points at the way the document uses less.

## Settings

The rarer way is reported while it is at most a third of the units (34% at `normal`, 49% at `strict`, 20% at `relaxed`).
Only unit symbols on chaff's list are read. One-letter symbols (m, g), the percent sign and temperatures are left out, since many styles write them unspaced on purpose. A no-break space counts as a space.

To stop checking:

```yaml chaff-settings
rules:
  unit-spacing-consistency: off
```

```text chaff-explain
$ npx chaffjs explain unit-spacing-consistency --genre technical/spec

  Units spaced two ways   (unit-spacing-consistency)

  A document writing "5 GB" in one place and "5GB" in another makes the reader wonder whether the difference means something, looks pasted together, and splits a search. chaff does not pick a side; unit by unit, it points at the way the document uses less.

  How to fix: Match the way the rest of the document writes units.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported while the less common way is at most 49% of the units
  → normal   reported while the less common way is at most 34% of the units
    relaxed  reported while the less common way is at most 20% of the units
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax unit-spacing-consistency --why "reason"
```

[All samples](README.md)
