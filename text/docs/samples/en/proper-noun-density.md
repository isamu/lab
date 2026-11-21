<!-- chaff-sample
rule: proper-noun-density
genre: business/report
file: trip.md
-->

# Too many proper nouns (`proper-noun-density`)

**Where it helps:** trip reports, meeting summaries, partner updates. Documents that record who was met, written by the person who met them.

## Original

```markdown chaff-before
# Trip report: the Hamburg food fair

I spent three days at the fair with Lena from the buying team.

On Tuesday we met Jonas Weber of Nordkorn and Marta Silva of Quinta Verde at the Nordkorn stand, then Pieter de Vries of Zuidhaven, who introduced us to Anke Brandt of Elbmühle and Tomasz Nowak of Polmlek. After lunch, Sofia Ricci of Campo Bello and Henrik Lund of Fjordfisk showed us their new ranges, and Claire Martin of Maison Dupré joined us with Yusuf Demir of Anadolu Foods.

On Wednesday, Elena Popescu of Carpatia took us to the Danube hall to meet Ivan Horvat of Jadran, Katrin Vogel of Alpenhof and Lukas Steiner of Bergkäse. In the afternoon we saw Nora Lindqvist of Skärgård, Oliver Grant of Highland Larder and Ines Moreau of Provençal Herbs.

On Thursday we had our last meetings with Jonas Weber again, Marta Silva and Pieter de Vries, then short calls with Ruth Cohen of Galil Farms, Hugo Laurent of Bretagne Mer and Aisha Khan of Spice Route.

Three of these suppliers sent samples of products we do not stock yet: the rye crackers, the smoked fish and the goat's cheese. I would like the buying team to taste them next week and decide which, if any, to order for the autumn.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report trip.md

trip.md   business/report · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    I spent three days at the fair with Lena from the buying team.

  ·  Too many proper nouns

     220 proper nouns per 1000 words (limit 190)
     A run of product, company and person names hides the shape of the sentence from anyone who does not already know them. It reads fine to the person who wrote it.

     → After first use, refer back to it. One phrase saying what it is lets a stranger keep reading.

     Relax this rule:  npx chaffjs relax proper-noun-density


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Trip report: the Hamburg food fair

I spent three days at the fair with Lena from the buying team.

We met nineteen suppliers in all: thirteen we already buy from and six new ones. The full list, with the name of each person we spoke to, is in the attached sheet.

Three of the new suppliers matter most. Nordkorn, a bakery from the north of Germany, makes the rye crackers we have been looking for. Fjordfisk smokes fish in Norway and can deliver to our warehouse every week. Alpenhof, a small dairy in Austria, makes a goat's cheese that would fill the gap left by our old supplier.

On the last day we met Nordkorn again to talk about prices, and we will meet Fjordfisk and Alpenhof online in May.

All three sent samples of products we do not stock yet. I would like the buying team to taste them next week and decide which, if any, to order for the autumn.
```

## How it was fixed

The middle of the report is a diary of names, in the order they were met: chaff counts 220 per 1000 words, where the limit is 190. It points at the first name in the report, Lena in the opening line.
To the writer each name is a face and a conversation. To the buying team, who were not there, they are a wall of words, and the one thing the report asks them to do comes at the end with no way to tell which three suppliers sent the samples.

The fix moves the full list to the attached sheet and keeps in the text only the three suppliers that matter, each with one phrase saying what it is: a bakery from the north of Germany, a fish smoker in Norway, a small dairy in Austria.
A reader who has never heard of Nordkorn can now follow the report and act on it.

## Settings

The rule counts names per 1000 words of prose, and reports a document above 190; `strict` reports one above 130 and `relaxed` one above 260.
A name counts once however many words it has (Jonas Weber, Highland Larder), and lines that are not sentences, such as a letterhead, a list of attendees or a signature, are not counted, nor are months and weekdays.
Documents under 200 words are not measured.

A name listed under `names` in chaff.yaml counts as one name, however many names its words would otherwise make (Bank of England is one, not two):

```yaml chaff-settings
names:
  - Bank of England
```

```yaml chaff-settings
rules:
  proper-noun-density: relaxed
```

The rule does not run on contracts and statutes, manuals and help pages, academic papers, literature, speeches, or press releases, which name the people quoted and the organisations involved by form.

```text chaff-explain
$ npx chaffjs explain proper-noun-density --genre business/report

  Too many proper nouns   (proper-noun-density)

  A run of product, company and person names hides the shape of the sentence from anyone who does not already know them. It reads fine to the person who wrote it.

  How to fix: After first use, refer back to it. One phrase saying what it is lets a stranger keep reading.

  Levels:
    strict   up to 130 proper nouns per 1000 words
  → normal   up to 190 proper nouns per 1000 words
    relaxed  up to 260 proper nouns per 1000 words
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax proper-noun-density --why "reason"
```

[All samples](README.md)
