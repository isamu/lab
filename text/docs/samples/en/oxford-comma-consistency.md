<!-- chaff-sample
rule: oxford-comma-consistency
genre: business/report
file: report.md
-->

# Oxford comma use is inconsistent (`oxford-comma-consistency`)

**Where it helps:** reports, proposals, manuals. Any document with lists in its sentences, especially one written by more than one person.

## Original

```markdown chaff-before
# Office move: progress in May

The new office on Mill Lane is ready for furniture.
The electricians finished the wiring, the lighting, and the alarm system in the first week.
The kitchen, the meeting rooms, and the quiet room were painted by the 20th.

We still need to sign off the fire exits, the lift and the car park.
The landlord's surveyor will visit on 3 June, and the move itself is planned for the weekend of 14 June.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report report.md

report.md   business/report · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    We still need to sign off the fire exits, the lift and the car park.

  ·  Oxford comma use is inconsistent

     This list punctuates differently from the rest (1 in this document)
     Whether to put a comma before the final "and" is a style-guide split. Neither is wrong. Mixed within one document, the reader re-parses every list.

     → Match the majority.

     Relax this rule:  npx chaffjs relax oxford-comma-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Office move: progress in May

The new office on Mill Lane is ready for furniture.
The electricians finished the wiring, the lighting, and the alarm system in the first week.
The kitchen, the meeting rooms, and the quiet room were painted by the 20th.

We still need to sign off the fire exits, the lift, and the car park.
The landlord's surveyor will visit on 3 June, and the move itself is planned for the weekend of 14 June.
```

## How it was fixed

Both ways of writing a list are correct English: with a comma before the final "and" (the Oxford comma) or without.
This report uses the comma twice, then drops it in the paragraph that was added later.
A careful reader stops at "the lift and the car park" and wonders whether the two are one item.

The fix adds the comma to the odd list, so all three lists read the same way.
chaff does not decide which style is right. A document that never uses the comma would have the comma-less list as its habit, and the other two would be pointed at instead.

## Settings

At `normal`, the rarer style is reported when it appears twice or fewer; `strict` allows three, `relaxed` one.
A document split evenly between the two styles has no minority and is not reported.

If your team does not mind the mix, turn it off:

```yaml chaff-settings
rules:
  oxford-comma-consistency: off
```

```text chaff-explain
$ npx chaffjs explain oxford-comma-consistency --genre business/report

  Oxford comma use is inconsistent   (oxford-comma-consistency)

  Whether to put a comma before the final "and" is a style-guide split. Neither is wrong. Mixed within one document, the reader re-parses every list.

  How to fix: Match the majority.

  Levels:
    strict   reported when the minority style appears 3 times or fewer
  → normal   reported when the minority style appears 2 times or fewer
    relaxed  reported when the minority style appears 1 times or fewer
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax oxford-comma-consistency --why "reason"
```

[All samples](README.md)
