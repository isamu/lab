<!-- chaff-sample
rule: max-paragraph-length
genre: business/report
file: pilot.md
-->

# Paragraph too long (`max-paragraph-length`)

**Where it helps:** reports, proposals, project updates. Documents where a reader looks for the result, the cost and the recommendation.

## Original

```markdown chaff-before
# Warehouse pilot: results after three months

From July to September, the north warehouse tried a new way of picking orders, where each picker works one aisle instead of walking the whole floor for every order. Pickers now walked about four kilometres a shift, down from eleven, and the share of orders packed on the day they arrived rose from 81 to 94 percent. The new layout did cost something: we needed two extra packers at the end of the line, because orders now arrive there in pieces and have to be put together by hand. Mistakes went down too, mostly because each picker now knows one aisle well and stops reaching for the wrong shelf. Staff were wary in the first two weeks and several asked to go back to the old way, but by the end of August most of them said in the survey that they preferred the new one. We recommend rolling the layout out to the south warehouse in the new year, once the extra packers are hired and trained, and keeping the north warehouse as it is.

The full figures for each week are in the attached sheet.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/report pilot.md

pilot.md   business/report · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    From July to September, the north warehouse tried a new way of picking orders, w

  ·  Paragraph too long

     This paragraph runs 6 sentences (limit 5)
     A dense paragraph gives the reader nowhere to pause. Short sentences do not make a wall, so it is reported only when it is also longer than that many sentences of ordinary length.

     → Split it where the topic turns.

     Relax this rule:  npx chaffjs relax max-paragraph-length


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Warehouse pilot: results after three months

From July to September, the north warehouse tried a new way of picking orders, where each picker works one aisle instead of walking the whole floor for every order. Pickers now walked about four kilometres a shift, down from eleven, and the share of orders packed on the day they arrived rose from 81 to 94 percent. Mistakes went down too, mostly because each picker now knows one aisle well and stops reaching for the wrong shelf.

The new layout did cost something: we needed two extra packers at the end of the line, because orders now arrive there in pieces and have to be put together by hand. Staff were wary in the first two weeks and several asked to go back to the old way, but by the end of August most of them said in the survey that they preferred the new one.

We recommend rolling the layout out to the south warehouse in the new year, once the extra packers are hired and trained, and keeping the north warehouse as it is.
The full figures for each week are in the attached sheet.
```

## How it was fixed

The whole result of the pilot sits in one paragraph of six long sentences: what was tried, what improved, what it cost, how staff took it and what to do next.
A manager who opens the report for the recommendation has to read through all of it to find the last sentence, and the cost is buried between two pieces of good news.

The fix splits the paragraph where the topic turns.
The first paragraph holds the gains, with the fewer mistakes moved up beside the other gains.
The second holds the costs: the extra packers and the wary start.
The recommendation now stands in a paragraph of its own, where it is found at a glance.

## Settings

The rule counts sentences in a paragraph, and reports a paragraph over five sentences in a report.
Short sentences do not make a wall, so a paragraph is reported only when it is also longer than five sentences of ordinary length.
`strict` allows three and `relaxed` eight; statutes, contracts, judgments and papers have their own limits (see the `explain` output below).

```yaml chaff-settings
rules:
  max-paragraph-length: relaxed
```

The rule does not run on literature or on a verbatim transcript.

```text chaff-explain
$ npx chaffjs explain max-paragraph-length --genre business/report

  Paragraph too long   (max-paragraph-length)

  A dense paragraph gives the reader nowhere to pause. Short sentences do not make a wall, so it is reported only when it is also longer than that many sentences of ordinary length.

  How to fix: Split it where the topic turns.

  Levels:
    strict   up to 3 sentences in a paragraph
  → normal   up to 5 sentences in a paragraph
    relaxed  up to 8 sentences in a paragraph
    off      not checked

  These numbers are for business/report. legal / legal/statute / legal/judgment / academic have numbers of their own.

  Now: normal.

  Change it:  npx chaffjs relax max-paragraph-length --why "reason"
```

[All samples](README.md)
