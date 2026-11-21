<!-- chaff-sample
rule: list-marker-mix
genre: docs/manual
file: kitchen.md
-->

# List bullets mixed (`list-marker-mix`)

**Where it helps:** guides, handbooks, READMEs written in Markdown. Especially a page where sections were pasted in from chat or another document.

## Original

```markdown chaff-before
# Using the shared kitchen

## Fridge

- Label your food with your name and the date.
- Take everything home on Friday.

## Dishwasher

- Load it from the back.
- Start it when it is full, not before.

## Coffee machine

* Empty the grounds tray before you go home.
* Refill the water tank if you take the last cup.

## Recycling

- Rinse cans and bottles first.
- Put the paper in the blue bin.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual kitchen.md

kitchen.md   docs/manual · English   genre from --genre

─── line 15 ──────────────────────────────────────────────────

    *

  ·  List bullets mixed

     This list uses the bullet "*", while 3 lists at the same depth use "-"
     Mixed bullets ("-", "*", "+", "・") do not show the way the writer meant. Changing the bullet partway through a list makes Markdown start a new list there, with a gap. A line typed with "・" inside a list item is not a list item; Markdown joins it to the line above. A single list in a document written with another bullet is usually pasted from elsewhere or half rewritten. chaff does not pick a bullet; among lists of the same depth it points at the smaller side.

     → Use the bullet most of the document's lists use. Make a line typed with "・" an item starting with "- ".

     Relax this rule:  npx chaffjs relax list-marker-mix


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Using the shared kitchen

## Fridge

- Label your food with your name and the date.
- Take everything home on Friday.

## Dishwasher

- Load it from the back.
- Start it when it is full, not before.

## Coffee machine

- Empty the grounds tray before you go home.
- Refill the water tank if you take the last cup.

## Recycling

- Rinse cans and bottles first.
- Put the paper in the blue bin.
```

## How it was fixed

Every list on the page uses "-", except the coffee machine, which uses "*".
On the rendered page both show as the same dot, but in the source the section stands out as pasted from somewhere else, and in a list that switches bullet halfway, Markdown starts a new list with a gap.

The fix uses "-", like the other lists.
chaff does not pick a bullet; among lists of the same depth it points at the smaller side.

## Settings

The rule gives a note at `normal` and `relaxed`, and a warning at `strict`.
Lists at different depths ("-" at the top, "*" nested) are not compared, and fewer than three lists at one depth are not read.
Numbered lists and lists in quotations or code are left out.

To stop checking:

```yaml chaff-settings
rules:
  list-marker-mix: off
```

```text chaff-explain
$ npx chaffjs explain list-marker-mix --genre docs/manual

  List bullets mixed   (list-marker-mix)

  Mixed bullets ("-", "*", "+", "・") do not show the way the writer meant. Changing the bullet partway through a list makes Markdown start a new list there, with a gap. A line typed with "・" inside a list item is not a list item; Markdown joins it to the line above. A single list in a document written with another bullet is usually pasted from elsewhere or half rewritten. chaff does not pick a bullet; among lists of the same depth it points at the smaller side.

  How to fix: Use the bullet most of the document's lists use. Make a line typed with "・" an item starting with "- ".

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax list-marker-mix --why "reason"
```

[All samples](README.md)
