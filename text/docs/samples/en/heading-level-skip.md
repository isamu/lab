<!-- chaff-sample
rule: heading-level-skip
genre: docs/manual
file: coffee-machine.md
-->

# Heading level skipped (`heading-level-skip`)

**Where it helps:** manuals, help pages, handbooks. Any Markdown document with more than two levels of heading.

## Original

```markdown chaff-before
# Coffee machine guide

## Daily cleaning

Empty the drip tray and the grounds box at the end of each day.

#### Descaling

Run the descaling program once a month with one sachet of descaler.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual coffee-machine.md

coffee-machine.md   docs/manual · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    #### Descaling

  ·  Heading level skipped

     Heading "Descaling" goes from level 2 to level 4 (expected 3)
     A "####" right after a "##" leaves out a level. A table of contents and a screen reader show a document's shape by heading level, so the missing level reads as a section that went missing. It happens when a level is chosen for its size on screen. The first heading may start at any level; only a heading two or more levels deeper than the one before it is reported (as markdownlint's MD001 counts).

     → Make the heading one level deeper than the one before it. If only the size on screen was the point, change the style instead of the level.

     Relax this rule:  npx chaffjs relax heading-level-skip


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Coffee machine guide

## Daily cleaning

Empty the drip tray and the grounds box at the end of each day.

### Descaling

Run the descaling program once a month with one sachet of descaler.
```

## How it was fixed

"Descaling" is a `####` heading straight after a `##`, with no `###` between them.
A table of contents and a screen reader show the outline by heading level, so the guide appears to have a missing section above "Descaling".
This usually happens when a level is chosen for how small it looks on screen.

The fix makes "Descaling" one level deeper than the heading before it.
If the smaller size was the point, change the style, not the level.
A heading that goes back up ("##" after "####") is not reported.

## Settings

A skipped level is a note at the default level and a warning at `strict`; `relaxed` keeps it a note.

If your site's template needs headings at fixed levels, turn it off:

```yaml chaff-settings
rules:
  heading-level-skip: off
```

```text chaff-explain
$ npx chaffjs explain heading-level-skip --genre docs/manual

  Heading level skipped   (heading-level-skip)

  A "####" right after a "##" leaves out a level. A table of contents and a screen reader show a document's shape by heading level, so the missing level reads as a section that went missing. It happens when a level is chosen for its size on screen. The first heading may start at any level; only a heading two or more levels deeper than the one before it is reported (as markdownlint's MD001 counts).

  How to fix: Make the heading one level deeper than the one before it. If only the size on screen was the point, change the style instead of the level.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax heading-level-skip --why "reason"
```

[All samples](README.md)
