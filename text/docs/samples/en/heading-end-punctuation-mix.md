<!-- chaff-sample
rule: heading-end-punctuation-mix
genre: docs/manual
file: handbook.md
-->

# Heading end punctuation mixed (`heading-end-punctuation-mix`)

**Where it helps:** handbooks, guides, policies. Any document with a table of contents that people scan.

## Original

```markdown chaff-before
# Volunteer handbook

## Before your first shift

Read this handbook and bring a photo ID. We will give you a badge on the day.

## Signing in

Sign in at the front desk and write the time you arrive.

## What to wear:

Wear closed shoes and clothes that can get dusty. We provide gloves and an apron.

## Breaks

Take a break every two hours. Tea and coffee are in the back room.

## If something goes wrong

Tell the shift leader straight away. The first aid kit is under the front desk.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual handbook.md

handbook.md   docs/manual · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    ## What to wear:

  ·  Heading end punctuation mixed

     The heading "What to wear:" ends with ":", while 4 other headings end bare ("Before your first shift")
     When most headings end bare ("Setup", "Notes") and one ends with a colon or a full stop ("Prerequisites:", "Checks."), or the other way round, the reader wonders whether that heading is meant to be different, and it stands out in the table of contents. It is usually a heading pasted from elsewhere or not yet tidied. chaff does not pick a style; it points at the smaller side among headings of the same depth. Depths are compared apart, so a depth whose headings are all labels ("Optional:") is not reported.

     → End the heading the way most headings end. If most end bare, drop the colon or the full stop.

     Relax this rule:  npx chaffjs relax heading-end-punctuation-mix


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Volunteer handbook

## Before your first shift

Read this handbook and bring a photo ID. We will give you a badge on the day.

## Signing in

Sign in at the front desk and write the time you arrive.

## What to wear

Wear closed shoes and clothes that can get dusty. We provide gloves and an apron.

## Breaks

Take a break every two hours. Tea and coffee are in the back room.

## If something goes wrong

Tell the shift leader straight away. The first aid kit is under the front desk.
```

## How it was fixed

Four section headings end bare, and one ends with a colon.
In the table of contents that one heading looks like a label waiting for a list, and the reader wonders whether something is missing under it.
It is usually a line that was a lead-in in an earlier draft.

The fix drops the colon, so all five headings end the same way.
chaff does not pick a style; it compares headings of the same depth and points at the smaller side.

## Settings

The rule gives a note at `normal` and `relaxed`, and a warning at `strict`.
A depth with fewer than four headings is not compared, and nor is one where both ways are common (the smaller side above a quarter).
A heading ending with a question mark counts as bare, and the document's title is left out.

To stop checking:

```yaml chaff-settings
rules:
  heading-end-punctuation-mix: off
```

```text chaff-explain
$ npx chaffjs explain heading-end-punctuation-mix --genre docs/manual

  Heading end punctuation mixed   (heading-end-punctuation-mix)

  When most headings end bare ("Setup", "Notes") and one ends with a colon or a full stop ("Prerequisites:", "Checks."), or the other way round, the reader wonders whether that heading is meant to be different, and it stands out in the table of contents. It is usually a heading pasted from elsewhere or not yet tidied. chaff does not pick a style; it points at the smaller side among headings of the same depth. Depths are compared apart, so a depth whose headings are all labels ("Optional:") is not reported.

  How to fix: End the heading the way most headings end. If most end bare, drop the colon or the full stop.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax heading-end-punctuation-mix --why "reason"
```

[All samples](README.md)
