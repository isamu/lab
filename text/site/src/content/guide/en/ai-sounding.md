# Making AI-sounding text sound human

Generated text has shapes that recur. It uses a lot of bold and "It's not X. It's Y" contrasts.
Its sentences open with "The key point is", and its sections hand off to a list after a colon.
chaff finds these shapes by machine, and it never rewrites the text.
This page shows how to use what it finds to bring a document back to a human voice.

## Start with a fix plan

Before rewriting, have `chaff fix-plan` print a plan.

```bash
npx chaffjs fix-plan article.md --experimental           # the plan, as Markdown
npx chaffjs fix-plan article.md --experimental --json    # the same plan as JSON, to hand to an AI
```

The plan turns what chaff found into instructions, rule by rule: how to rewrite each kind of spot.
Whoever reads it does the rewriting, a person or an AI. chaff does not rewrite, and sends nothing anywhere.

The plan has these parts.

| Part | What it says |
| --- | --- |
| Constraints | Keep facts, numbers, conditions and names. Add no fact. Ask the writer instead of inventing a specific. At most two passes |
| Recommended way | Light, Bold or Full, and why, decided the same way as in "Three ways to fix it" below |
| Document-level signals | What `ai-generated-composite` and the density rules said, and the outline's numbers from `chaff outline` |
| Structure targets | The structure score (how many structure measures lie past 90% of human articles) and a target for each measure past that line. The targets come from articles written before generated text was common ("at most this many headings for this length") |
| How to rewrite, rule by rule | The direction, what to keep, what to avoid, a before-and-after example, and each spot found (line and sentence) |
| Check after rewriting | The `chaff`, `chaff compare` and `chaff outline` commands to run on the rewrite |

The directions and examples come from the rule files (`rewrite:`), so the same finding always gets the same direction.
The steps are the same whether a person rewrites or an AI does.

1. Run `npx chaffjs fix-plan article.md --experimental`.
2. Rewrite following the plan, and save the result under the name its last part gives. To have an AI do it, hand it the plan as it is.
3. Run the checks. They show whether findings remain, whether a fact was dropped or added, and how the outline moved.

The example "Example: from a fix plan to a clean check" further down this page goes from the plan to the checks.

## What chaff looks for

Most of these rules are experimental and run with `--experimental`; `bold-density`, `closing-cliche` and `padded-intro` run without it.

```bash
npx chaffjs article.md --experimental    # also run the experimental rules
```

| Rule | What it finds |
| --- | --- |
| `ai-tell` | Phrases common in generated text piling up ("plays a crucial role", "delve into") |
| `contrast-framing` | Contrast frames piling up ("not just X, but Y", "It's not X. It's Y") |
| `stock-transition` | Too many sentences opening with "Moreover" or "Additionally" |
| `announcing-opener` | Several sentences opening with an announcement ("The key point is", "Here's the thing", "Honestly,") |
| `colon-lead-in` | Too many sentences ending in a colon that hand off to a list (Japanese documents only) |
| `emoji-heading` | Headings with an emoji in them, one after another ("## 🚀 Getting started") |
| `bold-label-list` | Many list items that open with a bold label and a colon ("- **Speed**: ...") (Japanese documents only) |
| `assistant-residue` | What is left of a chat reply ("I hope this helps", "As of my last knowledge update") |
| `chat-citation-residue` | Marks a pasted chat answer leaves: links ending in "?utm_source=chatgpt.com", "oaicite" |
| `closing-cliche` | A stock closing ("In conclusion", "I hope this helps") |
| `bold-density` | Too much bold |
| `no-em-dash` | Too many em dashes |
| `sentence-rhythm` | Sentences that are all about the same length |
| `rule-of-three` | Lists that almost all have three items |
| `ai-structure` | An outline past 90% of human articles on several structure measures at once (heading density, headings split into three, bold labels, uniform sections, a closing that restates). Blog and essay genres only |
| `ai-generated-composite` | Three or more of these in one document: `ai-tell`, `contrast-framing`, `stock-transition`, `announcing-opener`, `colon-lead-in`, `assistant-residue`, `closing-cliche`, `padded-intro`, `no-em-dash`, `sentence-rhythm`, `rule-of-three`, `section-length-uniformity`, `ai-structure` (`bold-density` is not counted) |

None of these rules says the text was generated. People write every one of these shapes.
Piled up, they mark a place to reread.

The Japanese word list of `ai-tell` includes the metaphors of technical writing (静かに壊れる "fails silently",
黙って無視される "is ignored without a word", 時間を溶かす "melts your time").
Which phrases go in was measured on technical articles written before generative AI and on the corpus.
Phrases people already wrote as often before (解像度を上げる, 腹落ち) are left out.

