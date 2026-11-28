<!-- chaff-sample
rule: section-length-uniformity
genre: blog/owned-media
file: ghent.md
-->

# Section lengths are too uniform (`section-length-uniformity`)

**Where it helps:** travel guides, how-to articles, blog posts. Any article written by filling in an outline.

## Original

```markdown chaff-before
# A weekend in Ghent

Ghent is half an hour from Brussels by train, and small enough to see on foot in two days.

## Getting there

Trains from Brussels run every fifteen minutes and take about thirty minutes, from early morning until close to midnight. Get off at Gent-Sint-Pieters. Tram 1 takes you to the centre.

## Where to stay

The streets around the Korenmarkt put you within walking distance of the cathedral, the river and most restaurants. Book early in summer. The July festival fills the hotels.

## What to see

Start with the Altarpiece in Saint Bavo's Cathedral, then walk along the Graslei, the row of old guild houses by the river. In the afternoon, climb the Belfry. The view is worth it.

## Where to eat

Try a bowl of waterzooi, the local stew of chicken or fish in a creamy broth, at one of the small places near the Vrijdagmarkt. Kitchens close early. Sunday is the earliest.

## Getting around

The old town is small enough that walking is the easiest way to get from one sight to the next, even in the rain. Trams cover the rest. A day ticket costs about eight euros.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/owned-media ghent.md

ghent.md   blog/owned-media · English   genre from --genre

─── line 1 ───────────────────────────────────────────────────

    Ghent is half an hour from Brussels by train, and small enough to see on foot

  ·  Section lengths are too uniform

     Section length varies by only 21% (want at least 35%)
     Filling every heading to the same size is what a template does, not what a writer does.

     → Let the thin sections stay thin.

     Relax this rule:  npx chaffjs relax section-length-uniformity


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# A weekend in Ghent

Ghent is half an hour from Brussels by train, and small enough to see on foot in two days.

## Getting there

Trains from Brussels run every fifteen minutes. Get off at Gent-Sint-Pieters and take tram 1 to the centre.

## Where to stay

Anywhere near the Korenmarkt.

## What to see

Start with the Altarpiece in Saint Bavo's Cathedral. It is a set of panels painted in the 1430s, and it is kept in a side chapel with its own ticket, so buy that at the door before you look at the rest of the church.

From the cathedral, walk down to the Graslei, the row of old guild houses along the river. On a dry evening half the town sits on the quay with a drink.

In the afternoon, climb the Belfry. There is a lift most of the way, and the view takes in the whole old town and the castle.

## Where to eat

Try waterzooi, the local stew, near the Vrijdagmarkt. Kitchens close at 10 pm.

## Getting around

Walk. A tram day ticket costs about eight euros if you need one.
```

## How it was fixed

Every section of the guide is the same size, about two lines, whether it covers a whole day of sights or how to buy a tram ticket.
Filling every heading to the same length is what a template does. The reader cannot tell which section the writer cares about, and the cathedral gets no more room than the trams.

The corrected guide lets the thin sections stay thin ("Anywhere near the Korenmarkt"; "Walk") and gives the section on what to see the room it needs: why to buy the chapel ticket first, what the Graslei is like in the evening, the lift in the Belfry.

## Settings

The rule measures how much section lengths vary. It reports when they vary by less than 35%; `strict` asks for 45% and `relaxed` only for 25%:

```yaml chaff-settings
rules:
  section-length-uniformity: relaxed
```

Documents with fewer than five sections are not checked, nor is an interview, whose sections are each one question and its answer. The rule does not run on business, specification, legal, documentation, academic, literature or speech genres. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score ghent.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain section-length-uniformity --genre blog/owned-media

  Section lengths are too uniform   (section-length-uniformity)

  Filling every heading to the same size is what a template does, not what a writer does.

  How to fix: Let the thin sections stay thin.

  Levels:
    strict   reported when section length varies by less than 45%
  → normal   reported when section length varies by less than 35%
    relaxed  reported when section length varies by less than 25%
    off      not checked

  Options (set under options in chaff.yaml):
    min_sections: 5   (default)
      The fewest sections measured. With few sections, the variation is small by chance, and a person's writing looks uniform too

  Set one:  write options: { section-length-uniformity: { <name>: <value> } } in chaff.yaml

  Now: normal.

  Change it:  npx chaffjs relax section-length-uniformity --why "reason"
```

[All samples](README.md)
