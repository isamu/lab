<!-- chaff-sample
rule: product-exceeds-maximum
genre: docs/manual
file: dosage.md
-->

# An amount per use times the uses that goes over the stated maximum (`product-exceeds-maximum`)

**Where it helps:** medicine leaflets, supplement labels, instructions for products used several times a day.

## Original

```markdown chaff-before
# Cold and flu tablets

## How to take them

Adults and children aged 12 and over: take 2 tablets at a time, up to 4 times a day, with water. Leave at least 4 hours between doses. Do not take more than 6 tablets in 24 hours.

Do not take these tablets with any other medicine that contains paracetamol.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual dosage.md

dosage.md   docs/manual · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    6 tablets in 24 hours.

  ⚠  An amount per use times the uses that goes over the stated maximum

     2 tablets each, 4 times a day, makes 8 tablets, more than the stated maximum of 6 tablets
     When "2 tablets at a time, up to 3 times a day" and "the maximum daily dose is 4 tablets" are written together, following the directions gives 6 tablets a day, over the stated maximum of 4. The reader cannot tell which to follow and may go over the limit. It happens when the amount, the count or the maximum is changed and the rest is not. In one paragraph holding exactly one labelled amount of one use ("2 tablets at a time", 1回2錠), one count of uses in a period ("3 times a day") and one maximum for the same period ("no more than 4 tablets in 24 hours"), in the same unit as the amount, the amount times the count is compared with the maximum. Fees are not compared (500 yen per use, 10 uses a day, a daily cap of 3,000 yen): a daily cap such as a parking fee cap is usually set below the total on purpose.

     → Check which of the amount, the count and the maximum is right and correct the rest.

     Relax this rule:  npx chaffjs relax product-exceeds-maximum


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Cold and flu tablets

## How to take them

Adults and children aged 12 and over: take 2 tablets at a time, up to 4 times a day, with water. Leave at least 4 hours between doses. Do not take more than 8 tablets in 24 hours.

Do not take these tablets with any other medicine that contains paracetamol.
```

## How it was fixed

The directions say 2 tablets at a time, up to 4 times a day: that is 8 tablets a day.
The next sentence says no more than 6 tablets in 24 hours.
A reader who follows the first sentence goes over the limit in the second, and a careful reader cannot tell which one to trust.

The leaflet here had the maximum wrong, so the fix makes it 8 tablets.
If the maximum is right, the count of times or the amount at a time is what needs to change.
chaff compares the three only when one paragraph states one of each, for the same period and in the same unit.

## Settings

A dose over its stated maximum is a warning at the default level, an error at `strict` and a note at `relaxed`.

If your documents give amounts and limits that are not meant to be multiplied, relax it:

```yaml chaff-settings
rules:
  product-exceeds-maximum: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain product-exceeds-maximum --genre docs/manual

  An amount per use times the uses that goes over the stated maximum   (product-exceeds-maximum)

  When "2 tablets at a time, up to 3 times a day" and "the maximum daily dose is 4 tablets" are written together, following the directions gives 6 tablets a day, over the stated maximum of 4. The reader cannot tell which to follow and may go over the limit. It happens when the amount, the count or the maximum is changed and the rest is not. In one paragraph holding exactly one labelled amount of one use ("2 tablets at a time", 1回2錠), one count of uses in a period ("3 times a day") and one maximum for the same period ("no more than 4 tablets in 24 hours"), in the same unit as the amount, the amount times the count is compared with the maximum. Fees are not compared (500 yen per use, 10 uses a day, a daily cap of 3,000 yen): a daily cap such as a parking fee cap is usually set below the total on purpose.

  How to fix: Check which of the amount, the count and the maximum is right and correct the rest.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax product-exceeds-maximum --why "reason"
```

[All samples](README.md)