## Three ways to fix it

| Way | What it changes | When to use it |
| --- | --- | --- |
| Light | Only the spots chaff flagged | The content and structure are fine and only the wording grates |
| Bold | The prose of each section; the outline stays | The outline is fixed: a report template, a manual, required sections |
| Full | The whole document, from its structure up | The request says "from scratch" or "rewrite the whole thing"; a blog post or an essay; `ai-generated-composite` fires; the plan's structure score reaches its limit |

A light pass removes findings one at a time. It fixes typos and long sentences, but the shape of the document stays.
A bold rewrite changes the sentences of each section, and the outline stays as it was.
A heading every few paragraphs, bold lead-ins and a closing summary that repeats the body still read as generated after the sentences are fixed.

For a blog post or an essay, choose the full rewrite. Do the same whenever `ai-generated-composite` fires.
What the writer wants changed there is usually the structure, not the sentences.

## The light pass

1. Run `npx chaffjs fix-plan article.md --experimental` for the plan.
2. Rewrite only the flagged spots, following each rule's direction in the plan. Keep the meaning, the numbers, the conditions and the technical constraints.
3. Run chaff again. Stop after two rewrites.
4. Keep the rewritten text and a short list of what changed and why.

Do not repeat a pass just to silence a warning. If a word you chose trips another rule but is the right technical term in context, keep it.

## The bold rewrite

A bold rewrite keeps the outline and changes the prose of each section, rather than one finding at a time. Go section by section.

1. Before rewriting, run chaff with `--experimental` and note the document-level signals:
   the inputs of `ai-generated-composite`, `bold-density`, `contrast-framing`, `stock-transition` and `sentence-rhythm`.
2. Rewrite each section, reducing these shapes:

| Reduce | How |
| --- | --- |
| Bold | Keep it only for a word the reader must not skip |
| One-sentence paragraphs and punchlines | Fold them back into the paragraph around them, with the reason |
| "It's not X. It's Y" | Drop the X nobody said and write Y |
| Sections that are all lists | Where the items connect, turn them back into sentences that say how |
| Em dashes | Use a comma or parentheses, or split the sentence |
| Announcements ("The key point is") | Delete the announcement and start with the point |

3. Give each paragraph one claim and link it to the one before with a connective.
   Where the original has the writer's own experience or concrete numbers, put them at the centre of the paragraph.
4. Run chaff with `--experimental` again and compare with the signals from step 1.
   Show the change with chaff's output, not with adjectives.
5. Run `npx chaffjs compare <before> <after>` and check every fact dropped or added.
   It matches numbers, dates, times, URLs, code, names, quotations, headings, references and footnotes before and after.
   Restore every dropped fact. For what is not a fact (a number inside a metaphor, the heading of a section you cut), note why it stays out.
   A kind you cut on purpose can be excluded with `--allow-dropped <kind>`.

## The full rewrite

Leave the old sentences alone. Take an inventory of what the document says, and write from that.

1. Take the inventory before writing. `npx chaffjs facts <file> --json` lists every fact `compare` will check.
   `npx chaffjs outline <file>` shows the old outline, its shape and its structure score; a measure past 90% of human articles is marked ✗.
   Write down the writer's claims and every concrete experience, example and opinion, one line each. Write from this inventory, not from the old text.
2. Throw away the structure. Decide who reads the piece and what for, and choose one angle or story for the whole of it.
   Then make these changes to the outline before writing a sentence.

| Change | What to do |
| --- | --- |
| Reorder | Put the conclusion, or the most interesting episode, first |
| Merge and split | Merge thin sections and split overloaded ones; a section is a real unit, not one heading per paragraph |
| Cut restatements | Cut sections that only restate the body, the closing summary included |
| Drop lone headings | A heading over a single paragraph goes; the paragraph joins its neighbours |
| Turn points into a story | A section that lists points becomes prose with one through-line |
| Break the symmetry | No three sections or three items unless the content really has three parts |
| Move the experience | Put the writer's concrete experience where it carries the argument |
| Open on the point | Start with the point or a concrete scene, not a generic opener |

   Size the new outline by the plan's structure targets: no more headings than the target allows, no heading split into three unless the content has three parts, no bold-label lists and no closing that restates the body.

3. Show the new outline first. Put the old outline (the headings from `chaff outline`) next to the new one, with one line per section on what it says.
   The writer can then see the structural change at a glance and decide. If the person asked for it to be done without asking, go straight on.
4. Write it fresh, in the writer's voice, from the inventory.

