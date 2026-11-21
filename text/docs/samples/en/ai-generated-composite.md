<!-- chaff-sample
rule: ai-generated-composite
genre: blog/essay
file: post.md
-->

# Several signals of generated text together (`ai-generated-composite`)

**Where it helps:** blog posts, newsletters, reports. Any draft that started as a prompt and was lightly edited.

## Original

```markdown chaff-before
# Meal planning for a family of four

In today's fast-paced world, feeding a family on weeknights can feel like a second job.
Since January we have planned our dinners for the whole week on Sunday afternoon.

The plan is one sheet of paper on the fridge: seven dinners, and the shopping list underneath.
We cook twice on Sunday and once on Wednesday, and the rest of the week is leftovers and one night of pasta.

The cost? About 30 pounds a week less than before.
The time? Twenty minutes of planning instead of a daily argument about what to eat.

Pick one Sunday and try it. You won't regret it. You've got this!
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre blog/essay post.md

post.md   blog/essay · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    In today's fast-paced world, feeding a family on weeknights can feel like a second job.

  ·  Phrasing common in generated text

     "in today's fast-paced world" appears (score 9, limit 4)
     Each is ordinary on its own. Only the pile-up means anything, so the weights are summed (in a blog post, one of the heavier phrases, which human posts rarely use, is enough). This alone never says the text was generated.

     → Put it in your own words. If you cannot, the paragraph may not be needed.

     Relax this rule:  npx chaffjs relax ai-tell


─── line 3 ───────────────────────────────────────────────────

    In today's fast-paced world, feeding a family on weeknights can feel like a second job.

  ⚠  Padded opening

     "in today's fast-paced world" is an opening that fits any article
     An opening that fits any article gives the reader no reason to continue.

     → Start from a concrete situation, or from the claim only this piece makes.

     Relax this rule:  npx chaffjs relax padded-intro


─── line 3 ───────────────────────────────────────────────────

    In today's fast-paced world, feeding a family on weeknights can feel like a second job.

  ⚠  Several signals of generated text together

     "ai-tell, padded-intro, q-fragment-answer, closing-exhortation" occur together in this document (4 signals, 2 needed)
     Each of these appears in ordinary writing on its own. Only three or more in one document (two in a blog post) mean anything. **Even then it does not say the text was generated.** It marks a place to reread.

     → Read it through and check your own point is still there. Rewriting a paragraph is often faster than fixing each finding.

     Relax this rule:  npx chaffjs relax ai-generated-composite


─── line 9 ───────────────────────────────────────────────────

    The cost? About 30 pounds a week less than before.

  ·  Questions answered with a fragment

     "About 30 pounds a week less than before." and other fragment answers to your own question: 2 (2 needed)
     "Is it perfect? No." and "The result? Faster builds." ask a question and answer it at once with a few words and no verb. Once, it adds pace. Repeated, plain statements turn into a staged question and answer, a habit well known in generated text.

     → Merge the question and its answer into one plain sentence ("The result? Faster builds." becomes "The change made builds faster.").

     Relax this rule:  npx chaffjs relax q-fragment-answer


─── line 10 ──────────────────────────────────────────────────

    The time? Twenty minutes of planning instead of a daily argument about what to eat.

  ·  Questions answered with a fragment

     "Twenty minutes of planning instead of a daily argument about what to eat." and other fragment answers to your own question: 2 (2 needed)
     "Is it perfect? No." and "The result? Faster builds." ask a question and answer it at once with a few words and no verb. Once, it adds pace. Repeated, plain statements turn into a staged question and answer, a habit well known in generated text.

     → Merge the question and its answer into one plain sentence ("The result? Faster builds." becomes "The change made builds faster.").

     Relax this rule:  npx chaffjs relax q-fragment-answer


─── line 12 ──────────────────────────────────────────────────

    You won't regret it.

  ·  A closing that cheers the reader on

     "you won't regret it" and other cheering lines close the text: 2 (2 needed)
     "Give it a try, you'll be glad you did", "You've got this", "Happy baking!" end a post by cheering the reader on instead of saying something. One is ordinary; several in the closing read like the stock ending of generated text.

     → Drop the cheering and name the one thing from the text you want the reader to take away.

     Relax this rule:  npx chaffjs relax closing-exhortation


─── line 12 ──────────────────────────────────────────────────

    You've got this!

  ·  A closing that cheers the reader on

     "you've got this" and other cheering lines close the text: 2 (2 needed)
     "Give it a try, you'll be glad you did", "You've got this", "Happy baking!" end a post by cheering the reader on instead of saying something. One is ordinary; several in the closing read like the stock ending of generated text.

     → Drop the cheering and name the one thing from the text you want the reader to take away.

     Relax this rule:  npx chaffjs relax closing-exhortation


────────────────────────────────────────────────────────────

  2 warnings, 5 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Meal planning for a family of four

Since January we have planned our dinners for the whole week on Sunday afternoon.
Before that, we decided each evening at six, and usually ended up buying something on the way home.

The plan is one sheet of paper on the fridge: seven dinners, and the shopping list underneath.
We cook twice on Sunday and once on Wednesday, and the rest of the week is leftovers and one night of pasta.

We spend about 30 pounds a week less than before, and the planning takes twenty minutes.
The bigger change is that nobody asks what is for dinner any more: it is on the fridge.
```

## How it was fixed

Each finding above is small on its own. A stock opening phrase (reported by two rules, ai-tell and padded-intro), two questions answered in a word, two cheering lines at the end: human writers do each of these now and then.
Together, in a post of a few paragraphs, they are the shape of a generated draft, and the writer's own experience (a plan on the fridge, thirty pounds a week) is buried under them.

The composite finding does not say the text was generated. It says the document is worth reading through as a whole, and here the whole post was rewritten rather than patched finding by finding.
The opening now starts with what the family did; the two staged questions became one plain sentence with both numbers; the cheering at the end gave way to the change that mattered most, which only this family could have written.

## Settings

The rule counts how many different signals of generated text occur in one document. Each signal is a rule of its own (ai-tell, q-fragment-answer, closing-exhortation and so on); a signal counts once, however many times its rule fires.

In blog posts it reports two signals together, because human posts rarely reach two, and `relaxed` waits for three. In other genres it waits for three; `strict` reports from two and `relaxed` from five:

```yaml chaff-settings
rules:
  ai-generated-composite: relaxed
```

It does not run on legal, documentation, literature or transcripts, where repetition and form are part of the genre. `npx chaffjs ai-score post.md` gives a score for the whole document, from 200 words.

```text chaff-explain
$ npx chaffjs explain ai-generated-composite --genre blog/essay

  Several signals of generated text together   (ai-generated-composite)

  Each of these appears in ordinary writing on its own. Only three or more in one document (two in a blog post) mean anything. **Even then it does not say the text was generated.** It marks a place to reread.

  How to fix: Read it through and check your own point is still there. Rewriting a paragraph is often faster than fixing each finding.

  Levels:
    strict   reported once 2 signals occur together
  → normal   reported once 2 signals occur together
    relaxed  reported once 3 signals occur together
    off      not checked

  These numbers are for blog/essay. blog have numbers of their own.

  Now: normal.

  Change it:  npx chaffjs relax ai-generated-composite --why "reason"
```

[All samples](README.md)
