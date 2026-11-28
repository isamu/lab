<!-- chaff-sample
rule: unit-mismatch
genre: docs/manual
file: ridgeback.md
-->

# One item given in two units that do not convert (`unit-mismatch`)

**Where it helps:** product pages, specifications, recipes, travel guides. Any text that gives a value in two units.

## Original

```markdown chaff-before
# Ridgeback commuter e-bike

The Ridgeback weighs 19.5 kg (33 lb) with the battery fitted, light enough to carry up a flight of stairs.

- Range: up to 80 km (50 miles) on one charge
- Charging time: 4.5 hours
- Wheels: 700c, with puncture-resistant tyres
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual ridgeback.md

ridgeback.md   docs/manual · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    33 lb) with the battery fitted, light enough to carry up a flight of stairs.

  ⚠  One item given in two units that do not convert

     33 lb is given next to 19.5 kg, and they do not convert
     When one item is given as "Distance: 5 km" and later "Distance: 3000 m", the reader has to convert to find out which is right. It happens when the unit of one is rewritten and its number is not. Three places are read: values written as "Item: value" or "The item is value", and table cells, for the same item within one section; one value given in two units with the second in brackets ("180°C (350°F)", "300 kPa (about 44 psi)"); and an item of an ingredients table given in another unit in a step ("Soy sauce | 1 tablespoon" in the table, "30 ml of soy sauce" in a step), wherever in the document, against the first amount in the row (the first column when there is one per number of servings); only an amount larger than the one in the table is reported, since a smaller one may be a part of it. The kinds of quantity are length, mass, time, volume, data, temperature, pressure and area. A tsubo is 400/121 m² (about 3.306 m²). A tatami mat (畳) is not read as a unit of area: its size differs by region and building, and the advertising rules only set a minimum of 1.62 m². A tablespoon is 14.8 mL (US) or 15 mL (metric), a teaspoon 4.9 or 5 mL, a cup 240 mL (the US legal cup) or 250 mL, and either agrees. A rounded figure (1 mile and 1.6 km) agrees when the difference is within 2%, and a decimal also agrees within half of its last written digit (1.2 kg is 1.15 to 1.25 kg, so it agrees with 1,250 g; a whole number keeps the 2%, since its trailing zeros may or may not be rounding); two values side by side also agree when both could be roundings of one value at their last digits (44 psi to the unit, 100 miles to the ten). A temperature cannot be compared by a share, so it agrees within 15 °F (about 8 °C), less than one 25 °F step of an oven dial (conversion tables give 170 °C as 325 °F). A Fahrenheit figure below 32 °F is also compared as a difference (a rise of 0.5 °C is 0.9 °F). "degrees" alone is read as a temperature only when a word such as "oven" or "temperature" is on the same line.

     → Check which value is right and convert the other to match. Using one unit for an item throughout a document makes it easier to compare.

     Relax this rule:  npx chaffjs relax unit-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Ridgeback commuter e-bike

The Ridgeback weighs 19.5 kg (43 lb) with the battery fitted, light enough to carry up a flight of stairs.

- Range: up to 80 km (50 miles) on one charge
- Charging time: 4.5 hours
- Wheels: 700c, with puncture-resistant tyres
```

## How it was fixed

The bike weighs 19.5 kg, and the bracket says 33 lb.
19.5 kg is about 43 lb; 33 lb is about 15 kg.
A customer comparing bikes in pounds sees one ten pounds lighter than it is.

The fix converts the kilograms again.
chaff compares a value with the one in brackets beside it, and the same item given in two units in one section.
A rounded figure agrees within 2%, so the 80 km (50 miles) range in the list is fine.

## Settings

Two values that do not convert are a warning at the default level and a note at `relaxed`.

To relax it:

```yaml chaff-settings
rules:
  unit-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain unit-mismatch --genre docs/manual

  One item given in two units that do not convert   (unit-mismatch)

  When one item is given as "Distance: 5 km" and later "Distance: 3000 m", the reader has to convert to find out which is right. It happens when the unit of one is rewritten and its number is not. Three places are read: values written as "Item: value" or "The item is value", and table cells, for the same item within one section; one value given in two units with the second in brackets ("180°C (350°F)", "300 kPa (about 44 psi)"); and an item of an ingredients table given in another unit in a step ("Soy sauce | 1 tablespoon" in the table, "30 ml of soy sauce" in a step), wherever in the document, against the first amount in the row (the first column when there is one per number of servings); only an amount larger than the one in the table is reported, since a smaller one may be a part of it. The kinds of quantity are length, mass, time, volume, data, temperature, pressure and area. A tsubo is 400/121 m² (about 3.306 m²). A tatami mat (畳) is not read as a unit of area: its size differs by region and building, and the advertising rules only set a minimum of 1.62 m². A tablespoon is 14.8 mL (US) or 15 mL (metric), a teaspoon 4.9 or 5 mL, a cup 240 mL (the US legal cup) or 250 mL, and either agrees. A rounded figure (1 mile and 1.6 km) agrees when the difference is within 2%, and a decimal also agrees within half of its last written digit (1.2 kg is 1.15 to 1.25 kg, so it agrees with 1,250 g; a whole number keeps the 2%, since its trailing zeros may or may not be rounding); two values side by side also agree when both could be roundings of one value at their last digits (44 psi to the unit, 100 miles to the ten). A temperature cannot be compared by a share, so it agrees within 15 °F (about 8 °C), less than one 25 °F step of an oven dial (conversion tables give 170 °C as 325 °F). A Fahrenheit figure below 32 °F is also compared as a difference (a rise of 0.5 °C is 0.9 °F). "degrees" alone is read as a temperature only when a word such as "oven" or "temperature" is on the same line.

  How to fix: Check which value is right and convert the other to match. Using one unit for an item throughout a document makes it easier to compare.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax unit-mismatch --why "reason"
```

[All samples](README.md)