| Aspect | How |
| --- | --- |
| Paragraphs | Each argues something and joins the last with a connective; sentence lengths vary |
| Verbs | Plain verbs for what happens, not metaphors ("silently fails") |
| Experience and numbers | Keep the writer's own episodes and numbers; cut filler that fits any article |
| Bold and lists | Bold only where a reader must not miss something; lists only for real enumerations, steps or commands |
| Shapes to avoid | Hedges stacked on a claim, announcing what comes next, "it's not X, it's Y", em dashes |
| Register | Match the writer's other paragraphs and the platform (a blog, a company report, an email) |
| What not to add | No fact, person, number, cause or consequence the inventory does not have |

   Three principles hold while you write.

| Principle | Before | After |
| --- | --- | --- |
| Undo personification | A culture of code review was fostered across the team. | People on the team started reviewing each other's code. |
| Turn noun chains back into verbs | Occurrence of message processing delays due to queue backlog. | Messages piled up in the queue, so processing slowed down. |
| Never invent specifics | The team's mood improved. | The sentence stays, and the writer is asked: "When did you notice the mood improve?" |

   - Undo personification. Watch for a thing or an idea as the subject of a verb of will: "order breaks down", "a culture is fostered", "the architecture demands". Write it as what a person or the system does. If the original does not say who, ask the writer.
   - Turn noun endings and noun chains back into sentences with a verb. A string of nouns hides who did what, and when.
   - Never invent specifics. A vague sentence may read better with a concrete example. If the writer did not give one, ask for it, or mark your guess for the writer to confirm. Never write it as fact.
     `chaff compare` catches an added number or name. It does not catch added wording: "people started joking at the morning stand-up" adds no number and no name, and `compare` says nothing. Keeping this rule is up to the rewriter.

5. Check the result.

```bash
npx chaffjs old.md --experimental                          # the AI signals before
npx chaffjs new.md --experimental                          # and after
npx chaffjs outline old.md new.md                          # headings, average section, lists, bold and the structure score, before and after
npx chaffjs compare old.md new.md --distinct --allow-dropped heading --allow-added heading  # no fact other than a heading dropped or added
```

   The headings are the structure you rebuilt on purpose, so `--allow-dropped heading --allow-added heading` excludes them. Restore any other dropped fact and remove any added one.
   A summary you cut restated facts the body still holds. `--distinct` counts a fact as kept when the new text states it at least once, so those repeats do not read as dropped.

6. Stop when all of these hold. Two full passes at most.
   - `ai-generated-composite` does not fire.
   - The density rules (`bold-density`, `contrast-framing`, `stock-transition`, `colon-lead-in`) are under their limits.
   - `compare` passes, or every exclusion has a reason.
   - `chaff outline old.md new.md` shows the new structure score under the plan's limit, with no ✗ left on the measures the plan listed as targets.
7. Show the new text, a short list of what changed and why, and a table of the signals and the shape before and after. Take the numbers from chaff's output.

## What chaff cannot see

chaff cannot find these shapes by machine. Check them by reading, whichever way you rewrite.

| Shape | What to look for |
| --- | --- |
| Stock openers and closers | Starting with "In this post, we'll explore" or ending with "I hope this helps" |
| Explaining the obvious | Telling readers what every one of them already knows |
| Identical sections | Every section built the same way (`chaff outline` measures the lengths and the heading forms) |
| Benefits without a cost | Only the upside, with nothing given up for it |
| No first-hand detail | Nothing the writer saw, measured or did |
| Uniform enthusiasm | The same excitement everywhere, so nothing stands out |
| Over-politeness | Courtesy and preamble piled on courtesy |
| Unasked definitions | A term defined that no reader asked about |
| Sentence headings | Headings written as full sentences or slogans |
| A repeating summary | A last section that only says the body again in other words (`chaff outline` measures the repeated wording) |

## Rules for every way

- Do not add facts, people, numbers or causes that are not in the original.
- Do not change the meaning, the numbers, the conditions or the technical constraints.
- Prefer a direct statement over a negated contrast.
- Say who does what.
- Stop after two rewrites. Do not loop just to silence a warning.

## Per genre

| Genre | What to watch |
| --- | --- |
| Tech blog (`blog/tech`) | Replace metaphors ("silently breaks", "the error is swallowed") with what happens ("returns without raising an exception"). Keep steps and commands as lists. |
| Business (`business/report`) | Put the conclusion first, then who does what by when. Drop decoration such as "not just a tool, but a turning point". Keep tables and figures as they are. |
| Essay (`blog/essay`) | Fold one-line paragraphs and punchlines back into the text. Replace big words ("profound truth", "new possibilities") with what happened in that scene. |

## Example: from a fix plan to a clean check

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

The plan `chaff fix-plan` printed:

````markdown
$ npx chaffjs fix-plan draft.md --experimental
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

