<!-- chaff-sample
rule: amount-scale-consistency
genre: business/proposal
file: budget.md
-->

# Amounts of one size written two ways (`amount-scale-consistency`)

**Where it helps:** budgets, proposals, quotes. Any document that pulls figures together from several emails and spreadsheets.

## Original

```markdown chaff-before
# Library extension: budget

The extension adds a children's room and a study floor to the east side of the library.

The design stage will cost $1.2 million, including the survey and the planning application.
Building the extension is quoted at $6.8 million by the contractor we chose in March.
Furniture, shelving and computers for the new floors come to $2,400,000.

We ask the council for the full amount over two years, with the design paid in the first.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal budget.md

budget.md   business/proposal · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    new floors come to $2,400,000. We ask the counci

  ·  Amounts of one size written two ways

     "$2,400,000" here, where the document writes amounts of this size like "$1.2 million"
     When amounts of one size are written two ways ("$1.5 million for design, $2,500,000 for building"), the reader counts the zeros again and wonders whether the two are different kinds of amount. It happens when quotes and emails are pasted together. Small amounts in digits and large ones with "million" is a normal way of writing, so only amounts of the same order of magnitude are compared, and the way that order uses less is pointed at. Amounts in table cells are compared too.

     → Write amounts of the same size the way the rest of the document does.

     Relax this rule:  npx chaffjs relax amount-scale-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Library extension: budget

The extension adds a children's room and a study floor to the east side of the library.

The design stage will cost $1.2 million, including the survey and the planning application.
Building the extension is quoted at $6.8 million by the contractor we chose in March.
Furniture, shelving and computers for the new floors come to $2.4 million.

We ask the council for the full amount over two years, with the design paid in the first.
```

## How it was fixed

Two amounts are written with "million" and the third, of the same size, in full digits.
The reader counts the zeros to compare them, and may wonder whether the furniture figure is an exact quote while the others are estimates.
It is usually a figure pasted from a supplier's spreadsheet.

The fix writes it as "$2.4 million", like the others, so the three lines can be compared at a glance.
Amounts of different sizes are not compared: "$480" beside "$3 million" is a normal way of writing.

## Settings

The rule gives a note at `normal` and `relaxed`, and a warning at `strict`.
A precise amount that cannot be written with "million" ("$1,234,567") and an estimate ("about $1.3 million") are not compared, and each currency is compared only with itself.

To stop checking:

```yaml chaff-settings
rules:
  amount-scale-consistency: off
```

```text chaff-explain
$ npx chaffjs explain amount-scale-consistency --genre business/proposal

  Amounts of one size written two ways   (amount-scale-consistency)

  When amounts of one size are written two ways ("$1.5 million for design, $2,500,000 for building"), the reader counts the zeros again and wonders whether the two are different kinds of amount. It happens when quotes and emails are pasted together. Small amounts in digits and large ones with "million" is a normal way of writing, so only amounts of the same order of magnitude are compared, and the way that order uses less is pointed at. Amounts in table cells are compared too.

  How to fix: Write amounts of the same size the way the rest of the document does.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax amount-scale-consistency --why "reason"
```

[All samples](README.md)
