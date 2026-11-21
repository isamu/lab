<!-- chaff-sample
rule: rule-of-three
genre: blog/essay
file: post.md
-->

# Everything comes in threes (`rule-of-three`)

**Where it helps:** blog posts, advice articles, slide notes, summaries.

## Original

```markdown chaff-before
# Moving house with a toddler

We moved in March, from a flat on the fourth floor to a small house twenty minutes away, with a two-year-old.
Here is what worked for us.

The week before, we packed his room last:

- His bed and bedding
- The box of books he reads at bedtime
- His favourite cups

On moving day:

- One of us went ahead to the new house
- The other stayed with him at his grandmother's
- We set up his room first

Looking back, the things that mattered most were:

- Keeping his bedtime the same
- Bringing the same night light
- Not rushing the first week
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/essay post.md

post.md   blog/essay · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    - His bed and bedding - The box of books he reads at bedtime - His favourite cup

  ·  Everything comes in threes

     3 of 3 lists have exactly three items (70% allowed)
     Three items feel complete, so two become three and four become three.

     → Drop the item you added to reach three.

     Relax this rule:  npx chaffjs relax rule-of-three


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Moving house with a toddler

We moved in March, from a flat on the fourth floor to a small house twenty minutes away, with a two-year-old.
Here is what worked for us.

The week before, we packed his room last:

- His bed and bedding
- The box of books he reads at bedtime
- His favourite cups
- The rug he plays on
- The night light

On moving day, one of us went ahead to the new house while the other stayed with him at his grandmother's.
We set up his room first, so it was ready when he arrived.

Looking back, what mattered most was keeping his bedtime the same, with the same books and the same night light.
```

## How it was fixed

Every list in the post has exactly three items: three things packed last, three steps on moving day, three things that mattered.
Three feels complete, so two ideas get a third and five get cut to three. Here, the list of what was packed last had more than three things in it, and "Not rushing the first week" was there to make up the number.

The corrected post lets each list have as many items as the facts have.
The packing list grows to five; moving day, which was a sequence, becomes two sentences; and what mattered most turns out to be one thing, his bedtime.

## Settings

The rule measures the share of lists with exactly three items. With fewer than five lists, it reports only when every list has three; with more, above 70% at `normal`, 50% at `strict` and 90% at `relaxed`:

```yaml chaff-settings
rules:
  rule-of-three: relaxed
```

A document with a single list is not checked, nor are three words listed inside a sentence (fast, cheap and reliable). A list of figures after labels (Rent: $1,200) is a breakdown and is not counted. The rule does not run on legal, documentation, academic, literature or speech genres. It is also one of the signals that `ai-generated-composite` adds up: when several of them come together in one document, that rule asks for a reread. `npx chaffjs ai-score post.md` shows how a whole document compares with human writing.

```text chaff-explain
$ npx chaffjs explain rule-of-three --genre blog/essay

  Everything comes in threes   (rule-of-three)

  Three items feel complete, so two become three and four become three.

  How to fix: Drop the item you added to reach three.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 50% of lists with exactly three items
  → normal   up to 70% of lists with exactly three items
    relaxed  up to 90% of lists with exactly three items
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax rule-of-three --why "reason"
```

[All samples](README.md)
