# Making AI-sounding text sound human

Generated text has shapes that recur. It uses a lot of bold and "It's not X. It's Y" contrasts.
Its sentences open with "The key point is", and its sections hand off to a list after a colon.
chaff finds these shapes by machine, and it never rewrites the text.
This page shows how to use what it finds to bring a document back to a human voice.

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
| `assistant-residue` | What is left of a chat reply ("I hope this helps", "As of my last knowledge update") |
| `closing-cliche` | A stock closing ("In conclusion", "I hope this helps") |
| `bold-density` | Too much bold |
| `no-em-dash` | Too many em dashes |
| `sentence-rhythm` | Sentences that are all about the same length |
| `rule-of-three` | Lists that almost all have three items |
| `ai-generated-composite` | Three or more of these in one document: `ai-tell`, `contrast-framing`, `stock-transition`, `announcing-opener`, `colon-lead-in`, `assistant-residue`, `closing-cliche`, `padded-intro`, `no-em-dash`, `sentence-rhythm`, `rule-of-three`, `section-length-uniformity` (`bold-density` is not counted) |

None of these rules says the text was generated. People write every one of these shapes.
Piled up, they mark a place to reread.

## Three ways to fix it

| Way | What it changes | When to use it |
| --- | --- | --- |
| Light | Only the spots chaff flagged | The content and structure are fine and only the wording grates |
| Bold | The prose of each section; the outline stays | The outline is fixed: a report template, a manual, required sections |
| Full | The whole document, from its structure up | The request says "from scratch" or "rewrite the whole thing"; a blog post or an essay; `ai-generated-composite` fires |

A light pass removes findings one at a time. It fixes typos and long sentences, but the shape of the document stays.
A bold rewrite changes the sentences of each section, and the outline stays as it was.
A heading every few paragraphs, bold lead-ins and a closing summary that repeats the body still read as generated after the sentences are fixed.

For a blog post or an essay, choose the full rewrite. Do the same whenever `ai-generated-composite` fires.
What the writer wants changed there is usually the structure, not the sentences.

## The light pass

1. Run `npx chaffjs article.md --experimental` and collect the findings of the AI-shape rules.
2. Rewrite only the flagged spots. Keep the meaning, the numbers, the conditions and the technical constraints.
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
   `npx chaffjs outline <file>` shows the old outline and its shape.
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

5. Check the result.

```bash
npx chaffjs old.md --experimental                          # the AI signals before
npx chaffjs new.md --experimental                          # and after
npx chaffjs outline old.md new.md                          # headings, average section, lists and bold, before and after
npx chaffjs compare old.md new.md --allow-dropped heading  # no fact other than a heading dropped or added
```

   The headings are the structure you threw away on purpose, so `--allow-dropped heading` excludes them. Restore any other dropped fact and remove any added one.
   A fact the old text only repeated (a number in the summary you cut) may stay out, with the reason written down.
6. Stop when all of these hold. Two full passes at most.
   - `ai-generated-composite` does not fire.
   - The density rules (`bold-density`, `contrast-framing`, `stock-transition`, `colon-lead-in`) are under their limits.
   - `compare` passes, or every exclusion has a reason.
7. Show the new text, a short list of what changed and why, and a table of the signals and the shape before and after. Take the numbers from chaff's output.

## What chaff cannot see

chaff cannot find these shapes by machine. Check them by reading, whichever way you rewrite.

| Shape | What to look for |
| --- | --- |
| Stock openers and closers | Starting with "In this post, we'll explore" or ending with "I hope this helps" |
| Explaining the obvious | Telling readers what every one of them already knows |
| Identical sections | Every section the same length and built the same way |
| Benefits without a cost | Only the upside, with nothing given up for it |
| No first-hand detail | Nothing the writer saw, measured or did |
| Uniform enthusiasm | The same excitement everywhere, so nothing stands out |
| Over-politeness | Courtesy and preamble piled on courtesy |
| Unasked definitions | A term defined that no reader asked about |
| Sentence headings | Headings written as full sentences or slogans |
| A repeating summary | A last section that only says the body again |

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

## Example: a bold rewrite of a tech article

A tech article written in the style of generated text, rewritten with the bold rewrite.
Both versions were written for this page.

The article before:

```markdown
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

9 findings, 13 rules not run
```

The article after:

```markdown
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

  3:27    info    44 proper nouns per 1000 words (limit 40)
                  proper-noun-density

1 finding, 13 rules not run
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
The `proper-noun-density` left after the rewrite counts the API and setting names, which a tech article needs.

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

The post before:

```markdown
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
  7:1     warning "in today's fast-paced world" is an opening that fits any article
                  padded-intro
  33:184  warning Closes with "hope this helps"
                  closing-cliche
  33:184  warning "section-length-uniformity, padded-intro, closing-cliche" occur together in this document (3 signals, 3 needed)
                  ai-generated-composite

4 findings, 16 rules not run
```

The inventory: `npx chaffjs facts demo.md` lists 5 numbers, a date, 2 times, 2 names (Friday, Slack) and 7 headings.
The writer's claims and experience, one line each:

- attendance dropped within two months;
- the demos showed finished features, so there was nothing to give feedback on;
- shorter slots, showing what you are stuck on, and a recording in Slack brought people back;
- the demos turned into real conversations.

The old outline has seven headings, and its "Conclusion" says the body again.
The new outline, shown before writing:

| Old outline | New outline, and what each part says |
| --- | --- |
| Introduction, The Format | No heading under the title "Our weekly demo came back when we shortened the slots": when it started, how it ran, and the drop |
| The Challenges | "Why people stopped coming": finished features left nothing to discuss |
| The Solution, The Results | "Bring what you are stuck on": the change, and what it did to attendance |
| Conclusion | Cut: it restated the body |

The post after:

```markdown
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


0 findings, 16 rules not run
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

demo-full.md outline: headings 3, average section 39 words, in lists 0%, bold 0

  # Our weekly demo came back when we shortened the slots  (demo-full.md:1)  39 words
    ## Why people stopped coming  (demo-full.md:5)  19 words
    ## Bring what you are stuck on  (demo-full.md:9)  60 words

How the shape changed (demo.md → demo-full.md)
  headings: 7 → 3
  average section: 28 words → 39 words
  in lists: 14% → 0%
  bold: 3 → 0
```

`compare` checks the facts, with the headings set aside as the structure thrown away on purpose:

```text
$ npx chaffjs compare demo.md demo-full.md --allow-dropped heading
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
| Findings (`--experimental`) | 4 | 0 |
| `ai-generated-composite` | 3 signals | does not fire |
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
