<!-- chaff-sample
rule: serial-range-reversed
genre: business/press-release
file: kettle-notice.md
-->

# A serial or lot number range that ends below where it starts (`serial-range-reversed`)

**Where it helps:** recall and safety notices, service bulletins, batch records. Any notice that tells people whether their product is affected.

## Original

```markdown chaff-before
# Safety notice: Brightway 2-litre electric kettle

We have found that the lid hinge on some Brightway 2-litre kettles can crack after repeated use, so the lid may open while the kettle is pouring. No injuries have been reported.

## Which kettles are affected

Kettles with serial numbers BW-8600 to BW-8100 are affected. The serial number is printed on the label under the base.

## What to do

Stop using the kettle and contact us for a free replacement. You do not need a receipt.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release kettle-notice.md

kettle-notice.md   business/press-release · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    with serial numbers BW-8600 to BW-8100 ar

  ⚠  A serial or lot number range that ends below where it starts

     The number range "BW-8600 to BW-8100" ends below where it starts
     When a range of serial or lot numbers ends below where it starts ("Serial numbers: B3900 to B3100", "Lots L5240 through L5210"), the reader cannot tell whether their product is in it. In a recall notice, affected units are missed or unaffected owners call in. It happens when only one of the two numbers is edited, or when they are written the wrong way round. Two letter-and-digit codes joined by a range mark (–, —), "to" or "through" are read only when "serial", "lot", "batch" or "S/N" stands earlier on the line. The numbers are compared only when both codes have the same letters, the same hyphen and the same number of digits (B3900 and B3100; B3900 and C0100 are different series).

     → Check both numbers, and correct the wrong one or write the smaller one first.

     Relax this rule:  npx chaffjs relax serial-range-reversed


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Safety notice: Brightway 2-litre electric kettle

We have found that the lid hinge on some Brightway 2-litre kettles can crack after repeated use, so the lid may open while the kettle is pouring. No injuries have been reported.

## Which kettles are affected

Kettles with serial numbers BW-8100 to BW-8600 are affected. The serial number is printed on the label under the base.

## What to do

Stop using the kettle and contact us for a free replacement. You do not need a receipt.
```

## How it was fixed

A safety notice exists so that an owner can turn the kettle over, read the label and know at once whether it is one of the affected ones.
"BW-8600 to BW-8100" runs backwards, and an owner with BW-8350 has to guess whether that is inside the range or not.
Some will keep using a kettle that should be replaced; others will call about a kettle that is fine.

The fix writes the lower number first, BW-8100 to BW-8600.
If one of the two numbers was mistyped, check it against the production record before the notice goes out: in a recall, the range is the whole message.

## Settings

A reversed range is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  serial-range-reversed: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

Two codes are read as a range only when "serial", "lot", "batch" or "S/N" stands earlier on the line, and only when both have the same letters, the same hyphen and the same number of digits.
Part numbers in a parts list, codes separated by a comma and codes with fewer than three digits are not compared.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain serial-range-reversed --genre business/press-release

  A serial or lot number range that ends below where it starts   (serial-range-reversed)

  When a range of serial or lot numbers ends below where it starts ("Serial numbers: B3900 to B3100", "Lots L5240 through L5210"), the reader cannot tell whether their product is in it. In a recall notice, affected units are missed or unaffected owners call in. It happens when only one of the two numbers is edited, or when they are written the wrong way round. Two letter-and-digit codes joined by a range mark (–, —), "to" or "through" are read only when "serial", "lot", "batch" or "S/N" stands earlier on the line. The numbers are compared only when both codes have the same letters, the same hyphen and the same number of digits (B3900 and B3100; B3900 and C0100 are different series).

  How to fix: Check both numbers, and correct the wrong one or write the smaller one first.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax serial-range-reversed --why "reason"
```

[All samples](README.md)
