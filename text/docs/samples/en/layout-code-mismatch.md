<!-- chaff-sample
rule: layout-code-mismatch
genre: business/proposal
file: flat-listing.md
-->

# A layout that does not match the rooms listed (`layout-code-mismatch`)

**Where it helps:** property listings, letting particulars, viewing sheets. Any listing that gives a layout and a list of the rooms.

## Original

```markdown chaff-before
# Flat 4, 18 Carlton Road

A second-floor flat five minutes' walk from the station, with views over the park.

| Item | Details |
| --- | --- |
| Rent | £1,450 a month |
| Layout | 3 bedrooms, 1 bathroom |
| Rooms | Living room, Kitchen, Bedroom 1, Bedroom 2, Bathroom |
| Available | From 1 January |

Viewings on weekday evenings and Saturday mornings. Call the office to book.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal flat-listing.md

flat-listing.md   business/proposal · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    3 bedrooms, 1 bathroom |

  ⚠  A layout that does not match the rooms listed

     The layout "3 bedrooms" has 3 rooms, but the room list names 2
     In a property listing, "3 bedrooms" and a room list of "Bedroom 1, Bedroom 2" cannot both be right, and a Japanese layout code such as 3LDK counts its rooms besides the living room, dining area, kitchen and any storage room (S). It happens when the details of another unit are copied, or when only the code is edited. A Japanese code is also checked for an L, D or K part the room list names and the code lacks (an LDK listed under a 2DK).

     → Compare the layout and the room list with the floor plan, and correct the wrong one.

     Relax this rule:  npx chaffjs relax layout-code-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Flat 4, 18 Carlton Road

A second-floor flat five minutes' walk from the station, with views over the park.

| Item | Details |
| --- | --- |
| Rent | £1,450 a month |
| Layout | 2 bedrooms, 1 bathroom |
| Rooms | Living room, Kitchen, Bedroom 1, Bedroom 2, Bathroom |
| Available | From 1 January |

Viewings on weekday evenings and Saturday mornings. Call the office to book.
```

## How it was fixed

The layout says three bedrooms, and the room list names two.
The listing was made from the one for flat 6 upstairs, which has a third bedroom over the porch, and the layout line was not changed.
Families searching for three bedrooms book a viewing and leave disappointed; the agent loses an evening and some goodwill.

The fix gives the layout the number of bedrooms the floor plan has.
If the room list is the wrong one, correct that instead; the two must name the same rooms.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  layout-code-mismatch: relaxed
```

Only the layout field (a table row, a column, or a "Layout:" line) and the rooms field, or a table of rooms, are read.
A den, a study and a box room are not counted as bedrooms, and a list that names a room some listings count and others do not (an office, a nursery) is left alone.
A listing without a room list is not checked.

```text chaff-explain
$ npx chaffjs explain layout-code-mismatch --genre business/proposal

  A layout that does not match the rooms listed   (layout-code-mismatch)

  In a property listing, "3 bedrooms" and a room list of "Bedroom 1, Bedroom 2" cannot both be right, and a Japanese layout code such as 3LDK counts its rooms besides the living room, dining area, kitchen and any storage room (S). It happens when the details of another unit are copied, or when only the code is edited. A Japanese code is also checked for an L, D or K part the room list names and the code lacks (an LDK listed under a 2DK).

  How to fix: Compare the layout and the room list with the floor plan, and correct the wrong one.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax layout-code-mismatch --why "reason"
```

[All samples](README.md)
