<!-- chaff-sample
rule: ai-tell
genre: blog/owned-media
file: news.md
-->

# Phrasing common in generated text (`ai-tell`)

**Where it helps:** newsletters, announcements, blog posts, company news. Text that has to sound warm and ends up sounding like every other announcement.

## Original

```markdown chaff-before
# The reading room reopens on 6 May

Nestled in the heart of the old town, the reading room on Mill Street stands as a testament to the community that built it.
After eight months of work, it reopens on Monday 6 May.

The new room boasts a diverse array of seating, from long tables to four armchairs by the windows.
Better light plays a crucial role: the old ceiling lamps have been replaced, and every table now has its own lamp.
The shelves along the north wall hold the local history collection, which was in storage while the work went on.

The room is open from 9 am to 7 pm on weekdays and from 10 am to 4 pm on Saturdays.
Wi-Fi is free, and the two computers by the door can be booked at the front desk for an hour at a time.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/owned-media news.md

news.md   blog/owned-media · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    Nestled in the heart of the old town, the reading room on Mill Street stands as a testament to the community that built …

  ·  Phrasing common in generated text

     "plays a crucial role, a testament to, boasts, nestled, stands as, diverse array" appear together (score 40, limit 4)
     Each is ordinary on its own. Only the pile-up means anything, so the weights are summed (in a blog post, one of the heavier phrases, which human posts rarely use, is enough). This alone never says the text was generated.

     → Put it in your own words. If you cannot, the paragraph may not be needed.

     Relax this rule:  npx chaffjs relax ai-tell


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# The reading room reopens on 6 May

The reading room on Mill Street, built by a residents' fund in 1924, reopens on Monday 6 May after eight months of work.

There are now long tables for working and four armchairs by the windows for reading.
The old ceiling lamps have been replaced, and every table now has its own lamp, so the room is usable on a dark winter afternoon.
The shelves along the north wall hold the local history collection, which was in storage while the work went on.

The room is open from 9 am to 7 pm on weekdays and from 10 am to 4 pm on Saturdays.
Wi-Fi is free, and the two computers by the door can be booked at the front desk for an hour at a time.
```

## How it was fixed

"Nestled in the heart of", "stands as a testament to", "boasts a diverse array of" and "plays a crucial role" are each ordinary English.
Six of them in a short notice about a reading room are a pattern: they are the phrases generated text reaches for when it has to sound pleased about something, and they tell the reader nothing they can use.

The corrected notice replaces each phrase with what it was standing in for.
"A testament to the community that built it" became who built it and when. "A diverse array of seating" became the tables and the armchairs.
"Better light plays a crucial role" became what was changed and what it means for a reader on a winter afternoon.
The opening hours and the computers were already plain facts, so they stayed as they were.

## Settings

Each listed phrase has a weight, and the rule adds up the weights in a stretch of text. In a blog post, one of the heavier phrases is enough, because human posts rarely use them; in other genres the score has to climb higher before it says anything.

To report only a larger pile-up, relax the rule; to stop checking, turn it off:

```yaml chaff-settings
rules:
  ai-tell: relaxed
```

It does not run on legal, documentation, literature or transcripts. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score news.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain ai-tell --genre blog/owned-media

  Phrasing common in generated text   (ai-tell)

  Each is ordinary on its own. Only the pile-up means anything, so the weights are summed (in a blog post, one of the heavier phrases, which human posts rarely use, is enough). This alone never says the text was generated.

  How to fix: Put it in your own words. If you cannot, the paragraph may not be needed.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to a score of 4
  → normal   up to a score of 4
    relaxed  up to a score of 10
    off      not checked

  These numbers are for blog/owned-media. blog have numbers of their own.

  Now: normal.

  Change it:  npx chaffjs relax ai-tell --why "reason"
```

[All samples](README.md)
