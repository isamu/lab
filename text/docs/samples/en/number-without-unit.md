<!-- chaff-sample
rule: number-without-unit
genre: business/proposal
file: budget.md
-->

# Number without its unit (`number-without-unit`)

**Where it helps:** budgets, price lists, reports with tables. Any column where every value should carry the same unit.

## Original

```markdown chaff-before
# Team offsite: budget

| Item | Cost |
| --- | --- |
| Venue hire | $1,800 |
| Lunch for 24 people | 720 |
| Coach to and from the venue | $650 |
| Facilitator | $1,200 |
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal budget.md

budget.md   business/proposal · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    720 |

  ⚠  Number without its unit

     "720" has no unit (the other "Cost" values carry "$")
     Every other value in the same table column, or under the same label ("Budget:"), carries a unit, and this one is a bare number. The reader has to guess whether it is dollars or thousands, minutes or hours. In prose too, when a document writes a word of scale (million, thousand, billion) with a unit many times ("$83 million"), the one number written with that word and no unit ("83 million") is pointed out.

     → Write the unit. If every value in a column shares it, you can move it to the header ("Amount ($)") and drop it from the values.

     Relax this rule:  npx chaffjs relax number-without-unit


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Team offsite: budget

| Item | Cost |
| --- | --- |
| Venue hire | $1,800 |
| Lunch for 24 people | $720 |
| Coach to and from the venue | $650 |
| Facilitator | $1,200 |
```

## How it was fixed

Every cost in the table has a dollar sign except lunch.
The reader can probably guess, but a budget is the document where nobody should have to: 720 could be dollars, or cents, or the number of sandwiches.
It happens when a figure is typed in from another sheet that kept its units in the header.

The fix writes the unit.
If every value in a column shares a unit, the unit can go in the header ("Cost ($)") and leave the values bare.

## Settings

A bare number is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your tables are read by people who know the unit, relax it:

```yaml chaff-settings
rules:
  number-without-unit: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

It is reported only when at least two other values in the column carry one and the same unit.

```text chaff-explain
$ npx chaffjs explain number-without-unit --genre business/proposal

  Number without its unit   (number-without-unit)

  Every other value in the same table column, or under the same label ("Budget:"), carries a unit, and this one is a bare number. The reader has to guess whether it is dollars or thousands, minutes or hours. In prose too, when a document writes a word of scale (million, thousand, billion) with a unit many times ("$83 million"), the one number written with that word and no unit ("83 million") is pointed out.

  How to fix: Write the unit. If every value in a column shares it, you can move it to the header ("Amount ($)") and drop it from the values.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax number-without-unit --why "reason"
```

[All samples](README.md)
