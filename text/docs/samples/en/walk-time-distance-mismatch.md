<!-- chaff-sample
rule: walk-time-distance-mismatch
genre: business/proposal
file: flat-listing.md
-->

# A walking time that does not match the stated distance (`walk-time-distance-mismatch`)

**Where it helps:** property listings, hotel and venue directions, campus guides. Any document that gives a walk in minutes and in metres, and says how it counts.

## Original

```markdown chaff-before
# To let: two-bedroom flat, Mill Lane

A bright second-floor flat with a balcony facing the park.

| Rent | £1,150 per month |
| --- | --- |
| Deposit | five weeks' rent |
| Access | Mill Lane Station, a 4-minute walk (720 m) |
| Shops | Corner supermarket, a 2-minute walk (150 m) |

Walking times assume 80 m per minute, rounded up to the next minute.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal flat-listing.md

flat-listing.md   business/proposal · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    4-minute walk (720 m) |

  ⚠  A walking time that does not match the stated distance

     "4-minute walk" does not match "720 m" (9 minutes at 80 m per minute)
     When a listing says "a 3-minute walk (600 m)" while it states that walking times assume 80 m per minute, the time or the distance is wrong: 600 m is 8 minutes at that rate. A number of minutes with a word of walking ("walk", "on foot") is compared only with a distance written right before or after it, and only at a rate the document states itself ("80 m per minute", "5 km/h"); without a stated rate, only a Japanese property listing (profile listing, chosen by its shape when no profile is set) uses the advertising standard of 80 m a minute, rounded up, and nothing else is compared. Part minutes may be rounded either way, or only up when the rate line says so. An approximate distance ("about 1.2 km") is read with the width of its last digit.

     → Check the distance and the walking time, and correct the wrong one, using the rate the document states.

     Relax this rule:  npx chaffjs relax walk-time-distance-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# To let: two-bedroom flat, Mill Lane

A bright second-floor flat with a balcony facing the park.

| Rent | £1,150 per month |
| --- | --- |
| Deposit | five weeks' rent |
| Access | Mill Lane Station, a 9-minute walk (720 m) |
| Shops | Corner supermarket, a 2-minute walk (150 m) |

Walking times assume 80 m per minute, rounded up to the next minute.
```

## How it was fixed

The listing says how it counts: 80 m a minute, rounded up.
At that rate 720 m is a 9-minute walk, not 4.
The corner shop's line agrees with the rate; the station's does not.
For someone choosing a flat, the walk to the station is the line that matters most, and a viewing that starts with a 9-minute walk after a promise of 4 starts badly.

The fix writes the walking time that the distance gives, 9 minutes.
If the distance was the wrong figure, correct that instead, using the same rate.

## Settings

A walking time that does not match is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  walk-time-distance-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

Minutes with a word of walking ("walk", "on foot") are compared with a distance written right beside them, at the rate the document states ("80 m per minute", "5 km/h").
A document that states no rate, or two, is not compared; only a Japanese property listing falls back on the advertising standard of 80 m a minute.
Ranges, limits ("within a 10-minute walk") and approximate minutes are not read.
The rule runs in every genre except literature.

```text chaff-explain
$ npx chaffjs explain walk-time-distance-mismatch --genre business/proposal

  A walking time that does not match the stated distance   (walk-time-distance-mismatch)

  When a listing says "a 3-minute walk (600 m)" while it states that walking times assume 80 m per minute, the time or the distance is wrong: 600 m is 8 minutes at that rate. A number of minutes with a word of walking ("walk", "on foot") is compared only with a distance written right before or after it, and only at a rate the document states itself ("80 m per minute", "5 km/h"); without a stated rate, only a Japanese property listing (profile listing, chosen by its shape when no profile is set) uses the advertising standard of 80 m a minute, rounded up, and nothing else is compared. Part minutes may be rounded either way, or only up when the rate line says so. An approximate distance ("about 1.2 km") is read with the width of its last digit.

  How to fix: Check the distance and the walking time, and correct the wrong one, using the rate the document states.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax walk-time-distance-mismatch --why "reason"
```

[All samples](README.md)