- Light: only the flagged spots.
- Bold: keep the outline, rewrite the prose of each section.
- Full: take an inventory of the facts and claims, then rewrite from the structure up. If the request says "from scratch", choose this.

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

### `padded-intro` Padded opening

**Direction**: Delete the opening that fits any document ("In recent years, X has gained attention") and start from the situation or the claim only this piece has. If the body has none, ask the writer.

**Keep**

- the situation and claim only this piece has

**Avoid**

- swapping the opening for another generality ("X is now essential")
- inventing a scene or an anecdote that is not in the body

**Example**

before:

> In recent years, generative AI has gained attention. This article shows how we use it internally.

after:

> This article shows how we use generative AI internally.

**Spots**

- line 3: "In today's fast-paced world, build speed plays a crucial role in how a team ships."
  "in today's fast-paced world" is an opening that fits any article

### `contraction-consistency` Contraction use is inconsistent

**Direction**: Match the majority.

**Spots**

- line 5: "It's a change in how the whole team works."
  "it's" is written differently from the rest of the document

### `closing-cliche` Cliched closing

**Direction**: Delete the stock closing. If the piece already ends on its conclusion, stop there; if not, state in one sentence the one thing from the body the reader should take away.

**Keep**

- the conclusion the body reached

**Avoid**

- adding a conclusion or a call to action that is not in the body
- swapping "Hope this helps" for "Give it a try"

**Example**

before:

> The setting lives in one place on the admin page. Hope this helps!

after:

> The setting lives in one place on the admin page.

**Spots**

- line 11: "In conclusion, the shared cache is a testament to what careful engineering can achieve."
  Closes with "in conclusion"
- line 11: "I hope this helps!"
  Closes with "hope this helps"

## Rules that did not run

- `abstract-length`: the blog/tech genre does not check it
- `agentless-passive`: the blog/tech genre does not check it
- `ai-structure`: the document has no headings below its title
- `attachment-not-attached`: the blog/tech genre does not check it
- `citation-reference-mismatch`: the blog/tech genre does not check it
- `citation-style-mix`: the blog/tech genre does not check it
- `cushion-phrase-density`: the blog/tech genre does not check it
- `defined-name-repeated`: the blog/tech genre does not check it
- `defined-term-form`: the blog/tech genre does not check it
- `email-greeting-closing`: the blog/tech genre does not check it
- `email-subject-length`: the blog/tech genre does not check it
- `figure-reference-order`: the blog/tech genre does not check it
- `request-without-deadline`: the blog/tech genre does not check it

## Check after rewriting

Save the rewrite as draft.rewritten.md and run:

```bash
npx chaffjs draft.rewritten.md --experimental
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
$ npx chaffjs draft.rewritten.md --experimental --compact
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

## Example: a bold rewrite of a tech article

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
$ npx chaffjs ai.md --genre blog/tech --experimental --compact

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
$ npx chaffjs rewritten.md --genre blog/tech --experimental --compact

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

## Example: a full rewrite of a blog post

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
$ npx chaffjs demo.md --genre blog/tech --experimental --compact

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

The old outline has seven headings, and its "Conclusion" says the body again. Its structure score is 4: sections of one or two paragraphs, headings in a stock form, the introduction and conclusion headings, and bold labels lie past 90% of human articles, and the plan's structure targets name the same four.
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
$ npx chaffjs demo-full.md --genre blog/tech --experimental --compact

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
| Findings (`--experimental`) | 5 | 0 |
| `ai-generated-composite` | 4 signals | does not fire |
| Structure score (`chaff outline`) | 4 (short sections, stock heading forms, introduction and conclusion, bold labels) | 0 |
| Headings | 7 | 3 |
| Average section | 28 words | 39 words |
| In lists | 14% | 0% |
| Bold | 3 | 0 |
| `compare` (headings set aside) | | no fact dropped or added |

## Further reading

| Source | What it has to do with this page |
| --- | --- |
| Kobak et al., "[Delving into LLM-assisted writing in biomedical publications through excess vocabulary](https://arxiv.org/abs/2406.07016)" (Science Advances, 2025) | Comparing word use before and after generated text spread, and picking the words that grew. The Japanese `ai-tell` entries were chosen the same way. |
| Hayashi and Aizawa, "[LLM による日本語生成におけるモデル固有表現パターンの分析](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/B9-17.pdf)" (NLP 2026) | Japanese generated text also carries model-specific phrasing and structure (conclusion first, numbered structure, announcing the steps). |

## What to read next

- Every option of `fix-plan`, `facts`, `outline` and `compare` is in [Commands](./commands#planning-a-rewrite).
- Checking a model's output in an eval with the same rules is in [Using chaff for AI evals](./ai-evals).
- Each AI-shape rule, with an example and its real output, is in the [Reference](./reference).
