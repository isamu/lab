# Tech articles and blog posts

A tech article tells other developers what you tried, or what you fixed.
chaff finds by machine the openings that keep the reader waiting, and the shapes that generated text leaves behind.
The genre is `blog/tech`. It is also the genre chaff uses when none is set.

## What usually goes wrong

More and more tech articles start as an AI draft. Published as they are, they keep the draft's shapes.

| What goes wrong | Example |
| --- | --- |
| An opening that fits any article | "In today's fast-paced world, containers have become an essential part of modern development" |
| Sentences that only announce | "The key point is", "What's important is", "Honestly," |
| Knocking down what nobody said | "This isn't just waiting time" |
| A count that does not match | "We made the following two changes" above a list of three |
| A link that goes nowhere | A link to a heading the article does not have |
| A stock closing | "I hope this helps!", "Happy coding!" |

## What chaff checks, and what it does not

These are the main rules for this genre.

| Rule | What it finds | When it runs |
| --- | --- | --- |
| `padded-intro` | An opening that fits any article | Always |
| `closing-cliche` | A stock closing | Always |
| `ai-tell` | Phrases common in generated text ("delve into") piling up | With `--experimental` |
| `announcing-opener` | Sentences opening with "The key point is" and the like, piling up | With `--experimental` |
| `ai-generated-composite` | Three or more signals of generated text in one article | With `--experimental` |
| `contraction-consistency` | "isn't" and "is not" mixed in one article | With `--experimental` |
| `title-case-consistency` | Headings that mix Title Case and sentence case | With `--experimental` |
| `announced-count-mismatch` | A count announced that differs from the list below it | With `--experimental` |
| `broken-link` | A link to a heading the article does not have | With `--experimental` |
| `empty-conclusion` | A conclusion that says nothing new | When an AI reads it, with `npx chaffjs test` |

What it does not do is decided too.

- It does not check that the code works. The writer runs the commands and checks the settings.
- It does not check that the numbers are true. Whether it really was "9 minutes to 2 minutes" is for the writer to check.
- It does not open links to other sites. It only checks links to headings inside the article.
- It never says "an AI wrote this". It marks where the shapes of generated text pile up, as places to reread.

## Try it

