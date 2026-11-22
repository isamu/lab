<!-- chaff-sample
rule: quote-unnamed-speaker
genre: business/press-release
file: cold-storage-hub.md
-->

# A quotation given to a speaker with no name (`quote-unnamed-speaker`)

**Where it helps:** press releases and reports that back a claim with someone's words.

## Original

```markdown chaff-before
# Northgate Logistics opens a cold-storage hub at the port

Northgate Logistics today opened a cold-storage hub next to the container terminal, with room for 14,000 pallets of chilled and frozen food.

Growers in the region have so far trucked their produce two hours inland to be stored before export.
"Cold storage near the port has held back fruit exports from this region for years," said an industry analyst.

The hub runs on rooftop solar panels for most of the day and is open to any shipper.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/press-release cold-storage-hub.md

cold-storage-hub.md   business/press-release · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    Cold storage near the port has held back fruit exports from this region for years

  ·  A quotation given to a speaker with no name

     "Cold storage near the port has held back fruit exports from this region for years" is given to "an industry analyst", who is not named
     Press releases and reports back their claims with quotations. When the speaker of "Few products do this," said an analyst is not named, the reader can neither check with that person nor weigh where they stand, and may read it as the writer's own claim put in an unnamed mouth. chaff cannot know who said what, but it can say that nobody to check with is named. It points at a quotation in quotation marks whose speaker, right before or right after it, is only a role ("an analyst", "a source", "officials"; the roles are in each language's unnamed-speaker word list) with no name.

     → Name the speaker and where they work ("said Hanako Mori, an analyst at Minato Research"). If the person cannot be named, do not lean on the quotation: say it without it, or cite a document named by its title.

     Relax this rule:  npx chaffjs relax quote-unnamed-speaker


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Northgate Logistics opens a cold-storage hub at the port

Northgate Logistics today opened a cold-storage hub next to the container terminal, with room for 14,000 pallets of chilled and frozen food.

Growers in the region have so far trucked their produce two hours inland to be stored before export.
"Cold storage near the port has held back fruit exports from this region for years," said Priya Raman, a supply-chain analyst at Westbrook Research.

The hub runs on rooftop solar panels for most of the day and is open to any shipper.
```

## How it was fixed

The release backs its main claim with a quotation from "an industry analyst".
A journalist cannot call an unnamed analyst to check the words, and a reader may take the quotation as the company's own claim put in someone else's mouth.

The fix names the speaker and where she works.
If the person cannot be named, do not lean on the quotation: state the point without it, or cite a published report by its title.
A role that is one person ("the CEO of Northgate") or one that points back at someone already named ("the analyst") is not reported.

## Settings

A quotation given to an unnamed speaker is a note at the default level and a warning at `strict`.
Only press releases and reports turn it on; elsewhere `quote-without-source` reads quotations.

To make it a warning, raise it:

```yaml chaff-settings
rules:
  quote-unnamed-speaker: strict
```

To stop checking it, write `off` instead of `strict`.

```text chaff-explain
$ npx chaffjs explain quote-unnamed-speaker --genre business/press-release

  A quotation given to a speaker with no name   (quote-unnamed-speaker)

  Press releases and reports back their claims with quotations. When the speaker of "Few products do this," said an analyst is not named, the reader can neither check with that person nor weigh where they stand, and may read it as the writer's own claim put in an unnamed mouth. chaff cannot know who said what, but it can say that nobody to check with is named. It points at a quotation in quotation marks whose speaker, right before or right after it, is only a role ("an analyst", "a source", "officials"; the roles are in each language's unnamed-speaker word list) with no name.

  How to fix: Name the speaker and where they work ("said Hanako Mori, an analyst at Minato Research"). If the person cannot be named, do not lean on the quotation: say it without it, or cite a document named by its title.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax quote-unnamed-speaker --why "reason"
```

[All samples](README.md)
