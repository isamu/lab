<!-- chaff-sample
rule: figure-reference-order
genre: academic/paper
file: paper.md
-->

# Figures and tables referred to out of order or out of place (`figure-reference-order`)

**Where it helps:** research papers, theses, technical reports with numbered figures and tables.

## Original

```markdown chaff-before
# Bicycle parking demand at suburban rail stations

## Abstract

We counted parked bicycles at 12 suburban stations over 8 weeks.

## Results

Figure 2 shows occupancy by hour on a typical weekday.
Occupancy peaked at 91% at 08:30.
Figure 1 shows where the 12 stations are.

Figure 1: Location of the 12 stations

Figure 2: Rack occupancy by hour
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre academic/paper paper.md

paper.md   academic/paper · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    Figure 1 shows where the 12 stations are.

  ·  Figures and tables referred to out of order or out of place

     Figure 1 is first referred to after Figure 2
     In a paper, figures and tables are numbered in the order the text first refers to them, and placed near that reference. When Figure 2 is referred to before Figure 1, or a figure is first referred to only after the section it appears in, the reader goes back and forth between the figure and the text. It happens after figures are swapped or sections moved. Three things are checked. A figure whose first reference comes out of numeric order; a figure first referred to only past a heading after its caption; and a figure never referred to while others of its kind are.

     → Renumber the figures and tables in the order they are first referred to, or reorder the references. Place each figure near its first reference, and refer to every figure or remove it.

     Relax this rule:  npx chaffjs relax figure-reference-order


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Bicycle parking demand at suburban rail stations

## Abstract

We counted parked bicycles at 12 suburban stations over 8 weeks.

## Results

Figure 1 shows where the 12 stations are.
Figure 2 shows occupancy by hour on a typical weekday.
Occupancy peaked at 91% at 08:30.

Figure 1: Location of the 12 stations

Figure 2: Rack occupancy by hour
```

## How it was fixed

The text refers to Figure 2 before Figure 1.
A reader who follows the text looks at the second figure first, then turns back for the first one. Figures are numbered in the order the text first mentions them, so the numbering no longer tells the reader where to look next.
This happens when two figures are swapped late in the writing and their numbers stay.

The fix moves the sentence about Figure 1 before the one about Figure 2.
The other fix would be to swap the figures' numbers and captions.
chaff also reports a figure the text never refers to, and one first referred to only after the section it appears in.

## Settings

A figure out of order is a note at the default level and a warning at `strict`; `relaxed` keeps it a note.

If your venue numbers figures in its own way, turn it off:

```yaml chaff-settings
rules:
  figure-reference-order: off
```

It runs only for the academic paper genre (`academic/paper`).

```text chaff-explain
$ npx chaffjs explain figure-reference-order --genre academic/paper

  Figures and tables referred to out of order or out of place   (figure-reference-order)

  In a paper, figures and tables are numbered in the order the text first refers to them, and placed near that reference. When Figure 2 is referred to before Figure 1, or a figure is first referred to only after the section it appears in, the reader goes back and forth between the figure and the text. It happens after figures are swapped or sections moved. Three things are checked. A figure whose first reference comes out of numeric order; a figure first referred to only past a heading after its caption; and a figure never referred to while others of its kind are.

  How to fix: Renumber the figures and tables in the order they are first referred to, or reorder the references. Place each figure near its first reference, and refer to every figure or remove it.

  Rewrite depth: structure (sections, headings and paragraphs are reorganised). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax figure-reference-order --why "reason"
```

[All samples](README.md)
