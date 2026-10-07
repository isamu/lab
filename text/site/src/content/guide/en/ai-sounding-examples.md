# Examples: making AI-sounding text sound human

Three worked examples for [Making AI-sounding text sound human](./ai-sounding), each from a draft to the checks after the rewrite.
Every document on this page was written for it, and every screen is what chaff printed.

| Example | Way | What it shows |
| --- | --- | --- |
| [From a fix plan to a clean check](#from-a-fix-plan-to-a-clean-check) | Full | A plan from `chaff fix-plan`, the rewrite, and the three checks the plan names |
| [A bold rewrite of a tech article](#a-bold-rewrite-of-a-tech-article) | Bold | The prose of each section rewritten with the outline kept, then `compare` and `ai-score` |
| [A full rewrite of a blog post](#a-full-rewrite-of-a-blog-post) | Full | An inventory, a new outline shown first, the rewrite, and `outline` and `compare` before and after |

## From a fix plan to a clean check

A short post written in the style of generated text, rewritten by following the plan from `chaff fix-plan`.
Both versions were written for this page.

The post before the rewrite (`draft.md`):

```markdown file=draft.md
# Moving Our Builds to a Shared Cache

In today's fast-paced world, build speed plays a crucial role in how a team ships. Let's delve into how we moved our builds to a shared cache.

The key point is that the cache is not just a speed-up. It's a change in how the whole team works. Moreover, it removed a whole class of flaky failures. Additionally, it cut our cloud bill.

Here's the thing: before the change, a full build took 14 minutes on every pull request. After the change, a typical build takes 3 minutes, because only the packages that changed are rebuilt. Furthermore, the cache key now includes the lockfile hash, so a dependency update can no longer reuse a stale result.

The migration was planned meticulously. It was rolled out over two weeks in March 2026, one repository at a time. A rollback switch was kept in place — just in case — and it was never used.

In conclusion, the shared cache is a testament to what careful engineering can achieve. I hope this helps!
```

The plan `chaff fix-plan` printed, cut after the first rule:

````markdown
$ npx chaffjs fix-plan draft.md
# Fix plan: draft.md

language en, genre blog/tech

What chaff found by machine, and how to rewrite each kind of spot. chaff does not rewrite; whoever reads this plan does, a person or an AI. When done, run the checks at the end.

## Constraints

1. Keep every fact, number, date, condition and name.
2. Add no fact, person, number, cause or example the original does not have.
3. Where a fix needs a specific the text does not give (who, when, how much), do not invent it: leave [ ] and ask the writer.
4. At most two passes. Do not rewrite again just to silence a finding.

## Recommended way: Full rewrite

ai-generated-composite fires. Fixing the wording would leave the skeleton of generated text.

Rewrite depth: structure (sections, headings and paragraphs are reorganised).

- Light (depth light): only the flagged spots.
- Bold (depth light): keep the outline, rewrite the prose of each section.
- Full (depth structure): take an inventory of the facts and claims, then rewrite from the structure up. If the request says "from scratch", choose this.
- Register (depth register): a full rewrite that also converts the style (polite to plain endings, and so on). chaff never recommends it; choose it with --depth register.

## Document-level signals

- `ai-generated-composite`: "ai-tell, padded-intro, closing-cliche" occur together in this document (3 signals, 3 needed)
- `ai-tell`: "delve into, in today's fast-paced world, plays a crucial role, a testament to, meticulously" appear together (score 39, limit 18)
- `padded-intro`: "in today's fast-paced world" is an opening that fits any article
- `closing-cliche`: Closes with "in conclusion"
- Outline: headings 1, average section 171 words, in lists 0%, bold 0

## Structure targets

Structure score: 0 (measures past 90% of human articles, of 3 compared). At 3 or more, rewrite from the outline.

Every structure measure is within the range of human articles.

## How to rewrite, rule by rule

### `ai-tell` Phrasing common in generated text

**Direction**: Replace the stock phrase with what the sentence actually claims, who does what and how much. If nothing is claimed, delete the sentence.

**Keep**

- numbers, dates, names and conditions
- how sure the writer is

**Avoid**

- inventing an example or a number the writer did not give
- trading one stock phrase for another ("plays a crucial role" for "is pivotal")
- giving every paragraph the same shape

**Example**

before:

> In today's fast-paced world, stock data plays a crucial role in ordering.

after:

> Orders are decided from stock data.

**Hints for the phrases found**

- "delve into" → look at, or explain
- "in today's fast-paced world" → delete it and start with the point
- "plays a crucial role" → say what it does
- "a testament to" → shows
- "meticulously" → carefully, and say what was checked

**Spots**

- line 3: "In today's fast-paced world, build speed plays a crucial role in how a team ships."
  "delve into, in today's fast-paced world, plays a crucial role, a testament to, meticulously" appear together (score 39, limit 18)

…

{not-run}

## Check after rewriting

Save the rewrite as draft.rewritten.md and run:

```bash
npx chaffjs draft.rewritten.md
npx chaffjs compare draft.md draft.rewritten.md --distinct --allow-dropped heading --allow-added heading
npx chaffjs outline draft.md draft.rewritten.md
```

The first lists the rewrite's findings, the second checks that no fact was dropped or added, the third shows how the outline moved. Take the numbers from chaff's output, not adjectives.
````

The plan recommends a full rewrite, because `ai-generated-composite` fires.
Following the hints for the phrases found, "In today's fast-paced world" and "Let's delve into" went, and the opening now starts with the build times.
The closing "In conclusion … I hope this helps!" was cut, since the body already ends on what happened. A full rewrite goes beyond the flagged spots, so "Moreover", "Additionally", "Furthermore" and the contrast "not just a speed-up" went too.

The rewrite (`draft.rewritten.md`):

```markdown file=draft.rewritten.md
# Moving Our Builds to a Shared Cache

Before the change, a full build took 14 minutes on every pull request. Now a typical build takes 3 minutes, because only the packages that changed are rebuilt.

The shared cache also removed a whole class of flaky failures and cut our cloud bill. Its key includes the lockfile hash, so a dependency update can no longer reuse a stale result.

We rolled it out over two weeks in March 2026, one repository at a time. We kept a rollback switch in place and never used it.
```

The checks from the plan:

```text
$ npx chaffjs draft.rewritten.md --compact
draft.rewritten.md   blog/tech · English   genre from the default


{counts}
```

```text
$ npx chaffjs compare draft.md draft.rewritten.md --distinct --allow-dropped heading --allow-added heading
draft.md → draft.rewritten.md

Facts checked: 4 → 4: numbers 2→2, dates 1→1, times 0→0, URLs 0→0, code 0→0, names 0→0, quotations 0→0, headings 1→1, references 0→0, footnotes 0→0
No fact dropped or added
```

```text
$ npx chaffjs outline draft.md draft.rewritten.md
draft.md outline: headings 1, average section 171 words, in lists 0%, bold 0

  # Moving Our Builds to a Shared Cache  (draft.md:1)  171 words

Structure score: 0 (measures past 90% of human articles, of 3 compared against 641 human articles)
  · usual in human articles: headings split into three 0, list items opening with a bold label 0, headings with an emoji 0
  not measured: headings (the document is short), sections of one or two paragraphs (few sections with text), section length variation (few sections with text), headings in a stock form (few headings), introduction / conclusion headings (few headings), closing that restates the body (no closing section), three-item lists (fewer than three lists), pros / cons pairs (few headings)

draft.rewritten.md outline: headings 1, average section 87 words, in lists 0%, bold 0

  # Moving Our Builds to a Shared Cache  (draft.rewritten.md:1)  87 words

Structure score: 0 (measures past 90% of human articles, of 3 compared against 641 human articles)
  · usual in human articles: headings split into three 0, list items opening with a bold label 0, headings with an emoji 0
  not measured: headings (the document is short), sections of one or two paragraphs (few sections with text), section length variation (few sections with text), headings in a stock form (few headings), introduction / conclusion headings (few headings), closing that restates the body (no closing section), three-item lists (fewer than three lists), pros / cons pairs (few headings)

How the shape changed (draft.md → draft.rewritten.md)
  headings: 1 → 1
  average section: 171 words → 87 words
  in lists: 0% → 0%
  bold: 0 → 0
  structure score: 0 → 0
  headings split into three: 0 → 0
  list items opening with a bold label: 0 → 0
  headings with an emoji: 0 → 0
```

Every number and date (14 minutes, 3 minutes, March 2026) is still there, and no fact was added.
The passive sentences about the rollout name who did it ("We rolled it out"), because the post is written as "we" from its first paragraph.

## A bold rewrite of a tech article

A tech article written in the style of generated text, rewritten with the bold rewrite.
Both versions were written for this page.

The article before (`ai.md`):

```markdown file=ai.md
# Solving Our Flaky Test Problem — The Hidden Trap of Time Zones

In this article, we'll delve into how we tracked down a flaky test on CI, from identifying the root cause to implementing a robust fix.

## What Was Happening

One test in our inventory API was failing on CI roughly **once every 30 runs**. It never failed locally.

This wasn't just a flaky test. It was a **silent drain on the team's time**.

To be honest, we ignored it for three weeks. A rerun always passed.

But each rerun took 12 minutes. That adds up. Before long, we were losing hours.

## Investigating the Root Cause

The key point is to line up the logs of the failed runs.

Here's what we found:

- **Every failure** ran between midnight and 9 a.m. Tokyo time
- Our CI runners use **UTC**
- The test took today's date from `new Date()` and expected the due date to be seven days later

In other words, on a Monday morning in Tokyo, the runner still thought it was Sunday.

What's important is that the error was silently swallowed. The date shift threw no exception, and the test quietly broke.

## The Solution

Here's how we fixed it:

- **Test**: pinned the clock with `jest.useFakeTimers` and `setSystemTime`
- **Workflow**: added `TZ=Asia/Tokyo`
- **Production code**: passed `timeZone: "Asia/Tokyo"` to `Intl.DateTimeFormat` to decide where a day ends

Moreover, fixing the production code was crucial. It's not only about the test — it's about being ready for the day a server runs in UTC.

## Results

In the two weeks since the fix, the test has **not failed once**.

## Conclusion

Time-dependent tests are not just bugs; they are a reflection of the environment itself. By tackling flaky tests one by one, teams can unlock significant gains in productivity.

I hope this helps! Let me know if you have any questions.
```

chaff on the article before:

```text
$ npx chaffjs ai.md --genre blog/tech --compact

ai.md   blog/tech · English   genre from --genre

  7:49    info    18 -ly adverbs per 1000 words (limit 15)
                  adverb-overuse
  11:1    info    "To be honest," and other announcing openers start 3 sentences (3 needed)
                  announcing-opener
  11:1    warning "closing-cliche, contrast-framing, announcing-opener" occur together in this document (3 signals, 3 needed)
                  ai-generated-composite
  17:1    info    "The key point is" and other announcing openers start 3 sentences (3 needed)
                  announcing-opener
  27:1    info    "What's important is" and other announcing openers start 3 sentences (3 needed)
                  announcing-opener
  37:51   info    "not only" and other contrast frames: 7.2 per 1000 words (limit 3)
                  contrast-framing
  45:1    info    "are not" is written differently from the rest of the document
                  contraction-consistency
  45:1    info    "not just" and other contrast frames: 7.2 per 1000 words (limit 3)
                  contrast-framing
  47:1    warning Closes with "hope this helps"
                  closing-cliche

{counts}
```

The article after (`rewritten.md`):

```markdown file=rewritten.md
# Our flaky test was a time zone problem

One test in our inventory API failed on CI roughly once every 30 runs and never locally. This post describes how we found the cause and fixed it.

## What was happening

We ignored the failure for three weeks, because a rerun always passed. Each rerun took 12 minutes, though, and those waits added up.

## Finding the cause

When we lined up the logs of the failed runs, every failure had run between midnight and 9 a.m. Tokyo time. Our CI runners use UTC. The test took today's date from `new Date()` and expected the due date to be seven days later. On a Monday morning in Tokyo, the runner still thought it was Sunday.

The date shift threw no exception, so it never surfaced as an error.

## The fix

The test now pins the clock with `jest.useFakeTimers` and `setSystemTime`, and the workflow sets `TZ=Asia/Tokyo`. We also changed the production code to decide where a day ends by passing `timeZone: "Asia/Tokyo"` to `Intl.DateTimeFormat`. Fixing only the test would have left the same shift in place for any server that runs in UTC.

## Results

The test has not failed once in the two weeks since. A test that touches the clock depends on when and where it runs. When one fails now and then, start by lining up the times it failed.
```

chaff on the article after:

```text
$ npx chaffjs rewritten.md --genre blog/tech --compact

rewritten.md   blog/tech · English   genre from --genre


{counts}
```

What changed, and why:

| Change | Why |
| --- | --- |
| Dropped "— The Hidden Trap of Time Zones" and named the cause in the title | A title should say what was found, not tease it |
| Replaced "In this article, we'll delve into…" with one sentence on what the post covers | A stock opening with nothing in it |
| Removed all bold | The numbers and facts carry the weight; no word needed emphasis |
| Dropped "This wasn't just a flaky test" | It knocked down an X nobody said |
| Dropped "To be honest", "The key point is" and "What's important is" | Start with the point instead of announcing it |
| Replaced "silently swallowed" and "quietly broke" with "threw no exception" | Say what happened instead of a metaphor |
| Turned both lists back into sentences | The cause is how three facts connect; a list cannot say that |
| Dropped "I hope this helps! Let me know…" | Chat residue |

Every number (once every 30 runs, three weeks, 12 minutes, two weeks), command and setting is kept.
The API and setting names left after the rewrite, which a tech article needs, are well within `proper-noun-density`'s limit.

Last, `chaff compare` checks that no fact was lost:

```text
$ npx chaffjs compare ai.md rewritten.md
ai.md → rewritten.md

✗ 3 facts dropped (in ai.md, not in rewritten.md)
  name: CI  (ai.md:22)
  name: Workflow  (ai.md:34)
  heading: Conclusion  (ai.md:43)

i 4 facts written another way
  heading: Solving Our Flaky Test Problem — The Hidden Trap of Time Zon… → Our flaky test was a time zone problem  (line 1 → line 1)
  heading: What Was Happening → What was happening  (line 5 → line 5)
  heading: Investigating the Root Cause → Finding the cause  (line 15 → line 9)
  heading: The Solution → The fix  (line 29 → line 15)

Facts checked: 26 → 23: numbers 2→2, dates 0→0, times 1→1, URLs 0→0, code 6→6, names 11→9, quotations 0→0, headings 6→5, references 0→0, footnotes 0→0
3 facts dropped, 0 facts added
```

None of the three is a fact the rewrite lost, so none was restored.

| Dropped | Why it stays out |
| --- | --- |
| name "CI" | The opening sentence that said "on CI" a third time was cut; the other two mentions remain |
| name "Workflow" | A bold list label read as a name; the sentence now says "the workflow sets" |
| heading "Conclusion" | The section went with its stock closing |

This rewrite barely moved the outline: `npx chaffjs outline ai.md rewritten.md` shows six headings becoming five.
When the structure itself should change, use the full rewrite, as in the next example.

The quick AI-likeness score (`ai-score`) compares the article before and after.

```text
$ npx chaffjs ai-score ai.md rewritten.md --genre blog/tech
ai.md
AI-likeness: high (more signs than human-written documents (Blog))
  5 signs (of 26 compared, ones 90% of human documents do not show); medium from 3, high from 5
  Not a verdict on whether AI wrote it: how many signs common in generated text show, compared with human documents.

Wording and shape
  ✗ Too many sentences that announce before they say: 3  in 0 of 23 human-written documents (Blog)
  ✗ Cliched closing: 1  in 0 of 23 human-written documents (Blog)
  ✗ Too many contrast frames: 2  in 0 of 23 human-written documents (Blog)
  ✗ Several signals of generated text together: 3 of its signals (Cliched closing, Too many contrast frames, Too many sentences that announce before they say); from 2, its strict level, that is one more sign
  · the other 15 did not show

Structure (against human articles)
  ✗ list items opening with a bold label: 3  higher than 95% of human articles
  · the other 9 are usual for human articles

rewritten.md
AI-likeness: low (about as many signs as human-written documents (Blog))
  1 sign (of 25 compared, ones 90% of human documents do not show); medium from 3, high from 5
  Not a verdict on whether AI wrote it: how many signs common in generated text show, compared with human documents.

Wording and shape
  · the other 18 did not show

Structure (against human articles)
  ✗ sections of one or two paragraphs: 100% (mean 1.3 paragraphs)  higher than 90% of human articles
  · the other 8 are usual for human articles
```

Before the rewrite, three wording signs and the bold-label outline make it medium.
After it, one sign is left (the short sections), and it reads low.
Neither says who wrote the text.

## A full rewrite of a blog post

A blog post written in the style of generated text, rewritten from scratch with the full rewrite.
Both versions were written for this page.

The post before (`demo.md`):

```markdown file=demo.md
# Unlocking the Power of Weekly Demos: Key Lessons From Six Months

In this post, we'll dive into how our team started a weekly demo and what we learned along the way.

## Introduction

In today's fast-paced world, sharing work early is more important than ever. That's why we started a weekly demo in March 2026.

## The Format

Here's how it worked:

- **When**: every Friday, 4:00 to 4:30 p.m.
- **Who**: the 14 people on the product team
- **What**: three people each showed their work for 10 minutes

## The Challenges

Attendance dropped to 6 people within two months. It's not just a scheduling problem. It's a relevance problem.

Moreover, most demos showed finished features. Nobody showed work in progress, so there was nothing to give feedback on.

## The Solution

The key insight is simple: make it easier to show something. We cut each slot to 3 minutes and asked people to bring whatever they were stuck on. Additionally, we posted the recording in Slack for anyone who missed it.

## The Results

Attendance climbed back to 12. More importantly, the demos turned into real conversations.

## Conclusion

Weekly demos aren't just about sharing work — they're about building a culture of feedback. By keeping slots short and welcoming unfinished work, any team can make demos that matter. I hope this helps!
```

chaff on the post before. `ai-generated-composite` fires, so the full rewrite is the one to choose.

```text
$ npx chaffjs demo.md --genre blog/tech --compact

demo.md   blog/tech · English   genre from --genre

  1:67    info    Section length varies by only 33% (want at least 35%)
                  section-length-uniformity
  5:1     info    4 structure measures lie past 90% of human articles (3 needed): sections of one or two paragraphs, headings in a stock form, introduction / conclusion headings, list items opening with a bold label
                  ai-structure
  5:1     warning "section-length-uniformity, padded-intro, closing-cliche, ai-structure" occur together in this document (4 signals, 3 needed)
                  ai-generated-composite
  7:1     warning "in today's fast-paced world" is an opening that fits any article
                  padded-intro
  33:184  warning Closes with "hope this helps"
                  closing-cliche

{counts}
```

The inventory: `npx chaffjs facts demo.md` lists 5 numbers, a date, 2 times, 2 names (Friday, Slack) and 7 headings.
The writer's claims and experience, one line each:

- attendance dropped within two months;
- the demos showed finished features, so there was nothing to give feedback on;
- shorter slots, showing what you are stuck on, and a recording in Slack brought people back;
- the demos turned into real conversations.

The old outline has seven headings, and its "Conclusion" says the body again. Its structure score is 4: four measures lie past 90% of human articles.
They are sections of one or two paragraphs, headings in a stock form, the introduction and conclusion headings and bold labels.
The plan's structure targets name the same four.
The new outline, shown before writing:

| Old outline | New outline, and what each part says |
| --- | --- |
| Introduction, The Format | No heading under the title "Our weekly demo came back when we shortened the slots": when it started, how it ran, and the drop |
| The Challenges | "Why people stopped coming": finished features left nothing to discuss |
| The Solution, The Results | "Bring what you are stuck on": the change, and what it did to attendance |
| Conclusion | Cut: it restated the body |

The post after (`demo-full.md`):

```markdown file=demo-full.md
# Our weekly demo came back when we shortened the slots

We started a weekly demo in March 2026, every Friday from 4:00 to 4:30 p.m., for the 14 people on the product team. Three people showed their work for 10 minutes each. Within two months, 6 people were coming.

## Why people stopped coming

Most demos showed finished features. Nobody brought work in progress, so there was nothing left to give feedback on.

## Bring what you are stuck on

We cut each slot to 3 minutes and asked people to bring whatever they were stuck on. A short slot made it easier to show something half done, and half-done work is what gets useful comments. We also posted the recording in Slack for anyone who missed it.

Attendance climbed back to 12, and the demos turned into real conversations.
```

chaff on the post after:

```text
$ npx chaffjs demo-full.md --genre blog/tech --compact

demo-full.md   blog/tech · English   genre from --genre


{counts}
```

`outline` measures how the structure changed: fewer headings, longer sections, no list and no bold.

```text
$ npx chaffjs outline demo.md demo-full.md
demo.md outline: headings 7, average section 28 words, in lists 14%, bold 3

  # Unlocking the Power of Weekly Demos: Key Lessons From Six Months  (demo.md:1)  20 words
    ## Introduction  (demo.md:5)  22 words
    ## The Format  (demo.md:9)  32 words
    ## The Challenges  (demo.md:17)  37 words
    ## The Solution  (demo.md:23)  40 words
    ## The Results  (demo.md:27)  13 words
    ## Conclusion  (demo.md:31)  34 words

Structure score: 4 (measures past 90% of human articles, of 9 compared against 641 human articles)
  ✗ sections of one or two paragraphs: 100% (mean 1.2 paragraphs)  higher than 90% of human articles (human median 50, 90th percentile 95)
  · section length variation: 33%  more uniform than 85% of human articles
  ✗ headings in a stock form: 25% (most: "challenges")  higher than 90% of human articles (human median 0, 90th percentile 17)
  ✗ introduction / conclusion headings: 2 (opening and closing)  higher than 95% of human articles (human median 0, 90th percentile 1)
  ✗ list items opening with a bold label: 3  higher than 95% of human articles (human median 0, 90th percentile 0)
  · usual in human articles: headings split into three 0, closing that restates the body 3% ("Conclusion"), headings with an emoji 0, pros / cons pairs 0
  not measured: headings (the document is short), three-item lists (fewer than three lists)

demo-full.md outline: headings 3, average section 39 words, in lists 0%, bold 0

  # Our weekly demo came back when we shortened the slots  (demo-full.md:1)  39 words
    ## Why people stopped coming  (demo-full.md:5)  19 words
    ## Bring what you are stuck on  (demo-full.md:9)  60 words

Structure score: 0 (measures past 90% of human articles, of 5 compared against 641 human articles)
  · usual in human articles: headings split into three 0, introduction / conclusion headings 0, list items opening with a bold label 0, headings with an emoji 0, pros / cons pairs 0
  not measured: headings (the document is short), sections of one or two paragraphs (few sections with text), section length variation (few sections with text), headings in a stock form (few headings), closing that restates the body (no closing section), three-item lists (fewer than three lists)

How the shape changed (demo.md → demo-full.md)
  headings: 7 → 3
  average section: 28 words → 39 words
  in lists: 14% → 0%
  bold: 3 → 0
  structure score: 4 → 0
  sections of one or two paragraphs: 100% (mean 1.2 paragraphs) → —
  section length variation: 33% → —
  headings in a stock form: 25% (most: "challenges") → —
  headings split into three: 0 → 0
  introduction / conclusion headings: 2 (opening and closing) → 0
  closing that restates the body: 3% ("Conclusion") → —
  list items opening with a bold label: 3 → 0
  headings with an emoji: 0 → 0
  pros / cons pairs: 0 → 0
```

`compare` checks the facts, with the headings set aside as the structure thrown away on purpose:

```text
$ npx chaffjs compare demo.md demo-full.md --allow-dropped heading --allow-added heading
demo.md → demo-full.md

✗ 4 facts dropped (in demo.md, not in demo-full.md)
  heading: The Challenges  (demo.md:17) (allowed by --allow-dropped)
  heading: The Solution  (demo.md:23) (allowed by --allow-dropped)
  heading: The Results  (demo.md:27) (allowed by --allow-dropped)
  heading: Conclusion  (demo.md:31) (allowed by --allow-dropped)

i 3 facts written another way
  heading: Unlocking the Power of Weekly Demos: Key Lessons From Six Mo… → Our weekly demo came back when we shortened the slots  (line 1 → line 1)
  heading: Introduction → Why people stopped coming  (line 5 → line 5)
  heading: The Format → Bring what you are stuck on  (line 9 → line 9)

Facts checked: 17 → 13: numbers 5→5, dates 1→1, times 2→2, URLs 0→0, code 0→0, names 2→2, quotations 0→0, headings 7→3, references 0→0, footnotes 0→0
No fact dropped or added
```

Every number, the date, both times and both names are still there.

What changed, and why:

| Change | Why |
| --- | --- |
| Seven headings became three | A section is now a unit with something in it, not one heading per paragraph |
| Cut "Introduction" and "Conclusion" | One was a stock opener ("In today's fast-paced world"), the other restated the body |
| The format list became two sentences | The items describe one meeting; a list cannot say how they fit together |
| Dropped "It's not just a scheduling problem. It's a relevance problem." | It knocked down an X nobody said; the next section says what the problem was |
| Dropped "The key insight is simple", "Moreover", "Additionally" and "More importantly" | Announcements and stock transitions; the sentences start with the point instead |
| Dropped "building a culture of feedback" and "any team can make demos that matter" | Nothing in the post supports them; keeping them would add claims |
| Dropped "I hope this helps!" | Chat residue |

The signals and the shape, before and after, from chaff's output:

| Measure | Before | After |
| --- | --- | --- |
| Findings | 5 | 0 |
| `ai-generated-composite` | 4 signals | does not fire |
| Structure score (`chaff outline`) | 4 (short sections, stock heading forms, introduction and conclusion, bold labels) | 0 |
| Headings | 7 | 3 |
| Average section | 28 words | 39 words |
| In lists | 14% | 0% |
| Bold | 3 | 0 |
| `compare` (headings set aside) | — | no fact dropped or added |

## What to read next

- The three ways to rewrite, and the steps of each, are in [Making AI-sounding text sound human](./ai-sounding).
- Every option of `fix-plan`, `facts`, `outline` and `compare` is in [Commands](./commands#planning-a-rewrite).
