<!-- chaff-sample
rule: cold-open
genre: blog/tech
file: post.md
-->

# An opening with no situation and no example (`cold-open`)

**Where it helps:** blog posts, engineering write-ups, articles. The first paragraph, where a reader decides whether to go on.

## Original

```markdown chaff-before
# A cheaper model for our ticket summaries

You want to cut the cost of summarising support tickets.

So you move the job to a cheaper model, and it almost works. That "almost" is the problem. Sounds simple to fix. It isn't.

We run a summary on every ticket that is closed, about 9,000 a month, so that the next agent can read the history in a few lines.
Last month we tried a model that costs a tenth of the one we use now.
On a sample of 400 tickets, 31 summaries left out the customer's order number, which the next agent needs first.
We have kept the current model for now and are testing a shorter prompt that asks for the order number by name.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/tech post.md

post.md   blog/tech · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    You want to cut the cost of summarising support tickets.

  ·  An opening with no situation and no example

     "You want to cut the cost of summarising support tickets." and other shapes of an opening with no situation or example: 3 in the opening (2 needed)
     A generated article tends to open with a short wish ("You want to cut costs.") before saying who needs it and where, to repeat a word of the previous sentence in quotes ("That 'almost' is the problem."), and to tease the hard part ("Sounds simple. It isn't."). A human writer starts from a concrete situation or example that shows the problem. One of these is ordinary; together in the opening they read like a script.

     → Open with a concrete situation or example (when, who, what they did, what happened). Delete the teaser and the repeated quote, and show the difficulty in the content.

     Relax this rule:  npx chaffjs relax cold-open


─── line 5 ───────────────────────────────────────────────────

    That "almost" is the problem.

  ·  An opening with no situation and no example

     "almost" and other shapes of an opening with no situation or example: 3 in the opening (2 needed)
     A generated article tends to open with a short wish ("You want to cut costs.") before saying who needs it and where, to repeat a word of the previous sentence in quotes ("That 'almost' is the problem."), and to tease the hard part ("Sounds simple. It isn't."). A human writer starts from a concrete situation or example that shows the problem. One of these is ordinary; together in the opening they read like a script.

     → Open with a concrete situation or example (when, who, what they did, what happened). Delete the teaser and the repeated quote, and show the difficulty in the content.

     Relax this rule:  npx chaffjs relax cold-open


─── line 5 ───────────────────────────────────────────────────

    Sounds simple to fix.

  ·  An opening with no situation and no example

     "Sounds simple" and other shapes of an opening with no situation or example: 3 in the opening (2 needed)
     A generated article tends to open with a short wish ("You want to cut costs.") before saying who needs it and where, to repeat a word of the previous sentence in quotes ("That 'almost' is the problem."), and to tease the hard part ("Sounds simple. It isn't."). A human writer starts from a concrete situation or example that shows the problem. One of these is ordinary; together in the opening they read like a script.

     → Open with a concrete situation or example (when, who, what they did, what happened). Delete the teaser and the repeated quote, and show the difficulty in the content.

     Relax this rule:  npx chaffjs relax cold-open


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# A cheaper model for our ticket summaries

We run a summary on every ticket that is closed, about 9,000 a month, so that the next agent can read the history in a few lines.
Last month we tried a model that costs a tenth of the one we use now.

On a sample of 400 tickets, 31 summaries left out the customer's order number, which the next agent needs first.
We have kept the current model for now and are testing a shorter prompt that asks for the order number by name.
```

## How it was fixed

The post opens with a wish addressed to the reader ("You want to cut the cost"), repeats a word of the sentence before in quotes (That "almost" is the problem), and teases the difficulty ("Sounds simple to fix. It isn't.").
None of these says who, when or what happened. The reader has to get through a scripted opening before reaching the real story, which is in the third paragraph.

The corrected post starts with the third paragraph: what the team runs, how many tickets, what they tried.
The difficulty is shown by the number (31 summaries in 400 lost the order number) instead of being promised.

## Settings

The rule looks at the opening of the text for three shapes: a wish addressed to the reader, a word repeated in quotes, and a teaser. It reports once two of them appear; `strict` also reports from two, `relaxed` from three:

```yaml chaff-settings
rules:
  cold-open: relaxed
```

One of the shapes alone (a proposal that opens "We want to …") is not reported, nor are sentences after the opening. The rule does not run on legal, documentation, literature or speech genres.

```text chaff-explain
$ npx chaffjs explain cold-open --genre blog/tech

  An opening with no situation and no example   (cold-open)

  A generated article tends to open with a short wish ("You want to cut costs.") before saying who needs it and where, to repeat a word of the previous sentence in quotes ("That 'almost' is the problem."), and to tease the hard part ("Sounds simple. It isn't."). A human writer starts from a concrete situation or example that shows the problem. One of these is ordinary; together in the opening they read like a script.

  How to fix: Open with a concrete situation or example (when, who, what they did, what happened). Delete the teaser and the repeated quote, and show the difficulty in the content.

  Rewrite depth: structure (sections, headings and paragraphs are reorganised). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported once 2 of the shapes appear in the opening
  → normal   reported once 2 of the shapes appear in the opening
    relaxed  reported once 3 of the shapes appear in the opening
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax cold-open --why "reason"
```

[All samples](README.md)
