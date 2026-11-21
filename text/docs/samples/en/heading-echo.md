<!-- chaff-sample
rule: heading-echo
genre: blog/owned-media
file: article.md
-->

# First sentence repeats the heading (`heading-echo`)

**Where it helps:** articles a company publishes for its customers, blog posts, reports with many short sections.

## Original

```markdown chaff-before
# Reading your first energy bill

Your first bill from us arrives about a month after you switch.

## What the estimated reading means

This section explains what the estimated reading means.
If we had no meter reading from you, we guessed your use from the size of your home.
Send us a photo of your meter and the next bill will use the real figure.

## Why your bill is higher in winter

Your direct debit stays the same all year, so in winter you pay less than you use and in summer more.
By spring the balance usually evens out.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/owned-media article.md

article.md   blog/owned-media · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    This section explains what the estimated reading means.

  ·  Heading echoed

     The first sentence repeats the heading "What the estimated reading means"
     When the first sentence repeats the heading, the reader gains nothing by reading on. A sentence that states a figure the heading does not have (an amount, a number, a date) gives the content even when it repeats the heading, and is not reported.

     → Start from what the heading promised, not from the heading itself.

     Relax this rule:  npx chaffjs relax heading-echo


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Reading your first energy bill

Your first bill from us arrives about a month after you switch.

## What the estimated reading means

If we had no meter reading from you, we guessed your use from the size of your home.
Send us a photo of your meter and the next bill will use the real figure.

## Why your bill is higher in winter

Your direct debit stays the same all year, so in winter you pay less than you use and in summer more.
By spring the balance usually evens out.
```

## How it was fixed

A customer who opens this section has just read the heading, and wants the answer.
"This section explains what the estimated reading means" gives them the heading a second time and makes them read one more line before the answer starts.

The fix deletes the sentence. The section now opens with the answer, as the winter section already did.

## Settings

The rule compares the words of a heading with the first sentence under it. At the default level it reports an overlap of 60 percent or more; `strict` reports 45 percent and `relaxed` 75 percent.
A first sentence that states a figure the heading does not have (an amount, a number, a date) is not reported, even when it repeats the heading, because it already gives the reader something new.

```yaml chaff-settings
rules:
  heading-echo: relaxed
```

The rule does not run on manuals, help pages and FAQs, where a page often repeats its heading on purpose ("To upload a file, ..."), on contracts and statutes, on literature, or on verbatim transcripts.

```text chaff-explain
$ npx chaffjs explain heading-echo --genre blog/owned-media

  Heading echoed   (heading-echo)

  When the first sentence repeats the heading, the reader gains nothing by reading on. A sentence that states a figure the heading does not have (an amount, a number, a date) gives the content even when it repeats the heading, and is not reported.

  How to fix: Start from what the heading promised, not from the heading itself.

  Levels:
    strict   reported when the first sentence overlaps the heading by 45% or more
  → normal   reported when the first sentence overlaps the heading by 60% or more
    relaxed  reported when the first sentence overlaps the heading by 75% or more
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax heading-echo --why "reason"
```

[All samples](README.md)
