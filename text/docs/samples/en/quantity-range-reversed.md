<!-- chaff-sample
rule: quantity-range-reversed
genre: technical/spec
file: timer-spec.md
-->

# A measured range whose upper end is below its lower end (`quantity-range-reversed`)

**Where it helps:** spec sheets, product labels, installation guides, data sheets. Any table of operating ranges, sizes and weights.

## Original

```markdown chaff-before
# Garden irrigation timer GT-200: specifications

| Item | Value |
| --- | --- |
| Inlet thread | 3/4 inch |
| Operating water pressure | 6 to 0.5 bar |
| Watering duration | 1 to 240 minutes per programme |
| Operating temperature | 5 to 45 °C |
| Batteries | 2 × AA alkaline |

Do not leave the timer outside below freezing. Bring it indoors over the winter.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/spec timer-spec.md

timer-spec.md   technical/spec · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    ng water pressure | 6 to 0.5 bar |

  ⚠  A measured range whose upper end is below its lower end

     The range "6 to 0.5 bar" ends below where it starts
     When a measured range ends below where it starts ("Operating temperature: -10 to -40 °C", "Weight: 5–2 kg"), the reader has to ask which value is right and what the range is. It happens in a spec sheet when only one of the two values is edited, when a minus sign is added, or when the two are written the wrong way round. Two quantities in one unit are read as a range when only a range mark (–, —) or "to" stands between them, including a range that writes its unit once ("30–10 cm"). A negative number is read with its sign, so -10 to -40 °C ends below its start and -40 to -10 °C does not. A hyphen right after a number ("5-10 kg") is a range mark, not a minus sign. Two quantities on one line labelled minimum and maximum are compared too.

     → Check both values and their signs, and correct the wrong one or write the smaller one first.

     Relax this rule:  npx chaffjs relax quantity-range-reversed


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Garden irrigation timer GT-200: specifications

| Item | Value |
| --- | --- |
| Inlet thread | 3/4 inch |
| Operating water pressure | 0.5 to 6 bar |
| Watering duration | 1 to 240 minutes per programme |
| Operating temperature | 5 to 45 °C |
| Batteries | 2 × AA alkaline |

Do not leave the timer outside below freezing. Bring it indoors over the winter.
```

## How it was fixed

The water pressure range was typed from the top down, 6 to 0.5 bar.
Every other row of the table reads from low to high, so a reader skimming it may take 6 bar as the lowest pressure the timer needs and decide it will not work on their garden tap.
On a spec sheet, a range that runs backwards is easily read as a different range.

The fix writes the smaller value first, 0.5 to 6 bar.
When a range runs backwards because a minus sign was added or dropped, check the signs too: −10 to −40 °C and −10 to 40 °C are very different ranges.

## Settings

A reversed range is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  quantity-range-reversed: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

Two quantities in the same unit are read as a range only when a range mark (–, —) or "to" stands between them, or when one line labels them minimum and maximum.
A sentence that describes a change or a descent ("cooled from 40 °C to 10 °C", "from 100 m down to 10 m") is not reported, and neither are two values in different units.
Negative numbers are read with their sign.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain quantity-range-reversed --genre technical/spec

  A measured range whose upper end is below its lower end   (quantity-range-reversed)

  When a measured range ends below where it starts ("Operating temperature: -10 to -40 °C", "Weight: 5–2 kg"), the reader has to ask which value is right and what the range is. It happens in a spec sheet when only one of the two values is edited, when a minus sign is added, or when the two are written the wrong way round. Two quantities in one unit are read as a range when only a range mark (–, —) or "to" stands between them, including a range that writes its unit once ("30–10 cm"). A negative number is read with its sign, so -10 to -40 °C ends below its start and -40 to -10 °C does not. A hyphen right after a number ("5-10 kg") is a range mark, not a minus sign. Two quantities on one line labelled minimum and maximum are compared too.

  How to fix: Check both values and their signs, and correct the wrong one or write the smaller one first.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax quantity-range-reversed --why "reason"
```

[All samples](README.md)
