<!-- chaff-sample
rule: spelling-consistency
genre: business/report
file: report.md
-->

# British and American spellings are mixed (`spelling-consistency`)

**Where it helps:** reports, proposals, web pages. Especially a document with paragraphs from writers on both sides of the Atlantic, or a draft from a tool that spells the American way.

## Original

```markdown chaff-before
# Visitor centre: first quarter

The visitor centre opened on 6 January and welcomed 4,200 people by the end of March.
Most came at weekends, and the busiest day was the Saturday of the half-term holiday.

The café in the centre took more than we planned, and the shop sold out of the local maps twice.
School groups have started to book the learning room in the centre for the summer term.

Next quarter we will extend the opening hours of the center to 6 pm from May to September.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report report.md

report.md   business/report · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    Next quarter we will extend the opening hours of the center to 6 pm from May to September.

  ·  British and American spellings are mixed

     "center" here, where the document usually spells it "centre" (1 of 4)
     British and American spellings (colour and color, centre and center, organise and organize) are both correct English. What reads badly is mixing them in one document, which makes search treat them as different words and makes another writer's paragraph stand out. chaff does not decide which is right; it points at whichever the document uses less. -ise and -ize are compared on their own, since Oxford spelling writes colour with organize. A word capitalised in the middle of a sentence (Labor Day, World Health Organization) is a name and is not counted, nor is anything in quotation marks, a word quoted on its own (‘organize’), the two spellings named side by side (analyse/analyze), or a reference list (a cited title or publisher keeps its own spelling). The literature preset turns it off, since old spelling belongs to its time. It says nothing when the minority is more than a third, since the document then mixes them on purpose (quotations, fixed terms).

     → Match the spelling the rest of the document uses. If the team has decided, write it in the style guide.

     Relax this rule:  npx chaffjs relax spelling-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Visitor centre: first quarter

The visitor centre opened on 6 January and welcomed 4,200 people by the end of March.
Most came at weekends, and the busiest day was the Saturday of the half-term holiday.

The café in the centre took more than we planned, and the shop sold out of the local maps twice.
School groups have started to book the learning room in the centre for the summer term.

Next quarter we will extend the opening hours of the centre to 6 pm from May to September.
```

## How it was fixed

"Centre" and "center" are both correct, but this report spells the word the British way everywhere except the last paragraph, which was drafted in a tool set to American English.
The odd spelling stands out to the reader, and a search for "centre" across the report misses the one sentence about the new opening hours.

The fix spells it "centre" there too.
chaff does not decide which spelling is right; it points at the one the document uses less.
"-ise" and "-ize" are compared on their own, so a document in Oxford spelling ("colour" with "organize") is consistent.

## Settings

At `normal`, the rarer spelling is reported when it is a third of the word's uses or less (34%); `strict` reports it up to 49%, `relaxed` only up to 20%.
Above that, the document mixes the two on purpose and nothing is said.
Names capitalised mid-sentence (Labor Day), quotations and reference lists are not counted.

If the team has decided which spelling to use, list the word to avoid and the word to use under `prefer`; `preferred-term` then checks that direction:

```yaml chaff-settings
prefer:
  center: centre
```

To stop this rule:

```yaml chaff-settings
rules:
  spelling-consistency: off
```

It is off for literature, where the spelling belongs to the work's time and place.

```text chaff-explain
$ npx chaffjs explain spelling-consistency --genre business/report

  British and American spellings are mixed   (spelling-consistency)

  British and American spellings (colour and color, centre and center, organise and organize) are both correct English. What reads badly is mixing them in one document, which makes search treat them as different words and makes another writer's paragraph stand out. chaff does not decide which is right; it points at whichever the document uses less. -ise and -ize are compared on their own, since Oxford spelling writes colour with organize. A word capitalised in the middle of a sentence (Labor Day, World Health Organization) is a name and is not counted, nor is anything in quotation marks, a word quoted on its own (‘organize’), the two spellings named side by side (analyse/analyze), or a reference list (a cited title or publisher keeps its own spelling). The literature preset turns it off, since old spelling belongs to its time. It says nothing when the minority is more than a third, since the document then mixes them on purpose (quotations, fixed terms).

  How to fix: Match the spelling the rest of the document uses. If the team has decided, write it in the style guide.

  Levels:
    strict   reported when the minority spelling is 49% of its group or less
  → normal   reported when the minority spelling is 34% of its group or less
    relaxed  reported when the minority spelling is 20% of its group or less
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax spelling-consistency --why "reason"
```

[All samples](README.md)
