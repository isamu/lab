<!-- chaff-sample
rule: capacity-runtime-mismatch
genre: technical/spec
file: field-tablet.md
-->

# A runtime longer than the battery capacity divided by the consumption (`capacity-runtime-mismatch`)

**Where it helps:** product spec sheets, datasheets, catalogue pages. Any page that gives a battery's capacity, the power drawn and how long it lasts.

## Original

```markdown chaff-before
# FT-8 field tablet: specification

A rugged tablet for inspections on site, readable in direct sunlight.

| Item | Specification |
| --- | --- |
| Display | 8-inch, 1,000 nits |
| Battery capacity | 50 Wh |
| Power consumption | 10 W |
| Runtime | 8 hours |
| Charging time | 3 hours |
| Weight | 780 g |

The battery can be swapped in the field without tools.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/spec field-tablet.md

field-tablet.md   technical/spec · English   genre from --genre

─── line 10 ──────────────────────────────────────────────────

    8 hours |

  ⚠  A runtime longer than the battery capacity divided by the consumption

     50 Wh at 10 W lasts 5 hours, but the runtime is given as 8 hours
     When a spec states "Capacity 5000 mAh, current draw 500 mA, runtime 15 hours", 5000 mAh at 500 mA lasts 10 hours, so 15 hours cannot be reached. It happens when the consumption or the runtime is replaced with the value of another condition or another model. A real runtime is normally shorter than the division because of conversion losses, so a shorter one is not reported. Only a runtime above the division by more than one step of its last written digit (1 hour for "15 hours") is reported; when any of the three is marked "about" or "up to", that margin is doubled.

     → Check that the capacity, the consumption and the runtime are values of the same condition, and correct the one that is not.

     Relax this rule:  npx chaffjs relax capacity-runtime-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# FT-8 field tablet: specification

A rugged tablet for inspections on site, readable in direct sunlight.

| Item | Specification |
| --- | --- |
| Display | 8-inch, 1,000 nits |
| Battery capacity | 50 Wh |
| Power consumption | 10 W |
| Runtime | 5 hours |
| Charging time | 3 hours |
| Weight | 780 g |

The battery can be swapped in the field without tools.
```

## How it was fixed

A 50 Wh battery drawing 10 W lasts at most five hours, and less once conversion losses are counted.
The sheet promised eight: the runtime had been measured with the screen dimmed, while the power consumption is the figure at full brightness.
A buyer planning a full shift of inspections on one battery would find out on site.

The fix gives the runtime the other two figures allow.
The other way to fix it is to state both under the same condition, for example "Power consumption (screen at 50%)" with the runtime measured the same way.

## Settings

The rule is a warning at `normal` and a note at `relaxed`:

```yaml chaff-settings
rules:
  capacity-runtime-mismatch: relaxed
```

A shorter runtime than the division is normal and never reported; only a longer one is, by more than one step of its last digit.
mAh is divided only by mA and Wh only by W, since the voltage behind a mAh rating cannot be told.
Only table rows and "Item: value" lines are read, and a maximum consumption is not used.

```text chaff-explain
$ npx chaffjs explain capacity-runtime-mismatch --genre technical/spec

  A runtime longer than the battery capacity divided by the consumption   (capacity-runtime-mismatch)

  When a spec states "Capacity 5000 mAh, current draw 500 mA, runtime 15 hours", 5000 mAh at 500 mA lasts 10 hours, so 15 hours cannot be reached. It happens when the consumption or the runtime is replaced with the value of another condition or another model. A real runtime is normally shorter than the division because of conversion losses, so a shorter one is not reported. Only a runtime above the division by more than one step of its last written digit (1 hour for "15 hours") is reported; when any of the three is marked "about" or "up to", that margin is doubled.

  How to fix: Check that the capacity, the consumption and the runtime are values of the same condition, and correct the one that is not.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax capacity-runtime-mismatch --why "reason"
```

[All samples](README.md)
