<!-- chaff-sample
rule: ai-structure
genre: business/proposal
file: proposal.md
-->

# The outline is unlike human articles (`ai-structure`)

**Where it helps:** proposals, reports, blog posts. Especially a document whose outline was asked for before its content.

## Original

```markdown chaff-before
# Proposal: a shared parcel room for the office

## Summary

We propose turning the unused print room on the ground floor into a locked parcel room.

## Current Situation

About 60 personal parcels arrive at reception each week, and they are stacked behind the desk until their owners collect them.

## Proposed Solution

The print room would get shelves and a door code, and reception would log each parcel and send its owner a message.

## Expected Benefits

Reception would get the space behind the desk back, and parcels would no longer go missing.

## Costs

Shelves and a keypad lock would cost about 900 pounds, and facilities can fit them in a day.

## Risks and Mitigation

People might forget their code, so reception would keep a list and could open the door for them.

## Conclusion

A parcel room would solve the problem at reception for a small cost.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal proposal.md

proposal.md   business/proposal · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    Summary

  ·  The outline is unlike human articles

     5 structure measures lie past 90% of human articles (3 needed): sections of one or two paragraphs, section length variation, headings in a stock form, the textbook proposal or report headings, almost no heading outside that outline
     Generated articles show their shape in the outline before the sentences, with a heading every paragraph, headings split into three, bold-label lists, sections of one size, and a closing that restates the body. Each of these turns up in human articles too. chaff compares measures such as heading density and section length variation with articles written before generated text was common, and counts how many lie past 90% of those articles. A proposal or report whose headings run through four or more sections of the textbook outline (Summary, Current Situation, Proposed Solution, Expected Benefits, Costs, Risks and Mitigation…) counts as one more, and as one more again when nearly every heading (three in four or more) is one of those sections. **Even then it does not say the text was generated.** It marks an outline to rethink.

     → Run `chaff outline` to see each measure against human articles, then rewrite from the outline. Merge thin sections, drop a heading over a single paragraph, split only as many ways as the content has, and cut a closing that only restates the body.

     Relax this rule:  npx chaffjs relax ai-structure


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# A locked parcel room in the old print room

About 60 personal parcels arrive at reception each week.
They are stacked behind the desk until their owners collect them, and two went missing last month.

I propose turning the unused print room on the ground floor into a locked parcel room.
Facilities can fit shelves and a keypad lock in a day, for about 900 pounds.
Reception would log each parcel, put it on a shelf and send its owner a message with the door code.

## If someone forgets the code

Reception would keep a list of codes and could open the door for anyone who forgets theirs.
The code would change each month, and the list would stay in the reception safe.
```

## How it was fixed

The proposal is short, but it has seven headings: the textbook outline of a proposal, from Summary to Conclusion, with one sentence under each.
A reader has to jump a heading for every sentence, and the headings say nothing about parcels; the same seven would fit a proposal about anything.
The Summary and the Conclusion say the same thing, and the cost and the risk get no more space than the benefits.

The corrected proposal starts with the problem and the number (60 parcels a week, two lost last month), then says what to do and what it costs, in two short paragraphs with no heading.
The only heading left is the one question a reader might really look for: what happens if someone forgets the code.
Run `npx chaffjs outline proposal.md` to see each measure next to human writing before and after a rewrite.

## Settings

chaff compares measures of the outline (how many paragraphs a section has, how even the sections are, how many headings take a stock form, emoji in headings, bold-label lists, three-way splits) with articles written by people.

A proposal or report also counts its textbook headings (Summary, Current Situation, Proposed Solution, Expected Benefits…) once four or more of them stand as headings.

It reports once three measures lie past 90% of those articles; `strict` reports from two and `relaxed` from four:

```yaml chaff-settings
rules:
  ai-structure: relaxed
```

A document without headings is not checked, and the rule does not run on legal, documentation, academic or speech genres, whose outlines follow their own conventions. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score proposal.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain ai-structure --genre business/proposal

  The outline is unlike human articles   (ai-structure)

  Generated articles show their shape in the outline before the sentences, with a heading every paragraph, headings split into three, bold-label lists, sections of one size, and a closing that restates the body. Each of these turns up in human articles too. chaff compares measures such as heading density and section length variation with articles written before generated text was common, and counts how many lie past 90% of those articles. A proposal or report whose headings run through four or more sections of the textbook outline (Summary, Current Situation, Proposed Solution, Expected Benefits, Costs, Risks and Mitigation…) counts as one more, and as one more again when nearly every heading (three in four or more) is one of those sections. **Even then it does not say the text was generated.** It marks an outline to rethink.

  How to fix: Run `chaff outline` to see each measure against human articles, then rewrite from the outline. Merge thin sections, drop a heading over a single paragraph, split only as many ways as the content has, and cut a closing that only restates the body.

  Rewrite depth: structure (sections, headings and paragraphs are reorganised). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once 2 measures lie past 90% of human articles
  → normal   reported once 3 measures lie past 90% of human articles
    relaxed  reported once 4 measures lie past 90% of human articles
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax ai-structure --why "reason"
```

[All samples](README.md)