If you have not set up yet, do [Getting ready](./documents#getting-ready) first.
The article below was saved as `article.md`. It was written for this page.

```markdown
# How We Made Our Docker Builds Faster — The Overlooked Key of Caching

In today's fast-paced world, containers have become an essential part of modern development. In this article, we will delve into how our team cut our Docker build time.

## What Was the Problem?

Every CI build took **about 9 minutes**.

This isn't just waiting time. It's **a problem that eats away at our development speed**.

Honestly, we ignored this problem for half a year. Before we knew it, the waiting was quietly eating hours of our week.

## The Root Cause

The key point is the order of the Dockerfile.

Here's what we found:

- We wrote `COPY . .` before `RUN yarn install`
- So changing one line of source re-installed every dependency
- CI did not reuse the cache from the previous build

What's important is that the cache was being thrown away silently. The build never failed; it just got slower.

## What we fixed

We made the following two changes:

- Copy only `package.json` and `yarn.lock` first, install, then copy the source
- Pass `--cache-from` to `docker build` so the previous image is used as a cache
- Add `node_modules` to `.dockerignore`

Moreover, we recorded the results in `docs/build-time.md`. For details, see [the build time log](#build-time-log).

## Results

Builds went from 9 minutes to 2 minutes. It's not just faster builds, it's a dramatic boost to our team's productivity.

I hope this helps! Happy coding!
```

First, run it with nothing added. `--compact` prints each finding on two lines.

```
$ npx chaffjs article.md --genre blog/tech --compact

article.md   blog/tech · English   genre from --genre

  3:1     warning "in today's fast-paced world" is an opening that fits any article
                  padded-intro
  39:1    warning Closes with "hope this helps"
                  closing-cliche
  39:20   warning Closes with "happy coding"
                  closing-cliche

3 findings, 66 rules not run
```

That is the opening and the closing. The shapes of generated text are checked by experimental rules.
Add `--experimental` and run it again.

```
$ npx chaffjs article.md --genre blog/tech --experimental --compact

article.md   blog/tech · English   genre from --genre

  1:71    info    Section length varies by only 25% (want at least 35%)
                  section-length-uniformity
  3:1     info    "delve into, in today's fast-paced world, it's not just" appear together (score 25, limit 18)
                  ai-tell
  3:1     warning "in today's fast-paced world" is an opening that fits any article
                  padded-intro
  3:1     warning "ai-tell, section-length-uniformity, padded-intro, closing-cliche, announcing-opener" occur together in this document (5 signals, 3 needed)
                  ai-generated-composite
  9:1     info    "isn't" is written differently from the rest of the document
                  contraction-consistency
  9:31    info    "it's" is written differently from the rest of the document
                  contraction-consistency
  11:1    info    "Honestly," and other announcing openers start 3 sentences (3 needed)
                  announcing-opener
  15:1    info    "The key point is" and other announcing openers start 3 sentences (3 needed)
                  announcing-opener
  23:1    info    "What's important is" and other announcing openers start 3 sentences (3 needed)
                  announcing-opener
  25:17   info    This heading's capitalisation differs from the rest (1 in this document)
                  title-case-consistency
  27:23   warning "two changes" is announced, but the number of items in the list below is 3
                  announced-count-mismatch
  33:77   warning The link "[the build time log](#build-time-log)" points to "#build-time-log", which is not a heading on this page
                  broken-link
  37:42   info    "it's" is written differently from the rest of the document
                  contraction-consistency
  39:1    warning Closes with "hope this helps"
                  closing-cliche
  39:20   warning Closes with "happy coding"
                  closing-cliche

15 findings, 16 rules not run
```

`3:1` at the start of a line means line 3, character 1.
`warning` is worth fixing; `info` marks a place to reread.

## What each finding means

| Line | Finding | What it means | How to fix it |
| --- | --- | --- | --- |
| 3 | `padded-intro` | "In today's fast-paced world" fits any article | Start with the problem: "Every CI build took 9 minutes." |
| 3 | `ai-tell` | "delve into", "in today's fast-paced world" and "it's not just" are common in generated text, and they pile up here | Say what the article does in plain words: "This article shows how we cut our build time." |
| 9, 37 | `contraction-consistency` | Most of the article writes words in full ("did not"), but these lines use "isn't" and "it's" | Pick one and use it throughout |
| 11, 15, 23 | `announcing-opener` | "Honestly,", "The key point is" and "What's important is" announce instead of saying | Delete the announcement and start with the point |
| 25 | `title-case-consistency` | "What we fixed" is in sentence case; the other headings are in Title Case | Make the headings agree |
| 27 | `announced-count-mismatch` | It says "two changes", but the list has three | Fix the number or the list, whichever is wrong |
| 33 | `broken-link` | There is no heading "build time log" in the article | Add the heading, or remove the link |
| 39 | `closing-cliche` | "I hope this helps!" and "Happy coding!" are stock closings | Delete them; end on what the reader can do next |
| 1 | `section-length-uniformity` | Every section is about the same length | Give more room to the sections with more to say; do not pad to match |
| 3 | `ai-generated-composite` | Several of these shapes occur together in one article | If a light pass is not enough, rewrite it (see below) |

The rules that appear only with `--experimental` are still being checked for wrong findings, so they do not run by default.
"This isn't just waiting time" is a contrast frame, and "quietly eating hours" is a metaphor common in generated text.
chaff does not flag either in this article. A machine does not find every habit.

## When the shapes pile up, rewrite

Fixing the findings one by one can still leave an article of bold phrases and bullets that reads as generated.
Then rewrite it, section by section.
The steps are in [Making AI-sounding text sound human](./ai-sounding), under "The bold rewrite".

| Way to fix | What it changes | When to use it |
| --- | --- | --- |
| Light pass | Only the places chaff flagged | The content and structure are good; only the wording grates |
| Bold rewrite | Each section, and the shape of the whole article | After a light pass, it still reads as generated |

After a rewrite, run `npx chaffjs compare article.md rewritten.md` to check that no number or command was lost.
The same page has a worked rewrite and the `compare` screen.

## Checks that read meaning go to an AI

Whether a conclusion says anything new cannot be decided without reading it.
`npx chaffjs test` sends only the passages the machine narrowed down to an AI.
With `--dry-run` it shows them without sending anything.

```bash
npx chaffjs test article.md --dry-run    show what would go to an AI (sends nothing)
```

For this article, the machine narrowed down no passage, so nothing would be sent:

```
article.md   sends 0 passages out of 24 sentences (the API was not called)

      0 to send  Empty conclusion  (narrowed by machine)


────────────────────────────────────────────────────────────

  0 passages in all would be sent. With --dry-run the API was not called.
  Sent to: anthropic / claude-opus-5 (no credentials)
```

To have an AI read the passages, you need an API key. How to set it is in the [README](https://github.com/isamu/lab/tree/main/text#readme).

## A starter chaff.yaml

Put this `chaff.yaml` in the folder that holds your articles.
It keeps on the experimental rules from above that help a tech article.

```yaml
genre: blog/tech
language: en

rules:
  ai-tell: normal
  ai-generated-composite: normal
  announcing-opener: normal
  contraction-consistency: normal
  title-case-consistency: normal
  announced-count-mismatch: normal
  broken-link: normal
```

With this file in place, `npx chaffjs article.md --compact` alone shows the findings above.
Only `section-length-uniformity` is left out, so it does not appear, and `ai-generated-composite` no longer counts it.
When your team settles how it writes, add it as described in [Define your team's writing rules](./house-style).

## What to read next

- How to rewrite text that reads as generated is in [Making AI-sounding text sound human](./ai-sounding).
- How to silence one spot, and how to relax a rule, are in [Business reports](./documents-report).
- Every rule is explained in the [reference](./reference).
- For another kind of document, go back to [What chaff does for each kind of document](./documents).
