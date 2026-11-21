<!-- chaff-sample
rule: assistant-residue
genre: business/proposal
file: venues.md
-->

# Chat-reply residue (`assistant-residue`)

**Where it helps:** proposals, reports, emails, anything drafted in a chat assistant and pasted into a document.

## Original

```markdown chaff-before
# Choosing a venue for the spring offsite

We need a room for 40 people on 14 and 15 April, within an hour of the office by train.
Three venues fit the dates and the size.

The Mill at Hebden has the largest room and its own kitchen, at about 3,200 pounds for both days.
As of my last knowledge update, it also offered a discount for charities, but this may have changed.
Greystone House is cheaper than The Mill, at 2,600 pounds, but its room seats only 36 at tables.
The Old Library in the city centre costs 3,000 pounds and needs no travel at all, though it has no outdoor space.

I suggest The Mill, because it is the only one where the whole team can sit at tables and eat on site.
If we book by the end of January, the deposit is 500 pounds.

Would you like me to compare the catering menus of the three venues as well?
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/proposal venues.md

venues.md   business/proposal · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    As of my last knowledge update, it also offered a discount for charities, but this may have changed.

  ⚠  Chat-reply residue

     "as of my last knowledge update" is chat-reply wording (score 15, from 10)
     "As of my last knowledge update" and "I hope this helps" are what a chat reply leaves behind when pasted into a document. A knowledge-cutoff or AI disclaimer counts on its own; a courtesy people also write counts only when two come together.

     → Rewrite it for the document's reader, or delete it. Replace a knowledge-cutoff line with the date you checked and the source.

     Relax this rule:  npx chaffjs relax assistant-residue


─── line 14 ──────────────────────────────────────────────────

    Would you like me to compare the catering menus of the three venues as well?

  ⚠  Chat-reply residue

     "would you like me to" is chat-reply wording (score 15, from 10)
     "As of my last knowledge update" and "I hope this helps" are what a chat reply leaves behind when pasted into a document. A knowledge-cutoff or AI disclaimer counts on its own; a courtesy people also write counts only when two come together.

     → Rewrite it for the document's reader, or delete it. Replace a knowledge-cutoff line with the date you checked and the source.

     Relax this rule:  npx chaffjs relax assistant-residue


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Choosing a venue for the spring offsite

We need a room for 40 people on 14 and 15 April, within an hour of the office by train.
Three venues fit the dates and the size.

The Mill at Hebden has the largest room and its own kitchen, at about 3,200 pounds for both days.
Its website, checked on 8 January, lists a discount for charities; we would need to ask whether it applies to us.
Greystone House is cheaper than The Mill, at 2,600 pounds, but its room seats only 36 at tables.
The Old Library in the city centre costs 3,000 pounds and needs no travel at all, though it has no outdoor space.

I suggest The Mill, because it is the only one where the whole team can sit at tables and eat on site.
If we book by the end of January, the deposit is 500 pounds.
```

## How it was fixed

"As of my last knowledge update" and "Would you like me to" were written to the person chatting with the assistant, not to the colleagues who read the proposal.
The first is worse than out of place: it says the discount may not exist, without saying when or where anyone checked.

The fix replaces the knowledge-cutoff line with what a reader can rely on: where the discount is listed and the date it was checked, and the question that is still open.
The offer to compare menus is deleted. If the menus matter, the writer can compare them; if not, the proposal ends where its point ends.

## Settings

Each listed phrase has a weight. A knowledge-cutoff or AI disclaimer ("as of my last knowledge update", "as an AI language model") is reported on its own; a courtesy that people also write ("I hope this helps") is reported only when another one comes with it.

`relaxed` asks for twice the score. To stop checking, turn it off:

```yaml chaff-settings
rules:
  assistant-residue: relaxed
```

The rule runs in every genre except transcripts. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score venues.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain assistant-residue --genre business/proposal

  Chat-reply residue   (assistant-residue)

  "As of my last knowledge update" and "I hope this helps" are what a chat reply leaves behind when pasted into a document. A knowledge-cutoff or AI disclaimer counts on its own; a courtesy people also write counts only when two come together.

  How to fix: Rewrite it for the document's reader, or delete it. Replace a knowledge-cutoff line with the date you checked and the source.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported from a score of 10
  → normal   reported from a score of 10
    relaxed  reported from a score of 20
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax assistant-residue --why "reason"
```

[All samples](README.md)
