# Making AI-sounding text sound human

Generated text has shapes that recur. It uses a lot of bold and "It's not X. It's Y" contrasts.
Its sentences open with "The key point is", and its sections hand off to a list after a colon.
chaff finds these shapes by machine, and it never rewrites the text.
This page shows how to use what it finds to bring a document back to a human voice.

## What chaff looks for

Most of these rules are experimental and run with `--experimental`; `bold-density` and `closing-cliche` run without it.

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

## Two ways to fix it

| Way | What it changes | When to use it |
| --- | --- | --- |
| Light | Only the spots chaff flagged | The content and structure are fine and only the wording grates |
| Bold | The shape of the whole document, section by section | After a light pass, the text still reads as generated |

A light pass removes findings one at a time. It fixes typos and long sentences, but the shape of the document stays.
An article built from bold headings and bullet lists still reads as generated after its wording is fixed.
That is when to choose the bold rewrite.

## The light pass

1. Run `npx chaffjs article.md --experimental` and collect the findings of the AI-shape rules.
2. Rewrite only the flagged spots. Keep the meaning, the numbers, the conditions and the technical constraints.
3. Run chaff again. Stop after two rewrites.
4. Keep the rewritten text and a short list of what changed and why.

Do not repeat a pass just to silence a warning. If a word you chose trips another rule but is the right technical term in context, keep it.

## The bold rewrite

A bold rewrite changes the shape of the whole document rather than each finding. Go section by section.

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

## Rules for both

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

## Further reading

| Source | What it has to do with this page |
| --- | --- |
| Kobak et al., "[Delving into LLM-assisted writing in biomedical publications through excess vocabulary](https://arxiv.org/abs/2406.07016)" (Science Advances, 2025) | Comparing word use before and after generated text spread, and picking the words that grew. The Japanese `ai-tell` entries were chosen the same way. |
| Hayashi and Aizawa, "[LLM による日本語生成におけるモデル固有表現パターンの分析](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/B9-17.pdf)" (NLP 2026) | Japanese generated text also carries model-specific phrasing and structure (conclusion first, numbered structure, announcing the steps). |
